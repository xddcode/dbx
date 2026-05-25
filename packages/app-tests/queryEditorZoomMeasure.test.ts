import { readFileSync } from "node:fs";
import { strict as assert } from "node:assert";
import test from "node:test";

const source = readFileSync("apps/desktop/src/components/editor/QueryEditor.vue", "utf8");

test("query editor requests a fresh CodeMirror measure after live zoom updates", () => {
  assert.match(source, /syncEditorFontCssVars/);
});
