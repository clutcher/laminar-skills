import fs from "node:fs";
import path from "node:path";
import { DesignModelStop, readDesignModel } from "../model/DesignModel.mjs";
import { CurrentTreeStop } from "../migration/CurrentTree.mjs";

const BASE_COMMIT_FILE = "base-commit.txt";

const STOP_EXIT_CODE = 2;

// A switch name stands alone and reads as true; every other option takes the word after it.
const readOptions = (argv, optionNames, repeatableNames, switchNames) => {
  const options = Object.fromEntries([...repeatableNames.map(name => [name, []]), ...switchNames.map(name => [name, false])]);
  let at = 0;
  while (at < argv.length) {
    const optionName = argv[at].replace(/^--/, "");
    if (!argv[at].startsWith("--")) return null;
    if (switchNames.includes(optionName)) {
      options[optionName] = true;
      at += 1;
      continue;
    }
    const isKnown = optionNames.includes(optionName) || repeatableNames.includes(optionName);
    if (!isKnown || at + 1 >= argv.length) return null;
    if (repeatableNames.includes(optionName)) options[optionName].push(argv[at + 1]);
    else options[optionName] = argv[at + 1];
    at += 2;
  }
  return options;
};

export const readOptionsOrExit = (usage, optionNames, requiredNames, repeatableNames = [], switchNames = []) => {
  const options = readOptions(process.argv.slice(2), optionNames, repeatableNames, switchNames);
  if (options && requiredNames.every(name => options[name])) return options;

  console.error(usage);
  process.exit(STOP_EXIT_CODE);
};

export const readDesignModelOrExit = modelPath => {
  try {
    return readDesignModel(modelPath);
  } catch (error) {
    if (!(error instanceof DesignModelStop)) throw error;
    console.error(error.message);
    process.exit(STOP_EXIT_CODE);
  }
};

// The base commit of the change: --base where given, else base-commit.txt beside the model, else none, and the working folder is the current tree.
export const readBaseCommit = options => {
  if (options.base) return options.base;

  const baseCommitPath = path.join(path.dirname(path.resolve(options.model)), BASE_COMMIT_FILE);
  if (!fs.existsSync(baseCommitPath)) return null;
  return fs.readFileSync(baseCommitPath, "utf8").trim() || null;
};

export const runOrExitOnTreeStop = readTheResult => {
  try {
    return readTheResult();
  } catch (error) {
    if (!(error instanceof CurrentTreeStop)) throw error;
    console.error(error.message);
    process.exit(STOP_EXIT_CODE);
  }
};
