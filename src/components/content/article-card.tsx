import Image from "next/image";
import Link from "next/link";
import type { Article } from "@/lib/catalog";
export function ArticleCard({ article }: { article: Article }) {
  return (
    <article className="article-card">
      <Link
        href={`/${article.kind}/${article.slug}`}
        className="article-card-link"
      >
        <div className="article-image">
          <Image
            src={article.image}
            width={600}
            height={400}
            alt={`${article.category}主題示範插畫`}
          />
        </div>
        <div className="article-body">
          <span className="tag">{article.category}</span>
          {article.featured && <span className="featured-label">精選</span>}
          <h2>{article.title}</h2>
          <p>{article.summary}</p>
          <div className="article-meta">
            <time dateTime={article.publishedAt}>
              {article.publishedAt.replaceAll("-", ".")}
            </time>
            <span>示範文章 ↗</span>
          </div>
        </div>
      </Link>
    </article>
  );
}
