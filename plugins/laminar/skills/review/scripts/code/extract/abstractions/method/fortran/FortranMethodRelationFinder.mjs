import { GenericMethodRelationFinder } from "../generic/GenericMethodRelationFinder.mjs";

export class FortranMethodRelationFinder extends GenericMethodRelationFinder {
  language = "fortran";
  receiverSeparators = ["%"];
}
