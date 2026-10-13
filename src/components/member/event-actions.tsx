"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
export function EventAction({
  eventId,
  cancel = false,
  canAct = true,
  guest = false,
}: {
  eventId: string;
  cancel?: boolean;
  canAct?: boolean;
  guest?: boolean;
}) {
  const [busy, setBusy] = useState(false),
    [message, setMessage] = useState("");
  const router = useRouter();
  if (guest)
    return (
      <Link className="button button-primary" href="/auth/login">
        登入後查看報名资格
      </Link>
    );
  return (
    <form
      onSubmit={async (e) => {
        e.preventDefault();
        setBusy(true);
        setMessage("");
        try {
          const response = await fetch(`/api/events/${eventId}/registration`, {
            method: cancel ? "DELETE" : "POST",
          });
          const result = await response.json();
          setMessage(
            response.ok
              ? cancel
                ? "報名已取消。"
                : result.status === "WAITLISTED"
                  ? "已加入候補；遞補時會再次檢查資格。"
                  : "報名成功（開發示範）。"
              : (result.error?.message ?? "操作失敗。"),
          );
          if (response.ok) router.refresh();
        } catch {
          setMessage("連線失敗，請確認紀錄後再重試。");
        } finally {
          setBusy(false);
        }
      }}
    >
      {cancel && (
        <label className="checkbox-row">
          <input type="checkbox" required />
          確認取消此報名／候補，名額可能遞補給其他人。
        </label>
      )}
      <button className="button button-primary" disabled={busy || !canAct}>
        {busy ? "處理中…" : cancel ? "取消報名" : "報名此示範活動"}
      </button>
      <p role="status">{message}</p>
    </form>
  );
}
export function CheckInButton({
  eventId,
  registrationId,
}: {
  eventId: string;
  registrationId: string;
}) {
  const [busy, setBusy] = useState(false),
    [message, setMessage] = useState("");
  const router = useRouter();
  return (
    <form
      onSubmit={async (e) => {
        e.preventDefault();
        setBusy(true);
        try {
          const r = await fetch(`/api/admin/events/${eventId}/check-in`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ registrationId }),
          });
          const result = await r.json();
          setMessage(
            r.ok ? "報到已記錄。" : (result.error?.message ?? "報到失敗。"),
          );
          if (r.ok) router.refresh();
        } catch {
          setMessage("連線失敗。");
        } finally {
          setBusy(false);
        }
      }}
    >
      <label className="checkbox-row">
        <input type="checkbox" required />
        已確認參加者身分
      </label>
      <button className="button button-outline" disabled={busy}>
        {busy ? "處理中…" : "記錄報到"}
      </button>
      <p role="status">{message}</p>
    </form>
  );
}
