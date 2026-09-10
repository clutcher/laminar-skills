import { readLanguageFamily, isABareGroupName } from "../../../code/index.mjs";

const GROUP_MARK = "G";

export const isResolved = call => (call.on || []).length > 0 && Boolean(call.callee);

const compareByCountThenText = (left, right) => right.count - left.count || (left.text < right.text ? -1 : left.text > right.text ? 1 : 0);

const listCounted = counts => [...counts].map(([text, count]) => ({ text, count })).sort(compareByCountThenText);

const createGroupKey = (family, name) => `${family}\u0000${name}`;

export function buildIoGroups(ends) {
  const groupsByKeyMap = new Map();
  for (const end of ends) {
    const family = readLanguageFamily(end.path) || "";
    for (const call of end.calls.filter(isResolved)) {
      const key = createGroupKey(family, call.on[0]);
      if (!groupsByKeyMap.has(key)) groupsByKeyMap.set(key, { name: call.on[0], family, bare: isABareGroupName(call.on[0]), count: 0, countByNameMap: new Map(), countByCalleeMap: new Map() });
      const group = groupsByKeyMap.get(key);
      group.count++;
      for (const name of call.on.slice(1)) group.countByNameMap.set(name, (group.countByNameMap.get(name) || 0) + 1);
      group.countByCalleeMap.set(call.callee, (group.countByCalleeMap.get(call.callee) || 0) + 1);
    }
  }
  return [...groupsByKeyMap.values()]
    .map(group => ({ name: group.name, family: group.family, bare: group.bare, count: group.count, names: listCounted(group.countByNameMap).map(named => named.text), callees: listCounted(group.countByCalleeMap) }))
    .sort((left, right) => right.count - left.count || (left.name < right.name ? -1 : left.name > right.name ? 1 : 0))
    .map((group, index) => ({ id: `${GROUP_MARK}${index + 1}`, ...group }));
}

export function buildWorkflowGroups(ends) {
  const summaryIdByGroupKeyMap = new Map(buildIoGroups(ends).map(ioGroup => [createGroupKey(ioGroup.family, ioGroup.name), ioGroup.id]));
  const groupsByKeyMap = new Map();
  for (const end of ends) {
    const family = readLanguageFamily(end.path) || "";
    for (const call of end.calls.filter(isResolved)) {
      const summaryId = summaryIdByGroupKeyMap.get(createGroupKey(family, call.on[0]));
      const key = `${summaryId}\u0000${call.on.join("\u0000")}`;
      if (!groupsByKeyMap.has(key)) groupsByKeyMap.set(key, { names: call.on, callIdsByCalleeMap: new Map(), summaryId });
      const callIdsByCalleeMap = groupsByKeyMap.get(key).callIdsByCalleeMap;
      if (!callIdsByCalleeMap.has(call.callee)) callIdsByCalleeMap.set(call.callee, []);
      callIdsByCalleeMap.get(call.callee).push(call.id);
    }
  }
  return [...groupsByKeyMap.values()].map(group => [group.names, [...group.callIdsByCalleeMap], group.summaryId]);
}

function listDependencyFiles(files) {
  const shown = new Set();
  return files.map(file => {
    const fresh = file.lines.filter(line => !shown.has(line));
    for (const line of fresh) shown.add(line);
    return { path: file.path, lineCount: file.lineCount, dependencyLines: file.dependencyLines, repeated: file.lines.length - fresh.length, lines: fresh };
  });
}

export function buildIoSummary(ends, dependencies) {
  const groups = buildIoGroups(ends);
  const endCalls = groups.reduce((total, group) => total + group.count, 0);
  const leftOver = ends.reduce((total, end) => total + end.calls.filter(call => !isResolved(call)).length, 0);
  return {
    groups,
    groupCount: groups.length,
    endCalls,
    leftOver,
    dependencyFiles: listDependencyFiles((dependencies || {}).files || []),
    dependencyFileCount: ((dependencies || {}).files || []).length,
  };
}
