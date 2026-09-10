import { GenericModuleFinder } from "../generic/GenericModuleFinder.mjs";

const EXPORT_WORD_PATTERN = /(^|[^\w$])export([^\w$]|$)/;
const HEADER_FILE_PATTERN = /\.(h|hpp|hh|hxx|h\+\+|ixx|cppm)$/i;

export class CppModuleFinder extends GenericModuleFinder {
  language = "cpp";
  rootForm = "the nearest folder that holds a header or a module interface unit";
  rootExtensions = [".h", ".hpp", ".hh", ".hxx", ".h++", ".ixx", ".cppm"];

  isExposed(head, name, filePath) {
    return EXPORT_WORD_PATTERN.test(head) || HEADER_FILE_PATTERN.test(String(filePath));
  }
}
