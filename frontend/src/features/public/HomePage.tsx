import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../../lib/api';

interface PublicCampaign {
  id: number;
  title: string;
  slug: string;
  description: string | null;
  status: 'OPEN' | 'CLOSED';
  endDate: string;
}

export function HomePage() {
  const [campaigns, setCampaigns] = useState<PublicCampaign[]>([]);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api<PublicCampaign[]>('/public/campaigns')
      .then(setCampaigns)
      .catch((err: unknown) =>
        setError(err instanceof Error ? err.message : 'Không tải được dữ liệu'),
      )
      .finally(() => setLoading(false));
  }, []);

  return (
    <main className="shell">
      <h1>AI-Powered Internal ATS</h1>
      <p className="subtitle">Cơ hội nghề nghiệp · Tra cứu hồ sơ · Cổng nội bộ</p>

      <div className="home-actions">
        <Link to="/login">Đăng nhập nội bộ →</Link>
        <Link to="/track">Tra cứu hồ sơ →</Link>
      </div>

      {loading && <p className="muted">Đang tải chiến dịch…</p>}
      {error && <p className="err">{error}</p>}

      {campaigns.map((campaign) => (
        <section className="card" key={campaign.id}>
          <h2>{campaign.title}</h2>
          <p>{campaign.description || 'Xem chi tiết và nộp hồ sơ trực tuyến.'}</p>
          <p className="muted small">Hạn nhận hồ sơ: {campaign.endDate.slice(0, 10)}</p>
          <Link to={`/apply/${campaign.slug}`}>
            <button type="button">Nộp hồ sơ</button>
          </Link>
        </section>
      ))}

      {!loading && campaigns.length === 0 && !error && (
        <p className="muted">Hiện chưa có chiến dịch nào đang mở.</p>
      )}
    </main>
  );
}
