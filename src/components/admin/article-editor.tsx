"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  articleImages,
  articleInputSchema,
  articleStatuses,
  type ArticleInput,
} from "@/lib/article-validation";
function taipeiInput(iso: string | null) {
  if (!iso) return "";
  const parts = new Intl.DateTimeFormat("sv-SE", {
    timeZone: "Asia/Taipei",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(new Date(iso));
  return parts.replace(" ", "T");
}
export function ArticleEditor({
  initial,
  id,
  version,
}: {
  initial: ArticleInput;
  id?: string;
  version?: number;
}) {
  const [data, setData] = useState(initial),
    [message, setMessage] = useState(""),
    [busy, setBusy] = useState(false),
    [tags, setTags] = useState(initial.tags.join("、")),
    [schedule, setSchedule] = useState(taipeiInput(initial.publishAt));
  const router = useRouter();
  function set<K extends keyof ArticleInput>(key: K, value: ArticleInput[K]) {
    setData((old) => ({ ...old, [key]: value }));
  }
  function block(
    index: number,
    fields: Partial<ArticleInput["blocks"][number]>,
  ) {
    setData((old) => ({
      ...old,
      blocks: old.blocks.map((b, i) => (i === index ? { ...b, ...fields } : b)),
    }));
  }
  function move(index: number, direction: number) {
    setData((old) => {
      const blocks = [...old.blocks];
      [blocks[index], blocks[index + direction]] = [
        blocks[index + direction],
        blocks[index],
      ];
      return { ...old, blocks };
    });
  }
  return (
    <form
      className="member-form cms-editor"
      onSubmit={async (e) => {
        e.preventDefault();
        setMessage("");
        const input = articleInputSchema.safeParse({
          ...data,
          tags: tags
            .split(/[、,，]/)
            .map((t) => t.trim())
            .filter(Boolean),
          blocks: data.blocks.map((b) => ({
            ...b,
            paragraphs: b.paragraphs.filter((p) => p.trim()),
          })),
          publishAt:
            data.status === "SCHEDULED" && schedule
              ? `${schedule}:00+08:00`
              : data.publishAt,
        });
        if (!input.success) {
          setMessage(
            "請檢查欄位：" +
              input.error.issues
                .map((i) => i.message)
                .slice(0, 3)
                .join("；"),
          );
          return;
        }
        if (data.status === "SCHEDULED" && !schedule) {
          setMessage("請指定排程時間（台灣時間）。");
          return;
        }
        setBusy(true);
        try {
          const response = await fetch(
            id ? `/api/admin/articles/${id}` : "/api/admin/articles",
            {
              method: id ? "PATCH" : "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                ...input.data,
                ...(id ? { version } : {}),
              }),
            },
          );
          const result = await response.json();
          if (!response.ok) {
            setMessage(result.error?.message ?? "文章未儲存。");
            return;
          }
          router.push(`/admin/articles/${result.id}`);
          router.refresh();
          setMessage("文章已儲存。前台只顯示已發布或排程已到期的內容。");
        } catch {
          setMessage("連線失敗，請確認最新版本後再重試。");
        } finally {
          setBusy(false);
        }
      }}
    >
      <p className="demo-warning">
        所有文章保留開發示範標示。此編輯器儲存文字區塊，輸入的 HTML
        會顯示為文字；尚無富文字工具列或媒體上傳。
      </p>
      <fieldset disabled={busy}>
        <legend>基本資料</legend>
        <div className="cms-two-columns">
          <div>
            <label htmlFor="cms-kind">內容類型</label>
            <select
              id="cms-kind"
              value={data.kind}
              disabled={!!id}
              onChange={(e) =>
                set("kind", e.target.value as ArticleInput["kind"])
              }
            >
              <option value="knowledge">健康知識</option>
              <option value="news">最新消息</option>
            </select>
          </div>
          <div>
            <label htmlFor="cms-slug">網址識別碼（英文小寫與連字號）</label>
            <input
              id="cms-slug"
              value={data.slug}
              readOnly={!!id}
              required
              minLength={3}
              maxLength={100}
              pattern="[a-z0-9]+(-[a-z0-9]+)*"
              onChange={(e) => set("slug", e.target.value)}
            />
          </div>
        </div>
        {id && <p>內容類型與網址建立後固定，避免原有連結與收藏失效。</p>}
        <div>
          <label htmlFor="cms-title">文章標題</label>
          <input
            id="cms-title"
            value={data.title}
            required
            minLength={2}
            maxLength={120}
            onChange={(e) => set("title", e.target.value)}
          />
        </div>
        <div>
          <label htmlFor="cms-summary">文章摘要</label>
          <textarea
            id="cms-summary"
            value={data.summary}
            required
            minLength={5}
            maxLength={500}
            rows={3}
            onChange={(e) => set("summary", e.target.value)}
          />
        </div>
        <div className="cms-two-columns">
          <div>
            <label htmlFor="cms-category">分類</label>
            <input
              id="cms-category"
              value={data.category}
              required
              maxLength={40}
              onChange={(e) => set("category", e.target.value)}
            />
          </div>
          <div>
            <label htmlFor="cms-tags">標籤（以頓號分隔，最多 10 個）</label>
            <input
              id="cms-tags"
              value={tags}
              maxLength={420}
              onChange={(e) => setTags(e.target.value)}
            />
          </div>
        </div>
        <div>
          <label htmlFor="cms-author">作者署名</label>
          <input
            id="cms-author"
            value={data.author}
            required
            minLength={2}
            maxLength={60}
            onChange={(e) => set("author", e.target.value)}
          />
        </div>
        <div>
          <label htmlFor="cms-image">封面插畫</label>
          <select
            id="cms-image"
            value={data.image}
            onChange={(e) =>
              set("image", e.target.value as ArticleInput["image"])
            }
          >
            {articleImages.map((image, i) => (
              <option key={image} value={image}>
                {["日常生活", "均衡飲食", "心理照顧"][i]}
              </option>
            ))}
          </select>
        </div>
        <label className="checkbox-row">
          <input
            type="checkbox"
            checked={data.featured}
            onChange={(e) => set("featured", e.target.checked)}
          />
          精選文章
        </label>
        <div>
          <label htmlFor="cms-reviewed">
            審閱日期（選填；仍保留示範資訊聲明）
          </label>
          <input
            type="date"
            id="cms-reviewed"
            value={data.reviewedAt ?? ""}
            onChange={(e) => set("reviewedAt", e.target.value || null)}
          />
        </div>
      </fieldset>
      <fieldset disabled={busy}>
        <legend>文章內容</legend>
        <p>每個區塊包含小標題與段落；以空白行分隔段落，每段最多 2,000 字。</p>
        {data.blocks.map((b, index) => (
          <div className="cms-block" key={index}>
            <div className="cms-block-toolbar">
              <strong>區塊 {index + 1}</strong>
              <button
                type="button"
                disabled={index === 0}
                aria-label={`上移區塊 ${index + 1}`}
                onClick={() => move(index, -1)}
              >
                上移
              </button>
              <button
                type="button"
                disabled={index === data.blocks.length - 1}
                aria-label={`下移區塊 ${index + 1}`}
                onClick={() => move(index, 1)}
              >
                下移
              </button>
              <button
                type="button"
                disabled={data.blocks.length === 1}
                aria-label={`移除區塊 ${index + 1}`}
                onClick={() =>
                  set(
                    "blocks",
                    data.blocks.filter((_, i) => i !== index),
                  )
                }
              >
                移除
              </button>
            </div>
            <label htmlFor={`cms-heading-${index}`}>
              區塊 {index + 1} 標題
            </label>
            <input
              id={`cms-heading-${index}`}
              value={b.heading}
              required
              maxLength={120}
              onChange={(e) => block(index, { heading: e.target.value })}
            />
            <label htmlFor={`cms-paragraph-${index}`}>
              區塊 {index + 1} 段落
            </label>
            <textarea
              id={`cms-paragraph-${index}`}
              value={b.paragraphs.join("\n\n")}
              required
              rows={6}
              maxLength={20100}
              onChange={(e) =>
                block(index, { paragraphs: e.target.value.split(/\n\s*\n/) })
              }
            />
          </div>
        ))}
        <button
          type="button"
          className="button button-outline"
          disabled={data.blocks.length >= 20}
          onClick={() =>
            set("blocks", [...data.blocks, { heading: "", paragraphs: [""] }])
          }
        >
          新增區塊
        </button>
      </fieldset>
      <fieldset disabled={busy}>
        <legend>延伸閱讀來源</legend>
        {data.references.map((reference, index) => (
          <div key={index} className="cms-block">
            <label htmlFor={`cms-source-title-${index}`}>
              來源 {index + 1} 名稱
            </label>
            <input
              id={`cms-source-title-${index}`}
              required
              maxLength={120}
              value={reference.title}
              onChange={(e) =>
                set(
                  "references",
                  data.references.map((r, i) =>
                    i === index ? { ...r, title: e.target.value } : r,
                  ),
                )
              }
            />
            <label htmlFor={`cms-source-url-${index}`}>
              來源 {index + 1} HTTPS 網址
            </label>
            <input
              type="url"
              id={`cms-source-url-${index}`}
              required
              maxLength={2048}
              value={reference.url}
              onChange={(e) =>
                set(
                  "references",
                  data.references.map((r, i) =>
                    i === index ? { ...r, url: e.target.value } : r,
                  ),
                )
              }
            />
            <button
              type="button"
              className="text-link"
              onClick={() =>
                set(
                  "references",
                  data.references.filter((_, i) => i !== index),
                )
              }
            >
              移除來源 {index + 1}
            </button>
          </div>
        ))}
        <button
          type="button"
          className="button button-outline"
          disabled={data.references.length >= 20}
          onClick={() =>
            set("references", [...data.references, { title: "", url: "" }])
          }
        >
          新增來源
        </button>
      </fieldset>
      <fieldset disabled={busy}>
        <legend>發布設定</legend>
        <label htmlFor="cms-status">發布狀態</label>
        <select
          id="cms-status"
          value={data.status}
          onChange={(e) =>
            set("status", e.target.value as ArticleInput["status"])
          }
        >
          {Object.entries(articleStatuses).map(([status, label]) => (
            <option key={status} value={status}>
              {label}
            </option>
          ))}
        </select>
        {data.status === "SCHEDULED" && (
          <div>
            <label htmlFor="cms-schedule">排程時間（台灣時間）</label>
            <input
              type="datetime-local"
              id="cms-schedule"
              value={schedule}
              required
              onChange={(e) => setSchedule(e.target.value)}
            />
            <p>
              到期後由前台查詢即時顯示，不需要等待背景工作。若要保留已到期排程並修改文章，請改選「已發布」。
            </p>
          </div>
        )}
        <p>
          草稿與下架文章只在後台可見。已發布文章儲存後會立即更新前台；還原版本會先回到草稿。
        </p>
      </fieldset>
      <div className="actions">
        <button disabled={busy} className="button button-primary">
          {busy ? "儲存中…" : "儲存文章"}
        </button>
        {id && (
          <Link
            className="button button-outline"
            href={`/admin/articles/${id}/preview`}
          >
            預覽已儲存版本
          </Link>
        )}
      </div>
      <p role="status">{message}</p>
      <details className="cms-live-preview">
        <summary>預覽目前編輯內容（尚未儲存）</summary>
        <h2>{data.title || "文章標題"}</h2>
        <p>{data.summary}</p>
        {data.blocks.map((b, i) => (
          <section key={i}>
            <h3>{b.heading}</h3>
            {b.paragraphs.map((p, j) => (
              <p key={j}>{p}</p>
            ))}
          </section>
        ))}
      </details>
    </form>
  );
}
export function RestoreRevision({
  id,
  revisionId,
  version,
}: {
  id: string;
  revisionId: string;
  version: number;
}) {
  const router = useRouter(),
    [busy, setBusy] = useState(false),
    [message, setMessage] = useState("");
  return (
    <form
      onSubmit={async (e) => {
        e.preventDefault();
        setBusy(true);
        setMessage("");
        try {
          const response = await fetch(`/api/admin/articles/${id}/restore`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ revisionId, version }),
          });
          const result = await response.json();
          setMessage(
            response.ok
              ? "已還原為草稿。"
              : (result.error?.message ?? "還原失敗。"),
          );
          if (response.ok) router.refresh();
        } catch {
          setMessage("連線失敗，請重試。");
        } finally {
          setBusy(false);
        }
      }}
    >
      <label className="checkbox-row">
        <input type="checkbox" required />
        確認還原此版本為草稿，文章將從前台移除。
      </label>
      <button className="button button-outline" disabled={busy}>
        {busy ? "還原中…" : "還原為草稿"}
      </button>
      <p role="status">{message}</p>
    </form>
  );
}
