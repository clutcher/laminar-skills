import path from "node:path";
import { readList } from "../model/DesignModel.mjs";
import { STANDINGS, findStandingInTheModel } from "./AbstractionStanding.mjs";
import { listFormerNames, shareAFormerName } from "./FormerNames.mjs";
import { listRenamesBetweenRounds } from "./RoundRenames.mjs";
import { ROUND_DEFECT_CODES, SENT_TO, createRoundDefect } from "./Dispositions.mjs";
import { PLACEMENT_SCALES, createFindingKey } from "./RunFolder.mjs";

// The state of 1 finding key after a round, which the next round reads from counts.json.
export const KEY_STATES = Object.freeze({
  OPEN: "open",
  SENT: "sent",
  REASON: "reason",
  ANSWER: "answer",
  STILL_OPEN: "still open",
  CLOSED_BY_A_FIX: "closed by a fix",
  CLOSED_WITH_NO_FIX_STEP: "closed with no fix step",
  CLOSED_BY_THE_MODEL: "closed by the model",
});

const OPEN_STATES = new Set([KEY_STATES.OPEN, KEY_STATES.SENT]);

const LEFT_STATES = new Set([KEY_STATES.REASON, KEY_STATES.ANSWER]);

const SENT_STATES = new Set([KEY_STATES.SENT, KEY_STATES.STILL_OPEN]);

// A key in 1 of these states had a fix sent or made, so the same check under a former name of it is a return.
const STATES_OF_A_FIXED_FORMER_KEY = new Set([KEY_STATES.SENT, KEY_STATES.STILL_OPEN, KEY_STATES.CLOSED_BY_A_FIX, KEY_STATES.CLOSED_BY_THE_MODEL]);

const CLASS_SCALE = "class";

const STANDINGS_THAT_KEEP_A_KEY_OPEN = new Set([STANDINGS.STANDS, STANDINGS.UNCHANGED, STANDINGS.ABSENT]);

const ENCLOSING_MARK = " in ";

const readEnclosingName = displayName => (displayName.includes(ENCLOSING_MARK) ? displayName.slice(displayName.indexOf(ENCLOSING_MARK) + ENCLOSING_MARK.length) : displayName);

const listBoundaryClasses = model => new Set([
  ...readList(model.decisions.entries).map(entry => model.findClass(entry.handler)),
  ...readList(model.decisions.exits).map(exit => model.findClass(exit.from)),
].filter(Boolean));

// Open counts every finding at the application, module and class scales, and a method or variable finding only on a class that an entry or an exit of the model names.
const createOpenCountRule = model => {
  if (!model) return () => true;
  const boundaryClasses = listBoundaryClasses(model);
  return (displayName, scale) => PLACEMENT_SCALES.has(scale) || scale === CLASS_SCALE || boundaryClasses.has(model.findClass(readEnclosingName(displayName)));
};

const createKeyState = (displayName, check, scale, state, extra = {}) => ({ displayName, check, scale, state, ...extra });

const readFormerNamesOfTheState = keyState => (Array.isArray(keyState.formerNames) ? keyState.formerNames : [keyState.displayName]);

const readKeyOfTheState = keyState => createFindingKey(keyState.displayName, keyState.check);

const buildKeyStateMap = previous => new Map(readList(previous && previous.findingKeys).map(keyState => [readKeyOfTheState(keyState), keyState]));

const groupFindingsByKey = findings => {
  const findingsOfKeyMap = new Map();
  for (const finding of findings) findingsOfKeyMap.set(finding.findingKey, [...(findingsOfKeyMap.get(finding.findingKey) || []), finding]);
  return findingsOfKeyMap;
};

const readStateOfTheRaisedKey = readings => {
  const openReadings = readings.filter(reading => reading.open);
  if (openReadings.length) return openReadings.some(reading => reading.disposition && reading.disposition.to) ? KEY_STATES.SENT : KEY_STATES.OPEN;
  if (readings.some(reading => reading.leftAs === KEY_STATES.REASON)) return KEY_STATES.REASON;
  return KEY_STATES.ANSWER;
};

const readLeftState = (disposition, earlierState) => {
  if (disposition && disposition.reason !== undefined) return KEY_STATES.REASON;
  if (disposition && disposition.question !== undefined) return KEY_STATES.ANSWER;
  return disposition ? null : earlierState;
};

