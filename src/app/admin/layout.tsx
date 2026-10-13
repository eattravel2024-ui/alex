import Link from "next/link";
import { redirect } from "next/navigation";
import { currentUser } from "@/lib/server/access";
import { canAdmin, roleLabels } from "@/lib/admin-permissions";
import { LogoutButton } from "@/components/member/member-actions";
export const dynamic = "force-dynamic";
export const metadata = {
  title: "管理後台",
  robots: { index: false, follow: false },
};
export default async function Layout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await currentUser();
  if (!user) redirect("/auth/login");
  if (!canAdmin(user.role, "dashboard"))
    return (
      <section className="container member-area">
        <h1>無法使用管理後台</h1>
        <p>此帳號沒有管理權限。</p>
        <Link className="button button-primary" href="/member">
          返回會員中心
        </Link>
      </section>
    );
  return (
    <section className="container member-area admin-area">
      <div className="member-area-heading">
        <div>
          <p className="eyebrow">ASSOCIATION ADMINISTRATION</p>
          <h1>管理後台</h1>
          <p>
            {user.name} · {roleLabels[user.role]} · 開發測試環境
          </p>
        </div>
        <LogoutButton />
      </div>
      <div className="member-layout">
        <nav className="member-nav" aria-label="後台導覽">
          <Link href="/admin">工作總覽</Link>
          {canAdmin(user.role, "content") && (
            <Link href="/admin/articles">文章管理</Link>
          )}
          {canAdmin(user.role, "review") && (
            <Link href="/admin/applications">申請審核</Link>
          )}
          {canAdmin(user.role, "members") && (
            <Link href="/admin/members">帳號管理</Link>
          )}
          {canAdmin(user.role, "eventOperations") && (
            <Link href="/admin/events">活動管理</Link>
          )}
          {canAdmin(user.role, "audit") && (
            <Link href="/admin/audit">稽核紀錄</Link>
          )}
          {canAdmin(user.role, "contacts") && <Link href="/admin/contacts">聯絡訊息</Link>}
          <Link href="/member">會員中心</Link>
        </nav>
        <div className="member-content">{children}</div>
      </div>
    </section>
  );
}
