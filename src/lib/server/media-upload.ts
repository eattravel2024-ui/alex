import "server-only";
import { MAX_MEDIA_UPLOAD_BYTES, mediaAltSchema } from "@/lib/media-validation";
import { ServiceError } from "./access";
import { readBoundedMediaBody, MediaReadError } from "@/lib/media-stream";
const MAX_MULTIPART_BYTES = MAX_MEDIA_UPLOAD_BYTES + 65536;
let uploads = 0;
export function beginMediaUpload() {
  if (uploads >= 2) throw new ServiceError(429, "MEDIA_BUSY", "正在處理其他圖片，請稍後重試。");
  uploads++;
  return () => { uploads--; };
}
export async function readMediaUpload(request: Request) {
  const contentType = request.headers.get("content-type") || "";
  if (!/^multipart\/form-data\s*;/i.test(contentType)) throw new ServiceError(400, "INVALID_UPLOAD", "請使用圖片上傳表單。");
  const reader = request.body?.getReader();
  if (!reader) throw new ServiceError(400, "INVALID_UPLOAD", "請選擇圖片。");
  let bytes: Buffer;
  try { bytes = await readBoundedMediaBody(reader, MAX_MULTIPART_BYTES); }
  catch (error) {
    if (error instanceof MediaReadError) throw new ServiceError(error.status, error.code, error.message);
    throw new ServiceError(400, "INVALID_UPLOAD", "圖片上傳中斷，請重新上傳。");
  }
  let form: FormData;
  try {
    form = await new Response(new Uint8Array(bytes), { headers: { "content-type": contentType } }).formData();
  } catch {
    throw new ServiceError(400, "INVALID_UPLOAD", "圖片上傳格式無效。");
  }
  if ([...form.keys()].some((key) => !["file", "altText"].includes(key)) || form.getAll("file").length !== 1 || form.getAll("altText").length !== 1) {
    throw new ServiceError(400, "INVALID_UPLOAD", "請提供一張圖片與替代文字。");
  }
  const file = form.get("file");
  if (!(file instanceof File) || !file.size) throw new ServiceError(400, "INVALID_UPLOAD", "請選擇非空白的圖片。");
  if (file.size > MAX_MEDIA_UPLOAD_BYTES) throw new ServiceError(413, "PAYLOAD_TOO_LARGE", "圖片上傳超過 5 MB 限制。");
  return { buffer: Buffer.from(await file.arrayBuffer()), mime: file.type, altText: mediaAltSchema.parse(form.get("altText")) };
}
