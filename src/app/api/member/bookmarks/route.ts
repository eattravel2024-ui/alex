import {
  requireUser,
  assertSameOrigin,
  readJson,
  json,
  handleError,
} from "@/lib/server/access";
import { toggleBookmark } from "@/lib/services/member-service";
import { bookmarkSchema } from "@/lib/validation";
async function mutate(request: Request, remove: boolean) {
  try {
    assertSameOrigin(request);
    const user = await requireUser(request.headers);
    const input = bookmarkSchema.parse(await readJson(request));
    return json(await toggleBookmark(user.id, input.slug, remove));
  } catch (error) {
    return handleError(error);
  }
}
export async function POST(request: Request) {
  return mutate(request, false);
}
export async function DELETE(request: Request) {
  return mutate(request, true);
}

import { db } from "@/lib/server/db";
export async function GET(request: Request) {
  try {
    const user = await requireUser(request.headers);
    const slug = new URL(request.url).searchParams.get("slug") ?? "";
    const bookmark = await db.articleBookmark.findUnique({
      where: { userId_articleSlug: { userId: user.id, articleSlug: slug } },
    });
    return json({ saved: !!bookmark });
  } catch (error) {
    return handleError(error);
  }
}
