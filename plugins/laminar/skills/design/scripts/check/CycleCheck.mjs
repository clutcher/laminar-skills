import { getFolderPath, isAText, readFolderOfTheFile, readHeadTypeName, readList, readTypeNames } from "../model/DesignModel.mjs";
import { DEFECT_CODES, createRecheckDefect } from "./DesignDefect.mjs";
import { NO_LAYOUT_LINE } from "./ZoneOrder.mjs";

const RELATION_SOURCES = Object.freeze({ FIELD_TYPE: "field type", CALLS: "calls", IMPLEMENTS: "implements or extends", SIGNATURE_TYPE: "signature type" });

const PRIVATE_VISIBILITY = "private";

const createRelation = (from, to, source, path) => ({ from, to, source, path });

const readFieldTypeRelations = (model, theClass) => {
  const relations = [];
  readList(theClass.fields).forEach((field, at) => {
    for (const typeName of new Set(readTypeNames(field.type))) {
      const fieldClass = model.findClassOfTheType(typeName, theClass);
      if (!fieldClass || fieldClass === theClass) continue;
      relations.push(createRelation(theClass, fieldClass, RELATION_SOURCES.FIELD_TYPE, `${model.getClassPath(theClass)}.fields[${at}].type`));
    }
  });
  return relations;
};

const readCallRelations = (model, theClass) => {
  const relations = [];
  for (const method of readList(theClass.methods)) {
    readList(method.calls).forEach((called, at) => {
      const calledClass = model.findClass(called);
      if (!calledClass || calledClass === theClass) return;
      relations.push(createRelation(theClass, calledClass, RELATION_SOURCES.CALLS, `${model.getMethodPath(theClass, method)}.calls[${at}]`));
    });
  }
  return relations;
};

const readImplementsRelations = (model, theClass) => {
  const relations = [];
  for (const listKey of ["implements", "extends"]) {
    readList(theClass[listKey]).forEach((parentName, at) => {
      const parentClass = model.findClassOfTheType(readHeadTypeName(parentName), theClass);
      if (!parentClass || parentClass === theClass) return;
      relations.push(createRelation(theClass, parentClass, RELATION_SOURCES.IMPLEMENTS, `${model.getClassPath(theClass)}.${listKey}[${at}]`));
    });
  }
  return relations;
};

const readSignatureRelations = (model, theClass) => {
  const relations = [];
  for (const method of readList(theClass.methods).filter(other => other.visibility !== PRIVATE_VISIBILITY)) {
    const typeTexts = [method.returns, ...readList(method.parameters).map(parameter => parameter.type)];
    for (const typeName of new Set(typeTexts.flatMap(readTypeNames))) {
      const typeClass = model.findClassOfTheType(typeName, theClass);
      if (!typeClass || typeClass === theClass) continue;
      relations.push(createRelation(theClass, typeClass, RELATION_SOURCES.SIGNATURE_TYPE, model.getMethodPath(theClass, method)));
    }
  }
  return relations;
};

const readPublicSignatureRelations = model => model.classes.filter(theClass => isAText(theClass.name)).flatMap(theClass => readSignatureRelations(model, theClass));

const readClassRelations = model => {
  const relations = [];
  for (const theClass of model.classes) {
    if (!isAText(theClass.name)) continue;
    relations.push(...readFieldTypeRelations(model, theClass), ...readCallRelations(model, theClass), ...readImplementsRelations(model, theClass));
  }
  return relations;
};

const describeRelation = (model, relation) => `${model.getClassDisplayName(relation.from)} in zone ${relation.from.zone} reaches ${model.getClassDisplayName(relation.to)} in zone ${relation.to.zone} by its ${relation.source}`;

