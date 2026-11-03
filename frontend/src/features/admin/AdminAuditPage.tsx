import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { ErrorAlert, Loading, PageHeader } from '../../components/ui';
import { api } from '../../lib/api';

interface AuditLog {
  id: string;
  actorId: number | null;
  action: string;
  entityType: string;
  entityId: string | null;
  ip: string | null;
  createdAt: string;
  actor: { id: number; fullName: string; email: string } | null;
}

interface AuditResponse {
  items: AuditLog[];
  total: number;
  page: number;
  limit: number;
}

function actionIcon(action: string): string {
  if (action.includes('lock')) return 'bi-lock-fill';
  if (action.includes('create')) return 'bi-plus-circle';
  if (action.includes('update')) return 'bi-pencil-square';
  if (action.includes('delete')) return 'bi-trash';
  if (action.includes('status')) return 'bi-arrow-repeat';
  return 'bi-activity';
}

export function AdminAuditPage() {
  const [data, setData] = useState<AuditResponse | null>(null);
  const [page, setPage] = useState(1);
  const [entityType, setEntityType] = useState('');
  const [action, setAction] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    const params = new URLSearchParams({ page: String(page), limit: '20' });
    if (entityType.trim()) params.set('entityType', entityType.trim());
    if (action.trim()) params.set('action', action.trim());
    try {
      setData(await api<AuditResponse>(`/admin/audit-logs?${params.toString()}`));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Không tải được audit log');
    } finally {
      setLoading(false);
    }
  }, [page, entityType, action]);

  useEffect(() => {
    void load();
  }, [load]);

  const totalPages = data ? Math.max(1, Math.ceil(data.total / data.limit)) : 1;

  return (
    <main className="container-xl py-4 py-lg-5">
      <PageHeader
        title="Audit log"
        subtitle="Lịch sử thao tác append-only — không thể sửa hoặc xoá."
        actions={
          <Link to="/admin" className="btn btn-outline-secondary">
            <i className="bi bi-arrow-left me-1" aria-hidden="true" />
            Bảng điều khiển
          </Link>
        }
      />

      <div className="card border-0 shadow-sm rounded-4 mb-4">
        <div className="card-body">
          <form
            className="row g-2 align-items-end"
            onSubmit={(event) => {
              event.preventDefault();
              setPage(1);
              void load();
            }}
          >
            <div className="col-md-5">
              <label className="form-label small" htmlFor="entityType">
                Loại entity
              </label>
              <input
                id="entityType"
                value={entityType}
                onChange={(event) => setEntityType(event.target.value)}
                placeholder="vd: round"
                className="form-control"
              />
            </div>
            <div className="col-md-5">
              <label className="form-label small" htmlFor="action">
                Action
              </label>
              <input
                id="action"
                value={action}
                onChange={(event) => setAction(event.target.value)}
                placeholder="vd: round.lock"
                className="form-control"
              />
            </div>
            <div className="col-md-2 d-flex gap-2">
              <button type="submit" className="btn btn-primary flex-grow-1">
                <i className="bi bi-funnel me-1" aria-hidden="true" />
                Lọc
              </button>
              {(entityType || action) && (
                <button
                  type="button"
                  className="btn btn-outline-secondary"
                  aria-label="Xoá bộ lọc"
                  onClick={() => {
                    setEntityType('');
                    setAction('');
                    setPage(1);
                  }}
                >
                  <i className="bi bi-x-lg" aria-hidden="true" />
                </button>
              )}
            </div>
          </form>
        </div>
      </div>

      <ErrorAlert message={error} />
      {loading && <Loading />}

      {data && (
        <div className="card border-0 shadow-sm rounded-4">
          <div className="card-body p-0">
            <div className="table-responsive">
              <table className="table table-hover align-middle mb-0">
                <thead className="table-light">
                  <tr>
                    <th scope="col">Thời điểm</th>
                    <th scope="col">Người thực hiện</th>
                    <th scope="col">Action</th>
                    <th scope="col">Entity</th>
                    <th scope="col">IP</th>
                  </tr>
                </thead>
                <tbody>
                  {data.items.map((log) => (
                    <tr key={log.id}>
                      <td className="small text-body-secondary text-nowrap">
                        {new Date(log.createdAt).toLocaleString('vi-VN')}
                      </td>
                      <td>
                        {log.actor ? (
                          <>
                            <div className="fw-semibold small">{log.actor.fullName}</div>
                            <div className="small text-body-secondary">{log.actor.email}</div>
                          </>
                        ) : (
                          <span className="text-body-secondary small">Hệ thống</span>
                        )}
                      </td>
                      <td>
                        <span className="badge bg-light text-body border">
                          <i className={`bi ${actionIcon(log.action)} me-1`} aria-hidden="true" />
                          {log.action}
                        </span>
                      </td>
                      <td className="small">
                        {log.entityType}
                        {log.entityId ? (
                          <span className="text-body-secondary"> #{log.entityId}</span>
                        ) : null}
                      </td>
                      <td className="small text-body-secondary">{log.ip ?? '—'}</td>
                    </tr>
                  ))}
                  {data.items.length === 0 && (
                    <tr>
                      <td colSpan={5} className="text-center text-body-secondary py-5">
                        Không có bản ghi phù hợp.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>

            <div className="d-flex flex-wrap align-items-center justify-content-between gap-2 p-3 border-top">
              <span className="small text-body-secondary">
                Trang {page}/{totalPages} · {data.total} bản ghi
              </span>
              <nav aria-label="Phân trang audit log">
                <ul className="pagination pagination-sm mb-0">
                  <li className={`page-item ${page <= 1 ? 'disabled' : ''}`}>
                    <button
                      type="button"
                      className="page-link"
                      onClick={() => setPage((p) => p - 1)}
                    >
                      <i className="bi bi-chevron-left" aria-hidden="true" />
                      <span className="ms-1">Trước</span>
                    </button>
                  </li>
                  <li className={`page-item ${page >= totalPages ? 'disabled' : ''}`}>
                    <button
                      type="button"
                      className="page-link"
                      onClick={() => setPage((p) => p + 1)}
                    >
                      <span className="me-1">Sau</span>
                      <i className="bi bi-chevron-right" aria-hidden="true" />
                    </button>
                  </li>
                </ul>
              </nav>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}
