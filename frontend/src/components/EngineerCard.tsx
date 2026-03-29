import { useState } from 'react';
import type { AIEnrichment, ScoredMember } from '../types';
import { Api } from '../utils/Api';
import MetricsBreakdown from './MetricsBreakdown';

const ARCHETYPE_COLORS: Record<string, string> = {
  Anchor: 'var(--green)',
  Shipper: 'var(--blue)',
  Multiplier: 'var(--purple)',
  Contributor: 'var(--text-muted)',
};

const ARCHETYPE_DESC: Record<string, string> = {
  Anchor: 'Ships & reviews',
  Shipper: 'High delivery',
  Multiplier: 'High collaboration',
  Contributor: 'Solid contributor',
};

const CATEGORY_COLORS: Record<string, string> = {
  feature: '#58a6ff',
  bugfix: '#f85149',
  refactor: '#d29922',
  infra: '#bc8cff',
  chore: '#6e7681',
};

function Sparkline({ values }: { values: number[] }) {
  const max = Math.max(...values, 1);
  const W = 104;
  const H = 28;
  const pts = values.map((v, i) => {
    const x = (i / (values.length - 1)) * W;
    const y = H - (v / max) * H;
    return `${x},${y}`;
  });
  const polyline = pts.join(' ');
  return (
    <svg
      width={W}
      height={H}
      viewBox={`0 0 ${W} ${H}`}
      className="sparkline"
      aria-label="Weekly activity"
    >
      <polyline
        points={polyline}
        fill="none"
        stroke="var(--blue)"
        strokeWidth="1.5"
        strokeLinejoin="round"
        strokeLinecap="round"
      />
    </svg>
  );
}

function WorkTypeBar({ dist }: { dist: Record<string, number> }) {
  const entries = Object.entries(dist).filter(([, v]) => v > 0);
  return (
    <div className="work-type-bar">
      {entries.map(([type, pct]) => (
        <div
          key={type}
          className="work-type-segment"
          style={{ width: `${pct * 100}%`, background: CATEGORY_COLORS[type] ?? '#888' }}
          title={`${type}: ${Math.round(pct * 100)}%`}
        />
      ))}
    </div>
  );
}

interface Props {
  member: ScoredMember;
  aiEnabled: boolean;
}

export default function EngineerCard({ member, aiEnabled }: Props) {
  const [expanded, setExpanded] = useState(false);
  const [enrichment, setEnrichment] = useState<AIEnrichment | null>(null);
  const [enrichLoading, setEnrichLoading] = useState(false);
  const [enrichError, setEnrichError] = useState<string | null>(null);

  const { metrics, scores, archetype, rank } = member;
  const compositePercent = Math.round(scores.composite * 100);

  const handleAnalyze = async () => {
    if (enrichment) {
      setExpanded(e => !e);
      return;
    }

    setExpanded(true);
    setEnrichLoading(true);
    setEnrichError(null);

    try {
      // Check cache first — 404 means not cached yet, fall through to POST
      const cacheUrl = `/api/ai/enrich/${member.username}`;
      const cached = await Api.get<AIEnrichment>(cacheUrl)
        .catch(e => (String(e).includes('404') ? null : Promise.reject(e)));

      if (cached) {
        setEnrichment(cached);
        return;
      }

      // Run fresh enrichment
      const enrichUrl = `/api/ai/enrich/${member.username}`;
      const result = await Api.post<AIEnrichment>(enrichUrl);
      setEnrichment(result);
    } catch (e) {
      setEnrichError(String(e));
    } finally {
      setEnrichLoading(false);
    }
  };

  const archetypeColor = ARCHETYPE_COLORS[archetype] ?? 'var(--text-muted)';

  return (
    <article className={`engineer-card ${expanded ? 'expanded' : ''}`}>
      {/* ── Collapsed header (always visible) ── */}
      <div className="card-header">
        <div className="card-rank">#{rank}</div>
        <img
          src={member.avatar_url}
          alt={member.display_name}
          className="card-avatar"
          loading="lazy"
        />
        <div className="card-identity">
          <div className="card-name-row">
            <a
              href={`https://github.com/${member.username}`}
              target="_blank"
              rel="noreferrer"
              className="card-name"
            >
              {member.display_name}
            </a>
            <span
              className="archetype-badge"
              style={{ borderColor: archetypeColor, color: archetypeColor }}
              title={ARCHETYPE_DESC[archetype]}
            >
              {archetype}
            </span>
          </div>
          <div className="card-score-row">
            <div className="score-bar-track">
              <div
                className="score-bar-fill"
                style={{ width: `${compositePercent}%` }}
              />
            </div>
            <span className="score-label">{compositePercent}</span>
          </div>
          <div className="card-stats">
            <span>{metrics.prs_merged} PRs</span>
            <span>·</span>
            <span>
              {metrics.median_cycle_time_hrs < 24
                ? `${metrics.median_cycle_time_hrs.toFixed(1)}h cycle`
                : `${(metrics.median_cycle_time_hrs / 24).toFixed(1)}d cycle`}
            </span>
            <span>·</span>
            <span>{metrics.reviews_given} reviews</span>
          </div>
        </div>

        {aiEnabled && (
          <button
            className={`analyze-btn ${enrichLoading ? 'loading' : ''}`}
            onClick={handleAnalyze}
            disabled={enrichLoading}
            aria-expanded={expanded}
          >
            {enrichLoading ? '…' : expanded ? 'Close ▲' : 'Analyze ▼'}
          </button>
        )}
      </div>

      {/* ── Expanded body ── */}
      {expanded && (
        <div className="card-body">
          <MetricsBreakdown member={member} />

          <div className="card-activity">
            <span className="activity-label">Weekly PRs (13 wks)</span>
            <Sparkline values={metrics.weekly_activity} />
          </div>

          {enrichLoading && (
            <div className="enrich-loading">Generating AI analysis…</div>
          )}
          {enrichError && (
            <div className="enrich-error">AI analysis failed: {enrichError}</div>
          )}
          {enrichment && (
            <div className="enrichment">
              <p className="narrative">{enrichment.narrative}</p>

              <div className="work-type-section">
                <span className="work-type-title">Work type</span>
                <WorkTypeBar dist={enrichment.work_type_distribution} />
                <div className="work-type-legend">
                  {Object.entries(enrichment.work_type_distribution)
                    .filter(([, v]) => v > 0)
                    .map(([type, pct]) => (
                      <span key={type} className="legend-item">
                        <span
                          className="legend-dot"
                          style={{ background: CATEGORY_COLORS[type] ?? '#888' }}
                        />
                        {type} {Math.round(pct * 100)}%
                      </span>
                    ))}
                </div>
              </div>

              {enrichment.top_prs.length > 0 && (
                <div className="top-prs">
                  <div className="top-prs-title">Top PRs</div>
                  {enrichment.top_prs.map((pr, i) => (
                    <div key={i} className="top-pr">
                      <div className="top-pr-header">
                        <span
                          className="pr-category-badge"
                          style={{ background: CATEGORY_COLORS[pr.category] ?? '#888' }}
                        >
                          {pr.category}
                        </span>
                        <span className="pr-complexity">{pr.complexity}</span>
                        <a
                          href={pr.url}
                          target="_blank"
                          rel="noreferrer"
                          className="pr-title"
                        >
                          {pr.title}
                        </a>
                      </div>
                      <p className="pr-summary">{pr.summary}</p>
                      <p className="pr-approach">{pr.approach}</p>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </article>
  );
}
