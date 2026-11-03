import type { ReactNode } from 'react';

export function PageHeader({
  title,
  subtitle,
  badge,
  actions,
}: {
  title: string;
  subtitle?: string;
  badge?: ReactNode;
  actions?: ReactNode;
}): React.JSX.Element {
  return (
    <div className="d-flex flex-wrap align-items-start justify-content-between gap-3 mb-4">
      <div>
        <div className="d-flex align-items-center gap-2 flex-wrap">
          <h1 className="h3 fw-bold mb-0">{title}</h1>
          {badge}
        </div>
        {subtitle && <p className="text-body-secondary mb-0 mt-1">{subtitle}</p>}
      </div>
      {actions && <div className="d-flex align-items-center gap-2 flex-wrap">{actions}</div>}
    </div>
  );
}

const STATUS_TONE: Record<string, string> = {
  OPEN: 'success',
  IN_PROGRESS: 'success',
  PASSED: 'success',
  DRAFT: 'warning',
  PENDING: 'warning',
  CLOSED: 'secondary',
  LOCKED: 'dark',
  REJECTED: 'danger',
};

const STATUS_ICON: Record<string, string> = {
  OPEN: 'bi-unlock',
  IN_PROGRESS: 'bi-play-circle',
  PASSED: 'bi-check-circle',
  DRAFT: 'bi-pencil',
  PENDING: 'bi-hourglass-split',
  CLOSED: 'bi-lock',
  LOCKED: 'bi-lock-fill',
  REJECTED: 'bi-x-circle',
};

/** Badge trạng thái dùng chung cho campaign / round / hồ sơ. */
export function StatusBadge({ status }: { status: string }): React.JSX.Element {
  const tone = STATUS_TONE[status] ?? 'secondary';
  const icon = STATUS_ICON[status];
  return (
    <span
      className={`badge rounded-pill bg-${tone}-subtle text-${tone}-emphasis border border-${tone}-subtle`}
    >
      {icon && <i className={`bi ${icon} me-1`} aria-hidden="true" />}
      {status}
    </span>
  );
}

export function Loading({ label = 'Đang tải…' }: { label?: string }): React.JSX.Element {
  return (
    <div className="d-flex align-items-center gap-2 text-body-secondary py-4" role="status">
      <span className="spinner-border spinner-border-sm text-primary" aria-hidden="true" />
      <span>{label}</span>
    </div>
  );
}

export function ErrorAlert({ message }: { message: string }): React.JSX.Element | null {
  if (!message) return null;
  return (
    <div className="alert alert-danger d-flex align-items-start gap-2" role="alert">
      <i className="bi bi-exclamation-triangle-fill mt-1" aria-hidden="true" />
      <div>{message}</div>
    </div>
  );
}

export function ScoreBar({ score }: { score: number | null }): React.JSX.Element {
  const value = score ?? 0;
  const tone = value >= 75 ? 'success' : value >= 50 ? 'info' : value >= 25 ? 'warning' : 'danger';
  return (
    <div className="d-flex align-items-center gap-2" style={{ minWidth: 120 }}>
      <div className="progress flex-grow-1" style={{ height: 6 }} aria-hidden="true">
        <div
          className={`progress-bar bg-${tone}`}
          style={{ width: `${Math.min(Math.max(value, 0), 100)}%` }}
        />
      </div>
      <span className="small fw-semibold">{score === null ? '—' : score}</span>
    </div>
  );
}
