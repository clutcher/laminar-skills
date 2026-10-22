import { Scale } from "../code/index.mjs";
import { TRACKS } from "./CheckCatalog.mjs";
import { JUDGE_TYPE_BY_TRACK_MAP } from "./JudgeType.mjs";

export const TRACK_WORDS = Object.freeze(["Simplicity", "Design", "Correctness · Prevention", "Correctness · Detection", "Performance"]);

export const SCALE_ORDER = Object.freeze([Scale.APPLICATION.name, Scale.MODULE.name, Scale.CLASS.name, Scale.METHOD.name, Scale.VARIABLE.name]);

export const CHECK_WORDS = Object.freeze([
  { id: "S1", lead: "Incomplete Mental Model", track: "Simplicity", check: "Incomplete Mental Model", text: "when the same decision lives in many places, the mental model at each location feels finished and the reasoning feels sound" },
  { id: "S2", lead: "Prediction Failure", track: "Simplicity", check: "Prediction Failure", text: "the name creates expectations that reality contradicts" },
  { id: "S4", lead: "Compression Failure", track: "Simplicity", check: "Compression Failure", text: "No stored schema matches the code, and neither repeated shapes nor a shared purpose emerges for the reader to group, so each operation fills its own working-memory slot." },
  { id: "S5", lead: "Unnamed Part Failure", track: "Simplicity", check: "Unnamed Part Failure", text: "The name predicts the parts, but the details belong to a part it never names, so compression drops to the slow path instead of the fast one." },
  { id: "S6", lead: "Open Construct Overload", track: "Simplicity", check: "Open Construct Overload", text: "every open construct holds a slot only until it closes, so the cost is bounded by the nesting itself" },
  { id: "D1", lead: "Working Memory Overload (Over-Extraction)", track: "Design", check: "Over-Extraction", text: "Each extreme produces a different kind of turbulence: one overloads working memory with visible detail, the other leaves the purpose under too much depth to hold in mind." },
  { id: "D2", lead: "Prediction Failure / Incomplete Mental Model (Scoped Parameters)", track: "Design", check: "Scoped Parameters", text: "Primitives that are too narrow overload working memory and spread decisions across call sites, while objects that are too broad hide method dependencies and create false ones during modification." },
  { id: "D3", lead: "Prediction Failure / Unnamed Part Failure (Leaked Details)", track: "Design", check: "Leaked Details", text: "are details that leaked into the wrong abstraction, and they belong elsewhere: above as a coordinator, or below as a detail" },
  { id: "D4", lead: "Unnamed Part Failure / Working Memory Overload (Missing Boundary)", track: "Design", check: "Missing Boundary", text: "Each failure needs its own fix, because a missing boundary needs a new abstraction named after a part, while a bad name needs only renaming." },
  { id: "CP1", lead: "Exclude Illegal States", track: "Correctness · Prevention", check: "Exclude Illegal States", text: "Types can catch more than that, because they can also prevent an invalid mix of fields." },
  { id: "CP3", lead: "Protect the State", track: "Correctness · Prevention", check: "Protect the State", text: "Prevention comes from an abstraction that protects its state and controls every transition into it." },
  { id: "CP4", lead: "Remove Edge Cases", track: "Correctness · Prevention", check: "Remove Edge Cases", text: "When an operation treats these as normal results rather than errors, its callers never have to check for them or handle a failure." },
  { id: "CP5", lead: "Remove Hidden Dependencies", track: "Correctness · Prevention", check: "Remove Hidden Dependencies", text: "When a function reads state that another part of the system can change, it depends on that part, but its signature cannot show that link." },
  { id: "CP6", lead: "Validate at the Boundary", track: "Correctness · Prevention", check: "Validate at the Boundary", text: "That check belongs at the entry boundary, which lets every abstraction inside trust the data that passes." },
  { id: "CP7", lead: "Fail Fast", track: "Correctness · Prevention", check: "Fail Fast", text: "a guard that rejects truly invalid input should signal that failure instead of returning in silence" },
  { id: "CD2", lead: "Test Behavior", track: "Correctness · Detection", check: "Test Behavior", text: "Tests verify correctness by verifying the behaviors that requirements describe." },
  { id: "CD4", lead: "Integration Test Needed", track: "Correctness · Detection", check: "Integration Test Needed", text: "Only tests that span the full path verify the outcomes users care about, which makes such tests the natural default." },
  { id: "CD5", lead: "Unit Test Needed", track: "Correctness · Detection", check: "Unit Test Needed", text: "Unit tests complement both by covering branches that integration tests do not exercise, not as a coverage device applied to every class." },
  { id: "CD6", lead: "Unit Test to Remove", track: "Correctness · Detection", check: "Unit Test to Remove", text: "Pricing and dispatch each get a unit-test class with three tests, but the validator gets none, because integration already covers its branches." },
  { id: "CD7", lead: "Partial Path Test", track: "Correctness · Detection", check: "Partial Path Test", text: "A test that runs only part of the path checks only part of the code, whether people call it a unit or an integration test." },
  { id: "P1", lead: "Looped I/O", track: "Performance", check: "Looped I/O", text: "a loop issues one I/O operation per item when a single batch operation would process all items at once" },
  { id: "P2", lead: "Repeated Retrieval", track: "Performance", check: "Repeated Retrieval", text: "code fetches the same data across an I/O boundary more than once inside a single operation when one fetch would be enough" },
  { id: "P3", lead: "Excess Retrieval", track: "Performance", check: "Excess Retrieval", text: "the code retrieves more data than the operation needs across an I/O boundary" },
  { id: "P4", lead: "Resource Recreation", track: "Performance", check: "Resource Recreation", text: "the code creates an expensive resource for each operation instead of creating it once and reusing it across operations" },
]);

