import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { api, getAccessToken, setAccessToken } from '../../lib/api';

interface CampaignRow {
  id: number;
  title: string;
  slug: string;
  status: 'DRAFT' | 'OPEN' | 'CLOSED';
  startDate: string;
  endDate: string;
}

interface CampaignList {
  items: CampaignRow[];
  total: number;
  page: number;
  limit: number;
}

export function AdminHomePage() {
  const navigate = useNavigate();
  const [data, setData] = useState<CampaignList | null>(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!getAccessToken()) {
      navigate('/login', { replace: true });
      return;
    }

    api<CampaignList>('/admin/campaigns?limit=50')
      .then(setData)
      .catch((err: unknown) =>
        setError(err instanceof Error ? err.message : 'Không tải được dữ liệu'),
      )
      .finally(() => setLoading(false));
  }, [navigate]);

  return (
    <main className="shell wide">
      <header className="page-header">
        <h1>Admin Dashboard</h1>
        <div className="header-actions">
          <Link to="/admin/audit-logs" className="button-link">
            Audit log
          </Link>
          <button
            type="button"
            onClick={() => {
              setAccessToken(null);
              navigate('/login', { replace: true });
            }}
          >
            Đăng xuất
          </button>
        </div>
      </header>

      {loading && <p className="muted">Đang tải…</p>}
      {error && <p className="err">{error}</p>}

      {data && (
        <section className="card">
          <h2>Chiến dịch ({data.total})</h2>
          <table className="rubric">
            <thead>
              <tr>
                <th>Chiến dịch</th>
                <th>Trạng thái</th>
                <th>Thời gian</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {data.items.map((campaign) => (
                <tr key={campaign.id}>
                  <td>
                    <strong>{campaign.title}</strong>
                    <div className="muted small">/{campaign.slug}</div>
                  </td>
                  <td>
                    <span className={`badge ${campaign.status === 'OPEN' ? 'ok' : ''}`}>
                      {campaign.status}
                    </span>
                  </td>
                  <td className="small">
                    {campaign.startDate.slice(0, 10)} → {campaign.endDate.slice(0, 10)}
                  </td>
                  <td>
                    <Link to={`/admin/campaigns/${campaign.id}`}>Xếp hạng →</Link>
                  </td>
                </tr>
              ))}
              {data.items.length === 0 && (
                <tr>
                  <td colSpan={4} className="muted small">
                    Chưa có chiến dịch.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </section>
      )}
    </main>
  );
}
