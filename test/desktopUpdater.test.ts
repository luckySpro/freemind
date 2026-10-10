import { beforeEach, describe, expect, it, vi } from "vitest";
import { checkForUpdate, installUpdate, restartAfterUpdate } from "../src/update/desktopUpdater";

const mocks = vi.hoisted(() => ({ native: true, invoke: vi.fn(), relaunch: vi.fn() }));
vi.mock("@tauri-apps/api/core", () => ({
  isTauri: () => mocks.native,
  invoke: mocks.invoke,
  Channel: class {
    onmessage?: (value: unknown) => void;
  },
}));
vi.mock("@tauri-apps/plugin-process", () => ({ relaunch: mocks.relaunch }));

beforeEach(() => {
  mocks.native = true;
  mocks.invoke.mockReset();
  mocks.relaunch.mockReset();
});

describe("desktop updater boundary", () => {
  it("never contacts an update server in a browser", async () => {
    mocks.native = false;
    expect(await checkForUpdate()).toBeNull();
    expect(mocks.invoke).not.toHaveBeenCalled();
  });
  it("returns verified native metadata and propagates offline errors", async () => {
    const info = { id: 2, version: "0.2.0", currentVersion: "0.1.3" };
    mocks.invoke.mockResolvedValueOnce(info).mockRejectedValueOnce(new Error("offline"));
    expect(await checkForUpdate()).toEqual(info);
    expect(mocks.invoke).toHaveBeenCalledWith("freemind_check_update", { accelerated: true });
    await expect(checkForUpdate(false)).rejects.toThrow("offline");
  });
  it("forwards progress reset on mirror fallback and retains install failures", async () => {
    const onProgress = vi.fn();
    mocks.invoke.mockImplementationOnce(async (_name, options) => {
      options.progress.onmessage({ downloaded: 200, total: 1000 });
      options.progress.onmessage({ downloaded: 0 });
      throw new Error("signature invalid");
    });
    await expect(
      installUpdate({ id: 2, version: "0.2.0", currentVersion: "0.1.3" }, onProgress),
    ).rejects.toThrow("signature invalid");
    expect(onProgress.mock.calls).toEqual([
      [{ downloaded: 200, total: 1000 }],
      [{ downloaded: 0 }],
    ]);
    expect(mocks.relaunch).not.toHaveBeenCalled();
  });
  it("supports progress-free installation and explicit relaunch only after success", async () => {
    mocks.invoke.mockImplementationOnce(async (_name, options) =>
      options.progress.onmessage({ downloaded: 10 }),
    );
    await installUpdate({ id: 2, version: "0.2.0", currentVersion: "0.1.3" }, undefined, false);
    expect(mocks.invoke.mock.calls[0][1].accelerated).toBe(false);
    await restartAfterUpdate();
    expect(mocks.relaunch).toHaveBeenCalledOnce();
  });
});
