const ITEM_HEAD = /^(\d+)\.(?: \[[^\]]*\])? (Application|Module|Class|Method|Variable|Abstraction)(?: (.*))?$/;

const QUOTE = "`";

const ENCLOSING_SEPARATOR = "` in `";

const USED_BARE_SEPARATOR = "` used bare in `";

const SCALES_THE_PLAN_PLACES = new Set(["application", "module", "class"]);

// The review prints its items to consider under this heading, after the items of every track.
const TO_CONSIDER_HEADING = "## To consider";

const SECTION_HEADING = /^## /;

const ITEM_BULLET = /^\s+- (.+)$/;

// A point right under the head of an item, and a point of a block under such a point, such as 1 direction among several.
const ITEM_POINT = /^ {3}- (.+)$/;

const BLOCK_POINT = /^ {5}- (.+)$/;

const LEAD_END = ": ";

const FULL_STOP = /\.$/;

// The review names the other abstractions of an item on 1 point `Also in <names>` where the item holds 1 check, and else in the block `Also in:` with 1 point `<lead>: <names>` per check.
const ALSO_IN_POINT = "Also in ";

const ALSO_IN_BLOCK = "Also in:";

const QUOTED_NAME = /`([^`]+)`/g;

// The review opens an item with 1 point per check it holds, its lead words before the first colon, or its lead words alone with a full stop where the check has no summary.
const readLeadOfThePoint = pointText => {
  const leadEndAt = pointText.indexOf(LEAD_END);
  return leadEndAt >= 0 ? pointText.slice(0, leadEndAt) : pointText.replace(FULL_STOP, "");
};

const readQuotedNames = text => [...text.matchAll(QUOTED_NAME)].map(match => match[1]);

// An empty lead stands for every check of the item, as the 1-point form holds only 1.
const EVERY_CHECK_OF_THE_ITEM = "";

const readAlsoInOfThePoint = pointText => (pointText.startsWith(ALSO_IN_POINT) ? [{ lead: EVERY_CHECK_OF_THE_ITEM, names: readQuotedNames(pointText) }] : []);

const readAlsoInOfTheBlockPoint = pointText => [{ lead: readLeadOfThePoint(pointText), names: readQuotedNames(pointText) }];

const createHeadNames = (name, enclosing = "") => ({ name, enclosing });

// A name in backticks may hold backticks itself, as a Kotlin test name does, so the head ends at the last backtick of the line, and the enclosing name follows the last separator.
const readNamesOfTheHead = headText => {
  const lastQuoteAt = headText.lastIndexOf(QUOTE);
  if (!headText.startsWith(QUOTE) || lastQuoteAt === 0) return createHeadNames("");

  const quoted = headText.slice(QUOTE.length, lastQuoteAt);
  const usedBareAt = quoted.indexOf(USED_BARE_SEPARATOR);
  if (usedBareAt >= 0) return createHeadNames(quoted.slice(0, usedBareAt));
  const enclosingAt = quoted.lastIndexOf(ENCLOSING_SEPARATOR);
  if (enclosingAt < 0) return createHeadNames(quoted);
  return createHeadNames(quoted.slice(0, enclosingAt), quoted.slice(enclosingAt + ENCLOSING_SEPARATOR.length));
};

// The review adds the line of the abstraction to the head where 2 items of 1 file print the same head, as for 2 overloads of 1 method.
const SHARED_HEAD_LINE = / · line (\d+)/;

const readLineOfTheHead = headText => {
  const lineMatch = SHARED_HEAD_LINE.exec(headText.slice(headText.lastIndexOf(QUOTE)));
  return lineMatch ? Number(lineMatch[1]) : null;
};

const readNamedItemOfTheLine = (line, isToConsider) => {
  const match = ITEM_HEAD.exec(line);
  if (!match) return null;

  const headText = match[3] || "";
  return { number: Number(match[1]), scale: match[2].toLowerCase(), toConsider: isToConsider, points: [], leads: [], alsoIn: [], line: readLineOfTheHead(headText), ...readNamesOfTheHead(headText) };
};

// Each item knows whether it stands under the heading of the items to consider, which ask the author a question and claim no defect, holds its first bullet line as its summary, each point right under its head with its lead words, among them the lead words of each check it holds, and the names of its points Also in, each with the lead of its check.
export const readNamedReviewItems = reportText => {
  let isToConsider = false;
  let isInTheAlsoInBlock = false;
  const items = [];
  for (const line of reportText.split("\n")) {
    if (SECTION_HEADING.test(line)) isToConsider = line.trim() === TO_CONSIDER_HEADING;
    const item = readNamedItemOfTheLine(line, isToConsider);
    if (item) {
      items.push(item);
      isInTheAlsoInBlock = false;
      continue;
    }
    const lastItem = items.at(-1);
    if (!lastItem) continue;

    const bullet = ITEM_BULLET.exec(line);
    if (bullet && lastItem.summary === undefined) lastItem.summary = bullet[1];
    const point = ITEM_POINT.exec(line);
    if (point) {
      lastItem.points.push(point[1]);
      lastItem.leads.push(readLeadOfThePoint(point[1]));
      lastItem.alsoIn.push(...readAlsoInOfThePoint(point[1]));
      isInTheAlsoInBlock = point[1] === ALSO_IN_BLOCK;
    }
    const blockPoint = BLOCK_POINT.exec(line);
    if (blockPoint && isInTheAlsoInBlock) lastItem.alsoIn.push(...readAlsoInOfTheBlockPoint(blockPoint[1]));
  }
  return items;
};

const LABEL_BULLET = /^ {3}- ([A-Z][A-Za-z ]+):/;

// The labels of the bullets right under the head of each item, such as `Prediction Failure` of `   - Prediction Failure: <text>`, so a reader can ask which cognitive failure an item keeps.
export const readItemsWithLabels = reportText => {
  const items = [];
  for (const line of reportText.split("\n")) {
    const item = readNamedItemOfTheLine(line, false);
    if (item) {
      items.push({ ...item, labels: new Set() });
      continue;
    }
    const bullet = LABEL_BULLET.exec(line);
    if (bullet && items.length) items.at(-1).labels.add(bullet[1]);
  }
  return items;
};

export const readReviewItems =reportText => readNamedReviewItems(reportText).map(({ number, scale }) => ({ number, scale }));

export const isPlacedByThePlan = item => SCALES_THE_PLAN_PLACES.has(item.scale);
