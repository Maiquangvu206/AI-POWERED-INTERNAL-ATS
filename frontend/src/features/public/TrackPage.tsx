import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { api } from '../../lib/api';

interface TrackResponse {
  trackingCode: string;
  fullName: string;
  status: 'PENDING' | 'PASSED' | 'REJECTED';
  campaign: { title: string; slug: string };
  currentRound: { roundName: string; orderIndex: number; status: string } | null;
  submittedAt: string;
}

const STATUS_LABEL: Record<TrackResponse['status'], string> = {
  PENDING: 'Đang xử lý / chờ kết quả',
  PASSED: 'Trúng tuyển',
  REJECTED: 'Chưa phù hợp',
};

export function TrackPage() {
  const { code } = useParams();
  const navigate = useNavigate();
  const [input, setInput] = useState(code ?? '');
  const [data, setData] = useState<TrackResponse | null>(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const lookup = async (trackingCode: string) => {
    const cleaned = trackingCode.trim().toUpperCase();
    if (!cleaned) return setError('Nhập mã tra cứu');

    setLoading(true);
    setError('');
    setData(null);
    try {
      setData(await api<TrackResponse>(`/public/track/${encodeURIComponent(cleaned)}`));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Không tra cứu được hồ sơ');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (code) void lookup(code);
  }, [code]);

  return (
    <main className="shell">
      <h1>Tra cứu hồ sơ</h1>
      <p className="subtitle">Nhập mã APP-YYYY-XXXX bạn nhận được khi nộp hồ sơ.</p>

      <form
        className="card inline-form"
        onSubmit={(event) => {
          event.preventDefault();
          void lookup(input);
          navigate(`/track/${input.trim().toUpperCase()}`, { replace: true });
        }}
      >
        <input
          value={input}
          onChange={(event) => setInput(event.target.value)}
          placeholder="APP-2026-XXXX"
          aria-label="Mã tra cứu"
        />
        <button type="submit" disabled={loading}>
          {loading ? 'Đang tra cứu…' : 'Tra cứu'}
        </button>
      </form>

      {error && <p className="err">{error}</p>}

      {data && (
        <section className="card">
          <h2>{data.campaign.title}</h2>
          <dl className="kv">
            <dt>Mã hồ sơ</dt>
            <dd>{data.trackingCode}</dd>
            <dt>Họ tên</dt>
            <dd>{data.fullName}</dd>
            <dt>Trạng thái</dt>
            <dd>
              <span className={`badge ${data.status === 'PASSED' ? 'ok' : ''}`}>
                {STATUS_LABEL[data.status]}
              </span>
            </dd>
            <dt>Vòng hiện tại</dt>
            <dd>{data.currentRound ? data.currentRound.roundName : 'Đang sàng lọc hồ sơ'}</dd>
            <dt>Ngày nộp</dt>
            <dd>{new Date(data.submittedAt).toLocaleString('vi-VN')}</dd>
          </dl>
        </section>
      )}
    </main>
  );
}
