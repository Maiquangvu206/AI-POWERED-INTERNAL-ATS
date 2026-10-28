import { useEffect, useState } from 'react';

interface HealthResponse {
  status: string;
  service: string;
  version: string;
  timestamp: string;
}

type HealthState =
  { kind: 'loading' } | { kind: 'ok'; data: HealthResponse } | { kind: 'error'; message: string };

export function App(): React.JSX.Element {
  const [health, setHealth] = useState<HealthState>({ kind: 'loading' });

  useEffect(() => {
    const controller = new AbortController();

    fetch('/api/v1/health', { signal: controller.signal })
      .then(async (res) => {
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        return (await res.json()) as HealthResponse;
      })
      .then((data) => setHealth({ kind: 'ok', data }))
      .catch((err: unknown) => {
        if (err instanceof DOMException && err.name === 'AbortError') return;
        setHealth({
          kind: 'error',
          message: err instanceof Error ? err.message : 'Lỗi không xác định',
        });
      });

    return () => controller.abort();
  }, []);

  return (
    <main className="shell">
      <h1>AI-Powered Internal ATS</h1>
      <p className="subtitle">Phase 0 — khung dự án đã sẵn sàng</p>

      <section className="card">
        <h2>Kết nối Core API</h2>
        {health.kind === 'loading' && <p className="muted">Đang kiểm tra…</p>}

        {health.kind === 'ok' && (
          <p className="ok">
            ✓ {health.data.service} v{health.data.version} — {health.data.status}
          </p>
        )}

        {health.kind === 'error' && (
          <p className="err">
            ✗ Không gọi được Core API ({health.message}). Chạy <code>npm run dev:api</code> trước.
          </p>
        )}
      </section>

      <p className="muted small">
        Public Portal · Interviewer Portal · Admin Dashboard sẽ được xây ở Phase 6.
      </p>
    </main>
  );
}
