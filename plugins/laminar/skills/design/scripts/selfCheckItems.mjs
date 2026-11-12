import { readOptionsOrExit } from "./command/CommandLine.mjs";
import { RoundStop, readRunFolder } from "./round/RunFolder.mjs";
import { listSelfCheckItems } from "./round/SelfCheckItems.mjs";

const USAGE = "usage: node selfCheckItems.mjs --run <run folder of a self-check>";

const STOP_EXIT_CODE = 2;

function printSelfCheckItems() {
  const options = readOptionsOrExit(USAGE, ["run"], ["run"]);
  try {
    console.log(`RESULT ${JSON.stringify(listSelfCheckItems(readRunFolder(options.run, false)))}`);
  } catch (error) {
    if (!(error instanceof RoundStop)) throw error;
    console.error(error.message);
    process.exit(STOP_EXIT_CODE);
  }
}

printSelfCheckItems();
