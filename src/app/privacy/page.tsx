import Link from "next/link";
export const metadata = { title: "隱私權政策草案" };
export default function Page() {
  return (
    <article className="legal-page">
      <nav className="breadcrumb" aria-label="麵包屑">
        <Link href="/">首頁</Link> / 隱私權政策草案
      </nav>
      <p className="eyebrow">DRAFT · 尚未正式生效</p>
      <h1>隱私權政策草案</h1>
      <p>
        本頁為待法律專業與協會確認的草案，不代表正式政策。目前版本不提供註冊、表單提交或追蹤分析。後續將說明蒐集目的、資料類型、保留期限、處理方式、當事人權利與聯絡窗口。不得預設蒐集身分證字號或醫療紀錄。
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
