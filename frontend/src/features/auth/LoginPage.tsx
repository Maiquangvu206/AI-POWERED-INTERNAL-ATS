import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ErrorAlert } from '../../components/ui';
import { api, setAccessToken } from '../../lib/api';

interface LoginResponse {
  accessToken: string;
  user: { id: number; email: string; fullName: string; role: 'ADMIN' | 'INTERVIEWER' };
}

export function LoginPage() {
  const navigate = useNavigate();
  const [email, setEmail] = useState('admin@demo.com');
  const [password, setPassword] = useState('Admin@123');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const submit = async (event: React.FormEvent): Promise<void> => {
    event.preventDefault();
    setLoading(true);
    setError('');
    try {
      const result = await api<LoginResponse>('/auth/login', {
        method: 'POST',
        body: JSON.stringify({ email, password }),
      });
      setAccessToken(result.accessToken);
      navigate(result.user.role === 'ADMIN' ? '/admin' : '/', { replace: true });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Đăng nhập thất bại');
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="container-xl py-5">
      <div className="row justify-content-center">
        <div className="col-md-8 col-lg-5">
          <div className="text-center mb-4">
            <span className="brand-mark brand-mark-lg mx-auto mb-3" aria-hidden="true">
              <i className="bi bi-stars" />
            </span>
            <h1 className="h3 fw-bold mb-1">Đăng nhập nội bộ</h1>
            <p className="text-body-secondary mb-0">Dành cho Trưởng ban tuyển dụng và Giám khảo.</p>
          </div>

          <div className="card border-0 shadow-sm rounded-4">
            <div className="card-body p-4 p-md-5">
              <ErrorAlert message={error} />

              <form onSubmit={submit} noValidate>
                <div className="mb-3">
                  <label className="form-label" htmlFor="email">
                    Email
                  </label>
                  <div className="input-group">
                    <span className="input-group-text bg-white">
                      <i className="bi bi-envelope" aria-hidden="true" />
                    </span>
                    <input
                      id="email"
                      type="email"
                      className="form-control"
                      value={email}
                      onChange={(event) => setEmail(event.target.value)}
                      autoComplete="username"
                      required
                    />
                  </div>
                </div>

                <div className="mb-3">
                  <label className="form-label" htmlFor="password">
                    Mật khẩu
                  </label>
                  <div className="input-group">
                    <span className="input-group-text bg-white">
                      <i className="bi bi-lock" aria-hidden="true" />
                    </span>
                    <input
                      id="password"
                      type={showPassword ? 'text' : 'password'}
                      className="form-control"
                      value={password}
                      onChange={(event) => setPassword(event.target.value)}
                      autoComplete="current-password"
                      required
                    />
                    <button
                      type="button"
                      className="btn btn-outline-secondary"
                      onClick={() => setShowPassword((value) => !value)}
                      aria-label={showPassword ? 'Ẩn mật khẩu' : 'Hiện mật khẩu'}
                    >
                      <i
                        className={`bi ${showPassword ? 'bi-eye-slash' : 'bi-eye'}`}
                        aria-hidden="true"
                      />
                    </button>
                  </div>
                </div>

                <button type="submit" className="btn btn-primary w-100 btn-lg" disabled={loading}>
                  {loading ? (
                    <>
                      <span className="spinner-border spinner-border-sm me-2" aria-hidden="true" />
                      Đang đăng nhập…
                    </>
                  ) : (
                    <>
                      Đăng nhập
                      <i className="bi bi-arrow-right ms-1" aria-hidden="true" />
                    </>
                  )}
                </button>
              </form>

              <hr className="my-4" />

              <div className="small text-body-secondary">
                <div className="fw-semibold text-body mb-1">
                  <i className="bi bi-info-circle me-1" aria-hidden="true" />
                  Tài khoản demo
                </div>
                <div className="d-flex flex-column gap-1">
                  <span>
                    Admin: <code>admin@demo.com</code> / <code>Admin@123</code>
                  </span>
                  <span>
                    Giám khảo: <code>reviewer1@demo.com</code> / <code>Review@123</code>
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}
