import { readDeclaredAbstractions, Scale } from "../../../../../code/index.mjs";
import { readFileStem, readFolderPath } from "../../../../../files/paths.mjs";

const isTheTypeTheFileIsNamedFor = (filePath, typeName) => readFileStem(filePath) === typeName;

const readTypeKey = (filePath, typeName) => `${filePath}\u0000${typeName}`;

const readDeclarationKey = declaration => `${declaration.path}\u0000${declaration.line}`;

export class DeclarationEnclosingTypes {
  constructor(repositoryText, references) {
    this.repositoryText = repositoryText;
    this.references = references;
    this.enclosingTypeByDeclarationMap = new Map();
  }

  rememberEnclosingTypes(found) {
    for (const { declaration, enclosingTypeName } of found.listed) {
      if (enclosingTypeName) this.enclosingTypeByDeclarationMap.set(readDeclarationKey(declaration), enclosingTypeName);
    }
  }

  readRememberedEnclosingType(declaration) {
    return this.enclosingTypeByDeclarationMap.get(readDeclarationKey(declaration)) || "";
  }

  namesTheEnclosingType(qualifier, rememberedEnclosingType, filePath) {
    return qualifier === rememberedEnclosingType || this.isTheEnclosingTypeAt(filePath, qualifier);
  }

  isTheEnclosingTypeAt(filePath, enclosingTypeName) {
    return this.declaresType(filePath, enclosingTypeName) || readFolderPath(filePath).split("/").pop() === enclosingTypeName;
  }

  declaresType(filePath, typeName) {
    return isTheTypeTheFileIsNamedFor(filePath, typeName) || this.collectDeclaredClasses().has(readTypeKey(filePath, typeName));
  }

  collectDeclaredClasses() {
    if (!this.classesByPathAndNameSet) {
      this.classesByPathAndNameSet = new Set(readDeclaredAbstractions(this.references.graph, filePath => this.repositoryText.readFileLines(filePath))
        .filter(declaration => declaration.scale === Scale.CLASS.name)
        .map(declaration => readTypeKey(declaration.path, declaration.name)));
    }
    return this.classesByPathAndNameSet;
  }
}
