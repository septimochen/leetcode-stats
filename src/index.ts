import {
	WorkflowEntrypoint,
	type WorkflowEvent,
	type WorkflowStep,
} from "cloudflare:workers";

import { fetchLeetCodeStats } from "./leetcode";
import { getAllStats, getLatestStats, saveStats } from "./db";
import { dashboardHtml } from "./dashboard";

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

		if (url.pathname === "/") {
			return Response.json({
				name: "leetcode-stats",
				status: "ok",
			});
		}

		if (url.pathname === "/dashboard") {
			return new Response(dashboardHtml, {
				headers: {
					"content-type": "text/html; charset=UTF-8",
					"cache-control": "no-cache",
				},
			});
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
