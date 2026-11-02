import { env } from 'cloudflare:test';
import { Client, StreamableHTTPClientTransport, type CallToolResult } from '@modelcontextprotocol/client';
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

import worker from '../src/index';
import { saveAcSubmissions } from '../src/db';
import type { AcSubmission } from '../src/leetcode';
import submissionsSql from '../migrations/0003_ac_submissions.sql?raw';

const testEnv = { ...env, MCP_AUTH_TOKEN: 'mcp-test-secret', AC_IMPORT_TOKEN: 'import-test-secret' };
const clients: Client[] = [];
type Page = { submissions: AcSubmission[]; nextCursor: string | null };

async function connect(bindings = testEnv): Promise<Client> {
	const client = new Client({ name: 'history-test', version: '1.0.0' });
	clients.push(client);
	await client.connect(
		new StreamableHTTPClientTransport(new URL('https://example.com/mcp'), {
			requestInit: { headers: { Authorization: 'Bearer mcp-test-secret' } },
			fetch: async (input, init) => worker.fetch(new Request(input, init), bindings),
		}),
	);
	return client;
}

function page(result: CallToolResult): Page {
	expect(result.isError).not.toBe(true);
	expect(result.content).toEqual([{ type: 'text', text: JSON.stringify(result.structuredContent) }]);
	return result.structuredContent as Page;
}

beforeAll(async () => {
	for (const statement of submissionsSql
		.split(';')
		.map((part) => part.trim())
		.filter(Boolean)) {
		await env.DB.prepare(statement).run();
	}
});
beforeEach(async () => {
	await env.DB.prepare('DELETE FROM ac_submissions').run();
});
afterEach(async () => {
	await Promise.all(clients.splice(0).map((client) => client.close()));
	vi.restoreAllMocks();
});

