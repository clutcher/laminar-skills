# Tests

Contents: 1. Behavior through inputs and outputs · 2. No check of internal calls · 3. Integration tests from entry to exit as the default · 4. Substitutes only past the exit boundary · 5. Unit tests where combinations demand them · 6. Expected values from the requirement · 7. 1 behavior per test · 8. Given, when, then · 9. A name of outcome and condition · 10. Realistic data and named conditions · 11. A hard test points at the production code · 12. Test files by behavior · 13. Coverage finds gaps

## 1. Behavior through inputs and outputs

Write each test to give inputs, run the code, and check the outputs against the outcome that the requirement describes. Do not look inside the code under test. A business person must recognize what the test checks as a useful outcome. A test that checks outcomes survives a refactoring and fails only when the behavior changes. Decide the design first, write the code next, and the tests last.

- Book (*What Testing Means*, *Summary*): "So a test provides its inputs, checks the outputs, and ignores whatever happens inside the code."
- Book (*How to Verify Correctness*, *How to Produce Verified Code*): "From what verification means follows the answer: confirming requires something to confirm, so design precedes code and code precedes tests."

## 2. No check of internal calls

Do not assert that a method was called. Where a method returns nothing and only changes something outside, check the effect itself, such as a stored record read back, or cover it with an integration test, or extract the decision so it returns a value. Do not build substitutes that return substitutes, do not assert a value that a substitute was told to return, and do not accept any argument where the test must check a specific one. Each of these passes with wrong behavior and fails with correct behavior.

- Book (*How to Verify Correctness*, *How Tests Expose Design Problems*): "The test can also check the side effect itself, for example by reading back a stored record or a message the substitute received." · "If neither option fits, leaving that behavior untested is preferable because no test is better than a bad test." · "Each pattern prevents the test from catching bugs, because a test that passes with wrong behavior and fails with correct behavior provides negative value."

## 3. Integration tests from entry to exit as the default

For every application, test first the main paths from the entry boundary to the exit boundary. A main path is a path that real users take. Assert the outcome that the requirement names, such as the order that appears with the correct total. A status, a count or a type alone shows that the path ran, not that its result is right, unless the requirement names only that. Only a test that runs the whole path checks what the user gets.

- Book (*What Testing Means*, *How to Distribute Tests*): "Integration tests are the starting point for every application, regardless of what kind of users it serves." · "Only tests that span the full path verify the outcomes users care about, which makes such tests the natural default."
- Book (*What Testing Means*, *What Correctness Requires from Tests*): "A test that confirms the order appears with the correct total verifies correctness: it checks the outcome that the requirement specifies."

## 4. Substitutes only past the exit boundary

In an integration test, run all the code of the application up to its exit boundary. Substitute only what lies past it, such as the database, a remote service or a queue. Do not substitute a service inside the application, because the test then skips the code it replaces and checks only part of the path.

- Book (*What Testing Means*, *What Testing Means*): "Everything beyond that point can be real or substituted without changing the test type, whether it is the database itself, the network, or the framework that carries the call." · "A substitute placed higher changes the answer: a controller test with its services mocked skips the code those services run, so the path stops above the exit boundary."
- Limits: a real database gives more confidence than a substitute, at a cost.

## 5. Unit tests where combinations demand them

Write unit tests for logic whose branches multiply the outcomes past what the integration tests take. Once a class has unit tests, cover all its branches there. Do not write unit tests for every class by default. For logic that selects values from a table, test the calculation once and the edge cases of the lookup, not 1 test per row.

- Book (*What Testing Means*, *How to Distribute Tests*): "Unit tests belong where combinatorial logic demands them, not as a default practice applied to every function or class" · "Once a class gets unit tests, the unit suite covers all its branches, not only the ones integration misses." · "Path count drives unit tests, not data count, so a two-hundred-row table generates one calculation test plus a few lookup edge cases."
- Limits: a class whose branches the integration tests already take needs no unit tests.

## 6. Expected values from the requirement

