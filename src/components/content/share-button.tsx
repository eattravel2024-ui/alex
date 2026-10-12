"use client";
import { useState } from "react";
export function ShareButton() {
  const [message, setMessage] = useState("");
  return (
    <div className="share-control">
      <button
        type="button"
        className="button button-secondary"
        onClick={async () => {
          try {
            await navigator.clipboard.writeText(
              window.location.origin + window.location.pathname,
            );
            setMessage("文章連結已複製。");
          } catch {
            setMessage("無法複製連結，請從瀏覽器網址列手動複製。");
          }
        }}
      >
        複製分享連結 ↗
      </button>
      <p role="status" aria-live="polite">
        {message}
      </p>
    </div>
  );
}
