import { GenericVariableFinder } from "../generic/GenericVariableFinder.mjs";

export class PhpVariableFinder extends GenericVariableFinder {
  language = "php";
  typeOrder = "before";
  literalTypes = { map: "array", list: "array", text: "string" };
}
