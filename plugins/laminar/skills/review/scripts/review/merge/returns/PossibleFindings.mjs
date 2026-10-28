import { isOwnCodeAt, isTestPath, readOwnSpans, doesSpanHoldLine, CHANGE_KINDS, Scale, PUBLIC_CHANGE_KINDS, PublicChangeKinds } from "../../../code/index.mjs";
import { METHOD_MARK, buildPlaceKey, AbstractionsAtPlaces, stripLeadingDotSlash } from "../abstractions/AbstractionsAtPlaces.mjs";
import { PreparedRun } from "../PreparedRun.mjs";
import { JudgeReturn } from "./JudgeReturn.mjs";

export const buildPossibleFindingId = (codeUnderReviewId, check) => `${codeUnderReviewId}|${check}`;

const TEST_PLAN_TRACK = "TEST_PLAN";

const IO_PATHS_TRACK = "IO_PATHS";

const DESIGN_TRACK = "DESIGN";

const ENTRY_BOUNDARY_TRACK = "ENTRY_BOUNDARY";

const TRACKS_PLACED_BY_THE_ABSTRACTION_PLACE = new Set([TEST_PLAN_TRACK, IO_PATHS_TRACK, DESIGN_TRACK, ENTRY_BOUNDARY_TRACK]);

export const isOnTheTestPlan = possibleFinding => possibleFinding.track === TEST_PLAN_TRACK;

export const isOnTheIoPaths = possibleFinding => possibleFinding.track === IO_PATHS_TRACK;

const isRaisedByTheScript = possibleFinding => possibleFinding.scriptRaised === true;

export const isPlacedByItsAbstractionPlace = possibleFinding => TRACKS_PLACED_BY_THE_ABSTRACTION_PLACE.has(possibleFinding.track) && !isRaisedByTheScript(possibleFinding);

export const isOnAnEntryBoundary = possibleFinding => possibleFinding.track === ENTRY_BOUNDARY_TRACK;

export const isInTheChange = possibleFinding => possibleFinding.inChange !== false;

const listEvidenceLines = named => [].concat(named.lines || named.line || []).map(Number).filter(line => line > 0);

const doesEvidenceMeetTheChange = (finding, changedLines) => (finding.evidence || [])
  .some(named => named.file && changedLines.meetsTheChange(stripLeadingDotSlash(named.file), listEvidenceLines(named)));

const isCreatedInTheChange = abstraction => abstraction.changeKind === CHANGE_KINDS.CREATED;

const doesTheListedFileMeetTheChange = (module, file, changedLines) => changedLines.touches(file)
  || changedLines.touches(`${module.path}/${file}`)
  || changedLines.touchesAPathEndingIn(module.path, file);

const doesTheFileListMeetTheChange = (finding, module, changedLines) => (finding.evidence || [])
  .some(named => named.file && doesTheListedFileMeetTheChange(module, stripLeadingDotSlash(named.file), changedLines));

const indexTheAbstractionsJudged = codeUnderReview => {
  const abstractionByCodeUnderReviewIdMap = new Map(codeUnderReview.map(abstraction => [abstraction.id, abstraction]));
  return finding => abstractionByCodeUnderReviewIdMap.get(finding.codeUnderReviewId);
};

const isMarkedExistingCodeByTheJudge = finding => finding.inChange === false;

const KINDS_THAT_PUT_A_MODULE_FINDING_IN_THE_CHANGE = new Set([PUBLIC_CHANGE_KINDS.MODIFIED, PUBLIC_CHANGE_KINDS.CREATED]);

const putsAModuleFindingInTheChange = publicChangeKind => KINDS_THAT_PUT_A_MODULE_FINDING_IN_THE_CHANGE.has(publicChangeKind);

const doesTheModuleFindingMeetTheChange = (finding, module, publicChangeKinds) => putsAModuleFindingInTheChange(publicChangeKinds.readKindOfTheFolder(module.path))
  || (finding.evidence || []).some(named => named.file && putsAModuleFindingInTheChange(publicChangeKinds.readKindOfTheChildOfTheFolder(module.path, named.file)));

const isAModule = abstraction => Boolean(abstraction) && abstraction.scale === Scale.MODULE.name;

const isTheModuleFindingInTheChange = (finding, module, changedLines, publicChangeKinds) => {
  if (finding.inChange === true) return true;
  if (publicChangeKinds.holdsAnyKind()) return doesTheModuleFindingMeetTheChange(finding, module, publicChangeKinds);
  if (isCreatedInTheChange(module) && !isMarkedExistingCodeByTheJudge(finding)) return true;
  return doesTheFileListMeetTheChange(finding, module, changedLines);
};

const isTheFindingInTheChange = (finding, abstraction, changedLines) => {
  if (finding.inChange === true) return true;
  if (abstraction && isCreatedInTheChange(abstraction) && !isMarkedExistingCodeByTheJudge(finding)) return true;
  return doesEvidenceMeetTheChange(finding, changedLines);
};

