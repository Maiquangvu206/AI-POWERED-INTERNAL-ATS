import { BrowserRouter, Route, Routes } from 'react-router-dom';
import { AdminAuditPage } from './features/admin/AdminAuditPage';
import { AdminCampaignPage } from './features/admin/AdminCampaignPage';
import { AdminHomePage } from './features/admin/AdminHomePage';
import { AdminRoundPage } from './features/admin/AdminRoundPage';
import { LoginPage } from './features/auth/LoginPage';
import { InterviewerRoundPage } from './features/interviewer/InterviewerRoundPage';
import { ApplyPage } from './features/public/ApplyPage';
import { HomePage } from './features/public/HomePage';
import { TrackPage } from './features/public/TrackPage';

export function App(): React.JSX.Element {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<HomePage />} />
        <Route path="/login" element={<LoginPage />} />
        <Route path="/apply/:slug" element={<ApplyPage />} />
        <Route path="/track" element={<TrackPage />} />
        <Route path="/track/:code" element={<TrackPage />} />
        <Route path="/interviewer/rounds/:roundId" element={<InterviewerRoundPage />} />
        <Route path="/admin" element={<AdminHomePage />} />
        <Route path="/admin/campaigns/:campaignId" element={<AdminCampaignPage />} />
        <Route path="/admin/rounds/:roundId" element={<AdminRoundPage />} />
        <Route path="/admin/audit-logs" element={<AdminAuditPage />} />
        <Route
          path="*"
          element={
            <div className="shell">
              <h1>404</h1>
              <a href="/">Về trang chủ</a>
            </div>
          }
        />
      </Routes>
    </BrowserRouter>
  );
}
