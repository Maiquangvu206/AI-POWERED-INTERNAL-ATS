import { useMemo, useState } from 'react';
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

  const setScore = (criterionId: number, value: string) => {
    setScores((prev) => ({ ...prev, [criterionId]: value }));
  };

  const submit = async (event: React.FormEvent) => {
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
    <form className="card scoring" onSubmit={submit}>
      <header className="scoring-header">
        <div>
          <h2>{candidate.fullName}</h2>
          <p className="muted small">
            {candidate.trackingCode} · AI match{' '}
            {candidate.aiMatchScore === null ? '—' : `${candidate.aiMatchScore}/100`}
          </p>
        </div>
        <span className={editing ? 'badge ok' : 'badge'}>
          {editing ? 'Đã nộp — đang sửa' : 'Chưa nộp'}
        </span>
      </header>

      {candidate.aiParsedSkills?.skills?.length ? (
        <p className="muted small">Kỹ năng: {candidate.aiParsedSkills.skills.join(', ')}</p>
      ) : null}

      <table className="rubric">
        <thead>
          <tr>
            <th>Tiêu chí</th>
            <th>Trọng số</th>
            <th>Điểm</th>
          </tr>
        </thead>
        <tbody>
          {round.criteria.map((criterion) => (
            <tr key={criterion.id}>
              <td>{criterion.title}</td>
              <td>{Math.round(criterion.weight * 100)}%</td>
              <td>
                <input
                  type="number"
                  min={0}
                  max={criterion.maxScore}
                  step={0.25}
                  value={scores[criterion.id] ?? ''}
                  onChange={(event) => setScore(criterion.id, event.target.value)}
                  disabled={locked}
                  required
                />{' '}
                / {criterion.maxScore}
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      <label className="field">
        <span>Nhận xét chung</span>
        <textarea
          rows={3}
          value={notes}
          onChange={(event) => setNotes(event.target.value)}
          disabled={locked}
          maxLength={5000}
        />
      </label>

      <footer className="scoring-footer">
        <strong>Tổng điểm: {total}/100</strong>
        <button type="submit" disabled={locked || state === 'submitting'}>
          {state === 'submitting' ? 'Đang gửi…' : editing ? 'Cập nhật phiếu' : 'Nộp phiếu'}
        </button>
      </footer>

      {locked && <p className="muted small">Vòng không ở trạng thái IN_PROGRESS — chỉ xem.</p>}
      {state === 'ok' && <p className="ok small">Đã lưu phiếu điểm.</p>}
      {state === 'error' && <p className="err small">{error}</p>}
    </form>
  );
}