const NO_PUBLIC_CHANGE_KINDS = new PublicChangeKinds();

const markTheFinding = (finding, abstraction, changedLines, publicChangeKinds) => {
  if (isAModule(abstraction)) return { ...finding, inChange: isTheModuleFindingInTheChange(finding, abstraction, changedLines, publicChangeKinds) };
  return changedLines.holdsAnyChange() ? { ...finding, inChange: isTheFindingInTheChange(finding, abstraction, changedLines) } : finding;
};

export const markTheFindingsInTheChange = (findings, changedLines, codeUnderReview = [], publicChangeKinds = NO_PUBLIC_CHANGE_KINDS) => {
  if (!changedLines.holdsAnyChange() && !publicChangeKinds.holdsAnyKind()) return findings;
  const findTheAbstractionJudged = indexTheAbstractionsJudged(codeUnderReview);
  return findings.map(finding => markTheFinding(finding, findTheAbstractionJudged(finding), changedLines, publicChangeKinds));
};

export const buildPlaceAndFirstOwnLineKey = finding => `${buildPlaceKey(finding)}::${finding.ownLines ? finding.ownLines.from : ""}`;

const COVERED = "covered";

const THE_CHECK_A_COVERED_PATH_ANSWERS = "CD4";

const isAboutTheEntryMethod = possibleFinding => possibleFinding.check === THE_CHECK_A_COVERED_PATH_ANSWERS;

const NO_ABSTRACTION = Object.freeze({ path: "", lines: null, displayName: "", name: "", enclosing: "", usedIn: "", scale: "", track: "", judgeType: "", isTest: false });

const findFirstQuotedLine = (finding, file) => {
  for (const named of finding.evidence || []) {
    if (named.file && stripLeadingDotSlash(named.file) !== stripLeadingDotSlash(file)) continue;
    for (const line of [].concat(named.lines || named.line || [])) if (line) return Number(line);
  }
  return 0;
};

const readDeclaredLine = abstraction => (abstraction.lines || {}).from || 0;

const buildPlace = (finding, abstraction) => ({
  file: abstraction.path || "",
  line: findFirstQuotedLine(finding, abstraction.path) || readDeclaredLine(abstraction),
});

const findFirstLine = place => [].concat(place.lines || place.line || [])
  .map(Number).filter(line => line > 0).sort((left, right) => left - right)[0] || 0;

const isItsOwnCode = (place, abstraction) => isOwnCodeAt(
  { path: stripLeadingDotSlash(place.file), line: findFirstLine(place) },
  stripLeadingDotSlash(abstraction.path),
  readOwnSpans({ lines: abstraction.lines }),
);

const isTheAbstractionItself = (place, abstraction) => place.file === stripLeadingDotSlash(abstraction.path)
  && place.displayName === abstraction.displayName;

export const findSameDecisionPlacesOutsideItsOwnCode = possibleFinding => (possibleFinding.places || [])
  .filter(place => place.sameDecision === true && !isItsOwnCode(place, { path: possibleFinding.file, lines: possibleFinding.ownLines }));

const buildAbstractionFieldsOfDisplayName = (displayName, scale) => {
  const text = String(displayName || "");
  const mark = text.indexOf(METHOD_MARK);
  return {
    scale,
    name: mark < 0 ? text : text.slice(mark + 1),
    displayName: text,
    enclosing: mark < 0 ? "" : text.slice(0, mark),
    usedIn: "",
  };
};

const takeNextOrder = (orders, codeUnderReviewId) => {
  const order = (orders.get(codeUnderReviewId) || 0) + 1;
  orders.set(codeUnderReviewId, order);
  return order;
};

const findQuotedLinesInFile = (finding, file) => (finding.evidence || [])
  .filter(named => stripLeadingDotSlash(named.file) === stripLeadingDotSlash(file))
  .flatMap(named => [].concat(named.lines || named.line || []))
  .map(Number);

const findFieldOfTheFinding = (finding, codeUnderReview) => {
  const fields = codeUnderReview.fields || [];
  const quoted = findQuotedLinesInFile(finding, codeUnderReview.path);
  return fields.find(field => field.name === finding.field)
    || fields.find(field => quoted.some(line => doesSpanHoldLine(field.lines, line)))
    || null;
};

const readAbstractionOfTheFinding = (finding, codeUnderReview) => {
  const field = findFieldOfTheFinding(finding, codeUnderReview);
  return field ? { ...codeUnderReview, name: field.name, displayName: field.displayName, lines: field.lines } : codeUnderReview;
};

const readTheRelationOf = codeUnderReview => (codeUnderReview.relation ? { relation: codeUnderReview.relation } : {});

const buildAbstractionFields = abstraction => ({
  scale: abstraction.scale,
  name: abstraction.name,
  displayName: abstraction.displayName,
  enclosing: abstraction.enclosing,
  usedIn: abstraction.usedIn || "",
});

