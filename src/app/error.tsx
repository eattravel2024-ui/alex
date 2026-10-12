"use client";
export default function ErrorPage({ reset }: { reset: () => void }) {
  return (
    <div className="error-panel" role="alert">
      <h2>頁面暫時無法載入</h2>
      <p>請稍後再試。若問題持續，請等待網站管理者處理。</p>
      <button className="button button-primary" onClick={reset}>
        重新載入
      </button>
    </div>
  );
}
