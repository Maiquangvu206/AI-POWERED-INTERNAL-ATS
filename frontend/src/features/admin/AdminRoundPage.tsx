import { useCallback, useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { api } from '../../lib/api';
import type { RoundInfo } from '../interviewer/types';

interface EvaluationDetail {
  id: number;
  criterionId: number;
  score: number;
  criterion: { id: number; title: string; maxScore: number; weight: number };
}

interface EvaluationRow {
  id: number;
  candidateId: number;
  interviewerId: number;
  totalScore: number;
  generalNotes: string | null;
  submittedAt: string;
  interviewer?: { id: number; fullName: string; email: string };
  candidate: { id: number; fullName: string; trackingCode: string };
  details: EvaluationDetail[];
}

interface SummaryRow {
  candidateId: number;
  count: number;
  average: number;
  min: number;
  max: number;
  outlier: boolean;
}

interface ScoresResponse {
  round: RoundInfo;
  blind: boolean;
  evaluations: EvaluationRow[];
  summary: SummaryRow[];
}

export function AdminRoundPage() {
  const { roundId } = useParams();
  const roundIdNumber = Number(roundId);

  const [data, setData] = useState<ScoresResponse | null>(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [locking, setLocking] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      setData(await api<ScoresResponse>(`/rounds/${roundIdNumber}/scores`));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Không tải được bảng điểm');
    } finally {
      setLoading(false);
    }
  }, [roundIdNumber]);

  useEffect(() => {
    void load();
  }, [load]);

  const lock = async () => {
    setLocking(true);
    setError('');
    try {
      await api(`/admin/rounds/${roundIdNumber}/lock`, { method: 'POST' });
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Khoá vòng thất bại');
    } finally {
      setLocking(false);
    }
  };

  const nameOf = (candidateId: number) =>
    data?.evaluations.find((row) => row.candidateId === candidateId)?.candidate.fullName ??
    `#${candidateId}`;

  return (
    <main className="shell wide">
      <header className="page-header">
        <h1>{data ? `Bảng điểm — ${data.round.roundName}` : 'Admin Dashboard'}</h1>
        <div className="header-actions">
          {data && (
            <span className={`badge ${data.round.status === 'IN_PROGRESS' ? 'ok' : ''}`}>
              {data.round.status}
            </span>
          )}
          {data?.round.status === 'IN_PROGRESS' && (
            <button type="button" onClick={lock} disabled={locking}>
              {locking ? 'Đang khoá…' : 'Khoá vòng & Unblind'}
            </button>
          )}
        </div>
      </header>

      {loading && <p className="muted">Đang tải…</p>}
      {error && <p className="err">{error}</p>}

      {data && (
        <>
          <section className="card">
            <h2>Tổng hợp theo ứng viên</h2>
            <table className="rubric">
              <thead>
                <tr>
                  <th>Ứng viên</th>
                  <th>Số phiếu</th>
                  <th>Trung bình</th>
                  <th>Thấp nhất</th>
                  <th>Cao nhất</th>
                  <th>Cảnh báo</th>
                </tr>
              </thead>
              <tbody>
                {data.summary.map((row) => (
                  <tr key={row.candidateId}>
                    <td>{nameOf(row.candidateId)}</td>
                    <td>{row.count}</td>
                    <td>
                      <strong>{row.average}</strong>
                    </td>
                    <td>{row.min}</td>
                    <td>{row.max}</td>
                    <td>
                      {row.outlier ? (
                        <span className="badge warn">Lệch &gt; 3 điểm</span>
                      ) : (
                        <span className="muted small">—</span>
                      )}
                    </td>
                  </tr>
                ))}
                {data.summary.length === 0 && (
                  <tr>
                    <td colSpan={6} className="muted small">
                      Chưa có phiếu điểm nào.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </section>

          <section className="card">
            <h2>Chi tiết phiếu ({data.evaluations.length})</h2>
            {data.blind && (
              <p className="muted small">
                Đang ở chế độ blind — chỉ hiển thị phiếu của bạn (nếu có).
              </p>
            )}
            <div className="evaluation-grid">
              {data.evaluations.map((row) => (
                <article key={row.id} className="evaluation-card">
                  <header>
                    <strong>{row.candidate.fullName}</strong>{' '}
                    <span className="muted small">{row.candidate.trackingCode}</span>
                    <span className="score-pill">{row.totalScore}/100</span>
                  </header>
                  {row.interviewer && (
                    <p className="muted small">Giám khảo: {row.interviewer.fullName}</p>
                  )}
                  <ul className="detail-list">
                    {row.details.map((detail) => (
                      <li key={detail.id}>
                        {detail.criterion.title}: <strong>{detail.score}</strong>/
                        {detail.criterion.maxScore}
                      </li>
                    ))}
                  </ul>
                  {row.generalNotes && <p className="small">“{row.generalNotes}”</p>}
                </article>
              ))}
            </div>
          </section>
        </>
      )}
    </main>
  );
}
