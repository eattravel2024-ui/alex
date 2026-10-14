import sharp from "sharp";

// Keep this module usable by the Node unit runner without application imports.
// This limit matches MAX_MEDIA_UPLOAD_BYTES in media-validation.ts.
const MAX_IMAGE_BYTES = 5 * 1024 * 1024;
const MAX_IMAGE_PIXELS = 16_000_000;
const PNG_SIGNATURE = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);

// Bound libvips workers and avoid retaining decoded uploads in its cache.
sharp.concurrency(1);
sharp.cache(false);

export class MediaImageError extends Error {
  readonly code: string;
  readonly status: 400 | 413;

  constructor(code: string, message: string, status: 400 | 413) {
    super(message);
    this.name = "MediaImageError";
    this.code = code;
    this.status = status;
  }
}

function invalidImage(): MediaImageError {
  return new MediaImageError(
    "MEDIA_IMAGE_INVALID",
    "請上傳完整且未含動畫的 PNG、JPEG 或 WebP 圖片。",
    400,
  );
}

function oversizedImage(): MediaImageError {
  return new MediaImageError(
    "MEDIA_IMAGE_TOO_LARGE",
    "圖片不得超過 5 MiB 或 1600 萬像素。",
    413,
  );
}

const crcTable = Uint32Array.from({ length: 256 }, (_, value) => {
  let crc = value;
  for (let bit = 0; bit < 8; bit++) {
    crc = crc & 1 ? 0xedb88320 ^ (crc >>> 1) : crc >>> 1;
  }
  return crc >>> 0;
});

function pngCrc(buffer: Buffer, start: number, end: number): number {
  let crc = 0xffffffff;
  for (let index = start; index < end; index++) {
    crc = crcTable[(crc ^ buffer[index]) & 0xff] ^ (crc >>> 8);
  }
  return (crc ^ 0xffffffff) >>> 0;
}

function validatePng(buffer: Buffer): void {
  let offset = PNG_SIGNATURE.length;
  let header = false;
  let pixels = false;
  while (offset + 12 <= buffer.length) {
    const length = buffer.readUInt32BE(offset);
    const end = offset + 12 + length;
    if (end > buffer.length) throw invalidImage();
    const type = buffer.toString("ascii", offset + 4, offset + 8);
    if (!/^[A-Za-z]{4}$/.test(type)) throw invalidImage();
    if (pngCrc(buffer, offset + 4, end - 4) !== buffer.readUInt32BE(end - 4)) {
      throw invalidImage();
    }
    if (!header && type !== "IHDR") throw invalidImage();
    if (type === "IHDR") {
      if (header || length !== 13) throw invalidImage();
      header = true;
    }
    // libvips can treat APNG as a static PNG, so inspect its container too.
    if (type === "acTL" || type === "fcTL" || type === "fdAT") {
      throw invalidImage();
    }
    if (type === "IDAT") pixels = true;
    if (type === "IEND") {
      if (length !== 0 || !pixels) throw invalidImage();
      return;
    }
    offset = end;
  }
  throw invalidImage();
}

function validateJpeg(buffer: Buffer): void {
  let offset = 2;
  let inScan = false;
  let scanned = false;
  let frames = 0;

  while (offset < buffer.length) {
    if (inScan) {
      // Entropy bytes allow FF00 escapes and restart markers. Other markers
      // return to the segment parser, including the required end-of-image.
      while (offset < buffer.length) {
        if (buffer[offset++] !== 0xff) continue;
        const markerStart = offset - 1;
        while (offset < buffer.length && buffer[offset] === 0xff) offset++;
        if (offset >= buffer.length) throw invalidImage();
        const marker = buffer[offset++];
        if (marker === 0 || (marker >= 0xd0 && marker <= 0xd7)) continue;
        offset = markerStart;
        inScan = false;
        break;
      }
      if (inScan) throw invalidImage();
    }

    if (buffer[offset++] !== 0xff) throw invalidImage();
    while (offset < buffer.length && buffer[offset] === 0xff) offset++;
    if (offset >= buffer.length) throw invalidImage();
    const marker = buffer[offset++];
    if (marker === 0xd9) {
      if (!scanned || frames !== 1) throw invalidImage();
      return;
    }
    if (marker === 0 || marker === 0xd8 || (marker >= 0xd0 && marker <= 0xd7)) {
      throw invalidImage();
    }
    if (marker === 0x01) continue;
    if (offset + 2 > buffer.length) throw invalidImage();
    const length = buffer.readUInt16BE(offset);
    const end = offset + length;
    if (length < 2 || end > buffer.length) throw invalidImage();
    if (
      marker >= 0xc0 && marker <= 0xcf &&
      marker !== 0xc4 && marker !== 0xc8 && marker !== 0xcc
    ) {
      if (++frames !== 1) throw invalidImage();
    }
    // MPO puts its multiple-image index in an APP2 MPF segment.
    if (marker === 0xe2 && buffer.toString("ascii", offset + 2, offset + 6) === "MPF\0") {
      throw invalidImage();
    }
    if (marker === 0xda) {
      scanned = true;
      inScan = true;
    }
    offset = end;
  }
  throw invalidImage();
}

