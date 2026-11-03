import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { ErrorAlert, Loading, PageHeader, StatusBadge } from '../../components/ui';
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

function formatDate(value: string): string {
  return new Date(value).toLocaleDateString('vi-VN', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  });
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

  const openCount = data?.items.filter((campaign) => campaign.status === 'OPEN').length ?? 0;
  const closedCount = data?.items.filter((campaign) => campaign.status === 'CLOSED').length ?? 0;

  return (
    <main className="container-xl py-4 py-lg-5">
      <PageHeader
        title="Bảng điều khiển"
        subtitle="Quản lý chiến dịch tuyển dụng và theo dõi kết quả AI."
        actions={
          <>
            <Link to="/admin/audit-logs" className="btn btn-outline-secondary">
              <i className="bi bi-journal-text me-1" aria-hidden="true" />
              Audit log
            </Link>
            <button
              type="button"
              className="btn btn-outline-danger"
              onClick={() => {
                setAccessToken(null);
                navigate('/login', { replace: true });
              }}
            >
              <i className="bi bi-box-arrow-right me-1" aria-hidden="true" />
              Đăng xuất
            </button>
          </>
        }
      />

      <div className="row g-3 mb-4">
        <div className="col-6 col-lg-3">
          <div className="card border-0 shadow-sm rounded-4 h-100">
            <div className="card-body">
              <div className="d-flex align-items-center gap-2 text-body-secondary small mb-1">
                <i className="bi bi-briefcase" aria-hidden="true" />
                Tổng chiến dịch
              </div>
              <div className="fs-3 fw-bold">{data?.total ?? '—'}</div>
            </div>
          </div>
        </div>
        <div className="col-6 col-lg-3">
          <div className="card border-0 shadow-sm rounded-4 h-100">
            <div className="card-body">
              <div className="d-flex align-items-center gap-2 text-body-secondary small mb-1">
                <i className="bi bi-unlock text-success" aria-hidden="true" />
                Đang mở
              </div>
              <div className="fs-3 fw-bold text-success">{loading ? '—' : openCount}</div>
            </div>
          </div>
        </div>
        <div className="col-6 col-lg-3">
          <div className="card border-0 shadow-sm rounded-4 h-100">
            <div className="card-body">
              <div className="d-flex align-items-center gap-2 text-body-secondary small mb-1">
                <i className="bi bi-lock text-secondary" aria-hidden="true" />
                Đã đóng
              </div>
              <div className="fs-3 fw-bold">{loading ? '—' : closedCount}</div>
            </div>
          </div>
        </div>
        <div className="col-6 col-lg-3">
          <div className="card border-0 shadow-sm rounded-4 h-100">
            <div className="card-body">
              <div className="d-flex align-items-center gap-2 text-body-secondary small mb-1">
                <i className="bi bi-robot text-primary" aria-hidden="true" />
                AI Pipeline
              </div>
              <div className="fw-semibold text-success">
                <i className="bi bi-check-circle-fill me-1" aria-hidden="true" />
                Sẵn sàng
              </div>
            </div>
          </div>
        </div>
      </div>

      {loading && <Loading />}
      <ErrorAlert message={error} />

      {data && (
        <div className="card border-0 shadow-sm rounded-4">
          <div className="card-body p-0">
            <div className="d-flex align-items-center justify-content-between p-4 pb-3">
              <h2 className="h5 fw-bold mb-0">Chiến dịch</h2>
              <span className="badge rounded-pill bg-primary-subtle text-primary-emphasis">
                {data.total} bản ghi
              </span>
            </div>

            <div className="table-responsive">
              <table className="table table-hover align-middle mb-0">
                <thead className="table-light">
                  <tr>
                    <th scope="col">Chiến dịch</th>
                    <th scope="col">Trạng thái</th>
                    <th scope="col">Thời gian</th>
                    <th scope="col" className="text-end">
                      Hành động
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {data.items.map((campaign) => (
                    <tr key={campaign.id}>
                      <td>
                        <div className="fw-semibold">{campaign.title}</div>
                        <div className="small text-body-secondary">/{campaign.slug}</div>
                      </td>
                      <td>
                        <StatusBadge status={campaign.status} />
                      </td>
                      <td className="small text-body-secondary text-nowrap">
                        {formatDate(campaign.startDate)} → {formatDate(campaign.endDate)}
                      </td>
                      <td className="text-end">
                        <Link
                          to={`/admin/campaigns/${campaign.id}`}
                          className="btn btn-sm btn-outline-primary"
                        >
                          Xếp hạng
                          <i className="bi bi-arrow-right ms-1" aria-hidden="true" />
                        </Link>
                      </td>
                    </tr>
                  ))}
                  {data.items.length === 0 && (
                    <tr>
                      <td colSpan={4} className="text-center text-body-secondary py-5">
                        <i
                          className="bi bi-inbox display-6 d-block mb-2 text-body-tertiary"
                          aria-hidden="true"
                        />
                        Chưa có chiến dịch nào.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}
