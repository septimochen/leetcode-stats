# AGENTS.md

## Project Overview

`leetcode-stats` is a Cloudflare Workers application that collects a user's
LeetCode statistics once per day and stores historical snapshots in
Cloudflare D1.

The project uses:

- Cloudflare Workers
- Cloudflare Workflows
- Cloudflare Cron Triggers
- Cloudflare D1
- TypeScript
- LeetCode GraphQL API

The application is designed to run entirely on the Cloudflare Workers Free
plan.

---

## Goals

The primary goal is to:

1. Fetch the user's current LeetCode statistics.
2. Store one snapshot per user per day in D1.
3. Run automatically once per day.
4. Expose the stored statistics through an HTTP API.
5. Keep the implementation simple and inexpensive.
6. Make local development possible without accidentally accessing the
   production D1 database.

---

## Architecture

The production architecture is:

```text
                         Cloudflare
                             │
                     Cron Trigger
                     10 16 * * *
                             │
                             ▼
                    Worker scheduled()
                             │
                             ▼
                 Workflow.create()
                             │
                             ▼
                    LeetCode GraphQL
                             │
                             ▼
                         D1
                             │
                             ▼
                    Historical stats
```

The HTTP API is:

```text
GET /
GET /api/stats
GET /api/latest
GET /api/run
```

The `/api/run` endpoint is primarily for manual testing.

---

## Important Free Plan Constraint

Cloudflare Workflows are available on the Workers Free plan.

However, scheduled Workflows using the Workflow `schedules` configuration
require a paid Workers plan.

Therefore, do NOT configure:

```json
{
  "workflows": [
    {
      "schedules": [
        "10 16 * * *"
      ]
    }
  ]
}
```

Instead, use a normal Worker Cron Trigger:

```json
{
  "triggers": {
    "crons": [
      "10 16 * * *"
    ]
  }
}
```

The Cron Trigger invokes the Worker's `scheduled()` handler, which then
creates the Workflow.

This keeps the application compatible with the Workers Free plan.

---

# Directory Structure

```text
leetcode-stats/
├── src/
│   ├── index.ts
│   ├── leetcode.ts
│   └── db.ts
│
├── migrations/
│   └── 0001_initial.sql
│
├── wrangler.jsonc
├── package.json
├── tsconfig.json
├── worker-configuration.d.ts
└── AGENTS.md
```

---

# Cloudflare Configuration

The expected `wrangler.jsonc` structure is:

```json
{
  "$schema": "./node_modules/wrangler/config-schema.json",

  "name": "leetcode-stats",

  "main": "src/index.ts",

  "compatibility_date": "2026-08-11",

  "d1_databases": [
    {
      "binding": "DB",
      "database_name": "leetcode-stats",
      "database_id": "YOUR_DATABASE_ID"
    }
  ],

  "vars": {
    "LEETCODE_USERNAME": "septimochen"
  },

  "triggers": {
    "crons": [
      "10 16 * * *"
    ]
  },

  "workflows": [
    {
      "name": "leetcode-stats-workflow",
      "binding": "LEETCODE_STATS_WORKFLOW",
      "class_name": "LeetCodeStatsWorkflow"
    }
  ]
}
```

The actual D1 `database_id` should be kept in the project configuration as
required by Wrangler.

---

# Timezone

Cloudflare Cron Triggers use UTC.

Singapore is UTC+8.

The current schedule is:

```text
10 16 * * *
```

which means:

```text
16:10 UTC
00:10 Singapore
```

Therefore the job runs every day at approximately:

```text
00:10 Asia/Singapore
```

Do not change the cron expression to `10 00 * * *` unless the intended time is
00:10 UTC.

---

# Compatibility Date

The local Wrangler version previously reported:

```text
wrangler 4.121.0
```

The local Workerd binary supported compatibility dates only through:

```text
2026-08-11
```

Therefore the project uses:

```json
"compatibility_date": "2026-08-11"
```

