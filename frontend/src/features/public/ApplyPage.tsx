import { useState } from 'react';
import { useParams } from 'react-router-dom';

export function ApplyPage() {
  const { slug } = useParams();
  const [status, setStatus] = useState<'idle' | 'submitting' | 'success'>('idle');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setStatus('submitting');
    // TODO: Gọi API nộp CV
    setTimeout(() => setStatus('success'), 1000);
  };

  return (
    <div className="shell">
      <h1>Nộp đơn vào {slug}</h1>
      {status === 'success' ? (
        <div className="card">
          <h2>Nộp hồ sơ thành công!</h2>
          <p>
            Mã theo dõi của bạn: <strong>APP-2026-XYZ</strong>
          </p>
        </div>
      ) : (
        <form onSubmit={handleSubmit} className="card">
          <input type="text" placeholder="Họ và tên" required />
          <input type="email" placeholder="Email" required />
          <input type="file" accept=".pdf" required />
          <button type="submit" disabled={status === 'submitting'}>
            {status === 'submitting' ? 'Đang gửi...' : 'Nộp CV'}
          </button>
        </form>
      )}
    </div>
  );
}
