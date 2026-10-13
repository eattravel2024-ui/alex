import Link from "next/link";
import { currentUser } from "@/lib/server/access";
import { canAdmin } from "@/lib/admin-permissions";
import { db } from "@/lib/server/db";
import { AccessDenied } from "@/components/admin/access-denied";
export default async function Page() {
  const user = await currentUser();
  if (!user || !canAdmin(user.role, "dashboard")) return <AccessDenied />;
  const canReview = canAdmin(user.role, "review"),
    canMembers = canAdmin(user.role, "members"),
    canContent = canAdmin(user.role, "content");
  const [pending, returned, accounts, disabled, drafts] = await Promise.all([
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
    canContent ? db.articleRecord.count({ where: { status: "DRAFT" } }) : null,
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
        {drafts !== null && (
          <Link href="/admin/articles?status=DRAFT">
            <span>文章草稿</span>
            <strong>{drafts}</strong>
          </Link>
        )}
      </div>
      {canAdmin(user.role, "content") && (
        <p>
          <Link className="button button-primary" href="/admin/articles">
            管理文章
          </Link>
        </p>
      )}
      {canAdmin(user.role, "eventOperations") && (
        <p>
          <Link className="button button-primary" href="/admin/events">
            管理活動／報名
          </Link>
        </p>
      )}
      <div className="demo-warning">
        <h3>目前可用功能</h3>
        <p>
          申請審核、帳號查詢與停用，以及最高管理員的稽核紀錄。核准示範申請不授予正式會員資格。
        </p>
        <p>
          文章 CMS
          已提供編輯、預覽、發布、排程與版本還原。活動管理已支援名額、候補、取消、報到與
          CSV。媒體與系統設定尚待實作；編輯角色沒有會員資料權限。
        </p>
      </div>
    </>
  );
}
