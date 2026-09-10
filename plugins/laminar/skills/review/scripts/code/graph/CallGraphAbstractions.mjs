export class CallGraphAbstractions {
  #positionByMethodMap = null;

  constructor() {
    this.families = [];
  }

  add({ name, files, types, methods }) {
    const added = Object.freeze({
      name,
      files: Object.freeze(files.map(({ path: filePath, abstraction }) => Object.freeze({ path: filePath, abstraction }))),
      types: Object.freeze([...types]),
      methods: Object.freeze([...methods]),
    });
    this.families.push(added);
    this.#positionByMethodMap = null;
    return added;
  }

  readMethodPosition(abstraction) {
    if (!this.#positionByMethodMap) this.#positionByMethodMap = new Map(this.families.flatMap(family => family.methods.map((method, position) => [method, position])));
    return this.#positionByMethodMap.has(abstraction) ? this.#positionByMethodMap.get(abstraction) : Number.MAX_SAFE_INTEGER;
  }

  toJSON() {
    return this.families.map(family => ({
      name: family.name,
      files: family.files.map(file => ({ path: file.path, abstraction: file.abstraction.id })),
      types: family.types.map(type => type.id),
      methods: family.methods.map(method => method.id),
    }));
  }

  readSaved(savedFamilies, abstractionAt) {
    for (const family of savedFamilies) {
      this.add({
        name: family.name,
        files: family.files.map(file => ({ path: file.path, abstraction: abstractionAt(file.abstraction) })),
        types: family.types.map(abstractionAt),
        methods: family.methods.map(abstractionAt),
      });
    }
  }
}