const readTheFinding = (finding, disposition, earlierState, isCountedAsOpen) => {
  const carried = !disposition && LEFT_STATES.has(earlierState);
  const leftAs = readLeftState(disposition, carried ? earlierState : null);
  return { finding, disposition, carried, leftAs, open: !leftAs, counted: isCountedAsOpen(finding.displayName, finding.scale) };
};

const countTheFindings = readings => ({
  findings: readings.length,
  withAReason: readings.filter(reading => !reading.carried && reading.leftAs === KEY_STATES.REASON).length,
  closedByAnAnswer: readings.filter(reading => !reading.carried && reading.leftAs === KEY_STATES.ANSWER).length,
  carried: readings.filter(reading => reading.carried).length,
  toTheDesigner: readings.filter(reading => reading.disposition && reading.disposition.to === SENT_TO.DESIGNER).length,
  toTheWriters: readings.filter(reading => reading.disposition && reading.disposition.to === SENT_TO.WRITER).length,
});

const describeTheStanding = standing => (standing.standing === STANDINGS.RENAMED ? `renamed to ${standing.newDisplayName} in the model` : "removed from the model");

class RoundComparison {
  constructor(run, dispositionOfFindingMap, previous, model, modelBefore, round) {
    this.run = run;
    this.previous = previous;
    this.model = model;
    this.modelBefore = modelBefore;
    this.newNameOfOldNameMap = listRenamesBetweenRounds(modelBefore, model);
    this.round = round;
    this.earlierKeyStateMap = buildKeyStateMap(previous);
    this.isCountedAsOpen = createOpenCountRule(model);
    this.readings = run.findings.map(finding => readTheFinding(finding, dispositionOfFindingMap.get(finding.index), this.readEarlierState(finding.findingKey), this.isCountedAsOpen));
    this.keyStateMap = new Map();
    this.notJudgedLines = [];
    this.defects = [];
  }

  readEarlierState(findingKey) {
    const earlier = this.earlierKeyStateMap.get(findingKey);
    return earlier ? earlier.state : null;
  }

  recordTheRaisedKeys() {
    for (const [findingKey, findings] of groupFindingsByKey(this.run.findings)) {
      const readings = this.readings.filter(reading => findings.includes(reading.finding));
      const { displayName, check, scale } = findings[0];
      this.keyStateMap.set(findingKey, createKeyState(displayName, check, scale, readStateOfTheRaisedKey(readings), {
        lastRaised: this.round,
        counted: readings.some(reading => reading.counted),
        carried: readings.some(reading => reading.carried),
        formerNames: listFormerNames(this.model, this.modelBefore, displayName, this.newNameOfOldNameMap),
      }));
    }
  }

  // A key sent to the designer or a writer that this round did not judge stays open, unless the model removed or renamed its abstraction explicitly; a key on an unchanged abstraction, or on one the model holds nowhere, stays open with a defect.
  readTheKeyNotJudged(earlier) {
    const standing = this.model ? findStandingInTheModel(this.model, earlier.displayName, this.newNameOfOldNameMap) : { standing: STANDINGS.STANDS };
    if (STANDINGS_THAT_KEEP_A_KEY_OPEN.has(standing.standing)) {
      this.notJudgedLines.push({ mark: KEY_STATES.STILL_OPEN, displayName: earlier.displayName, check: earlier.check, text: earlier.renamedFrom ? `renamed from ${earlier.renamedFrom}; no review judged it since round ${earlier.lastRaised}` : `no review judged it since round ${earlier.lastRaised}` });
      if (standing.standing === STANDINGS.UNCHANGED) this.defects.push(createRoundDefect(ROUND_DEFECT_CODES.OPEN_FINDING_ON_UNCHANGED_ABSTRACTION, earlier.displayName, `${earlier.check} is still open, and the model marks ${earlier.displayName} unchanged, so no review of the change judges it again; give it a reason class or change the model`));
      if (standing.standing === STANDINGS.ABSENT) this.defects.push(createRoundDefect(ROUND_DEFECT_CODES.OPEN_KEY_ABSENT_FROM_MODEL, earlier.displayName, `${earlier.check} is still open, and the model neither holds ${earlier.displayName} nor lists it as removed or as the old name or old path of another abstraction; record the removal or the rename in the model, or give it a reason class`));
      return { ...earlier, state: KEY_STATES.STILL_OPEN };
    }

    this.notJudgedLines.push({ mark: KEY_STATES.CLOSED_BY_THE_MODEL, displayName: earlier.displayName, check: earlier.check, text: describeTheStanding(standing) });
    if (standing.standing === STANDINGS.RENAMED) this.recordTheRenamedKey(earlier, standing.newDisplayName);
    return { ...earlier, state: KEY_STATES.CLOSED_BY_THE_MODEL, ...(standing.newDisplayName ? { renamedTo: standing.newDisplayName } : {}) };
  }

