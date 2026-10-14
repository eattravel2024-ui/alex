import { z } from "zod";

export const MAX_MEDIA_UPLOAD_BYTES = 5 * 1024 * 1024;

export const mediaIdSchema = z.uuid();
export const mediaAltSchema = z.string().trim().min(1).max(160);

/** Only the canonical local media URL can become a stored media reference. */
export function mediaImageId(path: string): string | null {
  const match = /^\/media\/([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})$/.exec(path);
  return match && match[0] === path && mediaIdSchema.safeParse(match[1]).success
    ? match[1]
    : null;
}

export type MediaItem = {
  id: string;
  url: string;
  altText: string;
  width: number;
  height: number;
  byteSize: number;
  createdAt: string;
  version: number;
  used: boolean;
};

export type MediaList = {
  items: MediaItem[];
  page: number;
  pages: number;
  total: number;
};
