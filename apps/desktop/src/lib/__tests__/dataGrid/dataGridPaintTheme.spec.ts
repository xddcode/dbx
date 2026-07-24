import { describe, expect, it } from "vitest";
import { resolveDataGridPaintTheme } from "@/lib/dataGrid/dataGridPaintTheme";

describe("resolveDataGridPaintTheme", () => {
  it("reads semantic success/warning tokens when present", () => {
    const vars: Record<string, string> = {
      "--background": "rgb(255, 255, 255)",
      "--foreground": "rgb(10, 10, 10)",
      "--muted-foreground": "rgb(115, 115, 115)",
      "--primary": "rgb(23, 23, 23)",
      "--destructive": "rgb(231, 0, 11)",
      "--accent": "rgb(245, 245, 245)",
      "--border": "rgb(229, 229, 229)",
      "--muted": "rgb(245, 245, 245)",
      "--success": "rgb(22, 163, 74)",
      "--warning": "rgb(217, 119, 6)",
      "--success-bg": "rgb(220, 252, 231)",
      "--warning-bg": "rgb(254, 243, 199)",
      "--color-error-bg": "rgb(254, 226, 226)",
    };

    const theme = resolveDataGridPaintTheme({
      getVar: (name) => vars[name] ?? "",
      isDark: false,
    });

    expect(theme.rowNumberTextNew).toBe("rgb(22, 163, 74)");
    expect(theme.rowNumberTextEdited).toBe("rgb(217, 119, 6)");
    expect(theme.rowNumberNew).toBe("rgb(220, 252, 231)");
    expect(theme.cellDirty).toBe("rgb(254, 243, 199)");
    expect(theme.rowDeleted).toBe("rgb(254, 226, 226)");
  });
});