const createZoneDefect = (model, relation, zoneOrder) => {
  if (relation.source === RELATION_SOURCES.IMPLEMENTS) {
    if (zoneOrder.allowsTheImplements(relation.from.zone, relation.to.zone)) return null;
  } else {
    if (zoneOrder.allowsTheCallByItsOrder(relation.from.zone, relation.to.zone)) return null;
    if (zoneOrder.allowsTheImplements(relation.from.zone, relation.to.zone)) return createRecheckDefect(DEFECT_CODES.CALL_INTO_THE_IMPLEMENTED_ZONE, relation.path, `a call from an implementer into the zone it implements: ${describeRelation(model, relation)}`);
  }
  return createRecheckDefect(DEFECT_CODES.ZONE_ORDER_BROKEN, relation.path, `${describeRelation(model, relation)}, which the zone order does not allow`);
};

const findZoneDefects = (model, relations, zoneOrder) => {
  const defects = [];
  const reportedPairs = new Set();
  for (const relation of relations) {
    const defect = createZoneDefect(model, relation, zoneOrder);
    const pair = `${model.getClassDisplayName(relation.from)} ${model.getClassDisplayName(relation.to)} ${relation.source}`;
    if (!defect || reportedPairs.has(pair)) continue;
    reportedPairs.add(pair);
    defects.push(defect);
  }
  return defects;
};

const findZonesOutsideTheOrder = (model, zoneOrder) => {
  const defects = [];
  const reportedZones = new Set();
  for (const theClass of model.classes) {
    if (!isAText(theClass.zone) || zoneOrder.namesTheZone(theClass.zone) || reportedZones.has(theClass.zone)) continue;
    reportedZones.add(theClass.zone);
    defects.push(createRecheckDefect(DEFECT_CODES.ZONE_OUTSIDE_THE_ORDER, `${model.getClassPath(theClass)}.zone`, `the zone ${theClass.zone} is not 1 of the zone order: ${[...zoneOrder.zones].join(", ")}, so the edges of its classes are not checked against the order`));
  }
  return defects;
};

const isCheckedAgainstTheOrder = (relation, zoneOrder) => [relation.from.zone, relation.to.zone].every(zone => isAText(zone) && zoneOrder.namesTheZone(zone));

const buildTargetsOfAbstractionMap = (relations, readAbstractionName) => {
  const targetsOfAbstractionMap = new Map();
  for (const relation of relations) {
    const fromName = readAbstractionName(relation.from);
    const toName = readAbstractionName(relation.to);
    if (fromName === toName) continue;
    const targets = targetsOfAbstractionMap.get(fromName) || new Set();
    targets.add(toName);
    targetsOfAbstractionMap.set(fromName, targets);
  }
  return targetsOfAbstractionMap;
};

const findStronglyConnectedGroups = targetsOfAbstractionMap => {
  const indexOfClassMap = new Map();
  const lowOfClassMap = new Map();
  const stack = [];
  const onStack = new Set();
  const groups = [];
  let nextIndex = 0;

  const visit = className => {
    indexOfClassMap.set(className, nextIndex);
    lowOfClassMap.set(className, nextIndex);
    nextIndex += 1;
    stack.push(className);
    onStack.add(className);
    for (const target of targetsOfAbstractionMap.get(className) || []) {
      if (!indexOfClassMap.has(target)) {
        visit(target);
        lowOfClassMap.set(className, Math.min(lowOfClassMap.get(className), lowOfClassMap.get(target)));
      } else if (onStack.has(target)) {
        lowOfClassMap.set(className, Math.min(lowOfClassMap.get(className), indexOfClassMap.get(target)));
      }
    }
    if (lowOfClassMap.get(className) !== indexOfClassMap.get(className)) return;

    const group = [];
    let member;
    do {
      member = stack.pop();
      onStack.delete(member);
      group.push(member);
    } while (member !== className);
    if (group.length > 1) groups.push(group);
  };

  for (const className of targetsOfAbstractionMap.keys()) {
    if (!indexOfClassMap.has(className)) visit(className);
  }
  return groups;
};

