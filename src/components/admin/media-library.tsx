"use client";

import Image from "next/image";
import { useCallback, useEffect, useId, useRef, useState } from "react";
import type { MediaItem, MediaList } from "@/lib/media-validation";

export type { MediaItem, MediaList } from "@/lib/media-validation";

const maximumImageBytes = 5 * 1024 * 1024;
const imageTypes = new Set(["image/jpeg", "image/png", "image/webp"]);

async function responseData<T>(response: Response, fallback: string): Promise<T> {
  const result = await response.json().catch(() => {
    throw new Error(fallback);
  });
  if (!response.ok) throw new Error(result.error?.message ?? fallback);
  return result as T;
}

function errorMessage(error: unknown, fallback: string) {
  return error instanceof Error && !(error instanceof TypeError)
    ? error.message
    : fallback;
}

export function MediaUpload({
  onUploaded,
}: {
  onUploaded: (item: MediaItem) => void;
}) {
  const inputId = useId();
  const fileInput = useRef<HTMLInputElement>(null);
  const submitting = useRef(false);
  const [altText, setAltText] = useState("");
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState("");

  async function upload() {
    if (submitting.current) return;
    // File inputs are uncontrolled. Preserve files selected before hydration.
    const file = fileInput.current?.files?.[0];
    setMessage("");
    if (!file) {
      setMessage("請選擇圖片檔案。");
      fileInput.current?.focus();
      return;
    }
    if (!imageTypes.has(file.type)) {
      setMessage("只接受 JPG、PNG 或 WebP 圖片。");
      return;
    }
    if (file.size > maximumImageBytes) {
      setMessage("圖片檔案不可超過 5MB。");
      return;
    }
    if (!altText.trim() || altText.trim().length > 160) {
      setMessage("請填寫圖片替代文字，最多 160 字。");
      return;
    }
    submitting.current = true;
    setPending(true);
    try {
      const body = new FormData();
      body.set("file", file);
      body.set("altText", altText.trim());
      const response = await fetch("/api/admin/media", {
        method: "POST",
        body,
      });
      const item = await responseData<MediaItem>(response, "圖片未上傳。");
      setAltText("");
      if (fileInput.current) fileInput.current.value = "";
      setMessage("圖片已上傳。");
      onUploaded(item);
    } catch (error) {
      setMessage(errorMessage(error, "連線失敗，請重試上傳。"));
    } finally {
      submitting.current = false;
      setPending(false);
    }
  }

  return (
    <section className="media-upload" aria-label="上傳媒體圖片">
      <h3>上傳圖片</h3>
      <p>接受 JPG、PNG、WebP，檔案上限 5MB。請勿上傳包含個人資料的圖片。</p>
      <fieldset disabled={pending}>
        <legend>圖片與替代文字</legend>
        <div>
          <label htmlFor={`${inputId}-file`}>圖片檔案</label>
          <input
            ref={fileInput}
            id={`${inputId}-file`}
            type="file"
            accept="image/jpeg,image/png,image/webp,.jpg,.jpeg,.png,.webp"
            aria-required="true"
            onChange={() => setMessage("")}
          />
        </div>
        <div>
          <label htmlFor={`${inputId}-alt`}>圖片替代文字</label>
          <input
            id={`${inputId}-alt`}
            value={altText}
            maxLength={160}
            aria-required="true"
            onChange={(event) => {
              setAltText(event.target.value);
              setMessage("");
            }}
            onKeyDown={(event) => {
              if (event.key === "Enter") {
                event.preventDefault();
                void upload();
              }
            }}
          />
        </div>
        <button
          type="button"
          className="button button-primary"
          disabled={pending}
          onClick={() => void upload()}
        >
          {pending ? "上傳中…" : "上傳圖片"}
        </button>
      </fieldset>
      <p className="media-message" role="status" aria-live="polite">
        {pending ? "圖片上傳中…" : message}
      </p>
    </section>
  );
}

