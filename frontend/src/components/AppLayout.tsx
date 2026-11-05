import { useEffect, useState } from 'react';
import { NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { getAccessToken, setAccessToken, AUTH_CHANGED_EVENT } from '../lib/api';

const navLinkClass = ({ isActive }: { isActive: boolean }): string =>
  `nav-link px-2${isActive ? ' active fw-semibold' : ''}`;

export function AppLayout(): React.JSX.Element {
  const navigate = useNavigate();
  const location = useLocation();
  const [authed, setAuthed] = useState(() => Boolean(getAccessToken()));
  const [menuOpen, setMenuOpen] = useState(false);

  useEffect(() => {
    setAuthed(Boolean(getAccessToken()));
    setMenuOpen(false);
  }, [location.pathname]);

  useEffect(() => {
    const sync = (): void => setAuthed(Boolean(getAccessToken()));
    window.addEventListener(AUTH_CHANGED_EVENT, sync);
    return () => window.removeEventListener(AUTH_CHANGED_EVENT, sync);
  }, []);

  const logout = (): void => {
    setAccessToken(null);
    setAuthed(false);
    navigate('/', { replace: true });
  };

  return (
    <div className="d-flex flex-column min-vh-100">
      <nav className="navbar navbar-expand-lg bg-white border-bottom sticky-top">
        <div className="container-xl">
          <NavLink className="navbar-brand d-flex align-items-center gap-2" to="/">
            <span className="brand-mark" aria-hidden="true">
              <i className="bi bi-stars" />
            </span>
            <span className="fw-bold">
              ATS<span className="text-primary"> AI</span>
            </span>
          </NavLink>

          <button
            className="navbar-toggler border-0"
            type="button"
            aria-controls="main-nav"
            aria-expanded={menuOpen}
            aria-label="Mở menu điều hướng"
            onClick={() => setMenuOpen((open) => !open)}
          >
            <span className="navbar-toggler-icon" />
          </button>

          <div className={`collapse navbar-collapse${menuOpen ? ' show' : ''}`} id="main-nav">
            <ul className="navbar-nav me-auto mb-2 mb-lg-0">
              <li className="nav-item">
                <NavLink to="/" end className={navLinkClass}>
                  <i className="bi bi-house-door me-1" aria-hidden="true" />
                  Trang chủ
                </NavLink>
              </li>
              <li className="nav-item">
                <NavLink to="/track" className={navLinkClass}>
                  <i className="bi bi-search me-1" aria-hidden="true" />
                  Tra cứu hồ sơ
                </NavLink>
              </li>
              {authed && (
                <li className="nav-item">
                  <NavLink to="/admin" className={navLinkClass}>
                    <i className="bi bi-speedometer2 me-1" aria-hidden="true" />
                    Quản trị
                  </NavLink>
                </li>
              )}
            </ul>

            <div className="d-flex align-items-center gap-2 pb-2 pb-lg-0">
              {authed ? (
                <button type="button" className="btn btn-outline-secondary btn-sm" onClick={logout}>
                  <i className="bi bi-box-arrow-right me-1" aria-hidden="true" />
                  Đăng xuất
                </button>
              ) : (
                <NavLink to="/login" className="btn btn-primary btn-sm">
                  <i className="bi bi-person-lock me-1" aria-hidden="true" />
                  Đăng nhập nội bộ
                </NavLink>
              )}
            </div>
          </div>
        </div>
      </nav>

      <div className="flex-grow-1">
        <Outlet />
      </div>

      <footer className="border-top bg-white py-3 mt-auto">
        <div className="container-xl d-flex flex-wrap justify-content-between gap-2 small text-body-secondary">
          <span>© {new Date().getFullYear()} AI-Powered Internal ATS</span>
          <span>Hệ thống tuyển dụng nội bộ · Dữ liệu cá nhân bảo vệ theo NĐ 13/2023</span>
        </div>
      </footer>
    </div>
  );
}
