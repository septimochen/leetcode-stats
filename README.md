# leetcode-stats

The Worker exposes a small dashboard at `/dashboard`. It loads `/api/stats`
in the browser and visualizes:

- daily global ranking history, where lower is better;
- latest solved-problem totals and easy/medium/hard distribution;
- ranking change from the previous snapshot;
- contest rating and contest global ranking when available; and
- the full snapshot history.

Run the Worker locally with `npx wrangler dev --local`, then open
`http://localhost:8787/dashboard`.
