# leetcode-stats

The Worker exposes a small React + Tailwind dashboard at `/dashboard`. It loads `/api/stats`
in the browser and visualizes:

- daily global ranking history, where lower is better;
- latest solved-problem totals and easy/medium/hard distribution;
- ranking change from the previous snapshot;
- contest rating and contest global ranking when available; and
- the full snapshot history.

## Fork setup

The repository tracks `cloudflare.config.ts`. Your `.dev.vars` is ignored so each
fork can use its own Cloudflare account and database.

```sh
npm ci
make setup
```

`make setup` copies `.dev.vars.example` only when `.dev.vars` does not exist.
Set `LEETCODE_USERNAME` in `.dev.vars` to your LeetCode username, then run:

```sh
make migrate-local
make dev
```

The shared configuration leaves remote D1 development disabled. Keep `--local` on local
commands so development data remains separate from production.

Before your first production deployment:

```sh
cf auth login
cf d1 create leetcode-stats
```

Set the returned database ID as `CF_D1_DATABASE_ID` in your shell. Set the
production username and deploy:

```sh
cf workers secrets update LEETCODE_USERNAME --worker leetcode-stats --type secret_text
make deploy
```

Keep `CF_D1_DATABASE_ID` in your shell or an untracked local environment file;
it is intentionally not stored in this repository.

Use your own Cloudflare account and database. Never copy another person's database
ID for your deployment. Shared configuration changes belong in
`cloudflare.config.ts`; CI must provide its own credentials and
`CF_D1_DATABASE_ID` before using the migration-aware deployment command.

## Development and deployment

Build the frontend with `npm run build`. Run the Worker locally with `npm run dev`, then open
`http://localhost:8787/dashboard`.

Deploy with `make deploy` or `npm run deploy`. Deployment builds the frontend, applies
pending production D1 migrations, and only then publishes the Worker. If a migration
fails, deployment stops so new code cannot be published against an outdated schema.
The completion-progress feature requires `0002_problem_totals.sql`.

Common commands: `make setup`, `make build`, `make check`, `make test`, `make format`,
`make dev`, `make migrate-local`, and `make typegen`. Set `CF_D1_DATABASE_ID` before
migration commands; local migrations use `--local`, while deployment applies
production migrations before publishing.

If a collection fails because a migration was missing, apply the pending migrations
and restart the affected Workflow instance from its failed write step:

```sh
cf d1 migrations apply "$CF_D1_DATABASE_ID"
cf workflows instances restart leetcode-stats-workflow <instance-id> --from-step-name "save statistics to D1"
```

## Accepted problem history

Each daily Workflow fetches up to 20 recent accepted submissions and adds previously
unseen problem slugs. LeetCode's feed is limited to 20 entries, so more than 20
acceptances between runs can leave gaps. The table stores one record per problem,
not every submission: a later acceptance or import never replaces an existing slug.
The dashboard displays the 15 records with the latest recorded timestamps.

To enable historical imports, set a long, random `AC_IMPORT_TOKEN` Worker secret:

```sh
cf workers secrets update AC_IMPORT_TOKEN --worker leetcode-stats --type secret_text
```

For local use, add `AC_IMPORT_TOKEN` to the ignored `.dev.vars`. Send a JSON array
of objects to the API; timestamps are Unix seconds (numbers or digit strings):

```sh
curl -X POST http://localhost:8787/api/ac-submissions \
  -H "Authorization: Bearer $AC_IMPORT_TOKEN" -H 'Content-Type: application/json' \
  --data-binary @history.json
```

Example `history.json`:

```json
[{ "title": "Two Sum", "titleSlug": "two-sum", "timestamp": "1470000000" }]
```

The response reports `inserted` and `skipped`; each request accepts at most 5,000
records and 1 MB. Retry a failed import safely: already inserted slugs are skipped.
`GET /api/ac-submissions` returns the latest 15 recorded problems. Apply migration
`0003_ac_submissions.sql` before publishing through the migration-aware deploy command.

