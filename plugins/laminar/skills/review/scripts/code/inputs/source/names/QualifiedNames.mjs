const SCOPED_NAME_PATTERN = /^(.*?)(?:\.|::|:)([A-Za-z_$][\w$?!]*)$/;

export function splitScopeAndName(name) {
  const scopedName = name && SCOPED_NAME_PATTERN.exec(name);
  return scopedName ? { name: scopedName[2], scope: scopedName[1] } : { name, scope: null };
}

export const readLastSegment = (text, separator) => text.split(separator).pop();
