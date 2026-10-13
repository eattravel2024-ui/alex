"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
export function BookmarkControl({ slug }: { slug: string }) {
  const [state, setState] = useState<"loading" | "guest" | "ready" | "error">(
      "loading",
    ),
    [saved, setSaved] = useState(false),
    [busy, setBusy] = useState(false),
    [message, setMessage] = useState("");
  useEffect(() => {
    let active = true;
    fetch("/api/member/bookmarks?slug=" + encodeURIComponent(slug))
      .then(async (r) => {
        if (!active) return;
        if (r.status === 401) {
          setState("guest");
          return;
        }
        if (!r.ok) {
          setState("error");
          return;
        }
        const data = await r.json();
        if (active) {
          setSaved(data.saved);
          setState("ready");
        }
      })
      .catch(() => {
        if (active) setState("error");
      });
    return () => {
      active = false;
    };
  }, [slug]);
  if (state === "guest")
    return (
      <Link className="text-link" href="/auth/login">
        登入後收藏文章 ↗
      </Link>
    );
  if (state === "loading")
    return (
      <p className="field-help" role="status">
        載入收藏狀態…
      </p>
    );
  if (state === "error")
    return <p className="field-help">收藏服務暫時無法載入。</p>;
  return (
    <div className="bookmark-control">
      <button
        className="button button-secondary"
        disabled={busy}
        onClick={async () => {
          setBusy(true);
          try {
            const r = await fetch("/api/member/bookmarks", {
              method: saved ? "DELETE" : "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ slug }),
            });
            if (!r.ok) {
              setMessage("收藏未更新，請重新登入後重試。");
              return;
            }
            setSaved(!saved);
            setMessage(saved ? "已取消收藏。" : "文章已加入收藏。");
          } catch {
            setMessage("連線失敗，請重試。");
          } finally {
            setBusy(false);
          }
        }}
      >
        {busy ? "處理中…" : saved ? "取消收藏" : "收藏文章"}
      </button>
      <p role="status">{message}</p>
    </div>
  );
}