### Converting a LeetCode progress export

Save the complete GraphQL response containing `data.userProgressQuestionList` as
JSON, then run `uv run python scripts/create_history.py progress.json history.json`.
The output defaults to `history.json` when the second argument is omitted, and is
ignored by Git. Only questions marked `SOLVED` are included; incomplete exports
are rejected. The export has no acceptance time: the script uses `lastSubmittedAt`
as an approximation, including when a solved question's latest result was not AC.
It reports those cases. Existing API records are never overwritten, so importing
this approximation cannot replace timestamps already collected from the AC feed.
Follow the import command above after reviewing the generated file.

Python tooling uses `uv`; `make check`, `make test`, and `make format` also run the
Python checks, tests, and formatter.

## MCP accepted history

The same Worker serves a read-only MCP server at `/mcp` using Streamable HTTP.
It reads D1 directly and does not trigger collection or contact LeetCode. It is
intended for a single configured account and clients that support an Authorization
header. OAuth and browser sign-in are not provided.

Choose a long, random token distinct from `AC_IMPORT_TOKEN` and configure it before
deploying:

```sh
cf workers secrets update MCP_AUTH_TOKEN --worker leetcode-stats --type secret_text
make deploy
```

For local development, add `MCP_AUTH_TOKEN=<your-local-token>` to the ignored
`.dev.vars`, run `make migrate-local`, then `make dev`. Existing `.dev.vars` files
are preserved by `make setup`, so add the new entry yourself. Local development
uses local D1. The installed `cf` beta rejects top-level `cf dev --local`, so
`make dev` uses `cf dev --implArgs=--local` to explicitly forward local mode to
its development runtime. `make typegen` regenerates the tracked
`worker-configuration.d.ts` from the shared configuration through the current
Cloudflare CLI.

Configure your MCP client with:

| Setting   | Value                                                                 |
| --------- | --------------------------------------------------------------------- |
| Transport | Streamable HTTP                                                       |
| URL       | `https://<your-worker-host>/mcp` (local: `http://localhost:8787/mcp`) |
| Header    | `Authorization: Bearer <your-MCP_AUTH_TOKEN>`                         |

Keep the token in your client's secret storage or environment, outside Git.
An unset or blank server token returns HTTP `503`; missing or incorrect credentials
return `401`. The import token cannot authenticate MCP requests. Authentication
applies to `/mcp`; the existing HTTP API has its own access rules.

### Tool: `list_ac_submissions`

- Optional `limit`: integer from 1 to 500, default 100.
- Optional `cursor`: opaque `nextCursor` from the preceding response.
- Returns `{ submissions, nextCursor }`; each submission has `title`, `titleSlug`,
  and a Unix-seconds `timestamp`. The same object is returned as structured content
  and JSON text for client compatibility.
- Records are ordered by timestamp descending, then problem slug ascending.
  Continue calling with `nextCursor` until it is `null` to retrieve all stored
  history. A single call may return only part of the history.

For example, call with `{ "limit": 100 }`, then call with
`{ "limit": 100, "cursor": "<nextCursor>" }` for each remaining page.
Pagination tolerates equal timestamps and newer inserts without shifting existing
pages; it is not a frozen database snapshot. Restart from the first page to include
newer problems added while traversing.

“Full history” means every problem currently stored in `ac_submissions`, not every
accepted attempt or a guarantee of complete LeetCode history. Each problem retains
its first stored record, repeat solves are ignored, collection can miss entries,
and exported timestamps may be approximate (see Accepted problem history above).
No additional migration is needed beyond the existing `0003_ac_submissions.sql`.
The dashboard continues to display the latest 15 stored problems.

To check a running local server using the installed SDK client:

```sh
MCP_URL=http://localhost:8787/mcp MCP_AUTH_TOKEN='your-local-token' make test-mcp
```

The smoke check discovers the tool and traverses all pages, reporting counts only.
It does not import submissions, run collection, or modify the database.
