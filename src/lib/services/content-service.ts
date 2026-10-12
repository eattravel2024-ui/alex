import { allArticles, eventRecords, type ArticleKind } from "@/lib/catalog";
export function getArticle(kind: ArticleKind, slug: string) {
  return allArticles.find((a) => a.kind === kind && a.slug === slug);
}
export function getRelatedArticles(kind: ArticleKind, slug: string) {
  const article = getArticle(kind, slug);
  return allArticles
    .filter((a) => a.kind === kind && a.slug !== slug)
    .sort(
      (a, b) =>
        Number(b.category === article?.category) -
        Number(a.category === article?.category),
    )
    .slice(0, 3);
}
export function getEvent(slug: string) {
  return eventRecords.find((e) => e.slug === slug);
}
