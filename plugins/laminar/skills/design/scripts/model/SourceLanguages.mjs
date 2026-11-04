import path from "node:path";

// The languages whose method bodies the data-flow check parses.
export const PARSED_LANGUAGE_OF_EXTENSION_MAP = new Map([
  [".java", "Java"],
  [".js", "JavaScript"], [".mjs", "JavaScript"], [".cjs", "JavaScript"], [".jsx", "JavaScript"],
  [".ts", "TypeScript"], [".tsx", "TypeScript"], [".mts", "TypeScript"], [".cts", "TypeScript"],
]);

// The languages the skill reads by text: the parsed ones, and Kotlin, whose files a search for a class name reads as well as it reads Java.
const READ_EXTENSIONS = new Set([...PARSED_LANGUAGE_OF_EXTENSION_MAP.keys(), ".kt", ".kts"]);

// A folder or a file name that marks a test in the common stacks: test, tests, __tests__ and spec folders (Maven, Gradle, Jest, RSpec), and FooTest, FooTests, FooSpec, foo.test, foo.spec, test_foo and foo_test files (JUnit, Kotest, Jest, Vitest, pytest, Go).
const TEST_FOLDER = /(?:^|\/)(?:test|tests|__tests__|spec)\//;

const TEST_FILE_NAME = /(?:Test|Tests|Spec)\.\w+$|\.(?:test|spec)\.\w+$|^test_\w+\.py$|_test\.\w+$/;

export const readParsedLanguage = file => PARSED_LANGUAGE_OF_EXTENSION_MAP.get(path.extname(file)) || null;

export const isAReadExtension = file => READ_EXTENSIONS.has(path.extname(file));

export const isATestFile = file => TEST_FOLDER.test(file) || TEST_FILE_NAME.test(path.posix.basename(file));
