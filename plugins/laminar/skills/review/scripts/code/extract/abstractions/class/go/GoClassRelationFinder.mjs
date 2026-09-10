import { parseGoResults } from "../../method/go/GoMethodFinder.mjs";
import { GenericClassRelationFinder } from "../generic/GenericClassRelationFinder.mjs";

const INTERFACE_HEAD_PATTERN = /\binterface\b/;
const INTERFACE_METHOD_PATTERN = /^\s*([A-Za-z_]\w*)\s*\(/;
const EMBEDDED_INTERFACE_PATTERN = /^\s*([A-Za-z_][\w.]*)\s*$/;
const TYPE_OVER_A_COLLECTION_PATTERN = /^\s*type\s+\w+\s+((?:\[\]|map\[)\S.*?)\s*$/;

function findInterfaceMethodsBetween(code, index, endIndex) {
  const methods = [];
  for (let at = index + 1; at < endIndex; at++) {
    const found = INTERFACE_METHOD_PATTERN.exec(code[at] || "");
    if (found) methods.push({ name: found[1], at });
  }
  return methods;
}

const findMethodNamesBetween = (code, index, endIndex) => findInterfaceMethodsBetween(code, index, endIndex).map(method => method.name);

function findEmbeddedInterfacesBetween(code, index, endIndex) {
  const names = [];
  for (let at = index + 1; at < endIndex; at++) {
    const embedded = EMBEDDED_INTERFACE_PATTERN.exec(code[at] || "");
    if (embedded) names.push(embedded[1]);
  }
  return names;
}

function collectMethodResultsBetween(code, index, endIndex, findParameterListAfterTheName) {
  const resultsByMethodNameMap = new Map();
  for (const { name, at } of findInterfaceMethodsBetween(code, index, endIndex)) {
    const parameters = findParameterListAfterTheName(code, at, name);
    const after = (code[parameters.endLine] || "").slice(parameters.endCol);
    resultsByMethodNameMap.set(name, parseGoResults(after));
  }
  return resultsByMethodNameMap;
}

export class GoClassRelationFinder extends GenericClassRelationFinder {
  language = "golang";

  isAStructuralInterface(head) {
    return INTERFACE_HEAD_PATTERN.test(head);
  }

  findInterfaceMethods(code, index, endIndex) {
    return findMethodNamesBetween(code, index, endIndex);
  }

  findInterfaceResults(code, index, endIndex, findParameterListAfterTheName) {
    return { embedded: findEmbeddedInterfacesBetween(code, index, endIndex), resultsByMethodMap: collectMethodResultsBetween(code, index, endIndex, findParameterListAfterTheName) };
  }

  findUnderlyingType(codeLine) {
    return (TYPE_OVER_A_COLLECTION_PATTERN.exec(codeLine || "") || [])[1] || "";
  }
}
