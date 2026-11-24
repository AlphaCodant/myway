import { shortDay } from '@/lib/format';

type Point = { day: string; value: number; secondary?: number };

/** Histogramme simple en SVG (pas de dépendance) : une barre par jour, la part « livrée » en foncé. */
export function BarChart({ points, format = String, label }: { points: Point[]; format?: (n: number) => string; label: string }) {
  const max = Math.max(1, ...points.map((p) => p.value));
  const w = 640;
  const h = 200;
  const bw = points.length ? Math.min(56, (w - 20) / points.length - 8) : 0;
  return (
    <svg viewBox={`0 0 ${w} ${h + 60}`} className="chart" role="img" aria-label={label}>
      {points.map((p, i) => {
        const x = 10 + i * ((w - 20) / points.length) + 4;
        const bh = (p.value / max) * h;
        const sh = ((p.secondary ?? 0) / max) * h;
        return (
          <g key={p.day}>
            <rect x={x} y={h - bh + 30} width={bw} height={bh} rx={4} className="bar" />
            {p.secondary !== undefined && <rect x={x} y={h - sh + 30} width={bw} height={sh} rx={4} className="bar strong" />}
            <text x={x + bw / 2} y={h - bh + 24} textAnchor="middle" className="bar-label">
              {p.value ? format(p.value) : ''}
            </text>
            <text x={x + bw / 2} y={h + 50} textAnchor="middle" className="axis">
              {shortDay(p.day)}
            </text>
          </g>
        );
      })}
    </svg>
  );
}
