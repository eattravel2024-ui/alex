"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { applicationSchema } from "@/lib/validation";
export function ApplicationForm({
  types,
  canSubmit,
}: {
  types: { id: string; name: string; description: string }[];
  canSubmit: boolean;
}) {
  const router = useRouter();
  const [message, setMessage] = useState(""),
    [busy, setBusy] = useState(false);
  if (!canSubmit)
    return (
      <p className="demo-warning">
        目前已有會員资格或待審核申請，不能重複送出。
      </p>
    );
  return (
    <form
      className="member-form"
      onSubmit={async (e) => {
        e.preventDefault();
        setMessage("");
        const form = new FormData(e.currentTarget);
        const result = applicationSchema.safeParse({
          typeId: form.get("typeId"),
          motivation: form.get("motivation"),
        });
        if (!result.success) {
          setMessage(result.error.issues[0].message);
          return;
        }
        setBusy(true);
        try {
          const r = await fetch("/api/membership/applications", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(result.data),
          });
          setMessage(
            r.ok
              ? "申請已送出，等待審核。"
              : "無法送出，請確認是否已有待審核申請。",
          );
          if (r.ok) router.refresh();
        } catch {
          setMessage("連線失敗，申請尚未送出。");
        } finally {
          setBusy(false);
        }
      }}
    >
      <p className="demo-warning">
        此為開發測試流程，示範申請與核准不授予協會正式會員資格。
      </p>
      <div>
        <label htmlFor="membership-type">示範會員類別</label>
        <select id="membership-type" name="typeId" required>
          {types.map((type) => (
            <option key={type.id} value={type.id}>
              {type.name}
            </option>
          ))}
        </select>
      </div>
      <div>
        <label htmlFor="membership-motivation">申請說明</label>
        <textarea
          id="membership-motivation"
          name="motivation"
          required
          minLength={10}
          maxLength={1000}
          rows={5}
        />
      </div>
      <p className="field-help">至少 10 字；請勿填寫身分證字號或醫療資料。</p>
      <button
        className="button button-primary"
        disabled={busy || !types.length}
      >
        {busy ? "送出中…" : "送出示範申請"}
      </button>
      <p role="status">{message}</p>
    </form>
  );
}