function validateWebp(buffer: Buffer): void {
  const end = buffer.readUInt32LE(4) + 8;
  if (end > buffer.length || end < 12) throw invalidImage();
  let offset = 12;
  let images = 0;
  let extendedHeaders = 0;
  while (offset + 8 <= end) {
    const type = buffer.toString("ascii", offset, offset + 4);
    const length = buffer.readUInt32LE(offset + 4);
    const next = offset + 8 + length + (length & 1);
    if (next > end) throw invalidImage();
    if (type === "ANIM" || type === "ANMF") throw invalidImage();
    if (type === "VP8X") {
      if (++extendedHeaders !== 1 || length !== 10 || (buffer[offset + 8] & 2)) {
        throw invalidImage();
      }
    }
    if (type === "VP8 " || type === "VP8L") images++;
    offset = next;
  }
  if (offset !== end || images !== 1) throw invalidImage();
}

function imageFormat(buffer: Buffer): "png" | "jpeg" | "webp" {
  if (buffer.length >= 8 && buffer.subarray(0, 8).equals(PNG_SIGNATURE)) {
    validatePng(buffer);
    return "png";
  }
  if (buffer.length >= 3 && buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) {
    validateJpeg(buffer);
    return "jpeg";
  }
  if (
    buffer.length >= 12 &&
    buffer.toString("ascii", 0, 4) === "RIFF" &&
    buffer.toString("ascii", 8, 12) === "WEBP"
  ) {
    validateWebp(buffer);
    return "webp";
  }
  throw invalidImage();
}

export async function processMediaImage(
  buffer: Buffer,
  claimedMime: string,
): Promise<{ buffer: Buffer; width: number; height: number; mimeType: "image/webp" }> {
  if (!Buffer.isBuffer(buffer) || buffer.length === 0) throw invalidImage();
  if (buffer.length > MAX_IMAGE_BYTES) throw oversizedImage();

  const format = imageFormat(buffer);
  if (claimedMime !== `image/${format}`) throw invalidImage();

  try {
    const image = sharp(buffer, {
      failOn: "warning",
      limitInputPixels: MAX_IMAGE_PIXELS,
    });
    const metadata = await image.metadata();
    if (
      metadata.format !== format ||
      !metadata.width || !metadata.height ||
      (metadata.pages ?? 1) !== 1
    ) throw invalidImage();
    if (metadata.width * metadata.height > MAX_IMAGE_PIXELS) throw oversizedImage();

    // Default Sharp output drops EXIF, XMP, ICC and other source metadata.
    const result = await image
      .autoOrient()
      .resize({ width: 1600, height: 1200, fit: "inside", withoutEnlargement: true })
      .webp({ quality: 82 })
      .toBuffer({ resolveWithObject: true });

    if (result.data.length > MAX_IMAGE_BYTES) throw oversizedImage();
    return {
      buffer: result.data,
      width: result.info.width,
      height: result.info.height,
      mimeType: "image/webp",
    };
  } catch (error) {
    if (error instanceof MediaImageError) throw error;
    // The decoder rejects oversized headers before allocating their pixels.
    if (error instanceof Error && /pixel limit/i.test(error.message)) {
      throw oversizedImage();
    }
    throw invalidImage();
  }
}
