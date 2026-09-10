export const buildPathImportReader = (form, addUnaliased) => (text, add) => {
  const pathImport = form.exec(text);
  if (!pathImport) return false;
  for (const full of pathImport[1].split(",").map(piece => piece.trim())) {
    if (pathImport[2]) add(pathImport[2], full, stripLastSegment(full, "."));
    else addUnaliased(full, add);
  }
  return true;
};

export const stripLastSegment = (text, separator) => text.split(separator).slice(0, -1).join(separator);

export const parseAliasedNames = (text, arrow) => text.split(",").map(piece => piece.trim().replace(/^type\s+/, "")).filter(Boolean)
  .map(piece => piece.split(arrow).map(side => side.trim()))
  .filter(([name]) => /^[\w$]+$/.test(name))
  .map(([name, alias]) => ({ name, alias: alias && /^[\w$]+$/.test(alias) ? alias : name }));
