import { GenericApplicationFinder } from "../generic/GenericApplicationFinder.mjs";

const readXmlValue = (block, tag) => (new RegExp(`<${tag}>\\s*([^<]*?)\\s*</${tag}>`).exec(block) || [])[1] || "";

function findMavenLines(lines) {
  const text = lines.join("\n");
  return [...text.matchAll(/<dependency>([\s\S]*?)<\/dependency>/g)]
    .map(found => [readXmlValue(found[1], "groupId"), readXmlValue(found[1], "artifactId")].filter(Boolean).join(":"))
    .filter(Boolean);
}

export class MavenApplicationFinder extends GenericApplicationFinder {
  buildSystem = "maven";
  buildFileNames = ["pom.xml"];
  buildFileSuffixes = [];
  dependencyFormats = [{ name: /^pom\.xml$/, readLines: findMavenLines }];
}
