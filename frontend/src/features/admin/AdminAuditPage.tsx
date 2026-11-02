import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
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
    <main className="shell wide">
      <header className="page-header">
        <h1>Audit log</h1>
        <Link to="/admin" className="button-link">
          ← Dashboard
        </Link>
      </header>

      <form
        className="card inline-form"
        onSubmit={(event) => {
          event.preventDefault();
          setPage(1);
          void load();
        }}
      >
        <input
          value={entityType}
          onChange={(event) => setEntityType(event.target.value)}
          placeholder="entityType (vd: round)"
        />
        <input
          value={action}
          onChange={(event) => setAction(event.target.value)}
          placeholder="action (vd: round.lock)"
        />
        <button type="submit">Lọc</button>
      </form>

      {loading && <p className="muted">Đang tải…</p>}
      {error && <p className="err">{error}</p>}

      {data && (
        <section className="card">
          <table className="rubric">
            <thead>
              <tr>
                <th>Thời điểm</th>
                <th>Người thực hiện</th>
                <th>Action</th>
                <th>Entity</th>
                <th>IP</th>
              </tr>
            </thead>
            <tbody>
              {data.items.map((log) => (
                <tr key={log.id}>
                  <td className="small">{new Date(log.createdAt).toLocaleString('vi-VN')}</td>
                  <td className="small">
                    {log.actor ? (
                      <>
                        <strong>{log.actor.fullName}</strong>
                        <div className="muted">{log.actor.email}</div>
                      </>
                    ) : (
                      <span className="muted">Hệ thống</span>
                    )}
                  </td>
                  <td>
                    <code>{log.action}</code>
                  </td>
                  <td className="small">
                    {log.entityType}
                    {log.entityId ? ` #${log.entityId}` : ''}
                  </td>
                  <td className="small muted">{log.ip ?? '—'}</td>
                </tr>
              ))}
              {data.items.length === 0 && (
                <tr>
                  <td colSpan={5} className="muted small">
                    Không có bản ghi phù hợp.
                  </td>
                </tr>
              )}
            </tbody>
          </table>

          <div className="pagination">
            <button type="button" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>
              ← Trước
            </button>
            <span className="muted small">
              Trang {page}/{totalPages} · {data.total} bản ghi
            </span>
            <button
              type="button"
              disabled={page >= totalPages}
              onClick={() => setPage((p) => p + 1)}
            >
              Sau →
            </button>
          </div>
        </section>
      )}
    </main>
  );
}
