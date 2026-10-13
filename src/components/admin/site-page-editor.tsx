"use client";
import Link from "next/link";
import { useState } from "react";
import { useRouter } from "next/navigation";
import type { PageKey, PageContent } from "@/lib/site-pages";
export function SitePageEditor({ pageKey, initial, version, revisions }: {
  pageKey: PageKey; initial: PageContent; version: number;
  revisions: { id: string; version: number; action: string; date: string }[];
}) {
  const router = useRouter();
  const [content, setContent] = useState(initial), [busy, setBusy] = useState(false), [message, setMessage] = useState("");
  async function save(action: "SAVE" | "PUBLISH" | "RESTORE", revisionId?: string) {
    if (busy) return;
    setBusy(true); setMessage("");
    try {
      const response = await fetch(`/api/admin/pages/${pageKey}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(action === "RESTORE" ? { action, version, revisionId } : { action, version, content }) });
      const result = await response.json();
      setMessage(response.ok ? (action === "PUBLISH" ? "已發布，前台已更新。" : "草稿已儲存，公開版本不變。") : result.error?.message ?? "儲存失敗。");
      if (response.ok) router.refresh();
    } catch { setMessage("無法確認儲存結果，請先重新讀取後再試。"); }
    finally { setBusy(false); }
  }
  return <>
    <p className="demo-warning">內容皆為安全文字，不支援HTML。儲存草稿不影響公開版本；還原修訂也只建立草稿。示範聲明與法律資料提示保留。</p>
    <form className="member-form" onSubmit={(e) => { e.preventDefault(); void save("SAVE"); }}>
      <div><label htmlFor="page-title">頁面主標題</label><textarea id="page-title" required minLength={2} maxLength={160} rows={3} value={content.title} onChange={(e) => setContent({ ...content, title: e.target.value })} /></div>
      <div><label htmlFor="page-description">頁面介紹</label><textarea id="page-description" required minLength={2} maxLength={600} rows={3} value={content.description} onChange={(e) => setContent({ ...content, description: e.target.value })} /></div>
      {content.sections.map((s, i) => <fieldset className="contact-fieldset" key={s.id}><legend>{initial.sections[i].heading}</legend>
        <div><label htmlFor={`heading-${s.id}`}>章節標題：{s.id}</label><input id={`heading-${s.id}`} required minLength={2} maxLength={120} value={s.heading} onChange={(e) => setContent({ ...content, sections: content.sections.map((row, j) => j === i ? { ...row, heading: e.target.value } : row) })} /></div>
        <div><label htmlFor={`body-${s.id}`}>章節內容：{s.id}</label><textarea id={`body-${s.id}`} required minLength={2} maxLength={3000} rows={5} value={s.body} onChange={(e) => setContent({ ...content, sections: content.sections.map((row, j) => j === i ? { ...row, body: e.target.value } : row) })} /></div>
      </fieldset>)}
      <button className="button button-secondary" disabled={busy}>儲存草稿</button>
      <button type="button" className="button button-primary" disabled={busy} onClick={() => void save("PUBLISH")}>發布目前內容</button>
      <Link className="text-link" href={`/admin/pages/${pageKey}/preview`}>預覽已儲存草稿 ↗</Link>
      <p role="status">{message}</p>
    </form>
    <h3>最近10筆修訂</h3>
    {revisions.map((r) => <p key={r.id}>版本{r.version} · {r.action} · {r.date} <button className="button button-secondary" type="button" disabled={busy} onClick={() => void save("RESTORE", r.id)}>還原版本{r.version}為草稿</button></p>)}
  </>;
}
