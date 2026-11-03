import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { ErrorAlert, Loading, StatusBadge } from '../../components/ui';
import { api } from '../../lib/api';

interface PublicCampaign {
  id: number;
  title: string;
  slug: string;
  description: string | null;
  status: 'OPEN' | 'CLOSED';
  endDate: string;
}

const FEATURES = [
  {
    icon: 'bi-cloud-arrow-up',
    tone: 'primary',
    title: 'Nộp hồ sơ trong 2 phút',
    text: 'Chỉ cần một file CV PDF. Không tạo tài khoản, không điền lại thông tin nhiều lần.',
  },
  {
    icon: 'bi-search',
    tone: 'success',
    title: 'Theo dõi minh bạch',
    text: 'Mỗi hồ sơ có mã tra cứu riêng để bạn tự xem trạng thái ở từng vòng, bất cứ lúc nào.',
  },
  {
    icon: 'bi-shield-lock',
    tone: 'info',
    title: 'Dữ liệu được bảo vệ',
    text: 'Hồ sơ chỉ dùng cho mục đích tuyển dụng và xử lý theo Nghị định 13/2023/NĐ-CP.',
  },
] as const;

const PROCESS_STEPS = [
  {
    icon: 'bi-file-earmark-pdf',
    title: 'Nộp CV trực tuyến',
    text: 'Chọn vị trí và tải lên CV PDF.',
  },
  {
    icon: 'bi-cpu',
    title: 'Sàng lọc có hỗ trợ AI',
    text: 'AI xếp hạng mức độ phù hợp; nhà tuyển dụng xem xét lại.',
  },
  {
    icon: 'bi-people',
    title: 'Phỏng vấn theo vòng',
    text: 'Bạn nhận thông báo và hướng dẫn cho từng vòng.',
  },
  {
    icon: 'bi-envelope-check',
    title: 'Nhận kết quả',
    text: 'Tra cứu bằng mã hồ sơ, minh bạch ở mọi bước.',
  },
] as const;

