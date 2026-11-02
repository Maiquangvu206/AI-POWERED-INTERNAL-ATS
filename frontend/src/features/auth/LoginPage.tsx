import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api, setAccessToken } from '../../lib/api';

interface LoginResponse {
  accessToken: string;
  user: { id: number; email: string; fullName: string; role: 'ADMIN' | 'INTERVIEWER' };
}

export function LoginPage() {
  const navigate = useNavigate();
  const [email, setEmail] = useState('admin@demo.com');
  const [password, setPassword] = useState('Admin@123');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const submit = async (event: React.FormEvent) => {
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
    <main className="shell">
      <h1>Đăng nhập nội bộ</h1>
      <p className="subtitle">Dành cho Trưởng ban (ADMIN) và Giám khảo (INTERVIEWER).</p>

      <form className="card apply-form" onSubmit={submit}>
        <label className="field">
          <span>Email</span>
          <input
            type="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            required
          />
        </label>
        <label className="field">
          <span>Mật khẩu</span>
          <input
            type="password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            required
          />
        </label>
        {error && <p className="err small">{error}</p>}
        <button type="submit" disabled={loading}>
          {loading ? 'Đang đăng nhập…' : 'Đăng nhập'}
        </button>
      </form>
    </main>
  );
}
