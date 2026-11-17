import { DEFECT_CODES, createDefect } from "./DesignDefect.mjs";

const NOUN_OF_OBJECT_FORM_MAP = new Map([
  ["", "the top level of the model"],
  ["classes[]", "a class"],
  ["classes[].fields[]", "a field"],
  ["classes[].methods[]", "a method"],
  ["classes[].methods[].parameters[]", "a parameter"],
  ["folders[]", "a folder"],
  ["folders[].children[]", "a child of a folder"],
]);

const describeTheObject = objectPath => {
  const objectForm = objectPath.replace(/\[\d+\]/g, "[]");
  return NOUN_OF_OBJECT_FORM_MAP.get(objectForm) || `an object of ${objectForm}`;
};

// A key the form does not know is read by no script, so the fact it holds is lost; the designer writes that fact under the key of the form that holds it, or removes the key.
export const findUnknownKeyDefects = model => model.unknownKeys.map(({ objectPath, key }) => createDefect(
  DEFECT_CODES.KEY_UNKNOWN,
  objectPath ? `${objectPath}.${key}` : key,
  `the key ${key} is no key of ${describeTheObject(objectPath)} in the design model, so no script reads it; write its fact under the key that holds it, or remove the key`,
));
