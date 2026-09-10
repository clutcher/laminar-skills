import { AbstractionFinder } from "../../../finders/AbstractionFinder.mjs";
import { Scale } from "../../../../graph/abstractions/Scale.mjs";

export class GenericClassFinder extends AbstractionFinder {
  constructor() {
    super(Scale.CLASS);
    this.scopeIsFlat = false;
    this.packageHead = null;
  }

  isPrivate() {
    return false;
  }

  namesAPackage(text) {
    return Boolean(this.packageHead && this.packageHead.test(String(text)));
  }
}
