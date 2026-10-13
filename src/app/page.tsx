import Image from "next/image";
import { ActionLink, SectionHeading } from "@/components/ui";
import Link from "next/link";
import { ArticleCard } from "@/components/content/article-card";
import { listPublicEvents } from "@/lib/services/event-service";
import { listPublishedArticles } from "@/lib/services/content-service";
export const dynamic = "force-dynamic";
import { pageMetadata } from "@/lib/seo";
export const metadata = pageMetadata(
  "中華健康管理協會｜讓健康成為日常",
  "協會官方網站開發示範：健康知識、最新消息與活動課程。",
  "/",
);
export default async function Home() {
  const [newsArticles, knowledgeArticles, eventRecords] = await Promise.all([
    listPublishedArticles("news", 3),
    listPublishedArticles("knowledge", 3),
    listPublicEvents({}, 3),
  ]);
  return (
    <>
      <div className="demo-notice">
        開發示範版本{" "}
        <span>協會介紹、活動及文章皆為示範內容，正式資料待確認。</span>
      </div>
      <section className="hero">
        <div className="container hero-grid">
          <div className="hero-copy">
            <p className="eyebrow">
              <span className="status-dot" /> HEALTH FOR EVERYDAY LIFE
            </p>
            <h1>
              讓健康，
              <br />
              成為每個人的
              <br />
              <em>美好日常。</em>
            </h1>
            <p className="hero-description">
              從理解健康，到實踐健康。
              <br />
              以知識連結彼此，以行動照顧生活，
              <br />
              一起走向更有品質的每一天。
            </p>
            <div className="actions">
              <ActionLink href="/about">認識協會</ActionLink>
              <ActionLink href="/events" secondary>
                探索活動與課程
              </ActionLink>
            </div>
            <div className="hero-caption">
              <span className="tiny-mark">✳</span> 以人為本 · 知識共享 ·
              健康同行
            </div>
          </div>
          <div className="hero-art">
            <Image
              src="/images/hero.svg"
              alt="綠色山丘、日光與枝葉構成的健康生活主視覺插畫"
              width={720}
              height={760}
              priority
            />
            <div className="art-label">
              <span>LIVE WELL, TOGETHER</span>
              <strong>
                每一個小改變，
                <br />
                都是更好的開始。
              </strong>
            </div>
            <div className="art-seal" aria-hidden="true">
              健康
              <br />
              <span>與你同行</span>
            </div>
          </div>
        </div>
        <div className="container hero-bottom">
          <span>一起建立更好的健康生活文化</span>
          <a href="#about">
            向下探索 <span aria-hidden="true">↓</span>
          </a>
        </div>
      </section>
      <section id="about" className="section">
        <div className="container about-grid">
          <SectionHeading
            eyebrow="ABOUT THE ASSOCIATION"
            title="健康的未來，從我們一起開始。"
            text="我們期待成為健康知識與日常生活之間的橋梁，讓每個人都有機會理解健康、關心自己，也關心身邊的人。"
          />
          <div className="about-content">
            <p className="placeholder-label">協會理念示範文案</p>
            <p>
              透過知識推廣、跨領域交流與生活實踐，打造有溫度的健康管理平台。我們相信，健康不只是個人的目標，也是一份可以共同培養的生活文化。
            </p>
            <p>
              成立宗旨、沿革、組織架構、理監事及法律資訊，將於取得協會正式資料後補充。
            </p>
            <a className="text-link" href="#services">
              了解我們的服務方向 <span aria-hidden="true">↗</span>
            </a>
          </div>
        </div>
      </section>
      <section id="services" className="section services-section">
        <div className="container">
          <SectionHeading
            eyebrow="WHAT WE DO"
            title="陪伴健康生活的每一步"
            text="從知識、交流到參與，建立相互支持的健康生活網絡。以下為服務方向示範。"
          />
          <div className="service-grid">
            {[
              {
                symbol: "◎",
                title: "健康知識推廣",
                text: "把專業議題轉化為易於理解的知識，協助建立健康生活觀念。",
                link: "#knowledge",
              },
              {
                symbol: "✳",
                title: "活動與課程交流",
                text: "透過講座、工作坊與交流活動，讓學習連結日常的實踐。",
                link: "#events",
              },
              {
                symbol: "↗",
                title: "會員連結與支持",
                text: "規劃多元會員服務，讓理念相近的夥伴一起參與健康推廣。",
                link: "#membership",
              },
            ].map((service, i) => (
              <a
                className="service-card"
                href={service.link}
                key={service.title}
              >
                <div className="card-top">
                  <span className="service-symbol" aria-hidden="true">
                    {service.symbol}
                  </span>
                  <span className="card-number">0{i + 1}</span>
                </div>
                <h3>{service.title}</h3>
                <p>{service.text}</p>
                <span className="card-arrow" aria-hidden="true">
                  ↗
                </span>
              </a>
            ))}
          </div>
        </div>
      </section>
      <section id="news" className="section services-section">
        <div className="container">
          <div className="section-top">
            <SectionHeading
              eyebrow="ASSOCIATION NEWS"
              title="掌握最新消息"
              text="認識網站建置與服務規劃；以下非協會正式公告。"
            />
            <Link className="text-link" href="/news">
              瀏覽所有消息 ↗
            </Link>
          </div>
          <div className="article-grid">
            {newsArticles.slice(0, 3).map((article) => (
              <ArticleCard key={article.slug} article={article} />
            ))}
          </div>
        </div>
      </section>
      <section id="knowledge" className="section">
        <div className="container">
          <div className="section-top">
            <SectionHeading
              eyebrow="HEALTH JOURNAL"
              title="給生活一點健康靈感"
              text="從小小的日常選擇，找到更適合自己的生活方式。"
            />
            <Link className="text-link" href="/knowledge">
              探索全部健康知識 ↗
            </Link>
          </div>
          <div className="article-grid">
            {knowledgeArticles.slice(0, 3).map((article) => (
              <ArticleCard key={article.slug} article={article} />
            ))}
          </div>
          <p className="medical-note">
            本區僅供一般健康知識參考，不構成個別診斷、療效保證或醫療建議。示範文章尚未經專業審閱。
          </p>
        </div>
      </section>
      <section id="events" className="section events-section">
        <div className="container event-grid">
          <div>
            <SectionHeading
              eyebrow="GATHER & GROW"
              title="讓每一次相聚，成為改變的契機。"
              text="與關心健康的夥伴一起交流，在學習與分享之間，找到實踐的力量。"
            />
            <div className="event-summary">
              <span aria-hidden="true">✳</span>
              <p>
                活動與課程預告
                <br />
                <small>以下為示範活動，報名狀態依活動顯示。</small>
              </p>
            </div>
          </div>
          <div className="event-list">
            {eventRecords.map((event, index) => (
              <article key={event.slug} className="event-row">
                <span className="event-index">
                  {String(index + 1).padStart(2, "0")}
                  <small>DEMO</small>
                </span>
                <div>
                  <span className="event-category">
                    {event.category} · {event.format}
                  </span>
                  <h3>
                    <Link href={`/events/${event.slug}`}>{event.title}</Link>
                  </h3>
                  <p>示範活動 · {event.startsAt.slice(0, 10)}</p>
                </div>
                <span className="event-status">{event.bookingLabel}</span>
              </article>
            ))}
          </div>
        </div>
      </section>
      <section id="membership" className="section">
        <div className="container membership-panel">
          <div>
            <p className="eyebrow">BETTER TOGETHER</p>
            <h2>
              健康同行，
              <br />
              從認識彼此開始。
            </h2>
            <p>期待與你一起，讓健康成為更有力量的日常。</p>
            <ActionLink href="/member" secondary>
              前往會員服務
            </ActionLink>
          </div>
          <div className="membership-note">
            <span className="large-mark" aria-hidden="true">
              ✳
            </span>
            <h3>會員服務開發版</h3>
            <p>
              已提供本機測試註冊、信箱驗證、登入與示範入會申請。網站帳號與協會正式會員資格分開管理，正式入會規則仍待協會確認。
            </p>
          </div>
        </div>
      </section>
      <section id="contact" className="section contact-section">
        <div className="container contact-grid">
          <SectionHeading
            eyebrow="STAY CONNECTED"
            title="期待，與你連結。"
            text="關於協會、合作或活動的詢問，可至聯絡頁查看示範表單與服務狀態。"
          />
          <div className="contact-card">
            <h3>正式聯絡資訊待提供</h3>
            <p>地址、電話、電子郵件及社群連結將以協會確認資料為準。</p>
            <div className="contact-divider" />
            <Link className="text-link" href="/contact">前往聯絡頁 ↗</Link>
            <p>
              <strong>聯絡表單示範已建置，電子報訂閱尚未開放</strong>
              <br />
              聯絡訊息可依網站設定儲存，不寄送郵件；正式聯絡窗口仍待確認。
            </p>
          </div>
        </div>
      </section>
    </>
  );
}
