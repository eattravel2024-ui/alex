"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { passwordSchema, registrationSchema } from "@/lib/validation";
export type AuthMode =
  "login" | "register" | "forgot" | "reset" | "resend" | "change";
type Fields = {
  name: string;
  email: string;
  password: string;
  newPassword: string;
  currentPassword: string;
  confirmPassword: string;
  termsAccepted: boolean;
  privacyAccepted: boolean;
};
export function AuthForm({ mode, token }: { mode: AuthMode; token?: string }) {
  const {
    register,
    handleSubmit,
    formState: { isSubmitting },
  } = useForm<Fields>();
  const [message, setMessage] = useState("");
  const [success, setSuccess] = useState(false);
  const router = useRouter();
  const submit = handleSubmit(async (values) => {
    setMessage("");
    setSuccess(false);
    try {
      let endpoint = "",
        payload: Record<string, unknown> = {};
      if (mode === "register") {
        const result = registrationSchema.safeParse(values);
        if (!result.success) {
          setMessage(result.error.issues[0].message);
          return;
        }
        endpoint = "sign-up/email";
        payload = { ...result.data, callbackURL: "/auth/verify" };
      }
      if (mode === "login") {
        endpoint = "sign-in/email";
        payload = {
          email: values.email.trim().toLowerCase(),
          password: values.password,
        };
      }
      if (mode === "forgot") {
        endpoint = "request-password-reset";
        payload = {
          email: values.email.trim().toLowerCase(),
          redirectTo: window.location.origin + "/auth/reset-password",
        };
      }
      if (mode === "resend") {
        endpoint = "send-verification-email";
        payload = {
          email: values.email.trim().toLowerCase(),
          callbackURL: "/auth/verify",
        };
      }
      if (mode === "reset" || mode === "change") {
        const result = passwordSchema.safeParse(values.newPassword);
        if (!result.success) {
          setMessage(result.error.issues[0].message);
          return;
        }
        if (values.newPassword !== values.confirmPassword) {
          setMessage("兩次輸入的新密碼不一致。");
          return;
        }
        endpoint = mode === "reset" ? "reset-password" : "change-password";
        payload =
          mode === "reset"
            ? { newPassword: values.newPassword, token }
            : {
                newPassword: values.newPassword,
                currentPassword: values.currentPassword,
                revokeOtherSessions: true,
              };
      }
      const response = await fetch("/api/auth/" + endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!response.ok) {
        setMessage(
          response.status === 429
            ? "操作太頻繁，請稍後重試。"
            : mode === "login"
              ? "登入失敗：請確認帳密、信箱驗證與帳號狀態。"
              : "操作無法完成，請檢查資料或重新取得有效連結。",
        );
        return;
      }
      setSuccess(true);
      if (mode === "login") {
        router.push("/member");
        router.refresh();
        return;
      }
      setMessage(
        {
          register: "註冊請求已受理。若符合條件，請至信箱完成驗證後再登入。",
          forgot: "若信箱已註冊，將收到密碼重設郵件。",
          resend: "若信箱需要驗證，將收到驗證郵件。",
          reset: "密碼已重設，既有登入已失效，請重新登入。",
          change: "密碼已更新，其他裝置的登入已失效。",
          login: "",
        }[mode],
      );
    } catch {
      setMessage("服務暫時無法連線，請稍後重試。");
    }
  });
  return (
    <form className="member-form" onSubmit={submit}>
      <p className="form-notice">
        目前為本機開發測試，請勿輸入真實個資。郵件送往本機測試收件匣。
      </p>
      {mode === "register" && (
        <div>
          <label htmlFor="auth-name">顯示名稱</label>
          <input
            id="auth-name"
            autoComplete="name"
            minLength={2}
            maxLength={60}
            required
            {...register("name")}
          />
        </div>
      )}
      {["register", "login", "forgot", "resend"].includes(mode) && (
        <div>
          <label htmlFor="auth-email">電子郵件</label>
          <input
            id="auth-email"
            type="email"
            autoComplete="email"
            required
            maxLength={254}
            {...register("email")}
          />
        </div>
      )}
      {["register", "login"].includes(mode) && (
        <div>
          <label htmlFor="auth-password">密碼</label>
          <input
            id="auth-password"
            type="password"
            autoComplete={
              mode === "login" ? "current-password" : "new-password"
            }
            required
            minLength={mode === "register" ? 12 : 1}
            maxLength={128}
            {...register("password")}
          />
          {mode === "register" && (
            <p className="field-help">至少 12 字元，包含英文字母與數字。</p>
          )}
        </div>
      )}
      {mode === "change" && (
        <div>
          <label htmlFor="current-password">目前密碼</label>
          <input
            id="current-password"
            type="password"
            autoComplete="current-password"
            required
            {...register("currentPassword")}
          />
        </div>
      )}
      {["reset", "change"].includes(mode) && (
        <>
          <div>
            <label htmlFor="new-password">新密碼</label>
            <input
              id="new-password"
              type="password"
              autoComplete="new-password"
              required
              minLength={12}
              maxLength={128}
              {...register("newPassword")}
            />
            <p className="field-help">至少 12 字元，包含英文字母與數字。</p>
          </div>
          <div>
            <label htmlFor="confirm-password">確認新密碼</label>
            <input
              id="confirm-password"
              type="password"
              autoComplete="new-password"
              required
              {...register("confirmPassword")}
            />
          </div>
        </>
      )}
      {mode === "register" && (
        <div className="consent-fields">
          <label>
            <input type="checkbox" required {...register("termsAccepted")} />
            我已閱讀並同意
            <Link href="/terms" target="_blank">
              開發版服務條款
            </Link>
          </label>
          <label>
            <input type="checkbox" required {...register("privacyAccepted")} />
            我已閱讀並同意
            <Link href="/privacy" target="_blank">
              開發版隱私權政策
            </Link>
          </label>
          <p className="field-help">
            正式政策與入會規則仍待確認；註冊不授予正式會員資格。
          </p>
        </div>
      )}
      <button
        disabled={isSubmitting || (mode === "reset" && !token)}
        className="button button-primary"
        type="submit"
      >
        {isSubmitting
          ? "處理中…"
          : {
              login: "登入",
              register: "建立測試帳號",
              forgot: "寄送重設郵件",
              resend: "重新寄送驗證信",
              reset: "重設密碼",
              change: "更新密碼",
            }[mode]}
      </button>
      {message && (
        <p
          className={success ? "form-success" : "form-error"}
          role={success ? "status" : "alert"}
        >
          {message}
        </p>
      )}
      {mode === "login" && (
        <div className="auth-links">
          <Link href="/auth/register">註冊測試帳號</Link>
          <Link href="/auth/forgot-password">忘記密碼</Link>
          <Link href="/auth/verify">重新寄送驗證信</Link>
        </div>
      )}
      {["register", "forgot", "reset", "resend"].includes(mode) && (
        <Link className="text-link" href="/auth/login">
          返回登入 ↗
        </Link>
      )}
    </form>
  );
}
