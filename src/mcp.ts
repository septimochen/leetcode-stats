import { McpServer } from '@modelcontextprotocol/server';
import { createMcpHandler } from 'agents/mcp/server';
import { z } from 'zod';

import { getAcSubmissionsPage, type AcSubmissionPosition } from './db';

const positionSchema = z
	.object({
		version: z.literal(1),
		timestamp: z.number().int().min(0).max(8640000000000),
		titleSlug: z
			.string()
			.min(1)
			.max(300)
			.regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/),
	})
	.strict();

function encodeCursor(position: AcSubmissionPosition): string {
	return btoa(JSON.stringify({ version: 1, ...position }))
		.replaceAll('+', '-')
		.replaceAll('/', '_')
		.replace(/=+$/, '');
}

function decodeCursor(cursor: string): AcSubmissionPosition {
	if (!/^[A-Za-z0-9_-]+$/.test(cursor)) throw new Error('Invalid cursor');
	const decoded: unknown = JSON.parse(atob(cursor.replaceAll('-', '+').replaceAll('_', '/')));
	return positionSchema.parse(decoded);
}

function registerAcceptedHistoryTool(server: McpServer, db: D1Database): void {
	server.registerTool(
		'list_ac_submissions',
		{
			description:
				'List accepted problems stored for the configured LeetCode account, newest first. Follow nextCursor until null for full stored history. One record per problem, not every accepted attempt; imports and collection may have gaps or approximate timestamps. This does not refresh LeetCode data.',
			inputSchema: z
				.object({
					limit: z.number().int().min(1).max(500).default(100),
					cursor: z.string().min(1).max(1024).optional(),
				})
				.strict(),
			outputSchema: z.object({
				submissions: z.array(z.object({ title: z.string(), titleSlug: z.string(), timestamp: z.number().int() })),
				nextCursor: z.string().nullable(),
			}),
			annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false },
		},
		async ({ limit, cursor }) => {
			let after: AcSubmissionPosition | undefined;
			if (cursor !== undefined) {
				try {
					after = decodeCursor(cursor);
				} catch {
					return {
						isError: true,
						content: [{ type: 'text', text: 'Invalid cursor. Use nextCursor from a previous response or omit cursor to start again.' }],
					};
				}
			}
			try {
				const { submissions, nextPosition } = await getAcSubmissionsPage(db, limit, after);
				const result = { submissions, nextCursor: nextPosition ? encodeCursor(nextPosition) : null };
				return { structuredContent: result, content: [{ type: 'text', text: JSON.stringify(result) }] };
			} catch (error) {
				console.error('MCP accepted history query failed', error);
				return { isError: true, content: [{ type: 'text', text: 'Could not load accepted submissions. Please retry later.' }] };
			}
		},
	);
}

function createServer(env: Env): McpServer {
	const server = new McpServer({ name: 'leetcode-stats', version: '1.0.0' });
	registerAcceptedHistoryTool(server, env.DB);
	return server;
}

export async function handleMcpRequest(request: Request, env: Env): Promise<Response> {
	if (!env.MCP_AUTH_TOKEN?.trim()) {
		return Response.json({ error: 'MCP is not configured' }, { status: 503 });
	}
	const authorization = request.headers.get('Authorization') ?? '';
	// Compare fixed-size hashes to avoid leaking token contents through comparison timing.
	const encoder = new TextEncoder();
	const [actual, expected] = await Promise.all([
		crypto.subtle.digest('SHA-256', encoder.encode(authorization)),
		crypto.subtle.digest('SHA-256', encoder.encode(`Bearer ${env.MCP_AUTH_TOKEN}`)),
	]);
	if (!crypto.subtle.timingSafeEqual(actual, expected)) {
		return Response.json(
			{ error: 'Unauthorized' },
			{
				status: 401,
				headers: { 'WWW-Authenticate': 'Bearer realm="leetcode-stats-mcp"' },
			},
		);
	}
	return createMcpHandler(() => createServer(env), { corsOptions: false }).fetch(request);
}
