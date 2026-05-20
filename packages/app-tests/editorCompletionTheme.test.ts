import { strict as assert } from "node:assert";
import test from "node:test";
import {
  buildEditorFontThemeRules,
  buildSqlCompletionThemeRules,
  EDITOR_FONT_FAMILY_CSS_VAR,
  EDITOR_FONT_SIZE_CSS_VAR,
} from "../../apps/desktop/src/lib/editorThemes.ts";

test("sql completion theme styles the autocomplete popup", () => {
  const rules = buildSqlCompletionThemeRules();

  assert.ok(rules[".cm-tooltip.cm-tooltip-autocomplete"]);
  assert.deepEqual(rules[".cm-completionIcon"], {
    display: "none !important",
    height: "0",
    margin: "0",
    paddingRight: "0 !important",
    width: "0",
  });
  assert.deepEqual(rules[".cm-completionLabel"], {
    color: "inherit",
    fontFamily: "var(--font-mono, 'JetBrains Mono', 'SF Mono', monospace)",
    fontSize: "16px",
    fontWeight: "760",
    letterSpacing: "0",
  });
  assert.equal(rules[".cm-completionMatchedText"]?.color, "#5794f9");
  assert.equal(
    rules[".cm-tooltip.cm-tooltip-autocomplete > ul > li[aria-selected]"]?.background,
    "rgba(70, 75, 84, 0.86) !important",
  );
});

test("editor font theme reads size and family from CSS variables", () => {
  const rules = buildEditorFontThemeRules({ fixedHeight: true, scrollable: true });

  assert.equal(rules["&"]?.height, "100%");
  assert.equal(rules["&"]?.fontSize, `var(${EDITOR_FONT_SIZE_CSS_VAR}, 13px)`);
  assert.deepEqual(rules[".cm-content"], {
    fontFamily: `var(${EDITOR_FONT_FAMILY_CSS_VAR}, monospace)`,
  });
  assert.equal(rules[".cm-gutters"]?.fontSize, `var(${EDITOR_FONT_SIZE_CSS_VAR}, 13px)`);
  assert.deepEqual(rules[".cm-scroller"], { overflow: "auto" });
});
