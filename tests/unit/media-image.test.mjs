import test from "node:test";
import assert from "node:assert/strict";
import { crc32 } from "node:zlib";
import sharp from "sharp";
import { MediaImageError, processMediaImage } from "../../src/lib/media-image.ts";
import {
  MAX_MEDIA_UPLOAD_BYTES,
  mediaAltSchema,
  mediaIdSchema,
  mediaImageId,
} from "../../src/lib/media-validation.ts";

const solidImage = (width = 48, height = 32) =>
  sharp({
    create: { width, height, channels: 3, background: "#6495ed" },
  });

async function assertRejected(buffer, mimeType, status = 400) {
  let rejection;
  await assert.rejects(processMediaImage(buffer, mimeType), (error) => {
    assert.ok(error instanceof MediaImageError);
    assert.equal(error.status, status);
    assert.equal(typeof error.code, "string");
    assert.ok(error.code.length > 0);
    assert.equal(typeof error.message, "string");
    assert.ok(error.message.length > 0);
    assert.doesNotMatch(
      error.message,
      /libvips|vipsforeign|libpng|vipspng|pngload|jpegload|webpload|input buffer|premature end|bad seek|not a known file format/i,
    );
    rejection = error;
    return true;
  });
  return rejection;
}

async function assertWebp(result, width, height) {
  assert.ok(Buffer.isBuffer(result.buffer));
  assert.equal(result.mimeType, "image/webp");
  assert.equal(result.width, width);
  assert.equal(result.height, height);
  assert.ok(result.buffer.length > 0);
  assert.ok(result.buffer.length <= MAX_MEDIA_UPLOAD_BYTES);
  const metadata = await sharp(result.buffer).metadata();
  assert.equal(metadata.format, "webp");
  assert.equal(metadata.width, width);
  assert.equal(metadata.height, height);
  assert.equal(metadata.exif, undefined);
  assert.equal(metadata.xmp, undefined);
  assert.equal(metadata.icc, undefined);
  assert.equal(metadata.orientation, undefined);
  assert.ok((metadata.pages ?? 1) === 1);
}

function framePixels() {
  const pixels = Buffer.alloc(8 * 16 * 3);
  for (let pixel = 0; pixel < 8 * 16; pixel++) {
    pixels[pixel * 3] = pixel < 8 * 8 ? 255 : 0;
    pixels[pixel * 3 + 2] = pixel < 8 * 8 ? 0 : 255;
  }
  return sharp(pixels, {
    raw: { width: 8, height: 16, channels: 3, pageHeight: 8 },
  });
}

function pngChunk(type, payload) {
  const chunk = Buffer.alloc(payload.length + 12);
  chunk.writeUInt32BE(payload.length, 0);
  chunk.write(type, 4, 4, "ascii");
  payload.copy(chunk, 8);
  chunk.writeUInt32BE(crc32(chunk.subarray(4, chunk.length - 4)), chunk.length - 4);
  return chunk;
}

test("media IDs preserve valid UUIDs and image paths must be canonical", () => {
  const ids = [
    "6ba7b810-9dad-11d1-80b4-00c04fd430c8",
    "123e4567-e89b-42d3-a456-426614174000",
    "01890a5d-ac96-7b8d-b131-084be7327989",
    "00000000-0000-0000-0000-000000000000",
    "ffffffff-ffff-ffff-ffff-ffffffffffff",
  ];
  for (const id of ids) {
    assert.equal(mediaIdSchema.parse(id), id);
    assert.equal(mediaImageId(`/media/${id}`), id);
  }
  assert.equal(mediaIdSchema.safeParse("not-a-uuid").success, false);
  assert.equal(
    mediaIdSchema.safeParse("123e4567-e89b-42d3-7456-426614174000").success,
    false,
  );
  const id = ids[1];
  for (const path of [
    `/media/${id.toUpperCase()}`,
    `/media/${id}/`,
    `/media/${id}?download=1`,
    `/media/${id}#image`,
    `/media/${id}.webp`,
    ` /media/${id}`,
    `/media/${id} `,
    `/media/${id}\n`,
    `/media/${id}\r\n`,
    `https://example.test/media/${id}`,
    `/media/${id.replaceAll("-", "%2D")}`,
    "/media/123e4567-e89b-42d3-7456-426614174000",
    "/media/../../secret",
    "/uploads/image.png",
    "",
  ]) {
    assert.ok(mediaImageId(path) == null, path);
  }
});

