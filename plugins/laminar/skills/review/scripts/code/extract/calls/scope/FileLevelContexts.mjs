export const FileLevelContexts = {
  getOrAddContext(file, enclosingTypeName) {
    const key = `${file.path}\u0000${enclosingTypeName}`;
    if (!this.contextByFileAndEnclosingTypeMap.has(key)) this.contextByFileAndEnclosingTypeMap.set(key, { id: `context\u0000${key}`, path: file.path, file, enclosingTypeName, line: 1, to: 0, parameterNames: [] });
    return this.contextByFileAndEnclosingTypeMap.get(key);
  },
};
