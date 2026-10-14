import { currentUser } from "@/lib/server/access";
import { canAdmin } from "@/lib/admin-permissions";
import { AccessDenied } from "@/components/admin/access-denied";
import { MediaLibrary } from "@/components/admin/media-library";
import { listMedia } from "@/lib/services/media-service";
export default async function Page() {
  const actor = await currentUser();
  if (!actor || !canAdmin(actor.role, "content")) return <AccessDenied />;
  return <><h2>媒體管理</h2><p>管理文章封面圖片與替代文字。文章或歷史版本使用中的圖片會保留。</p><MediaLibrary initial={await listMedia()} /></>;
}
