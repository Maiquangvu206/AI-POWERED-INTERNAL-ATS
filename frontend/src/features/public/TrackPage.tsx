import { useParams } from 'react-router-dom';

export function TrackPage() {
  const { code } = useParams();

  return (
    <div className="shell">
      <h1>Tra cứu hồ sơ</h1>
      <div className="card">
        <p>
          Mã: <strong>{code}</strong>
        </p>
        <p>
          Trạng thái: <strong>Đang sàng lọc (Screening)</strong>
        </p>
        <p>Cập nhật lần cuối: 29/10/2026</p>
      </div>
    </div>
  );
}
