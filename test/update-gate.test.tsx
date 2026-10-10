// @vitest-environment jsdom
import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import PwaUpdateGate from "../src/components/PwaUpdateGate";
import UpdateGate from "../src/components/UpdateGate";
import { checkForUpdate, installUpdate, restartAfterUpdate } from "../src/update/desktopUpdater";

vi.mock("../src/update/desktopUpdater", () => ({
  checkForUpdate: vi.fn(),
  installUpdate: vi.fn(),
  restartAfterUpdate: vi.fn(),
}));
const release = {
  id: 1,
  version: "0.2.0",
  currentVersion: "0.1.2",
  notes: "New document features",
};
const setup = (over: Partial<Parameters<typeof UpdateGate>[0]> = {}) => {
  const props = {
    checkNonce: 0,
    beforeInstall: vi.fn().mockResolvedValue(undefined),
    onBackup: vi.fn().mockResolvedValue(undefined),
    onCheckResult: vi.fn(),
    ...over,
  };
  const view = render(<UpdateGate {...props} />);
  return { ...view, props };
};
beforeEach(() => {
  vi.resetAllMocks();
  vi.mocked(checkForUpdate).mockResolvedValue(release);
  vi.mocked(installUpdate).mockResolvedValue(undefined);
  vi.mocked(restartAfterUpdate).mockResolvedValue(undefined);
  HTMLDialogElement.prototype.showModal = function () {
    this.open = true;
  };
});

describe("required desktop updates", () => {
  it("does not block work when an automatic offline check fails, but reports manual check failure", async () => {
    vi.mocked(checkForUpdate).mockRejectedValue(new Error("offline"));
    const { props, rerender } = setup();
    await waitFor(() => expect(checkForUpdate).toHaveBeenCalledOnce());
    expect(screen.queryByRole("dialog")).toBeNull();
    expect(props.onCheckResult).not.toHaveBeenCalled();
    rerender(<UpdateGate {...props} checkNonce={1} />);
    await waitFor(() => expect(props.onCheckResult).toHaveBeenCalledWith("failed"));
    expect(screen.queryByRole("dialog")).toBeNull();
  });

  it("reports up to date only after a successful manual check", async () => {
    vi.mocked(checkForUpdate).mockResolvedValue(null);
    const { props } = setup({ checkNonce: 1 });
    await waitFor(() => expect(props.onCheckResult).toHaveBeenCalledWith("current"));
    expect(screen.queryByRole("dialog")).toBeNull();
  });

  it("blocks Escape and app shortcuts, saves before downloading, and restarts only after installation", async () => {
    let saved!: () => void;
    const beforeInstall = vi.fn(
      () =>
        new Promise<void>((resolve) => {
          saved = resolve;
        }),
    );
    setup({ beforeInstall });
    const modal = await screen.findByRole("dialog");
    const cancel = new Event("cancel", { cancelable: true, bubbles: true });
    fireEvent(modal, cancel);
    expect(cancel.defaultPrevented).toBe(true);
    const escapeEvent = new KeyboardEvent("keydown", {
      key: "Escape",
      bubbles: true,
      cancelable: true,
    });
    fireEvent(modal, escapeEvent);
    expect(escapeEvent.defaultPrevented).toBe(true);
    (modal as HTMLDialogElement).open = false;
    fireEvent(modal, new Event("close"));
    expect((modal as HTMLDialogElement).open).toBe(true);
    const shortcut = vi.fn();
    window.addEventListener("keydown", shortcut);
    fireEvent.keyDown(modal, { key: "a", metaKey: true });
    window.removeEventListener("keydown", shortcut);
    expect(shortcut).not.toHaveBeenCalled();
    expect(screen.queryByLabelText("Close dialog")).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Save and update" }));
    expect(beforeInstall).toHaveBeenCalledOnce();
    expect(installUpdate).not.toHaveBeenCalled();
    await act(async () => {
      saved();
    });
    await waitFor(() => expect(restartAfterUpdate).toHaveBeenCalledOnce());
    expect(installUpdate).toHaveBeenCalledWith(release, expect.any(Function), true);
    expect(screen.getByRole("status").textContent).toContain("Restarting");
  });

  it("keeps the mandatory gate on saving or downloading failure and allows direct-route retry", async () => {
    const beforeInstall = vi
      .fn()
      .mockRejectedValueOnce(new Error("disk full"))
      .mockResolvedValue(undefined);
    vi.mocked(installUpdate).mockRejectedValueOnce(new Error("network"));
    setup({ beforeInstall });
    fireEvent.click(await screen.findByRole("button", { name: "Save and update" }));
    expect((await screen.findByRole("alert")).textContent).toContain("disk full");
    expect(installUpdate).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: "Retry update" }));
    await waitFor(() => expect(screen.getByRole("alert").textContent).toContain("network"));
    expect(restartAfterUpdate).not.toHaveBeenCalled();
    expect((screen.getByRole("dialog") as HTMLDialogElement).open).toBe(true);
    fireEvent.click(screen.getByRole("checkbox"));
    fireEvent.click(screen.getByRole("button", { name: "Retry update" }));
    await waitFor(() => expect(restartAfterUpdate).toHaveBeenCalledOnce());
    expect(installUpdate).toHaveBeenLastCalledWith(release, expect.any(Function), false);
  });

  it("opens Android installation without relaunching and keeps the gate until the new app is installed", async () => {
    vi.mocked(checkForUpdate).mockResolvedValue({ ...release, kind: "manual" });
    setup();
    fireEvent.click(await screen.findByRole("button", { name: "Save and download update" }));
    await waitFor(() =>
      expect(screen.getByRole("status").textContent).toContain("Install the downloaded package"),
    );
    expect(installUpdate).toHaveBeenCalledOnce();
    expect(restartAfterUpdate).not.toHaveBeenCalled();
    expect((screen.getByRole("dialog") as HTMLDialogElement).open).toBe(true);
  });

  it("renders indeterminate byte progress and handles a failed relaunch without dismissing the gate", async () => {
    vi.mocked(installUpdate).mockImplementation(async (_info, onProgress) => {
      onProgress?.({ downloaded: 1048576 });
    });
    vi.mocked(restartAfterUpdate).mockRejectedValue(new Error("restart failed"));
    setup();
    fireEvent.click(await screen.findByRole("button", { name: "Save and update" }));
    expect((await screen.findByRole("alert")).textContent).toContain("restart failed");
    expect((screen.getByRole("dialog") as HTMLDialogElement).open).toBe(true);
  });

  it("shows download progress, allows library backup and retains backup errors", async () => {
    let complete!: () => void;
    vi.mocked(installUpdate).mockImplementation(async (_info, onProgress) => {
      onProgress?.({ downloaded: 512, total: 1024 });
      await new Promise<void>((resolve) => {
        complete = resolve;
      });
    });
    const onBackup = vi
      .fn()
      .mockRejectedValueOnce(new Error("backup disk full"))
      .mockResolvedValue(undefined);
    setup({ onBackup });
    fireEvent.click(await screen.findByRole("button", { name: "Export library backup" }));
    expect((await screen.findByRole("alert")).textContent).toContain("backup disk full");
    fireEvent.click(screen.getByRole("button", { name: "Export library backup" }));
    await waitFor(() => expect(onBackup).toHaveBeenCalledTimes(2));
    fireEvent.click(screen.getByRole("button", { name: "Retry update" }));
    await waitFor(() => expect(screen.getByRole("progressbar").getAttribute("value")).toBe("50"));
    expect(
      (screen.getByRole("button", { name: "Export library backup" }) as HTMLButtonElement).disabled,
    ).toBe(true);
    await act(async () => {
      complete();
    });
  });
});

