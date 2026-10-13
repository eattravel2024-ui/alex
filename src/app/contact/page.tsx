import { ContactForm } from "@/components/content/contact-form";
import { contactEnabled } from "@/lib/server/contact-settings";
export const dynamic = "force-dynamic";
import { PageHeading } from "@/components/content/page-heading";
import { pageMetadata } from "@/lib/seo";
export const metadata = pageMetadata(
  "聯絡我們",
  "協會聯絡資訊、示範聯絡表單與常見問題。",
  "/contact",
);
const faqs = [
  {
    q: "網站帳號是否等於協會正式會員？",
    a: "不是。網站帳號與協會正式會員資格將分開管理。入會資格、審核及會費規則須由協會確認，目前僅提供本機測試帳號與示範申請，正式入會尚未開放。",
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
    a: "協會地址、電話、電子郵件與社群連結尚未提供。取得確認資料後會在本頁公布。啟用示範表單後，可使用 @example.test 虛構信箱測試提交；訊息保存在資料庫，不寄送郵件，也不是正式聯絡管道。",
  },
  {
    q: "網站會收集我的資料嗎？",
    a: "目前提供本機測試帳號與申請資料儲存，啟用示範聯絡提交時會保存虛構姓名、信箱、詢問內容與同意時間，供工作人員測試。電子報訂閱與網站追蹤未開放。未來服務啟用前會更新隱私權政策，說明蒐集目的、保留期限與權利行使方式。",
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
          <ContactForm enabled={contactEnabled()} />
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
