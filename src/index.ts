import {
	WorkflowEntrypoint,
	type WorkflowEvent,
	type WorkflowStep,
} from "cloudflare:workers";

import { fetchLeetCodeStats, fetchRecentAcSubmissions, parseAcSubmission } from "./leetcode";
import { getAllStats, getLatestStats, saveStats, getRecentAcSubmissions, saveAcSubmissions } from "./db";
import { handleMcpRequest } from "./mcp";

interface WorkflowParams {
	username: string;
}

/**
 * Daily LeetCode statistics collector.
 *
 * Workflow:
 *
 *   fetch LeetCode
 *        ↓
 *   determine date
 *        ↓
 *   save to D1
 */
export class LeetCodeStatsWorkflow extends WorkflowEntrypoint<
	Env,
	WorkflowParams
> {
	async run(
		event: WorkflowEvent<WorkflowParams>,
		step: WorkflowStep,
	) {
		const username = event.payload.username;

		const stats = await step.do(
			"fetch LeetCode statistics",
			{
				retries: {
					limit: 5,
					delay: "30 seconds",
					backoff: "exponential",
				},
				timeout: "2 minutes",
			},
			async () => {
				return await fetchLeetCodeStats(username);
			},
		);

		const date = await step.do(
			"determine collection date",
			async () => {
				return new Date(event.timestamp)
					.toISOString()
					.slice(0, 10);
			},
		);

		await step.do(
			"save statistics to D1",
			{
				retries: {
					limit: 5,
					delay: "10 seconds",
					backoff: "exponential",
				},
				timeout: "1 minute",
			},
			async () => {
				await saveStats(
					this.env.DB,
					stats,
					date,
				);

				return {
					username,
					date,
					ranking: stats.ranking,
					totalSolved: stats.totalSolved,
				};
			},
		);

		const submissions = await step.do("fetch recent accepted submissions", {
			retries: { limit: 5, delay: "30 seconds", backoff: "exponential" },
			timeout: "2 minutes",
		}, async () => fetchRecentAcSubmissions(username));

		await step.do("save accepted submissions to D1", {
			retries: { limit: 5, delay: "10 seconds", backoff: "exponential" },
			timeout: "1 minute",
		}, async () => saveAcSubmissions(this.env.DB, submissions));

		return {
			username,
			date,
			ranking: stats.ranking,
			reputation: stats.reputation,
			totalSolved: stats.totalSolved,
			easySolved: stats.easySolved,
			mediumSolved: stats.mediumSolved,
			hardSolved: stats.hardSolved,
			contestRating: stats.contestRating,
			contestGlobalRanking:
				stats.contestGlobalRanking,
		};
	}
}

/**
 * HTTP API
 */
export default {
	async fetch(
		request: Request,
		env: Env,
	): Promise<Response> {
		const url = new URL(request.url);

		if (url.pathname === "/mcp") {
			return handleMcpRequest(request, env);
		}

		if (url.pathname === "/") {
			return Response.json({
				name: "leetcode-stats",
				status: "ok",
			});
		}

		if (url.pathname === "/dashboard") {
			return env.ASSETS.fetch(new Request(new URL("/index.html", request.url)));
		}

		if (url.pathname === "/api/stats") {
			try {
				const stats = await getAllStats(
					env.DB,
					env.LEETCODE_USERNAME,
				);

				return Response.json(stats);
			} catch (error) {
				console.error(error);

				return Response.json(
					{
						error:
							error instanceof Error
								? error.message
								: String(error),
					},
					{ status: 500 },
				);
			}
		}

		if (url.pathname === "/api/latest") {
			try {
				const stats = await getLatestStats(
					env.DB,
					env.LEETCODE_USERNAME,
				);

				return Response.json(stats);
			} catch (error) {
				console.error(error);

				return Response.json(
					{
						error:
							error instanceof Error
								? error.message
								: String(error),
					},
					{ status: 500 },
				);
			}
		}

		if (url.pathname === "/api/ac-submissions") {
			if (request.method === "GET") {
				try {
					return Response.json(await getRecentAcSubmissions(env.DB));
				} catch (error) {
					console.error(error);
					return Response.json({ error: "Could not load accepted submissions" }, { status: 500 });
				}
			}
			if (request.method !== "POST") return Response.json({ error: "Method not allowed" }, { status: 405, headers: { Allow: "GET, POST" } });
			const token = (env as Env & { AC_IMPORT_TOKEN?: string }).AC_IMPORT_TOKEN;
			if (!token) return Response.json({ error: "Import is not configured" }, { status: 503 });
			if (request.headers.get("Authorization") !== `Bearer ${token}`) return Response.json({ error: "Unauthorized" }, { status: 401 });
			const contentLength = Number(request.headers.get("Content-Length"));
			if (contentLength > 1_000_000) return Response.json({ error: "Import too large" }, { status: 413 });
			let data: unknown;
			try {
				const text = await request.text();
				if (new TextEncoder().encode(text).length > 1_000_000) return Response.json({ error: "Import too large" }, { status: 413 });
				data = JSON.parse(text);
			} catch {
				return Response.json({ error: "Expected a JSON array" }, { status: 400 });
			}
			if (!Array.isArray(data) || data.length > 5000) return Response.json({ error: "Expected an array of at most 5000 submissions" }, { status: 400 });
			const submissions = data.map(parseAcSubmission);
			if (submissions.some(submission => submission === null)) return Response.json({ error: "Invalid submission: expected title, titleSlug, and Unix timestamp in seconds" }, { status: 400 });
			try {
				const inserted = await saveAcSubmissions(env.DB, submissions.filter(submission => submission !== null));
				return Response.json({ inserted, skipped: submissions.length - inserted });
			} catch (error) {
				console.error(error);
				return Response.json({ error: "Could not import accepted submissions; retrying is safe" }, { status: 500 });
			}
		}

		if (url.pathname === "/api/run") {
			try {
				const instance =
					await env.LEETCODE_STATS_WORKFLOW.create(
						{
							params: {
								username:
									env.LEETCODE_USERNAME,
							},
						},
					);

				return Response.json({
					instanceId: instance.id,
				});
			} catch (error) {
				console.error(error);

				return Response.json(
					{
						error:
							error instanceof Error
								? error.message
								: String(error),
					},
					{ status: 500 },
				);
			}
		}

		return Response.json(
			{ error: "Not found" },
			{ status: 404 },
		);
	},

	async scheduled(
		controller: ScheduledController,
		env: Env,
		ctx: ExecutionContext,
	): Promise<void> {
		console.log(
			"Cron triggered:",
			controller.cron,
			controller.scheduledTime,
		);

		await env.LEETCODE_STATS_WORKFLOW.create({
			params: {
				username: env.LEETCODE_USERNAME,
			},
		});
	},
};