function MediaCard({
  item,
  disabled,
  onSelect,
  onSaved,
  onDeleted,
  onConflict,
}: {
  item: MediaItem;
  disabled: boolean;
  onSelect?: (item: MediaItem) => void;
  onSaved: (item: MediaItem) => void;
  onDeleted: (item: MediaItem) => void;
  onConflict: () => void;
}) {
  const [edit, setEdit] = useState<{ value: string; version: number } | null>(null);
  const [confirmed, setConfirmed] = useState(false);
  const [pending, setPending] = useState<"save" | "delete" | null>(null);
  const [message, setMessage] = useState("");
  const submitting = useRef(false);
  const altText = edit?.version === item.version ? edit.value : item.altText;

  async function mutate(action: "save" | "delete") {
    if (submitting.current || disabled || (action === "delete" && !confirmed))
      return;
    setMessage("");
    if (action === "save" && (!altText.trim() || altText.trim().length > 160)) {
      setMessage("請填寫圖片替代文字，最多 160 字。");
      return;
    }
    submitting.current = true;
    setPending(action);
    try {
      const response = await fetch(`/api/admin/media/${item.id}`, {
        method: action === "save" ? "PATCH" : "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          version: item.version,
          ...(action === "save" ? { altText: altText.trim() } : {}),
        }),
      });
      if (!response.ok && response.status === 409) onConflict();
      if (action === "save") {
        const updated = await responseData<MediaItem>(response, "替代文字未儲存。");
        setEdit(null);
        setMessage("圖片替代文字已儲存。");
        onSaved(updated);
      } else {
        await responseData<{ deleted: true }>(response, "圖片未刪除。");
        onDeleted(item);
      }
    } catch (error) {
      setMessage(errorMessage(error, "連線失敗，請確認圖片狀態後再重試。"));
    } finally {
      submitting.current = false;
      setPending(null);
    }
  }

  return (
    <article className="media-card" aria-label={item.altText}>
      <Image
        src={item.url}
        alt={item.altText}
        width={item.width}
        height={item.height}
        unoptimized
      />
      <p>{item.altText}</p>
      <p>
        {item.width} × {item.height} · {Math.ceil(item.byteSize / 1024)} KB ·{" "}
        {new Date(item.createdAt).toLocaleDateString("zh-TW", {
          timeZone: "Asia/Taipei",
        })}
      </p>
      {onSelect ? (
        <button
          type="button"
          className="button button-outline"
          disabled={disabled}
          onClick={() => onSelect(item)}
        >
          使用此圖片
        </button>
      ) : (
        <fieldset disabled={disabled || pending !== null}>
          <legend>圖片管理</legend>
          <label htmlFor={`media-alt-${item.id}`}>編輯圖片替代文字</label>
          <input
            id={`media-alt-${item.id}`}
            value={altText}
            maxLength={160}
            onChange={(event) => {
              setEdit({ value: event.target.value, version: item.version });
              setMessage("");
            }}
            onKeyDown={(event) => {
              if (event.key === "Enter") {
                event.preventDefault();
                void mutate("save");
              }
            }}
          />
          <div className="media-actions">
            <button
              type="button"
              className="button button-outline"
              disabled={disabled || pending !== null}
              onClick={() => void mutate("save")}
            >
              {pending === "save" ? "儲存中…" : "儲存替代文字"}
            </button>
          </div>
          {item.used ? (
            <p>文章或歷史版本使用中，無法刪除。</p>
          ) : (
            <div className="media-actions">
              <label className="checkbox-row">
                <input
                  type="checkbox"
                  checked={confirmed}
                  onChange={(event) => setConfirmed(event.target.checked)}
                />
                確認刪除此圖片
              </label>
              <button
                type="button"
                className="button button-outline"
                disabled={!confirmed || disabled || pending !== null}
                onClick={() => void mutate("delete")}
              >
                {pending === "delete" ? "刪除中…" : "刪除圖片"}
              </button>
            </div>
          )}
        </fieldset>
      )}
      <p className="media-message" role="status" aria-live="polite">
        {message}
      </p>
    </article>
  );
}

