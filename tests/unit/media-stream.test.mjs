import test from "node:test";
import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { MediaReadError, readBoundedMediaBody } from "../../src/lib/media-stream.ts";

const runFile = promisify(execFile);

test("fragmented body bytes are preserved up to the exact limit", async () => {
  const expected = Buffer.from("multipart\u0000圖片\r\nbody");
  let offset = 0;
  let canceled = false;
  const stream = new ReadableStream({
    pull(controller) {
      if (offset === expected.length) controller.close();
      else controller.enqueue(expected.subarray(offset, ++offset));
    },
    cancel() { canceled = true; },
  });

  const body = await readBoundedMediaBody(stream.getReader(), expected.length, 1000);
  assert.ok(Buffer.isBuffer(body));
  assert.deepEqual(body, expected);
  assert.equal(canceled, false);
});

test("an oversized body is canceled and returns 413 even if cancellation fails", async () => {
  let canceled = false;
  const stream = new ReadableStream({
    start(controller) {
      controller.enqueue(Uint8Array.of(1, 2));
      controller.enqueue(Uint8Array.of(3, 4));
    },
    cancel() {
      canceled = true;
      throw new Error("Transport cancellation failed");
    },
  });

  await assert.rejects(readBoundedMediaBody(stream.getReader(), 3, 1000), (error) => {
    assert.ok(error instanceof MediaReadError);
    assert.equal(error.status, 413);
    assert.equal(error.code, "PAYLOAD_TOO_LARGE");
    return true;
  });
  assert.equal(canceled, true);
});

test("a stalled body is canceled when the total read deadline expires", async () => {
  let canceled = false;
  const stream = new ReadableStream({
    start(controller) { controller.enqueue(Uint8Array.of(1)); },
    cancel() {
      canceled = true;
      return new Promise(() => {});
    },
  });

  await assert.rejects(readBoundedMediaBody(stream.getReader(), 8, 20), (error) => {
    assert.ok(error instanceof MediaReadError);
    assert.equal(error.status, 408);
    assert.equal(error.code, "MEDIA_UPLOAD_TIMEOUT");
    return true;
  });
  assert.equal(canceled, true);
});

test("continuously available chunks still obey the total read deadline", async (context) => {
  let now = 1000;
  context.mock.method(Date, "now", () => now);
  let count = 0;
  let canceled = false;
  const reader = {
    async read() {
      now += 10;
      return ++count === 10
        ? { done: true, value: undefined }
        : { done: false, value: Uint8Array.of(count) };
    },
    async cancel() { canceled = true; },
  };

  await assert.rejects(readBoundedMediaBody(reader, 100, 25), {
    status: 408,
    code: "MEDIA_UPLOAD_TIMEOUT",
  });
  assert.equal(canceled, true);
  assert.equal(count, 3);
});

test("successful reads clear their deadline and expose only received bytes", async () => {
  let canceled = false;
  const stream = new ReadableStream({
    start(controller) {
      controller.enqueue(Uint8Array.of(10, 20));
      controller.close();
    },
  });
  const reader = stream.getReader();
  const observedReader = {
    read: () => reader.read(),
    cancel: () => {
      canceled = true;
      return reader.cancel();
    },
  };
  const body = await readBoundedMediaBody(observedReader, 1024, 20);
  assert.deepEqual(body, Buffer.from([10, 20]));
  await new Promise((resolve) => setTimeout(resolve, 40));
  assert.equal(canceled, false);
});

test("200,000 one-byte chunks retain bounded heap memory", async () => {
  const moduleUrl = new URL("../../src/lib/media-stream.ts", import.meta.url).href;
  const script = `
    import assert from "node:assert/strict";
    import { readBoundedMediaBody } from ${JSON.stringify(moduleUrl)};
    global.gc();
    const initialHeap = process.memoryUsage().heapUsed;
    let peakHeap = initialHeap;
    let count = 0;
    const stream = new ReadableStream({
      pull(controller) {
        if (count % 10000 === 0) {
          global.gc();
          peakHeap = Math.max(peakHeap, process.memoryUsage().heapUsed);
        }
        if (count === 200000) controller.close();
        else controller.enqueue(Uint8Array.of(count++ % 251));
      },
    });
    const body = await readBoundedMediaBody(stream.getReader(), 5 * 1024 * 1024);
    assert.equal(body.length, 200000);
    for (let index = 0; index < body.length; index++) {
      assert.equal(body[index], index % 251);
    }
    process.stdout.write(JSON.stringify({ heapGrowth: peakHeap - initialHeap }));
  `;
  const { stdout } = await runFile(process.execPath,
    ["--expose-gc", "--input-type=module", "-e", script],
    { timeout: 20000, maxBuffer: 4096 });
  const { heapGrowth } = JSON.parse(stdout);
  // The per-chunk arrays/deadline-handler implementation retained about 120 MB.
  assert.ok(heapGrowth < 32 * 1024 * 1024, `Fragmented body retained ${heapGrowth} heap bytes`);
});
