import { NO_DECLARATION } from "../LanguageDriver.mjs";
import { GenericDriver } from "./GenericDriver.mjs";

export class ProseDriver extends GenericDriver {
  get holdsProse() {
    return true;
  }

  readDeclaration() {
    return NO_DECLARATION;
  }

  findDeclarationAt() {
    return NO_DECLARATION;
  }

  readsAsAHeadShape() {
    return false;
  }

  looksLikeDeclaration() {
    return false;
  }

  endsAWrappedHead() {
    return false;
  }

  looksLikeDeclarationAt() {
    return false;
  }

  startsACallThatSpansLines() {
    return false;
  }

  readTypeName() {
    return "";
  }
}