export const PRINCIPLES = Object.freeze({ ENCAPSULATION: "encapsulation", SINGLE_LEVEL_OF_ABSTRACTION: "single level of abstraction", NONE: "" });

const NO_PRACTICE = "";

const OWNS_THE_IO = "all four fixes work only when an abstraction owns the I/O";

const createDirection = (principle, practice, text, ...passages) => Object.freeze({ principle, practice, text, passages: Object.freeze(passages) });

export const DIRECTION_BY_CHECK_MAP = Object.freeze({
  S1: createDirection(PRINCIPLES.ENCAPSULATION, "Have a Single Owner", "move the repeated decision into one method every place calls, or drop it where not needed", "The fix is encapsulation: one abstraction owns the decision, and every caller reaches it through that boundary."),
  S2: createDirection(PRINCIPLES.ENCAPSULATION, NO_PRACTICE, "rename it to match what it does, or change the code to match the name", "Prediction failure responds to encapsulation through naming: when the name accurately predicts what is inside, the reader trusts the boundary instead of revising a model already built.", "A naming problem needs a more precise name, while an abstraction problem needs the behavior redistributed across different abstractions."),
  S4: createDirection(PRINCIPLES.SINGLE_LEVEL_OF_ABSTRACTION, "Visual Separation", "split the test into exactly given, when and then, or into several tests", "The rule, then, is to match Given-When-Then exactly, because a test that drifts loses the schema and falls back on the principles to stay simple."),
  S5: createDirection(PRINCIPLES.SINGLE_LEVEL_OF_ABSTRACTION, NO_PRACTICE, "move the low-level steps into a named method, or move this call up to the caller", "An unnamed part failure disappears through the same consistency, because only parts remain inside the abstraction and the name predicts every one of them.", "they belong elsewhere: above as a coordinator, or below as a detail"),
  S6: createDirection(PRINCIPLES.SINGLE_LEVEL_OF_ABSTRACTION, "Guard Clauses", "return early, or move the nested block into a named method", "So the fix is to flatten the nesting, because what costs is the number of open constructs."),
  D1: createDirection(PRINCIPLES.SINGLE_LEVEL_OF_ABSTRACTION, NO_PRACTICE, "inline the small methods into their caller, or regroup them into methods that mean something", "So the goal is consistency within each method, not the maximum number of abstractions that extraction could add."),
  D2: createDirection(PRINCIPLES.ENCAPSULATION, "Scoped Parameters", "group parameters that travel together into one type, or pass only what the method needs", "parameters should match what the method name describes, not sit above or below it"),
  D3: createDirection(PRINCIPLES.SINGLE_LEVEL_OF_ABSTRACTION, "Single-Level Methods", "move this step up to the calling method, or down into a lower-level method", "are details that leaked into the wrong abstraction, and they belong elsewhere: above as a coordinator, or below as a detail"),
  D4: createDirection(PRINCIPLES.ENCAPSULATION, NO_PRACTICE, "move these private methods and fields into their own class, or up to the caller", "a missing boundary needs a new abstraction named after a part", "they belong elsewhere: above as a coordinator, or below as a detail"),
  CP1: createDirection(PRINCIPLES.ENCAPSULATION, "Exclude Illegal States", "change the types so an invalid value cannot be built, or reject it in the constructor", "You define the types so the compiler rejects the invalid mix before the code runs."),
  CP3: createDirection(PRINCIPLES.ENCAPSULATION, "Protect the State", "let one class make every change to the field, or make the field immutable", "Prevention comes from an abstraction that protects its state and controls every transition into it."),
  CP4: createDirection(PRINCIPLES.ENCAPSULATION, "Remove Edge Cases", "return a normal result for the special case, such as an empty list, or reject it early", "In each case the practitioner defined the operation so that the edge case became normal behavior."),
  CP5: createDirection(PRINCIPLES.ENCAPSULATION, NO_PRACTICE, "take the shared value as a parameter and return the result, or give it one owning class", "A pure function reads only its inputs and changes nothing outside itself, so it never touches state that other code shares."),
  CP6: createDirection(PRINCIPLES.ENCAPSULATION, "Guard Clauses", "validate once where data enters the application, or use a type that cannot hold bad values", "check once at the edge, then trust what flows past it"),
  CP7: createDirection(PRINCIPLES.ENCAPSULATION, "Fail Fast", "stop and signal the failure to the one handler, or check the input once where it enters", "This means the code stops at the first sign of a bad state, rather than running past it."),
  CD2: createDirection(PRINCIPLES.NONE, NO_PRACTICE, "assert on outputs and stored state, not on mocks or internal calls", "So a test provides its inputs, checks the outputs, and ignores whatever happens inside the code."),
  CD4: createDirection(PRINCIPLES.NONE, NO_PRACTICE, "add a test that runs from the entry point to the outside system, or extend one", "These tests exercise the main paths from entry boundary to exit boundary, verifying that the full processing chain produces correct results."),
  CD5: createDirection(PRINCIPLES.NONE, NO_PRACTICE, "add a unit test for branches integration tests miss, or extend those tests", "Unit tests complement both by covering branches that integration tests do not exercise, not as a coverage device applied to every class."),
  CD6: createDirection(PRINCIPLES.NONE, NO_PRACTICE, "remove the unit test, or keep it only for branches integration tests miss", "Unit tests belong where combinatorial logic demands them, not as a default practice applied to every function or class"),
  CD7: createDirection(PRINCIPLES.NONE, NO_PRACTICE, "extend the test to run from the entry point to the outside system, or add one", "Only tests that span the full path verify the outcomes users care about, which makes such tests the natural default."),
  P1: createDirection(PRINCIPLES.ENCAPSULATION, "Avoid Waste", "replace the call in the loop with one batch call, or load all data before the loop", "Batch operations instead of issuing them in loops", OWNS_THE_IO),
  P2: createDirection(PRINCIPLES.ENCAPSULATION, "Avoid Waste", "load the data once and pass it to each step, or cache it", "Fetch shared data once per operation: load it at the start and pass the result to every step that needs it, instead of refetching independently from each step.", OWNS_THE_IO),
  P3: createDirection(PRINCIPLES.ENCAPSULATION, "Avoid Waste", "select only the fields or rows the operation uses", "Request only the data the operation needs", OWNS_THE_IO),
  P4: createDirection(PRINCIPLES.ENCAPSULATION, "Avoid Waste", "create the client or connection once and reuse it, or take it from a pool", "Pool expensive resources instead of creating them per operation", OWNS_THE_IO),
});

