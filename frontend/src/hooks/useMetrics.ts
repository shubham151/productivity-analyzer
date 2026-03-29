import { useCallback, useEffect, useMemo, useState } from 'react';
import type {
  ConfigPayload,
  Member,
  MetricsPayload,
  ScoredMember,
} from '../types';
import { Api } from '../utils/Api';

// Metrics where a lower value is better (invert normalization)
const LOWER_IS_BETTER = new Set([
  'median_cycle_time_hrs',
  'review_turnaround_hrs',
  'changes_requested_received_rate',
]);

// Map config metric toggle key → MemberMetrics field key(s)
const METRIC_FIELD_MAP: Record<string, (keyof Member['metrics'])[]> = {
  prs_merged: ['prs_merged'],
  cycle_time: ['median_cycle_time_hrs'],
  consistency: ['consistency_weeks'],
  reviews_given: ['reviews_given'],
  changes_requested_rate: ['changes_requested_rate'],
  review_turnaround: ['review_turnaround_hrs'],
  review_depth: ['review_depth_avg'],
  author_diversity: ['author_diversity'],
  reviews_received: ['reviews_received'],
  changes_requested_received: ['changes_requested_received_rate'],
};

const DELIVERY_TOGGLES = ['prs_merged', 'cycle_time', 'consistency'];
const COLLAB_TOGGLES = [
  'reviews_given',
  'changes_requested_rate',
  'review_turnaround',
  'review_depth',
  'author_diversity',
];
const INFLUENCE_TOGGLES = ['reviews_received', 'changes_requested_received'];

function minMax(values: number[]): { min: number; max: number } {
  return { min: Math.min(...values), max: Math.max(...values) };
}

function normalize(value: number, min: number, max: number, invert: boolean): number {
  if (max === min) return 0;
  const n = (value - min) / (max - min);
  return invert ? 1 - n : n;
}

function categoryScore(
  members: Member[],
  toggleKeys: string[],
  toggles: Record<string, boolean>,
): Map<string, number> {
  const enabledFields = toggleKeys
    .filter(k => toggles[k])
    .flatMap(k => METRIC_FIELD_MAP[k] ?? []);

  if (enabledFields.length === 0) {
    return new Map(members.map(m => [m.username, 0]));
  }

  // Pre-compute min/max per field across all members
  const ranges = new Map<string, { min: number; max: number }>();
  for (const field of enabledFields) {
    const vals = members.map(m => m.metrics[field] as number);
    ranges.set(field, minMax(vals));
  }

  const scores = new Map<string, number>();
  for (const m of members) {
    const norm = enabledFields.map(field => {
      const { min, max } = ranges.get(field)!;
      return normalize(m.metrics[field] as number, min, max, LOWER_IS_BETTER.has(field));
    });
    scores.set(m.username, norm.reduce((a, b) => a + b, 0) / norm.length);
  }
  return scores;
}

function computeArchetype(
  deliveryScore: number,
  collabScore: number,
  allDelivery: number[],
  allCollab: number[],
): ScoredMember['archetype'] {
  const sorted = (arr: number[]) => [...arr].sort((a, b) => a - b);
  const p60 = (arr: number[]) => {
    const s = sorted(arr);
    return s[Math.floor(s.length * 0.6)] ?? 0;
  };
  const d60 = p60(allDelivery);
  const c60 = p60(allCollab);

  if (deliveryScore >= d60 && collabScore >= c60) return 'Anchor';
  if (deliveryScore >= d60 && collabScore < c60) return 'Shipper';
  if (collabScore >= c60 && deliveryScore < d60) return 'Multiplier';
  return 'Contributor';
}

export function useMetrics(config: ConfigPayload | null) {
  const [payload, setPayload] = useState<MetricsPayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchMetrics = useCallback(async () => {
    try {
      const url = '/api/metrics';
      const data = await Api.get<MetricsPayload>(url);
      setPayload(Object.keys(data).length === 0 ? null : data);
      setError(null);
    } catch (e) {
      setError(String(e));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchMetrics(); }, [fetchMetrics]);

  const scored = useMemo<ScoredMember[]>(() => {
    if (!payload || !config) return [];

    const { members } = payload;
    const { weights, metrics: toggles } = config.scoring;

    const deliveryMap = categoryScore(members, DELIVERY_TOGGLES, toggles);
    const collabMap = categoryScore(members, COLLAB_TOGGLES, toggles);
    const influenceMap = categoryScore(members, INFLUENCE_TOGGLES, toggles);

    const totalWeight = weights.delivery + weights.collaboration + weights.influence || 1;

    const allDelivery = [...deliveryMap.values()];
    const allCollab = [...collabMap.values()];

    const result: ScoredMember[] = members.map(m => {
      const d = deliveryMap.get(m.username) ?? 0;
      const c = collabMap.get(m.username) ?? 0;
      const i = influenceMap.get(m.username) ?? 0;
      const composite =
        (d * weights.delivery + c * weights.collaboration + i * weights.influence) / totalWeight;

      return {
        ...m,
        scores: {
          delivery: d,
          collaboration: c,
          influence: i,
          composite,
        },
        archetype: computeArchetype(d, c, allDelivery, allCollab),
        rank: 0,
      };
    });

    result.sort((a, b) => b.scores.composite - a.scores.composite);
    result.forEach((m, idx) => { m.rank = idx + 1; });
    return result;
  }, [payload, config]);

  return { payload, scored, loading, error, refetch: fetchMetrics };
}