  // The new key of a renamed abstraction carries the open finding until a round judges it.
  recordTheRenamedKey(earlier, newDisplayName) {
    const newKey = createFindingKey(newDisplayName, earlier.check);
    if (this.keyStateMap.has(newKey)) return;

    const judged = this.run.judgedKeys.has(newKey);
    const state = judged ? KEY_STATES.CLOSED_BY_A_FIX : KEY_STATES.STILL_OPEN;
    this.keyStateMap.set(newKey, createKeyState(newDisplayName, earlier.check, earlier.scale, state, { lastRaised: earlier.lastRaised, counted: earlier.counted, renamedFrom: earlier.displayName, formerNames: [newDisplayName, ...readFormerNamesOfTheState(earlier)] }));
    if (!judged) this.notJudgedLines.push({ mark: KEY_STATES.STILL_OPEN, displayName: newDisplayName, check: earlier.check, text: `renamed from ${earlier.displayName}; no review judged it since round ${earlier.lastRaised}` });
  }

  readTheEarlierKey(findingKey, earlier) {
    const judged = this.run.judgedKeys.has(findingKey);
    if (SENT_STATES.has(earlier.state)) return judged ? { ...earlier, state: KEY_STATES.CLOSED_BY_A_FIX } : this.readTheKeyNotJudged(earlier);
    if (earlier.state === KEY_STATES.OPEN && judged) return { ...earlier, state: KEY_STATES.CLOSED_WITH_NO_FIX_STEP };
    return earlier;
  }

  recordTheEarlierKeys() {
    for (const [findingKey, earlier] of this.earlierKeyStateMap) {
      if (this.keyStateMap.has(findingKey)) continue;
      const keyState = this.readTheEarlierKey(findingKey, earlier);
      if (!this.keyStateMap.has(findingKey)) this.keyStateMap.set(findingKey, keyState);
    }
  }

  listKeysOfTheState(state) {
    return [...this.keyStateMap.entries()].filter(([, keyState]) => keyState.state === state).map(([findingKey]) => findingKey);
  }

  countStillOpen() {
    return [...this.keyStateMap.values()].filter(keyState => keyState.state === KEY_STATES.STILL_OPEN && keyState.counted !== false).length;
  }

  listRaisedBefore() {
    return [...this.earlierKeyStateMap.entries()].filter(([, keyState]) => keyState.lastRaised === this.round - 1);
  }

  compareWithTheRoundBefore(judgedBefore, fixCreatedFiles) {
    const judgedNow = this.run.judgedKeys;
    const raisedNow = new Set(this.run.findings.map(finding => finding.findingKey));
    const raisedBefore = this.listRaisedBefore();
    const raisedBeforeKeys = new Set(raisedBefore.map(([findingKey]) => findingKey));
    const vanished = raisedBefore.filter(([findingKey]) => judgedNow.has(findingKey) && !raisedNow.has(findingKey));
    const notJudgedAgain = raisedBefore.filter(([findingKey]) => !judgedNow.has(findingKey));
    const appeared = [...raisedNow].filter(findingKey => !raisedBeforeKeys.has(findingKey));
    const stateNow = findingKey => this.keyStateMap.get(findingKey).state;
    const isOpenNow = findingKey => OPEN_STATES.has(stateNow(findingKey)) && this.keyStateMap.get(findingKey).counted;
    return {
      judgedInBoth: [...judgedBefore].filter(findingKey => judgedNow.has(findingKey)).length,
      vanished: vanished.length,
      closedByAFix: vanished.filter(([, earlier]) => earlier.state === KEY_STATES.SENT).length,
      noFixStep: vanished.filter(([, earlier]) => earlier.state !== KEY_STATES.SENT).length,
      notJudgedAgain: notJudgedAgain.length,
      stillOpen: notJudgedAgain.filter(([findingKey]) => stateNow(findingKey) === KEY_STATES.STILL_OPEN).length,
      closedByTheModel: notJudgedAgain.filter(([findingKey]) => stateNow(findingKey) === KEY_STATES.CLOSED_BY_THE_MODEL).length,
      appeared: appeared.length,
      appearedOnJudgedKeys: appeared.filter(findingKey => judgedBefore.has(findingKey)).length,
      appearedCarried: appeared.filter(findingKey => this.keyStateMap.get(findingKey).carried).length,
      appearedOnFixCreatedFiles: fixCreatedFiles ? appeared.filter(findingKey => this.isOnAFixCreatedFile(findingKey, fixCreatedFiles)).length : null,
      openBefore: raisedBefore.filter(([findingKey, earlier]) => OPEN_STATES.has(earlier.state) && earlier.counted && judgedNow.has(findingKey)).length,
      openNow: [...raisedNow].filter(findingKey => isOpenNow(findingKey) && judgedBefore.has(findingKey)).length,
    };
  }

