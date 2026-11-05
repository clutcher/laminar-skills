import fs from "node:fs";
import path from "node:path";
import { isAText, readList } from "../model/DesignModel.mjs";
import { getGroupOfTheClass } from "./FindingList.mjs";
import { FINDINGS_FILE, getPlanFolder } from "./PlanFolder.mjs";

const MIGRATION_WORKFLOW_FILE = "migration.workflow.js";

const RETURN_LINE = /^return (.*)$/m;

const readPlanOfTheStop = stop => stop.plan ?? stop.round;

// The groups that the migration workflow file of a plan planned, with the earlier groups each one waits for.
export const readPlannedGroups = planFolder => {
  const workflowFilePath = path.join(planFolder, MIGRATION_WORKFLOW_FILE);
  if (!fs.existsSync(workflowFilePath)) return [];
  const returned = RETURN_LINE.exec(fs.readFileSync(workflowFilePath, "utf8"));
  return returned ? readList(JSON.parse(returned[1]).groups) : [];
};

const readEarlierEntries = planFolder => {
  const findingsPath = path.join(planFolder, FINDINGS_FILE);
  return fs.existsSync(findingsPath) ? readList(JSON.parse(fs.readFileSync(findingsPath, "utf8"))) : [];
};

// A stop of 0.73.0 names its group; an older stop names only the abstraction, whose class gives the group.
const readGroupOfTheStop = (model, stop) => {
  if (Number.isInteger(stop.group)) return stop.group;
  const theClass = isAText(stop.at) ? model.findClass(stop.at) : null;
  return theClass ? getGroupOfTheClass(theClass) : null;
};

// The groups of the plan before that no writer finished: each group of a stop, by its group or the class it names, and each planned group that waits for one of them, because the writer workflow starts no such group.
export const listUnfinishedGroups = (model, stops, plannedGroups) => {
  const unfinished = new Set(stops.map(stop => readGroupOfTheStop(model, stop)).filter(Number.isInteger));
  for (const planned of plannedGroups) {
    if (readList(planned.dependsOn).some(earlier => unfinished.has(earlier))) unfinished.add(planned.group);
  }
  return unfinished;
};

const isTheSameFinding = (entry, earlier) => entry.number === earlier.number && entry.check === earlier.check && entry.displayName === earlier.displayName;

const gotAStep = entry => !isAText(entry.reason) && !entry.toConsider && !entry.fixedBy;

// On a plan that takes the stops of the plan before, from the same run folder, each finding whose finding step a finished group of the plan before wrote stays fixed by that plan and group, so no writer fixes it twice; the stopped and the unstarted groups are planned again.
export const carryTheFixedFindings = (model, resultsFolder, plan, entries) => {
  const stops = readList(model.decisions.stops).filter(stop => readPlanOfTheStop(stop) === plan - 1);
  if (plan < 2 || !stops.length) return { entries, unfinishedGroups: [] };

  const earlierFolder = getPlanFolder(resultsFolder, plan - 1);
  const plannedGroups = readPlannedGroups(earlierFolder);
  const plannedNumbers = new Set(plannedGroups.map(planned => planned.group));
  const unfinishedGroups = listUnfinishedGroups(model, stops, plannedGroups);
  const earlierEntries = readEarlierEntries(earlierFolder);
  const carried = entries.map(entry => {
    if (!gotAStep(entry)) return entry;
    const earlier = earlierEntries.find(other => isTheSameFinding(entry, other));
    if (!earlier) return entry;
    if (earlier.fixedBy) return { ...entry, fixedBy: earlier.fixedBy };
    const isWrittenByAFinishedGroup = gotAStep(earlier) && plannedNumbers.has(earlier.group) && !unfinishedGroups.has(earlier.group);
    return isWrittenByAFinishedGroup ? { ...entry, fixedBy: { plan: plan - 1, group: earlier.group } } : entry;
  });
  return { entries: carried, unfinishedGroups: [...unfinishedGroups].sort((first, second) => first - second) };
};
