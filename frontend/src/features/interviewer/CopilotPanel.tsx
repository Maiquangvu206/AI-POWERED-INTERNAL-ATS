import { useState } from 'react';
import { ErrorAlert } from '../../components/ui';
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

  const generate = async (): Promise<void> => {
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
    <aside className="card border-0 shadow-sm rounded-4">
      <div className="card-body p-4">
        <header className="d-flex flex-wrap align-items-center justify-content-between gap-2 mb-3">
          <div className="d-flex align-items-center gap-2">
            <span className="metric-icon metric-icon-sm bg-primary-subtle text-primary">
              <i className="bi bi-chat-square-quote" aria-hidden="true" />
            </span>
            <div>
              <h2 className="h6 fw-bold mb-0">AI Copilot</h2>
              <p className="small text-body-secondary mb-0">Gợi ý câu hỏi phỏng vấn theo hồ sơ</p>
            </div>
          </div>
          <button
            type="button"
            className="btn btn-outline-primary btn-sm"
            onClick={generate}
            disabled={state === 'loading'}
          >
            {state === 'loading' ? (
              <>
                <span className="spinner-border spinner-border-sm me-2" aria-hidden="true" />
                Đang sinh…
              </>
            ) : (
              <>
                <i className="bi bi-stars me-1" aria-hidden="true" />
                Gợi ý câu hỏi
              </>
            )}
          </button>
        </header>

        <ErrorAlert message={state === 'error' ? error : ''} />

        {missingSkills.length > 0 && (
          <div className="d-flex flex-wrap align-items-center gap-1 mb-3">
            <span className="small text-body-secondary me-1">Kỹ năng còn thiếu:</span>
            {missingSkills.map((skill) => (
              <span
                className="badge rounded-pill bg-warning-subtle text-warning-emphasis"
                key={skill}
              >
                {skill}
              </span>
            ))}
          </div>
        )}

        {questions.length > 0 ? (
          <ol className="list-group list-group-numbered list-group-flush">
            {questions.map((question, index) => (
              <li className="list-group-item px-0 small" key={index}>
                {question}
              </li>
            ))}
          </ol>
        ) : (
          state !== 'loading' && (
            <p className="small text-body-secondary mb-0">
              <i className="bi bi-lightbulb me-1 text-warning" aria-hidden="true" />
              Bấm “Gợi ý câu hỏi” để AI phân tích khoảng trống kỹ năng.
            </p>
          )
        )}
      </div>
    </aside>
  );
}
