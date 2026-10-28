# Tests

Contents: 1. Behavior through inputs and outputs · 2. No check of internal calls · 3. Integration tests from entry to exit as the default · 4. Substitutes only past the exit boundary · 5. Unit tests where combinations demand them · 6. Expected values from the requirement · 7. 1 behavior per test · 8. Given, when, then · 9. A name of outcome and condition · 10. Realistic data and named conditions · 11. A hard test points at the production code · 12. Test files by behavior, in mirrored folders · 13. Coverage finds gaps · 14. Tests that call a real outside system

## 1. Behavior through inputs and outputs

Write each test to give inputs, run the code, and check the outputs against the outcome that the requirement describes. Do not look inside the code under test. A business person must recognize what the test checks as a useful outcome. A test that checks outcomes survives a refactoring and fails only when the behavior changes. Decide the design first, write the code next, and the tests last.

- Book (*What Testing Means*, *Summary*): "So a test provides its inputs, checks the outputs, and ignores whatever happens inside the code."
- Book (*How to Verify Correctness*, *How to Produce Verified Code*): "From what verification means follows the answer: confirming requires something to confirm, so design precedes code and code precedes tests."

## 2. No check of internal calls

Do not assert that a method was called. Where a method returns nothing and only changes something outside, check the effect itself, such as a stored record read back, or cover it with an integration test, or extract the decision so it returns a value. Use only substitutes that return plain values, assert values the code computed, and match the specific argument the test must check. Substitutes that return substitutes, an assertion on a value that a substitute was told to return, and a matcher that accepts any argument each pass with wrong behavior and fails with correct behavior.

- Book (*How to Verify Correctness*, *How Tests Expose Design Problems*): "The test can also check the side effect itself, for example by reading back a stored record or a message the substitute received." · "If neither option fits, leaving that behavior untested is preferable because no test is better than a bad test." · "Each pattern prevents the test from catching bugs, because a test that passes with wrong behavior and fails with correct behavior provides negative value."
- Book (*How to Verify Correctness*, *How Tests Expose Design Problems*): "mocks return mocks" · "loose matchers masking upstream bugs"

## 3. Integration tests from entry to exit as the default

For every application, test first the main paths from the entry boundary to the exit boundary. A main path is a path that real users take. Assert the outcome that the requirement names, such as the order that appears with the correct total. A status, a count or a type alone shows that the path ran, not that its result is right, unless the requirement names only that. Only a test that runs the whole path checks what the user gets.

- Book (*What Testing Means*, *How to Distribute Tests*): "Integration tests are the starting point for every application, regardless of what kind of users it serves." · "Only tests that span the full path verify the outcomes users care about, which makes such tests the natural default."
- Book (*What Testing Means*, *What Correctness Requires from Tests*): "A test that confirms the order appears with the correct total verifies correctness: it checks the outcome that the requirement specifies."

## 4. Substitutes only past the exit boundary

In an integration test, run all the code of the application up to its exit boundary. Substitute only what lies past it, such as the database, a remote service or a queue. Do not substitute a service inside the application, because the test then skips the code it replaces and checks only part of the path.

- Book (*What Testing Means*, *What Testing Means*): "Everything beyond that point can be real or substituted without changing the test type, whether it is the database itself, the network, or the framework that carries the call." · "A substitute placed higher changes the answer: a controller test with its services mocked skips the code those services run, so the path stops above the exit boundary."
- Limits: a real database gives more confidence than a substitute, at a cost: "using a real database increases confidence by verifying database interaction as part of the path" (*What Testing Means*, *How to Distribute Tests*).

## 5. Unit tests where combinations demand them

Write unit tests for logic whose branches multiply the outcomes past what the integration tests take. When you add unit tests for a class, cover all the branches of the logic you add or change there. Do not write unit tests for every class by default. For logic that selects values from a table, test the calculation once and the edge cases of the lookup, not 1 test per row.

- Book (*What Testing Means*, *How to Distribute Tests*): "Unit tests belong where combinatorial logic demands them, not as a default practice applied to every function or class" · "Once a class gets unit tests, the unit suite covers all its branches, not only the ones integration misses." · "Path count drives unit tests, not data count, so a two-hundred-row table generates one calculation test plus a few lookup edge cases."
- Limits: a class whose branches the integration tests already take needs no unit tests. Checks that run one after another, each with 1 condition that rejects or passes, add their outcomes and do not multiply them, so the integration tests that reach each rejection cover them; an edge value of 1 check, such as a limit reached exactly, is a case of an integration test, not a reason for a unit test class. This limit is derived from the rule that unit tests belong "where combinatorial logic demands them".

## 6. Expected values from the requirement

Write the expected value of a test from the requirement, not from what the code returns. A test derived from the code holds its bugs as correct behavior. For a bug fix, write the test that shows the bug; a test that passes with the broken code shows nothing.

- Book (*How to Verify Correctness*, *How to Structure Tests*): "If the code has bugs, AI-generated tests encode those bugs as correct behavior and pass despite the defects."
- Book (*How to Verify Correctness*, *How to Produce Verified Code*): "The developer then temporarily breaks the fix to confirm the test detects the regression, because a test that passes with broken code verifies nothing."

## 7. 1 behavior per test

Let each test check 1 behavior. Use several assertions where 1 behavior gives several results. A failing test with 1 conclusion says what broke.

