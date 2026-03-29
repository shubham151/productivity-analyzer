/**
 * Human-readable definitions for every metric shown in the dashboard.
 * Used for tooltip content in MetricsBreakdown and ConfigPanel.
 */

export const METRIC_DESCRIPTIONS: Record<string, string> = {
  // ── Delivery ────────────────────────────────────────────────────────────
  'PRs merged':
    'Total pull requests merged into the main branch in the last 90 days. Raw output — a high count means the engineer is shipping frequently.',

  'Median cycle time':
    'Median time from when a PR was opened to when it was merged. Shorter is better — it reflects how quickly work moves through review and lands in production.',

  'Active weeks':
    'Number of weeks (out of 13) in which the engineer merged at least one PR. Measures consistency: a score of 13/13 means they shipped every single week.',

  // ── Collaboration ────────────────────────────────────────────────────────
  'Reviews given':
    'Total code reviews submitted on other engineers\' PRs. A high number shows the engineer actively participates in the team\'s quality process.',

  'Changes-requested rate':
    'Fraction of the engineer\'s own reviews where they requested changes. Higher means they are doing substantive, critical reviews rather than rubber-stamping.',

  'Review turnaround':
    'Median hours from when a PR was opened to when this engineer submitted their first review on it. Lower is better — fast reviewers unblock teammates quickly.',

  'Inline comments / review':
    'Average number of inline (line-level) comments left per review session. More comments suggest deeper, more specific feedback rather than high-level LGTM.',

  'Unique authors reviewed':
    'Number of distinct engineers whose PRs this person reviewed. A high number means they collaborate broadly across the team rather than only within their own area.',

  // ── Influence ────────────────────────────────────────────────────────────
  'Reviews received':
    'Total reviews received on the engineer\'s own PRs. More reviews indicate their work is visible, touches shared areas, or draws thoughtful engagement from peers.',

  'Changes requested on own PRs':
    'Fraction of reviews received on their own PRs that requested changes. Lower suggests the engineer ships clean, well-considered code that rarely needs rework.',

  // ── Category score bars ──────────────────────────────────────────────────
  Delivery:
    'Normalized composite of PRs merged, cycle time, and consistency. Represents how much working code this engineer ships and how reliably they do it.',

  Collaboration:
    'Normalized composite of reviews given, changes-requested rate, review turnaround, inline depth, and author diversity. Measures how much they help others ship better code.',

  Influence:
    'Normalized composite of reviews received and changes-requested rate on own PRs. Reflects the visibility and quality signal of their work across the team.',
};

/** Descriptions for the scoring category weight sliders in the config panel. */
export const WEIGHT_DESCRIPTIONS: Record<string, string> = {
  delivery:
    'How much weight to give shipping output: PR volume, cycle time, and weekly consistency.',
  collaboration:
    'How much weight to give review contributions: frequency, depth, turnaround, and breadth.',
  influence:
    'How much weight to give the quality signal of the engineer\'s own PRs: peer engagement and revision rate.',
};

/** Descriptions for metric toggle keys (used in ConfigPanel). */
export const TOGGLE_DESCRIPTIONS: Record<string, string> = {
  prs_merged:       'Count of merged PRs — raw delivery output.',
  cycle_time:       'Median hours from PR open to merge — speed through review.',
  consistency:      'Weeks with at least one merge — sustained cadence.',
  reviews_given:    'Total reviews submitted on others\' PRs.',
  changes_requested_rate: 'Share of given reviews that requested changes — review rigour.',
  review_turnaround: 'Median hours to first review after a PR opens — responsiveness.',
  review_depth:     'Avg inline comments per review — specificity of feedback.',
  author_diversity: 'Distinct authors reviewed — breadth of collaboration.',
  reviews_received: 'Reviews received on own PRs — peer engagement with their work.',
  changes_requested_received: 'Share of received reviews that requested changes — code quality signal (lower = better).',
};
