import Link from "next/link";
export const metadata = { title: "服務條款草案" };
export default function Page() {
  return (
    <article className="legal-page">
      <nav className="breadcrumb" aria-label="麵包屑">
        <Link href="/">首頁</Link> / 服務條款草案
      </nav>
      <p className="eyebrow">DRAFT · 尚未正式生效</p>
      <h1>服務條款草案</h1>
      <p>
        本頁為待協會及法律專業確認的草案。目前文章與活動均為示範，會員與報名功能尚未開放。後續將公布服務範圍、使用規範、正式入會規則、活動取消方式及爭議處理程序。
      </p>
      <h2>上線前必要確認</h2>
      <p>
        協會正式名稱與聯絡窗口、資料處理責任、政策版本與生效日期皆待確認。正式會員與活動服務啟用前，必須完成政策審閱。
      </p>
      <Link className="text-link" href="/">
        返回首頁 ↗
      </Link>
    </article>
  );
}
