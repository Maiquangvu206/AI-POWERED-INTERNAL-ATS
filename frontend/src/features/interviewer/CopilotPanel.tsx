import { useState } from 'react';
import { api } from '../../lib/api';
import type { CopilotResponse } from './types';

interface Props {
  candidateId: number;
  roundId: number;
}

export function CopilotPanel({ candidateId, roundId }: Props) {
  const [questions, setQuestions] = useState<string[]>([]);
  const [missingSkills, setMissingSkills] = useState<string[]>([]);
  const [state, setState] = useState<'idle' | 'loading' | 'error'>('idle');
  const [error, setError] = useState('');

  const generate = async () => {
    setState('loading');
    setError('');
    try {
      const result = await api<CopilotResponse>('/ai/copilot/questions', {
        method: 'POST',
        body: JSON.stringify({ candidateId, roundId, count: 5 }),
      });
      setQuestions(result.questions);
      setMissingSkills(result.missingSkills);
      setState('idle');
    } catch (err) {
      setState('error');
      setError(err instanceof Error ? err.message : 'Không sinh được câu hỏi');
    }
  };

  return (
    <aside className="card copilot">
      <header className="copilot-header">
        <h3>AI Copilot</h3>
        <button type="button" onClick={generate} disabled={state === 'loading'}>
          {state === 'loading' ? 'Đang sinh…' : 'Gợi ý câu hỏi'}
        </button>
      </header>

      {missingSkills.length > 0 && (
        <p className="muted small">Kỹ năng còn thiếu: {missingSkills.join(', ')}</p>
      )}

      {state === 'error' && <p className="err small">{error}</p>}

      {questions.length > 0 ? (
        <ol className="questions">
          {questions.map((question, index) => (
            <li key={index}>{question}</li>
          ))}
        </ol>
      ) : (
        state !== 'loading' && (
          <p className="muted small">Bấm “Gợi ý câu hỏi” để AI phân tích khoảng trống kỹ năng.</p>
        )
      )}
    </aside>
  );
}
