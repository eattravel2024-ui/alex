import { AuthForm } from "@/components/member/auth-form";
export const metadata = {
  title: "重設密碼",
  robots: { index: false, follow: false },
};
export default async function Page({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const query = await searchParams;
  const token = typeof query.token === "string" ? query.token : undefined;
  return (
    <section className="auth-page container">
      <h1>重設密碼</h1>
      {!token && <p className="demo-warning">請先從郵件開啟有效的重設連結。</p>}
      <AuthForm mode="reset" token={token} />
    </section>
  );
}
