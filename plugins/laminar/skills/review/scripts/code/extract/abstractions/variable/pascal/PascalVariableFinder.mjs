import { GenericVariableFinder } from "../generic/GenericVariableFinder.mjs";

export class PascalVariableFinder extends GenericVariableFinder {
  language = "pascal";
  typeOrder = "colon";
}