test("image alt text is trimmed, required, and bounded after trimming", () => {
  assert.equal(mediaAltSchema.parse("  社區健康活動  "), "社區健康活動");
  assert.equal(mediaAltSchema.parse(`  ${"a".repeat(160)}  `).length, 160);
  for (const value of ["", " \n\t ", "a".repeat(161), null, 123]) {
    assert.equal(mediaAltSchema.safeParse(value).success, false);
  }
});

test("actual JPEG, PNG, and WebP become stripped WebP without enlargement", async () => {
  for (const [format, mimeType] of [
    ["jpeg", "image/jpeg"],
    ["png", "image/png"],
    ["webp", "image/webp"],
  ]) {
    const input = await solidImage()[format]().toBuffer();
    await assertWebp(await processMediaImage(input, mimeType), 48, 32);
  }
});

test("claimed MIME must exactly match the real supported image format", async () => {
  const jpeg = await solidImage().jpeg().toBuffer();
  const png = await solidImage().png().toBuffer();
  const webp = await solidImage().webp().toBuffer();
  for (const mimeType of [
    "image/png",
    "image/webp",
    "image/jpg",
    "IMAGE/JPEG",
    "image/jpeg; charset=utf-8",
    "application/octet-stream",
    "",
  ]) {
    await assertRejected(jpeg, mimeType);
  }
  await assertRejected(png, "image/jpeg");
  await assertRejected(webp, "image/png");
});

test("GIF, SVG, spoofed signatures, and incomplete images are rejected safely", async () => {
  const gif = await solidImage().gif().toBuffer();
  const svg = Buffer.from(
    '<svg xmlns="http://www.w3.org/2000/svg" width="48" height="32"><rect width="48" height="32" fill="red"/></svg>',
  );
  const png = await solidImage().png().toBuffer();
  const jpeg = await solidImage().jpeg().toBuffer();
  for (const [input, mimeType] of [
    [gif, "image/gif"],
    [gif, "image/png"],
    [svg, "image/svg+xml"],
    [svg, "image/png"],
    [Buffer.alloc(0), "image/jpeg"],
    [Buffer.from("not an image"), "image/png"],
    [Buffer.from([0xff, 0xd8, 0xff, 0x00, 0x00, 0x00]), "image/jpeg"],
    [Buffer.concat([png.subarray(0, 8), Buffer.from("spoof")]), "image/png"],
    [png.subarray(0, Math.floor(png.length / 2)), "image/png"],
    [jpeg.subarray(0, Math.floor(jpeg.length / 2)), "image/jpeg"],
  ]) {
    await assertRejected(input, mimeType);
  }
});

test("animation and multiple image pages are rejected", async () => {
  for (const [format, mimeType] of [
    ["webp", "image/webp"],
    ["gif", "image/gif"],
    ["tiff", "image/tiff"],
  ]) {
    const input = await framePixels()[format]({
      delay: [100, 100],
      loop: 0,
    }).toBuffer();
    assert.equal((await sharp(input, { animated: true }).metadata()).pages, 2);
    await assertRejected(input, mimeType);
  }
});

test("missing only an image's final container bytes is rejected", async () => {
  const jpeg = await solidImage().jpeg().toBuffer();
  assert.deepEqual(jpeg.subarray(-2), Buffer.from([0xff, 0xd9]));
  await assertRejected(jpeg.subarray(0, -2), "image/jpeg");

  const png = await solidImage().png().toBuffer();
  assert.equal(png.toString("ascii", png.length - 8, png.length - 4), "IEND");
  await assertRejected(png.subarray(0, -12), "image/png");

  const webp = await solidImage().webp().toBuffer();
  assert.equal(webp.readUInt32LE(4) + 8, webp.length);
  await assertRejected(webp.subarray(0, -1), "image/webp");
});

