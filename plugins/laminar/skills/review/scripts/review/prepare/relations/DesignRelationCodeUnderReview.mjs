import { Scale } from "../../../code/index.mjs";
import { TRACKS } from "../../../checks/CheckCatalog.mjs";
import { CHAIN_GROUP_CHECKS, CORE_OPERATION_CHECKS, MEMBER_GROUP_CHECKS, PARAMETER_RELATION_CHECKS } from "../selection/TrackSelection.mjs";
import { readJudgeType } from "../../../checks/JudgeType.mjs";
import { DESIGN_RELATION_KINDS } from "../../../checks/DesignRelationKinds.mjs";
import { formatPlacedSliceLine, listPlacesShownInSections, readSliceSections } from "../formats/SliceFormat.mjs";
import { numberCodeUnderReviewFrom } from "../formats/CodeUnderReviewIds.mjs";

const createChecks = checks => checks.map(check => ({ id: check.id, name: check.name, fields: [] }));

const CHAIN_GROUP_JUDGE_TYPE = readJudgeType({ track: TRACKS.DESIGN, checks: CHAIN_GROUP_CHECKS });

const PARAMETER_TYPE_JUDGE_TYPE = readJudgeType({ track: TRACKS.DESIGN, checks: PARAMETER_RELATION_CHECKS });

const CORE_OPERATION_JUDGE_TYPE = readJudgeType({ track: TRACKS.DESIGN, checks: CORE_OPERATION_CHECKS });

const MEMBER_GROUPS_JUDGE_TYPE = readJudgeType({ track: TRACKS.DESIGN, checks: MEMBER_GROUP_CHECKS });


const findFirstStart = group => group.methods.find(method => method.start) || group.methods[0];

const createChainGroupCodeUnderReview = group => {
  const start = findFirstStart(group);
  return {
    abstractionId: `chain:${start.path}:${start.from}`,
    displayName: start.displayName,
    name: start.displayName,
    scale: Scale.METHOD.name,
    track: TRACKS.DESIGN,
    judgeType: CHAIN_GROUP_JUDGE_TYPE,
    checks: createChecks(CHAIN_GROUP_CHECKS),
    isTest: false,
    path: start.path,
    lines: { from: start.from, to: start.to },
    slice: null,
    relation: DESIGN_RELATION_KINDS.CHAIN_GROUP,
    abstractionIds: group.abstractionIds,
    methods: group.methods,
    stops: group.stops,
  };
};

const createParameterRelationCodeUnderReview = relation => ({
  ...relation,
  abstractionId: `parameter:${relation.path}:${relation.from}`,
  scale: Scale.CLASS.name,
  track: TRACKS.DESIGN,
  judgeType: PARAMETER_TYPE_JUDGE_TYPE,
  checks: createChecks(PARAMETER_RELATION_CHECKS),
  isTest: false,
  lines: { from: relation.from, to: relation.to },
  typeLines: relation.lines,
  slice: null,
  relation: DESIGN_RELATION_KINDS.PARAMETER_TYPE,
  abstractionIds: [relation.abstractionId],
});

const readPlacedLines = (filePath, lines) => (lines || []).map(line => formatPlacedSliceLine(filePath, line.line, line.text));

const readImplementationPath = relation => (relation.implementation || relation).path;

const createCoreOperationSlice = relation => ({
  sections: [
    { section: "interface", lines: readPlacedLines(relation.path, relation.interfaceLines) },
    { section: "implementation", lines: readPlacedLines(readImplementationPath(relation), relation.implementationLines) },
  ].filter(section => section.lines.length),
});

const createCoreOperationChecks = relation => CORE_OPERATION_CHECKS.map(check => ({
  id: check.id,
  name: check.name,
  fields: relation.ownOutput.length ? [] : check.gate.fields,
}));

