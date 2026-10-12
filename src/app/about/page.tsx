import { PageHeading } from "@/components/content/page-heading";
import { pageMetadata } from "@/lib/seo";
export const metadata = pageMetadata(
  "關於協會",
  "認識協會的示範理念與網站服務規劃。正式組織與法律資料待確認。",
  "/about",
);
export default function Page() {
  return (
    <>
      <PageHeading
        title="健康的未來，從我們一起開始。"
        description="讓知識貼近生活，讓每一次交流帶來更多可能。"
        eyebrow="ABOUT THE ASSOCIATION"
        items={[{ label: "關於協會" }]}
      />
      <section className="section">
        <div className="container about-page-grid">
          <nav className="about-side-nav" aria-label="協會介紹章節">
            {[
              ["intro", "協會簡介"],
              ["mission", "願景與使命"],
              ["history", "沿革與組織"],
              ["team", "理監事與顧問"],
              ["documents", "章程與文件"],
              ["partners", "合作單位"],
            ].map(([id, label]) => (
              <a href={`#${id}`} key={id}>
                {label}
              </a>
            ))}
          </nav>
          <div className="prose">
            <section id="intro">
              <h2>協會簡介</h2>
              <p>
                以下為可替換的示範文案：我們期待成為健康知識與日常實踐之間的橋梁，透過交流、學習與相互支持，讓更多人理解健康。
              </p>
              <p className="demo-warning">
                正式成立介紹、立案資訊、地址、統編與法律地位待協會提供。本頁不推定任何正式認證或組織資格。
              </p>
            </section>
            <section id="mission">
              <h2>願景與使命</h2>
              <p>
                示範理念：知識共享、健康同行、以人為本。實際成立宗旨與服務對象將以正式章程為準。
              </p>
              <div className="mission-grid">
                {[
                  ["知識共享", "以易於理解的資訊，支持生活中的健康選擇。"],
                  ["連結彼此", "透過活動與跨領域交流，建立支持網絡。"],
                  ["日常實踐", "從可持續的小改變出發，尊重個別需求。"],
                ].map(([title, text]) => (
                  <div key={title}>
                    <h3>{title}</h3>
                    <p>{text}</p>
                  </div>
                ))}
              </div>
            </section>
            <section id="history">
              <h2>沿革與組織架構</h2>
              <p>
                成立日期、重要里程碑、部門與組織關係尚未提供。此處將保留正式資料的展示位置，不以虛構年表替代。
              </p>
            </section>
            <section id="team">
              <h2>理事長、理監事與顧問團隊</h2>
              <p>
                姓名、職稱、照片、任期與介紹皆待本人及協會授權確認。目前不展示虛構人物或專業資格。
              </p>
            </section>
            <section id="documents">
              <h2>章程與重要文件</h2>
              <p>
                正式章程、入會辦法及其他公開文件待提供。尚無可下載文件；公開前需確認版本、隱私與分享權限。
              </p>
            </section>
            <section id="partners">
              <h2>合作單位</h2>
              <p>
                合作關係與 Logo
                使用權待確認，暫不列出任何未授權的機構名稱。正式資料後續將由管理後台維護。
              </p>
            </section>
          </div>
        </div>
      </section>
    </>
  );
}
