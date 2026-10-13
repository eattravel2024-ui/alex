import { NextResponse, type NextRequest } from "next/server";
import { db } from "@/lib/server/db";
import { publishedWhere } from "@/lib/services/content-service";

// A public article's missing/draft state must set HTTP status before Next's
// loading boundary can flush a 200 stream. Pages still perform their own lookup.
export async function proxy(request: NextRequest) {
  const [, , rawSlug] = request.nextUrl.pathname.split("/");
  if (!rawSlug) return NextResponse.next();
  let slug: string;
  try {
    slug = decodeURIComponent(rawSlug);
  } catch {
    slug = "";
  }
  const kind = request.nextUrl.pathname.startsWith("/news/")
    ? "news"
    : "knowledge";
  const article =
    /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug) && slug.length <= 100
      ? await db.articleRecord.findFirst({
          where: { ...publishedWhere(), kind, slug },
          select: { id: true },
        })
      : null;
  if (!article) {
    const destination = new URL("/_not-found", request.url);
    return NextResponse.rewrite(destination, {
      status: 404,
      headers: { "Cache-Control": "no-store" },
    });
  }
  return NextResponse.next();
}
export const config = { matcher: ["/news/:slug", "/knowledge/:slug"] };
