import { useEffect, useMemo, useState } from "react";

type Snapshot = {
  username: string;
  date: string;
  ranking: number;
  total_solved: number;
  easy_solved: number;
  medium_solved: number;
  hard_solved: number;
  contest_rating: number | null;
  contest_global_ranking: number | null;
};

const numberFormat = new Intl.NumberFormat();
const formatNumber = (value: number | null | undefined) =>
  value == null ? "—" : numberFormat.format(value);
const formatThousands = (value: number) => `${numberFormat.format(Math.round(value / 1000))}K`;

function niceTickStep(range: number, tickCount: number) {
  const roughStep = range / Math.max(tickCount - 1, 1);
  const magnitude = 10 ** Math.floor(Math.log10(roughStep));
  const normalized = roughStep / magnitude;
  const niceNormalized = normalized <= 1 ? 1 : normalized <= 2 ? 2 : normalized <= 5 ? 5 : 10;
  return niceNormalized * magnitude;
}

function Metric({ label, value, note, tone = "" }: { label: string; value: string; note: string; tone?: string }) {
  return (
    <div className="rounded-2xl border border-line bg-panel p-5">
      <div className="text-xs font-bold uppercase tracking-wider text-muted">{label}</div>
      <strong className={`mt-2 block text-3xl font-bold tracking-tight ${tone}`}>{value}</strong>
      <span className="text-xs text-muted">{note}</span>
    </div>
  );
}

function RankingChart({ points }: { points: Snapshot[] }) {
  const [hovered, setHovered] = useState<number | null>(null);
  if (!points.length) return <div className="py-20 text-center text-muted">No snapshots yet. Run the collector to start the chart.</div>;

  const width = 760;
  const height = 310;
  const padding = { top: 18, right: 18, bottom: 38, left: 64 };
  const innerWidth = width - padding.left - padding.right;
  const innerHeight = height - padding.top - padding.bottom;
  const ranks = points.map((point) => point.ranking);
  const min = Math.min(...ranks);
  const max = Math.max(...ranks);
  const tickCount = 5;
  const step = niceTickStep(Math.max(max - min, 1000), tickCount);
  const low = Math.max(0, Math.floor(min / step) * step);
  const high = Math.max(low + step, Math.ceil(max / step) * step);
  const x = (index: number) => padding.left + (points.length === 1 ? innerWidth / 2 : index * innerWidth / (points.length - 1));
  // SVG y grows downward, so this intentionally puts smaller ranks at the top.
  const y = (rank: number) => padding.top + (rank - low) * innerHeight / (high - low);
  const line = points.map((point, index) => `${index ? "L" : "M"}${x(index)} ${y(point.ranking)}`).join(" ");
  const area = `${line} L ${x(points.length - 1)} ${height - padding.bottom} L ${x(0)} ${height - padding.bottom} Z`;
  const ticks = Array.from({ length: Math.floor((high - low) / step) + 1 }, (_, index) => high - index * step);

  return (
    <div className="relative">
      <svg viewBox={`0 0 ${width} ${height}`} className="block h-auto w-full overflow-visible" role="img" aria-label="Global ranking over time">
        <defs>
          <linearGradient id="rank-fill" x1="0" x2="0" y1="0" y2="1">
            <stop offset="0" stopColor="#c7f36b" stopOpacity=".24" />
            <stop offset="1" stopColor="#c7f36b" stopOpacity="0" />
          </linearGradient>
        </defs>
        {ticks.map((tick) => (
          <g key={tick}>
            <line className="stroke-line" x1={padding.left} x2={width - padding.right} y1={y(tick)} y2={y(tick)} />
            <rect x={padding.left - 62} y={y(tick) - 10} width="52" height="18" rx="4" fill="#080d15" fillOpacity=".92" />
            <text className="fill-white text-[11px] font-semibold" x={padding.left - 10} y={y(tick) + 4} textAnchor="end">{formatThousands(tick)}</text>
          </g>
        ))}
        <path d={area} fill="url(#rank-fill)" />
        <path d={line} fill="none" className="stroke-lime" strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" />
        {points.map((point, index) => (
          <g key={`${point.date}-${index}`}>
            <circle
              cx={x(index)} cy={y(point.ranking)} r="14" fill="transparent" className="cursor-crosshair"
              tabIndex={0} aria-label={`${point.date}: rank ${formatNumber(point.ranking)}`}
              onMouseEnter={() => setHovered(index)} onMouseLeave={() => setHovered(null)}
              onFocus={() => setHovered(index)} onBlur={() => setHovered(null)}
            />
            <circle cx={x(index)} cy={y(point.ranking)} r={points.length > 30 ? 2.5 : 4} fill="#080d15" className="stroke-lime" strokeWidth="2" pointerEvents="none" />
          </g>
        ))}
        {points.map((point, index) => index === 0 || index === points.length - 1 || (points.length > 5 && index === Math.floor(points.length / 2)) ? (
          <g key={`label-${point.date}`}>
            <rect x={x(index) - 25} y={height - 27} width="50" height="18" rx="4" fill="#080d15" fillOpacity=".92" />
            <text className="fill-white text-[11px] font-semibold" x={x(index)} y={height - 12} textAnchor="middle">{point.date.slice(5)}</text>
          </g>
        ) : null)}
      </svg>
      {hovered != null && (
        <div className="pointer-events-none absolute -translate-x-1/2 -translate-y-full rounded-lg bg-slate-100 px-2 py-1 text-xs leading-tight text-slate-950" style={{ left: `${x(hovered) / width * 100}%`, top: `${y(points[hovered].ranking) / height * 100}%` }} role="status">
          <strong className="block text-sm">Rank {formatNumber(points[hovered].ranking)}</strong>
          {points[hovered].date}
        </div>
      )}
    </div>
  );
}

