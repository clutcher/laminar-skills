const MAX_MAPPING_LINES_ABOVE = 8;

const ANNOTATION_LINE_PATTERN = /^\s*@/;
export const findAnnotationLinesAbove = (lines, headLine) => {
  const found = [];
  for (let line = headLine; line >= Math.max(1, headLine - MAX_MAPPING_LINES_ABOVE); line--) {
    const text = String(lines[line - 1] || "");
    if (line < headLine && !ANNOTATION_LINE_PATTERN.test(text) && text.trim()) break;
    if (ANNOTATION_LINE_PATTERN.test(text)) found.unshift({ line, text });
  }
  return found;
};

export const ANNOTATION_START_PATTERN = /^\s*(@|#\[|\[[A-Za-z])/;

export const opensAnAnnotation = text => ANNOTATION_START_PATTERN.test(String(text));
