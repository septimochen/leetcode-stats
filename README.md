# leetcode-stats

The Worker exposes a small React + Tailwind dashboard at `/dashboard`. It loads `/api/stats`
in the browser and visualizes:

- daily global ranking history, where lower is better;
- latest solved-problem totals and easy/medium/hard distribution;
- ranking change from the previous snapshot;
- contest rating and contest global ranking when available; and
- the full snapshot history.

## Fork setup

The repository tracks `wrangler.example.jsonc`. Your actual `wrangler.jsonc` and
`.dev.vars` are ignored so each fork can use its own Cloudflare account and database.

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
npx wrangler login
npx wrangler d1 create leetcode-stats
```

Copy the returned database ID into `database_id` in your ignored `wrangler.jsonc`,
replacing `YOUR_DATABASE_ID`. If Wrangler offers to update the config, let it update
`wrangler.jsonc`. Set the production username and deploy:

```sh
npx wrangler secret put LEETCODE_USERNAME
make deploy
```

Use your own Cloudflare account and database. Never copy another person's database
ID for your deployment. Shared configuration changes belong in
`wrangler.example.jsonc`; apply them to your local config as needed. CI must also
supply a complete `wrangler.jsonc` before using the migration-aware deployment
command. The previously committed database ID remains in Git history; it is an
identifier, not a credential.

## Development and deployment

Build the frontend with `npm run build`. Run the Worker locally with `npm run dev`, then open
`http://localhost:8787/dashboard`.

Deploy with `make deploy` or `npm run deploy`. Deployment builds the frontend, applies
pending production D1 migrations, and only then publishes the Worker. If a migration
fails, deployment stops so new code cannot be published against an outdated schema.
The completion-progress feature requires `0002_problem_totals.sql`.

Common commands: `make setup`, `make build`, `make check`, `make test`, `make format`,
`make dev`, `make migrate-local`, and `make typegen`. Local migrations always use
`--local`; only the deployment command applies production migrations.

If a collection fails because a migration was missing, apply the pending migrations
and restart the affected Workflow instance from its failed write step:

```sh
npx wrangler d1 migrations apply leetcode-stats --remote
npx wrangler workflows instances restart leetcode-stats-workflow <instance-id> --from-step-name "save statistics to D1"
```