function Breakdown({ latest }: { latest: Snapshot }) {
  const total = latest.total_solved || 1;
  const values = [["Easy", latest.easy_solved, "bg-lime"], ["Medium", latest.medium_solved, "bg-orange"], ["Hard", latest.hard_solved, "bg-red"]] as const;
  return <div className="grid gap-5">{values.map(([label, count, color]) => <div key={label}><div className="mb-2 flex justify-between text-sm"><b>{label}</b><span className="text-muted">{formatNumber(count)} · {Math.round(count / total * 100)}%</span></div><div className="h-2 overflow-hidden rounded-full bg-slate-700"><i className={`block h-full rounded-full ${color}`} style={{ width: `${count / total * 100}%` }} /></div></div>)}</div>;
}

export default function App() {
  const [stats, setStats] = useState<Snapshot[]>([]);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => { fetch("/api/stats").then((response) => { if (!response.ok) throw new Error("Could not load stats"); return response.json() as Promise<Snapshot[]>; }).then((data) => setStats(data.sort((a, b) => a.date.localeCompare(b.date)))).catch((reason: unknown) => setError(reason instanceof Error ? reason.message : "Unknown error")); }, []);

  const latest = stats.at(-1);
  const previous = stats.at(-2);
  const rankingChange = useMemo(() => previous && latest ? latest.ranking - previous.ranking : null, [latest, previous]);
  if (error) return <main className="mx-auto max-w-5xl px-6 py-16 text-red"><h1 className="text-3xl font-bold">Unable to load history</h1><p>{error}</p></main>;
  if (!latest) return <main className="mx-auto max-w-5xl px-6 py-16"><p className="text-lime">DAILY PROGRESS LOG</p><h1 className="mt-2 text-5xl font-bold tracking-tight">LeetCode pulse</h1><p className="mt-4 text-muted">Loading history…</p></main>;

  return <main className="mx-auto max-w-6xl px-6 py-11"><header className="mb-8 flex items-end justify-between gap-6 max-md:flex-col max-md:items-start"><div><p className="font-bold uppercase tracking-widest text-lime">Daily progress log</p><h1 className="mt-2 text-6xl font-bold leading-none tracking-tighter max-md:text-5xl">LeetCode pulse</h1><p className="mt-4 text-muted">A quiet look at the work behind the numbers.</p></div><div className="text-right text-xs text-muted max-md:text-left"><strong className="block text-sm text-white">{latest.username}</strong>Updated {latest.date}</div></header>
    <section className="mb-3 grid grid-cols-4 gap-3 max-md:grid-cols-2"><Metric label="Global ranking" value={formatNumber(latest.ranking)} note={latest.date} /><Metric label="Problems solved" value={formatNumber(latest.total_solved)} note={`${latest.easy_solved} easy · ${latest.medium_solved} medium · ${latest.hard_solved} hard`} /><Metric label="Ranking change" value={rankingChange == null ? "—" : `${rankingChange > 0 ? "+" : ""}${formatNumber(rankingChange)} places`} note="Since previous snapshot" tone={rankingChange == null ? "text-cyan" : rankingChange < 0 ? "text-lime" : rankingChange > 0 ? "text-red" : "text-cyan"} /><Metric label="Contest rating" value={formatNumber(latest.contest_rating)} note={latest.contest_global_ranking ? `Global rank ${formatNumber(latest.contest_global_ranking)}` : "No contest rank recorded"} /></section>
    <section className="grid grid-cols-[minmax(0,1.6fr)_minmax(290px,.8fr)] gap-3 max-md:grid-cols-1"><article className="rounded-2xl border border-line bg-panel p-6"><div className="mb-5 flex justify-between"><h2 className="font-semibold">Global ranking</h2></div><RankingChart points={stats} /></article><article className="rounded-2xl border border-line bg-panel p-6"><div className="mb-5 flex justify-between"><h2 className="font-semibold">Problems solved</h2><span className="text-xs text-muted">{formatNumber(latest.total_solved)} total</span></div><Breakdown latest={latest} /></article></section>
    <section className="mt-3 overflow-hidden rounded-2xl border border-line bg-panel p-6"><div className="mb-5 flex justify-between"><h2 className="font-semibold">Snapshot history</h2><span className="text-xs text-muted">{stats.length} {stats.length === 1 ? "snapshot" : "snapshots"}</span></div><div className="overflow-x-auto"><table className="w-full min-w-150 border-collapse text-right text-sm"><thead className="text-xs uppercase tracking-wider text-muted"><tr><th className="p-2 text-left">Date</th><th className="p-2">Ranking</th><th className="p-2">Total solved</th><th className="p-2">Easy</th><th className="p-2">Medium</th><th className="p-2">Hard</th></tr></thead><tbody>{stats.slice().reverse().map((point) => <tr key={point.date} className="border-t border-line"><td className="p-3 text-left">{point.date}</td><td className="p-3">{formatNumber(point.ranking)}</td><td className="p-3">{formatNumber(point.total_solved)}</td><td className="p-3">{formatNumber(point.easy_solved)}</td><td className="p-3">{formatNumber(point.medium_solved)}</td><td className="p-3">{formatNumber(point.hard_solved)}</td></tr>)}</tbody></table></div></section>
  </main>;
}
