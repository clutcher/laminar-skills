import { Scale } from "../code/index.mjs";

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
