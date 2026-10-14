"use client";

import Image from "next/image";
import { useId, useState } from "react";
import type { MediaItem } from "@/lib/media-validation";
import { MediaBrowser } from "./media-library";

export function MediaPicker({
  value,
  altText,
  onChange,
}: {
  value: string;
  altText: string;
  onChange: (image: string, alt: string) => void;
}) {
  const panelId = useId();
  const [open, setOpen] = useState(false);
  const [selected, setSelected] = useState<MediaItem | null>(null);
  const [message, setMessage] = useState("");
  const selectedItem = selected?.url === value ? selected : null;
  const uploadedCover = value.startsWith("/media/");

  function select(item: MediaItem) {
    setSelected(item);
    onChange(item.url, item.altText);
    setOpen(false);
    setMessage("已選擇封面圖片。");
  }

  return (
    <div className="media-picker">
      <button
        type="button"
        className="button button-outline"
        aria-expanded={open}
        aria-controls={panelId}
        onClick={() => {
          setOpen((current) => !current);
          setMessage("");
        }}
      >
        {open ? "關閉媒體圖片選擇" : "選擇媒體圖片"}
      </button>
      {uploadedCover && (
        <div className="media-card">
          <Image
            src={value}
            alt={altText}
            width={selectedItem?.width ?? 960}
            height={selectedItem?.height ?? 640}
            unoptimized
          />
          <p>已選擇上傳的封面圖片。</p>
        </div>
      )}
      <div>
        <label htmlFor={`${panelId}-alt`}>封面替代文字</label>
        <input
          id={`${panelId}-alt`}
          value={altText}
          maxLength={160}
          onChange={(event) => {
            onChange(value, event.target.value);
            setMessage("");
          }}
        />
      </div>
      <p className="media-message" role="status" aria-live="polite">
        {message}
      </p>
      <section id={panelId} aria-label="選擇封面媒體圖片" hidden={!open}>
        {open && <MediaBrowser onSelect={select} />}
      </section>
    </div>
  );
}
