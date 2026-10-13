import { AuthForm } from "@/components/member/auth-form";
export const metadata = {
  title: "會員登入",
  robots: { index: false, follow: false },
};
export default function Page() {
  return (
    <section className="auth-page container">
      <p className="eyebrow">ACCOUNT SERVICES</p>
      <h1>會員登入</h1>
      <AuthForm mode="login" />
    </section>
  );
}
