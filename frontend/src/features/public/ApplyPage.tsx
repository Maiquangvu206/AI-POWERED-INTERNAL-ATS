import { useEffect, useRef, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { ErrorAlert, Loading, StatusBadge } from '../../components/ui';
import { api, getAccessToken, setAccessToken } from '../../lib/api';

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

function formatDate(value: string): string {
  return new Date(value).toLocaleDateString('vi-VN', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  });
}

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
  const [staffSession, setStaffSession] = useState(() => Boolean(getAccessToken()));
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

  const pickFile = (next: File | null): void => {
    setError('');
    if (!next) {
      setFile(null);
      return;
    }
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

  const submit = async (event: React.FormEvent<HTMLFormElement>): Promise<void> => {
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
      <main className="container-xl py-5">
        <Loading label="Đang tải chiến dịch…" />
      </main>
    );
  }

  if (loadError || !campaign) {
    return (
      <main className="container-xl py-5">
        <div className="card border-0 shadow-sm rounded-4 mx-auto" style={{ maxWidth: 520 }}>
          <div className="card-body text-center p-5">
            <i className="bi bi-exclamation-octagon display-5 text-danger" aria-hidden="true" />
            <h1 className="h4 fw-bold mt-3">Không tìm thấy chiến dịch</h1>
            <p className="text-body-secondary">
              {loadError || 'Chiến dịch không tồn tại hoặc chưa mở.'}
            </p>
            <Link to="/" className="btn btn-outline-primary">
              <i className="bi bi-arrow-left me-1" aria-hidden="true" />
              Về trang chủ
            </Link>
          </div>
        </div>
      </main>
    );
  }

  if (staffSession) {
    return (
      <main className="container-xl py-5">
        <div className="card border-0 shadow-sm rounded-4 mx-auto" style={{ maxWidth: 560 }}>
          <div className="card-body text-center p-5">
            <span className="metric-icon bg-warning-subtle text-warning mx-auto mb-3">
              <i className="bi bi-shield-exclamation" aria-hidden="true" />
            </span>
            <h1 className="h4 fw-bold">Bạn đang đăng nhập nội bộ</h1>
            <p className="text-body-secondary">
              Tài khoản quản trị/giám khảo không thể nộp hồ sơ ứng viên. Hãy đăng xuất để nộp hồ sơ
              với tư cách ứng viên.
            </p>
            <div className="d-flex justify-content-center gap-2 flex-wrap">
              <button
                type="button"
                className="btn btn-primary"
                onClick={() => {
                  setAccessToken(null);
                  setStaffSession(false);
                }}
              >
                <i className="bi bi-box-arrow-right me-1" aria-hidden="true" />
                Đăng xuất &amp; ứng tuyển
              </button>
              <Link to="/" className="btn btn-outline-secondary">
                Về trang chủ
              </Link>
            </div>
          </div>
        </div>
      </main>
    );
  }

  if (result) {
    return (
      <main className="container-xl py-5">
        <div className="card border-0 shadow-sm rounded-4 mx-auto" style={{ maxWidth: 560 }}>
          <div className="card-body text-center p-5">
            <span className="metric-icon bg-success-subtle text-success mx-auto mb-3">
              <i className="bi bi-check2-circle" aria-hidden="true" />
            </span>
            <h1 className="h4 fw-bold">Nộp hồ sơ thành công</h1>
            <p className="text-body-secondary">
              Hồ sơ của bạn đã được ghi nhận cho <strong>{result.campaign.title}</strong>.
            </p>
            <div className="alert alert-primary d-inline-flex align-items-center gap-2">
              <span className="small text-uppercase fw-semibold">Mã theo dõi</span>
              <code className="fs-6">{result.trackingCode}</code>
            </div>
            <p className="small text-body-secondary">
              Lưu mã này để tra cứu trạng thái hồ sơ bất cứ lúc nào.
            </p>
            <div className="d-flex justify-content-center gap-2 flex-wrap">
              <Link to={`/track/${result.trackingCode}`} className="btn btn-primary">
                <i className="bi bi-search me-1" aria-hidden="true" />
                Tra cứu trạng thái
              </Link>
              <Link to="/" className="btn btn-outline-secondary">
                Về trang chủ
              </Link>
            </div>
          </div>
        </div>
      </main>
    );
  }

  return (
    <main className="container-xl py-5">
      <nav aria-label="breadcrumb" className="mb-3">
        <ol className="breadcrumb small mb-0">
          <li className="breadcrumb-item">
            <Link to="/">Trang chủ</Link>
          </li>
          <li className="breadcrumb-item active" aria-current="page">
            Ứng tuyển
          </li>
        </ol>
      </nav>

      <div className="row g-4 g-lg-5">
        <div className="col-lg-4">
          <div className="card border-0 shadow-sm rounded-4 sticky-lg-top" style={{ top: 88 }}>
            <div className="card-body p-4">
              <div className="d-flex align-items-center gap-2 mb-3">
                <span className="badge rounded-pill bg-primary-subtle text-primary-emphasis">
                  Đang tuyển
                </span>
                <StatusBadge status={campaign.status} />
              </div>
              <h1 className="h4 fw-bold mb-2">{campaign.title}</h1>
              <p className="text-body-secondary">
                {campaign.description || 'Nộp hồ sơ trực tuyến'}
              </p>

              <ul className="list-unstyled small text-body-secondary mb-4">
                <li className="d-flex align-items-center gap-2 mb-2">
                  <i className="bi bi-calendar-event text-primary" aria-hidden="true" />
                  Hạn nhận hồ sơ: <strong>{formatDate(campaign.endDate)}</strong>
                </li>
                <li className="d-flex align-items-center gap-2 mb-2">
                  <i className="bi bi-file-earmark-pdf text-primary" aria-hidden="true" />
                  CV định dạng PDF, tối đa 5 MB
                </li>
                <li className="d-flex align-items-center gap-2">
                  <i className="bi bi-shield-lock text-primary" aria-hidden="true" />
                  Thông tin được bảo mật nội bộ
                </li>
              </ul>

              <div className="alert alert-light border small mb-0">
                <i className="bi bi-info-circle me-1 text-primary" aria-hidden="true" />
                Sau khi nộp, bạn sẽ nhận mã theo dõi để kiểm tra trạng thái hồ sơ.
              </div>
            </div>
          </div>
        </div>

        <div className="col-lg-8">
          <div className="card border-0 shadow-sm rounded-4">
            <div className="card-body p-4 p-lg-5">
              <h2 className="h5 fw-bold mb-1">Thông tin ứng tuyển</h2>
              <p className="text-body-secondary small mb-4">
                Điền đầy đủ thông tin và tải lên CV của bạn.
              </p>

              {campaign.status === 'CLOSED' && (
                <div className="alert alert-warning d-flex align-items-center gap-2" role="alert">
                  <i className="bi bi-lock-fill" aria-hidden="true" />
                  Chiến dịch đã đóng — không nhận thêm hồ sơ.
                </div>
              )}

              <form className="row g-3" onSubmit={submit}>
                <div className="col-md-6">
                  <label className="form-label" htmlFor="fullName">
                    Họ và tên <span className="text-danger">*</span>
                  </label>
                  <input
                    id="fullName"
                    name="fullName"
                    className="form-control"
                    required
                    minLength={2}
                    maxLength={100}
                    placeholder="Nguyễn Văn A"
                  />
                </div>
                <div className="col-md-6">
                  <label className="form-label" htmlFor="phone">
                    Số điện thoại <span className="text-danger">*</span>
                  </label>
                  <input
                    id="phone"
                    name="phone"
                    className="form-control"
                    required
                    placeholder="0912345678"
                  />
                </div>
                <div className="col-12">
                  <label className="form-label" htmlFor="email">
                    Email <span className="text-danger">*</span>
                  </label>
                  <input
                    id="email"
                    name="email"
                    type="email"
                    className="form-control"
                    required
                    placeholder="ban@example.com"
                  />
                </div>

                <div className="col-12">
                  <span className="form-label d-block">CV (PDF) *</span>
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
                    onKeyDown={(event) => {
                      if (event.key === 'Enter' || event.key === ' ') {
                        event.preventDefault();
                        inputRef.current?.click();
                      }
                    }}
                    role="button"
                    tabIndex={0}
                    aria-label="Chọn hoặc kéo thả CV PDF"
                  >
                    <input
                      ref={inputRef}
                      type="file"
                      accept="application/pdf,.pdf"
                      hidden
                      onChange={(event) => pickFile(event.target.files?.[0] ?? null)}
                    />
                    {file ? (
                      <span className="d-inline-flex align-items-center gap-2">
                        <i
                          className="bi bi-file-earmark-pdf-fill text-danger fs-4"
                          aria-hidden="true"
                        />
                        <span>
                          <strong className="d-block">{file.name}</strong>
                          <span className="small text-body-secondary">
                            {Math.round(file.size / 1024)} KB · bấm để chọn file khác
                          </span>
                        </span>
                      </span>
                    ) : (
                      <span>
                        <i
                          className="bi bi-cloud-arrow-up display-6 d-block mb-2"
                          aria-hidden="true"
                        />
                        <strong className="d-block">Kéo thả CV vào đây</strong>
                        <span className="small">hoặc bấm để chọn file PDF ≤ 5 MB</span>
                      </span>
                    )}
                  </div>
                </div>

                {error && (
                  <div className="col-12">
                    <ErrorAlert message={error} />
                  </div>
                )}

                <div className="col-12 d-flex flex-wrap justify-content-between align-items-center gap-2">
                  <span className="small text-body-secondary">
                    <i className="bi bi-shield-check me-1" aria-hidden="true" />
                    Hồ sơ chỉ được dùng cho mục đích tuyển dụng.
                  </span>
                  <button
                    type="submit"
                    className="btn btn-primary btn-lg px-4"
                    disabled={state === 'submitting' || campaign.status === 'CLOSED'}
                  >
                    {state === 'submitting' ? (
                      <>
                        <span
                          className="spinner-border spinner-border-sm me-2"
                          aria-hidden="true"
                        />
                        Đang gửi hồ sơ…
                      </>
                    ) : (
                      <>
                        Nộp hồ sơ
                        <i className="bi bi-send ms-1" aria-hidden="true" />
                      </>
                    )}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}