export const DIRECTION_BY_JUDGE_TYPE_MAP = Object.freeze({
  [JUDGE_TYPE_BY_TRACK_MAP[TRACKS.COMMENT]]: Object.freeze({
    S2: createDirection(PRINCIPLES.ENCAPSULATION, "Self-Documenting Code", "drop the comment, or move its meaning into a method or variable name", "Comments earn their place only when they carry knowledge that no name or structure can express"),
    S5: createDirection(PRINCIPLES.SINGLE_LEVEL_OF_ABSTRACTION, "Self-Documenting Code", "drop the comment, or move the block into a method named for it", "The fix is to extract each commented block into a named method, so the name communicates the intent that the comment carried."),
  }),
  [JUDGE_TYPE_BY_TRACK_MAP[TRACKS.TEST_METHOD]]: Object.freeze({
    S2: createDirection(PRINCIPLES.ENCAPSULATION, NO_PRACTICE, "rename the test to say the expected outcome and the condition", "A good name states the expected outcome and any conditions that produce it, so reviewers can decide whether this test matches the requirement they are checking."),
  }),
});

const NO_DIRECTION = Object.freeze({ principle: PRINCIPLES.NONE, practice: NO_PRACTICE, text: "", passages: Object.freeze([]) });

const buildLookupKey = text => String(text || "").trim().toUpperCase();

