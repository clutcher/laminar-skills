import { STOP_REASONS } from "../model/DesignModelForm.mjs";
import { isAText, readList } from "../model/DesignModel.mjs";

export class StopListStop extends Error {}

const findFormProblem = (stopped, at) => {
  const where = `stops[${at}]`;
  if (stopped === null || typeof stopped !== "object" || Array.isArray(stopped)) return `${where} is no object`;
  if (!Number.isInteger(stopped.group)) return `${where} holds no whole number under group`;
  const stop = stopped.stop || {};
  if (!STOP_REASONS.includes(stop.reason)) return `${where}: stop.reason ${JSON.stringify(stop.reason)} is not 1 of ${STOP_REASONS.join(", ")}`;
  if (!isAText(stop.at) || !isAText(stop.says)) return `${where}: stop needs the text of at and says`;
  if (!Array.isArray(stopped.leftFiles) || !stopped.leftFiles.every(isAText)) return `${where}: leftFiles is no list of paths`;
  return null;
};

export const checkStopListForm = given => {
  if (!Array.isArray(given)) throw new StopListStop("stop: the file holds no JSON list");
  const problems = given.map(findFormProblem).filter(Boolean);
  if (problems.length) throw new StopListStop(`stop: the list is malformed:\n${problems.map(problem => `  ${problem}`).join("\n")}`);
  return given;
};

const readPlanOfTheStop = stop => stop.plan ?? stop.round;

// Each stop of the list joins decisions.stops with the plan whose migration its writer wrote; a stop on an abstraction that a stop of an earlier plan already named is a second stop, which the writer never meets a third time.
export const recordTheStops = (decisions, stopList, stoppedPlan) => {
  const earlierStops = readList(decisions.stops);
  const recorded = stopList.map(stopped => ({ reason: stopped.stop.reason, at: stopped.stop.at, says: stopped.stop.says, plan: stoppedPlan, group: stopped.group }));
  const secondStops = recorded
    .map(stop => ({ stop, earlier: earlierStops.find(other => other.at === stop.at && readPlanOfTheStop(other) < stoppedPlan) }))
    .filter(pair => pair.earlier)
    .map(pair => ({ ...pair.stop, earlierPlan: readPlanOfTheStop(pair.earlier) }));
  return { stops: [...earlierStops, ...recorded], secondStops };
};
