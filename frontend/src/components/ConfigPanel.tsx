import type { ConfigPayload, MetricToggles, ScoringWeights } from '../types';
import { TOGGLE_DESCRIPTIONS, WEIGHT_DESCRIPTIONS } from '../metricDefs';
import Tooltip from './Tooltip';

interface Props {
  config: ConfigPayload;
  onUpdate: (next: ConfigPayload) => void;
}

const WEIGHT_LABELS: (keyof ScoringWeights)[] = ['delivery', 'collaboration', 'influence'];

const METRIC_GROUPS: { label: string; toggles: (keyof MetricToggles)[] }[] = [
  {
    label: 'Delivery',
    toggles: ['prs_merged', 'cycle_time', 'consistency'],
  },
  {
    label: 'Collaboration',
    toggles: [
      'reviews_given',
      'changes_requested_rate',
      'review_turnaround',
      'review_depth',
      'author_diversity',
    ],
  },
  {
    label: 'Influence',
    toggles: ['reviews_received', 'changes_requested_received'],
  },
];

const METRIC_DISPLAY: Record<keyof MetricToggles, string> = {
  prs_merged: 'PRs merged',
  cycle_time: 'Cycle time',
  consistency: 'Consistency',
  reviews_given: 'Reviews given',
  changes_requested_rate: 'Changes-req rate',
  review_turnaround: 'Review turnaround',
  review_depth: 'Review depth',
  author_diversity: 'Author diversity',
  reviews_received: 'Reviews received',
  changes_requested_received: 'Changes-req received',
};

export default function ConfigPanel({ config, onUpdate }: Props) {
  const { scoring, github } = config;

  const setWeight = (key: keyof ScoringWeights, value: number) => {
    onUpdate({
      ...config,
      scoring: {
        ...scoring,
        weights: { ...scoring.weights, [key]: value },
      },
    });
  };

  const toggleMetric = (key: keyof MetricToggles) => {
    onUpdate({
      ...config,
      scoring: {
        ...scoring,
        metrics: { ...scoring.metrics, [key]: !scoring.metrics[key] },
      },
    });
  };

  const setRepo = (value: string) => {
    const parts = value.split('/');
    onUpdate({
      ...config,
      github: {
        ...github,
        repo: value,
        org: parts[0] ?? github.org,
      },
    });
  };

  const totalWeight =
    scoring.weights.delivery + scoring.weights.collaboration + scoring.weights.influence;

  return (
    <aside className="config-panel">
      <h2 className="config-title">Configuration</h2>

      {/* Repo */}
      <section className="config-section">
        <div className="config-section-label">Repository</div>
        <input
          className="config-input"
          value={github.repo}
          onChange={e => setRepo(e.target.value)}
          placeholder="owner/repo"
        />
      </section>

      {/* Scoring weights */}
      <section className="config-section">
        <div className="config-section-label">Scoring weights</div>
        {WEIGHT_LABELS.map(key => (
          <div key={key} className="weight-row">
            <span className="weight-label">
              <Tooltip text={WEIGHT_DESCRIPTIONS[key]}>
                <span className="metric-hint">
                  {key.charAt(0).toUpperCase() + key.slice(1)}
                </span>
              </Tooltip>
            </span>
            <input
              type="range"
              min={0}
              max={100}
              value={scoring.weights[key]}
              onChange={e => setWeight(key, Number(e.target.value))}
              className="weight-slider"
            />
            <span className="weight-value">
              {totalWeight > 0
                ? `${Math.round((scoring.weights[key] / totalWeight) * 100)}%`
                : '—'}
            </span>
          </div>
        ))}
      </section>

      {/* Metric toggles */}
      <section className="config-section">
        <div className="config-section-label">Active metrics</div>
        {METRIC_GROUPS.map(group => (
          <div key={group.label} className="toggle-group">
            <div className="toggle-group-label">{group.label}</div>
            {group.toggles.map(key => (
              <label key={key} className="toggle-row">
                <input
                  type="checkbox"
                  checked={scoring.metrics[key]}
                  onChange={() => toggleMetric(key)}
                  className="toggle-checkbox"
                />
                <Tooltip text={TOGGLE_DESCRIPTIONS[key]}>
                  <span className="metric-hint toggle-name">{METRIC_DISPLAY[key]}</span>
                </Tooltip>
              </label>
            ))}
          </div>
        ))}
      </section>

      <div className="config-hint">
        Scores recalculate instantly — no need to re-pull.
      </div>
    </aside>
  );
}
