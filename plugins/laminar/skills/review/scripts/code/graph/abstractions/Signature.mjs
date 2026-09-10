const areSameLists = (left, right) => left.length === right.length && left.every((item, index) => item === right[index]);

const formatParameterText = parameter => `${parameter.name}:${parameter.type}`;

const sortList = list => [...list].sort();

export class Signature {
  constructor({ text = "", parameters = [], returnType = "", returnTypes = [], errors = [], supertypes = [], declaredType = "", typeParameters = [] } = {}) {
    this.text = text;
    this.parameters = Object.freeze(parameters.map(({ name = "", type = "" }) => Object.freeze({ name, type })));
    this.returnType = returnType;
    this.returnTypes = Object.freeze([...returnTypes]);
    this.errors = Object.freeze([...errors]);
    this.supertypes = Object.freeze([...supertypes]);
    this.declaredType = declaredType;
    this.typeParameters = Object.freeze([...typeParameters]);
    Object.freeze(this);
  }

  isEmpty() {
    return !this.text && !this.parameters.length && !this.returnType && !this.returnTypes.length && !this.errors.length
      && !this.supertypes.length && !this.declaredType && !this.typeParameters.length;
  }

  equals(other) {
    return Boolean(other)
      && this.text === other.text
      && areSameLists(this.parameters.map(formatParameterText), other.parameters.map(formatParameterText))
      && this.returnType === other.returnType
      && areSameLists(this.returnTypes, other.returnTypes)
      && areSameLists(sortList(this.errors), sortList(other.errors))
      && areSameLists(sortList(this.supertypes), sortList(other.supertypes))
      && this.declaredType === other.declaredType
      && areSameLists(this.typeParameters, other.typeParameters);
  }

  toJSON() {
    return Object.fromEntries(Object.entries({
      text: this.text,
      parameters: this.parameters.map(parameter => ({ ...parameter })),
      returnType: this.returnType,
      returnTypes: [...this.returnTypes],
      errors: [...this.errors],
      supertypes: [...this.supertypes],
      declaredType: this.declaredType,
      typeParameters: [...this.typeParameters],
    }).filter(([, value]) => (Array.isArray(value) ? value.length : value)));
  }

  static createFromJSON(saved) {
    return saved ? new Signature(saved) : NO_SIGNATURE;
  }
}

export const NO_SIGNATURE = new Signature();
