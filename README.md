# leetcode-stats

The Worker exposes a small React + Tailwind dashboard at `/dashboard`. It loads `/api/stats`
in the browser and visualizes:

- daily global ranking history, where lower is better;
- latest solved-problem totals and easy/medium/hard distribution;
- ranking change from the previous snapshot;
- contest rating and contest global ranking when available; and
- the full snapshot history.

Build the frontend with `npm run build`. Run the Worker locally with `npm run dev`, then open
`http://localhost:8787/dashboard`.

Deploy with `make deploy` or `npm run deploy`. Deployment builds the frontend, applies
pending production D1 migrations, and only then publishes the Worker. If a migration
fails, deployment stops so new code cannot be published against an outdated schema.
The completion-progress feature requires `0002_problem_totals.sql`.

Common commands: `make build`, `make check`, `make test`, `make format`,
`make dev`, `make migrate-local`, and `make typegen`. Local migrations always use
`--local`; only the deployment command applies production migrations.

If a collection fails because a migration was missing, apply the pending migrations
and restart the affected Workflow instance from its failed write step:

```sh
npx wrangler d1 migrations apply leetcode-stats --remote
npx wrangler workflows instances restart leetcode-stats-workflow <instance-id> --from-step-name "save statistics to D1"
```
