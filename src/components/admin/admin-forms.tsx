"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { reviewSchema } from "@/lib/validation";
function useMutation() {
  const router = useRouter();
  const [message, setMessage] = useState(""),
    [busy, setBusy] = useState(false);
  async function submit(url: string, data: unknown) {
    setBusy(true);
    setMessage("");
    try {
      const response = await fetch(url, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      const result = await response.json();
      setMessage(
        response.ok ? "操作已儲存。" : (result.error?.message ?? "操作失敗。"),
      );
      if (response.ok || response.status === 409) router.refresh();
    } catch {
      setMessage("連線失敗，請確認狀態後重試。");
    } finally {
      setBusy(false);
    }
  }
  return { message, busy, submit, setMessage };
}
export function ReviewForm({ id, version }: { id: string; version: number }) {
  const { message, busy, submit, setMessage } = useMutation();
  const [status, setStatus] = useState("RETURNED");
  return (
    <form
      className="member-form"
      onSubmit={async (e) => {
        e.preventDefault();
        const form = new FormData(e.currentTarget);
        // A date is interpreted explicitly as end-of-day in Taiwan, never in the browser's local timezone.
        const date = form.get("validUntil");
        const parsed = reviewSchema.safeParse({
          status,
          note: form.get("note"),
          version,
          ...(status === "APPROVED" && date
            ? { validUntil: `${date}T23:59:59+08:00` }
            : {}),
        });
        if (!parsed.success || (status === "APPROVED" && !date)) {
          setMessage("請填寫審核說明；核准時必須指定有效期限。");
          return;
        }
        await submit(`/api/admin/membership/applications/${id}`, parsed.data);
      }}
    >
      <div>
        <label htmlFor={`decision-${id}`}>審核結果</label>
        <select
          id={`decision-${id}`}
          value={status}
          onChange={(e) => setStatus(e.target.value)}
        >
          <option value="RETURNED">退回補件</option>
          <option value="APPROVED">核准</option>
          <option value="REJECTED">拒絕</option>
        </select>
      </div>
      {status === "APPROVED" && (
        <div>
          <label htmlFor={`expiry-${id}`}>有效期限（台灣時間）</label>
          <input id={`expiry-${id}`} name="validUntil" type="date" required />
        </div>
      )}
      <div>
        <label htmlFor={`note-${id}`}>審核說明（會員可查看）</label>
        <textarea
          id={`note-${id}`}
          name="note"
          required
          minLength={2}
          maxLength={500}
          rows={3}
        />
      </div>
      <p className="section-description">
        送出後會更新申請歷程與站內通知；操作會留下稽核紀錄。
      </p>
      <button disabled={busy} className="button button-primary">
        {busy ? "處理中…" : "送出審核"}
      </button>
      <p role="status">{message}</p>
    </form>
  );
}
export function MemberStateForm({
  id,
  disabled,
}: {
  id: string;
  disabled: boolean;
}) {
  const { message, busy, submit } = useMutation();
  return (
    <form
      className="member-form"
      onSubmit={async (e) => {
        e.preventDefault();
        const form = new FormData(e.currentTarget);
        await submit(`/api/admin/members/${id}`, {
          disabled: !disabled,
          expectedDisabled: disabled,
          note: form.get("note"),
        });
      }}
    >
      <label htmlFor={`state-note-${id}`}>操作原因（會員可查看）</label>
      <input
        id={`state-note-${id}`}
        name="note"
        required
        minLength={2}
        maxLength={500}
      />
      <label className="checkbox-row">
        <input type="checkbox" required />
        確認{disabled ? "恢復" : "停用"}
        帳號並撤銷所有登入；會員資格不會因此變更。
      </label>
      <button disabled={busy} className="button button-primary">
        {busy ? "處理中…" : disabled ? "恢復帳號" : "停用帳號"}
      </button>
      <p role="status">{message}</p>
    </form>
  );
}
