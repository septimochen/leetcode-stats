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

`make setup` copies both examples only when the destination files do not exist.
Set `LEETCODE_USERNAME` in `.dev.vars` to your LeetCode username, then run:

```sh
make migrate-local
make dev
```

The template leaves remote D1 development disabled. Keep `--local` on local
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
[{"title":"Two Sum","titleSlug":"two-sum","timestamp":"1470000000"}]
```

The response reports `inserted` and `skipped`; each request accepts at most 5,000
records and 1 MB. Retry a failed import safely: already inserted slugs are skipped.
`GET /api/ac-submissions` returns the latest 15 recorded problems. Apply migration
`0003_ac_submissions.sql` before publishing through the migration-aware deploy command.
