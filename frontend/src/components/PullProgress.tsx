import type { PullProgressEvent } from '../types';

interface Props {
  events: PullProgressEvent[];
  isPulling: boolean;
}

const STEP_ORDER = ['members', 'prs', 'reviews', 'aggregating', 'saving', 'done', 'error'];

const STEP_LABELS: Record<string, string> = {
  members: 'Org members',
  prs: 'Merged PRs',
  reviews: 'Reviews & comments',
  aggregating: 'Aggregating',
  saving: 'Saving',
  done: 'Complete',
  error: 'Error',
};

export default function PullProgress({ events, isPulling }: Props) {
  if (events.length === 0 && !isPulling) return null;

  const latestByStep = new Map<string, PullProgressEvent>();
  for (const ev of events) {
    latestByStep.set(ev.step, ev);
  }

  const lastEvent = events[events.length - 1];
  const isDone = lastEvent?.step === 'done';
  const isError = lastEvent?.step === 'error';

  return (
    <div className={`pull-progress ${isDone ? 'done' : ''} ${isError ? 'error' : ''}`}>
      <div className="pull-progress-title">
        {isError ? '✕ Pull failed' : isDone ? '✓ Pull complete' : '⟳ Pulling data…'}
      </div>
      <div className="pull-progress-steps">
        {STEP_ORDER.filter(s => s !== 'error' && s !== 'done').map(step => {
          const ev = latestByStep.get(step);
          const active = lastEvent?.step === step;
          const completed =
            ev != null &&
            STEP_ORDER.indexOf(lastEvent?.step ?? '') > STEP_ORDER.indexOf(step);

          return (
            <div
              key={step}
              className={`progress-step ${active ? 'active' : ''} ${completed ? 'completed' : ''}`}
            >
              <span className="step-dot" />
              <span className="step-label">{STEP_LABELS[step]}</span>
              {ev && (
                <span className="step-msg">{ev.message}</span>
              )}
              {ev?.progress != null && step === 'reviews' && (
                <div className="step-bar">
                  <div className="step-bar-fill" style={{ width: `${ev.progress}%` }} />
                </div>
              )}
            </div>
          );
        })}
      </div>
      {isError && lastEvent && (
        <div className="pull-error-msg">{lastEvent.message}</div>
      )}
    </div>
  );
}
