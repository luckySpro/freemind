// Ambient declarations for the File System Access API + Launch Queue API.
//
// lib.dom ships `FileSystemFileHandle` / `FileSystemWritableFileStream`, but as of
// TypeScript 5.9 it still omits the window-level pickers (`showOpenFilePicker`,
// `showSaveFilePicker`), the per-handle permission methods, and the PWA file-handling
// `launchQueue`. We use those for native open/save + Windows file association, so the
// few members we touch are declared here (deliberately minimal — not the full spec).

interface FilePickerAcceptType {
  description?: string;
  accept: Record<string, string | string[]>;
}

interface OpenFilePickerOptions {
  types?: FilePickerAcceptType[];
  multiple?: boolean;
  excludeAcceptAllOption?: boolean;
  /** Re-opens the picker in the directory last used for this id. */
  id?: string;
}

interface SaveFilePickerOptions {
  suggestedName?: string;
  types?: FilePickerAcceptType[];
  excludeAcceptAllOption?: boolean;
  id?: string;
}

interface FileSystemHandlePermissionDescriptor {
  mode?: "read" | "readwrite";
}

interface FileSystemHandle {
  queryPermission?(descriptor?: FileSystemHandlePermissionDescriptor): Promise<PermissionState>;
  requestPermission?(descriptor?: FileSystemHandlePermissionDescriptor): Promise<PermissionState>;
}

interface LaunchParams {
  readonly files: readonly FileSystemFileHandle[];
  readonly targetURL?: string;
}

interface LaunchQueue {
  setConsumer(consumer: (params: LaunchParams) => void): void;
}

interface Window {
  showOpenFilePicker?(options?: OpenFilePickerOptions): Promise<FileSystemFileHandle[]>;
  showSaveFilePicker?(options?: SaveFilePickerOptions): Promise<FileSystemFileHandle>;
  readonly launchQueue?: LaunchQueue;
}