Write the expected value of a test from the requirement, not from what the code returns. A test derived from the code holds its bugs as correct behavior. For a bug fix, write the test that shows the bug; a test that passes with the broken code shows nothing.

- Book (*How to Verify Correctness*, *How to Structure Tests*): "If the code has bugs, AI-generated tests encode those bugs as correct behavior and pass despite the defects."
- Book (*How to Verify Correctness*, *How to Produce Verified Code*): "The developer then temporarily breaks the fix to confirm the test detects the regression, because a test that passes with broken code verifies nothing."

## 7. 1 behavior per test

Let each test check 1 behavior. Use several assertions where 1 behavior gives several results. A failing test with 1 conclusion says what broke.

- Book (*How to Verify Correctness*, *How to Structure Tests*): "The point is one behavior per test, not one assertion per test, and this distinction matters for practical test design."

## 8. Given, when, then

Write each test in 3 blocks, setup, action and check, separated by blank lines and marked as given, when and then. Keep to the shape exactly. Each mark is the bare word in lower case and nothing after it; the names arrange, act and assert, or blank lines alone, do not make this shape. This form is a rule of the skill, narrower than the book, which names Arrange-Act-Assert the same structure. The shape is a schema that nearly every developer knows, so the whole test reads as 1 item. The phase marks are the 1 kind of comment a test keeps. This is the book's pattern *Visual Separation*.

- Book (*The Common Pitfalls*, *Visual Separation*): "The rule, then, is to match Given-When-Then exactly, because a test that drifts loses the schema and falls back on the principles to stay simple."

## 9. A name of outcome and condition

Name each test for the expected outcome and the condition that produces it, in business words, in the form should, outcome, when, condition, in the casing of the language. A name with no should and outcome breaks this rule even where the other tests of the repository use another form; this is a rule of the skill, narrower than the book. The name tells the reader which rule the test protects without reading the body.

- Book (*How to Verify Correctness*, *How to Structure Tests*): "A good name states the expected outcome and any conditions that produce it, so reviewers can decide whether this test matches the requirement they are checking."

## 10. Realistic data and named conditions

In the setup, use values that a domain expert recognizes, not placeholders. A literal in a test can stay where it stands. Where a literal alone sets up the condition that the test name states, give it a name, so the reader sees why the test takes that path; a local variable is enough.

- Book (*How to Verify Correctness*, *How to Structure Tests*): "Realistic means data that a domain expert would recognize: actual product names, real prices, and valid email addresses."
- Book (*The Common Pitfalls*, *Context-Aware Constants*): "Not every literal value needs a constant, because a name helps only when the bare value hides something: either meaning the reader cannot recover, or a shared value that unrelated rules depend on."

## 11. A hard test points at the production code

Read a test that is hard to write as feedback on the design, and fix the production code. A setup that grows with each test means 1 boundary hides unrelated logic. A need to substitute some methods and keep others means coordination and logic are mixed. An urge to test a private method means the logic needs its own class.

- Book (*How to Verify Correctness*, *How Tests Expose Design Problems*): "The fix is not better testing techniques but simpler production code that keeps its details behind its boundaries, which makes both code and tests easier to work with." · "The need to mock some methods while keeping others real indicates the code mixes different abstraction levels and should separate orchestration from logic." · "The urge to test a private method directly signals logic that needs its own class."

## 12. Test files by behavior

Start with 1 test file per production class. Split it into 1 file per behavior, named with the class and then the behavior, when a shared setup no longer fits every test. The wish to divide a test file into sections with comments is the same signal; split the file instead. Do not log in tests: a test shows its result through its assertions. These 2 are rules of the skill, narrower than the book.

- Book (*How to Verify Correctness*, *How to Structure Tests*): "the signal to split arrives when shared setup no longer applies to every test"

## 13. Coverage finds gaps

Read low coverage as a sign of missing tests. Do not write tests to raise a coverage number, because such tests touch code without checking outcomes.

- Book (*What Testing Means*, *How to Distribute Tests*): "Coverage serves as a hygiene metric rather than a quality metric, because it can reveal where tests are absent but cannot reveal whether existing tests verify anything meaningful."
