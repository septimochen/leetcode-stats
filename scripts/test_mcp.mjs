import assert from 'node:assert/strict';
import { Client, StreamableHTTPClientTransport } from '@modelcontextprotocol/client';

const token = process.env.MCP_AUTH_TOKEN;
assert(token?.trim(), 'Set MCP_AUTH_TOKEN to the token configured on the server');
const endpoint = new URL(process.env.MCP_URL ?? 'http://localhost:8787/mcp');
const client = new Client({ name: 'leetcode-stats-smoke', version: '1.0.0' });

try {
	await client.connect(
		new StreamableHTTPClientTransport(endpoint, {
			requestInit: { headers: { Authorization: `Bearer ${token}` } },
		}),
	);
	const { tools } = await client.listTools();
	assert(tools.some((tool) => tool.name === 'list_ac_submissions' && tool.annotations?.readOnlyHint));
	const slugs = new Set();
	const cursors = new Set();
	let cursor;
	let pages = 0;
	do {
		const result = await client.callTool({
			name: 'list_ac_submissions',
			arguments: { limit: 100, ...(cursor ? { cursor } : {}) },
		});
		assert(!result.isError, 'Accepted history tool returned an error');
		const page = result.structuredContent;
		assert(page && Array.isArray(page.submissions));
		assert(page.nextCursor === null || typeof page.nextCursor === 'string');
		for (const submission of page.submissions) {
			assert.equal(typeof submission.titleSlug, 'string');
			assert(!slugs.has(submission.titleSlug), 'A problem appeared on multiple pages');
			slugs.add(submission.titleSlug);
		}
		cursor = page.nextCursor;
		if (cursor !== null) {
			assert(!cursors.has(cursor), 'Server repeated a pagination cursor');
			cursors.add(cursor);
		}
		pages++;
	} while (cursor !== null);
	console.log(`MCP check passed: discovered list_ac_submissions; read ${slugs.size} problems across ${pages} page(s).`);
} finally {
	await client.close();
}
