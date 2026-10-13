"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { contactStatuses, contactUpdateSchema } from "@/lib/contact-validation";
export function ContactUpdateForm({ id, version, status }: { id: string; version: number; status: keyof typeof contactStatuses }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false), [message, setMessage] = useState("");
  return <form className="member-form" onSubmit={async (event) => {
    event.preventDefault();
    if (busy) return;
    const data = new FormData(event.currentTarget);
    const input = contactUpdateSchema.safeParse({ version, status: data.get("status"), assignment: data.get("assignment"), note: data.get("note") });
    if (!input.success) { setMessage("請填寫至少2字的處理說明。"); return; }
    setBusy(true); setMessage("");
    try {
      const response = await fetch(`/api/admin/contacts/${id}`, {
        method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(input.data),
      });
      const result = await response.json();
      setMessage(response.ok ? "處理紀錄已儲存。" : result.error?.message ?? "操作失敗。");
      if (response.ok || response.status === 409) router.refresh();
    } catch { setMessage("無法確認結果，請重新讀取訊息後再試。"); }
    finally { setBusy(false); }
  }}>
    <div><label htmlFor={`contact-status-${id}`}>處理狀態</label><select id={`contact-status-${id}`} name="status" defaultValue={status}>{Object.entries(contactStatuses).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></div>
    <div><label htmlFor={`contact-assignment-${id}`}>負責人操作</label><select id={`contact-assignment-${id}`} name="assignment"><option value="KEEP">維持目前負責人</option><option value="CLAIM">由我接手</option><option value="RELEASE">釋出我負責的訊息</option></select></div>
    <div><label htmlFor={`contact-note-${id}`}>內部處理說明</label><textarea id={`contact-note-${id}`} name="note" required minLength={2} maxLength={1000} rows={3} /></div>
    <p>處理說明僅供有權限的工作人員查看，不會寄送或顯示給提交者。</p>
    <button className="button button-primary" disabled={busy}>{busy ? "儲存中…" : "儲存處理紀錄"}</button>
    <p role="status">{message}</p>
  </form>;
}
