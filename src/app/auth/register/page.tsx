import { AuthForm } from "@/components/member/auth-form";
export const metadata = {
  title: "建立測試帳號",
  robots: { index: false, follow: false },
};
export default function Page() {
  return (
    <section className="auth-page container">
      <p className="eyebrow">ACCOUNT SERVICES</p>
      <h1>建立測試帳號</h1>
      <AuthForm mode="register" />
    </section>
  );
}