export class PossibleFindings {
  constructor(runFolder, files) {
    const given = files || {};
    this.preparedRun = new PreparedRun(runFolder);
    this.judgeReturn = JudgeReturn.readFrom(given.findings);
    this.places = new AbstractionsAtPlaces(runFolder, this.preparedRun.repository, this.preparedRun.abstractionsOfTheChange);
  }

  findSameDecisionPlaces(finding, abstraction) {
    const placesByKeyMap = new Map();
    for (const place of finding.places || []) {
      if (place.sameDecision !== true || isItsOwnCode(place, abstraction)) continue;
      const referenced = this.places.resolveReferencedPlaceAt(place.file, findFirstLine(place));
      const key = buildPlaceKey(referenced);
      if (!isTheAbstractionItself(referenced, abstraction) && !placesByKeyMap.has(key)) placesByKeyMap.set(key, referenced);
    }
    return [...placesByKeyMap.values()];
  }

  pointAtTheEntryMethod(possibleFinding) {
    const abstractionPlace = possibleFinding.abstractionPlace;
    const method = abstractionPlace && abstractionPlace.file ? this.preparedRun.findEntryMethodOfTheClassAt(stripLeadingDotSlash(abstractionPlace.file), Number(abstractionPlace.line) || 0) : null;
    return method ? { ...possibleFinding, abstractionPlace: { ...abstractionPlace, ...method } } : possibleFinding;
  }

  addTheAbstractionPlace(possibleFinding) {
    const places = this.places.resolveReferencedPlaces(possibleFinding);
    const abstractionPlace = places.abstractionPlace || { file: "", line: 0, displayName: "" };
    const scale = this.places.readScaleAt(abstractionPlace.file, abstractionPlace.line, abstractionPlace.displayName);
    return {
      ...possibleFinding,
      ...places,
      file: abstractionPlace.file,
      line: abstractionPlace.line,
      abstraction: buildAbstractionFieldsOfDisplayName(abstractionPlace.displayName, scale),
      displayName: abstractionPlace.displayName,
      scale,
      isTest: isTestPath(abstractionPlace.file),
    };
  }

  buildPossibleFindingOfAnAbstraction(finding, codeUnderReview) {
    const judged = readAbstractionOfTheFinding(finding, codeUnderReview);
    return {
      ...finding,
      ...(finding.places ? { alsoAt: this.findSameDecisionPlaces(finding, codeUnderReview) } : {}),
      ...buildPlace(finding, judged),
      possibleFindingId: buildPossibleFindingId(finding.codeUnderReviewId, finding.check),
      abstraction: buildAbstractionFields(judged),
      displayName: judged.displayName,
      track: codeUnderReview.track,
      scale: codeUnderReview.scale,
      ownLines: codeUnderReview.lines || null,
      isTest: Boolean(codeUnderReview.isTest),
      judgeType: codeUnderReview.judgeType || "",
      ...readTheRelationOf(codeUnderReview),
    };
  }

  buildPossibleFindingAtTheAbstractionPlace(finding, codeUnderReview, order) {
    const pointedPossibleFinding = isAboutTheEntryMethod(finding) ? this.pointAtTheEntryMethod(finding) : finding;
    return this.addTheAbstractionPlace({
      ...pointedPossibleFinding,
      possibleFindingId: `${buildPossibleFindingId(finding.codeUnderReviewId, finding.check)}|${order}`,
      track: codeUnderReview.track,
      judgeType: codeUnderReview.judgeType || "",
      ...readTheRelationOf(codeUnderReview),
    });
  }

  buildThePossibleFindings(findings = this.judgeReturn.listFindings()) {
    const orderByCodeUnderReviewIdMap = new Map();
    return findings.map(finding => {
      const codeUnderReview = this.preparedRun.findCodeUnderReview(finding.codeUnderReviewId) || NO_ABSTRACTION;
      if (isPlacedByItsAbstractionPlace(codeUnderReview) && !isRaisedByTheScript(finding)) return this.buildPossibleFindingAtTheAbstractionPlace(finding, codeUnderReview, takeNextOrder(orderByCodeUnderReviewIdMap, finding.codeUnderReviewId));
      return this.buildPossibleFindingOfAnAbstraction(finding, codeUnderReview);
    });
  }

  listCoveredPaths() {
    const orderByCodeUnderReviewIdMap = new Map();
    return this.judgeReturn.listCoveredPaths().map(covered => {
      const codeUnderReview = this.preparedRun.findCodeUnderReview(covered.codeUnderReviewId) || NO_ABSTRACTION;
      return this.addTheAbstractionPlace({
        ...this.pointAtTheEntryMethod(covered),
        check: THE_CHECK_A_COVERED_PATH_ANSWERS,
        possibleFindingId: `${covered.codeUnderReviewId}|${COVERED}|${takeNextOrder(orderByCodeUnderReviewIdMap, covered.codeUnderReviewId)}`,
        track: codeUnderReview.track || TEST_PLAN_TRACK,
        judgeType: codeUnderReview.judgeType || "",
      });
    });
  }
}
