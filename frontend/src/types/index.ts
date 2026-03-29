export interface MemberMetrics {
  prs_merged: number;
  median_cycle_time_hrs: number;
  consistency_weeks: number;
  reviews_given: number;
  changes_requested_rate: number;
  review_turnaround_hrs: number;
  review_depth_avg: number;
  author_diversity: number;
  reviews_received: number;
  changes_requested_received_rate: number;
  weekly_activity: number[];
}

export interface MemberPR {
  number: number;
  title: string;
  url: string;
}

export interface Member {
  username: string;
  display_name: string;
  avatar_url: string;
  metrics: MemberMetrics;
  prs?: MemberPR[];
}

export interface MetaMeta {
  pulled_at: string;
  date_range: { from: string; to: string };
  total_members: number;
  total_prs_analyzed: number;
}

export interface MetricsPayload {
  meta: MetaMeta;
  members: Member[];
}

export interface ScoredMember extends Member {
  scores: {
    delivery: number;
    collaboration: number;
    influence: number;
    composite: number;
  };
  archetype: 'Anchor' | 'Shipper' | 'Multiplier' | 'Contributor';
  rank: number;
}

export type Archetype = ScoredMember['archetype'];

export interface ScoringWeights {
  delivery: number;
  collaboration: number;
  influence: number;
}

export interface MetricToggles {
  prs_merged: boolean;
  cycle_time: boolean;
  consistency: boolean;
  reviews_given: boolean;
  changes_requested_rate: boolean;
  review_turnaround: boolean;
  review_depth: boolean;
  author_diversity: boolean;
  reviews_received: boolean;
  changes_requested_received: boolean;
  [key: string]: boolean;
}

export interface ConfigPayload {
  github: {
    repo: string;
    org: string;
    days: number;
    min_prs_to_include: number;
  };
  scoring: {
    weights: ScoringWeights;
    metrics: MetricToggles;
  };
  ai: {
    enabled: boolean;
    model: string;
  };
}

export interface WorkTypeDistribution {
  feature: number;
  bugfix: number;
  refactor: number;
  infra: number;
  chore: number;
  [key: string]: number;
}

export interface TopPR {
  title: string;
  url: string;
  summary: string;
  approach: string;
  category: 'feature' | 'bugfix' | 'refactor' | 'infra' | 'chore';
  complexity: 'trivial' | 'moderate' | 'significant';
}

export interface AIEnrichment {
  cached_at: string;
  narrative: string;
  work_type_distribution: WorkTypeDistribution;
  top_prs: TopPR[];
}

export interface PullProgressEvent {
  step: string;
  message: string;
  count?: number;
  progress?: number;
  total?: number;
}
