import Link from "next/link";
export default function NotFound() {
  return (
    <div className="error-panel">
      <p className="eyebrow">404</p>
      <h1>找不到這個頁面</h1>
      <p>頁面可能尚未建立，請回到首頁繼續瀏覽。</p>
      <Link className="button button-primary" href="/">
        返回首頁 ↗
      </Link>
    </div>
  );
}
