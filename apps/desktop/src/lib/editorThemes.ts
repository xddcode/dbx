import type { Extension } from "@codemirror/state";
import type { EditorTheme } from "@/stores/settingsStore";

type CodeMirrorStyleSpec = Parameters<typeof import("@codemirror/view").EditorView.theme>[0];

export const EDITOR_FONT_SIZE_CSS_VAR = "--dbx-editor-font-size";
export const EDITOR_FONT_FAMILY_CSS_VAR = "--dbx-editor-font-family";

/** Load a CodeMirror theme extension by theme name. */
export async function loadEditorTheme(theme: EditorTheme): Promise<Extension> {
  switch (theme) {
    case "one-dark":
      return (await import("@codemirror/theme-one-dark")).oneDark;
    case "vscode-dark":
      return (await import("@uiw/codemirror-theme-vscode")).vscodeDark;
    case "vscode-light":
      return (await import("@uiw/codemirror-theme-vscode")).vscodeLight;
    case "nord":
      return (await import("@uiw/codemirror-theme-nord")).nord;
    case "okaidia":
      return (await import("@uiw/codemirror-theme-okaidia")).okaidia;
    case "material":
      return (await import("@uiw/codemirror-theme-material")).materialDark;
    case "duotone-light":
      return (await import("@uiw/codemirror-theme-duotone")).duotoneLight;
    case "duotone-dark":
      return (await import("@uiw/codemirror-theme-duotone")).duotoneDark;
    case "xcode":
      return (await import("@uiw/codemirror-theme-xcode")).xcodeLight;
    default:
      return (await import("@codemirror/theme-one-dark")).oneDark;
  }
}

export function buildEditorFontThemeRules(
  opts?: { fixedHeight?: boolean; scrollable?: boolean },
  defaults?: { size?: number; family?: string },
): CodeMirrorStyleSpec {
  return {
    "&": {
      ...(opts?.fixedHeight ? { height: "100%" } : {}),
      fontSize: `var(${EDITOR_FONT_SIZE_CSS_VAR}, ${defaults?.size ?? 13}px)`,
    },
    ...(opts?.scrollable ? { ".cm-scroller": { overflow: "auto" } } : {}),
    ".cm-content": {
      fontFamily: `var(${EDITOR_FONT_FAMILY_CSS_VAR}, ${defaults?.family ?? "monospace"})`,
    },
    ".cm-gutters": {
      borderRight: "0 !important",
      fontSize: `var(${EDITOR_FONT_SIZE_CSS_VAR}, ${defaults?.size ?? 13}px)`,
      position: "relative",
    },
    ".cm-gutters:after": {
      background: "rgba(148, 163, 184, 0.38)",
      bottom: "0",
      content: "''",
      pointerEvents: "none",
      position: "absolute",
      right: "0",
      top: "0",
      width: "1px",
      zIndex: "10",
    },
    ".cm-lineNumbers .cm-gutterElement": {
      paddingRight: "16px",
    },
  };
}

/** Build a CodeMirror theme extension for font size + font family. */
export function editorFontTheme(
  EditorView: typeof import("@codemirror/view").EditorView,
  size: number,
  family: string,
  opts?: { fixedHeight?: boolean; scrollable?: boolean },
): Extension {
  return EditorView.theme(buildEditorFontThemeRules(opts, { size, family }));
}

export function buildSqlCompletionThemeRules(): CodeMirrorStyleSpec {
  return {
    ".cm-tooltip.cm-tooltip-autocomplete": {
      background: "#24272c",
      border: "1px solid rgba(10, 12, 16, 0.95)",
      borderRadius: "10px",
      boxShadow:
        "0 18px 42px rgba(0, 0, 0, 0.46), 0 0 0 1px rgba(255, 255, 255, 0.08) inset, 0 1px 0 rgba(255, 255, 255, 0.06) inset",
      color: "rgba(202, 207, 217, 0.95)",
      fontFamily: "var(--font-mono, 'JetBrains Mono', 'SF Mono', monospace)",
      minWidth: "420px",
      overflow: "hidden",
      padding: "6px 0",
    },
    ".cm-tooltip.cm-tooltip-autocomplete > ul": {
      maxHeight: "340px",
      minWidth: "420px",
      padding: "0 7px 0 !important",
      scrollbarColor: "rgba(148, 153, 162, 0.42) transparent",
      scrollbarWidth: "thin",
    },
    ".cm-tooltip.cm-tooltip-autocomplete > ul > li": {
      alignItems: "center",
      borderRadius: "6px",
      color: "rgba(199, 204, 214, 0.92)",
      display: "flex",
      fontSize: "16px",
      fontWeight: "760",
      height: "34px",
      letterSpacing: "0",
      lineHeight: "34px",
      padding: "0 18px !important",
      transition: "background-color 90ms ease, color 90ms ease",
    },
    ".cm-tooltip.cm-tooltip-autocomplete > ul > li[aria-selected]": {
      background: "rgba(70, 75, 84, 0.86) !important",
      color: "rgba(231, 235, 243, 0.98) !important",
    },
    ".cm-completionIcon": {
      display: "none !important",
      height: "0",
      margin: "0",
      paddingRight: "0 !important",
      width: "0",
    },
    ".cm-completionLabel": {
      color: "inherit",
      fontFamily: "var(--font-mono, 'JetBrains Mono', 'SF Mono', monospace)",
      fontSize: "16px",
      fontWeight: "760",
      letterSpacing: "0",
    },
    ".cm-completionMatchedText": {
      color: "#5794f9",
      fontWeight: "860",
      textDecoration: "none",
    },
    ".cm-completionDetail": {
      color: "rgba(184, 188, 198, 0.92)",
      fontSize: "16px",
      fontWeight: "760",
      fontStyle: "normal",
      marginLeft: "12px",
      opacity: "1",
    },
  };
}

export function sqlCompletionTheme(EditorView: typeof import("@codemirror/view").EditorView): Extension {
  return EditorView.theme(buildSqlCompletionThemeRules());
}
