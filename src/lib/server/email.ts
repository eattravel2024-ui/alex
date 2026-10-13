import "server-only";
import nodemailer from "nodemailer";
export async function sendAuthEmail(to: string, subject: string, url: string) {
  const host = process.env.SMTP_HOST;
  if (!host) throw new Error("SMTP is not configured");
  const isDev = process.env.DEVELOPMENT_MODE === "true";
  if (isDev && !["127.0.0.1", "localhost", "mail"].includes(host))
    throw new Error("Development SMTP must remain local.");
  if (
    !isDev &&
    process.env.SMTP_SECURE !== "true" &&
    process.env.SMTP_PORT !== "587"
  )
    throw new Error("Production SMTP requires TLS or STARTTLS");
  const transport = nodemailer.createTransport({
    host,
    port: Number(process.env.SMTP_PORT ?? 587),
    secure: process.env.SMTP_SECURE === "true",
    requireTLS: !isDev && process.env.SMTP_SECURE !== "true",
    ...(process.env.SMTP_USER
      ? {
          auth: {
            user: process.env.SMTP_USER,
            pass: process.env.SMTP_PASSWORD,
          },
        }
      : {}),
  });
  await transport.sendMail({
    from: process.env.SMTP_FROM,
    to,
    subject,
    text: `${isDev ? "【開發測試，不是協會正式郵件】\n" : ""}${subject}\n\n請使用以下安全連結完成操作：\n${url}\n\n若不是你提出的請求，請忽略本郵件。請勿轉寄此連結。`,
  });
}