Do not automatically change this to the current calendar date.

If Wrangler is upgraded and supports a newer compatibility date, the date can
be updated intentionally.

---

# Workflow

The Workflow class is:

```ts
export class LeetCodeStatsWorkflow extends WorkflowEntrypoint<
  Env,
  WorkflowParams
> {
  async run(
    event: WorkflowEvent<WorkflowParams>,
    step: WorkflowStep,
  ) {
    // ...
  }
}
```

The Workflow performs three conceptual steps:

```text
1. Fetch LeetCode statistics
2. Determine the snapshot date
3. Save the statistics to D1
```

Conceptually:

```text
Workflow
   │
   ├── fetch LeetCode
   │
   ├── determine date
   │
   └── save D1
```

The Workflow receives:

```ts
interface WorkflowParams {
  username: string;
}
```

---

# Worker HTTP Handler

The default Worker export contains both:

```ts
fetch()
```

and:

```ts
scheduled()
```

The `fetch()` handler provides the HTTP API.

The `scheduled()` handler is invoked by Cloudflare Cron Triggers.

The scheduled handler should create a Workflow:

```ts
async scheduled(
  controller: ScheduledController,
  env: Env,
  ctx: ExecutionContext,
): Promise<void> {
  console.log(
    `Cron triggered: ${controller.cron}`,
  );

  await env.LEETCODE_STATS_WORKFLOW.create({
    params: {
      username: env.LEETCODE_USERNAME,
    },
  });
}
```

---

# API Endpoints

## GET /

Health check.

Expected response:

```json
{
  "name": "leetcode-stats",
  "status": "ok"
}
```

---

## GET /api/stats

Returns all historical snapshots for the configured user.

Example:

```json
[
  {
    "id": 1,
    "username": "septimochen",
    "date": "2026-08-12",
    "ranking": 1057482,
    "reputation": 0,
    "total_solved": 160,
    "easy_solved": 74,
    "medium_solved": 79,
    "hard_solved": 7,
    "contest_rating": null,
    "contest_global_ranking": null,
    "created_at": "2026-08-12 14:16:39"
  }
]
```

---

## GET /api/latest

Returns the most recent snapshot.

---

## GET /api/run

Manually creates a Workflow instance.

This endpoint is useful during development and initial deployment testing.

Example:

```bash
curl https://leetcode-stats.<subdomain>.workers.dev/api/run
```

Expected response:

```json
{
  "instanceId": "..."
}
```

After the Workflow finishes:

```bash
curl https://leetcode-stats.<subdomain>.workers.dev/api/stats
```

should show the newly collected record.

### Production consideration

`/api/run` should eventually be protected or removed.

Otherwise anyone who knows the Worker URL could trigger additional Workflow
executions.

Possible future approaches:

- Remove the endpoint entirely.
- Require an authentication token.
- Restrict it to development.
- Use Cloudflare Access.

---

# D1 Schema

The database contains a `stats` table.

The conceptual schema is:

```sql
CREATE TABLE stats (
    id INTEGER PRIMARY KEY AUTOINCREMENT,

    username TEXT NOT NULL,

    date TEXT NOT NULL,

    ranking INTEGER NOT NULL,

    reputation INTEGER NOT NULL,

    total_solved INTEGER NOT NULL,

    easy_solved INTEGER NOT NULL,

    medium_solved INTEGER NOT NULL,

    hard_solved INTEGER NOT NULL,

    contest_rating INTEGER,

    contest_global_ranking INTEGER,

    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,

    UNIQUE(username, date)
);
```

---

# Daily Uniqueness

The database uses:

```sql
UNIQUE(username, date)
```

This is intentional.

The application should store at most one snapshot per user per day.

If the Workflow executes twice on the same day, the application uses an
upsert:

```sql
ON CONFLICT(username, date)
DO UPDATE SET ...
```

Therefore:

```text
2026-08-12
```

should not produce multiple records for the same user.

---

