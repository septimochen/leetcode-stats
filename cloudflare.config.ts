/// <reference types="node" />

import { bindings, defineConfig, exports, triggers } from "cf/config";

/**
 * Secret-like files were detected but not read or migrated: .dev.vars, .dev.vars.example. Only `secrets.required` entries are migrated.
 * @see https://developers.cloudflare.com/workers/configuration/secrets/
 */

export default defineConfig({
	worker: {
		name: "leetcode-stats",
		compatibilityDate: "2026-08-11",
		compatibilityFlags: [
			"nodejs_compat",
		],
		entrypoint: "src/index.ts",
		observability: {
			enabled: true,
		},
		assets: {
			runWorkerFirst: [
				"/api/*",
				"/dashboard",
			],
		},
		triggers: [
			triggers.scheduled({
				schedule: "30 11 * * *",
			}),
		],
		env: {
			DB: bindings.d1({
				name: "leetcode-stats",
				id: process.env.CF_D1_DATABASE_ID ?? "",
				dev: {
					remote: true,
				},
			}),
			LEETCODE_STATS_WORKFLOW: bindings.workflow({
				name: "leetcode-stats-workflow",
				worker: "leetcode-stats",
				exportName: "LeetCodeStatsWorkflow",
			}),
			ASSETS: bindings.assets(),
		},
		exports: {
			LeetCodeStatsWorkflow: exports.workflow({
				name: "leetcode-stats-workflow",
			}),
		},
	},
});
