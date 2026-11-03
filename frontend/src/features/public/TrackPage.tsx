import { useEffect, useState } from 'react';
import { useNavigate, useParams, Link } from 'react-router-dom';
import { ErrorAlert, Loading, StatusBadge } from '../../components/ui';
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

const STATUS_TONE: Record<TrackResponse['status'], string> = {
  PENDING: 'warning',
  PASSED: 'success',
  REJECTED: 'danger',
};

export function TrackPage() {
  const { code } = useParams();
  const navigate = useNavigate();
  const [input, setInput] = useState(code ?? '');
  const [data, setData] = useState<TrackResponse | null>(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const lookup = async (trackingCode: string): Promise<void> => {
    const cleaned = trackingCode.trim().toUpperCase();
    if (!cleaned) {
      setError('Nhập mã tra cứu');
      return;
    }

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

  const tone = data ? STATUS_TONE[data.status] : 'primary';

  return (
    <main className="container-xl py-5">
      <div className="mx-auto" style={{ maxWidth: 760 }}>
        <div className="text-center mb-4">
          <span className="metric-icon bg-primary-subtle text-primary mx-auto mb-3">
            <i className="bi bi-search" aria-hidden="true" />
          </span>
          <h1 className="h3 fw-bold mb-1">Tra cứu hồ sơ</h1>
          <p className="text-body-secondary mb-0">
            Nhập mã <code>APP-YYYY-XXXX</code> bạn nhận được khi nộp hồ sơ.
          </p>
        </div>

        <div className="card border-0 shadow-sm rounded-4 mb-4">
          <div className="card-body p-3 p-md-4">
            <form
              className="input-group input-group-lg"
              onSubmit={(event) => {
                event.preventDefault();
                void lookup(input);
                navigate(`/track/${input.trim().toUpperCase()}`, { replace: true });
              }}
            >
              <span className="input-group-text bg-white">
                <i className="bi bi-hash" aria-hidden="true" />
              </span>
              <input
                value={input}
                onChange={(event) => setInput(event.target.value)}
                placeholder="APP-2026-XXXX"
                aria-label="Mã tra cứu"
                className="form-control"
              />
              <button type="submit" className="btn btn-primary px-4" disabled={loading}>
                {loading ? (
                  <span className="spinner-border spinner-border-sm" aria-hidden="true" />
                ) : (
                  <>
                    <i className="bi bi-search me-1" aria-hidden="true" />
                    Tra cứu
                  </>
                )}
              </button>
            </form>
          </div>
        </div>

        <ErrorAlert message={error} />

        {data && (
          <div className="card border-0 shadow-sm rounded-4">
            <div className="card-body p-4">
              <div className="d-flex flex-wrap justify-content-between align-items-start gap-2 mb-3">
                <div>
                  <h2 className="h5 fw-bold mb-1">{data.campaign.title}</h2>
                  <span className="text-body-secondary small">
                    Nộp ngày {new Date(data.submittedAt).toLocaleString('vi-VN')}
                  </span>
                </div>
                <StatusBadge status={data.status} />
              </div>

              <div className={`alert alert-${tone} d-flex align-items-center gap-2`} role="status">
                <i
                  className={`bi ${
                    data.status === 'PASSED'
                      ? 'bi-check-circle-fill'
                      : data.status === 'REJECTED'
                        ? 'bi-x-circle-fill'
                        : 'bi-hourglass-split'
                  } fs-5`}
                  aria-hidden="true"
                />
                <div>
                  <div className="fw-semibold">{STATUS_LABEL[data.status]}</div>
                  {data.currentRound && (
                    <div className="small">
                      Vòng hiện tại: {data.currentRound.roundName} (bước{' '}
                      {data.currentRound.orderIndex})
                    </div>
                  )}
                </div>
              </div>

              <dl className="row mb-0 small">
                <dt className="col-sm-4 text-body-secondary fw-normal">Mã hồ sơ</dt>
                <dd className="col-sm-8">
                  <code>{data.trackingCode}</code>
                </dd>

                <dt className="col-sm-4 text-body-secondary fw-normal">Họ tên</dt>
                <dd className="col-sm-8">{data.fullName}</dd>

                <dt className="col-sm-4 text-body-secondary fw-normal">Chiến dịch</dt>
                <dd className="col-sm-8">{data.campaign.title}</dd>

                <dt className="col-sm-4 text-body-secondary fw-normal">Trạng thái</dt>
                <dd className="col-sm-8 mb-0">{STATUS_LABEL[data.status]}</dd>
              </dl>
            </div>
          </div>
        )}

        {!data && !loading && !error && (
          <div className="card border-0 shadow-sm rounded-4">
            <div className="card-body text-center py-5 text-body-secondary">
              <i
                className="bi bi-clipboard-check display-6 text-body-tertiary"
                aria-hidden="true"
              />
              <p className="mt-3 mb-1">Chưa có dữ liệu tra cứu.</p>
              <p className="small mb-0">
                Bạn chưa nhận được mã?{' '}
                <Link to="/" className="text-decoration-none">
                  Xem vị trí đang mở
                </Link>
              </p>
            </div>
          </div>
        )}

        {loading && <Loading label="Đang tra cứu hồ sơ…" />}
      </div>
    </main>
  );
}
