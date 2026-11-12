import { DEFECT_CODES, createRecheckDefect } from "./DesignDefect.mjs";
import { TABLE_FORMS, listBodyTables, listTreeTables, readTreeFileOfTheClass } from "./LiteralTables.mjs";

const SHARED_MEMBERS_OF_A_REPEAT = 2;

const readLastName = name => String(name || "").split(".").pop();

// 2 keyed tables of 1 closed set, where a table read from bare case labels may stand for any closed set.
const isTheSameClosedSet = (first, second) => !first.closedSetName || !second.closedSetName || readLastName(first.closedSetName) === readLastName(second.closedSetName);

const listSharedMembers = (first, second) => [...first.valueOfMemberMap.keys()].filter(member => second.valueOfMemberMap.has(member));

const isTheSameKeyedTable = (first, second) => {
  if (first.form !== TABLE_FORMS.KEYED || second.form !== TABLE_FORMS.KEYED || !isTheSameClosedSet(first, second)) return false;

  const sharedMembers = listSharedMembers(first, second);
  return sharedMembers.length >= SHARED_MEMBERS_OF_A_REPEAT && sharedMembers.every(member => first.valueOfMemberMap.get(member) === second.valueOfMemberMap.get(member));
};

const isTheSameSet = (first, second) => first.form === TABLE_FORMS.SET && second.form === TABLE_FORMS.SET && first.values.join("\n") === second.values.join("\n");

const isTheSameTable = (first, second) => isTheSameKeyedTable(first, second) || isTheSameSet(first, second);

const describeTheTable = (table, other) => {
  if (table.form === TABLE_FORMS.SET) return `[${table.values.join(", ")}]`;

  const entries = listSharedMembers(table, other).map(member => `${member}: ${table.valueOfMemberMap.get(member)}`);
  return `${table.closedSetName || other.closedSetName} {${entries.join(", ")}}`;
};

const findTheSameTables = (tables, otherTables) => {
  for (const table of tables) {
    const otherTable = otherTables.find(other => isTheSameTable(table, other));
    if (otherTable) return { table, otherTable };
  }
  return null;
};

const listOtherBodiesAndFiles = (model, bodyTables, at, treeTables) => {
  const { theClass, displayName } = bodyTables[at];
  const ownTreeFile = readTreeFileOfTheClass(model, theClass);
  return [
    ...bodyTables.slice(at + 1).filter(other => other.displayName !== displayName).map(other => ({ name: other.displayName, tables: other.tables })),
    ...treeTables.filter(treeTable => treeTable.file !== ownTreeFile).map(treeTable => ({ name: treeTable.file, tables: treeTable.tables })),
  ];
};

// A table of a body of the model whose keys and values, or whose values, another body or a file of the current tree that the model names holds again: 1 decision written twice drifts with no signal. It is a recheck case, because whether 2 equal tables are 1 rule or 2 is a question of the business.
export const findRepeatedDecisionDefects = (model, currentTree) => {
  const bodyTables = listBodyTables(model);
  const treeTables = currentTree ? listTreeTables(model, currentTree) : [];
  const defects = [];
  bodyTables.forEach((bodyTable, at) => {
    for (const other of listOtherBodiesAndFiles(model, bodyTables, at, treeTables)) {
      const sameTables = findTheSameTables(bodyTable.tables, other.tables);
      if (!sameTables) continue;

      const sentence = `${bodyTable.displayName} holds the table ${describeTheTable(sameTables.table, sameTables.otherTable)}, and ${other.name} holds the same table: make 1 of them the owner, or say why they are 2 rules`;
      defects.push(createRecheckDefect(DEFECT_CODES.REPEATED_TABLE, model.getMethodPath(bodyTable.theClass, bodyTable.method), sentence));
    }
  });
  return defects;
};
