import { db } from "@/lib/server/db";
import { currentUser } from "@/lib/server/access";
import { canAdmin } from "@/lib/admin-permissions";
import { mediaIdSchema } from "@/lib/media-validation";
import { readMediaFile } from "@/lib/server/media-storage";
import { publishedWhere } from "@/lib/services/content-service";
export const runtime = "nodejs";
const missing = () => new Response(null, { status: 404, headers: { "Cache-Control": "private, no-store", "X-Content-Type-Options": "nosniff" } });
export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const parsed = mediaIdSchema.safeParse((await params).id);
  if (!parsed.success) return missing();
  const id = parsed.data;
  const asset = await db.mediaAsset.findUnique({ where: { id } });
  if (!asset) return missing();
  const published = await db.articleRecord.findFirst({ where: { ...publishedWhere(), image: `/media/${id}` }, select: { id: true } });
  if (!published) {
    const actor = await currentUser(request.headers);
    if (!actor || !canAdmin(actor.role, "content")) return missing();
  }
  try {
    const buffer = await readMediaFile(id, asset.byteSize);
    return new Response(new Uint8Array(buffer), { headers: {
      "Content-Type": "image/webp", "Content-Length": String(buffer.length),
      "X-Content-Type-Options": "nosniff", "Cache-Control": "private, no-store",
      "Content-Disposition": `inline; filename="${id}.webp"`,
      "Cross-Origin-Resource-Policy": "same-origin",
    } });
  } catch { return missing(); }
}
