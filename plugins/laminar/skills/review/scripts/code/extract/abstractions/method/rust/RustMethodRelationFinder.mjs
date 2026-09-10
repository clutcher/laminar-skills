import { GenericMethodRelationFinder } from "../generic/GenericMethodRelationFinder.mjs";

export class RustMethodRelationFinder extends GenericMethodRelationFinder {
  language = "rust";
  receiverSeparators = ["::"];
}
