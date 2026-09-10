import { isACodeLineCarryingAMark } from "../../../../../inputs/source/lines/LineKinds.mjs";
import { collectInlineTests } from "./InlineTests.mjs";

const NO_MARKS = Object.freeze([]);

export class TestCodeMarks {
  constructor({
    setupMarkers = NO_MARKS,
    teardownMarkers = NO_MARKS,
    testOpeners = NO_MARKS,
    partialSubstitutes = NO_MARKS,
    substitutesReturningSubstitutes = NO_MARKS,
    privateMethodsReached = NO_MARKS,
    interactionAssertions = NO_MARKS,
    visibleForTesting = null,
    inlineTestForm = null,
  } = {}) {
    this.setupMarkers = setupMarkers;
    this.teardownMarkers = teardownMarkers;
    this.testOpeners = testOpeners;
    this.partialSubstitutes = partialSubstitutes;
    this.substitutesReturningSubstitutes = substitutesReturningSubstitutes;
    this.privateMethodsReached = privateMethodsReached;
    this.interactionAssertions = interactionAssertions;
    this.visibleForTesting = visibleForTesting;
    this.inlineTestForm = inlineTestForm;
    Object.freeze(this);
  }

  collectVisibleForTestingLines(lines) {
    return this.visibleForTesting ? lines.flatMap((text, index) => (isACodeLineCarryingAMark(text, [this.visibleForTesting]) ? [index + 1] : [])) : [];
  }

  get hookMarks() {
    return [...this.setupMarkers, ...this.teardownMarkers];
  }

  get readsInlineTests() {
    return Boolean(this.inlineTestForm);
  }

  findInlineTests(lines) {
    return this.inlineTestForm ? collectInlineTests(this.inlineTestForm, lines) : null;
  }
}

export const NO_TEST_CODE_MARKS = new TestCodeMarks();
