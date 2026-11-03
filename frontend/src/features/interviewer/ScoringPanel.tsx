import { useMemo, useState } from 'react';
import { ErrorAlert, StatusBadge } from '../../components/ui';
import { api } from '../../lib/api';
import type { RoundCandidate, RoundInfo } from './types';

interface Props {
  round: RoundInfo;
  candidate: RoundCandidate;
  onSubmitted: () => void;
}

type ScoresState = Record<number, string>;

export function ScoringPanel({ round, candidate, onSubmitted }: Props) {
  const [scores, setScores] = useState<ScoresState>(
    () =>
      Object.fromEntries(
        (candidate.myEvaluation?.details ?? []).map((detail) => [
          detail.criterionId,
          String(detail.score),
        ]),
      ) as ScoresState,
  );
  const [notes, setNotes] = useState(candidate.myEvaluation?.generalNotes ?? '');
  const [state, setState] = useState<'idle' | 'submitting' | 'error' | 'ok'>('idle');
  const [error, setError] = useState('');

  const locked = round.status !== 'IN_PROGRESS';
  const editing = candidate.myEvaluation !== null;

  const total = useMemo(() => {
    const sum = round.criteria.reduce((acc, criterion) => {
      const raw = Number(scores[criterion.id] ?? 0);
      const score = Math.min(Math.max(raw || 0, 0), criterion.maxScore);
      return acc + (score / criterion.maxScore) * criterion.weight;
    }, 0);
    return Math.round(sum * 100 * 100) / 100;
  }, [round.criteria, scores]);

  const setScore = (criterionId: number, value: string): void => {
    setScores((prev) => ({ ...prev, [criterionId]: value }));
  };

  const submit = async (event: React.FormEvent): Promise<void> => {
    event.preventDefault();
    setError('');

    const payload = {
      roundId: round.id,
      candidateId: candidate.id,
      generalNotes: notes.trim() || undefined,
      scores: round.criteria.map((criterion) => ({
        criterionId: criterion.id,
        score: Number(scores[criterion.id] ?? 0),
      })),
    };

    setState('submitting');
    try {
      if (editing) {
        await api(`/evaluations/${candidate.myEvaluation!.id}`, {
          method: 'PATCH',
          body: JSON.stringify({
            generalNotes: payload.generalNotes,
            scores: payload.scores,
          }),
        });
      } else {
        await api('/evaluations', { method: 'POST', body: JSON.stringify(payload) });
      }
      setState('ok');
      onSubmitted();
    } catch (err) {
      setState('error');
      setError(err instanceof Error ? err.message : 'Nộp phiếu thất bại');
    }
  };

  return (
    <form className="card border-0 shadow-sm rounded-4" onSubmit={submit}>
      <div className="card-body p-4">
        <header className="d-flex flex-wrap justify-content-between align-items-start gap-2 mb-3">
          <div>
            <h2 className="h5 fw-bold mb-1">{candidate.fullName}</h2>
            <p className="small text-body-secondary mb-0">
              {candidate.trackingCode} · AI match{' '}
              {candidate.aiMatchScore === null ? '—' : `${candidate.aiMatchScore}/100`}
            </p>
          </div>
          <div className="d-flex align-items-center gap-2">
            <StatusBadge status={round.status} />
            <span
              className={`badge rounded-pill ${
                editing
                  ? 'bg-success-subtle text-success-emphasis'
                  : 'bg-warning-subtle text-warning-emphasis'
              }`}
            >
              {editing ? 'Đã nộp — đang sửa' : 'Chưa nộp'}
            </span>
          </div>
        </header>

        {candidate.aiParsedSkills?.skills?.length ? (
          <div className="d-flex flex-wrap gap-1 mb-3">
            {candidate.aiParsedSkills.skills.slice(0, 12).map((skill) => (
              <span className="badge rounded-pill bg-light text-body-secondary border" key={skill}>
                {skill}
              </span>
            ))}
          </div>
        ) : null}

        <div className="table-responsive">
          <table className="table align-middle mb-3">
            <thead className="table-light">
              <tr>
                <th scope="col">Tiêu chí</th>
                <th scope="col">Trọng số</th>
                <th scope="col" style={{ width: 180 }}>
                  Điểm
                </th>
              </tr>
            </thead>
            <tbody>
              {round.criteria.map((criterion) => (
                <tr key={criterion.id}>
                  <td className="fw-semibold">{criterion.title}</td>
                  <td>
                    <span className="badge bg-light text-body-secondary border">
                      {Math.round(criterion.weight * 100)}%
                    </span>
                  </td>
                  <td>
                    <div className="input-group input-group-sm">
                      <input
                        type="number"
                        className="form-control"
                        min={0}
                        max={criterion.maxScore}
                        step={0.25}
                        value={scores[criterion.id] ?? ''}
                        onChange={(event) => setScore(criterion.id, event.target.value)}
                        disabled={locked}
                        required
                        aria-label={`Điểm ${criterion.title}`}
                      />
                      <span className="input-group-text">/ {criterion.maxScore}</span>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="mb-3">
          <label className="form-label" htmlFor="generalNotes">
            Nhận xét chung
          </label>
          <textarea
            id="generalNotes"
            className="form-control"
            rows={3}
            value={notes}
            onChange={(event) => setNotes(event.target.value)}
            disabled={locked}
            maxLength={5000}
            placeholder="Ghi chú đánh giá, điểm mạnh, rủi ro…"
          />
        </div>

        <div className="bg-light rounded-3 p-3 mb-3">
          <div className="d-flex justify-content-between align-items-center mb-1">
            <span className="small text-body-secondary">Tổng điểm tạm tính</span>
            <strong className="fs-5">{total}/100</strong>
          </div>
          <div className="progress" style={{ height: 8 }} aria-hidden="true">
            <div
              className={`progress-bar ${
                total >= 75 ? 'bg-success' : total >= 50 ? 'bg-primary' : 'bg-warning'
              }`}
              style={{ width: `${Math.min(Math.max(total, 0), 100)}%` }}
            />
          </div>
        </div>

        <ErrorAlert message={state === 'error' ? error : ''} />

        {locked && (
          <div className="alert alert-secondary small mb-3" role="status">
            <i className="bi bi-lock me-1" aria-hidden="true" />
            Vòng không ở trạng thái IN_PROGRESS — chỉ xem.
          </div>
        )}
        {state === 'ok' && (
          <div className="alert alert-success small mb-3" role="status">
            <i className="bi bi-check-circle me-1" aria-hidden="true" />
            Đã lưu phiếu điểm.
          </div>
        )}

        <div className="d-flex justify-content-end">
          <button
            type="submit"
            className="btn btn-primary px-4"
            disabled={locked || state === 'submitting'}
          >
            {state === 'submitting' ? (
              <>
                <span className="spinner-border spinner-border-sm me-2" aria-hidden="true" />
                Đang gửi…
              </>
            ) : editing ? (
              <>
                <i className="bi bi-save me-1" aria-hidden="true" />
                Cập nhật phiếu
              </>
            ) : (
              <>
                <i className="bi bi-send me-1" aria-hidden="true" />
                Nộp phiếu
              </>
            )}
          </button>
        </div>
      </div>
    </form>
  );
}
