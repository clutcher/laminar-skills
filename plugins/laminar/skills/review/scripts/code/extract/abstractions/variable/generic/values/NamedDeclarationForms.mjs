export const buildNamedDeclarationForm = source => word => new RegExp(source.replace(/NAME/g, word));

export const JAVA_LIKE_ENUM_MEMBER = buildNamedDeclarationForm("^\\s*(?:@\\w+(?:\\([^)]*\\))?\\s+)*NAME\\s*(?:[(,;{}]|$)");
export const LIST_ENUM_MEMBER = buildNamedDeclarationForm("^\\s*(?:\\[[^\\]]*\\]\\s*)*NAME\\s*(?:=(?!=)|[,}]|$)");
export const KOTLIN_OBJECT_VAL = buildNamedDeclarationForm("^\\s*(?:(?:public|internal|private|protected|const|override)\\s+)*val\\s+NAME\\b");
