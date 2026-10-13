import Link from "next/link";
import { currentUser } from "@/lib/server/access";
import { canAdmin } from "@/lib/admin-permissions";
import { db } from "@/lib/server/db";
import { AccessDenied } from "@/components/admin/access-denied";
export default async function Page() {
  const user = await currentUser();
  if (!user || !canAdmin(user.role, "dashboard")) return <AccessDenied />;
  const canReview = canAdmin(user.role, "review"),
    canMembers = canAdmin(user.role, "members");
  const [pending, returned, accounts, disabled] = await Promise.all([
    canReview
      ? db.membershipApplication.count({ where: { status: "PENDING" } })
      : null,
    canReview
      ? db.membershipApplication.count({ where: { status: "RETURNED" } })
      : null,
    canMembers ? db.user.count({ where: { role: "MEMBER" } }) : null,
    canMembers
      ? db.user.count({ where: { role: "MEMBER", disabled: true } })
      : null,
  ]);
  return (
    <>
      <h2>工作總覽</h2>
      <p className="section-description">
        統計直接讀取目前資料庫。開發測試資料不代表協會正式營運數據。
      </p>
      <div className="member-summary-grid admin-metrics">
        {pending !== null && (
          <Link href="/admin/applications?status=PENDING">
            <span>待審核申請</span>
            <strong>{pending}</strong>
          </Link>
        )}
        {returned !== null && (
          <Link href="/admin/applications?status=RETURNED">
            <span>等待補件</span>
            <strong>{returned}</strong>
          </Link>
        )}
        {accounts !== null && (
          <Link href="/admin/members">
            <span>一般會員帳號</span>
            <strong>{accounts}</strong>
          </Link>
        )}
        {disabled !== null && (
          <Link href="/admin/members?state=disabled">
            <span>已停用帳號</span>
            <strong>{disabled}</strong>
          </Link>
        )}
      </div>
      <div className="demo-warning">
        <h3>目前可用功能</h3>
        <p>
          申請審核、帳號查詢與停用，以及最高管理員的稽核紀錄。核准示範申請不授予正式會員資格。
        </p>
        <p>
          文章
          CMS、媒體、活動管理與系統設定尚待實作；編輯角色目前可進入此頁，但沒有會員資料權限。
        </p>
      </div>
    </>
  );
}
