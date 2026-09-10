import { GenericApplicationFinder } from "../generic/GenericApplicationFinder.mjs";

const findXmlAttributeLines = lines => lines.map(line => (/<(?:PackageReference|package)\s+(?:Include|id)="([^"]+)"/.exec(line) || [])[1]).filter(Boolean);

export class DotnetApplicationFinder extends GenericApplicationFinder {
  buildSystem = "dotnet";
  buildFileNames = [];
  buildFileSuffixes = [".csproj", ".fsproj", ".sln"];
  dependencyFormats = [{ name: /\.(?:cs|fs|vb)proj$|^packages\.config$/, readLines: findXmlAttributeLines }];
}
