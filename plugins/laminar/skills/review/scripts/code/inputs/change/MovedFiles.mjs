import path from "node:path";

const LONGEST_CHUNK_BYTES = 64;
const NEWLINE = 0x0a;
const FULL_SCORE = 60000;
const LEAST_MOVE_SCORE = FULL_SCORE / 2;
const MOST_FILES_A_SIDE_COMPARED = 1000;

function countChunkBytes(lines) {
  const bytes = Buffer.from(lines.map(line => `${line}\n`).join(""), "utf8");
  const bytesByChunkMap = new Map();
  let start = 0;
  for (let at = 0; at < bytes.length; at++) {
    const length = at - start + 1;
    if (bytes[at] !== NEWLINE && length < LONGEST_CHUNK_BYTES) continue;
    const chunk = bytes.toString("latin1", start, at + 1);
    bytesByChunkMap.set(chunk, (bytesByChunkMap.get(chunk) || 0) + length);
    start = at + 1;
  }
  return { size: bytes.length, chunks: bytesByChunkMap };
}

function measureScore(removed, created) {
  const larger = Math.max(removed.content.size, created.content.size);
  const smaller = Math.min(removed.content.size, created.content.size);
  if (!smaller || larger * (FULL_SCORE - LEAST_MOVE_SCORE) < (larger - smaller) * FULL_SCORE) return 0;
  let shared = 0;
  for (const [chunk, bytes] of removed.content.chunks) shared += Math.min(bytes, created.content.chunks.get(chunk) || 0);
  return Math.floor(shared * FULL_SCORE / larger);
}

const readFile = ({ path: filePath, lines }) => ({ path: filePath, name: path.posix.basename(filePath), content: countChunkBytes(lines) });

const compareByPath = (left, right) => (left.path < right.path ? -1 : left.path > right.path ? 1 : 0);

const findNamesFoundOnce = files => {
  const countByNameMap = new Map();
  for (const file of files) countByNameMap.set(file.name, (countByNameMap.get(file.name) || 0) + 1);
  return new Set([...countByNameMap].filter(([, count]) => count === 1).map(([name]) => name));
};

function movesBetweenSameNames(removed, created) {
  const removedOnce = findNamesFoundOnce(removed);
  const createdOnce = findNamesFoundOnce(created);
  return removed
    .filter(file => removedOnce.has(file.name) && createdOnce.has(file.name))
    .map(file => ({ removed: file, created: created.find(other => other.name === file.name) }))
    .filter(pair => measureScore(pair.removed, pair.created) >= LEAST_MOVE_SCORE);
}

function movesByBestScore(removed, created) {
  if (removed.length * created.length > MOST_FILES_A_SIDE_COMPARED * MOST_FILES_A_SIDE_COMPARED) return [];
  const scored = created.flatMap((createdFile, createdOrder) => removed.map((removedFile, removedOrder) =>
    ({ removed: removedFile, created: createdFile, score: measureScore(removedFile, createdFile), createdOrder, removedOrder })));
  const moves = [];
  const pairedPaths = new Set();
  const byScore = scored
    .filter(pair => pair.score >= LEAST_MOVE_SCORE)
    .sort((left, right) => right.score - left.score || left.createdOrder - right.createdOrder || left.removedOrder - right.removedOrder);
  for (const pair of byScore) {
    if (pairedPaths.has(pair.removed.path) || pairedPaths.has(pair.created.path)) continue;
    pairedPaths.add(pair.removed.path).add(pair.created.path);
    moves.push({ removed: pair.removed, created: pair.created });
  }
  return moves;
}

export function movesAmong(removedFiles, createdFiles) {
  const removed = removedFiles.map(readFile).sort(compareByPath);
  const created = createdFiles.map(readFile).sort(compareByPath);
  const sameNames = movesBetweenSameNames(removed, created);
  const paired = new Set(sameNames.flatMap(pair => [pair.removed.path, pair.created.path]));
  const rest = movesByBestScore(removed.filter(file => !paired.has(file.path)), created.filter(file => !paired.has(file.path)));
  return [...sameNames, ...rest].map(pair => ({ from: pair.removed.path, to: pair.created.path }));
}
