"use client";

import { useRef, useState, type KeyboardEvent, type MouseEvent } from "react";
import { applyArticleFormat, safeArticleLink, type ArticleFormat } from "@/lib/article-formatting";
type Selection = { start: number; end: number };

export function ArticleTextarea({
  id,
  value,
  onChange,
  required,
  maxLength,
  rows = 6,
}: {
  id: string;
  value: string;
  onChange: (value: string) => void;
  required?: boolean;
  maxLength?: number;
  rows?: number;
}) {
  const textarea = useRef<HTMLTextAreaElement>(null);
  const linkInput = useRef<HTMLInputElement>(null);
  const selection = useRef<Selection>({ start: 0, end: 0 });
  const linkSelection = useRef({ start: 0, end: 0, value });
  const [linkOpen, setLinkOpen] = useState(false);
  const [linkUrl, setLinkUrl] = useState("");
  const [linkLabel, setLinkLabel] = useState("");
  const [message, setMessage] = useState("");
  const hintId = `${id}-format-hint`;
  const messageId = `${id}-format-message`;

  function canEdit() {
    return !!textarea.current && !textarea.current.matches(":disabled");
  }

  function currentSelection(): Selection {
    const field = textarea.current;
    if (field) {
      selection.current = {
        start: field.selectionStart,
        end: field.selectionEnd,
      };
    }
    return selection.current;
  }

  function focusSelection(start: number, end: number) {
    selection.current = { start, end };
    requestAnimationFrame(() => {
      if (!canEdit()) return;
      textarea.current!.focus();
      textarea.current!.setSelectionRange(start, end);
    });
  }

  function commit(next: string, start: number, end: number) {
    if (!canEdit()) return false;
    if (maxLength !== undefined && next.length > maxLength) {
      setMessage(`套用格式後會超過 ${maxLength.toLocaleString()} 字，請先縮短內容。`);
      return false;
    }
    setMessage("");
    onChange(next);
    focusSelection(start, end);
    return true;
  }

  function format(kind: ArticleFormat) {
    if (!canEdit()) return;
    const { start, end } = currentSelection();
    const result = applyArticleFormat(value, start, end, kind);
    if (commit(result.value, result.selectionStart, result.selectionEnd)) {
      setLinkOpen(false);
    }
  }

  function keepSelection(event: MouseEvent<HTMLButtonElement>) {
    event.preventDefault();
    if (canEdit()) currentSelection();
  }

  function openLink() {
    if (!canEdit()) return;
    const { start, end } = currentSelection();
    linkSelection.current = { start, end, value };
    setLinkLabel(value.slice(start, end));
    setLinkUrl("");
    setMessage("");
    setLinkOpen(true);
    requestAnimationFrame(() => linkInput.current?.focus());
  }

  function insertLink() {
    if (!canEdit()) return;
    const selected = linkSelection.current;
    if (selected.value !== value) {
      setMessage("段落已變更，請重新選取文字並加入連結。");
      return;
    }
    const url = safeArticleLink(linkUrl);
    if (!url) {
      setMessage("請輸入 HTTPS 網址，且網址不可包含帳號或密碼。");
      return;
    }
    const label = linkLabel.trim();
    if (!label || /[\[\]\\\r\n]/.test(label)) {
      setMessage("請填寫連結文字；文字不可含方括號、反斜線或換行。");
      return;
    }
    // Parentheses have special meaning in the supported link syntax.
    const destination = url.replace(/\(/g, "%28").replace(/\)/g, "%29");
    const markup = `[${label}](${destination})`;
    const next = value.slice(0, selected.start) + markup + value.slice(selected.end);
    const end = selected.start + markup.length;
    if (commit(next, end, end)) setLinkOpen(false);
  }

  function linkKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (event.key === "Enter") {
      event.preventDefault();
      event.stopPropagation();
      insertLink();
    } else if (event.key === "Escape") {
      event.preventDefault();
      event.stopPropagation();
      setLinkOpen(false);
      setMessage("");
      focusSelection(linkSelection.current.start, linkSelection.current.end);
    }
  }

  function toolbarKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    if (!canEdit() || !["ArrowLeft", "ArrowRight", "Home", "End"].includes(event.key)) return;
    const buttons = Array.from(event.currentTarget.querySelectorAll<HTMLButtonElement>("button:not(:disabled)"));
    const focused = buttons.indexOf(document.activeElement as HTMLButtonElement);
    if (focused < 0) return;
    event.preventDefault();
    const next = event.key === "Home" ? 0
      : event.key === "End" ? buttons.length - 1
      : (focused + (event.key === "ArrowRight" ? 1 : -1) + buttons.length) % buttons.length;
    buttons[next].focus();
  }

  return (
    <div className="article-textarea">
      <div role="toolbar" aria-label="段落格式工具" aria-controls={id} className="article-format-toolbar" onKeyDown={toolbarKeyDown}>
        {([
          ["bold", "粗體"],
          ["italic", "斜體"],
          ["unordered-list", "項目清單"],
          ["ordered-list", "編號清單"],
        ] as const).map(([kind, label]) => (
          <button key={kind} type="button" onMouseDown={keepSelection} onClick={() => format(kind)}>
            {label}
          </button>
        ))}
        <button type="button" aria-expanded={linkOpen} aria-controls={`${id}-link-fields`} onMouseDown={keepSelection} onClick={openLink}>
          加入連結
        </button>
      </div>
      <textarea
        ref={textarea}
        id={id}
        value={value}
        required={required}
        maxLength={maxLength}
        rows={rows}
        aria-describedby={`${hintId}${message ? ` ${messageId}` : ""}`}
        onSelect={currentSelection}
        onChange={(event) => {
          if (!canEdit()) return;
          setMessage("");
          setLinkOpen(false);
          onChange(event.target.value);
        }}
        onKeyDown={(event) => {
          if (!canEdit() || event.nativeEvent.isComposing || event.altKey || !(event.ctrlKey || event.metaKey)) return;
          const key = event.key.toLowerCase();
          if (key === "b" || key === "i") {
            event.preventDefault();
            if (!event.repeat) format(key === "b" ? "bold" : "italic");
          }
        }}
      />
      <p id={hintId} className="article-format-hint">選取文字後套用格式。粗體與斜體也可使用 Ctrl／⌘＋B、Ctrl／⌘＋I。</p>
      {linkOpen && (
        <div id={`${id}-link-fields`} className="article-link-fields" role="group" aria-label="加入段落連結">
          <div>
            <label htmlFor={`${id}-link-label`}>連結文字</label>
            <input id={`${id}-link-label`} value={linkLabel} onChange={(event) => { setLinkLabel(event.target.value); setMessage(""); }} onKeyDown={linkKeyDown} />
          </div>
          <div>
            <label htmlFor={`${id}-link-url`}>HTTPS 網址</label>
            <input ref={linkInput} id={`${id}-link-url`} type="text" inputMode="url" autoComplete="url" placeholder="https://" maxLength={2048} value={linkUrl} onChange={(event) => { setLinkUrl(event.target.value); setMessage(""); }} onKeyDown={linkKeyDown} />
          </div>
          <button type="button" onClick={insertLink}>插入連結</button>
          <button type="button" onClick={() => { if (!canEdit()) return; setLinkOpen(false); setMessage(""); focusSelection(linkSelection.current.start, linkSelection.current.end); }}>取消</button>
        </div>
      )}
      {message && <p id={messageId} className="article-format-message" role="alert">{message}</p>}
    </div>
  );
}
