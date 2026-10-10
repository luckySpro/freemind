import { isTauri } from "@tauri-apps/api/core";
import { t } from "../i18n";

/** Trigger a browser download of a Blob as `filename` — an object URL behind a transient <a>, revoked
 *  right after the click. The one place the download mechanism lives (export handlers, the map-card
 *  "download", and the save-picker fallback all share it). */
export function downloadBlob(blob: Blob, filename: string): void {
  void downloadBlobAwaited(blob, filename).catch((error: unknown) => {
    window.alert(
      t("writing.exportFailed", {
        error: error instanceof Error ? error.message : String(error),
      }),
    );
  });
}

/** Await a native save or browser download so upgrade backups can report failure before restarting. */
export async function downloadBlobAwaited(blob: Blob, filename: string): Promise<void> {
  if (isTauri()) {
    await saveNativeExport(blob, filename);
    return;
  }
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

async function saveNativeExport(blob: Blob, filename: string): Promise<void> {
  const { save } = await import("@tauri-apps/plugin-dialog");
  const { writeFile } = await import("@tauri-apps/plugin-fs");
  const extension = filename.split(".").pop() ?? "";
  const path = await save({
    defaultPath: filename,
    filters: [{ name: extension.toUpperCase(), extensions: [extension] }],
  });
  if (!path) return;
  await writeFile(path, new Uint8Array(await blob.arrayBuffer()));
}
