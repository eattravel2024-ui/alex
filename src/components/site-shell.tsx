"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import { navigation } from "@/lib/content";
export function SiteHeader() {
  const [open, setOpen] = useState(false);
  useEffect(() => {
    if (!open) return;
    const close = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", close);
    return () => window.removeEventListener("keydown", close);
  }, [open]);
  return (
    <header className="site-header">
      <div className="container header-inner">
        <Link href="/" className="brand" aria-label="中華健康管理協會首頁">
          <span className="brand-mark" aria-hidden="true">
            ✳
          </span>
          <span>
            中華健康管理協會<small>HEALTH MANAGEMENT ASSOCIATION</small>
          </span>
        </Link>
        <button
          className="menu-toggle"
          aria-expanded={open}
          aria-controls="primary-navigation"
          onClick={() => setOpen(!open)}
        >
          {open ? "關閉選單 ✕" : "開啟選單 ☰"}
        </button>
        <nav
          id="primary-navigation"
          aria-label="主要導覽"
          className={open ? "navigation is-open" : "navigation"}
        >
          {navigation.map((item) => (
            <Link
              onClick={() => setOpen(false)}
              key={item.href}
              href={item.href}
            >
              {item.label}
            </Link>
          ))}
          <Link
            onClick={() => setOpen(false)}
            className="nav-cta"
            href="/#membership"
          >
            會員服務 <span aria-hidden="true">↗</span>
          </Link>
        </nav>
      </div>
    </header>
  );
}
export function SiteFooter() {
  return (
    <footer className="site-footer">
      <div className="container footer-grid">
        <div>
          <Link className="brand" href="/">
            <span className="brand-mark" aria-hidden="true">
              ✳
            </span>
            <span>
              中華健康管理協會<small>讓健康，成為每個人的日常。</small>
            </span>
          </Link>
          <p>
            攜手連結健康知識與生活實踐。
            <br />
            此網站為開發中的示範版本。
          </p>
        </div>
        <div>
          <h2>探索協會</h2>
          {navigation.slice(0, 3).map((item) => (
            <Link key={item.href} href={item.href}>
              {item.label}
            </Link>
          ))}
        </div>
        <div>
          <h2>服務與支持</h2>
          <Link href="/events">活動與課程</Link>
          <Link href="/#membership">會員服務規劃</Link>
          <Link href="/contact">聯絡資訊</Link>
        </div>
        <div>
          <h2>法律與隱私</h2>
          <Link href="/privacy">隱私權政策草案</Link>
          <Link href="/terms">服務條款草案</Link>
          <p>正式協會資料待提供與確認。</p>
        </div>
      </div>
      <div className="container footer-bottom">
        <span>© {new Date().getFullYear()} 中華健康管理協會 · 示範網站</span>
        <span>健康知識僅供一般資訊參考，不能取代個別醫療建議。</span>
      </div>
    </footer>
  );
}
export function BackToTop() {
  const [visible, setVisible] = useState(false);
  useEffect(() => {
    const update = () => setVisible(window.scrollY > 500);
    update();
    window.addEventListener("scroll", update, { passive: true });
    return () => window.removeEventListener("scroll", update);
  }, []);
  return visible ? (
    <button
      className="back-to-top"
      aria-label="返回頂部"
      onClick={() =>
        window.scrollTo({
          top: 0,
          behavior: window.matchMedia("(prefers-reduced-motion: reduce)")
            .matches
            ? "instant"
            : "smooth",
        })
      }
    >
      ↑
    </button>
  ) : null;
}
