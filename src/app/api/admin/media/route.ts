import { requireAdmin, assertSameOrigin, json, handleError } from "@/lib/server/access";
import { beginMediaUpload, readMediaUpload } from "@/lib/server/media-upload";
import { mediaDirectory } from "@/lib/server/media-storage";
import { processMediaImage, MediaImageError } from "@/lib/media-image";
import { createMedia, listMedia } from "@/lib/services/media-service";
export const runtime = "nodejs";
export async function GET(request: Request) {
  try {
    await requireAdmin("content", request.headers);
    const query = new URL(request.url).searchParams;
    const page = query.get("page") || "1";
    return json(await listMedia(query.get("q") || "", /^[1-9]\d{0,5}$/.test(page) ? Number(page) : 1));
  } catch (error) { return handleError(error); }
}
export async function POST(request: Request) {
  let finish: (() => void) | undefined;
  try {
    assertSameOrigin(request);
    const actor = await requireAdmin("content", request.headers);
    mediaDirectory();
    finish = beginMediaUpload();
    const upload = await readMediaUpload(request);
    const image = await processMediaImage(upload.buffer, upload.mime);
    return json(await createMedia(actor.id, upload.altText, image), 201);
  } catch (error) {
    if (error instanceof MediaImageError) return json({ error: { code: error.code, message: error.message } }, error.status);
    return handleError(error);
  } finally { finish?.(); }
}
