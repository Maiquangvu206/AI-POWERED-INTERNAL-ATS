import { useEffect, useRef, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { api } from '../../lib/api';

interface PublicCampaign {
  id: number;
  title: string;
  slug: string;
  description: string | null;
  startDate: string;
  endDate: string;
  status: 'OPEN' | 'CLOSED';
}

interface ApplyResponse {
  trackingCode: string;
  submittedAt: string;
  campaign: { title: string; slug: string };
}

const MAX_BYTES = 5 * 1024 * 1024;

export function ApplyPage() {
  const { slug } = useParams();
  const [campaign, setCampaign] = useState<PublicCampaign | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [dragging, setDragging] = useState(false);
  const [state, setState] = useState<'idle' | 'submitting' | 'error'>('idle');
  const [error, setError] = useState('');
  const [result, setResult] = useState<ApplyResponse | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    api<PublicCampaign>(`/public/campaigns/${slug}`)
      .then((data) => {
        if (!cancelled) setCampaign(data);
      })
      .catch((err: unknown) => {
        if (!cancelled)
          setLoadError(err instanceof Error ? err.message : 'Không tải được chiến dịch');
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [slug]);

  const pickFile = (next: File | null) => {
    setError('');
    if (!next) return setFile(null);
    if (next.type !== 'application/pdf' && !next.name.toLowerCase().endsWith('.pdf')) {
      setError('Chỉ chấp nhận file PDF');
      return;
    }
    if (next.size > MAX_BYTES) {
      setError('File vượt quá 5 MB');
      return;
    }
    setFile(next);
  };

  const submit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!file) {
      setError('Vui lòng chọn CV (PDF)');
      return;
    }

    const form = new FormData(event.currentTarget);
    form.set('cv', file);

    setState('submitting');
    setError('');
    try {
      const data = await api<ApplyResponse>(`/public/campaigns/${slug}/apply`, {
        method: 'POST',
        body: form,
      });
      setResult(data);
    } catch (err) {
      setState('error');
      setError(err instanceof Error ? err.message : 'Nộp hồ sơ thất bại');
    }
  };

  if (loading) {
    return (
      <main className="shell">
        <p className="muted">Đang tải chiến dịch…</p>
      </main>
    );
  }

  if (loadError || !campaign) {
    return (
      <main className="shell">
        <h1>Không tìm thấy chiến dịch</h1>
        <p className="err">{loadError || 'Chiến dịch không tồn tại hoặc chưa mở.'}</p>
        <Link to="/">← Về trang chủ</Link>
      </main>
    );
  }

  if (result) {
    return (
      <main className="shell">
        <h1>Nộp hồ sơ thành công 🎉</h1>
        <section className="card">
          <p>
            Hồ sơ của bạn đã được ghi nhận cho <strong>{result.campaign.title}</strong>.
          </p>
          <p>
            Mã theo dõi: <code>{result.trackingCode}</code>
          </p>
          <p className="muted small">Lưu mã này để tra cứu trạng thái hồ sơ bất cứ lúc nào.</p>
          <Link to={`/track/${result.trackingCode}`}>
            <button type="button">Tra cứu trạng thái</button>
          </Link>
        </section>
      </main>
    );
  }

  return (
    <main className="shell">
      <h1>{campaign.title}</h1>
      <p className="subtitle">
        {campaign.description || 'Nộp hồ sơ trực tuyến'} · Hạn nhận: {campaign.endDate.slice(0, 10)}
      </p>

      {campaign.status === 'CLOSED' && (
        <p className="err">Chiến dịch đã đóng — không nhận thêm hồ sơ.</p>
      )}

      <form className="card apply-form" onSubmit={submit}>
        <label className="field">
          <span>Họ và tên *</span>
          <input name="fullName" required minLength={2} maxLength={100} />
        </label>
        <label className="field">
          <span>Email *</span>
          <input name="email" type="email" required />
        </label>
        <label className="field">
          <span>Số điện thoại *</span>
          <input name="phone" required placeholder="0912345678" />
        </label>

        <div
          className={`dropzone ${dragging ? 'dragging' : ''}`}
          onDragOver={(event) => {
            event.preventDefault();
            setDragging(true);
          }}
          onDragLeave={() => setDragging(false)}
          onDrop={(event) => {
            event.preventDefault();
            setDragging(false);
            pickFile(event.dataTransfer.files[0] ?? null);
          }}
          onClick={() => inputRef.current?.click()}
          role="button"
          tabIndex={0}
        >
          <input
            ref={inputRef}
            type="file"
            accept="application/pdf,.pdf"
            hidden
            onChange={(event) => pickFile(event.target.files?.[0] ?? null)}
          />
          {file ? (
            <span>
              📄 {file.name} <span className="muted">({Math.round(file.size / 1024)} KB)</span>
            </span>
          ) : (
            <span>Kéo thả CV (PDF ≤ 5 MB) vào đây hoặc bấm để chọn file</span>
          )}
        </div>

        {error && <p className="err small">{error}</p>}

        <button type="submit" disabled={state === 'submitting' || campaign.status === 'CLOSED'}>
          {state === 'submitting' ? 'Đang gửi hồ sơ…' : 'Nộp hồ sơ'}
        </button>
      </form>
    </main>
  );
}
