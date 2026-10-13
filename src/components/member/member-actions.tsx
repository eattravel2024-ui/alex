"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
export function LogoutButton() {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  return (
    <>
      <button
        className="button button-secondary"
        disabled={busy}
        onClick={async () => {
          setBusy(true);
          try {
            const r = await fetch("/api/auth/sign-out", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: "{}",
            });
            if (!r.ok) {
              setMessage("登出失敗，請重試。");
              return;
            }
            router.push("/auth/login");
            router.refresh();
          } catch {
            setMessage("連線失敗，請重試。");
          } finally {
            setBusy(false);
          }
        }}
      >
        {busy ? "登出中…" : "登出"}
      </button>
      {message && <p role="alert">{message}</p>}
    </>
  );
}
export function SessionsList({
  sessions,
}: {
  sessions: { id: string; createdAt: string; expiresAt: string }[];
}) {
  const router = useRouter();
  const [message, setMessage] = useState("");
  return (
    <div className="sessions-list">
      <h2>有效登入工作階段</h2>
      <p>只顯示自己的登入記錄；不顯示 Session token。</p>
      {sessions.map((session) => (
        <div className="session-row" key={session.id}>
          <span>
            登入：
            {new Date(session.createdAt).toLocaleString("zh-TW", {
              timeZone: "Asia/Taipei",
            })}
          </span>
          <button
            className="button button-secondary"
            onClick={async () => {
              try {
                const r = await fetch("/api/member/sessions/" + session.id, {
                  method: "DELETE",
                });
                setMessage(r.ok ? "該登入已失效。" : "無法撤銷這筆登入。");
                router.refresh();
              } catch {
                setMessage("連線失敗，請重試。");
              }
            }}
          >
            撤銷登入
          </button>
        </div>
      ))}
      <p role="status">{message}</p>
    </div>
  );
}