# Database Functions

`src/db.ts` contains database access functions.

Main functions:

```ts
saveStats()
```

Stores or updates a daily snapshot.

```ts
getAllStats()
```

Returns all historical snapshots for a user.

```ts
getLatestStats()
```

Returns the latest snapshot.

Database queries should use parameter binding:

```ts
db
  .prepare("SELECT * FROM stats WHERE username = ?")
  .bind(username)
```

Do not construct SQL using string interpolation with user-controlled values.

---

# LeetCode Integration

`src/leetcode.ts` is responsible for communicating with the LeetCode API.

The application currently retrieves:

- Username
- Ranking
- Reputation
- Total solved
- Easy solved
- Medium solved
- Hard solved
- Contest rating
- Contest global ranking

The data is normalized into:

```ts
interface LeetCodeStats {
  username: string;
  ranking: number;
  reputation: number;
  totalSolved: number;
  easySolved: number;
  mediumSolved: number;
  hardSolved: number;
  contestRating: number | null;
  contestGlobalRanking: number | null;
}
```

LeetCode data should be fetched inside a Workflow step.

---

# Workflow Reliability

External API requests should happen inside a Workflow step:

```ts
await step.do(
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
```

D1 writes should also happen inside a Workflow step with retries.

This gives the Workflow durable execution and retry behavior.

---

# Local Development

This is important.

Use:

```bash
npx wrangler dev --local
```

Do NOT assume:

```bash
npx wrangler dev
```

is equivalent when debugging this project.

During development, local mode should use the local D1 database:

```text
.wrangler/state/v3/d1/
```

---

# Local D1

To query the local database:

```bash
npx wrangler d1 execute leetcode-stats --local \
  --command "SELECT * FROM stats;"
```

To list tables:

```bash
npx wrangler d1 execute leetcode-stats --local \
  --command "SELECT name FROM sqlite_master WHERE type='table';"
```

Do not use:

```bash
--command ".tables"
```

because `.tables` is a SQLite CLI dot-command, not SQL, and Wrangler sends
the argument to SQLite as SQL.

---

# Remote D1

To query the production database:

```bash
npx wrangler d1 execute leetcode-stats --remote \
  --command "SELECT * FROM stats;"
```

The local and remote D1 databases are separate.

```text
--local
    ↓
.wrangler/state/v3/d1/

--remote
    ↓
Cloudflare D1
```

---

# Production API

After deployment, the production API can be queried with:

```bash
curl https://leetcode-stats.<subdomain>.workers.dev/api/stats
```

This request goes through:

```text
Internet
   ↓
Cloudflare Worker
   ↓
Remote D1
```

It does NOT access the local D1.

---

# Applying Migrations

For local development:

```bash
npx wrangler d1 migrations apply leetcode-stats --local
```

For production:

```bash
npx wrangler d1 migrations apply leetcode-stats --remote
```

Always make sure the production migration has been applied before deploying
code that expects the schema.

---

# Deployment

Typical production deployment:

```bash
npx wrangler d1 migrations apply leetcode-stats --remote
```

then:

```bash
npx wrangler deploy
```

After deployment:

```bash
curl https://leetcode-stats.<subdomain>.workers.dev/api/stats
```

---

# Type Generation

When changing bindings in `wrangler.jsonc`, regenerate Worker types:

```bash
npx wrangler types
```

This updates:

```text
worker-configuration.d.ts
```

The generated `Env` interface should contain bindings such as:

```ts
interface Env {
  DB: D1Database;

  LEETCODE_USERNAME: string;

  LEETCODE_STATS_WORKFLOW: Workflow;
}
```

Do not manually invent binding types if Wrangler can generate them.

---

# Workflow Binding

The following configuration:

```json
"workflows": [
  {
    "name": "leetcode-stats-workflow",
    "binding": "LEETCODE_STATS_WORKFLOW",
    "class_name": "LeetCodeStatsWorkflow"
  }
]
```

