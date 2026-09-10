import { parseType } from "../../../inputs/source/text/TypeText.mjs";

const NOT_RESOLVED = null;

export function* walkSupertypeSteps(start, { readName: nameOf, listSupertypes: supertypesOf, resolve }) {
  const seen = new Set([nameOf(start)]);
  const pending = [start];
  while (pending.length) {
    const walkedType = pending.shift();
    for (const supertype of supertypesOf(walkedType) || []) {
      const type = parseType(supertype);
      if (!type || seen.has(type.simple)) continue;
      seen.add(type.simple);
      const resolved = resolve(type, walkedType) ?? NOT_RESOLVED;
      yield { type, from: walkedType, resolved };
      if (resolved !== NOT_RESOLVED) pending.push(resolved);
    }
  }
}

export function findMethodsOfTheNearestSupertype(steps, methodsOf) {
  for (const { resolved } of steps) {
    const found = methodsOf(resolved);
    if (found.length) return found;
  }
  return [];
}

export const findSupertypeNamesOfTheApiSpiType = (type, apiSpiType) => (type.supertypes || []).filter(name => name === apiSpiType.name || name.endsWith(`.${apiSpiType.name}`));

export const namesTheApiSpiTypeAsASupertype = (type, apiSpiType) => findSupertypeNamesOfTheApiSpiType(type, apiSpiType).length > 0;
