import path from "node:path";
import { chooseRepositoryToRead } from "../../../code/index.mjs";
import { RepositoryLines } from "./RepositoryLines.mjs";
import { stripLeadingDotSlash } from "../abstractions/AbstractionsAtPlaces.mjs";
import { readJsonFile } from "../../../files/jsonFile.mjs";
import { REVIEW_ABSTRACTIONS_FILE } from "../../prepare/PrepareStep.mjs";
import { isOnTheIoPaths, isOnTheTestPlan } from "../returns/PossibleFindings.mjs";
import { FILE_LIST_SECTIONS, readListedText, findPlaceOfSliceLine, listPlacesShownInSections, readSliceSections } from "../../prepare/formats/SliceFormat.mjs";
import { readRelationPlaces } from "../../prepare/relations/DesignRelationCodeUnderReview.mjs";
import { readEntryBoundaryPlaces } from "../../prepare/relations/EntryBoundaryCodeUnderReview.mjs";
import { readBoundaryPathPlaces } from "../../prepare/relations/BoundaryPathCodeUnderReview.mjs";
import { SCRIPT_JUDGE_TYPE } from "../../prepare/settled/ScriptFindings.mjs";
import { LISTED_FILE_LINE_NUMBER } from "./LineCheck.mjs";
import { readSourceRoot } from "../../prepare/formats/CodeUnderReviewText.mjs";



const collectScriptSlicePlaces = codeUnderReview => (codeUnderReview.judgeType === SCRIPT_JUDGE_TYPE ? readSliceSections(codeUnderReview).flatMap(section => section.lines.map(line => findPlaceOfSliceLine(codeUnderReview.path, line))).filter(Boolean) : []);

const buildKey = (file, line) => `${stripLeadingDotSlash(file)}:${Number(line)}`;

const readTopClasses = boundary => (boundary.reach && boundary.reach.topClasses) || [];

const listTestPlanFiles = codeUnderReview => isOnTheTestPlan(codeUnderReview) ? [
  ...(codeUnderReview.boundaries || []).map(boundary => boundary.path),
  ...(codeUnderReview.tests || []).map(listed => listed.path),
  ...(codeUnderReview.boundaries || []).flatMap(readTopClasses).map(topClass => topClass.path),
] : [];

const collectIoPathsPlaces = codeUnderReview => isOnTheIoPaths(codeUnderReview) ? [
  ...(codeUnderReview.reachingCalls || []).flatMap(reachingCall => [reachingCall, ...(reachingCall.loops || []).flatMap(loop => [loop.loop, ...(loop.hops || [])])]),
  ...(codeUnderReview.calls || []).map(call => ({ ...call, path: (codeUnderReview.end || {}).path })),
].filter(Boolean) : [];

const listIoPathsFiles = codeUnderReview => [
  ...collectIoPathsPlaces(codeUnderReview).map(place => place.path),
  (codeUnderReview.end || {}).path,
];

const collectTestPlanBoundaries = everyCodeUnderReview => (everyCodeUnderReview || []).filter(isOnTheTestPlan).flatMap(codeUnderReview => codeUnderReview.boundaries || []);

const readNamedDeclarations = abstraction => (abstraction.namedDeclarations && abstraction.namedDeclarations.declarations) || [];

const readAtPlacesOf = abstraction => readNamedDeclarations(abstraction).flatMap(declaration => declaration.readAt || []);

const readOutsideDeclarationLines = abstraction => (abstraction.outsideDeclaration && abstraction.outsideDeclaration.lines) || [];

const collectPlaceListFiles = codeUnderReview => new Set([
  ...(codeUnderReview.sameDecisionAt || []).flatMap(occurrence => occurrence.places || []).map(place => place.path),
  ...listTestPlanFiles(codeUnderReview),
  ...(isOnTheIoPaths(codeUnderReview) ? listIoPathsFiles(codeUnderReview) : []),
  ...readNamedDeclarations(codeUnderReview).map(declaration => declaration.path),
  ...readAtPlacesOf(codeUnderReview).map(place => place.path),
  ...readOutsideDeclarationLines(codeUnderReview).map(place => place.path),
].filter(Boolean).map(stripLeadingDotSlash));

const buildPlaceListFilesByCodeUnderReview = everyCodeUnderReview => new Map((everyCodeUnderReview || []).map(codeUnderReview => [codeUnderReview.id, collectPlaceListFiles(codeUnderReview)]));

const findTheListedFileOf = (codeUnderReview, sectionName, line) => (listPlacesShownInSections(codeUnderReview.path, [{ section: sectionName, lines: [line] }])[0] || {}).file;

const collectListedFiles = codeUnderReview => readSliceSections(codeUnderReview)
  .filter(section => FILE_LIST_SECTIONS.has(section.section))
  .flatMap(section => (section.lines || []).map(line => ({ file: findTheListedFileOf(codeUnderReview, section.section, line), text: flattenText(line) })))
  .filter(listedFile => listedFile.file && listedFile.text);

const collectFilesWithNumberedLines = codeUnderReview => new Set(listPlacesShownInSections(codeUnderReview.path, readSliceSections(codeUnderReview))
  .filter(place => place.line > LISTED_FILE_LINE_NUMBER)
  .map(place => stripLeadingDotSlash(place.file)));

const findFilesListedOnly = codeUnderReview => {
  const withLines = collectFilesWithNumberedLines(codeUnderReview);
  return new Map(collectListedFiles(codeUnderReview)
    .map(listedFile => [stripLeadingDotSlash(listedFile.file), listedFile.text])
    .filter(([file]) => !withLines.has(file)));
};

const buildFilesListedOnlyByCodeUnderReview = everyCodeUnderReview => new Map((everyCodeUnderReview || []).map(codeUnderReview => [codeUnderReview.id, findFilesListedOnly(codeUnderReview)]));

