import { describe, expect, it } from "vitest";
import {
  defaultLocale,
  getMessages,
  readStoredLocale,
  saveStoredLocale,
  supportedLocales,
  type Locale
} from "./i18n";

describe("i18n configuration", () => {
  it("keeps the supported language options in one place", () => {
    expect(defaultLocale).toBe("en");
    expect(supportedLocales).toEqual([
      { code: "en", label: "English" },
      { code: "zh", label: "中文" }
    ]);
  });

  it("provides settings copy for every supported language", () => {
    for (const { code } of supportedLocales) {
      const messages = getMessages(code as Locale);

      expect(messages.nav.settings).toBeTruthy();
      expect(messages.hero.title).toBeTruthy();
      expect(messages.setup.createProject).toBeTruthy();
      expect(messages.settings.title).toBeTruthy();
      expect(messages.settings.executionTitle).toBeTruthy();
      expect(messages.workbench.firstProjectTitle).toBeTruthy();
      expect(messages.settings.languageLabel).toBeTruthy();
      expect(messages.progress.artifacts).toBeTruthy();
      expect(messages.progress.workflowTemplates).toBeTruthy();
      expect(messages.workspace.taskBoardHeading).toBeTruthy();
      expect(messages.taskStatus.init).toBeTruthy();
    }
  });

  it("provides Chinese copy for the home surface", () => {
    const messages = getMessages("zh");

    expect(messages.nav.controlRoom).toBe("首页");
    expect(messages.hero.title).toBe("AI 工作编排控制平面。");
    expect(messages.hero.createRequirement).toBe("创建需求");
    expect(messages.status.ready).toBe("就绪");
  });

  it("keeps the legacy draft term out of visible product copy", () => {
    const allCopy = JSON.stringify(getMessages("en")) + JSON.stringify(getMessages("zh"));

    expect(allCopy).not.toMatch(/Task\s+Draft/);
    expect(allCopy).not.toContain("评审队列");
  });

  it("does not expose server connection copy in the workbench locale bundle", () => {
    expect("connection" in getMessages("en")).toBe(false);
    expect("connection" in getMessages("zh")).toBe(false);
  });

  it("persists the selected language", () => {
    const values = new Map<string, string>();
    const storage = {
      getItem: (key: string) => values.get(key) ?? null,
      setItem: (key: string, value: string) => values.set(key, value)
    };

    expect(readStoredLocale(storage)).toBe(defaultLocale);

    saveStoredLocale(storage, "zh");

    expect(readStoredLocale(storage)).toBe("zh");
  });
});
