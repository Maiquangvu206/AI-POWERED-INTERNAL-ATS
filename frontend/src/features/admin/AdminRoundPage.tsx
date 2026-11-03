import { useCallback, useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { ErrorAlert, Loading, PageHeader, StatusBadge } from '../../components/ui';
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

  const lock = async (): Promise<void> => {
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

  const nameOf = (candidateId: number): string =>
    data?.evaluations.find((row) => row.candidateId === candidateId)?.candidate.fullName ??
    `#${candidateId}`;

  return (
    <main className="container-xl py-4 py-lg-5">
      <PageHeader
        title={data ? `Bảng điểm — ${data.round.roundName}` : 'Bảng điểm vòng'}
        subtitle="Tổng hợp điểm và cảnh báo lệch giữa các giám khảo."
        badge={data ? <StatusBadge status={data.round.status} /> : undefined}
        actions={
          data?.round.status === 'IN_PROGRESS' ? (
            <button type="button" className="btn btn-danger" onClick={lock} disabled={locking}>
              {locking ? (
                <>
                  <span className="spinner-border spinner-border-sm me-2" aria-hidden="true" />
                  Đang khoá…
                </>
              ) : (
                <>
                  <i className="bi bi-lock-fill me-1" aria-hidden="true" />
                  Khoá vòng &amp; Unblind
                </>
              )}
            </button>
          ) : undefined
        }
      />

      {loading && <Loading />}
      <ErrorAlert message={error} />

      {data && (
        <>
          <div className="card border-0 shadow-sm rounded-4 mb-4">
            <div className="card-body">
              <h2 className="h6 fw-bold mb-3">
                <i className="bi bi-people me-1 text-primary" aria-hidden="true" />
                Tổng hợp theo ứng viên
              </h2>
              <div className="table-responsive">
                <table className="table table-hover align-middle mb-0">
                  <thead className="table-light">
                    <tr>
                      <th scope="col">Ứng viên</th>
                      <th scope="col">Số phiếu</th>
                      <th scope="col">Trung bình</th>
                      <th scope="col">Thấp nhất</th>
                      <th scope="col">Cao nhất</th>
                      <th scope="col">Cảnh báo</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.summary.map((row) => (
                      <tr key={row.candidateId}>
                        <td className="fw-semibold">{nameOf(row.candidateId)}</td>
                        <td>{row.count}</td>
                        <td>
                          <span className="badge bg-primary-subtle text-primary-emphasis fs-6">
                            {row.average}
                          </span>
                        </td>
                        <td>{row.min}</td>
                        <td>{row.max}</td>
                        <td>
                          {row.outlier ? (
                            <span className="badge bg-warning-subtle text-warning-emphasis border border-warning-subtle">
                              <i className="bi bi-exclamation-triangle me-1" aria-hidden="true" />
                              Lệch &gt; 3 điểm
                            </span>
                          ) : (
                            <span className="text-body-secondary small">—</span>
                          )}
                        </td>
                      </tr>
                    ))}
                    {data.summary.length === 0 && (
                      <tr>
                        <td colSpan={6} className="text-center text-body-secondary py-5">
                          Chưa có phiếu điểm nào.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>

          <div className="d-flex align-items-center justify-content-between mb-3">
            <h2 className="h6 fw-bold mb-0">
              <i className="bi bi-card-checklist me-1 text-primary" aria-hidden="true" />
              Chi tiết phiếu ({data.evaluations.length})
            </h2>
            {data.blind && (
              <span className="badge bg-secondary-subtle text-secondary-emphasis">
                <i className="bi bi-eye-slash me-1" aria-hidden="true" />
                Blind mode
              </span>
            )}
          </div>

          <div className="row g-3">
            {data.evaluations.map((row) => (
              <div className="col-md-6" key={row.id}>
                <article className="card border-0 shadow-sm rounded-4 h-100">
                  <div className="card-body">
                    <div className="d-flex justify-content-between align-items-start gap-2 mb-2">
                      <div>
                        <div className="fw-semibold">{row.candidate.fullName}</div>
                        <div className="small text-body-secondary">
                          {row.candidate.trackingCode}
                        </div>
                      </div>
                      <span className="badge bg-primary-subtle text-primary-emphasis fs-6">
                        {row.totalScore}/100
                      </span>
                    </div>

                    {row.interviewer && (
                      <p className="small text-body-secondary mb-2">
                        <i className="bi bi-person me-1" aria-hidden="true" />
                        {row.interviewer.fullName}
                      </p>
                    )}

                    <ul className="list-unstyled small mb-2">
                      {row.details.map((detail) => (
                        <li
                          key={detail.id}
                          className="d-flex justify-content-between border-bottom py-1"
                        >
                          <span>{detail.criterion.title}</span>
                          <span className="fw-semibold">
                            {detail.score}/{detail.criterion.maxScore}
                          </span>
                        </li>
                      ))}
                    </ul>

                    {row.generalNotes && (
                      <p className="small fst-italic text-body-secondary mb-0">
                        “{row.generalNotes}”
                      </p>
                    )}
                  </div>
                </article>
              </div>
            ))}
            {data.evaluations.length === 0 && (
              <div className="col-12">
                <div className="alert alert-light border text-body-secondary mb-0">
                  Chưa có phiếu đánh giá nào cho vòng này.
                </div>
              </div>
            )}
          </div>
        </>
      )}
    </main>
  );
}