describe('accepted history MCP', () => {
	it('rejects unconfigured, missing, incorrect, and import-token credentials before accessing D1', async () => {
		const prepare = vi.fn();
		const bindings = { ...testEnv, DB: { prepare } as unknown as D1Database };
		for (const token of ['', 'wrong', 'import-test-secret']) {
			const response = await worker.fetch(
				new Request('https://example.com/mcp', {
					method: 'POST',
					headers: token ? { Authorization: `Bearer ${token}` } : {},
				}),
				bindings,
			);
			expect(response.status).toBe(401);
			expect(response.headers.get('WWW-Authenticate')).toContain('Bearer');
		}
		for (const token of [undefined, '', '   ']) {
			const response = await worker.fetch(new Request('https://example.com/mcp'), { ...bindings, MCP_AUTH_TOKEN: token } as Env);
			expect(response.status).toBe(503);
		}
		expect(prepare).not.toHaveBeenCalled();
	});

	it('discovers one read-only tool and returns empty history', async () => {
		const client = await connect();
		const { tools } = await client.listTools();
		expect(tools.map((tool) => tool.name)).toEqual(['list_ac_submissions']);
		expect(tools[0].annotations?.readOnlyHint).toBe(true);
		expect(page(await client.callTool({ name: 'list_ac_submissions', arguments: {} }))).toEqual({ submissions: [], nextCursor: null });
	});

	it('traverses every stored problem once across tied timestamps and a final partial page', async () => {
		const rows = Array.from({ length: 23 }, (_, index) => ({
			title: `Problem ${index}`,
			titleSlug: `problem-${String(index).padStart(2, '0')}`,
			timestamp: Math.floor(index / 8),
		}));
		await saveAcSubmissions(env.DB, rows);
		const client = await connect();
		const all: AcSubmission[] = [];
		let cursor: string | null = null;
		const sizes: number[] = [];
		do {
			const result = page(await client.callTool({ name: 'list_ac_submissions', arguments: { limit: 5, ...(cursor ? { cursor } : {}) } }));
			all.push(...result.submissions);
			sizes.push(result.submissions.length);
			cursor = result.nextCursor;
			expect(sizes.length).toBeLessThanOrEqual(5);
		} while (cursor !== null);
		expect(sizes).toEqual([5, 5, 5, 5, 3]);
		expect(all).toEqual([...rows].sort((a, b) => b.timestamp - a.timestamp || a.titleSlug.localeCompare(b.titleSlug)));
		expect(new Set(all.map((row) => row.titleSlug)).size).toBe(rows.length);
		const recent = await worker.fetch(new Request('https://example.com/api/ac-submissions'), testEnv);
		expect(await recent.json()).toEqual(all.slice(0, 15));
	});

	it('defaults to 100, accepts 500, and has no next cursor for an exact-size final page', async () => {
		await saveAcSubmissions(
			env.DB,
			Array.from({ length: 101 }, (_, index) => ({
				title: `Problem ${index}`,
				titleSlug: `problem-${index}`,
				timestamp: index,
			})),
		);
		const client = await connect();
		const first = page(await client.callTool({ name: 'list_ac_submissions', arguments: {} }));
		expect(first.submissions).toHaveLength(100);
		expect(first.nextCursor).toEqual(expect.any(String));
		const last = page(await client.callTool({ name: 'list_ac_submissions', arguments: { limit: 1, cursor: first.nextCursor } }));
		expect(last.submissions).toHaveLength(1);
		expect(last.nextCursor).toBeNull();
		expect(page(await client.callTool({ name: 'list_ac_submissions', arguments: { limit: 500 } })).submissions).toHaveLength(101);
	});

	it('rejects invalid inputs and cursors without querying the database', async () => {
		const prepare = vi.fn(() => {
			throw new Error('query should not run');
		});
		const client = await connect({ ...testEnv, DB: { prepare } as unknown as D1Database });
		const invalidArguments = [
			...[0, -1, 501, 1.5, '5', null].map((limit) => ({ limit })),
			...[
				'',
				'!',
				'a'.repeat(1025),
				btoa('not json'),
				btoa('{}'),
				btoa(JSON.stringify({ version: 1, timestamp: -1, titleSlug: 'two-sum' })),
				btoa(JSON.stringify({ version: 2, timestamp: 1, titleSlug: 'two-sum' })),
				btoa(JSON.stringify({ version: 1, timestamp: 1, titleSlug: "x' OR 1=1" })),
			].map((cursor) => ({ cursor })),
		];
		for (const args of invalidArguments) {
			const result = await client.callTool({ name: 'list_ac_submissions', arguments: args });
			expect(result.isError).toBe(true);
		}
		expect(prepare).not.toHaveBeenCalled();
	});

	it('keeps cursor traversal stable when a newer problem is inserted between pages', async () => {
		await saveAcSubmissions(env.DB, [
			{ title: 'B', titleSlug: 'b', timestamp: 2 },
			{ title: 'A', titleSlug: 'a', timestamp: 1 },
		]);
		const client = await connect();
		const first = page(await client.callTool({ name: 'list_ac_submissions', arguments: { limit: 1 } }));
		await saveAcSubmissions(env.DB, [{ title: 'C', titleSlug: 'c', timestamp: 3 }]);
		const second = page(await client.callTool({ name: 'list_ac_submissions', arguments: { limit: 1, cursor: first.nextCursor } }));
		expect(second).toEqual({ submissions: [{ title: 'A', titleSlug: 'a', timestamp: 1 }], nextCursor: null });
	});

	it('sanitizes database failures in tool results', async () => {
		vi.spyOn(console, 'error').mockImplementation(() => {});
		const prepare = vi.fn(() => {
			throw new Error('D1_ERROR private table and SQL details');
		});
		const client = await connect({ ...testEnv, DB: { prepare } as unknown as D1Database });
		const result = await client.callTool({ name: 'list_ac_submissions', arguments: {} });
		expect(result.isError).toBe(true);
		expect(result.content).toEqual([{ type: 'text', text: 'Could not load accepted submissions. Please retry later.' }]);
		expect(JSON.stringify(result)).not.toContain('D1_ERROR');
	});
});
