import {
  assertSameOrigin,
  requireAdmin,
  readJson,
  json,
  handleError,
} from "@/lib/server/access";
import { articleInputSchema } from "@/lib/article-validation";
import { saveArticle } from "@/lib/services/article-cms-service";
export async function POST(request: Request) {
  try {
    assertSameOrigin(request);
    const actor = await requireAdmin("content", request.headers);
    return json(
      await saveArticle(
        actor.id,
        articleInputSchema.parse(await readJson(request, 65536)),
      ),
      201,
    );
  } catch (error) {
    return handleError(error);
  }
}
