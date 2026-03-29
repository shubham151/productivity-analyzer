import type { ScoredMember } from '../types';
import { METRIC_DESCRIPTIONS } from '../metricDefs';
import Tooltip from './Tooltip';

interface Props {
  member: ScoredMember;
}

interface BarRowProps {
  label: string;
  value: number;
  formatted: string;
  color: string;
}

function BarRow({ label, value, formatted, color }: BarRowProps) {
  const tip = METRIC_DESCRIPTIONS[label];
  return (
    <div className="breakdown-row">
      <span className="breakdown-label">
        {tip ? <Tooltip text={tip}><span className="metric-hint">{label}</span></Tooltip> : label}
      </span>
      <div className="breakdown-bar-wrap">
        <div
          className="breakdown-bar-fill"
          style={{ width: `${Math.round(value * 100)}%`, background: color }}
        />
      </div>
      <span className="breakdown-value">{formatted}</span>
    </div>
  );
}

function MetricLine({ label, value }: { label: string; value: string }) {
  const tip = METRIC_DESCRIPTIONS[label];
  return (
    <div className="metric-line">
      <span className="metric-line-label">
        {tip ? <Tooltip text={tip}><span className="metric-hint">{label}</span></Tooltip> : label}
      </span>
      <span className="metric-line-value">{value}</span>
    </div>
  );
}

export default function MetricsBreakdown({ member }: Props) {
  const { metrics, scores } = member;

  const fmtHrs = (h: number) =>
    h === 0 ? '—' : h < 24 ? `${h.toFixed(1)}h` : `${(h / 24).toFixed(1)}d`;
  const fmtPct = (v: number) => `${(v * 100).toFixed(0)}%`;

  return (
    <div className="metrics-breakdown">
      {/* Category score bars */}
      <div className="score-bars">
        <BarRow label="Delivery"      value={scores.delivery}      formatted={fmtPct(scores.delivery)}      color="var(--blue)"   />
        <BarRow label="Collaboration" value={scores.collaboration} formatted={fmtPct(scores.collaboration)} color="var(--green)"  />
        <BarRow label="Influence"     value={scores.influence}     formatted={fmtPct(scores.influence)}     color="var(--purple)" />
      </div>

      {/* Raw metric table */}
      <div className="raw-metrics">
        <div className="raw-metrics-section">
          <div className="raw-section-title">Delivery</div>
          <MetricLine label="PRs merged"        value={String(metrics.prs_merged)} />
          <MetricLine label="Median cycle time" value={fmtHrs(metrics.median_cycle_time_hrs)} />
          <MetricLine label="Active weeks"      value={`${metrics.consistency_weeks} / 13`} />
        </div>
        <div className="raw-metrics-section">
          <div className="raw-section-title">Collaboration</div>
          <MetricLine label="Reviews given"             value={String(metrics.reviews_given)} />
          <MetricLine label="Changes-requested rate"    value={fmtPct(metrics.changes_requested_rate)} />
          <MetricLine label="Review turnaround"         value={fmtHrs(metrics.review_turnaround_hrs)} />
          <MetricLine label="Inline comments / review"  value={metrics.review_depth_avg.toFixed(1)} />
          <MetricLine label="Unique authors reviewed"   value={String(metrics.author_diversity)} />
        </div>
        <div className="raw-metrics-section">
          <div className="raw-section-title">Influence</div>
          <MetricLine label="Reviews received"              value={String(metrics.reviews_received)} />
          <MetricLine label="Changes requested on own PRs"  value={fmtPct(metrics.changes_requested_received_rate)} />
        </div>
      </div>
    </div>
  );
}
