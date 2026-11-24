import assert from "node:assert/strict";
import path from "node:path";
import { describe, test } from "node:test";
import { fileURLToPath } from "node:url";

import { readCurrentTree } from "../../skills/design/scripts/migration/CurrentTree.mjs";

const FIXTURE_FOLDER = path.join(path.dirname(fileURLToPath(import.meta.url)), "fixture");
const FIXTURE_FILE = "signatureForms.ts";

const LABEL_OF = { name: "labelOf", type: "(status: Status) => string" };
const STOCK_LEVEL = { name: "stockLevel", type: "StockLevel" };

const SIGNATURE_FORMS = [
  { form: "a function declaration with a callback parameter", name: "declaredWithCallback", parameters: [STOCK_LEVEL, LABEL_OF], returns: "string" },
  { form: "an async function declaration with a callback parameter", name: "declaredAsyncWithCallback", parameters: [{ name: "action", type: "() => Promise<void>" }], returns: "Promise<void>" },
  { form: "an arrow function with a callback parameter", name: "arrowWithCallback", parameters: [STOCK_LEVEL, LABEL_OF], returns: "string" },
  { form: "an arrow function with a callback that takes no argument", name: "arrowWithEmptyCallback", parameters: [{ name: "onClose", type: "() => void" }] },
  { form: "a generic arrow function with a callback parameter", name: "genericArrowWithCallback", parameters: [{ name: "selector", type: "(state: State) => TSelected" }] },
  { form: "an arrow function whose callback parameter stands on its own line", name: "multiLineArrowWithCallback", parameters: [STOCK_LEVEL, LABEL_OF], returns: "string" },
  { form: "an arrow function with a destructured callback", name: "destructuredWithCallback", parameters: [{ name: "onClose", type: "{ onClose: () => void }" }] },
  { form: "an arrow function assigned to a typed const", name: "typedConstWithCallback", parameters: [LABEL_OF] },
  { form: "an arrow function whose callback takes a callback", name: "nestedCallback", parameters: [{ name: "run", type: "(next: (value: string) => void) => void" }] },
  { form: "an arrow function with a default value that calls a function", name: "defaultCallValue", parameters: [{ name: "at", type: "number" }] },
  { form: "an arrow function with a generic bound by a generic type", name: "genericWithNestedGeneric", parameters: [{ name: "items", type: "TItem[]" }] },
  { form: "an arrow function with no callback", name: "plainArrow", parameters: [STOCK_LEVEL, { name: "label", type: "string" }], returns: "string" },
  { form: "a class method with a callback parameter", name: "waitForDownload", parameters: [{ name: "action", type: "() => Promise<void>" }], returns: "Promise<string>" },
  { form: "a class property arrow function with a callback parameter", name: "onSelect", parameters: [{ name: "pick", type: "(row: Row) => boolean" }] },
  { form: "a class method with no callback", name: "plainMethod", parameters: [{ name: "label", type: "string" }], returns: "string" },
];

describe("CurrentTree#holdsTheSignature on a TypeScript file", () => {
  const currentTree = readCurrentTree(FIXTURE_FOLDER);

  for (const { form, ...method } of SIGNATURE_FORMS) {
    test(`should find 1 signature text when the method is ${form}`, () => {
      // when
      const signatureTexts = currentTree.listSignatureTextsOf(FIXTURE_FILE, method.name);

      // then
      assert.equal(signatureTexts.length, 1);
    });

    test(`should hold the signature when the method is ${form}`, () => {
      // when
      const holdsTheSignature = currentTree.holdsTheSignature(FIXTURE_FILE, method);

      // then
      assert.equal(holdsTheSignature, true);
    });
  }

  test("should not hold the signature when only a call whose arguments hold brackets names the parameters", () => {
    // given
    const methodWithTheNamesOfTheCall = { name: "labelOfRenamedLevel", parameters: [STOCK_LEVEL, LABEL_OF], returns: "string" };

    // when
    const holdsTheSignature = currentTree.holdsTheSignature(FIXTURE_FILE, methodWithTheNamesOfTheCall);

    // then
    assert.equal(holdsTheSignature, false);
  });
});
