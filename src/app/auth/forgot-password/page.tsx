import { AuthForm } from "@/components/member/auth-form";
export const metadata = {
  title: "忘記密碼",
  robots: { index: false, follow: false },
};
export default function Page() {
  return (
    <section className="auth-page container">
      <p className="eyebrow">ACCOUNT SERVICES</p>
      <h1>忘記密碼</h1>
      <AuthForm mode="forgot" />
    </section>
  );
}