const createCoreOperationCodeUnderReview = relation => ({
  ...relation,
  abstractionId: `core:${relation.path}:${relation.from}`,
  scale: Scale.CLASS.name,
  track: TRACKS.DESIGN,
  judgeType: CORE_OPERATION_JUDGE_TYPE,
  checks: createCoreOperationChecks(relation),
  isTest: false,
  lines: { from: relation.from, to: relation.to },
  slice: createCoreOperationSlice(relation),
  relation: DESIGN_RELATION_KINDS.CORE_OPERATION,
});

export const isACoreOperation = designRelation => designRelation.relation === DESIGN_RELATION_KINDS.CORE_OPERATION;

export const isAnInOutOperation = designRelation => designRelation.relation === DESIGN_RELATION_KINDS.IN_OUT_OPERATION;

const createInOutOperationCodeUnderReview = relation => ({
  ...relation,
  abstractionId: `in-out:${relation.path}:${relation.from}`,
  scale: Scale.METHOD.name,
  track: TRACKS.DESIGN,
  judgeType: CORE_OPERATION_JUDGE_TYPE,
  checks: CORE_OPERATION_CHECKS.map(check => ({ id: check.id, name: check.name, fields: ["decidesBusinessRule"] })),
  isTest: false,
  lines: { from: relation.from, to: relation.to },
  methodLines: relation.lines,
  slice: { sections: [{ section: "inOutMethod", lines: readPlacedLines(relation.path, relation.lines) }] },
  relation: DESIGN_RELATION_KINDS.IN_OUT_OPERATION,
});

export const isARebuiltValue = designRelation => designRelation.relation === DESIGN_RELATION_KINDS.REBUILT_VALUE;

const createRebuiltValueCodeUnderReview = relation => ({
  ...relation,
  abstractionId: `rebuilt:${relation.path}:${relation.from}`,
  scale: Scale.METHOD.name,
  track: TRACKS.DESIGN,
  judgeType: CORE_OPERATION_JUDGE_TYPE,
  checks: createChecks(CORE_OPERATION_CHECKS),
  isTest: false,
  lines: { from: relation.from, to: relation.to },
  methodLines: relation.lines,
  slice: { sections: [{ section: "rebuiltMethod", lines: readPlacedLines(relation.path, relation.lines) }] },
  relation: DESIGN_RELATION_KINDS.REBUILT_VALUE,
});

export const isAMemberGroupsRelation = designRelation => designRelation.relation === DESIGN_RELATION_KINDS.MEMBER_GROUPS;

const findAbstractionById = (abstractions, id) => {
  for (const abstraction of abstractions || []) {
    if (abstraction.id === id) return abstraction;
    const found = findAbstractionById(abstraction.children, id);
    if (found) return found;
  }
  return null;
};

export const createMemberGroupsCodeUnderReview = (relation, abstractions) => {
  const classAbstraction = findAbstractionById(abstractions, relation.abstractionIds[0]) || {};
  return {
    ...relation,
    abstractionId: `member-groups:${relation.path}:${relation.from}`,
    scale: Scale.CLASS.name,
    track: TRACKS.DESIGN,
    judgeType: MEMBER_GROUPS_JUDGE_TYPE,
    checks: createChecks(MEMBER_GROUP_CHECKS),
    isTest: false,
    lines: { from: relation.from, to: relation.to },
    slice: classAbstraction.slice || null,
    testFriction: classAbstraction.testFriction || [],
    relation: DESIGN_RELATION_KINDS.MEMBER_GROUPS,
  };
};

export const buildMemberGroupsCodeUnderReview = (extracted, firstNumber = 1) => numberCodeUnderReviewFrom((extracted.memberGroups || []).map(relation => createMemberGroupsCodeUnderReview(relation, extracted.abstractions)), firstNumber);

const isKeptBy = (keeps, keepsJudgeType, keepsScale) => designRelation => keeps(designRelation.path) && keepsJudgeType(designRelation.judgeType) && keepsScale(designRelation.scale);

