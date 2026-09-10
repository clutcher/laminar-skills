import { GenericVariableFinder } from "../generic/GenericVariableFinder.mjs";

export class AdaVariableFinder extends GenericVariableFinder {
  language = "ada";
  typeOrder = "colon";
}
