import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { ErrorAlert, Loading, PageHeader, ScoreBar, StatusBadge } from '../../components/ui';
import { api } from '../../lib/api';

interface RankingCandidate {
  id: number;
  fullName: string;
  email: string;
  trackingCode: string;
  aiMatchScore: number | null;
  aiParsedSkills: { skills?: string[] } | null;
  aiError: string | null;
  finalStatus: 'PENDING' | 'PASSED' | 'REJECTED';
  createdAt: string;
  currentRound: { id: number; roundName: string; status: string } | null;
}

interface RankingResponse {
  campaign: { id: number; title: string; status: string };
  items: RankingCandidate[];
  distribution: Array<{ from: number; to: number; count: number }>;
  stats: { total: number; pending: number; processed: number; average: number | null };
}

export function AdminCampaignPage() {
  const { campaignId } = useParams();
  const [data, setData] = useState<RankingResponse | null>(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<number | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    api<RankingResponse>(`/admin/campaigns/${campaignId}/candidates`)
      .then((result) => {
        if (!cancelled) setData(result);
      })
      .catch((err: unknown) => {
        if (!cancelled) setError(err instanceof Error ? err.message : 'Không tải được dữ liệu');
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [campaignId]);

  const maxBucket = Math.max(1, ...(data?.distribution.map((bucket) => bucket.count) ?? [1]));

  const setFinalStatus = async (
    candidate: RankingCandidate,
    finalStatus: 'PASSED' | 'REJECTED',
  ): Promise<void> => {
    const action = finalStatus === 'PASSED' ? 'ĐẠT' : 'TỪ CHỐI';
    if (!window.confirm(`Chốt kết quả ${action} cho ${candidate.fullName} và gửi email?`)) return;

    setBusyId(candidate.id);
    setError('');
    try {
      await api(`/admin/candidates/${candidate.id}/final-status`, {
        method: 'PATCH',
        body: JSON.stringify({ finalStatus }),
      });
      setData((current) =>
        current
          ? {
              ...current,
              items: current.items.map((item) =>
                item.id === candidate.id ? { ...item, finalStatus } : item,
              ),
            }
          : current,
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Không cập nhật được kết quả');
    } finally {
      setBusyId(null);
    }
  };

  return (
    <main className="container-xl py-4 py-lg-5">
      <PageHeader
        title={data ? `Xếp hạng — ${data.campaign.title}` : 'Bảng xếp hạng'}
        subtitle="Hồ sơ được xếp theo điểm AI match và phân bố điểm tổng quan."
        badge={data ? <StatusBadge status={data.campaign.status} /> : undefined}
        actions={
          <Link to="/admin/audit-logs" className="btn btn-outline-secondary">
            <i className="bi bi-journal-text me-1" aria-hidden="true" />
            Audit log
          </Link>
        }
      />

      {loading && <Loading />}
      <ErrorAlert message={error} />

      {data && (
        <>
          <div className="row g-3 mb-4">
            {[
              {
                icon: 'bi-people',
                tone: 'primary',
                label: 'Tổng hồ sơ',
                value: data.stats.total,
              },
              {
                icon: 'bi-check2-circle',
                tone: 'success',
                label: 'Đã chấm AI',
                value: data.stats.processed,
              },
              {
                icon: 'bi-hourglass-split',
                tone: 'warning',
                label: 'Chờ chấm',
                value: data.stats.pending,
              },
              {
                icon: 'bi-bar-chart',
                tone: 'info',
                label: 'Điểm trung bình',
                value: data.stats.average ?? '—',
              },
            ].map((stat) => (
              <div className="col-6 col-lg-3" key={stat.label}>
                <div className="card border-0 shadow-sm rounded-4 h-100">
                  <div className="card-body">
                    <div className="d-flex align-items-center gap-2 mb-2">
                      <span
                        className={`metric-icon metric-icon-sm bg-${stat.tone}-subtle text-${stat.tone}`}
                      >
                        <i className={`bi ${stat.icon}`} aria-hidden="true" />
                      </span>
                      <span className="small text-body-secondary">{stat.label}</span>
                    </div>
                    <div className="fs-3 fw-bold">{stat.value}</div>
                  </div>
                </div>
              </div>
            ))}
          </div>

          <div className="row g-4">
            <div className="col-lg-4">
              <div className="card border-0 shadow-sm rounded-4 h-100">
                <div className="card-body">
                  <h2 className="h6 fw-bold mb-3">
                    <i className="bi bi-bar-chart-line me-1 text-primary" aria-hidden="true" />
                    Phân bố điểm AI
                  </h2>
                  <div className="ai-chart" role="img" aria-label="Biểu đồ phân bố điểm AI">
                    {data.distribution.map((bucket) => (
                      <div className="ai-chart-column" key={bucket.from}>
                        <span className="small fw-semibold">{bucket.count}</span>
                        <div
                          className="ai-chart-bar"
                          style={{ height: `${Math.max((bucket.count / maxBucket) * 100, 2)}%` }}
                          title={`${bucket.count} hồ sơ`}
                        />
                        <span className="text-body-secondary" style={{ fontSize: '0.7rem' }}>
                          {bucket.from}–{bucket.to}
                        </span>
                      </div>
                    ))}
                  </div>
                  <p className="small text-body-secondary mb-0 mt-2">
                    {data.stats.pending} hồ sơ chưa có điểm AI.
                  </p>
                </div>
              </div>
            </div>

            <div className="col-lg-8">
              <div className="card border-0 shadow-sm rounded-4 h-100">
                <div className="card-body">
                  <div className="d-flex align-items-center justify-content-between mb-3">
                    <h2 className="h6 fw-bold mb-0">
                      <i className="bi bi-trophy me-1 text-warning" aria-hidden="true" />
                      Bảng xếp hạng
                    </h2>
                    <span className="badge rounded-pill bg-primary-subtle text-primary-emphasis">
                      {data.items.length} ứng viên
                    </span>
                  </div>

                  <div className="table-responsive">
                    <table className="table table-hover align-middle mb-0">
                      <thead className="table-light">
                        <tr>
                          <th scope="col">#</th>
                          <th scope="col">Ứng viên</th>
                          <th scope="col" style={{ minWidth: 140 }}>
                            AI score
                          </th>
                          <th scope="col">Kỹ năng</th>
                          <th scope="col">Vòng</th>
                          <th scope="col">Trạng thái</th>
                          <th scope="col">Kết quả</th>
                        </tr>
                      </thead>
                      <tbody>
                        {data.items.map((candidate, index) => (
                          <tr key={candidate.id}>
                            <td className="text-body-secondary">{index + 1}</td>
                            <td>
                              <div className="fw-semibold">{candidate.fullName}</div>
                              <div className="small text-body-secondary">
                                {candidate.trackingCode}
                              </div>
                            </td>
                            <td>
                              {candidate.aiMatchScore === null ? (
                                <span className="small text-body-secondary">
                                  <i className="bi bi-hourglass-split me-1" aria-hidden="true" />
                                  Chờ AI…
                                </span>
                              ) : (
                                <ScoreBar score={candidate.aiMatchScore} />
                              )}
                              {candidate.aiError && <div className="small text-danger">Lỗi AI</div>}
                            </td>
                            <td>
                              <div className="d-flex flex-wrap gap-1">
                                {(candidate.aiParsedSkills?.skills ?? [])
                                  .slice(0, 4)
                                  .map((skill) => (
                                    <span
                                      className="badge rounded-pill bg-light text-body-secondary border"
                                      key={skill}
                                    >
                                      {skill}
                                    </span>
                                  ))}
                                {!candidate.aiParsedSkills?.skills?.length && (
                                  <span className="text-body-secondary small">—</span>
                                )}
                              </div>
                            </td>
                            <td className="small text-nowrap">
                              {candidate.currentRound?.roundName ?? '—'}
                            </td>
                            <td>
                              <StatusBadge status={candidate.finalStatus} />
                            </td>
                            <td className="text-nowrap">
                              <div className="btn-group btn-group-sm" role="group">
                                <button
                                  type="button"
                                  className="btn btn-outline-success"
                                  onClick={() => void setFinalStatus(candidate, 'PASSED')}
                                  disabled={busyId === candidate.id}
                                  title="Chốt ĐẠT và gửi email"
                                >
                                  <i className="bi bi-check2" aria-hidden="true" />
                                  <span className="visually-hidden">Đạt</span>
                                </button>
                                <button
                                  type="button"
                                  className="btn btn-outline-danger"
                                  onClick={() => void setFinalStatus(candidate, 'REJECTED')}
                                  disabled={busyId === candidate.id}
                                  title="Chốt TỪ CHỐI và gửi email"
                                >
                                  <i className="bi bi-x" aria-hidden="true" />
                                  <span className="visually-hidden">Từ chối</span>
                                </button>
                              </div>
                            </td>
                          </tr>
                        ))}
                        {data.items.length === 0 && (
                          <tr>
                            <td colSpan={7} className="text-center text-body-secondary py-5">
                              Chưa có hồ sơ nào.
                            </td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </>
      )}
    </main>
  );
}
