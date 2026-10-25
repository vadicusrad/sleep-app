import { expect, it, vi } from "vitest";
const original = "{broken diary: important original content";
const memory = new Map([["quiet-hour-v1", original]]);
vi.stubGlobal("window", { dispatchEvent: vi.fn() });
vi.stubGlobal(
  "CustomEvent",
  class {
    constructor(
      public type: string,
      public detail: unknown,
    ) {}
  },
);
vi.stubGlobal("localStorage", {
  getItem: (k: string) => memory.get(k) ?? null,
  setItem: (k: string, v: string) => memory.set(k, v),
  removeItem: (k: string) => memory.delete(k),
});
const { useDiary, storageIssue } = await import("./store");
it("не перезаписывает нечитаемый дневник пустым или новым состоянием", () => {
  expect(storageIssue()).toContain("Исходные данные сохранены");
  useDiary.getState().setBirth("2025-12-25");
  expect(useDiary.getState().birthDate).toBe("2025-12-25");
  expect(memory.get("quiet-hour-v1")).toBe(original);
});
