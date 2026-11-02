import { useCallback, useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
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
      <main className="shell">
        <p className="err">roundId không hợp lệ</p>
      </main>
    );
  }

  return (
    <main className="shell wide">
      <header className="page-header">
        <h1>{data ? `Chấm điểm — ${data.round.roundName}` : 'Interviewer Portal'}</h1>
        {data && (
          <span className={`badge ${data.round.status === 'IN_PROGRESS' ? 'ok' : ''}`}>
            {data.round.status}
          </span>
        )}
      </header>

      {loading && <p className="muted">Đang tải…</p>}
      {error && <p className="err">{error}</p>}

      {data && (
        <div className="interviewer-layout">
          <section className="candidate-list card">
            <h2>Ứng viên ({data.candidates.length})</h2>
            <ul>
              {data.candidates.map((candidate) => (
                <li key={candidate.id}>
                  <button
                    type="button"
                    className={selected?.id === candidate.id ? 'active' : ''}
                    onClick={() => setSelected(candidate)}
                  >
                    <strong>{candidate.fullName}</strong>
                    <span className="muted small">
                      {candidate.aiMatchScore === null
                        ? 'Chưa chấm AI'
                        : `AI ${candidate.aiMatchScore}/100`}
                      {' · '}
                      {candidate.myEvaluation ? 'Đã nộp' : 'Chưa nộp'}
                    </span>
                  </button>
                </li>
              ))}
              {data.candidates.length === 0 && (
                <li className="muted small">Chưa có ứng viên trong vòng này.</li>
              )}
            </ul>
          </section>

          <div className="scoring-column">
            {selected ? (
              <>
                <ScoringPanel
                  key={`${selected.id}-${selected.myEvaluation?.id ?? 'new'}`}
                  round={data.round}
                  candidate={selected}
                  onSubmitted={() => void load()}
                />
                <CopilotPanel candidateId={selected.id} roundId={data.round.id} />
              </>
            ) : (
              <p className="muted">Chọn một ứng viên để chấm điểm.</p>
            )}
          </div>
        </div>
      )}
    </main>
  );
}
