import "server-only";
import { constants } from "node:fs";
import { mkdir, lstat, open, unlink, realpath } from "node:fs/promises";
import { isAbsolute, join, resolve, sep } from "node:path";
import { mediaIdSchema, MAX_MEDIA_UPLOAD_BYTES } from "@/lib/media-validation";
import { ServiceError } from "./access";

export function mediaDirectory() {
  const configured = process.env.MEDIA_STORAGE_DIR;
  const directory = configured || (process.env.DEVELOPMENT_MODE === "true"
    ? resolve(".local/media") : "");
  if (!directory || !isAbsolute(directory) || directory.split(sep).includes("public")) {
    throw new ServiceError(503, "MEDIA_STORAGE_UNAVAILABLE", "圖片儲存空間尚未設定，請聯絡管理員。");
  }
  return resolve(directory);
}
function filePath(id: string) {
  return join(mediaDirectory(), `${mediaIdSchema.parse(id)}.webp`);
}
export async function writeMediaFile(id: string, bytes: Buffer) {
  let created = false;
  try {
    const directory = mediaDirectory();
    await mkdir(directory, { recursive: true, mode: 0o750 });
    const info = await lstat(directory);
    if (!info.isDirectory() || info.isSymbolicLink() || await realpath(directory) !== directory) throw new Error("Unsafe directory");
    const file = await open(filePath(id), constants.O_WRONLY | constants.O_CREAT | constants.O_EXCL | constants.O_NOFOLLOW, 0o600);
    created = true;
    try { await file.writeFile(bytes); } finally { await file.close(); }
  } catch (error) {
    if (created) {
      try { await unlink(filePath(id)); } catch { console.error("Partial media file cleanup requires operator attention"); }
    }
    if (error instanceof ServiceError) throw error;
    throw new ServiceError(503, "MEDIA_STORAGE_UNAVAILABLE", "圖片儲存空間暫時無法使用，請聯絡管理員。");
  }
}
export async function readMediaFile(id: string, expectedSize: number) {
  const file = await open(filePath(id), constants.O_RDONLY | constants.O_NOFOLLOW);
  try {
    const info = await file.stat();
    if (!info.isFile() || info.size !== expectedSize || info.size > MAX_MEDIA_UPLOAD_BYTES) throw new Error("Invalid media file");
    return await file.readFile();
  } finally { await file.close(); }
}
export async function removeMediaFile(id: string) {
  try { await unlink(filePath(id)); } catch (error) {
    if (!(error && typeof error === "object" && "code" in error && error.code === "ENOENT")) throw error;
  }
}
