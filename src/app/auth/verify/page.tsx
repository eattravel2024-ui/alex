import { AuthForm } from "@/components/member/auth-form";
export const metadata = {
  title: "信箱驗證",
  robots: { index: false, follow: false },
};
export default async function Page({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const query = await searchParams;
  return (
    <section className="auth-page container">
      <h1>信箱驗證</h1>
      <p className="section-description">
        {query.error
          ? "驗證連結無效或已過期，請重新寄送。"
          : "請從郵件開啟驗證連結。已完成驗證時可前往登入，否則可重新寄送。"}
      </p>
      <AuthForm mode="resend" />
    </section>
  );
}
