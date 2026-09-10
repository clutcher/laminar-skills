import { RoleFinder } from "../../../finders/RoleFinder.mjs";
import { Scale } from "../../../../graph/abstractions/Scale.mjs";

export class GenericModuleRoleFinder extends RoleFinder {
  constructor() {
    super(Scale.MODULE);
  }

  findVerifiedBoundary() {
    return undefined;
  }
}
