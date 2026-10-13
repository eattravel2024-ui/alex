import Link from "next/link";
import { requireUser } from "@/lib/server/access";
import { memberDashboard } from "@/lib/services/member-service";
export default async function Page() {
  const user = await requireUser();
  const data = await memberDashboard(user.id);
  const membership = data?.membership;
  return (
    <>
      <h2>會員資格與服務</h2>
      <div className="member-summary-grid">
        <div className="contact-card">
          <h3>網站帳號</h3>
          <p>{user.email}</p>
          <p>信箱已驗證 · 一般網站帳號</p>
        </div>
        <div className="contact-card">
          <h3>協會會員資格</h3>
          {membership ? (
            <>
              <p>
                {membership.isDemo
                  ? "示範資格（無正式效力）"
                  : new Date(membership.validUntil) > new Date()
                    ? "有效會員"
                    : "資格已到期"}
              </p>
              <p>{membership.type.name}</p>
              <p>編號：{membership.memberNumber}</p>
              <p>
                到期：
                {membership.validUntil.toLocaleDateString("zh-TW", {
                  timeZone: "Asia/Taipei",
                })}
              </p>
            </>
          ) : (
            <>
              <p>尚無正式會員資格</p>
              <Link className="text-link" href="/member/application">
                查看示範入會申請 ↗
              </Link>
            </>
          )}
        </div>
      </div>
      <h2 className="subsection-title">通知中心</h2>
      {data?.notifications.length ? (
        <ul className="notification-list">
          {data.notifications.map((n) => (
            <li key={n.id}>
              <h3>{n.title}</h3>
              <p>{n.body}</p>
              <time>
                {n.createdAt.toLocaleString("zh-TW", {
                  timeZone: "Asia/Taipei",
                })}
              </time>
            </li>
          ))}
        </ul>
      ) : (
        <p className="section-description">目前沒有通知。</p>
      )}
      <h2 className="subsection-title">活動與課程紀錄</h2>
      <p className="section-description">
        報名與修課尚未開放，沒有任何已報名或完成的紀錄。
      </p>
    </>
  );
}
