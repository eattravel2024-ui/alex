import Link from "next/link";
import { canAdmin } from "@/lib/admin-permissions";
import { redirect } from "next/navigation";
import { currentUser } from "@/lib/server/access";
import { LogoutButton } from "@/components/member/member-actions";
export const dynamic = "force-dynamic";
export const metadata = {
  title: "會員中心",
  robots: { index: false, follow: false },
};
export default async function Layout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await currentUser();
  if (!user) redirect("/auth/login");
  return (
    <section className="member-area container">
      <div className="member-area-heading">
        <div>
          <p className="eyebrow">MEMBER SERVICES</p>
          <h1>會員中心</h1>
          <p>你好，{user.name}。網站帳號不等於正式會員资格。</p>
        </div>
        <LogoutButton />
      </div>
      <div className="member-layout">
        <nav className="member-nav" aria-label="會員服務導覽">
          {canAdmin(user.role, "dashboard") && (
            <Link href="/admin">管理後台</Link>
          )}
          {[
            ["/member", "會員總覽"],
            ["/member/profile", "個人資料"],
            ["/member/application", "入會申請"],
            ["/member/bookmarks", "文章收藏"],
            ["/member/security", "帳號安全"],
          ].map(([href, label]) => (
            <Link key={href} href={href}>
              {label}
            </Link>
          ))}
        </nav>
        <div className="member-content">{children}</div>
      </div>
    </section>
  );
}
