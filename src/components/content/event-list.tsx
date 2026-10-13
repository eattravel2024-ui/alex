import Link from "next/link";
import {
  contentUrl,
  eventMonth,
  queryValue,
  type SearchQuery,
} from "@/lib/catalog";
import { listPublicEvents } from "@/lib/services/event-service";
import { PageHeading } from "./page-heading";
export async function EventList({ query }: { query: SearchQuery }) {
  const [filtered, eventRecords] = await Promise.all([
    listPublicEvents(query),
    listPublicEvents(),
  ]);
  const q = queryValue(query.q).slice(0, 120),
    category = queryValue(query.category),
    view = queryValue(query.view) === "calendar" ? "calendar" : "list";
  const availableMonths = [...new Set(eventRecords.map(eventMonth))].sort();
  const requestedMonth = queryValue(query.month);
  const month =
    /^\d{4}-(0[1-9]|1[0-2])$/.test(requestedMonth) &&
    Number(requestedMonth.slice(0, 4)) >= 2000 &&
    Number(requestedMonth.slice(0, 4)) <= 2100
      ? requestedMonth
      : (availableMonths[0] ??
        new Intl.DateTimeFormat("sv-SE", {
          timeZone: "Asia/Taipei",
          year: "numeric",
          month: "2-digit",
        }).format(new Date()));
  const [year, monthNumber] = month.split("-").map(Number);
  const days = new Date(Date.UTC(year, monthNumber, 0)).getUTCDate();
  const offset = new Date(Date.UTC(year, monthNumber - 1, 1)).getUTCDay();
  const shiftMonth = (offset: number) => {
    const date = new Date(Date.UTC(year, monthNumber - 1 + offset, 1));
    return date.toISOString().slice(0, 7);
  };
  const fields = { q, category, view, month };
  return (
    <>
      <PageHeading
        title="活動與課程中心"
        description="在學習與分享之間，找到實踐健康的力量。"
        eyebrow="GATHER & GROW"
        items={[{ label: "活動與課程" }]}
      />
      <section className="section">
        <div className="container">
          <p className="demo-warning">
            以下日期、議程與資格皆為測試資料，不代表實際活動。報名開放狀態依各活動顯示，僅供本機測試。
          </p>
          <form action="/events" role="search" className="search-panel">
            <div>
              <label htmlFor="event-query">搜尋活動</label>
              <input
                id="event-query"
                name="q"
                type="search"
                maxLength={120}
                defaultValue={q}
                placeholder="輸入活動關鍵字"
              />
            </div>
            <div>
              <label htmlFor="event-category">活動分類</label>
              <select
                id="event-category"
                name="category"
                defaultValue={category}
              >
                <option value="">全部分類</option>
                {[...new Set(eventRecords.map((e) => e.category))].map((c) => (
                  <option key={c}>{c}</option>
                ))}
              </select>
            </div>
            <input type="hidden" name="view" value={view} />
            <input type="hidden" name="month" value={month} />
            <button type="submit" className="button button-primary">
              搜尋
            </button>
            <Link href="/events" className="text-link search-reset">
              清除篩選
            </Link>
          </form>
          <div className="view-toolbar">
            <p role="status">找到 {filtered.length} 場示範活動</p>
            <nav aria-label="活動顯示方式">
              <Link
                href={contentUrl("/events", { ...fields, view: "list" })}
                aria-current={view === "list" ? "page" : undefined}
              >
                列表
              </Link>
              <Link
                href={contentUrl("/events", { ...fields, view: "calendar" })}
                aria-current={view === "calendar" ? "page" : undefined}
              >
                月曆
              </Link>
            </nav>
          </div>
          {view === "list" ? (
            <div className="event-listing">
              {filtered.length ? (
                filtered.map((event) => (
                  <article className="event-list-card" key={event.slug}>
                    <div className="event-date-block">
                      <span>{event.startsAt.slice(5, 7)}月</span>
                      <strong>{event.startsAt.slice(8, 10)}</strong>
                      <small>{event.startsAt.slice(0, 4)} · 示範日期</small>
                    </div>
                    <div>
                      <span className="tag">{event.category}</span>
                      <h2>
                        <Link href={`/events/${event.slug}`}>
                          {event.title}
                        </Link>
                      </h2>
                      <p>{event.summary}</p>
                      <p className="event-location">
                        {event.format} · {event.location}
                      </p>
                      <Link
                        className="text-link"
                        href={`/events/${event.slug}`}
                      >
                        查看示範活動 ↗
                      </Link>
                    </div>
                    <span className="event-status">{event.bookingLabel}</span>
                  </article>
                ))
              ) : (
                <div className="empty-state">
                  <h2>沒有符合條件的活動</h2>
                  <p>請嘗試其他關鍵字，或清除篩選。</p>
                </div>
              )}
            </div>
          ) : (
            <>
              <div className="calendar-heading">
                <Link
                  aria-label="上個月"
                  href={contentUrl("/events", {
                    ...fields,
                    month: shiftMonth(-1),
                  })}
                >
                  ← 上個月
                </Link>
                <h2>
                  {year} 年 {monthNumber} 月
                </h2>
                <Link
                  aria-label="下個月"
                  href={contentUrl("/events", {
                    ...fields,
                    month: shiftMonth(1),
                  })}
                >
                  下個月 →
                </Link>
              </div>
              <p className="calendar-help">
                可左右捲動查看完整月曆，或使用下方的本月活動清單。
              </p>
              <div
                className="calendar-scroll"
                tabIndex={0}
                role="region"
                aria-label="活動月曆，可左右捲動"
              >
                <table className="event-calendar">
                  <caption className="sr-only">
                    {year} 年 {monthNumber} 月示範活動月曆，日期以台灣時間顯示
                  </caption>
                  <thead>
                    <tr>
                      {["日", "一", "二", "三", "四", "五", "六"].map((d) => (
                        <th scope="col" key={d}>
                          星期{d}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {Array.from(
                      { length: Math.ceil((offset + days) / 7) },
                      (_, row) => (
                        <tr key={row}>
                          {Array.from({ length: 7 }, (_, column) => {
                            const day = row * 7 + column - offset + 1;
                            if (day < 1 || day > days)
                              return (
                                <td key={column} className="calendar-blank" />
                              );
                            const matches = filtered.filter(
                              (e) =>
                                eventMonth(e) === month &&
                                Number(e.startsAt.slice(8, 10)) === day,
                            );
                            return (
                              <td key={column}>
                                <time
                                  dateTime={`${month}-${String(day).padStart(2, "0")}`}
                                >
                                  {day}
                                </time>
                                {matches.map((e) => (
                                  <Link key={e.slug} href={`/events/${e.slug}`}>
                                    <span>{e.startsAt.slice(11, 16)}</span>
                                    {e.title}
                                  </Link>
                                ))}
                              </td>
                            );
                          })}
                        </tr>
                      ),
                    )}
                  </tbody>
                </table>
              </div>
              {filtered.some((e) => eventMonth(e) === month) && (
                <div className="calendar-agenda">
                  <h3>本月活動</h3>
                  <ul>
                    {filtered
                      .filter((e) => eventMonth(e) === month)
                      .map((e) => (
                        <li key={e.slug}>
                          <Link href={`/events/${e.slug}`}>
                            <span>
                              {e.startsAt.slice(5, 10)} ·{" "}
                              {e.startsAt.slice(11, 16)}
                            </span>
                            <strong>{e.title}</strong>
                          </Link>
                        </li>
                      ))}
                  </ul>
                </div>
              )}
              {!filtered.some((e) => eventMonth(e) === month) && (
                <p className="filter-note">
                  這個月份沒有符合條件的示範活動。可切換月份或調整篩選。
                </p>
              )}
            </>
          )}
        </div>
      </section>
    </>
  );
}
