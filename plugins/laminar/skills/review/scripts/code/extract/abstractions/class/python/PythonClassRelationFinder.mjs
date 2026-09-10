import { GenericClassRelationFinder } from "../generic/GenericClassRelationFinder.mjs";

export class PythonClassRelationFinder extends GenericClassRelationFinder {
  language = "python";
  supertypesInBrackets = true;
}