export function MediaBrowser({
  initial,
  onSelect,
}: {
  initial?: MediaList;
  onSelect?: (item: MediaItem) => void;
}) {
  const inputId = useId();
  const [list, setList] = useState<MediaList | null>(initial ?? null);
  const [search, setSearch] = useState("");
  const [activeQuery, setActiveQuery] = useState("");
  const [loading, setLoading] = useState(!initial);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const controller = useRef<AbortController | null>(null);
  const requestNumber = useRef(0);
  const requestTarget = useRef({ page: initial?.page ?? 1, query: "" });

  const fetchList = useCallback(async (
    page: number,
    query: string,
    number: number,
    abort: AbortController,
  ) => {
    try {
      const params = new URLSearchParams({ q: query, page: String(page) });
      const response = await fetch(`/api/admin/media?${params}`, {
        signal: abort.signal,
        cache: "no-store",
      });
      const result = await responseData<MediaList>(response, "圖片清單未載入。");
      if (number !== requestNumber.current || abort.signal.aborted) return;
      setList(result);
      setActiveQuery(query);
    } catch (failure) {
      if (number !== requestNumber.current || abort.signal.aborted) return;
      setError(errorMessage(failure, "連線失敗，請重試載入圖片。"));
    } finally {
      if (number === requestNumber.current && !abort.signal.aborted)
        setLoading(false);
    }
  }, []);

  const load = useCallback((page: number, query: string) => {
    const number = ++requestNumber.current;
    controller.current?.abort();
    const abort = new AbortController();
    controller.current = abort;
    requestTarget.current = { page, query };
    setLoading(true);
    setError("");
    return fetchList(page, query, number, abort);
  }, [fetchList]);

  useEffect(() => {
    if (!initial) {
      const number = ++requestNumber.current;
      const abort = new AbortController();
      controller.current = abort;
      void fetchList(1, "", number, abort);
    }
    return () => controller.current?.abort();
  }, [initial, fetchList]);

  function refresh() {
    void load(list?.page ?? 1, activeQuery);
  }

  function searchImages() {
    setMessage("");
    void load(1, search.trim());
  }

  return (
    <div className="media-library">
      <MediaUpload
        onUploaded={(item) => {
          if (onSelect) {
            onSelect(item);
            return;
          }
          setSearch("");
          setMessage("");
          void load(1, "");
        }}
      />
      <div className="media-actions">
        <div>
          <label htmlFor={`${inputId}-search`}>搜尋圖片替代文字</label>
          <input
            id={`${inputId}-search`}
            type="search"
            value={search}
            maxLength={160}
            disabled={loading}
            onChange={(event) => setSearch(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter") {
                event.preventDefault();
                searchImages();
              }
            }}
          />
        </div>
        <button
          type="button"
          className="button button-outline"
          disabled={loading}
          onClick={searchImages}
        >
          搜尋圖片
        </button>
      </div>
      <p className="media-message" role="status" aria-live="polite">
        {loading ? "圖片載入中…" : error || message}
      </p>
      {error && (
        <button
          type="button"
          className="button button-outline"
          disabled={loading}
          onClick={() =>
            void load(requestTarget.current.page, requestTarget.current.query)
          }
        >
          重試載入圖片
        </button>
      )}
      <div className="media-grid" aria-busy={loading}>
        {list?.items.map((item) => (
          <MediaCard
            key={item.id}
            item={item}
            disabled={loading}
            onSelect={onSelect}
            onSaved={(updated) => {
              setList((current) =>
                current
                  ? {
                      ...current,
                      items: current.items.map((entry) =>
                        entry.id === updated.id ? updated : entry,
                      ),
                    }
                  : current,
              );
              refresh();
            }}
            onDeleted={(deleted) => {
              setMessage("圖片已刪除。");
              setList((current) =>
                current
                  ? {
                      ...current,
                      items: current.items.filter((entry) => entry.id !== deleted.id),
                      total: Math.max(0, current.total - 1),
                    }
                  : current,
              );
              refresh();
            }}
            onConflict={refresh}
          />
        ))}
      </div>
      {list && list.items.length === 0 && !loading && !error && (
        <p>尚無符合條件的圖片。</p>
      )}
      {list && (
        <nav className="media-pagination" aria-label="媒體分頁">
          <span>
            共 {list.total} 張 · 第 {list.page} / {Math.max(1, list.pages)} 頁
          </span>
          <button
            type="button"
            className="button button-outline"
            disabled={loading || list.page <= 1}
            onClick={() => void load(list.page - 1, activeQuery)}
          >
            上一頁
          </button>
          <button
            type="button"
            className="button button-outline"
            disabled={loading || list.page >= list.pages}
            onClick={() => void load(list.page + 1, activeQuery)}
          >
            下一頁
          </button>
        </nav>
      )}
    </div>
  );
}

export function MediaLibrary({ initial }: { initial: MediaList }) {
  return <MediaBrowser initial={initial} />;
}
