import Link from "next/link";
import { requireUser } from "@/lib/server/access";
import { db } from "@/lib/server/db";
import { allArticles } from "@/lib/catalog";
export default async function Page() {
  const user = await requireUser();
  const bookmarks = await db.articleBookmark.findMany({
    where: { userId: user.id },
    orderBy: { createdAt: "desc" },
  });
  return (
    <>
      <h2>我的文章收藏</h2>
      {bookmarks.length ? (
        <ul className="bookmark-list">
          {bookmarks.map((b) => (
            <li key={b.id}>
              <Link href={"/knowledge/" + b.articleSlug}>
                {allArticles.find(
                  (a) => a.kind === "knowledge" && a.slug === b.articleSlug,
                )?.title ?? "文章已下架"}
              </Link>
            </li>
          ))}
        </ul>
      ) : (
        <p className="section-description">
          尚未收藏文章。
          <Link className="text-link" href="/knowledge">
            探索健康知識 ↗
          </Link>
        </p>
      )}
    </>
  );
}
