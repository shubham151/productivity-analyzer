import type { ScoredMember, MetaMeta } from '../types';
import Tooltip from './Tooltip';

interface Props {
  meta: MetaMeta;
  members: ScoredMember[];
}

interface StatCardProps {
  label: string;
  value: string;
  sub?: string;
  tip: string;
  accent?: string;
}

function StatCard({ label, value, sub, tip, accent }: StatCardProps) {
  return (
    <div className="stat-card">
      <Tooltip text={tip}>
        <span className="stat-label metric-hint">{label}</span>
      </Tooltip>
      <div className="stat-value" style={accent ? { color: accent } : undefined}>
        {value}
      </div>
      {sub && <div className="stat-sub">{sub}</div>}
    </div>
  );
}

function median(values: number[]): number {
  if (values.length === 0) return 0;
  const s = [...values].sort((a, b) => a - b);
  const mid = Math.floor(s.length / 2);
  return s.length % 2 === 0 ? (s[mid - 1] + s[mid]) / 2 : s[mid];
}

function fmtHrs(h: number): string {
  if (h === 0) return '—';
  if (h < 24) return `${h.toFixed(1)}h`;
  return `${(h / 24).toFixed(1)}d`;
}

function fmtNum(n: number): string {
  return n >= 1000 ? `${(n / 1000).toFixed(1)}k` : String(n);
}

export default function ProjectStats({ meta, members }: Props) {
  const from = new Date(meta.date_range.from);
  const to   = new Date(meta.date_range.to);
  const days = Math.round((to.getTime() - from.getTime()) / 86400000);

  const totalPRs       = members.reduce((s, m) => s + m.metrics.prs_merged, 0);
  const totalReviews   = members.reduce((s, m) => s + m.metrics.reviews_given, 0);
  const totalInline    = members.reduce(
    (s, m) => s + Math.round(m.metrics.review_depth_avg * m.metrics.reviews_given), 0
  );

  const activeCycleTimes = members
    .filter(m => m.metrics.prs_merged > 0 && m.metrics.median_cycle_time_hrs > 0)
    .map(m => m.metrics.median_cycle_time_hrs);
  const medianCycle = median(activeCycleTimes);

  // Most consistent shipper (most active weeks)
  const topShipper = [...members].sort(
    (a, b) => b.metrics.consistency_weeks - a.metrics.consistency_weeks
  )[0];

  // Broadest reviewer (most unique authors reviewed)
  const topReviewer = [...members].sort(
    (a, b) => b.metrics.author_diversity - a.metrics.author_diversity
  )[0];

  // Fastest reviewer (lowest turnaround, min 5 reviews given)
  const fastReviewer = [...members]
    .filter(m => m.metrics.reviews_given >= 5 && m.metrics.review_turnaround_hrs > 0)
    .sort((a, b) => a.metrics.review_turnaround_hrs - b.metrics.review_turnaround_hrs)[0];

  // Archetype distribution
  const archetypeCounts = members.reduce<Record<string, number>>((acc, m) => {
    acc[m.archetype] = (acc[m.archetype] ?? 0) + 1;
    return acc;
  }, {});

  const dateLabel = `${from.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} – ${to.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}`;

  return (
    <div className="project-stats">
      <div className="project-stats-date">{dateLabel} · {days}-day window</div>

      <div className="stats-grid">
        <StatCard
          label="Engineers analyzed"
          value={String(members.length)}
          sub={`of ${meta.total_members} org members`}
          tip={`Engineers with at least the minimum PR threshold in the ${days}-day window. Others are excluded to keep the ranking meaningful.`}
          accent="var(--text)"
        />
        <StatCard
          label="PRs merged"
          value={fmtNum(totalPRs)}
          sub={`${(totalPRs / days).toFixed(1)} / day`}
          tip="Total pull requests merged by all analyzed engineers in the window. Gives a sense of the team's overall shipping velocity."
        />
        <StatCard
          label="Reviews given"
          value={fmtNum(totalReviews)}
          sub={`${fmtNum(totalInline)} inline comments`}
          tip="Total code review submissions across all engineers. The inline comment count shows how much specific, line-level feedback the team is generating."
        />
        <StatCard
          label="Median cycle time"
          value={fmtHrs(medianCycle)}
          sub="PR open → merged"
          tip="Median of each engineer's median cycle time. A lower number means PRs are moving through review and landing in production quickly across the team."
          accent={medianCycle < 24 ? 'var(--green)' : medianCycle < 72 ? 'var(--yellow)' : 'var(--red)'}
        />
        <StatCard
          label="Most consistent"
          value={topShipper?.display_name ?? '—'}
          sub={`${topShipper?.metrics.consistency_weeks ?? 0} / 13 weeks active`}
          tip="Engineer with the most weeks that included at least one merged PR. Consistency signals reliable, sustained output rather than bursts."
        />
        <StatCard
          label="Broadest reviewer"
          value={topReviewer?.display_name ?? '—'}
          sub={`${topReviewer?.metrics.author_diversity ?? 0} unique authors`}
          tip="Engineer who reviewed PRs from the most distinct teammates. Broad reviewers spread knowledge and break down silos."
        />
        {fastReviewer && (
          <StatCard
            label="Fastest reviewer"
            value={fastReviewer.display_name}
            sub={`${fmtHrs(fastReviewer.metrics.review_turnaround_hrs)} median turnaround`}
            tip="Engineer (with ≥5 reviews given) with the lowest median time from PR open to first review. Fast reviewers unblock teammates quickly."
            accent="var(--green)"
          />
        )}
        <StatCard
          label="Team archetypes"
          value={`${archetypeCounts['Anchor'] ?? 0} Anchors`}
          sub={`${archetypeCounts['Shipper'] ?? 0} Shippers · ${archetypeCounts['Multiplier'] ?? 0} Multipliers · ${archetypeCounts['Contributor'] ?? 0} Contributors`}
          tip="Anchor: ships AND reviews heavily. Shipper: high delivery, lower reviews. Multiplier: heavy reviewer, lower personal output. Contributor: solid across the board."
        />
      </div>
    </div>
  );
}
