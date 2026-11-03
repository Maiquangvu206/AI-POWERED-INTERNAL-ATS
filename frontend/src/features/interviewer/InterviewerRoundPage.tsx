import { useCallback, useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { ErrorAlert, Loading, PageHeader, StatusBadge } from '../../components/ui';
import { api } from '../../lib/api';
import { CopilotPanel } from './CopilotPanel';
import { ScoringPanel } from './ScoringPanel';
import type { RoundCandidate, RoundCandidatesResponse } from './types';

export function InterviewerRoundPage() {
  const { roundId } = useParams();
  const roundIdNumber = Number(roundId);

  const [data, setData] = useState<RoundCandidatesResponse | null>(null);
  const [selected, setSelected] = useState<RoundCandidate | null>(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const result = await api<RoundCandidatesResponse>(`/rounds/${roundIdNumber}/candidates`);
      setData(result);
      setSelected((current) =>
        current ? (result.candidates.find((item) => item.id === current.id) ?? null) : null,
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Không tải được danh sách ứng viên');
    } finally {
      setLoading(false);
    }
  }, [roundIdNumber]);

  useEffect(() => {
    void load();
  }, [load]);

  if (!Number.isInteger(roundIdNumber)) {
    return (
      <main className="container-xl py-5">
        <ErrorAlert message="roundId không hợp lệ" />
      </main>
    );
  }

  return (
    <main className="container-xl py-4 py-lg-5">
      <PageHeader
        title={data ? `Chấm điểm — ${data.round.roundName}` : 'Cổng giám khảo'}
        subtitle="Chọn ứng viên, chấm theo rubric và tham khảo câu hỏi từ AI Copilot."
        badge={data ? <StatusBadge status={data.round.status} /> : undefined}
      />

      {loading && <Loading />}
      <ErrorAlert message={error} />

      {data && (
        <div className="row g-4">
          <div className="col-lg-4">
            <div className="card border-0 shadow-sm rounded-4 sticky-lg-top" style={{ top: 88 }}>
              <div className="card-body">
                <div className="d-flex align-items-center justify-content-between mb-3">
                  <h2 className="h6 fw-bold mb-0">
                    <i className="bi bi-people me-1 text-primary" aria-hidden="true" />
                    Ứng viên
                  </h2>
                  <span className="badge rounded-pill bg-primary-subtle text-primary-emphasis">
                    {data.candidates.length}
                  </span>
                </div>

                <div className="list-group list-group-flush">
                  {data.candidates.map((candidate) => {
                    const active = selected?.id === candidate.id;
                    return (
                      <button
                        key={candidate.id}
                        type="button"
                        className={`list-group-item list-group-item-action rounded-3 mb-1 border-0 ${
                          active ? 'active' : ''
                        }`}
                        onClick={() => setSelected(candidate)}
                        aria-pressed={active}
                      >
                        <div className="d-flex justify-content-between align-items-start gap-2">
                          <span className="fw-semibold">{candidate.fullName}</span>
                          {candidate.myEvaluation ? (
                            <span
                              className={`badge rounded-pill ${
                                active
                                  ? 'bg-white text-primary'
                                  : 'bg-success-subtle text-success-emphasis'
                              }`}
                            >
                              Đã nộp
                            </span>
                          ) : (
                            <span className="badge rounded-pill bg-warning-subtle text-warning-emphasis">
                              Chưa nộp
                            </span>
                          )}
                        </div>
                        <div
                          className={`small ${active ? 'text-white-50' : 'text-body-secondary'}`}
                        >
                          {candidate.aiMatchScore === null
                            ? 'Chưa chấm AI'
                            : `AI match ${candidate.aiMatchScore}/100`}
                        </div>
                      </button>
                    );
                  })}
                  {data.candidates.length === 0 && (
                    <p className="text-body-secondary small mb-0 py-3">
                      Chưa có ứng viên trong vòng này.
                    </p>
                  )}
                </div>
              </div>
            </div>
          </div>

          <div className="col-lg-8">
            {selected ? (
              <div className="d-flex flex-column gap-4">
                <ScoringPanel
                  key={`${selected.id}-${selected.myEvaluation?.id ?? 'new'}`}
                  round={data.round}
                  candidate={selected}
                  onSubmitted={() => void load()}
                />
                <CopilotPanel candidateId={selected.id} roundId={data.round.id} />
              </div>
            ) : (
              <div className="card border-0 shadow-sm rounded-4">
                <div className="card-body text-center py-5 text-body-secondary">
                  <i
                    className="bi bi-person-check display-5 text-body-tertiary"
                    aria-hidden="true"
                  />
                  <p className="mt-3 mb-0">Chọn một ứng viên để bắt đầu chấm điểm.</p>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </main>
  );
}
