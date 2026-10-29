import "@testing-library/jest-dom/vitest";
import { cleanup } from "@testing-library/react";

// El service worker solo existe en la web compilada: en los tests no hay version nueva que avisar.
vi.mock("virtual:pwa-register/react", () => ({
  useRegisterSW: () => ({ needRefresh: [false, () => undefined], offlineReady: [false, () => undefined], updateServiceWorker: async () => undefined }),
}));

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});
