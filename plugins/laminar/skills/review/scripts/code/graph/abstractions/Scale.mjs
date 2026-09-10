const ORDER_FROM_THE_SMALLEST = ["VARIABLE", "METHOD", "CLASS", "MODULE", "APPLICATION", "SYSTEM"];

export class Scale {
  #rank;

  constructor(name) {
    this.name = name;
    this.#rank = ORDER_FROM_THE_SMALLEST.indexOf(name);
    Object.freeze(this);
  }

  isAbove(other) {
    return this.#rank > other.#rank;
  }

  isBelow(other) {
    return other.isAbove(this);
  }

  toString() {
    return this.name;
  }

  toJSON() {
    return this.name;
  }

  static findNamed(name) {
    return Scale.ALL.find(scale => scale.name === name) || null;
  }

  static VARIABLE = new Scale("VARIABLE");
  static METHOD = new Scale("METHOD");
  static CLASS = new Scale("CLASS");
  static MODULE = new Scale("MODULE");
  static APPLICATION = new Scale("APPLICATION");
  static SYSTEM = new Scale("SYSTEM");
  static ALL = Object.freeze([Scale.VARIABLE, Scale.METHOD, Scale.CLASS, Scale.MODULE, Scale.APPLICATION, Scale.SYSTEM]);
}

const NAMED_PLACE_SCALE_NAMES = new Set([Scale.CLASS.name, Scale.METHOD.name]);

export const isANamedPlaceScale = scale => NAMED_PLACE_SCALE_NAMES.has(String(scale));
