// Lightweight charts built with CSS/JS only (no SVG, no chart library).
// Donut = conic-gradient; bars = flex divs.

interface Slice {
  label: string;
  value: number;
  color: string;
}

export function Donut({
  slices,
  size = 120,
  thickness = 18,
  center,
}: {
  slices: Slice[];
  size?: number;
  thickness?: number;
  center?: React.ReactNode;
}) {
  const total = slices.reduce((a, s) => a + Math.max(0, s.value), 0) || 1;
  let acc = 0;
  const stops = slices
    .map((s) => {
      const start = (acc / total) * 360;
      acc += Math.max(0, s.value);
      const end = (acc / total) * 360;
      return `${s.color} ${start}deg ${end}deg`;
    })
    .join(", ");

  const summary = slices
    .map((s) => `${s.label} ${Math.round((Math.max(0, s.value) / total) * 100)}%`)
    .join(", ");

  return (
    <div className="chart-donut">
      <div
        className="chart-donut__ring"
        role="img"
        aria-label={summary || "No data"}
        style={{
          width: size,
          height: size,
          background: total > 0 ? `conic-gradient(${stops})` : "var(--surface-2)",
        }}
      >
        <div className="chart-donut__hole" style={{ inset: thickness }}>
          {center}
        </div>
      </div>
      <div className="chart-donut__legend">
        {slices.map((s) => (
          <div key={s.label} className="spread fs-13">
            <span className="chart-donut__slice-label">
              <span className="chart-donut__swatch" style={{ background: s.color }} />
              {s.label}
            </span>
            <span className="muted">{Math.round((Math.max(0, s.value) / total) * 100)}%</span>
          </div>
        ))}
      </div>
    </div>
  );
}

/** A single rounded track split into proportional colored segments, with a
    legend of count chips below. Honest at any shape: one status → one full bar. */
export function StatusBar({ segments }: { segments: Slice[] }) {
  const shown = segments.filter((s) => s.value > 0);
  const total = shown.reduce((a, s) => a + s.value, 0) || 1;
  const summary = shown.map((s) => `${s.label} ${s.value}`).join(", ");
  return (
    <div>
      <div className="chart-statusbar__track" role="img" aria-label={summary || "No data"}>
        {shown.map((s) => (
          <div key={s.label} title={`${s.label}: ${s.value}`} style={{ flex: s.value, background: s.color }} />
        ))}
      </div>
      <div className="chart-statusbar__legend">
        {shown.map((s) => (
          <span key={s.label} className="chart-legend-item">
            <span className="dot-9" style={{ background: s.color }} />
            {s.label}
            <span className="muted txt-strong">{s.value}</span>
          </span>
        ))}
      </div>
    </div>
  );
}

export interface BarDatum {
  label: string;
  value: number;
  color?: string;
}

/** Horizontal comparison bars. */
export function Bars({ data, max }: { data: BarDatum[]; max?: number }) {
  const top = max ?? Math.max(1, ...data.map((d) => d.value));
  return (
    <div className="chart-bars">
      {data.map((d) => (
        <div key={d.label}>
          <div className="spread row-label-12">
            <span className="muted">{d.label}</span>
          </div>
          <div className="pbar" role="img" aria-label={`${d.label}: ${d.value}`}>
            <div
              className="pbar__fill"
              style={{ width: `${Math.min(100, (d.value / top) * 100)}%`, background: d.color ?? "var(--accent)" }}
            />
          </div>
        </div>
      ))}
    </div>
  );
}

export interface GroupedDatum {
  label: string;
  budget: number;
  actual: number;
}

/** Paired horizontal bars per event: "Budget vs Actual" style comparisons.
    An event whose actual spend has passed its budget renders that bar in
    the alert color instead of the normal accent, so going over is
    something you notice at a glance, not something you have to work out
    by comparing two bar lengths yourself. */
export function GroupedBars({ data }: { data: GroupedDatum[] }) {
  const top = Math.max(1, ...data.flatMap((d) => [d.budget, d.actual]));
  const anyOver = data.some((d) => d.actual > d.budget);
  return (
    <div className="chart-groupedbars">
      <div className="chart-groupedbars__legend">
        <span className="chart-legend-item">
          <span className="dot-9" style={{ background: "var(--muted)", opacity: 0.6 }} />
          <span className="muted">Budget</span>
        </span>
        <span className="chart-legend-item">
          <span className="dot-9 dot-9--accent" />
          <span className="muted">Actual</span>
        </span>
        {anyOver && (
          <span className="chart-legend-item">
            <span className="dot-9" style={{ background: "var(--alert)" }} />
            <span className="muted">Over budget</span>
          </span>
        )}
      </div>
      {data.map((d) => {
        const over = d.actual > d.budget;
        return (
          <div key={d.label}>
            <div className="chart-groupedbars__label">{d.label}</div>
            <div className="pbar mb-1" role="img" aria-label={`${d.label} budget: ${d.budget}`}>
              <div className="pbar__fill pbar__fill--budget" style={{ width: `${Math.min(100, (d.budget / top) * 100)}%` }} />
            </div>
            <div className="pbar" role="img" aria-label={`${d.label} actual: ${d.actual}${over ? ", over budget" : ""}`}>
              <div
                className={`pbar__fill${over ? " pbar__fill--over" : " pbar__fill--actual"}`}
                style={{ width: `${Math.min(100, (d.actual / top) * 100)}%` }}
              />
            </div>
          </div>
        );
      })}
    </div>
  );
}
