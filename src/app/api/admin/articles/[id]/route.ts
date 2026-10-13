import { z } from "zod";
import {
  assertSameOrigin,
  requireAdmin,
  readJson,
  json,
  handleError,
} from "@/lib/server/access";
import { articleUpdateSchema } from "@/lib/article-validation";
import { saveArticle } from "@/lib/services/article-cms-service";
export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    assertSameOrigin(request);
    const actor = await requireAdmin("content", request.headers);
    const id = z.uuid().parse((await params).id);
    const { version, ...input } = articleUpdateSchema.parse(
      await readJson(request, 65536),
    );
    return json(await saveArticle(actor.id, input, id, version));
  } catch (error) {
    return handleError(error);
  }
}
