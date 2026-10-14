import { Buffer } from "node:buffer";

export class MediaReadError extends Error {
  readonly status: number;
  readonly code: string;

  constructor(status: number, code: string, message: string) {
    super(message);
    this.name = "MediaReadError";
    this.status = status;
    this.code = code;
  }
}

/** Bound retained memory and total read time even for highly fragmented bodies. */
export async function readBoundedMediaBody(
  reader: ReadableStreamDefaultReader<Uint8Array>,
  limit: number,
  timeoutMs = 30000,
): Promise<Buffer> {
  const bytes = Buffer.allocUnsafe(limit);
  const expiresAt = Date.now() + timeoutMs;
  const timeoutError = () => new MediaReadError(
    408,
    "MEDIA_UPLOAD_TIMEOUT",
    "圖片上傳逾時，請重新上傳。",
  );

  async function readBody(): Promise<Buffer> {
    let size = 0;
    while (true) {
      const next = await reader.read();
      // Immediately resolving reads can keep timer callbacks from running.
      if (Date.now() >= expiresAt) {
        void reader.cancel().catch(() => {});
        throw timeoutError();
      }
      if (next.done) return bytes.subarray(0, size);
      if (size + next.value.byteLength > limit) {
        void reader.cancel().catch(() => {});
        throw new MediaReadError(
          413,
          "PAYLOAD_TOO_LARGE",
          "圖片上傳超過 5 MB 限制。",
        );
      }
      bytes.set(next.value, size);
      size += next.value.byteLength;
    }
  }

  let timer: ReturnType<typeof setTimeout>;
  const deadline = new Promise<never>((_, reject) => {
    timer = setTimeout(() => {
      reject(timeoutError());
      void reader.cancel().catch(() => {});
    }, timeoutMs);
  });

  try {
    // Racing once avoids retaining a deadline handler for every body chunk.
    return await Promise.race([readBody(), deadline]);
  } finally {
    clearTimeout(timer!);
  }
}
