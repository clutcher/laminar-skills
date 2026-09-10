const LITERAL_VALUE_PATTERN = /=\s*(?:-\s*)?(?:0x[\da-f_]+|\d[\d_]*(?:\.\d[\d_]*)?(?:e[+-]?\d+)?|\.\d[\d_]*|"(?:[^"\\]|\\.)*"|'(?:[^'\\]|\\.)*'|`[^`$]*`|true|false)[a-z]?\s*;?\s*(?:(?:\/\/|#).*)?$/i;

export const namesALiteral = declaration => LITERAL_VALUE_PATTERN.test(String(declaration));

const VARIABLE_DECLARATIONS = [
  /^\s*(?:final\s+)?(?:var|val|let|const)\s+([A-Za-z_]\w*)\s*(?::\s*[^=]+)?=(?!=)/,
  /^\s*(?:final\s+)?(?:boolean|int|long|double|float|short|byte|char|string|String|[A-Z][\w.]*(?:<[^=;]*>)?(?:\[\])*)\s+([a-z_]\w*)\s*=(?!=)/,
  /^\s*([a-z_]\w*)\s*:=/,
];
const NON_VARIABLE_LINE_PATTERN = /^\s*(?:public|private|protected|static|return|if|while|for|else)\b/;

export function findLocalVariables(lines) {
  const names = [];
  for (const line of lines) {
    if (NON_VARIABLE_LINE_PATTERN.test(line)) continue;
    for (const pattern of VARIABLE_DECLARATIONS) {
      const found = pattern.exec(line);
      if (found && !names.includes(found[1])) { names.push(found[1]); break; }
    }
  }
  return names;
}
