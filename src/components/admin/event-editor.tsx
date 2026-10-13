"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  eventSchema,
  eventStatuses,
  type EventInput,
} from "@/lib/event-validation";
function localTime(value: string) {
  return value
    ? new Date(new Date(value).getTime() + 8 * 3600000)
        .toISOString()
        .slice(0, 16)
    : "";
}
export function EventEditor({
  initial,
  id,
  version,
}: {
  initial: EventInput;
  id?: string;
  version?: number;
}) {
  const [busy, setBusy] = useState(false),
    [message, setMessage] = useState(""),
    [status, setStatus] = useState(initial.status),
    [agenda, setAgenda] = useState(initial.agenda);
  const router = useRouter();
  return (
    <form
      className="member-form cms-editor"
      onSubmit={async (e) => {
        e.preventDefault();
        setMessage("");
        const form = new FormData(e.currentTarget),
          text = (key: string) => String(form.get(key) ?? "");
        const date = (key: "startsAt" | "endsAt" | "registrationDeadline") =>
          text(key) === localTime(initial[key])
            ? initial[key]
            : text(key) + ":00+08:00";
        const parsed = eventSchema.safeParse({
          slug: text("slug"),
          title: text("title"),
          summary: text("summary"),
          category: text("category"),
          format: text("format"),
          location: text("location"),
          startsAt: date("startsAt"),
          endsAt: date("endsAt"),
          registrationDeadline: date("registrationDeadline"),
          status,
          eligibility: text("eligibility"),
          capacity: Number(form.get("capacity")),
          registrationEnabled: form.has("registrationEnabled"),
          waitlistEnabled: form.has("waitlistEnabled"),
          agenda,
        });
        if (!parsed.success) {
          setMessage(
            "請檢查欄位：" +
              parsed.error.issues
                .slice(0, 3)
                .map((i) => i.message)
                .join("；"),
          );
          return;
        }
        setBusy(true);
        try {
          const response = await fetch(
            id ? `/api/admin/events/${id}` : "/api/admin/events",
            {
              method: id ? "PATCH" : "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                ...parsed.data,
                ...(id ? { version } : {}),
              }),
            },
          );
          const result = await response.json();
          if (!response.ok) {
            setMessage(result.error?.message ?? "活動未儲存。");
            return;
          }
          router.push(`/admin/events/${result.id}`);
          router.refresh();
          setMessage("活動已儲存。");
        } catch {
          setMessage("連線失敗，請先確認最新版本。");
        } finally {
          setBusy(false);
        }
      }}
    >
      <p className="demo-warning">
        所有活動與報名為開發示範，不代表實際舉辦、正式會員資格或付款承諾。附件上傳與寄信重試尚未提供。
      </p>
      <fieldset disabled={busy}>
        <legend>活動資料</legend>
        <label htmlFor="event-slug">活動網址識別碼</label>
        <input
          id="event-slug"
          name="slug"
          required
          maxLength={100}
          minLength={3}
          defaultValue={initial.slug}
          readOnly={!!id}
          pattern="[a-z0-9]+(-[a-z0-9]+)*"
        />
        <label htmlFor="event-title">活動標題</label>
        <input
          id="event-title"
          name="title"
          required
          minLength={2}
          maxLength={120}
          defaultValue={initial.title}
        />
        <label htmlFor="event-summary">活動介紹</label>
        <textarea
          id="event-summary"
          name="summary"
          required
          minLength={5}
          maxLength={1000}
          rows={4}
          defaultValue={initial.summary}
        />
        <div className="cms-two-columns">
          <div>
            <label htmlFor="event-category">活動分類</label>
            <input
              id="event-category"
              name="category"
              required
              maxLength={40}
              defaultValue={initial.category}
            />
          </div>
          <div>
            <label htmlFor="event-format">活動形式</label>
            <input
              id="event-format"
              name="format"
              required
              maxLength={60}
              defaultValue={initial.format}
            />
          </div>
        </div>
        <label htmlFor="event-location">活動地點</label>
        <input
          id="event-location"
          name="location"
          required
          minLength={2}
          maxLength={200}
          defaultValue={initial.location}
        />
      </fieldset>
      <fieldset disabled={busy}>
        <legend>時間與報名（台灣時間）</legend>
        {[
          ["startsAt", "開始時間"],
          ["endsAt", "結束時間"],
          ["registrationDeadline", "報名截止"],
        ].map(([key, label]) => (
          <div key={key}>
            <label htmlFor={`event-${key}`}>{label}</label>
            <input
              id={`event-${key}`}
              type="datetime-local"
              name={key}
              required
              defaultValue={localTime(
                initial[key as "startsAt" | "endsAt" | "registrationDeadline"],
              )}
            />
          </div>
        ))}
        <label htmlFor="event-capacity">確認名額（1–1000）</label>
        <input
          id="event-capacity"
          type="number"
          name="capacity"
          required
          min={1}
          max={1000}
          defaultValue={initial.capacity}
        />
        <label htmlFor="event-eligibility">報名資格</label>
        <select
          id="event-eligibility"
          name="eligibility"
          defaultValue={initial.eligibility}
        >
          <option value="ACCOUNT">已驗證網站帳號</option>
          <option value="MEMBER">有效會員（涵蓋活動開始）</option>
        </select>
        <label className="checkbox-row">
          <input
            name="registrationEnabled"
            type="checkbox"
            defaultChecked={initial.registrationEnabled}
          />
          開放本機報名
        </label>
        <label className="checkbox-row">
          <input
            name="waitlistEnabled"
            type="checkbox"
            defaultChecked={initial.waitlistEnabled}
          />
          額滿時接受候補（最多1000人）
        </label>
        <p>
          已有報名時不可修改時間／資格，或將名額調低至已確認人數以下。需要取消時請使用「活動取消」，通知所有報名者。
        </p>
      </fieldset>
      <fieldset disabled={busy}>
        <legend>示範議程</legend>
        {agenda.map((a, i) => (
          <div key={i} className="cms-block">
            <label htmlFor={`agenda-time-${i}`}>議程 {i + 1} 時間</label>
            <input
              type="time"
              id={`agenda-time-${i}`}
              required
              value={a.time}
              onChange={(e) =>
                setAgenda(
                  agenda.map((item, index) =>
                    index === i ? { ...item, time: e.target.value } : item,
                  ),
                )
              }
            />
            <label htmlFor={`agenda-title-${i}`}>議程 {i + 1} 主題</label>
            <input
              id={`agenda-title-${i}`}
              required
              maxLength={120}
              value={a.title}
              onChange={(e) =>
                setAgenda(
                  agenda.map((item, index) =>
                    index === i ? { ...item, title: e.target.value } : item,
                  ),
                )
              }
            />
            <button
              type="button"
              className="text-link"
              onClick={() =>
                setAgenda(agenda.filter((_, index) => index !== i))
              }
            >
              移除議程 {i + 1}
            </button>
          </div>
        ))}
        <button
          type="button"
          className="button button-outline"
          disabled={agenda.length >= 30}
          onClick={() => setAgenda([...agenda, { time: "14:00", title: "" }])}
        >
          新增議程
        </button>
      </fieldset>
      <fieldset disabled={busy}>
        <legend>公開狀態</legend>
        <label htmlFor="event-status">活動狀態</label>
        <select
          id="event-status"
          value={status}
          onChange={(e) => setStatus(e.target.value as EventInput["status"])}
        >
          {Object.entries(eventStatuses).map(([value, label]) => (
            <option key={value} value={value}>
              {label}
            </option>
          ))}
        </select>
        {status === "CANCELLED" && (
          <label className="checkbox-row">
            <input type="checkbox" required />
            確認取消此活動，同時取消全部報名／候補並發送站內通知。
          </label>
        )}
        <p>草稿／下架不對外顯示；取消活動會保留公開說明及歷史紀錄。</p>
      </fieldset>
      <button disabled={busy} className="button button-primary">
        {busy ? "儲存中…" : "儲存活動"}
      </button>
      <p role="status">{message}</p>
    </form>
  );
}
