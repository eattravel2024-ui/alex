import Link from "next/link";
import { notFound } from "next/navigation";
import { PageHeading } from "@/components/content/page-heading";
import { eventRecords } from "@/lib/catalog";
import { getEvent } from "@/lib/services/content-service";
import { pageMetadata } from "@/lib/seo";
export function generateStaticParams() {
  return eventRecords.map((e) => ({ slug: e.slug }));
}
export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const e = getEvent((await params).slug);
  return e
    ? pageMetadata(e.title, e.summary, `/events/${e.slug}`)
    : { title: "找不到活動" };
}
export default async function Page({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const e = getEvent((await params).slug);
  if (!e) notFound();
  const format = (date: string) =>
    new Intl.DateTimeFormat("zh-TW", {
      timeZone: "Asia/Taipei",
      dateStyle: "long",
      timeStyle: "short",
      hour12: false,
    }).format(new Date(date));
  return (
    <>
      <PageHeading
        title={e.title}
        description={e.summary}
        eyebrow={e.category}
        items={[{ label: "活動與課程", href: "/events" }, { label: e.title }]}
      />
      <section className="section">
        <div className="container event-detail-grid">
          <div>
            <p className="demo-warning">
              示範活動：日期、議程、資格與地點皆為測試資料，無實際舉辦或收費承諾。
            </p>
            <h2>活動介紹</h2>
            <p className="section-description">
              {e.summary}{" "}
              活動內容與講師資訊須於取得協會正式資料後確認。本頁目前用於驗證活動資訊的瀏覽流程。
            </p>
            <h2 className="subsection-title">示範議程</h2>
            <ol className="agenda-list">
              {e.agenda.map((item) => (
                <li key={item.time}>
                  <span>{item.time}</span>
                  <span>{item.title}</span>
                </li>
              ))}
            </ol>
            <h2 className="subsection-title">活動附件</h2>
            <p className="section-description">
              尚無正式附件，未提供不存在的下載檔案。
            </p>
            <Link className="text-link" href="/events">
              返回活動列表 ↗
            </Link>
          </div>
          <aside className="event-info-panel">
            <h2>活動資訊</h2>
            <dl>
              <dt>開始時間（台灣）</dt>
              <dd>
                <time dateTime={e.startsAt}>{format(e.startsAt)}</time>
              </dd>
              <dt>結束時間（台灣）</dt>
              <dd>
                <time dateTime={e.endsAt}>{format(e.endsAt)}</time>
              </dd>
              <dt>活動形式</dt>
              <dd>{e.format}</dd>
              <dt>地點</dt>
              <dd>{e.location}</dd>
              <dt>示範資格</dt>
              <dd>{e.eligibility}</dd>
              <dt>名額、費用與截止日期</dt>
              <dd>正式規則待確認</dd>
            </dl>
            <div className="registration-status">
              <strong>報名尚未開放</strong>
              <p>
                報名、候補及取消功能將於資料庫與會員授權完成後提供。此頁不接受付款。
              </p>
            </div>
          </aside>
        </div>
      </section>
    </>
  );
}
