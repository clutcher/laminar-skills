const QUOTED_FIELDS = ["quote", "code", "text", "snippet", "content", "lines", "line"];

const PLACE_FIELDS = ["file", "path", "displayName"];

const findFirst = (given, fields) => {
  for (const name of fields) if (given[name] !== undefined && given[name] !== null && given[name] !== "") return given[name];
  return "";
};

const formatNamedLines = given => Object.entries(given)
  .filter(([, value]) => value !== null && value !== undefined && value !== "")
  .map(([name, value]) => `${name}: ${convertToText(value)}`);

const formatPlaceLine = given => {
  const place = findFirst(given, PLACE_FIELDS);
  const quoted = findFirst(given, QUOTED_FIELDS.filter(name => name !== "line"));
  if (!place || !quoted) return "";
  return `${place}${given.line ? `:${given.line}` : ""}: ${convertToText(quoted)}`;
};

export function convertToText(given) {
  if (given === null || given === undefined) return "";
  if (typeof given === "string") return given;
  if (Array.isArray(given)) return given.map(convertToText).filter(Boolean).join("\n");
  if (typeof given !== "object") return String(given);
  return formatPlaceLine(given) || formatNamedLines(given).join("\n");
}