describe("required PWA updates", () => {
  it("keeps the gate and surfaces backup failures", async () => {
    render(
      <PwaUpdateGate
        beforeInstall={vi.fn()}
        refresh={vi.fn()}
        onBackup={vi.fn().mockRejectedValue("backup failed")}
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: "Export library backup" }));
    expect((await screen.findByRole("alert")).textContent).toContain("backup failed");
    expect((screen.getByRole("dialog") as HTMLDialogElement).open).toBe(true);
  });

  it("blocks dismissal and never activates a waiting worker before map persistence succeeds", async () => {
    const beforeInstall = vi
      .fn()
      .mockRejectedValueOnce(new Error("storage failure"))
      .mockResolvedValue(undefined);
    const refresh = vi.fn().mockResolvedValue(undefined);
    const onBackup = vi.fn().mockResolvedValue(undefined);
    render(<PwaUpdateGate beforeInstall={beforeInstall} refresh={refresh} onBackup={onBackup} />);
    const cancel = new Event("cancel", { cancelable: true, bubbles: true });
    fireEvent(screen.getByRole("dialog"), cancel);
    expect(cancel.defaultPrevented).toBe(true);
    const escapeEvent = new KeyboardEvent("keydown", {
      key: "Escape",
      bubbles: true,
      cancelable: true,
    });
    const modal = screen.getByRole("dialog") as HTMLDialogElement;
    fireEvent(modal, escapeEvent);
    expect(escapeEvent.defaultPrevented).toBe(true);
    modal.open = false;
    fireEvent(modal, new Event("close"));
    expect(modal.open).toBe(true);
    fireEvent.click(screen.getByRole("button", { name: "Export library backup" }));
    await waitFor(() => expect(onBackup).toHaveBeenCalledOnce());
    fireEvent.click(screen.getByRole("button", { name: "Save and update" }));
    expect((await screen.findByRole("alert")).textContent).toContain("storage failure");
    expect(refresh).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: "Save and update" }));
    await waitFor(() => expect(refresh).toHaveBeenCalledOnce());
  });
});