- Book (*How to Verify Correctness*, *How to Structure Tests*): "The point is one behavior per test, not one assertion per test, and this distinction matters for practical test design."

## 8. Given, when, then

Write each test in 3 blocks, setup, action and check, separated by blank lines. Keep to the shape exactly. Mark the 3 blocks with the comments given, when and then, each the bare word in lower case with nothing after it, as in the book's listings. Using these words rather than arrange, act and assert is a rule of the skill, narrower than the book, which calls it "the same test structure that unit testing knows as Arrange-Act-Assert". The shape is a schema that nearly every developer knows, so the whole test reads as 1 item. The phase marks are the 1 kind of comment a test keeps. Where the test framework offers named step calls, the step calls mark the 3 phases in place of the comments, and the test keeps no phase comment: an and step belongs to the phase it follows, and a background step is a given. This is the book's pattern *Visual Separation*.

- Book (*The Common Pitfalls*, *Visual Separation*): "The rule, then, is to match Given-When-Then exactly, because a test that drifts loses the schema and falls back on the principles to stay simple."
- Book (*How to Verify Correctness*, *How to Structure Tests*): "Comments mark the phases explicitly"
- Book (*The Common Pitfalls*, *How Naming Goes Wrong*): "Comments earn their place only when they carry knowledge that no name or structure can express"

## 9. A name of outcome and condition

Name each test for the expected outcome and the condition that produces it, in business words. Write the name in the form should, outcome, when, condition, in the casing of the language, also where the other tests of the repository use another form. This form, with its use beside another form in the repository, is a rule of the skill, narrower than the book, which asks only that the name state the outcome and the condition, and gives this form as 1 format for them. The name tells the reader which rule the test protects without reading the body.

- Book (*How to Verify Correctness*, *How to Structure Tests*): "A good name states the expected outcome and any conditions that produce it, so reviewers can decide whether this test matches the requirement they are checking." · "The pattern `should<Outcome>When<Condition>` captures them in a consistent format that becomes predictable across the codebase."

## 10. Realistic data and named conditions

In the setup, use values that a domain expert recognizes, not placeholders. A literal in a test can stay where it stands. Where a literal alone sets up the condition that the test name states, give it a name, so the reader sees why the test takes that path; a local variable is enough.

- Book (*How to Verify Correctness*, *How to Structure Tests*): "Realistic means data that a domain expert would recognize: actual product names, real prices, and valid email addresses."
- Book (*The Common Pitfalls*, *Context-Aware Constants*): "Not every literal value needs a constant, because a name helps only when the bare value hides something: either meaning the reader cannot recover, or a shared value that unrelated rules depend on."

## 11. A hard test points at the production code

Read a test that is hard to write as feedback on the design, and fix the production code. A setup that grows with each test means 1 boundary hides unrelated logic. A need to substitute some methods and keep others means coordination and logic are mixed. An urge to test a private method means the logic needs its own class.

- Book (*How to Verify Correctness*, *How Tests Expose Design Problems*): "The fix is not better testing techniques but simpler production code that keeps its details behind its boundaries, which makes both code and tests easier to work with." · "The need to mock some methods while keeping others real indicates the code mixes different abstraction levels and should separate orchestration from logic." · "The urge to test a private method directly signals logic that needs its own class."

## 12. Test files by behavior, in mirrored folders

Start with 1 test file per production class. Split it into 1 file per behavior, named with the class and then the behavior, when a shared setup no longer fits every test. The wish to divide a test file into sections with comments is the same signal; split the file instead. Put each test file in the test folder that mirrors the folder of the code it tests, so a test of a file at the root of the code sits at the root of the tests, and put test support that has no production counterpart, such as substitutes, builders and test data, in a folder named for what it holds. The place of a test then predicts what it tests, and a change to the folders of the code shows in the tests too. Do not log in tests: a test shows its result through its assertions. The signal from comment sections, the mirrored test folders and the rule against logs in tests are rules of the skill, narrower than the book.

- Book (*How to Verify Correctness*, *How to Structure Tests*): "one test class per production class remains a reasonable place to start" · "the signal to split arrives when shared setup no longer applies to every test" · "Each name still starts with the class, which keeps its tests together in the directory"

## 13. Coverage finds gaps

Read low coverage as a sign of missing tests. Do not write tests to raise a coverage number, because such tests touch code without checking outcomes.

- Book (*What Testing Means*, *How to Distribute Tests*): "Coverage serves as a hygiene metric rather than a quality metric, because it can reveal where tests are absent but cannot reveal whether existing tests verify anything meaningful."

## 14. Tests that call a real outside system

Keep a test that calls a real outside system, such as a remote service of another team or the sandbox of a payment provider, out of the regular build: mark it with a tag or a condition that the regular build leaves out. End the name of its test class or test file with 1 fixed suffix that the project chooses once, such as Live. Such a test fails when the outside system is slow or down, with no change in the code, so in the regular build it would make a failure mean something other than a change of behavior. The suffix tells the reader, before the body, that the test needs the outside system. These are rules of the skill, narrower than the book.

- Book (*What Testing Means*, *How to Distribute Tests*): "When the test exercises the full path as the real caller would, substituting a third-party API at the boundary does not reduce correctness confidence."
- Limits: a database or a queue that the build starts on its own is not an outside system, and a test that uses it stays in the regular build (section 4).
