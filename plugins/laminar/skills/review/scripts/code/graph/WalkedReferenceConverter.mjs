import { Evidence } from "./Evidence.mjs";
import { Place } from "./abstractions/Place.mjs";
import { createArgumentCountField, collectCallGraphFacts, Reference } from "./relations/Reference.mjs";

const NO_FIELD = "-";

const SPACE_IN_A_FORM = " ";

const FORM_SPACE = "_";

const mapFormToField = form => form.replaceAll(SPACE_IN_A_FORM, FORM_SPACE);

const mapFieldToForm = field => field.replaceAll(FORM_SPACE, SPACE_IN_A_FORM);

const SAVED_REFERENCE_FIELDS = 6;

const POSSIBLE_TARGETS_MARK = "?";

const formatSavedReference = (reference, fromIndex, target) => [
  reference.place.startLine,
  reference.kind,
  fromIndex,
  reference.receiver || NO_FIELD,
  reference.form ? mapFormToField(reference.form) : NO_FIELD,
  target,
  reference.name,
].join(" ");

function splitSavedReferenceFields(savedReference) {
  const fields = [];
  let at = 0;
  for (let field = 0; field < SAVED_REFERENCE_FIELDS; field++) {
    const end = savedReference.indexOf(" ", at);
    fields.push(savedReference.slice(at, end));
    at = end + 1;
  }
  return [...fields, savedReference.slice(at)];
}

const readFieldOrEmpty = field => (field === NO_FIELD ? "" : field);

const getOrAddIndexIn = (indexes, ids, abstraction) => {
  if (!indexes.has(abstraction)) { indexes.set(abstraction, ids.length); ids.push(abstraction.id); }
  return indexes.get(abstraction);
};

const getOrAddTargetIndex = (fileTable, abstraction) => getOrAddIndexIn(fileTable.indexByTargetMap, fileTable.to, abstraction);

const readTargetsOfTheResolution = resolution => {
  if (!resolution) return [];
  return resolution.to ? [resolution.to] : resolution.possibleTargets;
};

const addTheTargets = (fileTable, targets) => {
  for (const target of targets) getOrAddTargetIndex(fileTable, target);
};

const formatTargetField = (fileTable, resolution) => {
  if (!resolution) return NO_FIELD;
  if (resolution.to) return String(fileTable.indexByTargetMap.get(resolution.to));
  return `${POSSIBLE_TARGETS_MARK}${resolution.possibleTargets.map(possibleTarget => fileTable.indexByTargetMap.get(possibleTarget)).join(",")}`;
};

const parseResolutionField = (field, targets) => {
  if (field === NO_FIELD) return {};
  if (!field.startsWith(POSSIBLE_TARGETS_MARK)) return { to: targets[Number(field)] };
  return { possibleTargets: field.slice(POSSIBLE_TARGETS_MARK.length).split(",").map(index => targets[Number(index)]) };
};

const createCallDetails = (reference, call, fileTable) => ({
  column: reference.column,
  resolution: reference.resolution,
  ...(reference.callReceiver === reference.receiver ? {} : { callReceiver: reference.callReceiver }),
  ...createArgumentCountField(reference),
  ...collectCallGraphFacts(reference),
  ...(reference.foundBy === fileTable.foundBy ? {} : { foundBy: reference.foundBy }),
  targets: call.targets.map(target => fileTable.indexByTargetMap.get(target)),
  ...(call.evidence ? { evidence: call.evidence.toJSON() } : {}),
});

const createCallFromDetails = (details, targets) => (details
  ? { targets: details.targets.map(index => targets[index]), evidence: details.evidence ? Evidence.createFromJSON(details.evidence) : null }
  : null);

const readCallFields = details => {
  if (!details) return {};
  const { targets, evidence, foundBy, ...savedFields } = details;
  return { ...savedFields, ...(foundBy ? { foundBy } : {}) };
};

const createEmptyFileTable = reference => ({ file: reference.place.file, foundBy: reference.foundBy, from: [], indexByFromMap: new Map(), to: [], indexByTargetMap: new Map(), savedReferences: [], calls: {} });

const getOrAddFileTable = (tablesByFileMap, reference) => {
  const file = reference.place.file;
  if (!tablesByFileMap.has(file)) tablesByFileMap.set(file, createEmptyFileTable(reference));
  return tablesByFileMap.get(file);
};

const getOrAddFromIndex = (fileTable, fromAbstraction) => getOrAddIndexIn(fileTable.indexByFromMap, fileTable.from, fromAbstraction);

const convertToSavedFileTable = ({ file, foundBy, from, to, savedReferences, calls }) => ({ file, foundBy, from, ...(to.length ? { to } : {}), savedReferences, ...(Object.keys(calls).length ? { calls } : {}) });

const recordTheReadCall = (fileTable, reference, callOf) => {
  const call = reference.isAReadCall() ? callOf(reference) : null;
  if (!call) return;
  addTheTargets(fileTable, call.targets);
  fileTable.calls[fileTable.savedReferences.length] = createCallDetails(reference, call, fileTable);
};

export function convertReferencesToJSON(references, resolutionOf = () => null, callOf = () => null) {
  const tablesByFileMap = new Map();
  for (const reference of references) {
    const fileTable = getOrAddFileTable(tablesByFileMap, reference);
    const fromIndex = getOrAddFromIndex(fileTable, reference.from);
    recordTheReadCall(fileTable, reference, callOf);
    const resolution = resolutionOf(reference);
    addTheTargets(fileTable, readTargetsOfTheResolution(resolution));
    fileTable.savedReferences.push(formatSavedReference(reference, fromIndex, formatTargetField(fileTable, resolution)));
  }
  return [...tablesByFileMap.values()].map(convertToSavedFileTable);
}

export function parseReferencesFromJSON(saved, abstractionAt) {
  return saved.flatMap(({ file, foundBy, from, to = [], savedReferences, calls = {} }) => {
    const fromAbstractions = from.map(abstractionAt);
    const targets = to.map(abstractionAt);
    return savedReferences.map((savedReference, position) => {
      const [line, kind, fromIndex, receiver, form, target, name] = splitSavedReferenceFields(savedReference);
      return {
        reference: new Reference({
          kind,
          from: fromAbstractions[Number(fromIndex)],
          name,
          receiver: readFieldOrEmpty(receiver),
          place: new Place({ file, startLine: Number(line) }),
          foundBy,
          form: mapFieldToForm(readFieldOrEmpty(form)),
          ...readCallFields(calls[position]),
        }),
        call: createCallFromDetails(calls[position], targets),
        ...parseResolutionField(target, targets),
      };
    });
  });
}
