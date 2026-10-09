import { t } from "../i18n/registry";
import type { MapAttachment } from "../model/types";

// Turn a picked file into a self-contained MapAttachment (a data URL + name + size). Inline storage
// keeps maps offline and portable — a .json export carries its attachments with it. Browser-only
// (FileReader), so verified in-browser rather than unit-tested. A size cap keeps maps from bloating.

/** Largest file we'll inline (bytes). Bigger files would balloon the map's JSON. */
export const MAX_ATTACHMENT_BYTES = 5 * 1024 * 1024;

export class AttachmentTooLargeError extends Error {}

export async function fileToAttachment(file: File): Promise<MapAttachment> {
  if (file.size > MAX_ATTACHMENT_BYTES) {
    throw new AttachmentTooLargeError(
      `"${file.name}" is ${formatBytes(file.size)} — attachments are capped at ${formatBytes(MAX_ATTACHMENT_BYTES)}.`,
    );
  }
  const dataUrl = await new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = () => reject(reader.error ?? new Error(t("io.err.couldNotReadFile")));
    reader.readAsDataURL(file);
  });
  return { name: file.name, dataUrl, size: file.size };
}

/** Human-readable byte size (e.g. "1.4 MB"). Pure. */
export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  const units = ["KB", "MB", "GB"];
  let n = bytes / 1024;
  let i = 0;
  while (n >= 1024 && i < units.length - 1) {
    n /= 1024;
    i += 1;
  }
  return `${n < 10 ? n.toFixed(1) : Math.round(n)} ${units[i]}`;
}
