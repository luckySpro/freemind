import { Channel, invoke, isTauri } from "@tauri-apps/api/core";

export interface UpdateInfo {
  id: number;
  version: string;
  currentVersion: string;
  notes?: string;
  kind?: "desktop" | "manual";
  downloadUrl?: string;
}

export interface UpdateProgress {
  downloaded: number;
  total?: number;
}

/** Browser/PWA remains offline; native backend restricts the release source. */
export async function checkForUpdate(accelerated = true): Promise<UpdateInfo | null> {
  if (!isTauri()) return null;
  return invoke<UpdateInfo | null>("freemind_check_update", { accelerated });
}

/** Caller must await document persistence before this can exit on Windows. */
export async function installUpdate(
  info: UpdateInfo,
  onProgress?: (progress: UpdateProgress) => void,
  accelerated = true,
): Promise<void> {
  const progress = new Channel<UpdateProgress>();
  progress.onmessage = (value) => onProgress?.(value);
  await invoke("freemind_install_update", { id: info.id, accelerated, progress });
}

export async function restartAfterUpdate(): Promise<void> {
  const { relaunch } = await import("@tauri-apps/plugin-process");
  await relaunch();
}
