import { STOP_REASONS } from "../model/DesignModelForm.mjs";
import { isAText, readList } from "../model/DesignModel.mjs";
import { getGroupOfTheClass } from "./FindingList.mjs";

export class StopListStop extends Error {}

const GROUP_STOP_AT = /^migration group (\d+)$/;

// A stop on a group with no class, such as a group of existing defects, names its group in place of an abstraction.
export const isAStopOnItsGroup = stop => Number.isInteger(stop.group) && isAText(stop.at) && Number(GROUP_STOP_AT.exec(stop.at)?.[1]) === stop.group;

// A stop of 0.73.0 names its group; an older stop names only the abstraction, whose class gives the group.
export const readGroupOfTheStop = (model, stop) => {
  if (Number.isInteger(stop.group)) return stop.group;
  const theClass = isAText(stop.at) ? model.findClass(stop.at) : null;
  return theClass ? getGroupOfTheClass(theClass) : null;
};

// The answer of a committed group is the changes-the-model answer of a self-check on a group that finished and was committed; it comes in by the stop list and is answered first like a stop, but its group stays finished.
export const isAnAnswerOfACommittedGroup = stop => stop.committed === true;

const findFormProblem = (stopped, at) => {
  const where = `stops[${at}]`;
  if (stopped === null || typeof stopped !== "object" || Array.isArray(stopped)) return `${where} is no object`;
  if (!Number.isInteger(stopped.group)) return `${where} holds no whole number under group`;
  const stop = stopped.stop || {};
  if (!STOP_REASONS.includes(stop.reason)) return `${where}: stop.reason ${JSON.stringify(stop.reason)} is not 1 of ${STOP_REASONS.join(", ")}`;
  if (!isAText(stop.at) || !isAText(stop.says)) return `${where}: stop needs the text of at and says`;
  if (!Array.isArray(stopped.leftFiles) || !stopped.leftFiles.every(isAText)) return `${where}: leftFiles is no list of paths`;
  if (stopped.committed !== undefined && !isAnAnswerOfACommittedGroup(stopped)) return `${where}: committed is ${JSON.stringify(stopped.committed)}, and only true or no committed is allowed`;
  if (isAnAnswerOfACommittedGroup(stopped) && stopped.leftFiles.length) return `${where}: the answer of a committed group holds leftFiles, and a committed group left no file uncommitted`;
  return null;
};

export const checkStopListForm = given => {
  if (!Array.isArray(given)) throw new StopListStop("stop: the file holds no JSON list");
  const problems = given.map(findFormProblem).filter(Boolean);
  if (problems.length) throw new StopListStop(`stop: the list is malformed:\n${problems.map(problem => `  ${problem}`).join("\n")}`);
  return given;
};

// A stop of 0.73.0 names the plan of its writer; an older stop names its round.
export const readPlanOfTheStop = stop => stop.plan ?? stop.round;

// Each stop of the list joins decisions.stops with the plan whose migration its writer wrote; a stop on an abstraction that a stop of an earlier plan already named is a second stop, which the writer never meets a third time.
export const recordTheStops = (decisions, stopList, stoppedPlan) => {
  const earlierStops = readList(decisions.stops);
  const recorded = stopList.map(stopped => ({ reason: stopped.stop.reason, at: stopped.stop.at, says: stopped.stop.says, plan: stoppedPlan, group: stopped.group, ...(isAnAnswerOfACommittedGroup(stopped) ? { committed: true } : {}) }));
  const secondStops = recorded
    .map(stop => ({ stop, earlier: earlierStops.find(other => other.at === stop.at && readPlanOfTheStop(other) < stoppedPlan) }))
    .filter(pair => pair.earlier)
    .map(pair => ({ ...pair.stop, earlierPlan: readPlanOfTheStop(pair.earlier) }));
  return { stops: [...earlierStops, ...recorded], secondStops };
};
