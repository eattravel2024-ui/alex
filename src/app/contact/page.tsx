import Link from "next/link";
import { PageHeading } from "@/components/content/page-heading";
import { pageMetadata } from "@/lib/seo";
export const metadata = pageMetadata(
  "聯絡我們",
  "協會聯絡資訊及常見問題。正式聯絡資料與提交服務待建置。",
  "/contact",
);
const faqs = [
  {
    q: "網站帳號是否等於協會正式會員？",
    a: "不是。網站帳號與協會正式會員資格將分開管理。入會資格、審核及會費規則須由協會確認，目前尚未開放註冊或入會申請。",
  },
  {
    q: "可以報名網站上的活動嗎？",
    a: "目前展示的是示範活動，日期與議程屬測試資料，報名尚未開放。正式活動發布後才會依確認的規則提供報名。",
  },
  {
    q: "健康文章可以代替專業診斷嗎？",
    a: "不可以。內容僅供一般知識參考，不能取代個別診斷或醫療建議。現有示範文章尚未專業審閱。",
  },
  {
    q: "如何聯絡或提出合作需求？",
    a: "協會地址、電話、電子郵件與社群連結尚未提供。取得確認資料後會在本頁公布。聯絡表單將在資料庫及垃圾訊息防護完成後開放。",
  },
  {
    q: "網站會收集我的資料嗎？",
    a: "目前沒有開放註冊、聯絡提交、電子報訂閱或網站追蹤。未來服務啟用前會更新隱私權政策，說明蒐集目的、保留期限與權利行使方式。",
  },
];
export default function Page() {
  return (
    <>
      <PageHeading
        title="期待，與你連結。"
        description="關於協會、合作與活動，我們期待未來能與你交流。"
        eyebrow="STAY CONNECTED"
        items={[{ label: "聯絡我們" }]}
      />
      <section className="section">
        <div className="container contact-grid">
          <div>
            <h2>協會聯絡資訊</h2>
            <div className="contact-card contact-details">
              <dl>
                <dt>地址與地圖</dt>
                <dd>正式地址待提供，未嵌入未知地點。</dd>
                <dt>電話、電子郵件</dt>
                <dd>正式聯絡窗口待提供。</dd>
                <dt>社群連結</dt>
                <dd>官方帳號待協會確認。</dd>
              </dl>
            </div>
          </div>
          <div className="contact-card">
            <h2>聯絡表單建置中</h2>
            <p>
              目前不接受資料提交，避免在資料庫與安全處理尚未完成時蒐集個資。
            </p>
            <p>
              表單開放後將支援必要欄位驗證、垃圾訊息防護與後台處理，並於送出前提供隱私告知。
            </p>
            <Link className="text-link" href="/privacy">
              閱讀隱私權政策草案 ↗
            </Link>
          </div>
        </div>
      </section>
      <section className="section faq-section">
        <div className="container faq-container">
          <p className="eyebrow">FREQUENTLY ASKED QUESTIONS</p>
          <h2>常見問題</h2>
          {faqs.map((faq) => (
            <details className="faq-item" key={faq.q}>
              <summary>{faq.q}</summary>
              <p>{faq.a}</p>
            </details>
          ))}
        </div>
      </section>
    </>
  );
}
