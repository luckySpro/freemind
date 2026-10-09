// Test stub for the build-time virtual module `virtual:pwa-register` (aliased here
// in vitest.config.ts). Lets tests register the SW callbacks and fire them
// deterministically, and inspect updateSW(reload?) calls.

export type RegisterSWOptions = {
  onNeedRefresh?: () => void;
  onOfflineReady?: () => void;
  onRegistered?: (r: ServiceWorkerRegistration | undefined) => void;
  onRegisterError?: (e: unknown) => void;
};
type UpdateSW = (reloadPage?: boolean) => Promise<void>;

let lastOptions: RegisterSWOptions | null = null;
let updateCalls: Array<boolean | undefined> = [];
let registerCount = 0;

export const registerSW = (options: RegisterSWOptions = {}): UpdateSW => {
  lastOptions = options;
  registerCount += 1;
  return async (reloadPage?: boolean) => {
    updateCalls.push(reloadPage);
  };
};

export const __getLastRegisterSWOptions = () => lastOptions;
export const __getUpdateCalls = () => updateCalls;
export const __getRegisterCount = () => registerCount;
export const __resetPwaRegisterStub = () => {
  lastOptions = null;
  updateCalls = [];
  registerCount = 0;
};
export const __triggerNeedRefresh = () => lastOptions?.onNeedRefresh?.();
export const __triggerOfflineReady = () => lastOptions?.onOfflineReady?.();
