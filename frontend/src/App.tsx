import { BrowserRouter, Route, Routes } from 'react-router-dom';
import { ApplyPage } from './features/public/ApplyPage';
import { TrackPage } from './features/public/TrackPage';
import { InterviewerRoundPage } from './features/interviewer/InterviewerRoundPage';
import { AdminRoundPage } from './features/admin/AdminRoundPage';

export function App(): React.JSX.Element {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/apply/:slug" element={<ApplyPage />} />
        <Route path="/track/:code" element={<TrackPage />} />
        <Route path="/interviewer/rounds/:roundId" element={<InterviewerRoundPage />} />
        <Route path="/admin/rounds/:roundId" element={<AdminRoundPage />} />
        <Route
          path="*"
          element={
            <div className="shell">
              <h1>404</h1>
            </div>
          }
        />
      </Routes>
    </BrowserRouter>
  );
}
