import Image from "next/image";
import Link from "next/link";
import type { Article } from "@/lib/catalog";
import { getRelatedArticles } from "@/lib/services/content-service";
import { siteOrigin, serializeStructuredData } from "@/lib/seo";
import { Breadcrumb } from "./page-heading";
import { ArticleCard } from "./article-card";
import { BookmarkControl } from "@/components/member/bookmark-control";
import { ShareButton } from "./share-button";
import { ArticleParagraphs } from "./article-paragraphs";
export async function ArticleDetail({
  article,
  preview = false,
}: {
  article: Article;
  preview?: boolean;
}) {
  const title = article.kind === "news" ? "最新消息" : "健康知識",
    origin = siteOrigin(),
    related = preview
      ? []
      : await getRelatedArticles(article.kind, article.slug);
  return (
    <>
      <article className="article-detail container">
        {preview && (
          <p className="demo-warning">
            後台預覽 · 尚未對外發布的變更不會出現在前台
          </p>
        )}
        <Breadcrumb
          items={[
            { label: title, href: `/${article.kind}` },
            { label: article.title },
          ]}
        />
        <p className="eyebrow">
          {article.kind === "news" ? "ASSOCIATION NEWS" : "HEALTH JOURNAL"}
        </p>
        <span className="tag">{article.category}</span>
        <h1>{article.title}</h1>
        <p className="article-lead">{article.summary}</p>
        <div className="detail-meta">
          <span>
            發布：
            <time dateTime={article.publishedAt}>{article.publishedAt}</time>
            （示範日期）
          </span>
          <span>{article.author}</span>
        </div>
        <p className="demo-label">
          示範文章 · 非協會正式公告或經審閱的健康資訊
        </p>
        <Image
          className="detail-cover"
          src={article.image}
          unoptimized={article.image.startsWith("/media/")}
          width={960}
          height={640}
          alt={article.imageAlt || `${article.category}示範插畫`}
          priority
        />
        <div className="prose">
          {article.blocks.map((block, index) => (
            <section key={index}>
              <h2>{block.heading}</h2>
              <ArticleParagraphs paragraphs={block.paragraphs} />
            </section>
          ))}
          {article.kind === "knowledge" && (
            <aside className="reference-panel">
              <h2>來源與審閱資訊</h2>
              <p>最後審閱日期：{article.reviewedAt ?? "尚未專業審閱"}</p>
              <ul>
                {article.references.map((reference, index) => (
                  <li key={index}>
                    <a
                      href={reference.url}
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      {reference.title} ↗
                    </a>
                  </li>
                ))}
              </ul>
              <p>
                來源連結僅提供延伸閱讀，不表示來源機構審核或認可本文。本文為一般知識用途，不能取代診斷或個別醫療建議。
              </p>
            </aside>
          )}
        </div>
        <div className="detail-tags">
          {article.tags.map((tag) => (
            <Link
              className="tag"
              key={tag}
              href={`/${article.kind}?tag=${encodeURIComponent(tag)}`}
            >
              #{tag}
            </Link>
          ))}
        </div>
        {!preview && <ShareButton />}
        {!preview && article.kind === "knowledge" && (
          <BookmarkControl slug={article.slug} />
        )}
        {article.kind === "knowledge" && (
          <p className="medical-note">
            文章收藏僅供已登入且驗證信箱的帳號使用，目前不記錄閱讀次數。
          </p>
        )}
      </article>
      {!preview && (
        <section className="section related-section">
          <div className="container">
            <h2>延伸閱讀</h2>
            <div className="article-grid">
              {related.map((a) => (
                <ArticleCard key={a.slug} article={a} />
              ))}
            </div>
            <Link className="text-link" href={`/${article.kind}`}>
              返回{title}列表 ↗
            </Link>
          </div>
        </section>
      )}
      {!preview && origin && (
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: serializeStructuredData({
              "@context": "https://schema.org",
              "@type": "Article",
              headline: article.title,
              description: article.summary,
              url: `${origin}/${article.kind}/${article.slug}`,
              inLanguage: "zh-Hant",
              datePublished: article.publishedAt,
              isAccessibleForFree: true,
            }),
          }}
        />
      )}
    </>
  );
}
