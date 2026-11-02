import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
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

  return (
    <main className="shell wide">
      <header className="page-header">
        <h1>{data ? `Xếp hạng — ${data.campaign.title}` : 'Admin Dashboard'}</h1>
        <Link to="/admin/audit-logs" className="button-link">
          Audit log →
        </Link>
      </header>

      {loading && <p className="muted">Đang tải…</p>}
      {error && <p className="err">{error}</p>}

      {data && (
        <>
          <section className="stats">
            <div className="card stat">
              <span className="muted small">Tổng hồ sơ</span>
              <strong>{data.stats.total}</strong>
            </div>
            <div className="card stat">
              <span className="muted small">Đã chấm AI</span>
              <strong>{data.stats.processed}</strong>
            </div>
            <div className="card stat">
              <span className="muted small">Chờ chấm</span>
              <strong>{data.stats.pending}</strong>
            </div>
            <div className="card stat">
              <span className="muted small">Điểm trung bình</span>
              <strong>{data.stats.average ?? '—'}</strong>
            </div>
          </section>

          <section className="card">
            <h2>Phân bố điểm AI</h2>
            <div className="chart" role="img" aria-label="Biểu đồ phân bố điểm AI">
              {data.distribution.map((bucket) => (
                <div className="chart-column" key={bucket.from}>
                  <span className="small">{bucket.count}</span>
                  <div
                    className="chart-bar"
                    style={{ height: `${(bucket.count / maxBucket) * 100}%` }}
                    title={`${bucket.count} hồ sơ`}
                  />
                  <span className="muted small">
                    {bucket.from}–{bucket.to}
                  </span>
                </div>
              ))}
            </div>
          </section>

          <section className="card">
            <h2>Bảng xếp hạng theo AI match</h2>
            <table className="rubric">
              <thead>
                <tr>
                  <th>#</th>
                  <th>Ứng viên</th>
                  <th>AI score</th>
                  <th>Kỹ năng</th>
                  <th>Vòng</th>
                  <th>Trạng thái</th>
                </tr>
              </thead>
              <tbody>
                {data.items.map((candidate, index) => (
                  <tr key={candidate.id}>
                    <td>{index + 1}</td>
                    <td>
                      <strong>{candidate.fullName}</strong>
                      <div className="muted small">{candidate.trackingCode}</div>
                    </td>
                    <td>
                      {candidate.aiMatchScore === null ? (
                        <span className="muted small">Chờ AI…</span>
                      ) : (
                        <strong>{candidate.aiMatchScore}</strong>
                      )}
                      {candidate.aiError && <div className="err small">Lỗi AI</div>}
                    </td>
                    <td className="small">
                      {(candidate.aiParsedSkills?.skills ?? []).slice(0, 6).join(', ') || '—'}
                    </td>
                    <td className="small">{candidate.currentRound?.roundName ?? '—'}</td>
                    <td>
                      <span className={`badge ${candidate.finalStatus === 'PASSED' ? 'ok' : ''}`}>
                        {candidate.finalStatus}
                      </span>
                    </td>
                  </tr>
                ))}
                {data.items.length === 0 && (
                  <tr>
                    <td colSpan={6} className="muted small">
                      Chưa có hồ sơ nào.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </section>
        </>
      )}
    </main>
  );
}