const KEEPS_EVERY_JUDGE_TYPE = () => true;

const KEEPS_EVERY_SCALE = () => true;

export function buildDesignCodeUnderReview(extracted, { keeps, keepsJudgeType = KEEPS_EVERY_JUDGE_TYPE, keepsScale = KEEPS_EVERY_SCALE, firstNumber }) {
  const designCodeUnderReview = [
    ...(extracted.chainGroups || []).map(createChainGroupCodeUnderReview),
    ...(extracted.parameterRelations || []).map(createParameterRelationCodeUnderReview),
    ...(extracted.coreOperations || []).map(createCoreOperationCodeUnderReview),
    ...(extracted.inOutOperations || []).map(createInOutOperationCodeUnderReview),
    ...(extracted.rebuiltValues || []).map(createRebuiltValueCodeUnderReview),
    ...(extracted.memberGroups || []).map(relation => createMemberGroupsCodeUnderReview(relation, extracted.abstractions)),
  ].filter(isKeptBy(keeps, keepsJudgeType, keepsScale));
  return numberCodeUnderReviewFrom(designCodeUnderReview, firstNumber);
}

export const isADesignCodeUnderReview = codeUnderReview => codeUnderReview.track === TRACKS.DESIGN;

const readPlacesOfLines = (filePath, lines) => (lines || []).map(line => ({ path: filePath, line: line.line, text: line.text }));

const readOperationPlaces = operations => (operations || []).flatMap(operation => readPlacesOfLines(operation.path, operation.lines));

export const readRelationPlaces = designRelation => {
  if (!isADesignCodeUnderReview(designRelation)) return [];
  if (designRelation.relation === DESIGN_RELATION_KINDS.CHAIN_GROUP) {
    return [...(designRelation.methods || []), ...(designRelation.stops || [])].flatMap(method => readPlacesOfLines(method.path, method.lines));
  }
  if (isAnInOutOperation(designRelation)) return readPlacesOfLines(designRelation.path, designRelation.methodLines);
  if (isAMemberGroupsRelation(designRelation)) {
    return [
      ...designRelation.fields.map(field => ({ path: designRelation.path, line: field.line, text: field.text })),
      ...listPlacesShownInSections(designRelation.path, readSliceSections(designRelation)).map(place => ({ path: place.file, line: place.line, text: place.text })),
    ];
  }
  if (isARebuiltValue(designRelation)) {
    return [
      ...readPlacesOfLines(designRelation.path, designRelation.methodLines),
      ...readPlacesOfLines(designRelation.value.path, designRelation.value.lines),
      ...designRelation.callers.map(caller => ({ path: caller.path, line: caller.line, text: caller.text })),
      ...designRelation.siblings.flatMap(sibling => readPlacesOfLines(sibling.path, sibling.lines)),
    ];
  }
  if (isACoreOperation(designRelation)) {
    return [
      ...readPlacesOfLines(designRelation.path, designRelation.interfaceLines),
      ...readPlacesOfLines(readImplementationPath(designRelation), designRelation.implementationLines),
      ...(designRelation.neighbours || []).flatMap(neighbour => [
        ...readPlacesOfLines(neighbour.path, neighbour.interfaceLines),
        ...readPlacesOfLines(readImplementationPath(neighbour), neighbour.implementationLines),
      ]),
    ];
  }
  return [
    ...readPlacesOfLines(designRelation.path, designRelation.typeLines),
    ...readOperationPlaces(designRelation.operations),
    ...(designRelation.carriers || []).flatMap(carrier => [...readPlacesOfLines(carrier.path, carrier.lines), ...readOperationPlaces(carrier.operations)]),
    ...(designRelation.twins || []).flatMap(twin => [...readPlacesOfLines(twin.path, twin.lines), ...readOperationPlaces(twin.operations)]),
    ...(designRelation.filledTogether || []).flatMap(place => readPlacesOfLines(place.path, place.lines)),
  ];
};
