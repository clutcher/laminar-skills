import { GenericVariableFinder } from "../generic/GenericVariableFinder.mjs";

export class RubyVariableFinder extends GenericVariableFinder {
  language = "ruby";
  literalTypes = { map: "Hash", list: "Array", text: "String" };
}