function formatDate(value: string): string {
  return new Date(value).toLocaleDateString('vi-VN', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  });
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
    <main>
      <section className="hero border-bottom">
        <div className="container-xl py-5">
          <div className="row align-items-center g-5">
            <div className="col-lg-7">
              <span className="badge rounded-pill bg-primary-subtle text-primary-emphasis mb-3">
                <i className="bi bi-stars me-1" aria-hidden="true" />
                Tuyển dụng minh bạch, AI hỗ trợ
              </span>
              <h1 className="display-5 fw-bold lh-sm mb-3">
                Ứng tuyển dễ dàng,
                <br />
                <span className="text-primary">theo dõi minh bạch</span>
              </h1>
              <p className="lead text-body-secondary mb-4">
                Nộp CV trực tuyến, nhận mã hồ sơ và tự theo dõi tiến trình ở từng vòng. AI chỉ hỗ
                trợ sắp xếp hồ sơ — quyết định tuyển dụng luôn do con người thực hiện.
              </p>
              <div className="d-flex flex-wrap gap-2">
                <a href="#vi-tri" className="btn btn-primary btn-lg">
                  <i className="bi bi-briefcase me-1" aria-hidden="true" />
                  Xem vị trí đang mở
                </a>
                <Link to="/track" className="btn btn-outline-primary btn-lg">
                  <i className="bi bi-search me-1" aria-hidden="true" />
                  Tra cứu hồ sơ
                </Link>
              </div>
            </div>

            <div className="col-lg-5">
              <div className="card border-0 shadow-sm rounded-4">
                <div className="card-body p-4">
                  <div className="d-flex align-items-center gap-2 mb-3">
                    <span className="metric-icon bg-primary-subtle text-primary">
                      <i className="bi bi-diagram-3" aria-hidden="true" />
                    </span>
                    <div>
                      <div className="fw-semibold">Quy trình tuyển dụng</div>
                      <div className="small text-body-secondary">
                        Bạn biết rõ mình đang ở bước nào
                      </div>
                    </div>
                  </div>

                  <ol className="list-unstyled mb-0">
                    {PROCESS_STEPS.map((step, index) => (
                      <li className="d-flex gap-3" key={step.title}>
                        <div className="d-flex flex-column align-items-center">
                          <span className="metric-icon metric-icon-sm bg-primary-subtle text-primary">
                            <i className={`bi ${step.icon}`} aria-hidden="true" />
                          </span>
                          {index < PROCESS_STEPS.length - 1 && (
                            <span
                              className="flex-grow-1 border-start my-1"
                              style={{ minHeight: 18 }}
                              aria-hidden="true"
                            />
                          )}
                        </div>
                        <div className={index < PROCESS_STEPS.length - 1 ? 'pb-3' : ''}>
                          <div className="fw-semibold small">{step.title}</div>
                          <div className="small text-body-secondary">{step.text}</div>
                        </div>
                      </li>
                    ))}
                  </ol>

                  <div className="alert alert-light border small mb-0 mt-3">
                    <i className="bi bi-info-circle text-primary me-1" aria-hidden="true" />
                    Điểm số và xếp hạng nội bộ không hiển thị công khai. Kết quả cuối cùng được
                    thông báo qua mã tra cứu của bạn.
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="container-xl py-5">
        <div className="row g-4 mb-5">
          {FEATURES.map((feature) => (
            <div className="col-md-4" key={feature.title}>
              <div className="card h-100 border-0 shadow-sm rounded-4">
                <div className="card-body p-4">
                  <span
                    className={`metric-icon bg-${feature.tone}-subtle text-${feature.tone} mb-3`}
                  >
                    <i className={`bi ${feature.icon}`} aria-hidden="true" />
                  </span>
                  <h2 className="h6 fw-bold mb-2">{feature.title}</h2>
                  <p className="text-body-secondary small mb-0">{feature.text}</p>
                </div>
              </div>
            </div>
          ))}
        </div>

        <div
          id="vi-tri"
          className="d-flex align-items-center justify-content-between flex-wrap gap-2 mb-3"
        >
          <div>
            <h2 className="h4 fw-bold mb-1">Vị trí đang mở</h2>
            <p className="text-body-secondary mb-0 small">
              Chọn vị trí phù hợp và nộp CV trực tuyến chỉ trong vài phút.
            </p>
          </div>
          {!loading && !error && (
            <span className="badge rounded-pill bg-primary-subtle text-primary-emphasis">
              {campaigns.length} chiến dịch
            </span>
          )}
        </div>

        {loading && <Loading label="Đang tải chiến dịch…" />}
        <ErrorAlert message={error} />

        <div className="row g-4">
          {campaigns.map((campaign) => (
            <div className="col-md-6 col-xl-4" key={campaign.id}>
              <article className="card h-100 border-0 shadow-sm rounded-4">
                <div className="card-body d-flex flex-column p-4">
                  <div className="d-flex justify-content-between align-items-start gap-2 mb-2">
                    <h3 className="h5 fw-bold mb-0">{campaign.title}</h3>
                    <StatusBadge status={campaign.status} />
                  </div>
                  <p className="text-body-secondary small flex-grow-1">
                    {campaign.description || 'Xem chi tiết và nộp hồ sơ trực tuyến.'}
                  </p>
                  <div className="d-flex align-items-center justify-content-between gap-2 pt-2 border-top">
                    <span className="small text-body-secondary">
                      <i className="bi bi-calendar-event me-1" aria-hidden="true" />
                      Hạn nộp {formatDate(campaign.endDate)}
                    </span>
                    <Link to={`/apply/${campaign.slug}`} className="btn btn-sm btn-primary">
                      Ứng tuyển
                      <i className="bi bi-arrow-right ms-1" aria-hidden="true" />
                    </Link>
                  </div>
                </div>
              </article>
            </div>
          ))}
        </div>

        {!loading && campaigns.length === 0 && !error && (
          <div className="card border-0 shadow-sm rounded-4">
            <div className="card-body text-center py-5">
              <i className="bi bi-inbox display-5 text-body-tertiary" aria-hidden="true" />
              <p className="text-body-secondary mt-3 mb-0">Hiện chưa có vị trí nào đang mở.</p>
            </div>
          </div>
        )}
      </section>
    </main>
  );
}