const findCyclePath = (group, targetsOfAbstractionMap) => {
  const members = new Set(group);
  const start = [...group].sort()[0];
  const pathsToVisit = [[start]];
  const seen = new Set([start]);
  while (pathsToVisit.length) {
    const path = pathsToVisit.shift();
    const targets = [...(targetsOfAbstractionMap.get(path[path.length - 1]) || [])].filter(target => members.has(target)).sort();
    if (targets.includes(start)) return [...path, start];

    for (const target of targets.filter(target => !seen.has(target))) {
      seen.add(target);
      pathsToVisit.push([...path, target]);
    }
  }
  return [...group, start];
};

const findCycleDefects = (model, relations) => {
  const targetsOfClassMap = buildTargetsOfAbstractionMap(relations, theClass => model.getClassDisplayName(theClass));
  return findStronglyConnectedGroups(targetsOfClassMap).map(group => {
    const cyclePath = findCyclePath(group, targetsOfClassMap);
    return createRecheckDefect(DEFECT_CODES.CYCLE, model.getClassPath(model.findClass(cyclePath[0])), `the classes reach each other in a cycle: ${cyclePath.join(" -> ")}`);
  });
};

const findFolderPathOfTheDefect = (model, folderPath) => {
  const folderAt = model.folders.findIndex(folder => getFolderPath(folder) === folderPath);
  if (folderAt >= 0) return `folders[${folderAt}]`;
  return model.getClassPath(model.classes.find(theClass => readFolderOfTheFile(theClass.file) === folderPath));
};

const findFolderCycleDefects = (model, relations) => {
  const targetsOfFolderMap = buildTargetsOfAbstractionMap(relations.filter(relation => isAText(relation.from.file) && isAText(relation.to.file)), theClass => readFolderOfTheFile(theClass.file));
  return findStronglyConnectedGroups(targetsOfFolderMap).map(group => {
    const cyclePath = findCyclePath(group, targetsOfFolderMap);
    return createRecheckDefect(DEFECT_CODES.FOLDER_CYCLE, findFolderPathOfTheDefect(model, cyclePath[0]), `the folders reach each other in a cycle through their classes: ${cyclePath.join(" -> ")}`);
  });
};

const describeCycleCheck = (relations, signatureRelations, zoneOrder, uncheckedCount) => {
  const countOf = source => relations.filter(relation => relation.source === source).length;
  const counts = `${countOf(RELATION_SOURCES.FIELD_TYPE)} edges from field types, ${countOf(RELATION_SOURCES.CALLS)} edges from calls, ${countOf(RELATION_SOURCES.IMPLEMENTS)} edges from implements and extends`;
  const graphs = `between classes and between folders; the folder graph also holds ${signatureRelations.length} edges from the parameter and return types of public members, and the class graph does not`;
  const unchecked = zoneOrder.isFound() ? `; ${uncheckedCount} edges of a class with no zone or a zone outside the order not checked against the zone order` : "";
  return `cycle check: ${counts}, ${graphs}; zone order: ${zoneOrder.describe()}${unchecked}`;
};

const describeIgnoredZones = (model, zoneOrder) => {
  const zonedCount = model.classes.filter(theClass => isAText(theClass.zone)).length;
  if (zoneOrder.isFound() || !zonedCount) return [];
  return [`zone: ignored on ${zonedCount} classes, because no zone order applies`];
};

export const findCycleCheckDefects = (model, zoneOrder) => {
  const relations = readClassRelations(model);
  const signatureRelations = readPublicSignatureRelations(model);
  const checkedRelations = relations.filter(relation => isCheckedAgainstTheOrder(relation, zoneOrder));
  const zoneDefects = zoneOrder.isFound() ? [...findZonesOutsideTheOrder(model, zoneOrder), ...findZoneDefects(model, checkedRelations, zoneOrder)] : [];
  const headLines = [
    ...(zoneOrder.isMissingTheLayout() ? [NO_LAYOUT_LINE] : []),
    describeCycleCheck(relations, signatureRelations, zoneOrder, relations.length - checkedRelations.length),
    ...describeIgnoredZones(model, zoneOrder),
  ];
  return { headLines, defects: [...zoneDefects, ...findCycleDefects(model, relations), ...findFolderCycleDefects(model, [...relations, ...signatureRelations])] };
};