creates the Worker environment binding:

```ts
env.LEETCODE_STATS_WORKFLOW
```

The class must be exported from `src/index.ts`:

```ts
export class LeetCodeStatsWorkflow extends WorkflowEntrypoint<
  Env,
  WorkflowParams
> {
  ...
}
```

If the class is not exported, Wrangler reports:

```text
Your Worker depends on the following Workflows,
which are not exported in your entrypoint file
```

---

# Manual Workflow Testing

The recommended testing sequence is:

```text
1. Test Worker
2. Test D1
3. Test Workflow
4. Test production
5. Test Cron
```

## Step 1

```bash
curl http://localhost:8787/
```

Expected:

```json
{
  "name": "leetcode-stats",
  "status": "ok"
}
```

## Step 2

```bash
curl http://localhost:8787/api/stats
```

Initially:

```json
[]
```

## Step 3

```bash
curl http://localhost:8787/api/run
```

Expected:

```json
{
  "instanceId": "..."
}
```

## Step 4

Wait for the Workflow, then:

```bash
curl http://localhost:8787/api/stats
```

Expected:

```json
[
  {
    "username": "septimochen",
    ...
  }
]
```

## Step 5

Test production:

```bash
curl https://leetcode-stats.<subdomain>.workers.dev/api/stats
```

---

# Local Cron Testing

Cloudflare provides a local scheduled-handler endpoint.

With:

```bash
npx wrangler dev --local
```

test the scheduled handler with:

```bash
curl "http://localhost:8787/cdn-cgi/handler/scheduled?format=json"
```

This allows testing the Cron → Worker → Workflow path without waiting until
the real scheduled time.

---

# Production Cron Flow

The production daily execution should be:

```text
00:10 Singapore
      │
      │
      ▼
16:10 UTC
      │
      ▼
Cloudflare Cron Trigger
      │
      ▼
scheduled()
      │
      ▼
LEETCODE_STATS_WORKFLOW.create()
      │
      ▼
LeetCodeStatsWorkflow
      │
      ├── fetch LeetCode
      │
      ├── determine date
      │
      └── save D1
```

---

# Current Known Working State

The system has successfully produced a local record:

```json
{
  "id": 1,
  "username": "septimochen",
  "date": "2026-08-12",
  "ranking": 1057482,
  "reputation": 0,
  "total_solved": 160,
  "easy_solved": 74,
  "medium_solved": 79,
  "hard_solved": 7,
  "contest_rating": null,
  "contest_global_ranking": null
}
```

The production remote D1 has also been successfully populated.

Therefore the complete pipeline has been verified:

```text
LeetCode
   ↓
Worker
   ↓
Workflow
   ↓
D1
   ↓
HTTP API
```

---

# Debugging Lessons

## 1. Local vs Remote D1

A major source of confusion was:

```bash
npx wrangler d1 execute ... --local
```

versus:

```bash
npx wrangler d1 execute ... --remote
```

and:

```bash
npx wrangler dev --local
```

versus:

```bash
npx wrangler dev --remote
```

Always explicitly use `--local` during local development when testing the
local database.

---

## 2. `.tables` is not SQL

This fails:

```bash
npx wrangler d1 execute leetcode-stats --local \
  --command ".tables"
```

Use:

```sql
SELECT name
FROM sqlite_master
WHERE type = 'table';
```

instead.

---

## 3. Workflow must be exported

If `wrangler.jsonc` contains:

```json
"class_name": "LeetCodeStatsWorkflow"
```

then `src/index.ts` must contain:

```ts
export class LeetCodeStatsWorkflow ...
```

---

## 4. Workflow schedules are not the Free-plan solution

Do not use:

```json
"schedules": [...]
```

inside the Workflow configuration for this project.

Use:

```json
"triggers": {
  "crons": [...]
}
```

and:

```ts
scheduled()
```

instead.

---

## 5. Direct D1 tests don't test the Worker

This:

