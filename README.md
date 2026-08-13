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
