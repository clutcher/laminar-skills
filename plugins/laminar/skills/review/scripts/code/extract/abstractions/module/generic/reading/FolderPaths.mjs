export const splitSegments = folder => String(folder || "").split("/").filter(Boolean);

const joinSegments = segments => segments.join("/");

export const listAncestors = folder => {
  const segments = splitSegments(folder);
  const found = [];
  for (let depth = segments.length; depth >= 0; depth--) found.push(joinSegments(segments.slice(0, depth)));
  return found;
};

export const isBelow = (folder, ancestor) => ancestor === "" ? folder !== "" : folder.startsWith(`${ancestor}/`);

export const findOneSegmentBelow = (folder, ancestor) => {
  const rest = ancestor === "" ? folder : folder.slice(ancestor.length + 1);
  const first = splitSegments(rest)[0];
  return first ? (ancestor === "" ? first : `${ancestor}/${first}`) : "";
};
