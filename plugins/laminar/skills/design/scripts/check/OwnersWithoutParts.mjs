import { isAText, isATestFileOfTheModel, isAnInterface, isMarkedUnchanged, readList } from "../model/DesignModel.mjs";
import { DEFECT_CODES, createRecheckDefect } from "./DesignDefect.mjs";

// 1 decision is the whole work its method names, while 2 or more decisions need an order and a name for each step, which only a body or named parts show.
const LEAST_DECISIONS_WITH_AN_ORDER = 2;

const listDecisionsOfOwnerMap = model => {
  const decisionsOfOwnerMap = new Map();
  for (const owner of readList(model.decisions.owners)) {
    if (!isAText(owner.owner)) continue;
    const ownerName = model.normalizeName(owner.owner);
    decisionsOfOwnerMap.set(ownerName, [...(decisionsOfOwnerMap.get(ownerName) || []), owner.decision]);
  }
  return decisionsOfOwnerMap;
};

const namesAPrivatePart = (theClass, method) => readList(method.uses).some(use => readList(theClass.methods).some(other => other !== method && other.name === use));

// A method the change writes, which a writer shapes from the model alone: a method of a changed class outside a test file and outside an interface, not marked unchanged.
const isWrittenFromTheModel = (model, { theClass, method }) => !isMarkedUnchanged(method)
  && model.isChangedClass(theClass)
  && !isAnInterface(theClass)
  && !isATestFileOfTheModel(model, theClass.file || "");

const isAnOwnerWithoutParts = (model, methodWithClass, decisions) => decisions.length >= LEAST_DECISIONS_WITH_AN_ORDER
  && !isAText(methodWithClass.method.body)
  && !namesAPrivatePart(methodWithClass.theClass, methodWithClass.method)
  && isWrittenFromTheModel(model, methodWithClass);

const createTheOwnerDefect = (model, { theClass, method, displayName }, decisions) => createRecheckDefect(
  DEFECT_CODES.OWNER_OF_DECISIONS_WITHOUT_PARTS,
  model.getMethodPath(theClass, method),
  `${displayName} owns ${decisions.length} decisions of decisions.owners, ${decisions.map(decision => `"${decision}"`).join(", ")}, and has no body and names no private part in uses, so no judge of the shape check reads how it makes them, because the shape check judges a method only where it holds a body; name its parts in uses and write its body as the calls in order, or answer under scriptCases with the reason it needs neither`,
);

// A method that makes 2 or more decisions with no body and no named part leaves their order and their steps to the writer, and no judge of the shape check sees that work before code is written.
export const findOwnerWithoutPartsDefects = model => {
  const decisionsOfOwnerMap = listDecisionsOfOwnerMap(model);
  const defects = [];
  for (const methodWithClass of model.listMethodsWithClass()) {
    const decisions = decisionsOfOwnerMap.get(methodWithClass.displayName) || [];
    if (isAnOwnerWithoutParts(model, methodWithClass, decisions)) defects.push(createTheOwnerDefect(model, methodWithClass, decisions));
  }
  return defects;
};