  isOnAFixCreatedFile(findingKey, fixCreatedFiles) {
    const fixCreatedFolders = new Set([...fixCreatedFiles].map(file => path.posix.dirname(file)));
    return this.run.findings
      .filter(finding => finding.findingKey === findingKey)
      .some(finding => finding.places.some(place => fixCreatedFiles.has(place.file) || (place.line === null && fixCreatedFolders.has(place.file))));
  }

  // The display names that hold an open finding of the round, each with its checks, for the send line.
  listOpenChecksOfNameMap(keyStates, round) {
    const openChecksOfNameMap = new Map();
    for (const keyState of keyStates) {
      if (keyState.lastRaised !== round || !OPEN_STATES.has(keyState.state) || !keyState.counted) continue;
      openChecksOfNameMap.set(keyState.displayName, [...(openChecksOfNameMap.get(keyState.displayName) || []), keyState.check]);
    }
    return openChecksOfNameMap;
  }

  // An earlier key of the same check under a former name, which this round did not raise, and whose finding a fix or the model closed or was sent to close: the rename or the move chased the finding.
  findFormerKeyOfTheReturn(findingKey, keyState, raisedNowKeys) {
    for (const [earlierKey, earlier] of this.earlierKeyStateMap) {
      if (earlierKey === findingKey || raisedNowKeys.has(earlierKey) || earlier.check !== keyState.check) continue;
      if (STATES_OF_A_FIXED_FORMER_KEY.has(earlier.state) && shareAFormerName(readFormerNamesOfTheState(earlier), keyState.formerNames)) return earlier;
    }
    return null;
  }

  findReturnedKeys() {
    const raisedNowKeys = new Set(this.run.findings.map(finding => finding.findingKey));
    const returnedKeys = [];
    for (const [findingKey, keyState] of this.keyStateMap) {
      if (keyState.lastRaised !== this.round || keyState.carried) continue;
      if (this.readEarlierState(findingKey) === KEY_STATES.CLOSED_BY_A_FIX) {
        returnedKeys.push(keyState);
        continue;
      }
      const formerKey = this.findFormerKeyOfTheReturn(findingKey, keyState, raisedNowKeys);
      if (formerKey) returnedKeys.push({ ...keyState, returnedFrom: formerKey.displayName });
    }
    return returnedKeys;
  }

  compare(judgedBefore, fixCreatedFiles) {
    this.recordTheRaisedKeys();
    this.recordTheEarlierKeys();
    const counted = this.readings.filter(reading => reading.open && reading.counted).length;
    const stillOpen = this.countStillOpen();
    return {
      counts: { ...countTheFindings(this.readings), open: counted + stillOpen, stillOpen },
      comparison: this.previous ? this.compareWithTheRoundBefore(judgedBefore, fixCreatedFiles) : null,
      findingKeys: [...this.keyStateMap.values()],
      notJudgedLines: this.notJudgedLines,
      defects: this.defects,
      returnedKeys: this.findReturnedKeys(),
      openChecksNow: this.listOpenChecksOfNameMap(this.keyStateMap.values(), this.round),
      openChecksBefore: this.listOpenChecksOfNameMap(this.earlierKeyStateMap.values(), this.round - 1),
      readings: this.readings,
    };
  }
}

export const compareTheRound = ({ run, dispositionOfFindingMap, previous, judgedBefore, model, modelBefore, round, fixCreatedFiles }) => new RoundComparison(run, dispositionOfFindingMap, previous, model, modelBefore, round).compare(judgedBefore || new Set(), fixCreatedFiles);
