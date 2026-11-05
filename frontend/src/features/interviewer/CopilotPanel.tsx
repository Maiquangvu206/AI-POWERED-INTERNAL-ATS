import { useState } from 'react';
import { ErrorAlert } from '../../components/ui';
import { api } from '../../lib/api';
import type { CopilotResponse, CopilotSuggestion } from './types';

interface Props {
  candidateId: number;
  roundId: number;
}

export function CopilotPanel({ candidateId, roundId }: Props) {
  const [suggestions, setSuggestions] = useState<CopilotSuggestion[]>([]);
  const [missingSkills, setMissingSkills] = useState<string[]>([]);
  const [cached, setCached] = useState(false);
  const [fallbackUsed, setFallbackUsed] = useState(false);
  const [copied, setCopied] = useState<number | null>(null);
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
      setSuggestions(result.suggestions);
      setMissingSkills(result.missingSkills);
      setCached(result.cached);
      setFallbackUsed(result.fallbackUsed);
      setState('idle');
    } catch (err) {
      setState('error');
      setError(err instanceof Error ? err.message : 'Không sinh được câu hỏi');
    }
  };

  const copyQuestion = async (index: number, suggestion: CopilotSuggestion): Promise<void> => {
    const text = [
      suggestion.question,
      suggestion.rationale ? `Vì sao: ${suggestion.rationale}` : '',
      suggestion.expectedSignals.length > 0
        ? `Tín hiệu cần quan sát: ${suggestion.expectedSignals.join('; ')}`
        : '',
    ]
      .filter(Boolean)
      .join('\n');

    try {
      await navigator.clipboard.writeText(text);
      setCopied(index);
      window.setTimeout(() => setCopied(null), 1_500);
    } catch {
      setError('Trình duyệt không cho phép copy — hãy chọn và copy thủ công.');
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

        {(cached || fallbackUsed) && (
          <p className="small text-body-secondary mb-3">
            {cached && (
              <span className="badge rounded-pill bg-secondary-subtle text-secondary-emphasis me-1">
                <i className="bi bi-clock-history me-1" aria-hidden="true" />
                Lấy từ cache 24h
              </span>
            )}
            {fallbackUsed && (
              <span className="badge rounded-pill bg-info-subtle text-info-emphasis">
                <i className="bi bi-shield-check me-1" aria-hidden="true" />
                Câu hỏi mẫu (AI tạm thời không khả dụng)
              </span>
            )}
          </p>
        )}

        {suggestions.length > 0 ? (
          <ol className="list-group list-group-numbered list-group-flush">
            {suggestions.map((suggestion, index) => (
              <li className="list-group-item px-0 py-3" key={`${index}-${suggestion.question}`}>
                <div className="d-flex justify-content-between gap-2">
                  <p className="fw-semibold mb-1">{suggestion.question}</p>
                  <button
                    type="button"
                    className="btn btn-outline-secondary btn-sm flex-shrink-0"
                    onClick={() => void copyQuestion(index, suggestion)}
                    title="Copy câu hỏi kèm gợi ý"
                  >
                    <i
                      className={`bi ${copied === index ? 'bi-check2' : 'bi-clipboard'}`}
                      aria-hidden="true"
                    />
                    <span className="visually-hidden">Copy câu hỏi</span>
                  </button>
                </div>
                {suggestion.rationale && (
                  <p className="small text-body-secondary mb-2">
                    <i className="bi bi-info-circle me-1" aria-hidden="true" />
                    {suggestion.rationale}
                  </p>
                )}
                {suggestion.expectedSignals.length > 0 && (
                  <div className="d-flex flex-wrap gap-1">
                    {suggestion.expectedSignals.map((signal) => (
                      <span
                        className="badge rounded-pill bg-success-subtle text-success-emphasis fw-normal"
                        key={signal}
                      >
                        {signal}
                      </span>
                    ))}
                  </div>
                )}
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

        <p className="small text-body-secondary border-top pt-3 mt-3 mb-0">
          <i className="bi bi-exclamation-triangle me-1 text-warning" aria-hidden="true" />
          Gợi ý do AI tạo, cần giám khảo thẩm định trước khi sử dụng.
        </p>
      </div>
    </aside>
  );
}
