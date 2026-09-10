export const listLinesFromTo = (from, to) => Array.from({ length: Math.max(to - from + 1, 0) }, (_, offset) => from + offset);

export class FileLines {
  constructor(repositoryText) {
    this.repositoryText = repositoryText;
  }

  readFileLines(filePath) {
    return this.repositoryText.readFileLines(filePath) || [];
  }

  readNumberedLines(filePath, numbers) {
    const lines = this.readFileLines(filePath);
    return numbers.map(line => ({ line, text: String(lines[line - 1] ?? "").trim() }));
  }

  readUntrimmedLinesInOrder(filePath, numbers) {
    const lines = this.readFileLines(filePath);
    return [...new Set(numbers)].sort((left, right) => left - right).map(line => ({ line, text: String(lines[line - 1] || "") }));
  }
}
