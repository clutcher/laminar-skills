import fs from "node:fs";
import path from "node:path";
import { readDesignModelOrExit, readOptionsOrExit } from "./command/CommandLine.mjs";
import { writeDesignText } from "./render/DesignText.mjs";

const USAGE = "usage: node renderDesign.mjs --model <design-model.json> --out <design.md>";

function renderDesign() {
  const options = readOptionsOrExit(USAGE, ["model", "out"], ["model", "out"]);
  const model = readDesignModelOrExit(options.model);

  const outPath = path.resolve(options.out);
  fs.mkdirSync(path.dirname(outPath), { recursive: true });
  fs.writeFileSync(outPath, writeDesignText(model));
  console.log(`RESULT ${JSON.stringify({ design: outPath, classes: model.classes.length, questions: (model.decisions.questions || []).length })}`);
}

renderDesign();
