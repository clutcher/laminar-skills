import { Scale } from "../../../code/index.mjs";
import { stripLeadingDotSlash } from "../abstractions/AbstractionsAtPlaces.mjs";

const APPLICATION_MARK = ":";

const isNamedFor = (displayName, name) => displayName === name || String(displayName).endsWith(`${APPLICATION_MARK}${name}`);

const holdsTheGroup = (codeForm, group) => group.scale === Scale.CLASS.name
  && stripLeadingDotSlash(group.file) === codeForm.file
  && codeForm.line <= Number(group.line) && Number(group.line) <= (codeForm.to || codeForm.line)
  && isNamedFor(group.displayName, codeForm.name);

export class CodeFormMarker {
  constructor(codeForms) {
    this.codeForms = codeForms || [];
  }

  findTheCodeFormOf(group) {
    return this.codeForms.find(codeForm => holdsTheGroup(codeForm, group)) || null;
  }

  markGroup(group) {
    const codeForm = this.findTheCodeFormOf(group);
    if (!codeForm) return group;
    return { ...group, possibleFindings: group.possibleFindings.map(possibleFinding => ({ ...possibleFinding, declaredBySchema: codeForm.declaredBySchema })) };
  }

  markGroups(groups) {
    return groups.map(group => this.markGroup(group));
  }
}
