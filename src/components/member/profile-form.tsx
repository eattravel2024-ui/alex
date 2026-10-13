"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { profileSchema } from "@/lib/validation";
export function ProfileForm({
  name,
  phone,
  emailNotifications,
}: {
  name: string;
  phone: string;
  emailNotifications: boolean;
}) {
  const router = useRouter();
  const [message, setMessage] = useState(""),
    [busy, setBusy] = useState(false);
  return (
    <form
      className="member-form"
      onSubmit={async (e) => {
        e.preventDefault();
        setMessage("");
        const values = new FormData(e.currentTarget);
        const result = profileSchema.safeParse({
          name: values.get("name"),
          phone: values.get("phone"),
          emailNotifications: values.get("emailNotifications") === "on",
        });
        if (!result.success) {
          setMessage("請確認名稱與電話格式。");
          return;
        }
        setBusy(true);
        try {
          const r = await fetch("/api/me", {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(result.data),
          });
          setMessage(
            r.ok ? "個人資料已儲存。" : "資料未儲存，請重新登入或檢查欄位。",
          );
          if (r.ok) router.refresh();
        } catch {
          setMessage("連線失敗，資料未儲存。");
        } finally {
          setBusy(false);
        }
      }}
    >
      <div>
        <label htmlFor="profile-name">顯示名稱</label>
        <input
          id="profile-name"
          name="name"
          required
          minLength={2}
          maxLength={60}
          defaultValue={name}
        />
      </div>
      <div>
        <label htmlFor="profile-phone">聯絡電話（選填）</label>
        <input
          id="profile-phone"
          name="phone"
          type="tel"
          maxLength={30}
          defaultValue={phone}
        />
      </div>
      <label className="checkbox-row">
        <input
          type="checkbox"
          name="emailNotifications"
          defaultChecked={emailNotifications}
        />
        接收服務通知郵件（偏好設定；非電子報訂閱）
      </label>
      <button disabled={busy} className="button button-primary">
        {busy ? "儲存中…" : "儲存個人資料"}
      </button>
      <p role="status">{message}</p>
    </form>
  );
}