test("PNG animation control and JPEG multiple-picture markers are rejected even when decoded as static", async () => {
  const png = await solidImage().png().toBuffer();
  assert.equal(png.toString("ascii", 12, 16), "IHDR");
  const animationControl = Buffer.alloc(8);
  animationControl.writeUInt32BE(2, 0);
  const animatedPng = Buffer.concat([
    png.subarray(0, 33),
    pngChunk("acTL", animationControl),
    png.subarray(33),
  ]);
  const pngMetadata = await sharp(animatedPng).metadata();
  assert.equal(pngMetadata.format, "png");
  assert.equal(pngMetadata.pages ?? 1, 1);
  assert.equal(
    (await sharp(animatedPng, { failOn: "warning" }).raw().toBuffer()).length,
    48 * 32 * 3,
  );
  await assertRejected(animatedPng, "image/png");

  const jpeg = await solidImage().jpeg().toBuffer();
  const multiplePictureJpeg = Buffer.concat([
    jpeg.subarray(0, 2),
    Buffer.from([0xff, 0xe2, 0, 6, 0x4d, 0x50, 0x46, 0]),
    jpeg.subarray(2),
  ]);
  assert.equal(
    (await sharp(multiplePictureJpeg, { failOn: "warning" }).raw().toBuffer())
      .length,
    48 * 32 * 3,
  );
  await assertRejected(multiplePictureJpeg, "image/jpeg");
});

test("invalid compressed PNG pixels with valid chunk checksums yield a sanitized image error", async () => {
  const png = await solidImage().png().toBuffer();
  const corruptPng = Buffer.from(png);
  let replacedIdat = false;
  for (let offset = 8; offset + 12 <= png.length; ) {
    const length = png.readUInt32BE(offset);
    if (png.toString("ascii", offset + 4, offset + 8) === "IDAT") {
      pngChunk("IDAT", Buffer.alloc(length)).copy(corruptPng, offset);
      replacedIdat = true;
      break;
    }
    offset += length + 12;
  }
  assert.equal(replacedIdat, true);
  assert.equal((await sharp(corruptPng).metadata()).width, 48);
  let decoderError;
  await assert.rejects(
    sharp(corruptPng, { failOn: "warning" }).raw().toBuffer(),
    (error) => {
      assert.ok(error instanceof Error);
      decoderError = error;
      return true;
    },
  );
  const publicError = await assertRejected(corruptPng, "image/png");
  assert.notEqual(publicError.message, decoderError.message);
});

test("upload byte and decoded pixel limits report 413", async () => {
  assert.equal(MAX_MEDIA_UPLOAD_BYTES, 5 * 1024 * 1024);
  const jpeg = await solidImage().jpeg().toBuffer();
  const oversizedUpload = Buffer.concat([
    jpeg,
    Buffer.alloc(MAX_MEDIA_UPLOAD_BYTES + 1 - jpeg.length),
  ]);
  await assertRejected(oversizedUpload, "image/jpeg", 413);
  const oversizedDimensions = await solidImage(4001, 4000).png().toBuffer();
  assert.ok(oversizedDimensions.length < MAX_MEDIA_UPLOAD_BYTES);
  await assertRejected(oversizedDimensions, "image/png", 413);
});

test("large landscape and portrait images fit inside 1600 by 1200", async () => {
  for (const [width, height, expectedWidth, expectedHeight] of [
    [3200, 1000, 1600, 500],
    [900, 2400, 450, 1200],
  ]) {
    const input = await solidImage(width, height).png().toBuffer();
    await assertWebp(
      await processMediaImage(input, "image/png"),
      expectedWidth,
      expectedHeight,
    );
  }
});

test("EXIF orientation is applied before resize and is removed from the output", async () => {
  const input = await solidImage(2400, 1200)
    .withMetadata({ orientation: 6 })
    .jpeg()
    .toBuffer();
  assert.equal((await sharp(input).metadata()).orientation, 6);
  await assertWebp(await processMediaImage(input, "image/jpeg"), 600, 1200);
});

test("re-encoding removes EXIF, XMP, and appended payloads", async () => {
  const exifMarker = "media-test-exif-payload";
  const xmpMarker = "media-test-xmp-payload";
  const appendedMarker = "<script>media-test-appended-payload</script>";
  const jpeg = await solidImage()
    .withExif({ IFD0: { ImageDescription: exifMarker } })
    .withXmp(
      `<x:xmpmeta xmlns:x="adobe:ns:meta/">${xmpMarker}</x:xmpmeta>`,
    )
    .jpeg()
    .toBuffer();
  const metadata = await sharp(jpeg).metadata();
  assert.ok(metadata.exif?.includes(Buffer.from(exifMarker)));
  assert.ok(metadata.xmp?.includes(Buffer.from(xmpMarker)));
  const input = Buffer.concat([jpeg, Buffer.from(appendedMarker)]);
  const result = await processMediaImage(input, "image/jpeg");
  await assertWebp(result, 48, 32);
  for (const marker of [exifMarker, xmpMarker, appendedMarker]) {
    assert.equal(result.buffer.includes(Buffer.from(marker)), false);
  }
});