```bash
npx wrangler d1 execute leetcode-stats --remote ...
```

only tests D1.

This:

```bash
curl https://...workers.dev/api/stats
```

tests:

```text
HTTP
 ↓
Worker
 ↓
D1
```

Use both when debugging.

---

# Development Principles

1. Keep the Worker HTTP layer thin.
2. Keep LeetCode API logic in `leetcode.ts`.
3. Keep D1 queries in `db.ts`.
4. Keep durable orchestration in the Workflow.
5. Keep scheduling in the Worker Cron Trigger.
6. Never hardcode database data into application logic.
7. Use parameterized SQL.
8. Use one snapshot per user per day.
9. Prefer Workflow retries for external API failures.
10. Test local and remote environments separately.
11. Never accidentally use production D1 during local development.
12. Regenerate Worker types after changing bindings.
13. Do not expose an unrestricted manual Workflow trigger in the final
    production version.

---

# Future Improvements

Potential future features:

## Historical API

Add:

```text
GET /api/history
```

with support for:

```text
?days=30
```

---

## Ranking Change

Calculate:

```text
today ranking
-
yesterday ranking
```

and expose:

```json
{
  "ranking": 1057482,
  "rankingChange": -1234
}
```

Remember that a lower LeetCode ranking is better.

---

## Solved Problem Growth

Track:

```text
totalSolved
easySolved
mediumSolved
hardSolved
```

over time.

---

## Dashboard

Build a frontend using:

- Cloudflare Pages
- React
- Vite
- TypeScript

Possible charts:

```text
Ranking over time
Solved problems over time
Easy / Medium / Hard distribution
Daily solved growth
```

---

## Authentication

Protect administrative endpoints such as:

```text
/api/run
```

before exposing them publicly.

---

## Multiple Users

The database already uses:

```text
username + date
```

as the logical unique key, so the schema can support multiple LeetCode users.

A future version could collect statistics for multiple usernames.

---

# Useful Commands

## Install dependencies

```bash
npm install
```

## Generate Worker types

```bash
npx wrangler types
```

## Local development

```bash
npx wrangler dev --local
```

## Local D1 query

```bash
npx wrangler d1 execute leetcode-stats --local \
  --command "SELECT * FROM stats;"
```

## Remote D1 query

```bash
npx wrangler d1 execute leetcode-stats --remote \
  --command "SELECT * FROM stats;"
```

## Apply local migrations

```bash
npx wrangler d1 migrations apply leetcode-stats --local
```

## Apply production migrations

```bash
npx wrangler d1 migrations apply leetcode-stats --remote
```

## Deploy

```bash
npx wrangler deploy
```

## List Workflows

```bash
npx wrangler workflows list
```

## Check Wrangler version

```bash
npx wrangler --version
```

---

# Final Architecture Summary

```text
                         ┌───────────────────┐
                         │   Cloudflare Cron  │
                         │    16:10 UTC       │
                         │  00:10 Singapore   │
                         └─────────┬─────────┘
                                   │
                                   ▼
                         ┌───────────────────┐
                         │      Worker       │
                         │   scheduled()     │
                         └─────────┬─────────┘
                                   │
                                   │ create()
                                   ▼
                         ┌───────────────────┐
                         │     Workflow      │
                         │                   │
                         │ Fetch LeetCode    │
                         │       ↓           │
                         │ Save D1           │
                         └─────────┬─────────┘
                                   │
                                   ▼
                         ┌───────────────────┐
                         │    Cloudflare D1  │
                         │                   │
                         │ username + date   │
                         │       UNIQUE      │
                         └─────────┬─────────┘
                                   │
                                   ▼
                         ┌───────────────────┐
                         │     HTTP API      │
                         │                   │
                         │ /api/stats        │
                         │ /api/latest       │
                         │ /api/run          │
                         └───────────────────┘
```

The project is intended to remain **serverless, low-maintenance, and compatible
with the Cloudflare Workers Free plan**.
