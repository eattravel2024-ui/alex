import type { Metadata } from "next";
import { BackToTop, SiteFooter, SiteHeader } from "@/components/site-shell";
import "./globals.css";
export const metadata: Metadata = {
  title: {
    default: "中華健康管理協會｜讓健康成為日常",
    template: "%s｜中華健康管理協會",
  },
  description:
    "中華健康管理協會官方網站開發示範：健康知識、活動課程與會員服務。正式協會資料待確認。",
  robots: { index: false, follow: false },
};
export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="zh-Hant">
      <body>
        <a className="skip-link" href="#main-content">
          跳至主要內容
        </a>
        <SiteHeader />
        <main id="main-content">{children}</main>
        <SiteFooter />
        <BackToTop />
      </body>
    </html>
  );
}