const CHECK_WORDS_BY_ID_MAP = new Map(CHECK_WORDS.map(checkWords => [buildLookupKey(checkWords.id), checkWords]));

const CHECK_WORDS_BY_NAME_MAP = new Map(CHECK_WORDS.flatMap(checkWords => [checkWords.check, checkWords.lead].map(name => [buildLookupKey(name), checkWords])));

export const findCheckWords = check => CHECK_WORDS_BY_ID_MAP.get(buildLookupKey(check)) || CHECK_WORDS_BY_NAME_MAP.get(buildLookupKey(check)) || null;

export const readLead = check => { const checkWords = findCheckWords(check); return checkWords ? checkWords.lead : String(check || ""); };

export const readCheckName = check => { const checkWords = findCheckWords(check); return checkWords ? checkWords.check : String(check || ""); };

export const readTrack = check => { const checkWords = findCheckWords(check); return checkWords ? checkWords.track : ""; };

export const readCheckRank = check => { const checkWords = findCheckWords(check); return checkWords ? CHECK_WORDS.indexOf(checkWords) : CHECK_WORDS.length; };

export const readTrackRank = track => { const at = TRACK_WORDS.indexOf(track); return at < 0 ? TRACK_WORDS.length : at; };

export const readScaleRank = scale => { const at = SCALE_ORDER.indexOf(String(scale || "").toUpperCase()); return at < 0 ? SCALE_ORDER.length : at; };

export const findDirection = (check, judgeType = "") => {
  const checkWords = findCheckWords(check);
  if (!checkWords) return NO_DIRECTION;
  const overrides = DIRECTION_BY_JUDGE_TYPE_MAP[judgeType] || {};
  return overrides[checkWords.id] || DIRECTION_BY_CHECK_MAP[checkWords.id] || NO_DIRECTION;
};
