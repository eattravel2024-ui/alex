import { PageHeading } from "@/components/content/page-heading";
import { pageMetadata } from "@/lib/seo";
import { publicPage } from "@/lib/services/site-page-service";
export const dynamic = "force-dynamic";
export const metadata = pageMetadata("關於協會", "認識協會的示範理念與網站服務規劃。正式組織與法律資料待確認。", "/about");
export default async function Page() {
  const content = await publicPage("about");
  const sections = content.sections.filter((s) => s.visible !== false);
  return <>
    <PageHeading title={content.title} description={content.description} eyebrow="ABOUT THE ASSOCIATION" items={[{ label: "關於協會" }]} />
    <section className="section"><div className="container about-page-grid">
      <nav className="about-side-nav" aria-label="協會介紹章節">{sections.map((s) => <a href={`#${s.id}`} key={s.id}>{s.heading}</a>)}</nav>
      <div className="prose"><p className="demo-warning">正式成立介紹、立案資訊、地址、統編與法律地位待協會提供。本頁不推定任何正式認證或組織資格。</p>{sections.map((s) => <section id={s.id} key={s.id}>
        <h2>{s.heading}</h2><p className="cms-page-text">{s.body}</p>
        {s.id === "mission" && <div className="mission-grid">{[["知識共享", "以易於理解的資訊，支持生活中的健康選擇。"], ["連結彼此", "透過活動與跨領域交流，建立支持網絡。"], ["日常實踐", "從可持續的小改變出發，尊重個別需求。"]].map(([title, text]) => <div key={title}><h3>{title}</h3><p>{text}</p></div>)}</div>}
      </section>)}</div>
    </div></section>
  </>;
}
