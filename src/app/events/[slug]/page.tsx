import Link from "next/link";
import { notFound } from "next/navigation";
import { PageHeading } from "@/components/content/page-heading";
import { currentUser } from "@/lib/server/access";
import { db } from "@/lib/server/db";
import { EventAction } from "@/components/member/event-actions";
import { registrationLabels } from "@/lib/event-validation";
import { getEvent } from "@/lib/services/content-service";
import { pageMetadata } from "@/lib/seo";
export const dynamic = "force-dynamic";
export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const record = await getEvent((await params).slug);
  if (!record) notFound();
  return pageMetadata(record.title, record.summary, `/events/${record.slug}`);
}
export default async function Page({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const record = await getEvent((await params).slug);
  if (!record) notFound();
  const e = record.view,
    user = await currentUser();
  const [own, confirmed] = await Promise.all([
    user
      ? db.eventRegistration.findUnique({
          where: { eventId_userId: { eventId: record.id, userId: user.id } },
          select: { status: true, checkedInAt: true },
        })
      : null,
    db.eventRegistration.count({
      where: { eventId: record.id, status: "CONFIRMED" },
    }),
  ]);
  const open = record.bookingLabel === "開發測試報名開放中";
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
              活動內容與講師資訊須於取得協會正式資料後確認。報名與候補僅供本機開發測試；不接受付款。
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
              <dd>
                {record.capacity} 人 · 開發測試不收費 · 截止{" "}
                {format(record.registrationDeadline.toISOString())}
              </dd>
              <dt>目前確認名額</dt>
              <dd>
                {confirmed} / {record.capacity}
              </dd>
            </dl>
            <div className="registration-status">
              <strong>{record.bookingLabel}</strong>
              <p>所有紀錄為開發示範，不代表真實活動或正式資格；無付款功能。</p>
              {own && own.status !== "CANCELLED" ? (
                <>
                  <p>
                    你的狀態：{registrationLabels[own.status]}
                    {own.checkedInAt ? " · 已報到" : ""}
                  </p>
                  <Link className="text-link" href="/member/events">
                    查看我的活動／取消 ↗
                  </Link>
                </>
              ) : open ? (
                <EventAction eventId={record.id} guest={!user} />
              ) : null}
              {record.waitlistEnabled && (
                <p>額滿時可候補；依加入順序遞補，資格會再次檢查。</p>
              )}
            </div>
          </aside>
        </div>
      </section>
    </>
  );
}
