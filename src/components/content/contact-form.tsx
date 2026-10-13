"use client";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { contactSchema, contactTopics } from "@/lib/contact-validation";

export function ContactForm({ enabled }: { enabled: boolean }) {
  const submissionId = useRef<string | null>(null);
  const statusRef = useRef<HTMLParagraphElement>(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  useEffect(() => {
    if (message) {
      statusRef.current?.focus({ preventScroll: true });
      statusRef.current?.scrollIntoView({ block: "center", behavior: "auto" });
    }
  }, [message]);
  if (!enabled) return <div className="contact-card">
    <h2>示範聯絡表單尚未開放</h2>
    <p>訊息儲存與後台處理已完成；本站目前未啟用提交。正式聯絡窗口仍待確認。</p>
  </div>;
  return <div className="contact-card">
    <h2>示範聯絡表單</h2>
    <p>僅供操作測試。請使用虛構姓名與 @example.test 信箱，不要填寫真實個資、醫療資料或密碼。訊息存入示範資料庫供工作人員查看，不寄送郵件，也不是正式聯絡管道。</p>
    <form className="member-form" noValidate onSubmit={async (event) => {
      event.preventDefault();
      if (busy) return;
      const form = event.currentTarget;
      const data = new FormData(form);
      try {
        if (!submissionId.current) {
          if (typeof crypto.randomUUID === "function") {
            submissionId.current = crypto.randomUUID();
          } else {
            const bytes = crypto.getRandomValues(new Uint8Array(16));
            bytes[6] = (bytes[6] & 15) | 64;
            bytes[8] = (bytes[8] & 63) | 128;
            const hex = Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
            submissionId.current = `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
          }
        }
      } catch {
        setMessage("瀏覽器無法建立安全收件編號。請使用新版瀏覽器，並從 https://test.cchm.tw/contact 開啟表單。");
        return;
      }
      const input = contactSchema.safeParse({
        submissionId: submissionId.current,
        name: data.get("name"), email: data.get("email"),
        topic: data.get("topic"), subject: data.get("subject"),
        message: data.get("message"), consent: data.get("consent") === "on",
        website: data.get("website") ?? "",
      });
      if (!input.success) {
        const instructions: Record<string, string> = {
          name: "示範姓名需2至60字",
          email: "示範電子郵件需使用 @example.test 虛構信箱",
          topic: "請選擇詢問類型",
          subject: "主旨需2至120字",
          message: "訊息內容需10至1500字",
          consent: "請勾選示範資料告知",
          website: "請清空隱藏網站欄位；可重新整理後重試",
        };
        const errors = [...new Set(input.error.issues.map((issue) => instructions[String(issue.path[0])] ?? "請重新整理頁面後再試"))];
        setMessage(`尚未送出。請確認：${errors.join("；")}。`);
        return;
      }
      setBusy(true); setMessage("");
      try {
        const response = await fetch("/api/contact", {
          method: "POST", headers: { "Content-Type": "application/json" },
          body: JSON.stringify(input.data),
        });
        const result = await response.json();
        if (response.ok) {
          setMessage(`示範訊息已儲存。收件編號：${result.reference}。不會寄送通知郵件。`);
          form.reset(); submissionId.current = null;
        } else {
          setMessage(result.error?.message ?? "提交失敗，請稍後再試。");
          if (response.status === 409) submissionId.current = null;
        }
      } catch {
        setMessage("無法確認提交結果。請保留相同內容再試，系統會避免重複建立訊息。");
      } finally { setBusy(false); }
    }}>
      <fieldset disabled={busy} className="contact-fieldset">
        <div><label htmlFor="contact-name">示範姓名</label><input id="contact-name" name="name" required minLength={2} maxLength={60} autoComplete="off" /></div>
        <div><label htmlFor="contact-email">示範電子郵件</label><input id="contact-email" name="email" type="email" required maxLength={254} placeholder="visitor@example.test" autoComplete="off" /></div>
        <div><label htmlFor="contact-topic">詢問類型</label><select id="contact-topic" name="topic">{Object.entries(contactTopics).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></div>
        <div><label htmlFor="contact-subject">主旨</label><input id="contact-subject" name="subject" required minLength={2} maxLength={120} /></div>
        <div><label htmlFor="contact-message">訊息內容</label><textarea id="contact-message" name="message" required minLength={10} maxLength={1500} rows={6} /></div>
        <div hidden aria-hidden="true"><label htmlFor="contact-website">Website</label><input id="contact-website" name="website" tabIndex={-1} autoComplete="off" /></div>
        <label><input type="checkbox" name="consent" required /> 我了解這是示範資料儲存，僅提供虛構內容，並同意供工作人員測試處理。</label>
        <Link className="text-link" href="/privacy">閱讀示範資料告知 ↗</Link>
        <button className="button button-primary" disabled={busy}>{busy ? "提交中…" : "送出示範訊息"}</button>
      </fieldset>
      <p ref={statusRef} role="status" aria-live="polite" tabIndex={-1}>{message}</p>
    </form>
  </div>;
}
