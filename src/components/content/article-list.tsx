import Link from "next/link";
import {
  allArticles,
  contentUrl,
  selectArticles,
  type ArticleKind,
  type SearchQuery,
} from "@/lib/catalog";
import { ArticleCard } from "./article-card";
import { PageHeading } from "./page-heading";
export function ArticleList({
  kind,
  query,
}: {
  kind: ArticleKind;
  query: SearchQuery;
}) {
  const title = kind === "news" ? "最新消息" : "健康知識",
    base = `/${kind}`,
    result = selectArticles(kind, query),
    categories = [
      ...new Set(
        allArticles.filter((a) => a.kind === kind).map((a) => a.category),
      ),
    ];
  return (
    <>
      <PageHeading
        title={title}
        description={
          kind === "news"
            ? "在這裡，了解網站建置與未來服務方向。"
            : "從日常的選擇開始，探索健康生活的知識與靈感。"
        }
        eyebrow={kind === "news" ? "ASSOCIATION NEWS" : "HEALTH JOURNAL"}
        items={[{ label: title }]}
      />
      <section className="section">
        <div className="container">
          <form action={base} className="search-panel" role="search">
            <div>
              <label htmlFor="article-query">搜尋文章</label>
              <input
                id="article-query"
                name="q"
                type="search"
                maxLength={120}
                defaultValue={result.q}
                placeholder="輸入關鍵字，例如：生活"
              />
            </div>
            <div>
              <label htmlFor="article-category">文章分類</label>
              <select
                id="article-category"
                name="category"
                defaultValue={result.category}
              >
                <option value="">全部分類</option>
                {categories.map((c) => (
                  <option key={c}>{c}</option>
                ))}
              </select>
            </div>
            {result.tag && (
              <input type="hidden" name="tag" value={result.tag} />
            )}
            <button className="button button-primary" type="submit">
              搜尋
            </button>
            <Link className="text-link search-reset" href={base}>
              清除篩選
            </Link>
          </form>
          {result.tag && (
            <p className="filter-note">
              標籤：{result.tag}{" "}
              <Link
                href={contentUrl(base, {
                  q: result.q,
                  category: result.category,
                })}
              >
                移除標籤 ×
              </Link>
            </p>
          )}
          <p className="results-summary" role="status">
            找到 {result.total} 篇示範文章 · 第 {result.page} / {result.pages}{" "}
            頁
          </p>
          {result.items.length ? (
            <div className="article-grid">
              {result.items.map((a) => (
                <ArticleCard key={a.slug} article={a} />
              ))}
            </div>
          ) : (
            <div className="empty-state">
              <h2>沒有符合條件的文章</h2>
              <p>試試其他關鍵字或清除篩選，重新探索內容。</p>
              <Link href={base} className="text-link">
                瀏覽全部文章 ↗
              </Link>
            </div>
          )}
          {result.pages > 1 && (
            <nav className="pagination" aria-label="文章分頁">
              {Array.from({ length: result.pages }, (_, i) => i + 1).map(
                (page) => (
                  <Link
                    key={page}
                    href={contentUrl(base, {
                      q: result.q,
                      category: result.category,
                      tag: result.tag,
                      page,
                    })}
                    aria-current={page === result.page ? "page" : undefined}
                    aria-label={`第 ${page} 頁`}
                  >
                    {page}
                  </Link>
                ),
              )}
            </nav>
          )}
          {kind === "knowledge" && (
            <p className="medical-note">
              一般知識用途，不能取代診斷與醫療建議。示範文章尚未經專業審閱。
            </p>
          )}
        </div>
      </section>
    </>
  );
}
