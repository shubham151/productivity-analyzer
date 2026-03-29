import { useCallback, useEffect, useRef, useState } from 'react';
import type { ConfigPayload, PullProgressEvent } from '../types';
import { useMetrics } from '../hooks/useMetrics';
import ConfigPanel from './ConfigPanel';
import EngineerCard from './EngineerCard';
import ProjectStats from './ProjectStats';
import PullProgress from './PullProgress';

const API = import.meta.env.VITE_API_BASE_URL ?? '';

interface Props {
  config: ConfigPayload;
  onConfigUpdate: (next: ConfigPayload) => void;
}

export default function Dashboard({ config, onConfigUpdate }: Props) {
  const { payload, scored, loading, refetch } = useMetrics(config);
  const [showAll, setShowAll] = useState(false);
  const [isPulling, setIsPulling] = useState(false);
  const [pullEvents, setPullEvents] = useState<PullProgressEvent[]>([]);
  const esRef = useRef<EventSource | null>(null);

  const startPull = useCallback(() => {
    if (isPulling) return;

    // Close any existing connection
    esRef.current?.close();
    setPullEvents([]);
    setIsPulling(true);
    setShowAll(false);

    const es = new EventSource(`${API}/api/metrics/pull/stream`);
    esRef.current = es;

    es.onmessage = async (evt) => {
      const data: PullProgressEvent = JSON.parse(evt.data);
      setPullEvents(prev => [...prev, data]);

      if (data.step === 'done' || data.step === 'error') {
        es.close();
        esRef.current = null;
        setIsPulling(false);
        if (data.step === 'done') {
          await refetch();
        }
      }
    };

    es.onerror = () => {
      setPullEvents(prev => [
        ...prev,
        { step: 'error', message: 'Connection lost' },
      ]);
      es.close();
      esRef.current = null;
      setIsPulling(false);
    };
  }, [isPulling, refetch]);

  // Cleanup on unmount
  useEffect(() => () => { esRef.current?.close(); }, []);

  const visibleMembers = showAll ? scored : scored.slice(0, 5);
  const pulledAt = payload?.meta.pulled_at
    ? new Date(payload.meta.pulled_at).toLocaleString()
    : null;

  return (
    <div className="dashboard">
      {/* ── Header ── */}
      <header className="dash-header">
        <div className="dash-header-left">
          <span className="dash-repo">{config.github.repo}</span>
          {pulledAt && (
            <span className="dash-pulled">Last pulled {pulledAt}</span>
          )}
          {payload && (
            <span className="dash-meta">
              {payload.meta.total_members} members · {payload.meta.total_prs_analyzed} PRs analyzed
            </span>
          )}
        </div>
        <button
          className={`pull-btn ${isPulling ? 'pulling' : ''}`}
          onClick={startPull}
          disabled={isPulling}
        >
          {isPulling ? 'Pulling…' : 'Pull Latest'}
        </button>
      </header>

      <PullProgress events={pullEvents} isPulling={isPulling} />

      {/* ── Main layout ── */}
      <div className="dash-body">
        <main className="dash-main">
          {loading && !isPulling && (
            <div className="empty-state">Loading metrics…</div>
          )}

          {!loading && !isPulling && !payload && pullEvents.length === 0 && (
            <div className="empty-state">
              <div className="empty-title">No data yet</div>
              <p className="empty-hint">
                Click <strong>Pull Latest</strong> to fetch 90 days of GitHub data
                from <code>{config.github.repo}</code>.
              </p>
              <p className="empty-hint small">
                Make sure <code>GITHUB_TOKEN</code> is set in your backend <code>.env</code>.
              </p>
            </div>
          )}

          {scored.length > 0 && payload && (
            <ProjectStats meta={payload.meta} members={scored} />
          )}

          {scored.length > 0 && (
            <>
              <div className="cards-label">
                Top engineers by impact score
                <span className="scoring-note">
                  Delivery {config.scoring.weights.delivery}% · Collaboration{' '}
                  {config.scoring.weights.collaboration}% · Influence{' '}
                  {config.scoring.weights.influence}%
                </span>
              </div>
              <div className="cards-list">
                {visibleMembers.map(m => (
                  <EngineerCard
                    key={m.username}
                    member={m}
                    aiEnabled={config.ai.enabled}
                  />
                ))}
              </div>
              {scored.length > 5 && (
                <button
                  className="show-more-btn"
                  onClick={() => setShowAll(s => !s)}
                >
                  {showAll
                    ? `Show top 5 ▲`
                    : `Show all ${scored.length} engineers ▼`}
                </button>
              )}
            </>
          )}
        </main>

        <ConfigPanel config={config} onUpdate={onConfigUpdate} />
      </div>
    </div>
  );
}
