import { MAX_READ_PLACES } from "../../prepare/abstractions/walks/entryBoundaries/EntryBoundaryCallers.mjs";
import { isOnAnEntryBoundary } from "../returns/PossibleFindings.mjs";
import { buildFileAndLineKey } from "../abstractions/AbstractionsAtPlaces.mjs";

const THE_CHECK_THAT_READS_THE_CALLERS = "CP1";

const THE_ENTRY_BOUNDARY_JUDGE = "judge-design-entry-boundary";

const compareByText = (left, right) => (left < right ? -1 : left > right ? 1 : 0);

const hasACaller = boundary => (boundary.callers || []).length > 0;

const readsTheCallers = possibleFinding => possibleFinding.check === THE_CHECK_THAT_READS_THE_CALLERS;

const isFiledByAnotherJudge = possibleFinding => possibleFinding.judgeType !== THE_ENTRY_BOUNDARY_JUDGE;

const compareDecisionsFirst = (left, right) => Number(right.decision) - Number(left.decision) || compareByText(left.path, right.path) || left.line - right.line;

const createCallerLine = (application, place) => ({ application, file: place.path, line: place.line, text: String(place.text).trim(), context: place.lines });

const collectPlacesOfTheCallers = boundary => boundary.callers
  .flatMap(caller => (caller.readPlaces.length ? caller.readPlaces : caller.reached).map(place => ({ ...place, application: caller.application })));

export const buildCallerLines = boundary => collectPlacesOfTheCallers(boundary).sort(compareDecisionsFirst).slice(0, MAX_READ_PLACES)
  .map(place => createCallerLine(place.application, place));

const listCallerApplications = boundary => [...new Set(boundary.callers.map(caller => caller.application))].sort(compareByText);

const fillsOf = boundary => boundary.fills.map(fill => ({ file: fill.path, line: fill.from, displayName: fill.displayName }));

const buildConfirmation = callers => (callers.length ? `Read ${callers[0].file}, in ${callers[0].application}.` : "");

const addTheCallerFileToConfirm = (possibleFinding, callers) => {
  const confirmation = buildConfirmation(callers);
  const own = String(possibleFinding.whatWouldConfirm || "").trim();
  if (!confirmation || own.includes(confirmation)) return possibleFinding;
  return { ...possibleFinding, whatWouldConfirm: own ? `${own.replace(/[.]?$/, ".")} ${confirmation}` : confirmation };
};

const addTheBoundaryToThePossibleFinding = (possibleFinding, boundary, callers) => {
  const marked = { ...possibleFinding, application: boundary.application, callerApplications: listCallerApplications(boundary), callers, fills: fillsOf(boundary) };
  return readsTheCallers(possibleFinding) && isFiledByAnotherJudge(possibleFinding) ? addTheCallerFileToConfirm(marked, callers) : marked;
};

export class EntryBoundaryMarker {
  constructor(entryBoundaries) {
    this.boundariesByPlaceMap = new Map((entryBoundaries || []).filter(hasACaller).map(boundary => [buildFileAndLineKey(boundary.path, boundary.line), boundary]));
  }

  findBoundaryAt(file, line) {
    return this.boundariesByPlaceMap.get(buildFileAndLineKey(file, line)) || null;
  }

  findBoundaryQuotedBy(possibleFindings) {
    for (const possibleFinding of possibleFindings) {
      for (const quote of possibleFinding.quotes || []) {
        const boundary = this.findBoundaryAt(quote.file, quote.line);
        if (boundary) return boundary;
      }
    }
    return null;
  }

  findBoundary(group) {
    const lead = group.possibleFindings[0];
    if (isOnAnEntryBoundary(lead)) return this.findBoundaryAt(group.file, group.line) || this.findBoundaryQuotedBy(group.possibleFindings);
    return this.findBoundaryQuotedBy(group.possibleFindings.filter(readsTheCallers));
  }

  markGroup(group) {
    const boundary = this.findBoundary(group);
    if (!boundary) return group;
    const callers = buildCallerLines(boundary);
    return { ...group, callers, possibleFindings: group.possibleFindings.map(possibleFinding => addTheBoundaryToThePossibleFinding(possibleFinding, boundary, callers)) };
  }

  markGroups(groups) {
    return groups.map(group => this.markGroup(group));
  }
}
