export const dashboardHtml = `<!doctype html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <meta name="theme-color" content="#0b111b" />
  <title>LeetCode pulse</title>
  <style>
    :root { color-scheme: dark; --bg: #080d15; --panel: #101925; --panel-2: #141f2d; --line: #243244; --text: #f1f5f9; --muted: #8fa1b5; --lime: #c7f36b; --cyan: #63d6df; --orange: #ffb86b; --red: #ff7d8a; }
    * { box-sizing: border-box; }
    body { margin: 0; background: radial-gradient(circle at 78% -20%, #1a3442 0, transparent 38%), var(--bg); color: var(--text); font: 15px/1.5 Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; }
    main { max-width: 1180px; margin: 0 auto; padding: 44px 24px 64px; }
    .eyebrow { color: var(--lime); font-size: 12px; font-weight: 800; letter-spacing: .16em; text-transform: uppercase; }
    header { display: flex; align-items: end; justify-content: space-between; gap: 24px; margin-bottom: 32px; }
    h1 { margin: 7px 0 0; font-size: clamp(2.2rem, 5vw, 4.4rem); letter-spacing: -.07em; line-height: .95; }
    .subtitle { color: var(--muted); margin: 14px 0 0; }
    .refresh { color: var(--muted); font-size: 12px; text-align: right; white-space: nowrap; }
    .refresh strong { color: var(--text); display: block; font-size: 14px; }
    .metrics { display: grid; grid-template-columns: repeat(4, 1fr); gap: 12px; margin-bottom: 12px; }
    .metric, .panel { background: linear-gradient(145deg, rgba(20,31,45,.94), rgba(13,22,34,.94)); border: 1px solid var(--line); border-radius: 18px; }
    .metric { padding: 20px; min-height: 116px; }
    .metric-label { color: var(--muted); font-size: 12px; font-weight: 700; letter-spacing: .04em; text-transform: uppercase; }
    .metric-value { display: block; font-size: 31px; font-weight: 750; letter-spacing: -.05em; margin-top: 9px; }
    .metric-note { color: var(--muted); font-size: 12px; }
    .positive { color: var(--lime); } .negative { color: var(--red); } .neutral { color: var(--cyan); }
    .layout { display: grid; grid-template-columns: minmax(0, 1.6fr) minmax(290px, .8fr); gap: 12px; }
    .panel { padding: 22px; }
    .panel-heading { display: flex; align-items: baseline; justify-content: space-between; gap: 12px; margin-bottom: 18px; }
    h2 { font-size: 16px; margin: 0; letter-spacing: -.02em; }
    .panel-heading span { color: var(--muted); font-size: 12px; }
    .chart-wrap { min-height: 330px; position: relative; }
    svg { display: block; width: 100%; height: auto; overflow: visible; }
    .gridline { stroke: var(--line); stroke-dasharray: 3 5; stroke-width: 1; }
    .axis-label { fill: var(--muted); font-size: 11px; }
    .rank-line { fill: none; stroke: var(--lime); stroke-linecap: round; stroke-linejoin: round; stroke-width: 3; }
    .rank-area { fill: url(#rank-fill); }
    .rank-dot { fill: var(--bg); stroke: var(--lime); stroke-width: 2; }
    .point-hit { fill: transparent; cursor: crosshair; }
    .point-hit:focus { outline: none; }
    .point-hit:focus + .rank-dot, .point-hit:hover + .rank-dot { fill: var(--lime); }
    .chart-tooltip { background: #f1f5f9; border-radius: 8px; color: #080d15; font-size: 12px; line-height: 1.35; opacity: 0; padding: 7px 9px; pointer-events: none; position: absolute; transform: translate(-50%, calc(-100% - 12px)); transition: opacity .12s ease; white-space: nowrap; z-index: 2; }
    .chart-tooltip.visible { opacity: 1; }
    .chart-tooltip strong { display: block; font-size: 14px; }
    .empty { color: var(--muted); padding: 70px 0; text-align: center; }
    .breakdown { display: grid; gap: 19px; }
    .bar-label { display: flex; justify-content: space-between; font-size: 13px; margin-bottom: 7px; }
    .bar-label span { color: var(--muted); }
    .bar { background: #202d3c; border-radius: 99px; height: 8px; overflow: hidden; }
    .bar i { display: block; height: 100%; border-radius: inherit; }
    .easy { background: var(--lime); } .medium { background: var(--orange); } .hard { background: var(--red); }
    .history { margin-top: 12px; overflow: hidden; }
    .table-scroll { overflow-x: auto; }
    table { border-collapse: collapse; min-width: 600px; width: 100%; }
    th, td { border-bottom: 1px solid var(--line); padding: 13px 8px; text-align: right; white-space: nowrap; }
    th:first-child, td:first-child { text-align: left; }
    th { color: var(--muted); font-size: 11px; font-weight: 700; letter-spacing: .05em; text-transform: uppercase; }
    td { font-variant-numeric: tabular-nums; }
    tr:last-child td { border-bottom: 0; }
    .error { color: var(--red); }
    @media (max-width: 760px) { main { padding: 28px 15px 45px; } header { align-items: start; flex-direction: column; margin-bottom: 24px; } .refresh { text-align: left; } .metrics { grid-template-columns: repeat(2, 1fr); } .layout { grid-template-columns: 1fr; } .panel { padding: 17px; } .chart-wrap { min-height: 260px; } }
    @media (max-width: 390px) { .metric { padding: 15px; } .metric-value { font-size: 25px; } }
  </style>
</head>
<body>
  <main>
    <header>
      <div><div class="eyebrow">Daily progress log</div><h1>LeetCode pulse</h1><p class="subtitle">A quiet look at the work behind the numbers.</p></div>
      <div class="refresh" id="updated">Loading history…</div>
    </header>
    <section class="metrics" aria-label="Latest statistics">
      <div class="metric"><div class="metric-label">Global ranking</div><strong class="metric-value" id="ranking">—</strong><span class="metric-note" id="rank-note">Awaiting data</span></div>
      <div class="metric"><div class="metric-label">Problems solved</div><strong class="metric-value" id="solved">—</strong><span class="metric-note" id="solved-note">Across all difficulties</span></div>
      <div class="metric"><div class="metric-label">Ranking change</div><strong class="metric-value" id="change">—</strong><span class="metric-note">Since previous snapshot</span></div>
      <div class="metric"><div class="metric-label">Contest rating</div><strong class="metric-value" id="contest">—</strong><span class="metric-note" id="contest-note">Latest available</span></div>
    </section>
    <section class="layout">
      <article class="panel"><div class="panel-heading"><h2>Global ranking</h2><span>Lower is better</span></div><div class="chart-wrap" id="chart"><div class="empty">Loading chart…</div></div></article>
      <article class="panel"><div class="panel-heading"><h2>Problems solved</h2><span id="total-label">Latest split</span></div><div class="breakdown" id="breakdown"><div class="empty">Loading breakdown…</div></div></article>
    </section>
    <section class="panel history"><div class="panel-heading"><h2>Snapshot history</h2><span id="snapshot-count"></span></div><div class="table-scroll"><table><thead><tr><th>Date</th><th>Ranking</th><th>Total solved</th><th>Easy</th><th>Medium</th><th>Hard</th></tr></thead><tbody id="history"></tbody></table></div></section>
  </main>
  <script type="module">
    const fmt = new Intl.NumberFormat();
    let stats = [];
    const byId = (id) => document.getElementById(id);
    const value = (number) => number == null ? '—' : fmt.format(number);
    function setText(id, text, className) { const el = byId(id); el.textContent = text; if (className) el.className = 'metric-value ' + className; }
    function renderChart(points) {
      const host = byId('chart'); if (!points.length) { host.innerHTML = '<div class="empty">No snapshots yet. Run the collector to start the chart.</div>'; return; }
      const w = 760, h = 310, pad = { top: 18, right: 18, bottom: 38, left: 64 }, innerW = w - pad.left - pad.right, innerH = h - pad.top - pad.bottom;
      const ranks = points.map((p) => p.ranking), min = Math.min(...ranks), max = Math.max(...ranks), spread = Math.max(max - min, 1000), low = Math.max(0, min - spread * .15), high = max + spread * .15;
      const x = (i) => pad.left + (points.length === 1 ? innerW / 2 : i * innerW / (points.length - 1));
      // Smaller rank numbers are better, so they sit higher on the chart.
      const y = (n) => pad.top + (n - low) * innerH / (high - low);
      const line = points.map((p, i) => (i ? 'L' : 'M') + x(i) + ' ' + y(p.ranking)).join(' '), area = line + ' L ' + x(points.length - 1) + ' ' + (h - pad.bottom) + ' L ' + x(0) + ' ' + (h - pad.bottom) + ' Z';
      const ticks = [0, .5, 1].map((n) => high - (high - low) * n), tickMarkup = ticks.map((n) => '<line class="gridline" x1="' + pad.left + '" x2="' + (w - pad.right) + '" y1="' + y(n) + '" y2="' + y(n) + '"/><text class="axis-label" x="' + (pad.left - 10) + '" y="' + (y(n) + 4) + '" text-anchor="end">' + value(Math.round(n)) + '</text>').join('');
      const xLabels = points.map((p, i) => i === 0 || i === points.length - 1 || (points.length > 5 && i === Math.floor(points.length / 2)) ? '<text class="axis-label" x="' + x(i) + '" y="' + (h - 12) + '" text-anchor="middle">' + p.date.slice(5) + '</text>' : '').join('');
      const dots = points.map((p, i) => '<circle class="point-hit" cx="' + x(i) + '" cy="' + y(p.ranking) + '" r="14" tabindex="0" aria-label="' + p.date + ': rank ' + value(p.ranking) + '" data-date="' + p.date + '" data-rank="' + p.ranking + '"/><circle class="rank-dot" cx="' + x(i) + '" cy="' + y(p.ranking) + '" r="' + (points.length > 30 ? 2.5 : 4) + '" pointer-events="none"/>').join('');
      host.innerHTML = '<svg viewBox="0 0 ' + w + ' ' + h + '" role="img" aria-label="Global ranking over time"><defs><linearGradient id="rank-fill" x1="0" x2="0" y1="0" y2="1"><stop offset="0" stop-color="#c7f36b" stop-opacity=".24"/><stop offset="1" stop-color="#c7f36b" stop-opacity="0"/></linearGradient></defs>' + tickMarkup + '<path class="rank-area" d="' + area + '"/><path class="rank-line" d="' + line + '"/>' + dots + xLabels + '</svg><div class="chart-tooltip" role="status"></div>';
      const tooltip = host.querySelector('.chart-tooltip');
      host.querySelectorAll('.point-hit').forEach((point) => {
        const show = () => {
          const bounds = point.getBoundingClientRect(), hostBounds = host.getBoundingClientRect();
          tooltip.innerHTML = '<strong>Rank ' + value(Number(point.dataset.rank)) + '</strong>' + point.dataset.date;
          tooltip.style.left = (bounds.left - hostBounds.left + bounds.width / 2) + 'px';
          tooltip.style.top = (bounds.top - hostBounds.top) + 'px';
          tooltip.classList.add('visible');
        };
        const hide = () => tooltip.classList.remove('visible');
        point.addEventListener('pointerenter', show); point.addEventListener('pointerleave', hide);
        point.addEventListener('focus', show); point.addEventListener('blur', hide);
      });
    }
    function render() {
      const latest = stats.at(-1);
      const previous = stats.at(-2);
      if (!latest) { byId('updated').innerHTML = '<strong>No history yet</strong>'; renderChart([]); byId('breakdown').innerHTML = '<div class="empty">No data to show yet.</div>'; return; }
      setText('ranking', value(latest.ranking)); setText('solved', value(latest.total_solved)); setText('contest', value(latest.contest_rating));
      const delta = previous ? latest.ranking - previous.ranking : null, deltaLabel = delta == null ? 'First snapshot' : (delta > 0 ? '+' : '') + value(delta) + ' places';
      setText('change', delta == null ? '—' : deltaLabel, delta == null ? 'neutral' : delta < 0 ? 'positive' : delta > 0 ? 'negative' : 'neutral');
      byId('rank-note').textContent = latest.date; byId('solved-note').textContent = latest.easy_solved + ' easy · ' + latest.medium_solved + ' medium · ' + latest.hard_solved + ' hard'; byId('contest-note').textContent = latest.contest_global_ranking ? 'Global rank ' + value(latest.contest_global_ranking) : 'No contest rank recorded'; byId('updated').innerHTML = '<strong>' + latest.username + '</strong>Updated ' + latest.date; byId('snapshot-count').textContent = stats.length + (stats.length === 1 ? ' snapshot' : ' snapshots');
      const total = latest.total_solved || 1; byId('total-label').textContent = value(latest.total_solved) + ' total'; byId('breakdown').innerHTML = [['Easy', latest.easy_solved, 'easy'], ['Medium', latest.medium_solved, 'medium'], ['Hard', latest.hard_solved, 'hard']].map(([label, count, cls]) => '<div><div class="bar-label"><b>' + label + '</b><span>' + value(count) + ' · ' + Math.round(count / total * 100) + '%</span></div><div class="bar"><i class="' + cls + '" style="width:' + (count / total * 100) + '%"></i></div></div>').join('');
      byId('history').innerHTML = stats.slice().reverse().map((p) => '<tr><td>' + p.date + '</td><td>' + value(p.ranking) + '</td><td>' + value(p.total_solved) + '</td><td>' + value(p.easy_solved) + '</td><td>' + value(p.medium_solved) + '</td><td>' + value(p.hard_solved) + '</td></tr>').join(''); renderChart(stats);
    }
    async function init() {
      try {
        const response = await fetch('/api/stats');
        if (!response.ok) throw new Error('Could not load stats');
        stats = (await response.json()).sort((a, b) => a.date.localeCompare(b.date));
        render();
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Unknown error';
        byId('updated').innerHTML = '<strong class="error">Unable to load history</strong>';
        byId('chart').innerHTML = '<div class="empty error">' + message + '</div>';
        byId('breakdown').innerHTML = '';
      }
    }
    init();
  </script>
</body>
</html>`;
