// @vitest-environment jsdom
//
// fileToAttachment needs a real FileReader (browser-only), so this file runs under jsdom — its
// FileReader reads a Blob/File to a data URL, exercising the real success path rather than a hand
// mock. The oversize guard + formatBytes are pure and assert the size cap + human-readable sizes.
import { describe, expect, it } from "vitest";
import {
  AttachmentTooLargeError,
  MAX_ATTACHMENT_BYTES,
  fileToAttachment,
  formatBytes,
} from "../src/io/attachment";

describe("formatBytes", () => {
  it("formats bytes / KB / MB / GB with one decimal under 10", () => {
    expect(formatBytes(512)).toBe("512 B");
    expect(formatBytes(1024)).toBe("1.0 KB");
    expect(formatBytes(1536)).toBe("1.5 KB");
    expect(formatBytes(5 * 1024 * 1024)).toBe("5.0 MB");
    expect(formatBytes(10 * 1024)).toBe("10 KB"); // at the ≥10 boundary, no decimal
    expect(formatBytes(25 * 1024 * 1024)).toBe("25 MB");
    expect(formatBytes(3 * 1024 ** 3)).toBe("3.0 GB");
  });
});

describe("fileToAttachment", () => {
  it("reads a small file into a data-URL attachment, preserving name + size", async () => {
    const file = new File(["hello world"], "notes.txt", { type: "text/plain" });
    const att = await fileToAttachment(file);
    expect(att.name).toBe("notes.txt");
    expect(att.size).toBe(file.size);
    expect(att.dataUrl.startsWith("data:")).toBe(true);
  });

  it("preserves the MIME type in the emitted data URL", async () => {
    const file = new File(["%PDF-1.4 fake"], "spec.pdf", { type: "application/pdf" });
    const att = await fileToAttachment(file);
    expect(att.dataUrl.startsWith("data:application/pdf")).toBe(true);
  });

  it("round-trips the bytes through the data URL (base64 of the content)", async () => {
    const file = new File(["AB"], "x.bin", { type: "application/octet-stream" });
    const att = await fileToAttachment(file);
    // "AB" → base64 "QUI="; the exact payload proves the contents (not just the prefix) survive.
    expect(att.dataUrl.endsWith(",QUI=")).toBe(true);
  });

  it("rejects a file over the size cap with AttachmentTooLargeError (before reading it)", async () => {
    // Construct an oversize File without allocating MAX+1 bytes: stub the size getter.
    const file = new File(["x"], "huge.zip", { type: "application/zip" });
    Object.defineProperty(file, "size", { value: MAX_ATTACHMENT_BYTES + 1 });
    await expect(fileToAttachment(file)).rejects.toBeInstanceOf(AttachmentTooLargeError);
    // the message names the file + the cap so the toast is actionable
    await expect(fileToAttachment(file)).rejects.toThrow(/huge\.zip/);
  });

  it("accepts a file exactly at the cap (boundary is inclusive)", async () => {
    const file = new File(["ok"], "edge.txt", { type: "text/plain" });
    Object.defineProperty(file, "size", { value: MAX_ATTACHMENT_BYTES });
    const att = await fileToAttachment(file);
    expect(att.size).toBe(MAX_ATTACHMENT_BYTES);
  });
});