export const flattenText = given => String(given == null ? "" : given).replace(/\s+/g, " ").trim();

export const collectEveryAbstraction = abstractions => {
  const found = [];
  const visit = abstraction => { found.push(abstraction); for (const child of abstraction.children || []) visit(child); };
  for (const root of abstractions || []) visit(root);
  return found;
};

export class SliceLines {
  constructor(runFolder, prepared = {}) {
    this.lineTextByPlaceMap = new Map();
    this.repositoryLines = new RepositoryLines(chooseRepositoryToRead(prepared.mode, prepared.target) || "");
    this.placeListFilesByIdMap = buildPlaceListFilesByCodeUnderReview(prepared.codeUnderReview);
    this.everyPlaceListFile = new Set([...this.placeListFilesByIdMap.values()].flatMap(files => [...files]));
    this.filesListedOnlyByIdMap = buildFilesListedOnlyByCodeUnderReview(prepared.codeUnderReview);
    this.sourceRootByIdMap = new Map((prepared.codeUnderReview || []).filter(codeUnderReview => readSourceRoot(codeUnderReview)).map(codeUnderReview => [codeUnderReview.id, readSourceRoot(codeUnderReview)]));
    const reviewed = readJsonFile(path.join(runFolder, REVIEW_ABSTRACTIONS_FILE));
    for (const abstraction of collectEveryAbstraction(reviewed.abstractions)) { this.readSlice(abstraction); this.readComments(abstraction); this.readPlaceList(abstraction); }
    for (const boundary of collectTestPlanBoundaries(prepared.codeUnderReview)) this.readTestPlanSlice(boundary);
    for (const place of (prepared.codeUnderReview || []).flatMap(collectIoPathsPlaces)) this.hold(place.path, place.line, place.text);
    for (const place of (prepared.codeUnderReview || []).flatMap(readRelationPlaces)) this.hold(place.path, place.line, place.text);
    for (const place of (prepared.codeUnderReview || []).flatMap(readEntryBoundaryPlaces)) this.hold(place.path, place.line, place.text);
    for (const place of (prepared.codeUnderReview || []).flatMap(readBoundaryPathPlaces)) this.hold(place.path, place.line, place.text);
    for (const place of (prepared.codeUnderReview || []).flatMap(collectScriptSlicePlaces)) this.hold(place.file, place.line, place.text);
  }

  readSlice(abstraction) {
    for (const section of readSliceSections(abstraction)) {
      for (const line of section.lines || []) {
        if (FILE_LIST_SECTIONS.has(section.section)) this.hold(readListedText(line), 0, line);
        else this.readLine(abstraction.path, line);
      }
    }
  }

  readPlaceList(abstraction) {
    for (const place of (abstraction.sameDecisionAt || []).flatMap(occurrence => occurrence.places || [])) this.hold(place.path, place.line, place.text);
    for (const declaration of readNamedDeclarations(abstraction)) this.hold(declaration.path, declaration.line, declaration.text);
    for (const place of readOutsideDeclarationLines(abstraction)) this.hold(place.path, place.line, place.text);
    for (const friction of abstraction.testFriction || []) this.hold(friction.path, friction.line, friction.text);
    for (const place of readAtPlacesOf(abstraction)) {
      this.hold(place.path, place.line, place.text);
      for (const below of place.below || []) this.hold(place.path, below.line, below.text);
    }
  }

  readTestPlanSlice(boundary) {
    for (const line of boundary.sliceLines || []) this.readLine(boundary.path, line);
  }

  readComments(abstraction) {
    for (const comment of abstraction.comments || []) this.hold(abstraction.path, comment.from, comment.text);
  }

  readLine(abstractionPath, line) {
    const place = findPlaceOfSliceLine(abstractionPath, line);
    if (place) return this.hold(place.file, place.line, place.text);
    return this.hold(abstractionPath, 0, line);
  }

  hold(file, line, text) {
    const flat = flattenText(text);
    if (!flat) return;
    const place = buildKey(file, line);
    if (!this.lineTextByPlaceMap.has(place)) this.lineTextByPlaceMap.set(place, flat);
  }

  readTextAt(file, line) {
    return this.lineTextByPlaceMap.get(buildKey(file, line)) || "";
  }

  readListedFileText(codeUnderReviewId, file) {
    return (this.filesListedOnlyByIdMap.get(codeUnderReviewId) || new Map()).get(stripLeadingDotSlash(file)) || "";
  }

  findFileFromTheSourceRoot(codeUnderReviewId, file) {
    const sourceRoot = this.sourceRootByIdMap.get(codeUnderReviewId);
    const named = stripLeadingDotSlash(file);
    return sourceRoot && !named.startsWith(`${sourceRoot}/`) ? `${sourceRoot}/${named}` : null;
  }

  readTextOfTheCodeUnderReview(codeUnderReviewId, file, line) {
    return this.readTextAt(file, line) || this.readPlaceListTextAt(this.placeListFilesByIdMap.get(codeUnderReviewId), file, line);
  }

  readPlaceListTextAt(placeListFiles, file, line) {
    if (!this.repositoryLines.holdsARepository() || !placeListFiles || !placeListFiles.has(stripLeadingDotSlash(file))) return "";
    return flattenText(this.repositoryLines.readFileLines(file)[Number(line) - 1]);
  }

  readContextAround(file, line, lines) {
    const around = Math.floor(lines / 2);
    const found = [];
    for (let at = Number(line) - around; at <= Number(line) + around; at++) {
      const text = this.readTextAt(file, at) || this.readPlaceListTextAt(this.everyPlaceListFile, file, at);
      if (text) found.push({ line: at, text });
    }
    return found;
  }
}
