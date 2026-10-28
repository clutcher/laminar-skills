# Evaluation cases

The cases of the review skill stand under `review/`, 1 folder each. A case is a diff to review and the reader's file the review is expected to produce. The cases of the coding style skill stand under `code-style/`, where its own README says how they run. `grade.mjs` builds and grades the cases of both, because both end in a review's reader file. The cases of the convention check stand under `check-conventions/`, where its own README says how they run: `grade.mjs` builds them, and they are graded by hand.

The `claude plugin eval` runner cannot run this skill, because a review is 5 session steps, 2 of them Workflow calls, and the Workflow tool is not one the runner can grant.
So a case is built, reviewed and graded from a session instead, and a case holds none of the runner's own files, a `prompt.md`, a `case.yaml`, a `fixture.sh` or a `graders/` folder, because they grade nothing.

---

## What a case folder holds

| File | What it is |
|---|---|
| `change.diff` | the input, the change the review is given |
| `expected.md` | the expectation, in the shape of the run's own `review.md`: the findings the run must raise, the items it must print under `## To consider`, and the findings it must not |
| `base.diff` | only where a finding needs code outside the change: a diff against an empty tree that creates the files the expectation quotes |
| `budget.json` | the cost the case is allowed: wall seconds, total tokens, new tokens cold and warm, output tokens, the least cache-read share, the most agents and the most dollars at list price |
| `judges.txt` | 1 line: the judge types the review runs for this case, comma separated with no spaces, in the form `runReview.mjs prepare --judges` takes |

Nothing else.
The folder is named for what it tests, never for the classes inside it, and one case tests one thing.

### Why a case runs only the judges it grades

`judges.txt` lists every judge type that can raise a check that an expected item or a must-not line of the case names, and no other.
Where more than 1 judge type can raise that check on that abstraction, such as the method judge and the comment judge on a method, the file lists each of them.
A must-not line forbids the finding only on the holder it names, never on the members of that holder.
The test plan judge is listed wherever the case expects or forbids Integration Test Needed, Unit Test Needed, Unit Test to Remove or Partial Path Test.

The reason is cost.
With every judge type, the whole suite measured about 50 dollars and 1,980 agents on Sonnet judges, and most of it was spent on judge types that no line of the case grades.
With each case limited to its own judge types, the estimate from the same runs is about 16 dollars and 516 agents, about a third of the cost.

The price is paid by the `Any other finding` line.
A judge type that does not run raises no finding, so the line checks only the findings of the judge types in `judges.txt`, and an over-report by any other judge type is not caught.
The grader prints the judge types the line was graded over.

A case with no `judges.txt` runs every judge.
The `budget.json` ceilings were set from 1 run that used each case's `judges.txt`, with Sonnet screens and judges and an Opus verifier.
The cases ran 3 at a time, so every run was warm.
Each token ceiling, the agent ceiling and the dollar ceiling is the measured value times 1.5, rounded up; token ceilings round up to 2 significant figures, and dollars round up to the cent.
The wall ceiling is the measured wall times 1.5, plus 30 seconds for the script steps, because the measured wall counts only the time from the first agent to the last.
The cache-read floor is the measured share times 0.8, rounded down to 2 decimals.
The cold run was not measured, so `new_tokens_cold` is never below the warm ceiling.

---

## The two tiers

**Tier A is the change diff alone, reviewed in patch mode.**
It is graded on what a diff can carry, so it cannot reach a finding whose second place sits outside the change.
A tier A case has no `base.diff`.

**Tier B is the two diffs applied as a repository, reviewed in repository mode.**
It reaches a finding whose second place is outside the change.

---

## The cases

| Case | Tier | What it tests | Budget |
|---|---|---|---|
| `mispredicting-names-inside-a-change` | B | in a fictional campsite-quote domain, in Java, 3 new names predict something the code does not hold, in a class that was already long, and 1 new test name does too | measured on the earlier fixture, not measured on this one |
| `second-owner-outside-the-change` | B | the same change as `mispredicting-names-inside-a-change`: a new method decides a fact that a helper outside the change already decides from the same input by the same test, beside a method of another type that answers a different question | measured on the earlier fixture, not measured on this one |
| `branches-integration-already-covers` | B | 4 new steps hold explicit branches, and the integration tests, which send each request through the web framework to the booking endpoint, take every outcome of the first 2 and the same outcome of each of the other 2 | measured |
| `test-behavior-without-an-outcome` | B | 3 of 4 new tests pass whatever the code does, beside 1 sound test that checks the seat the passenger gets | measured |
| `new-package-that-does-not-belong` | B | a new `newsletter` package lands inside the `order` package of a shop's order service, beside a payment retry service added to the existing `payment` package, a script added to the existing scripts folder and a whole new inventory service at the repository root, which all belong; the finding sits on `order`, whose contents stop being parts of its name | measured |
| `interface-crosses-module-boundary-whole` | B | clean: 3 application modules, 2 of which move their boundary, where `pricing` exposes its price calculator and the ride duration at its root and `station` exposes an interface and hides the class behind it, and a new `ride` module calls the calculator; a module root that exposes a class is no finding | measured |
| `looped-io-through-layers` | B | a new loop in Java whose per-item call reaches a repository query 4 calls down through 2 services and an interface, beside a loop over an in-memory query builder and a loop over an in-repository cache, which are no I/O | measured |
| `looped-io-in-python` | B | the same shape in Python: a new loop whose per-item call reaches a sqlite query 4 calls down, beside a query-string builder loop and a dict cache loop | measured |
| `looped-io-in-go` | B | the same shape in Go: a new range loop whose per-item call reaches a database update 3 calls down through an interface met by its method set, beside a query-builder loop and a map cache loop | measured |
| `io-added-under-a-loop-above` | B | a change adds a remote catalogue call to a small label helper that an unchanged loop 4 calls above already reaches, beside a second helper that adds a local date format and is no I/O | measured |
| `looped-framework-query` | B | a new loop in Python whose per-item call reaches an `execute` on a SQLAlchemy session 2 calls down, which only the declared dependency and the type mark as I/O, beside a loop that builds SQLAlchemy statements and runs none | measured |
| `looped-outside-cache-library` | B | a new loop in Java whose per-item call reads a Caffeine cache 2 calls down, which is no I/O although the cache type comes from a declared outside library, beside a loop that sends 1 HTTP request per reading 2 calls down | measured |
| `boolean-names-one-value-of-a-category` | A | an existing `Vessel`, written fresh in the harbour-ferry domain, gains 1 boolean field that names 1 approval of several a vessel can hold, with no other boolean or list for approvals, beside a boolean for a real state it already held | measured |
| `loyalty-steps-inside-a-consignment-split` | A | the book's `splitIntoConsignments` adds loyalty points and updates the purchase history between its consignment steps, 2 details of customer rewards the name does not describe | measured |
| `stock-loop-inline-among-order-steps` | A | the book's `placeOrder` holds the stock loop inline among the steps of placing an order, a detail of reserving the stock that no name holds; Looped I/O on the read inside the loop is not graded | measured |
| `detail-words-in-a-step-name` | A | the book's `placeOrder` calls a private step named `loopItemsCheckStockAndReserve`, a name in detail words beside 3 steps named as parts; the book says the name still predicts its behaviour, so it is no Prediction Failure | measured |
| `recursive-extraction-names-every-part` | A | clean: the book's `placeOrder` after the stock check was extracted at every step, where every operation of the 3 methods is a part of its name and the private steps are not judged against the class name; Looped I/O on the read in `reserveStock` is not graded | measured |
| `session-read-inside-a-discount` | A | the book's `calculateDiscount` reads the business unit from the session by a string key, a detail among the parts of the discount, while its name still predicts the body | measured |
| `session-key-read-in-every-class` | B | a new discount calculator reads the current business unit from the session by the raw key, beside 2 classes in the base that read it through a private constant and a global constant, the book's 3 local ways that own nothing | measured |
| `local-name-drops-a-qualifier` | A | the book's `calculateDiscount` keeps the answer of `getCurrentB2BUnit` in a variable named `unit`, which drops the word current; the condition that joins 2 questions is not graded | measured |
| `caller-guard-before-the-premium-check` | A | clean: the book's final `calculateDiscount`, with `currentUnit` and an early return of 0 where no unit is current | measured |
| `query-name-that-also-saves` | A | the book's `recalculatePrice` returns the price and also saves the entry, beside the 3 methods of the book's fix, whose command predicts the change it makes; a Protect the State finding at low confidence on `updateCartEntryPrice` is allowed and not required | measured |
| `discount-query-that-changes-the-order` | A | the book's `calculateDiscount` returns the discount and also subtracts it from the order the caller passed in; a Protect the State finding on the same write is not graded | measured |
| `order-total-that-reads-the-database` | A | the book's `placeOrder` computes the subtotal, the discount and the total inline among the steps of placing the order, so it draws Unnamed Part Failure; its reads through named repository calls and its `0.1` on a line that names the discount are no Prediction Failure, and the order it returns unsaved may draw one; Looped I/O on the read inside the loop is not graded | measured |
| `what-comments-over-unnamed-checks` | A | the book's `isProductVisibleToCustomer` carries a comment over each of its 3 checks that says what the block checks instead of a name | measured |
| `constants-named-by-their-value` | A | the book's constants `THIRTY`, `HUNDRED` and `TEN_PERCENT`, each read by 1 rule and named by its value | measured |
| `constants-named-for-their-rule` | A | clean: the book's renamed constants, each named for its rule and its kind and read by 1 rule | measured |
| `field-prefixes-name-missing-parts` | A | the book's flat `Order` holds customer, shipping and billing fields that share a prefix and no name | measured |
| `broad-service-name-takes-in-neighbours` | A | the book's `ProductService` holds review and pricing methods beside the product operations its name covers | measured |
| `specific-service-name-with-strangers` | A | the book's `ProductRecommendationService` holds 3 methods that match neither its name nor each other, beside the 1 that recommends | measured |
| `review-service-joins-products-to-reviews` | A | the book's 4 classes after the split of the product service, where `ReviewService` still joins products to reviews and the 3 other classes each hold what their name describes; Looped I/O on the reads of the reviews is not graded | measured |
| `three-booleans-that-allow-forbidden-mixes` | A | the book's `User` with 3 boolean fields for 1 category: each boolean names 1 kind of user, an Unnamed Part Failure on the class, and no Exclude Illegal States, because no line shows which combinations the domain forbids | copied from `category-held-as-two-enums`, not measured |
| `boolean-argument-picks-the-operation` | A | the book's `closeAccount` takes a boolean that picks between deleting and deactivating, called once with `true` and once with `false` | measured |
| `seven-primitives-in-one-signature` | A | the book's `createShipment` takes 7 primitive values, and a test calls it with the book's values | measured |
| `parameter-wider-than-its-use` | A | the book's `calculateShipping` takes the whole cart and reads only its delivery address | measured |
| `payment-fields-of-every-state` | A | the book's `Payment` holds a transaction id and an error message beside its state, so a failed payment can be read for a transaction id | measured |
| `fluent-builder-that-returns-itself` | A | clean: the book's fluent builder of a PDF document, whose every call changes the builder and returns it while each name predicts what it does, and whose `build` rejects a document with no page size, margins or title; a step named by the bare field it sets is no Prediction Failure, and 1 Prediction Failure on the margin literals and 1 on the static factory `builder` are allowed and not required | measured |
| `copy-method-and-builder-steps-named-by-their-field` | A | clean: in a fictional orchard domain, in Java, a value type with a copy method named with and the field it changes, and a builder written by hand whose steps are named by the bare field they set, so neither gives a Prediction Failure | copied from `fluent-builder-that-returns-itself`, not measured |
| `routing-on-provider-in-two-methods` | B | the book's routing on payment provider in 2 methods: a new `refundPayment` routes in a second conditional beside the base's `chargePayment`, which routes on the same provider over the same cases | measured |
| `processor-per-provider-behind-an-interface` | A | clean: the book's processor interface with 1 processor per provider, where the routing lives in `findProcessor` and each `supports` method tests its own case | measured |
| `identical-bodies-of-unrelated-rules` | A | clean: the book's `LoyaltyDiscount` and `BulkDiscount`, whose bodies are the same line and whose rules are unrelated | measured |
| `merged-discount-with-unused-selector` | B | the book's merge of `LoyaltyDiscount` and `BulkDiscount`: a change merges the base's 2 classes into 1 `Discount` that takes a discount type it does not read | measured |
| `guard-run-left-among-order-steps` | A | the book's `processOrder` with 4 guard clauses left among the business steps with no name of their own; the silent return of each guard is not graded | measured |
| `silent-return-on-an-invalid-order` | A | the book's `processOrder` returns in silence where its named check `isValidOrder` says no, beside a method that is simple | measured |
| `flat-root-of-mixed-kinds` | A | the book's flat company website, 14 files of 3 kinds and 2 business areas at 1 root with no folder that names a part | measured |
| `internal-folder-of-mixed-kinds` | A | the book's company website with `exposed` and `internal` folders per module, where `order/internal` holds 6 peers of 3 kinds and the `exposed` folders hold only what they offer; the case grades only `order/internal` | measured |
| `technical-first-folders` | A | clean: the technical-first layout of the book's company website, folders named for the kind of code they hold | measured |
| `hexagonal-layout-five-folders-deep` | A | clean: the book's hexagonal order module 5 folders deep, whose folder names are a schema learned once and whose outbound call to another module leaves through the folder made for it | measured |
| `full-order-fetched-for-each-status` | B | the book's `orderStatuses` asks a facade for the full order of each id in a loop and reads only its status, beside the facade in the base that reads the order, its items, its payments and its history | measured |
| `mock-chain-test-of-a-notification` | A | the book's test of the first `NotificationService`, with substitutes that return substitutes, an assertion on a value a substitute returns, a check of a call and a matcher that takes any value; the finding on the production code is not graded | measured |
| `mock-free-test-of-an-extracted-permission` | A | clean: the book's second `NotificationService` with its permission check in a service of its own, and a test of that service with a real user and no substitute; a test plan item for the 3 failing outcomes of `canSend` is allowed, and an Unnamed Part Failure on its second guard is allowed as an item to consider and forbidden as a finding | measured |
| `one-behavior-three-assertions` | A | clean: the book's cart test with 3 assertions on the totals of 1 behavior | measured |
| `test-names-that-describe-implementation` | A | the book's 3 test names that describe the implementation, beside its 3 names that state a business outcome and its condition; 2 of those 3 are also clean on every check of the test judge: the book's Given-When-Then test of a premium discount, whose phase comments keep the schema, and the book's test that substitutes 1 stock service so that the rejection can happen and asserts the result the caller gets; 1 low Prediction Failure on the confirmation test is allowed, for its bare stock number in the setup | measured |
| `delivery-price-from-three-named-steps` | A | clean: the book's `calculateDeliveryPrice`, whose 3 steps, the weight, the distance and the shipping cost, are all parts of the delivery price | measured |
| `confirmation-built-from-private-helpers` | A | clean: the book's `sendOrderConfirmation` after its dependencies moved to private helpers, whose `get` prefix is an action name on a method that takes the order; a Prediction Failure on `getFormattedAddress` or `getRecipientName`, each of which takes the whole order and reads only 1 part of it, is allowed and not required | measured |
| `confirmation-through-a-message-factory` | A | clean: the book's `sendOrderConfirmation` that asks a message factory for the confirmation and sends it | measured |
| `postprocessor-execute-over-two-named-steps` | A | clean: the book's `PlaceOrderPostprocessor`, whose general verb `execute` calls the consignment split and the customer rewards, 2 named steps; an accepted miss: the method judge files Unnamed Part Failure on `updateCustomerRewards`, so the case may fail on its must-not line, and that failure is the accepted miss and never a regression; a finding on the dropped consignments is not graded | measured |
| `order-total-from-a-pure-calculation` | A | clean: the book's `placeOrder` that reads the customer and the products and hands them to `calculateOrder`, a pure function; a finding on the width of the cart parameter, on a customer that is not found or on the test plan is not graded | measured |
| `visibility-read-as-three-named-checks` | A | clean: the book's `isProductVisibleToCustomer` after each of its 3 commented checks became a named private check; a Prediction Failure on `isInAllowedCategory` is allowed at low confidence or as an item to consider and not required, because its name names only a category while it takes the whole customer and reads the business unit, a parameter above what the name names | measured |
| `when-phase-missing-from-a-given-then-test` | A | a test written in the Given-When-Then block shape, with a phase comment over each block, has a given block and a then block, and the call it tests sits inside the assertion, so the when block is missing | copied from `one-behavior-three-assertions`, not measured |
| `short-test-of-three-named-lines` | A | clean: a test of 3 lines, 1 stub, 1 call and 1 check, with no blank line and no phase comment, each line named at the abstraction level of the test name | copied from `one-behavior-three-assertions`, not measured |
| `long-test-with-inline-request-details` | A | a test of 9 lines with no blank line and no phase comment builds the credentials, the headers and the body of a request by hand among the parts its name describes, which is an Unnamed Part Failure and no Compression Failure | copied from `one-behavior-three-assertions`, not measured |
| `end-to-end-test-of-named-steps` | A | clean: an end-to-end test of 3 calls to steps named for their phase, with blank lines and no phase comment, whose step names show the phases | copied from `one-behavior-three-assertions`, not measured |
| `order-fields-grouped-into-named-parts` | A | clean: the book's `Order` with a nested `Customer` and 2 `Address` fields in place of its prefixed fields; a Prediction Failure on the bare `total` is allowed and not required | measured |
| `review-service-by-one-or-many-products` | A | clean: the book's final `ReviewService`, whose 2 methods differ only as singular differs from plural | measured |
| `category-held-as-two-enums` | A | clean: the book's `User` whose 2 categories are 2 enum fields in place of 3 booleans | measured |
| `delete-and-deactivate-as-two-methods` | A | clean: the book's `deleteAccount` and `deactivateAccount` in place of 1 method with a boolean, each called by its name | measured |
| `shipment-from-three-named-objects` | A | clean: the book's `createShipment` that takes an address, a parcel and a carrier in place of 7 primitive values | measured |
| `shipping-cost-from-the-delivery-address` | A | clean: the book's `calculateShipping` with its parameter narrowed from the cart to the delivery address | measured |
| `payment-state-as-a-sealed-type` | A | clean: the book's sealed `Payment` with 1 record per state, each holding only its own fields | measured |
| `business-unit-session-read-in-one-owner` | A | clean: the book's `B2BUnitService`, the 1 owner of the session key and of every read and write of the current business unit; a finding on the missing unit that `setCurrentB2BUnit` ignores is not graded | measured |
| `named-validity-check-wrapping-the-steps` | A | the book's `processOrder` that wraps its steps in the named check `isValidOrder`, simple as the book says, and silent on an invalid order as the early-return form is | measured |
| `order-module-split-into-app-in-out` | A | the book's order module with an `app`, an `in` and an `out` folder: `in` and `out` each hold 1 kind of code, while `app` holds the service beside the order and the product, a model with no name of its own; a finding on a class is not graded | measured |
| `helper-class-of-three-subjects` | A | a class named `Helper` that validates, formats and saves orders, written fresh from the book's sentence on such a class | measured |
| `test-that-restates-a-tax-rate-row` | A | a test that asserts the 19 percent rate of Germany from a tax rate table, written fresh from the book's sentence on such a test | measured |
| `literal-hides-what-it-controls` | A | a new `expireStaleBooking` in the harbour-ferry domain compares the days since a booking with a bare 30, and nothing on the line states what 30 controls | measured |
| `literal-in-a-line-that-states-it` | A | clean: the same method, where the value compared with 30 is named for the days passed since the booking was created, so the line states what the literal means | measured |
| `constant-over-a-literal-the-line-states` | A | a TypeScript module constant `STARTING_TOTAL` over 0 starts a sum of ticket fares, where the line would state what the value means with the literal in its place | measured |
| `predicate-name-drops-a-condition` | A | a new boolean helper in a shop domain whose name claims a cart line reaches its minimum order quantity, while its 1 expression also requires the requested quantity below it and holds 3 checks that each quantity is present | measured |
| `status-held-as-a-string` | A | a new `Crossing` in the harbour-ferry domain holds its status as a string that 2 of its methods compare with a fixed set of values, so a caller can build a crossing with a status outside that set; Protect the State on the constructor is neither expected nor forbidden | measured |
| `new-case-reached-through-a-fallback` | B | a change adds a fourth case to a crossing status, and the base's `noticeFor`, which names 2 cases and ends in a fallback, now gives the new case the notice of a departed crossing, beside a new `colourFor` that names every case | measured |
| `category-text-only-stored` | A | a new `Book` in a fictional bookshop domain, in Python, holds its genre as free text that every reference only stores or shows, so no line states a fixed set of values and Exclude Illegal States is not raised | copied from `status-held-as-a-string`, not measured |
| `flag-set-read-in-three-conditionals` | B | a `Climber` in a fictional climbing-gym domain, in Kotlin, gains a third boolean that names 1 skill level, beside 2 that the base already reads in 2 conditionals of other classes, and a new conditional reads 2 of them again: an Unnamed Part Failure on the class and an Incomplete Mental Model on the new conditional, with the 2 old conditionals as its other places | copied from `category-held-as-two-enums`, not measured |
| `lifecycle-flags-with-a-guard` | B | a `SeedOrder` in a fictional seed-shop domain, in Kotlin, holds its lifecycle in 3 booleans, paid, shipped and cancelled, and a new method of the class refuses to ship an order that is not paid, so a line of the class shows a mix the domain forbids while its constructor still lets a caller build it: an Unnamed Part Failure and an Exclude Illegal States on the class, and an Incomplete Mental Model on the new method, whose conditional reads a flag that 2 conditionals of the base read too | copied from `flag-set-read-in-three-conditionals`, not measured |
| `partner-store-ids-in-sets-of-their-own-decisions` | B | clean: in a fictional grocery-delivery domain, 2 new rules each test the id of a partner store, an entity that is registered as data, against a set of their own named for the decision, the same id stands in both sets, and a third class asks 1 of the rules about the id, so every other id takes the normal path and Exclude Illegal States is not raised | copied from `null-returned-when-no-carrier-matches`, not measured |
| `delivery-state-text-compared-in-two-classes` | A | in the same grocery-delivery domain, a new `Delivery` holds its state as text that 2 of its methods compare with constants, beside a constant that lists every state, and a new `TipPrompt` compares a handover kind held as text with 1 named code, so Exclude Illegal States is raised on the class; a finding on `TipPrompt` under the same check is allowed and not required | copied from `status-held-as-a-string`, not measured |
| `guarded-list-handed-out-whole` | A | a new `Voyage` refuses a passenger once it is full, and hands out the list it holds, so any caller can add a passenger past the capacity | measured |
| `session-value-cast-with-no-check` | A | a new `CurrentVoyageService`, the 1 owner of a session key, casts the value it reads from a store of untyped values to a voyage with no check of its type; the case requires Remove Edge Cases and allows Fail Fast beside it | measured |
| `null-returned-when-no-carrier-matches` | B | clean: a new `findCarrier` in a fictional parcel-depot domain returns null where no carrier has the code, and a new `routeParcel` sends that parcel to the manual desk, so neither Fail Fast nor Remove Edge Cases is raised | measured |
| `empty-list-returned-when-no-calendar-is-published` | B | clean: a new TypeScript `fetchOpenSlots` returns an empty list where a depot has published no calendar for the day, and nothing in the repository says such a day is a broken state, so neither Fail Fast nor Remove Edge Cases is raised | measured |
| `charge-failure-dropped-behind-a-paid-receipt` | B | a new `chargeOrder` in a fictional bakery domain logs a declined charge and still returns a paid receipt, which its caller dispatches, so Fail Fast is raised | measured |
| `zero-price-summed-into-an-invoice` | B | a new `findUnitPrice` turns a failed price lookup into a zero price that the invoice multiplies and sums as if it were real, so Fail Fast is raised | measured |
| `missing-price-left-blank-in-a-price-list` | B | clean: a new price list logs a failed price lookup and leaves that price cell blank, so the rows state nothing false and Fail Fast is not raised | measured |
| `export-written-without-a-failed-price-source` | B | clean: a new standing order export logs a failed price source and still writes the file with blank price cells, so Fail Fast is not raised | measured |
| `product-page-without-a-failed-delivery-estimate` | B | clean: a new product page logs a failed delivery estimate and shows the page with the named empty estimate, so Fail Fast is not raised | measured |
| `four-checks-wrapping-the-order-steps` | A | the book's `processOrder` with 4 preconditions that each wrap the next in another `if` block, so all 4 stay open at the business steps; the invalid order the method drops in silence is not graded | measured |
| `four-nested-checks-around-an-action` | A | the book's 4 nested `if` statements around 1 action, with a method around them because the book prints none | measured |
| `confirmation-built-inline-from-order-fields` | A | the book's first `sendOrderConfirmation`, which reads 8 fields of the order inline, details of 3 parts it never names | measured |
| `customer-created-inline-before-its-use` | A | the book's customer creation that reads, checks and maps 3 request parameters inline before the customer is used, with a method around it because the book prints none | measured |
| `three-open-constructs-around-a-boarding-pass` | A | a new `issueBoardingPasses` in the harbour-ferry domain holds 3 open constructs at its deepest line, around a long chain of steps and 2 lists of arguments over several lines, which hold nothing open, so it draws no Open Construct Overload; it holds unnamed parts, the selection of the paid bookings, the selection of the checked-in passengers in the order of the seats and the creation of a boarding pass, so it draws Unnamed Part Failure | measured |
| `chained-steps-hold-unnamed-parts` | A | a new `BoxOfficeService` in a theatre domain, in Java, whose 5 methods each return 1 chained call whose steps take a function: in 4 the function of a step builds a ticket from calls into other objects, joins 3 conditions, holds a second chain or branches, an Unnamed Part Failure each, and in the fifth a step under a query name marks a reminder in the store, a Prediction Failure | copied from `stock-loop-inline-among-order-steps`, not measured |
| `chained-steps-named-as-parts` | A | clean: where every step is a call to a named step, a reference to a method or a read of 1 value, the query changes no state, and a chain of 5 named steps is long and holds no unnamed part | copied from `stock-loop-inline-among-order-steps`, not measured |
| `array-chain-steps-hold-unnamed-parts` | A | the same 5 shapes in TypeScript, on arrays, in a `VaccinationDesk` of a veterinary clinic domain: 4 Unnamed Part Failures and 1 Prediction Failure on a query whose step marks a no show in the store | copied from `stock-loop-inline-among-order-steps`, not measured |
| `array-chain-steps-named-as-parts` | A | clean: the twin of the case above, with every step named and a chain of 4 named steps | copied from `stock-loop-inline-among-order-steps`, not measured |
| `query-chain-steps-hold-unnamed-parts` | A | 3 of the shapes in C#, in a `PlotAllocationService` of an allotment garden domain: a step that builds an invoice from a call into the tariff, a step that joins 3 conditions and a step that holds a second chain, an Unnamed Part Failure each | copied from `stock-loop-inline-among-order-steps`, not measured |
| `query-chain-steps-named-as-parts` | A | clean: the twin of the case above, with every step named | copied from `stock-loop-inline-among-order-steps`, not measured |
| `injected-handler-map-named-as-a-plural` | A | a new service in the harbour-ferry domain gets a map of payment handlers keyed by the bean name the framework injects by and named only as the plural of the handlers, beside a field named for its own type and a list named as the plural of its element type, which are not judged | measured |
| `explicit-false-decided-again-outside-the-change` | B | a change adds a method to a `Vessel` in Java that bars the vessel from sailing only where its spot check result is an explicit false, and an unchanged status badge of a TypeScript console decides the same on the same field, beside a certificate link that asks whether the spot check passed; no build file is in the tree, so the scripts see 1 application and the copy is a finding | measured |
| `explicit-false-decided-again-in-another-application` | B | the same change as `explicit-false-decided-again-outside-the-change`, with a build file for the Java service and 1 for the TypeScript console, so every place of the copy is in another application; a copy in another application is a question to the author whatever the applications are, so it prints under To consider | not measured |
| `lending-rule-and-renewal-code-restated-in-a-new-module` | B | in a fictional library domain, in Java, a new reminders module restates over 3 lines, through accessor calls, the rule a loan record states in 1 method, which picks the requested or the granted days by the renewal flag, and its new mapper decodes the catalogue's renewal code by comparing it with a letter, which the mapper of the loans module already decodes by a not-blank test; a statistics method that reads the same 2 day counts for another question is not the second place | set from `explicit-false-decided-again-outside-the-change`, not measured |
| `new-module-asks-the-loan-terms` | B | clean: the twin of the case above, where the planner asks the loan record for its lending days and the mapper passes the decoded renewal flag through | set from `explicit-false-decided-again-outside-the-change`, not measured |
| `returned-case-added-at-one-service` | B | clean: 2 services in the harbour-ferry domain each declare the same enum of notice cases in their own GraphQL subgraph schema, as federation requires, and a change adds 1 case to the enum of 1 service and returns it there, while the enum sits only in output positions; at most 1 Incomplete Mental Model at low confidence is allowed on the enum or on the method that returns the new case, and an item to consider on either is not graded | measured |
| `copies-across-two-deployable-applications` | B | 2 applications of a shipping company in 1 repository, each with its own build file, get the same new module that copies a table of carrier codes with a fallback, which is 1 item to consider on the converter and at most 1 finding at low confidence, because a copy in another application is always reported, while 1 application reads back a status code the other returns and decides the same hold again, which is 1 item to consider, because only the author knows whether the copy is kept on purpose | measured |
| `handling-resolved-from-a-context-or-a-request` | A | a new `ParcelHandling` in a parcel-shipment domain whose private `from` reports a missing result that every caller replaces with a default equal to what its normal path builds, and whose public `from` of the shipment context is a lookup that may find nothing under a conversion name, beside an insurance policy whose absence is a valid case | measured |
| `rule-cut-into-fragments-across-two-files` | B | a change in a library-loan domain cuts 1 rule for the loan period into pieces over 2 files, whose names predict nothing about the rule: 2 `resolve` roots, a lookup of the session under the conversion name `from` and 2 `from` conversions of the request that may give nothing, beside a one-line forwarding method that restores a single level of abstraction in its caller; Over-Extraction on `resolve` is allowed and not required, and Remove Edge Cases is not graded | measured |
| `general-verb-over-a-precedence-rule` | A | a new `RentalLength` in a kayak-rental domain, in Python, whose `determine_hours` only combines steps into a precedence rule, the requested hours, else the member's usual hours, each capped at the season limit, else the shop default, under a general verb that names none of it and is not resolve, handle or process, which is a Prediction Failure, beside `cap_hours_at_season_limit`, whose name states its rule and must not get one | copied from `parameter-wider-than-its-use`, not measured |
| `input-type-widened-for-one-operation` | B | clean: a change in a hotel-room domain, in TypeScript, adds 2 values to each of 2 request input types so that they become identical, 1 page sends 1 object as both, and 3 of the 4 operations that take the wider type read only some of its members, while the fourth reads the 2 values it gained | measured |
| `core-port-takes-its-own-results-back` | B | a change in an insurance-quote domain, in a Java hexagonal module, makes the inbound adapter load 1 quote per basket line and adds a core port with 2 operations that take a list of the core's own quote results back, a sum and a merge before an existing notice rule runs; the finding lands on the port and not on its implementation, and the case grades Leaked Details alone | measured |
| `core-port-takes-its-own-results-back-in-python` | B | the same shape in Python, in a freight-booking domain laid out as `domain`, `ports` and `adapters`, where the new port's names name no mechanism and only the script fact of the own output taken back opens the judge; the finding lands on the port and not on its implementation, and the case grades Leaked Details alone | measured |
| `core-joins-data-from-two-outbound-ports` | B | clean: a new core port in a library-loan domain, in a Java hexagonal module, named for an aggregation, that combines the loans and the reservations of a reader, which the core fetches itself through 2 outbound ports; the case grades Leaked Details alone | measured |
| `layered-service-takes-its-own-results-back` | B | clean: the same rebuild of per-item results in the service layer of a layered `controller`, `service` and `repository` layout in a guided-tour domain, which has no core at the level of its layers; the case grades Leaked Details alone | measured |
| `decision-and-free-text-code-across-an-entry-boundary` | B | a change in a bike-rental domain adds 3 fields to 1 GraphQL type of a Java service and uses them in a TypeScript frontend of the same repository: the frontend checks again the region the service already checks before it fills 1 field, compares a second field, free text, with a named code, and only shows the third; the copy of the region check prints under To consider, and the frontend that decides the region rule again on the accessories it receives is Leaked Details; the case grades only its own lines, because the prevention judge may find other things in the new methods | measured |
| `decision-across-an-entry-boundary-on-imported-constants` | B | a change in a mountain-hut domain adds 2 fields to 1 GraphQL type of a Java service and uses them in a TypeScript frontend of the same repository, where the service and the frontend each check the same region against a constant from a constants file of their own application, and the frontend only shows the second field; the copy prints under To consider, and the frontend that decides the region rule again on the gear it receives is Leaked Details | measured |
| `partner-store-id-tested-in-a-frontend-across-an-entry-boundary` | B | clean: in the same grocery-delivery domain, a change adds the id of a partner store as a text field of 1 GraphQL type of a Java service, and a TypeScript frontend of the same repository compares it with 1 named id and tests it against a set of named ids, each named for what the page shows, so every other id takes the normal path and Exclude Illegal States is not raised on the field or in the frontend; the case grades only Exclude Illegal States | copied from `decision-and-free-text-code-across-an-entry-boundary`, not measured |
| `availability-schema-with-misnamed-additions` | B | a change in a fictional coffee-roastery domain touches only the GraphQL schema of 1 application: it adds a list `roastingSchedules` whose name predicts roasting times while its entries hold an amount and an expected landing date, the same expected arrival of coffee as the incoming shipments beside it, a `supplyLevel` that classifies the supply and so belongs to availability, and a type with `qty` and `unit`, so every finding comes from the schema lines alone; a finding on `supplyLevel` is allowed and not required; the Unnamed Part Failure on `Availability` rests on its `cancellationTerm`, which the change did not touch, so it is an item to consider | measured on the earlier fixture, not measured on this one |
| `language-checked-inside-the-order-search` | B | an exhibit search use case of a fictional museum, whose only caller is a GraphQL controller, checks the requested language against the offered set as its first line, although its summary projection never reads the language; Fail Fast on the validator is graded only in `language-checked-inside-the-export-creation`, which holds the same validator | measured on the earlier fixture, not measured on this one |
| `language-checked-inside-the-export-creation` | B | a record export use case of a fictional dental practice, behind a REST controller with a validated request body, checks the requested language against the offered set after its archive check, inside the use case and not at the entry | measured on the earlier fixture, not measured on this one |
| `availability-input-widened-with-pricing-values` | B | a change in an e-commerce domain adds the quantity and the agreement, values of pricing, to the GraphQL input of 3 availability fields, only to build the same lookup key as the price input, and no availability result depends on them; the input `PriceInput` with the same members is no finding; the finding is required on the Java record `AvailabilityInput`, whose resolver argument binds it to the schema input, and the item names the schema input `storefront-api:AvailabilityInput` under Declared by the schema; a Prediction Failure or an Unnamed Part Failure on either is allowed | measured |
| `named-interface-opens-the-domain-model` | B | a Spring Modulith nursery in Java whose 2 modules have the book's hexagonal layout; the change opens the domain model of `planting` with a second named interface so that `delivery` can read the domain record itself, which is 1 Prediction Failure on the folder of the exposed record | set from `new-package-that-does-not-belong`, not measured |
| `named-interface-opens-only-public-types` | B | clean: where `planting` adds a public record to the folder its named interface already opens and `delivery` reads only that | set from `new-package-that-does-not-belong`, not measured |
| `barrel-re-exports-the-domain-model` | B | a bike rental in TypeScript whose barrel re-exports a new domain class of the app of `rental`, which `invoicing` reads, 1 Prediction Failure on the folder of the exposed class | set from `new-package-that-does-not-belong`, not measured |
| `barrel-exports-only-port-and-public-types` | B | clean: where the barrel exports a new public type and the offered port names no domain type | set from `new-package-that-does-not-belong`, not measured |
| `driven-port-implemented-inside-the-app` | B | a dog kennel in PHP in the book's hexagonal layout gains a needed port whose only implementation sits in `App/Domain`, a Prediction Failure on the folder of the port | set from `new-package-that-does-not-belong`, not measured |
| `driven-port-implemented-in-an-out-adapter` | B | clean: the twin of the case above, with the implementation in `Out/Db` | set from `new-package-that-does-not-belong`, not measured |
| `domain-imports-an-out-adapter` | B | a greenhouse watering service in Python whose domain service imports a new soil probe client from `out/sensors`, a Prediction Failure on the domain folder | set from `new-package-that-does-not-belong`, not measured |
| `domain-reads-through-a-needed-port` | B | clean: where the domain takes a new needed port and `out/sensors` implements it | set from `new-package-that-does-not-belong`, not measured |
| `formats-beside-their-chooser` | A | a new label formats folder holds 1 label format per carrier beside their interface and the class that chooses one, so the formats are a part the folder never names, 1 Unnamed Part Failure on the folder | set from `new-package-that-does-not-belong`, not measured |
| `consignment-folder-holds-types-and-service` | A | a new consignment folder in Java holds the consignment, its line and its status, each in a file of its own, beside the consignment service; the line and the status serve only the consignment, so each is a detail of it and not a part of the folder, 1 Unnamed Part Failure on the folder | set from `formats-beside-their-chooser`, not measured |
| `consignment-folder-holds-nested-types-and-service` | A | clean: where the line and the status are nested in the consignment, so the folder holds only the consignment and its service, 2 parts | set from `formats-beside-their-chooser`, not measured |
| `flat-handover-folder-mixes-steps-and-variants` | A | a new handover folder holds the handover step beside its ways of handing over, a card left for a neighbour, an identity card check, a card payment, a neighbour handover, a signature and a safe place, as peers with no folder for the variants, 1 Unnamed Part Failure on the folder | set from `new-package-that-does-not-belong`, not measured |
| `flat-folder-of-fifteen-mixed-depot-parts` | A | a new depot folder holds files of intake, storage, staff and outbound work as peers, whose names read as details of parts the folder never names, 1 Unnamed Part Failure on the folder | set from `new-package-that-does-not-belong`, not measured |
| `flat-folder-of-one-tracking-provider-each` | A | clean: a new folder holds 1 tracking provider per carrier beside their interface, a repeated shape whose entries all read as parts of the folder | set from `new-package-that-does-not-belong`, not measured |
| `flat-folder-holds-a-row-of-its-documents` | A | a new print folder holds 3 printed documents and the step that prints them beside a file named for 1 row of the driver manifest, which only the manifest uses, so it is a detail of it, 1 Unnamed Part Failure on the folder | set from `new-package-that-does-not-belong`, not measured |
| `flat-folder-of-documents-only` | A | clean: the same print folder without the row file, so every entry reads by its name as a part of what the folder path describes | set from `new-package-that-does-not-belong`, not measured |
| `file-of-functions-named-for-the-scan-it-acts-on` | A | a file of functions named for a parcel scan exports functions that read, format and check scans, 1 Prediction Failure on the file at the class scale | set from `helper-class-of-three-subjects`, not measured |
| `file-of-functions-named-for-the-formatting-it-does` | A | clean: a file of functions named for the scan line formatting it does exports only the functions that format scan lines | set from `helper-class-of-three-subjects`, not measured |
| `file-of-functions-named-for-the-readings-it-converts` | A | a JavaScript file of functions named `TideReadings`, a name of data, exports 1 function that converts tide readings to a saved text form and 1 that parses them back, 1 Prediction Failure on the file at the class scale | set from `helper-class-of-three-subjects`, not measured |
| `file-of-functions-named-for-the-conversion-it-does` | A | clean: the twin of the case above, the same functions in a file named `TideReadingConverter` for the work they do | set from `helper-class-of-three-subjects`, not measured |
| `file-named-for-another-thing-than-its-class` | A | a new JavaScript file named `Ticket` holds only a class `Timetable` whose methods find departures, 1 Prediction Failure on the file at the class scale and no finding on `Timetable`, whose own name fits its methods | set from `helper-class-of-three-subjects`, not measured |
| `file-named-for-its-class-in-snake-case` | A | clean: a new Python file `pre_order_service.py` holds the class `PreOrderService`, whose methods place and cancel a pre-order, so the file and the class are 1 abstraction, judged once as the class, and no finding is raised on the file | set from `helper-class-of-three-subjects`, not measured |
| `shell-functions-file-named-for-its-subject` | A | clean: a bash library file `tides.sh` of shell functions that fetch, format and check tides, a SQL file `berths.sql` of queries on berths, a YAML file of pilot settings and a bash script that uses the library; a file of a language that declares no classes and no types never predicts a class by its name, so no Prediction Failure is raised on any of the 4 files | set from `file-of-functions-named-for-the-formatting-it-does` for 4 files, not measured |
| `data-named-type-books-carriers` | A | a class named `Shipment`, a name of data, whose public methods book a carrier, reserve a pickup and cancel a carrier booking, in Java, 1 Prediction Failure on the class name at the class scale and 1 Unnamed Part Failure on the pickup, a part apart from carrier booking | set from `helper-class-of-three-subjects`, not measured |
| `work-named-type-books-carriers` | A | clean: the twin of the case above, a class named `CarrierBookingService` for the work it does, which only books a carrier and cancels a carrier booking | set from `helper-class-of-three-subjects`, not measured |
| `partner-answer-copied-into-a-domain-type` | A | a greenhouse irrigation module in Java with a domain, an spi and an out folder holds in its domain model the record `ForecastReply`, whose 8 fields copy 1 for 1 the answer of an outside weather partner, which the out adapter reads straight into it; 1 Unnamed Part Failure on `ForecastReply` | set from `data-named-type-books-carriers`, not measured |
| `partner-answer-copied-into-an-out-adapter-type` | A | clean: the twin of the case above, where `ForecastReply` stands in the out folder beside the adapter, which maps it into the domain record `DayOutlook`; no Prediction Failure and no Unnamed Part Failure on `ForecastReply` | set from `data-named-type-books-carriers`, not measured |
| `record-converts-its-own-reading` | A | clean: a TypeScript class named `TideReading`, a name of data, holds the station, the time and the height of 1 reading, and its operations parse a reading from a text line, write it back as a line, format it for display and compare its height, so the name predicts the data the class holds and the work on that data, and no Prediction Failure is raised on the class | set from `helper-class-of-three-subjects`, not measured |
| `shipping-utilities-folder-holds-a-service-and-order-entries` | A | a new `order/util/shipping` folder in Java holds a utility of shipping labels, which belongs, beside a shipping service, which is no utility, and a utility of order entries, which is not shipping, 1 Unnamed Part Failure on the folder, each name read against its full path from the source root | set from `new-package-that-does-not-belong`, not measured |
| `route-planning-split-into-input-planning-and-route` | A | clean: where the route planning folder holds only its index file, an input folder, a planning folder and the route, each with its own entries | set from `formats-beside-their-chooser`, not measured |
| `adapter-decides-a-business-rule` | B | a bakery pre-order controller in TypeScript decides a deposit rule of the business before it calls the offered port, Leaked Details on the adapter operation | set from `core-joins-data-from-two-outbound-ports`, not measured |
| `adapter-only-checks-and-maps-the-input` | B | clean: where the controller only checks that the pickup slot is well formed and maps the request | set from `core-joins-data-from-two-outbound-ports`, not measured |
| `stored-record-beside-the-domain-record` | B | a berth booking service in Java adds a domain record and a JPA entity in `storage` that holds the same fields beside an id, with a converter between them; an Incomplete Mental Model to consider on the entity, because only the author knows whether the 2 types stand for 1 thing | set from `second-owner-outside-the-change`, not measured |
| `domain-record-carries-its-storage-markers` | B | clean: the twin of the case above in TypeScript, where 1 domain class carries its TypeORM decorators and no separate stored type exists | set from `second-owner-outside-the-change`, not measured |
| `two-domain-records-of-one-harvest` | B | a beekeeping module in Java adds 2 domain records of 1 harvest with the same 4 fields and no boundary between them; an Incomplete Mental Model to consider on `HarvestEntry` | set from `stored-record-beside-the-domain-record`, not measured |
| `exposed-record-mapped-from-the-domain-record` | B | clean: a beekeeping module in Java exposes a public record with the same 4 fields as its domain record, maps to and from it in its inbound adapter, and a second module reads only the public record; no Incomplete Mental Model on either record | set from `stored-record-beside-the-domain-record`, not measured |
| `exposed-type-mapped-from-the-domain-class-in-typescript` | B | clean: the same shape in TypeScript, where a library loans module exposes a public class through its barrel with the same 4 fields as its domain class and a fines module reads only the public class | set from `stored-record-beside-the-domain-record`, not measured |
| `bin-summary-mapped-to-and-from-the-bin` | B | clean: a warehouse inventory package in Python holds a domain class `Bin` and a dataclass `BinSummary` with the same 4 fields, builds each from the other in 2 functions, and a shipping package imports only `BinSummary`; no word or folder says that `BinSummary` is exposed, and no Incomplete Mental Model on either class | set from `two-domain-records-of-one-harvest`, not measured |
| `bin-record-beside-the-bin` | B | the twin of the case above, where the inventory package holds `Bin` and a dataclass `BinRecord` with the same 4 fields, both read only inside the package and never mapped into each other; an Incomplete Mental Model to consider on `Bin` | set from `two-domain-records-of-one-harvest`, not measured |
| `request-type-in-the-in-folder-beside-the-domain-type` | B | clean: a pet boarding module in TypeScript holds a domain class `Stay` and, in its `in/rest` folder, a request class `StayRequest` with the same 4 members that the controller maps into `Stay`, and no other module names either; no Incomplete Mental Model on either class | set from `two-domain-records-of-one-harvest`, not measured |
| `comment-above-a-wrapped-method-head` | A | a new `BerthFinder` in the harbour-ferry domain whose method head runs over 3 lines, with a comment of 2 lines directly above it that restates what the method does, an Unnamed Part Failure judged with the method and not with the class | set from `what-comments-over-unnamed-checks`, not measured |
| `comment-added-above-an-unchanged-method` | B | a change that adds only 1 comment above an unchanged method and no code, which is still judged, with the method directly below it | set from `what-comments-over-unnamed-checks`, not measured |
| `missing-entries-filled-by-a-nested-builder-function` | B | a new `FeeQuoteService` in the harbour-ferry domain, in Java, whose step over the vessels takes a function that fills a missing entry of a map with a second function, which builds the line through a builder chain, an Unnamed Part Failure, and 2 functions deep, no Open Construct Overload; the method's long name lists that line in detail words, which makes none of the operations a part and so never clears the finding; the private step that rebuilds the quote from its own lines is also Leaked Details; its `quote` hands the tariff book's call straight in as the argument of that step, an Unnamed Part Failure | set from `chained-steps-hold-unnamed-parts`, not measured |
| `missing-entries-filled-by-a-named-factory` | B | the twin of the case above, where the function of the step is 1 call to a named factory of the line, so no Unnamed Part Failure, while the private step that rebuilds the quote from its own lines is Leaked Details; its `quote` hands the tariff book's call straight in as the argument of that step, an Unnamed Part Failure | set from `chained-steps-named-as-parts`, not measured |
| `schedule-rebuilt-with-overflow-slots-in-the-service` | B | a marina berth service in Kotlin whose private step copies the schedule it takes with overflow slots added from the schedule and the request alone, Leaked Details on that step | set from `adapter-decides-a-business-rule`, not measured |
| `schedule-gains-pilot-slots-from-a-roster-it-takes` | B | clean: where the step gets the slots it adds from a pilot roster it takes, so the service coordinates | set from `adapter-decides-a-business-rule`, not measured |
| `overflow-slots-added-by-a-schedule-builder` | B | clean: where a builder of the schedule adds the overflow slots | set from `adapter-decides-a-business-rule`, not measured |
| `functions-nested-in-call-arguments` | A | a new `HoldExpiryService` in the harbour-ferry domain whose only open constructs are functions passed as arguments of calls: a call 4 functions deep, an Open Construct Overload, beside a call 2 functions deep, which is none | set from `chained-steps-hold-unnamed-parts`, not measured |
| `defended-comment-that-narrates-the-code` | A | a new `PortDuesCalculator` in the harbour-ferry domain with a comment of 4 lines that carries the regulation behind its rule and then narrates what the code does, a finding on the form of a defended comment | set from `what-comments-over-unnamed-checks`, not measured |
| `defended-comment-in-one-short-line` | A | clean: where the comment carries the same regulation in 1 short line | set from `what-comments-over-unnamed-checks`, not measured |
| `comment-beside-a-misnamed-method` | A | a method whose name starts with a relating word, under a comment that says only how the harbour office behaves, which is 2 findings, 1 from each judge | set from `defended-comment-in-one-short-line`, not measured |
| `test-name-with-no-outcome-in-python` | A | a new pytest test of a tool-loan late fee whose name holds no should and no outcome, a Prediction Failure the script raises, beside the same test named in the should form with its outcome and its condition, which is clean | set from `test-names-that-describe-implementation`, not measured |
| `phase-comments-in-production-code` | A | a new greenhouse ventilation method in TypeScript whose groups carry the phase comments given, when and then, an Unnamed Part Failure the script raises | set from `defended-comment-in-one-short-line`, not measured |
| `production-code-grouped-by-blank-lines` | A | clean: where the same groups are kept apart by blank lines alone | set from `defended-comment-in-one-short-line`, not measured |
| `note-of-work-left-in-the-code` | A | a new Go method of a tool-lending desk with a TODO note that names no ticket, a Prediction Failure the script raises | set from `defended-comment-in-one-short-line`, not measured |
| `note-of-work-that-names-its-ticket` | A | clean: where the same note names its ticket | set from `defended-comment-in-one-short-line`, not measured |
| `value-named-by-a-single-letter` | A | a new Java method of an allotment harvest ledger whose total is held in a value named by a single letter, a Prediction Failure the script raises | set from `defended-comment-in-one-short-line`, not measured |
| `value-named-for-what-it-holds` | A | clean: where the same value is named for what it holds | set from `defended-comment-in-one-short-line`, not measured |
| `shared-instance-read-through-its-class` | A | clean: a new Java class of an apiary declares a constant that holds its 1 shared object, named for that role alone, and 2 new classes read it only through the class name, which with the class name predicts the value | set from `value-named-for-what-it-holds`, not measured |
| `shared-instance-read-through-its-companion-in-kotlin` | A | clean: the same shape in Kotlin, a marina tide class whose companion object holds its 1 shared object, read only through the class name | set from `value-named-for-what-it-holds`, not measured |
| `general-word-field-whose-type-names-no-purpose` | A | a new Java field of an apiary swarm watch named by a general word, whose map type does not say what it holds either, a Prediction Failure | set from `value-named-by-a-single-letter`, not measured |
| `late-fee-rule-cut-into-arithmetic-fragments` | B | a new late fee calculation of a tool library whose rule is cut into 2 private methods of 1 operation each, whose results mean nothing until the caller checks and combines them, Over-Extraction on the calculation | set from `schedule-rebuilt-with-overflow-slots-in-the-service`, not measured |
| `berth-windows-hold-batching-and-threads` | B | a new berth window service of a harbour, in Java, whose 1 public method reads as named steps while its private methods and fields hold 3 groups the class never names: the batching by terminal with its request size, the requests run on an executor, and the asking of the terminal planner with its conversion and its container count rule; Missing Boundary on the class; Unnamed Part Failure on the public method is allowed and not required | set from `postprocessor-execute-over-two-named-steps`, not measured |
| `harvest-slots-hold-a-worker-pool` | B | the same shape in Python: a new harvest slot planner of an orchard packhouse whose private methods, private by their leading underscore, read a worker pool, a request size and a packhouse client through `self`; Missing Boundary on the class | set from `postprocessor-execute-over-two-named-steps`, not measured |
| `berth-windows-asked-through-a-batched-terminal-client` | B | clean: the berth window service where the batching and the threads sit behind 1 named collaborator, so its private methods only select the calls, convert them, count the containers and build the windows | set from `late-fee-rule-cut-into-arithmetic-fragments`, not measured |
| `ferry-boarding-in-named-layers` | B | clean: a new vehicle boarding service of a ferry, written in the shape of the book's order placement, whose public method calls 4 named steps, each with the store or the gateway of its own step, and whose deck space step sits above the step that reserves 1 space | set from `late-fee-rule-cut-into-arithmetic-fragments`, not measured |
| `parcel-dispatch-with-private-per-carrier-methods` | B | clean: a new parcel dispatch service of a depot, written in the shape of the book's minimum fix for payment providers, whose 2 public methods route by carrier to private methods per carrier, each carrier with a client of its own | set from `late-fee-rule-cut-into-arithmetic-fragments`, not measured |
| `arrival-notice-with-client-and-mapper` | B | clean: a new arrival notice service of a harbour whose every method uses the harbour authority client and the notice mapper, so no member group forms and no Missing Boundary call is made | set from `late-fee-rule-cut-into-arithmetic-fragments`, not measured |
| `tide-table-reads-one-set-of-fields` | B | clean: a new tide table in TypeScript whose methods all work on its 1 list of readings and its chart datum | set from `late-fee-rule-cut-into-arithmetic-fragments`, not measured |
| `pilot-roster-logs-in-every-method` | B | clean: a new pilot roster in Python whose every method writes to the same logger beside 1 set of pilots and assignments | set from `late-fee-rule-cut-into-arithmetic-fragments`, not measured |
| `inventory-reservation-below-order-placement` | B | clean: the book's `placeOrder` after the stock check was extracted at every step, where each private step reads the store or the gateway of its own step and `reserveInventory` names the step that reserving the stock sits below | set from `late-fee-rule-cut-into-arithmetic-fragments`, not measured |
| `conversion-name-hides-the-rows-it-drops` | B | a new Java method of a ferry terminal named `readArrivalDatesByBerth`, which turns the rows of a berth schedule response into arrival dates by berth number and skips every row whose berth number or arrival date its 2 parsers cannot read, while each parser logs a warning; the name starts with a verb, so the Prediction Failure is for the rows the name does not say are dropped | set from `predicate-name-drops-a-condition`, not measured |
| `conversion-name-says-it-keeps-parsable-rows` | B | clean: the twin of the case above, the same code under the name `collectParsableArrivalDatesByBerth`, which says it keeps only the rows it can read | set from `predicate-name-drops-a-condition`, not measured |
| `pickup-slots-matched-by-invented-keys` | B | in Java, a new caller in a `quotes` module keys each pickup request by the size of a growing map, the new pickup estimation service only copies that key into each estimate and also numbers its yard items for an outside planner and reads the slots back by that number, and the caller looks each estimate up in its map by the key: 1 decision, how a result finds its input, in several places | set from `routing-on-provider-in-two-methods`, not measured |
| `pickup-slots-matched-by-invented-keys-in-python` | B | the same shape in Python: the caller keys each request by the length of a growing dictionary and looks each estimate up in it by the key the service copied | set from `routing-on-provider-in-two-methods`, not measured |
| `pickup-slots-keyed-by-order-number` | B | clean: the twin of `pickup-slots-matched-by-invented-keys` where the caller keys each request by the order number its shipment already has, so the key has a meaning of its own, and no finding; its estimation service numbers its yard items for an outside planner and reads the slots back by that number inside 1 method, which is a question to the author under To consider, whether the made-up position can go | set from `routing-on-provider-in-two-methods`, not measured |
| `pickup-slots-matched-by-position-inside-one-method` | B | the caller numbers its shipments in a map and reads the map again by the position of each estimate, in 1 method, and no key crosses the call; the estimation service numbers its yard items for an outside planner and reads the slots back by that number inside 1 method, which is a question to the author under To consider, whether the made-up position can go, and never a finding | set from `routing-on-provider-in-two-methods`, not measured |
| `configuration-key-mixes-executor-and-reminder-settings` | A | a new YAML file of a library app puts the pool size and the queue capacity of an executor beside the days before due and the email template of the reminders, under 1 key `lending.reminders`, and a batch size inside the executor settings: the key holds a detail of a part it never names | scaled from `broad-service-name-takes-in-neighbours` by the judge calls, not measured |
| `configuration-keys-grouped-by-concept-then-execution` | A | clean: the twin in a properties file, where the keys of the catalogue are grouped by module, then by concept, then by execution, so each key holds only what its key path names | scaled from `broad-service-name-takes-in-neighbours` by the judge calls, not measured |
| `test-folder-mirrors-its-code` | B | clean: a new watering scheduler of a greenhouse in Java, with its tests in the mirrored test folder, named `WateringSchedulerTest` and `WateringSchedulerMixedBedsTest`, and the builder and the substitute they share in a `support` subfolder; the script clears the test folder as a known test layout, so no judge call reads it and no finding lands on it | set from `consignment-folder-holds-types-and-service`, not measured |
| `test-support-beside-tests` | B | the same change, where the builder of a greenhouse bed and the substitute of the moisture sensor sit loose in the test folder beside the tests; the script does not clear the folder, and the builder and the substitute are a part the folder never names, 1 Unnamed Part Failure on the test folder | set from `consignment-folder-holds-types-and-service`, not measured |
| `test-folder-by-feature` | B | clean: tests of a ski lift in Java grouped in a `features/daypass` folder of the test tree and named for the flows of a skier, buying a day pass and riding the lift, and refunding an unused day pass, so no test names a file it tests; the folder reads as the tests of what its path names, and no finding lands on it | set from `consignment-folder-holds-types-and-service`, not measured |
| `test-name-puts-behavior-first` | B | a new coat ticket desk of a museum cloakroom in Java, whose mirrored test folder holds `CoatTicketDeskTest` and `LostTicketCoatTicketDeskTest`; the second name opens with the behavior and names the desk after it, so the script raises 1 Prediction Failure on that test file, which says to put `CoatTicketDesk` first, and none on the first | set from `consignment-folder-holds-types-and-service`, not measured |
| `test-name-names-no-file` | B | a new table booking controller of a bistro in Java, whose mirrored test is named `CancelledBookingControllerTest` and holds the name of no file of the folder it tests, so the script raises 1 Prediction Failure on that test file, which says to start the name with the file it tests | set from `consignment-folder-holds-types-and-service`, not measured |
| `spec-beside-its-file` | B | clean: a new fares folder of a tram service in TypeScript holds a fare calculator, its spec file beside it and a zone map; the script leaves the spec out of the file list the module judge reads, so no finding about the spec lands on the folder | set from `consignment-folder-holds-types-and-service`, not measured |
| `split-class-moves-its-methods-unchanged` | B | clean: in a fictional library-lending domain, in Java, a loan desk class is split into a loan service, which git reads as the old file renamed, and a new loan charge calculator; every method body moves unchanged, 1 of them reads the renamed class by its name so the rename map must explain the edit, 1 of them leaves a nested class and is re-indented, and the caller in another file changes only its imports, fields and call sites; a moved method whose body is unchanged gets no method checks, so it may get no finding | copied from `copy-method-and-builder-steps-named-by-their-field`, not measured |
| `split-class-moves-a-method-of-another-purpose` | B | the same split, where the loan charge calculator also receives the method that sends an overdue reminder, the folder of the old desk keeps the table of late fees, which its name no longer covers, and 1 moved method changes 1 line, so it gets its method checks; the class and the folder are each 1 Unnamed Part Failure, and the methods that moved unchanged get no finding | copied from `copy-method-and-builder-steps-named-by-their-field`, not measured |

`mispredicting-names-inside-a-change` has a base state holding the 3 files the change touches as they were before it, because 2 of its must-not lines rest on tests that sit above the change and a patch cannot carry them.
The base state also holds the enum of quote failures and the test factory of quote lines, so the review reads what `MEMBER_VOUCHER` and `MEMBER_REFUND_RATE` mean in the member refund test that 1 must-not line rests on.

**No ceiling may pass the whole-run gate of 20 minutes and 2,000,000 tokens**, which stands above every case, so `branches-integration-already-covers` carries a total-token ceiling of exactly 2,000,000 where the arithmetic asked for more.
A cold ceiling is measured where a cold run was measured, and is 1.3 times the warm ceiling where every measured run was warm.

---

## The expectation is written in the reader's own shape

`expected.md` holds the `# <case>` title line, the findings the run must raise, then the items it must print under `## To consider`, then `## Must not appear`, and nothing else: no paragraph of prose, no reason and no ruling. What a case tests is said in its row of the table above.

The findings are a numbered list under the headers `review.md` itself writes, a `## ` header per track that holds findings and a `### Production code` or `### Test code` sub-header under it, and the numbering runs on across every section. Each item is written exactly as `review.md` writes its numbered line: the kind word, the name in backticks, and the holder after ` in ` or after ` used bare in ` where the finding is on a bare name. Under each item come its sub-points, 1 per line: the lead word of the check first, then, where the case requires one, `Also in \`<reference>\`` and a confidence level as `Moderate confidence`.

An item under `## To consider` is written the same way, with no confidence level, because an item to consider has none. It matches only an item the run prints under its own `## To consider` header, and a finding never matches it; an expected finding never matches an item to consider either.

`## Must not appear` holds 1 line per finding the run may not raise, as `<Kind> \`name\`, <Lead word>`. Every must-not line, every limit and `Any other finding` grade the findings alone, and never an item under `## To consider`.

A reference in `Also in` names the declaration that holds the place, as `Type#method`, and a nested type is written with its holders, as `Outer.Inner#method`. Where the review finds no declaration that holds a place, it writes the file and the first line instead.

The last line of `## Must not appear` may be `Any other finding`. It says the run may raise no finding beyond the ones the numbered list names, so on a clean case it may raise none at all. Where the case holds code that can honestly draw a finding the case does not measure, such as a change with no test that the test plan may ask a test for, the line names those lead words, as `Any other finding, except Integration Test Needed and Unit Test Needed`, with 2 or more lead words joined by `, ` and ` and `. A case with no such line grades only what its lines name, and any other finding passes. Where the case has a `judges.txt`, the line reaches only the findings of the judge types it lists, because no other judge type runs.

The last lines of `## Must not appear` may also hold `Any other consideration`. It says the run may print no item under `## To consider` beyond the ones the expectation names there.

A must-not line may also set a limit, as `<Kind> \`name\`, <Lead word>, at most <N> at <Level> confidence`, where the level is `High`, `Moderate` or `Low`. It names 1 or more abstractions, joined by ` or ` as `Method \`Type#method\` or Class \`Type\``, and the limit counts the items of all of them together. That line neither requires the finding nor forbids it. It fails where the run holds more than N items with that lead word on those abstractions, or where 1 of them has a confidence above that level, and an item it allows never counts under `Any other finding`.

A must-not line may also name second places, as `<Kind> \`name\`, <Lead word>, also in \`<reference>\``, with 2 or more references separated by `; ` as `review.md` writes them. That line does not forbid the finding. It forbids the finding naming any of those places in its `Also in` line, so a run may raise the finding with other places and still pass. A must-not line with no `also in` keeps its meaning and forbids the finding whole.

**The grader matches on 3 things, and on the second places where the expectation names them.** The kind word, the name with its holder, and the lead word of the check find the finding. An item of the run that holds more than 1 check has 1 lead word per check, and it matches every one of them; the confidence of each check is read from its own line under the item's `Confidence:` point. A line the verifier combined names 2 or more checks joined by ` / `, as `Remove Edge Cases / Fail Fast`, and an expected lead word matches it where it is any 1 of those names; under `Any other finding`, each of those names is accounted for on its own. A lead line of the Design track names the cognitive failure first and then the book's name of its check in brackets, as `Prediction Failure / Incomplete Mental Model (Scoped Parameters)`, and the ` / ` inside it joins 2 failures of 1 check. The grader reads each lead line as the checks it names, so an expected lead word matches a Design lead where it is the whole lead or the name in brackets, as `Scoped Parameters`, and a case may name the check by its book name. A failure word alone matches only the check of that name, so `Prediction Failure` matches a Simplicity finding and never a Design lead that holds the same words. The `Also in` references are then compared where the expectation writes them. The sentence, the direction, the order of the list, the ` · existing code` mark after a name and the file and line a finding points at are never compared, because they are the run's own words and a change to them is not a regression.

| What the expectation states | How it is graded |
|---|---|
| an item in the numbered list | PASS where the run holds an item in the same section, a finding or an item to consider, with the same kind word, the same name with its holder and the same lead word; FAIL where it holds none |
| a confidence level on that item | the run's item must carry that level; where the expectation states none, the level is not graded |
| `Also in` on that item | a required subset: every reference it names must stand in the `Also in` line of the run's item, and the run may name more places without failing |
| a line under `## Must not appear` | PASS where the run holds no item with that kind, that name and that lead word |
| `at most <N> at <Level> confidence` on a must-not line | an allowed finding: FAIL where the run holds more than N items with that lead word on the abstractions it names, or 1 of them above that level; PASS otherwise, with none raised or N or fewer at or below that level |
| `also in` on a must-not line | forbidden second places: FAIL where the run's item with that kind, that name and that lead word names any of them in its `Also in` line |
| `Any other finding` | 1 FAIL for each item of the run that holds a lead word that no numbered item matches, that no must-not line already failed or allowed and that the line does not except; 1 PASS where there is none |
| `Any other consideration` | 1 FAIL for each item under the run's `## To consider` that holds a lead word no expected item under `## To consider` matches; 1 PASS where there is none |

**A name is compared with its holder folded in.** `Method \`QuoteNoticeService#suppressMemberRefundWhenVoucherFailed\`` and the run's `Method \`suppressMemberRefundWhenVoucherFailed\` in \`QuoteNoticeService\`` are the same abstraction, so an expectation may be written in either form. Backticks and repeated spaces are dropped, the kind word and the lead word ignore case, and a name is compared as it is written.

`review.sarif` is rendered beside `review.md` and validated against the SARIF 2.1.0 schema, and nothing is graded from it.

---

## Running a case

From a session, with `<case>` the case folder, such as `evals/review/<name>`, and `<dir>` a scratch folder outside this repository:

```bash
node evals/grade.mjs --build <dir> <case>
```

It builds only into a new or empty folder outside every git working tree, and stops with an error otherwise.
It makes an empty git repository in `<dir>`, applies `base.diff` on `main` and `change.diff` on `change` where a base exists, and prints the range `main...change`.
Where the case has no `base.diff` it leaves the repository empty, copies `change.diff` into `<dir>` and prints the path of that copy, for patch mode.
The copy is what makes the run safe to grade: every argument the run is given points inside `<dir>`, so nothing the review opens can reach the expectation file of the case.

Then print the judge types the case runs:

```bash
node evals/grade.mjs --judges <case>
```

It prints `--judges <list>` from the case's `judges.txt`, or nothing where the case has none. Where `<case>` names no folder that holds an `expected.md`, it stops with an error and a non-zero exit, so a wrong name never runs a case unfiltered.

Then review it with the 5 steps `SKILL.md` holds, with `<dir>` as the target and `main...change` as the range.
Where the case has no `base.diff`, pass the printed diff path to the extract command as `--diff` instead of `--repo` and `--range`.
In step 1, append the printed flag to the prepare command, as `runReview.mjs prepare --run <run> --judges <list>`, so the review schedules only the judge types the case grades.

Then grade the `review.md` the run wrote into its run folder:

```bash
node evals/grade.mjs <case> <run folder>/review.md
```

It prints one line per expected result, then a summary line, and exits 1 where any line failed.
Before the summary line it prints 1 `WARN` line for each expected item whose check no judge type in `judges.txt` can raise, and, where the case has an `Any other finding` line, 1 `NOTE` line with the judge types that line was graded over.
The summary line stays the last line of the grade.

## Grading the cost beside the results

A case passes only where it meets every expected result and every budget, in 3 runs of 3.

```bash
node evals/grade.mjs <case> <run folder>/review.md --usage <usage.json>
```

`usage.json` states what one run cost, summed from the transcripts the harness wrote for the run, 1 for each judge workflow call and 1 for the verify call: `wall_seconds`, `total_tokens`, `new_tokens`, `output_tokens`, `cache_read_share`, `agents`, `dollars`, the cost at list price, `cold`, which is true where the run paid for its own prompt cache, and `files_opened_outside`, the count of files an agent opened outside the run folder and the target. A turn that ends in a tool call logs no completing usage, so `output_tokens` also carries `output_recovered_tokens` and `output_unmeasured_turns` beside it, which say how much of the output was recovered rather than logged.

Every field of `budget.json` is a ceiling except `cache_read_share`, which is a floor, and the new-token bar is read as `new_tokens_cold` on a cold run and as `new_tokens_warm` on a warm one.
New tokens are the cache writes plus the uncached input plus the output, which is the figure the bill tracks; the total counts cache reads at par and is the second, looser ceiling.

**A run that opened a file outside the run folder and the target is `CONTAMINATED` and fails, whatever it found.**
The grader prints the paths and fails the case, because a run that read the answer measured the reading and not the code.

---

## Where the code came from

A case comes by 1 of 2 routes: it is written fresh in a fictional domain, or it is a listing from the book.

`mispredicting-names-inside-a-change` and `second-owner-outside-the-change` are written fresh in a fictional campsite-quote domain, in Java, and share 1 change.
Writing them fresh is what makes them publishable.
They measure 2 things from 1 change: names that predict something the code does not hold, in a class that was already long, and a new method that decides again what a helper outside the change already decides from the same notices by the same test, while a method of the quote line answers a different question from its own failures.
They are tier B, because the tests above the change and the helper sit outside it and a patch cannot carry them.

`availability-schema-with-misnamed-additions` is written fresh in a fictional coffee-roastery domain, as a GraphQL schema of 1 application.
Writing it fresh is what makes it publishable.
It measures that a naming or abstraction problem in a GraphQL schema is found from the schema change alone, whatever implementation stands behind it: a name predicts what the field holds, and a field that describes another thing is a detail of a part the type never names. A name is never judged against the table or the third party that fills it.
It is tier B, because the type the change extends is not changed in full and a patch cannot carry it.

`language-checked-inside-the-order-search` and `language-checked-inside-the-export-creation` are written fresh, in a fictional museum domain and a fictional dental-practice domain, in Java hexagonal modules, with the same language validator in both.
Writing them fresh is what makes them publishable.
They measure Validate at the Boundary: a check of the input that sits inside a use case and not at its entry is a finding on the use case, and never on the validator it calls.
They are tier B, because the entry that calls the use case is not changed in full and a patch cannot carry it.

`branches-integration-already-covers` is written fresh in a fictional parcel-locker domain, after the worked example of the section *How to Distribute Tests*, in the chapter *What Testing Means*.
Writing it fresh is what makes it publishable.
The admission step is named for the admitted shipment it hands back, and a fifth integration test books a shipment to a bank whose postal prefix the surcharge table does not list, so the lookup owes nothing the tests do not take.
Its `## Must not appear` list: on `ShipmentAdmission` and on `PostalSurchargeTable` it forbids only the testing lead words, because the case measures where a test is owed and the findings the judges raise on those 2 classes on other tracks are honest findings the case does not measure.
The controller test starts the whole application and sends each request through the web framework to the booking endpoint, the way a real Spring application is tested, so it enters at the entry boundary, and it substitutes nothing.
The 2 expected items carry the lead word Unit Test Needed, and the must-not list forbids Unit Test Needed on `ShipmentAdmission`, `PostalSurchargeTable` and `LockerSizeAndHandoverRules`, Integration Test Needed on the controller, and Partial Path Test and Unit Test to Remove on the controller test, beside Test Behavior on the 2 production classes.

`interface-crosses-module-boundary-whole` is written fresh in a fictional bike-share domain, as a Spring Modulith modular monolith, after the module layout of the section *How the Principles Shape Modules*, in the chapter *The Principles at Every Scale*.
Writing it fresh is what makes it publishable.
The ride charge calculator sits in a `ride` module of its own, which declares its allowed dependency on pricing, so the `station` root holds only station things, and the exposed record is named for the ride duration it holds.
It is a clean case: a module root that exposes a class is no finding, and the 2 files at the root of `pricing` are fine. `pricing` and `station` declare no allowed dependency they do not use, a controller of the `ride` module calls the ride charge calculator, and the seasonal rate table is public so that the price calculator at the root can import it. It runs only the module judge, and its must-not list forbids Unnamed Part Failure and Prediction Failure on `pricing`, `station` and `ride`.

`test-behavior-without-an-outcome` is written fresh in a fictional harbour-ferry domain.
Writing it fresh is what makes it publishable.
It measures Test Behavior alone: 3 planted tests that check no outcome, a call on a substitute with a matcher that takes any value, a refusal caught in an empty catch with no assertion after it, and a fare the substitute was told to return, beside 1 sound test that must not be flagged.
Its test class substitutes only the ticket store and the fare service, both at the exit boundary, so the must-not list also forbids the test plan items the class does not earn.

`new-package-that-does-not-belong` is written fresh in a fictional e-commerce domain.
Writing it fresh is what makes it publishable.
It measures the reading of a created folder against the folder it joins: a `newsletter` package added to the `order` package of `order-service` must give 1 Unnamed Part Failure on `order`, the folder whose contents stop being parts of its name, and a payment retry service in the existing `payment` package, a script in the existing `scripts` folder and a new `inventory-service` at the repository root must give nothing.

`literal-hides-what-it-controls`, `literal-in-a-line-that-states-it` and `constant-over-a-literal-the-line-states` are written fresh in the fictional harbour-ferry domain, after the section *Context-Aware Constants* of *How Naming Goes Wrong*, in the chapter *The Common Pitfalls*.
Writing them fresh is what makes them publishable.
They measure 1 rule from 2 sides: a literal is a finding where nothing on its line states what the value means, and a constant over a literal is a finding where its line would state that meaning with the literal in its place.

`predicate-name-drops-a-condition` is written fresh in a fictional shop domain of cart lines and the quantities an ERP system confirms.
Writing it fresh is what makes it publishable.
It measures 1 method on 2 checks, because the name that leaves out a condition and the checks for missing values that sit in the same expression are the 2 failures of 1 line a reader reads once.

`status-held-as-a-string`, `new-case-reached-through-a-fallback`, `guarded-list-handed-out-whole` and `session-value-cast-with-no-check` are written fresh in the same fictional harbour-ferry domain, after the sections *Exclude Illegal States*, *Protect the State* and *Remove Edge Cases* of *How Abstraction Design Prevents Errors*, in the chapter *What Correctness Means*, and, for the last, after the session read of the section *How the Detection Works in Practice*, in the chapter *How to Apply the Principles*.
Writing them fresh is what makes them publishable.
Each measures 1 design rule: a state held as a string, a new case that a fallback gives the behavior of another case, a mutable field handed out by an object with rules for its state, and a cast with no check of a value whose type the store does not declare.
`new-case-reached-through-a-fallback` is tier B, because the site that falls back is not changed and a patch cannot carry it.

`category-text-only-stored` and `flag-set-read-in-three-conditionals` are written fresh, in a fictional bookshop domain and a fictional climbing-gym domain, after the section *Exclude Illegal States* of *How Abstraction Design Prevents Errors*, in the chapter *What Correctness Means*, and the section *How Types Go Wrong*, in the chapter *The Common Pitfalls*.
Writing them fresh is what makes them publishable.
They measure 1 ruling from 2 sides: a category is no Exclude Illegal States finding where no line states its fixed set of values, and a set of booleans that names the kinds of 1 category is a Simplicity finding, an Unnamed Part Failure on the class and an Incomplete Mental Model on the conditionals that read it.
`flag-set-read-in-three-conditionals` is tier B, because only the new conditional is in the change, so the review names it alone and finds the 2 old conditionals as its other places.
`lifecycle-flags-with-a-guard` is written fresh in a fictional seed-shop domain, after the section *Exclude Illegal States* of *How Abstraction Design Prevents Errors*, in the chapter *What Correctness Means*. It is tier B for the same reason. Its guard sits in a method of the class, because the prevention judge reads a class through its own lines, so a guard in another class would not reach it.

`partner-store-ids-in-sets-of-their-own-decisions` and `delivery-state-text-compared-in-two-classes` are written fresh in a fictional grocery-delivery domain, in Java, after the section *Exclude Illegal States* of *How Abstraction Design Prevents Errors*, in the chapter *What Correctness Means*, and the section *Don't Repeat Yourself* of *How the Principles Shape Classes*, in the chapter *The Principles at Every Scale*, where unrelated business rules do not share 1 abstraction.
Writing them fresh is what makes them publishable.
They measure 1 ruling from 2 sides: an id that names 1 entity registered as data, in this system or another, is an open set, so a decision that tests it against a few named ids and gives every other id the normal path holds the set of that decision and is no Exclude Illegal States finding, even where the same id stands in the set of another decision, while a state or a kind held as text and compared with named codes is still a finding, even where only 1 code is in sight.
`partner-store-ids-in-sets-of-their-own-decisions` is tier B, because the order and the partner store it reads are not changed; `delivery-state-text-compared-in-two-classes` is tier A, because every comparison sits in the change, and its state comparisons sit in methods of the class, because the prevention judge reads a class through its own lines.

`null-returned-when-no-carrier-matches` and `empty-list-returned-when-no-calendar-is-published` are written fresh, in a fictional parcel-depot domain in Java and a fictional delivery-slot domain in TypeScript, after the sections *Remove Edge Cases* and *Fail Fast* of *How Abstraction Design Prevents Errors*, in the chapter *What Correctness Means*.
Writing them fresh is what makes them publishable.
They measure 1 ruling from 2 sides: a find of 1 item that returns null where nothing matches, and an operation that gives a missing input the empty answer to its own question, are normal results and no finding under either decision.
They are tier B, because the types the new code reads are not changed and a patch cannot carry them.

`charge-failure-dropped-behind-a-paid-receipt`, `zero-price-summed-into-an-invoice`, `missing-price-left-blank-in-a-price-list`, `export-written-without-a-failed-price-source` and `product-page-without-a-failed-delivery-estimate` are written fresh in a fictional bakery domain, in Java, after the section *Fail Fast* of *How Abstraction Design Prevents Errors*, in the chapter *What Correctness Means*.
Writing them fresh is what makes them publishable.
They measure 1 ruling from 2 sides: a method that catches a failure and goes on is a finding where its result then claims a success that did not happen or holds a value made up in place of the lost one, and no finding where its result only leaves out the data the failure lost and the failure is logged with the source that failed.
They are tier B, because the types the new code reads are not changed and a patch cannot carry them.

`three-open-constructs-around-a-boarding-pass` is written fresh in the same fictional harbour-ferry domain, after the section *What Limits Understanding* of the chapter *What Simple Means*.
Writing it fresh is what makes it publishable.
It measures the count of open constructs from the clean side: 3 open constructs at 1 line are no finding, and the steps of a chain and the lines of a list of arguments are never counted as open constructs.

`chained-steps-hold-unnamed-parts`, `chained-steps-named-as-parts`, `array-chain-steps-hold-unnamed-parts`, `array-chain-steps-named-as-parts`, `query-chain-steps-hold-unnamed-parts` and `query-chain-steps-named-as-parts` are written fresh in a theatre, a veterinary clinic and an allotment garden domain, in Java, TypeScript and C#, after the section *How to Fix Mixed Abstraction Levels* of the chapter *The Single Level of Abstraction Principle* and the section *What Limits Understanding* of the chapter *What Simple Means*.
Each step of a chained call that takes a function is a part of its method.
Writing them fresh is what makes them publishable.
They measure the steps of a chain from both sides: a step whose function does more than name 1 part is an Unnamed Part Failure however short the chain, and a long chain of named steps is no finding.

`injected-handler-map-named-as-a-plural` is written fresh in the same fictional harbour-ferry domain.
A field is judged only where its name says more than its type.
Writing it fresh is what makes it publishable.
It measures the keyed value from both sides: a map of handlers named only as their plural is a finding although the key may stay out of the name, and a field named for its own type and a list named as the plural of its element type are not judged at all.

`explicit-false-decided-again-outside-the-change` is written fresh in the same fictional harbour-ferry domain, after the section *How Abstraction Design Prevents Errors*, in the chapter *What Correctness Means*, where a decision repeated in many places drifts.

`explicit-false-decided-again-in-another-application` is the same code with 2 build files added.
Writing it fresh is what makes it publishable.
It measures the second place of a decision that a changed line reads from a field: the badge and the new method read the same field, in 2 languages, and neither holds a name or a literal that the other shares.
It is tier B, because the badge is not changed and a patch cannot carry it.

`lending-rule-and-renewal-code-restated-in-a-new-module` and `new-module-asks-the-loan-terms` are written fresh in a fictional library domain.
Writing them fresh is what makes them publishable.
They measure the second place of a decision whose copy reads the same values through calls with no argument, over a condition written on more than 1 line, and a second decoding of 1 code of an outside system; the clean twin asks the record and passes the decoded flag through, so no place holds a second copy.
They are tier B, because the loans module is not changed and a patch cannot carry it.

`returned-case-added-at-one-service` is written fresh in the same fictional harbour-ferry domain.
A shared type which the platform that joins the services requires each service to declare for itself is not 1 decision in 2 places by its declarations alone.
Writing it fresh is what makes it publishable.
It measures the clean side of the service-scale decision: each service lists only the cases it returns, nothing takes a case back as input and no service reads a case the other returns, so a case added at 1 service and not at the other is no finding.
It is tier B, because the second declaration sits in the service the change does not touch and a patch cannot carry it.

`copies-across-two-deployable-applications` is written fresh in a fictional shipping domain.
Separate applications may keep their own copies of a rule, so a copy in another application is never a finding: it is at most 1 item to consider, and only where the code shows that the 2 applications must give the same answer.
Writing it fresh is what makes it publishable.
It measures both sides of that rule: the carrier table copied into both applications is no finding, because no line passes a carrier between them, and the hold decided again after the status code is read back is 1 item to consider, because the dispatch application reads the answer the tracking application returns.
It is tier B, because the tracking policy sits outside the change and a patch cannot carry it.

Writing it fresh is what makes it publishable.
It measures that a case added to the enum of 1 of 2 separately deployed applications is a question to the author and never a finding: the billing application reads back the kind the rental application returns, so the code shows that both must know the same kinds, while only the author knows whether the 2 enums are kept apart on purpose.
It is tier B, because the billing application sits outside the change and a patch cannot carry it.

`handling-resolved-from-a-context-or-a-request` is written fresh in a fictional parcel-shipment domain, after the section *Remove Edge Cases* of *How Abstraction Design Prevents Errors*, in the chapter *What Correctness Means*, and after the section *How Understanding Works* of the chapter *What Simple Means*, where a lookup name predicts that the result can be missing.
Writing it fresh is what makes it publishable.
It measures 2 shapes of 1 value type: a missing result that no caller reads as absence, because every caller replaces it with the value the normal path builds, and a conversion name over a lookup whose return type allows no result, which does not repair the name.
It is tier A, because every caller of both methods sits in the class the change adds.

`rule-cut-into-fragments-across-two-files` is written fresh in a fictional library-loan domain, after the section *How the Principles Restore Simplicity*, in the chapter *How to Apply the Principles*, where over-extraction is itself a simplicity failure.
Writing it fresh is what makes it publishable.
It measures Prediction Failure on the names of a rule cut into pieces: `resolve` and the `from` methods predict nothing about the rule they hold, and a reader cannot tell whether `from(session)` is a part of `resolve`. Over-Extraction on the same chain is allowed and not required, and a one-line forwarding method whose caller uses its result as it is must draw no Over-Extraction.
It is tier B, because the 2 roots existed before the change and their callers are not changed.

`general-verb-over-a-precedence-rule` is written fresh in a fictional kayak-rental domain, in Python.
Writing it fresh is what makes it publishable.
It measures the verb rule and the reverse test outside Java and outside the old list of general verbs: a name must say what the body decides, in the words a reader would use from its lines, and a name that states its rule must not draw the finding.

`input-type-widened-for-one-operation` is written fresh in a fictional hotel-room domain, after the section *Scoped Parameters* of *How Types Go Wrong*, in the chapter *The Common Pitfalls*, where an object that is too broad hides the dependencies of a method.
Writing it fresh is what makes it publishable.
It is a clean case: an operation that reads only some members of its input is no finding. It guards against Scoped Parameters on either input type and against Incomplete Mental Model across the 2 types the change makes identical.
It is tier B, because the operations that take the wider type and never read the new values are not changed.

`availability-input-widened-with-pricing-values` is written fresh in a fictional e-commerce domain, modelled on the shape of a real change that the author reviewed, and no name of that change remains.
Writing it fresh is what makes it publishable.
It measures Prediction Failure on an input type that gains values of another operation's concept, which no result of its own operations depends on, after the section *How to Detect Simplicity Problems*, in the chapter *How to Apply the Principles*, and it forbids Incomplete Mental Model across 2 inputs that look the same, after the section *How the Principles Shape Classes*, in the chapter *The Principles at Every Scale*, where identical code can serve different models that must evolve independently.
It is tier B, because the price input and the operations of the availability input are not all changed.

`core-port-takes-its-own-results-back`, `core-port-takes-its-own-results-back-in-python`, `core-joins-data-from-two-outbound-ports` and `layered-service-takes-its-own-results-back` are written fresh, in fictional insurance-quote, freight-booking, library-loan and guided-tour domains, after the section *How the Principles Shape Modules*, in the chapter *The Principles at Every Scale*, where the domain holds only business logic.
Writing them fresh is what makes them publishable.
They measure Leaked Details from 2 sides: a core port whose operations take the core's own output back, in pieces a caller outside the core made, is a finding in a hexagonal module and in a `domain`, `ports` and `adapters` layout, while a core operation that combines data the core fetches itself and the same rebuild in a layered layout, which has no core at the level of its layers, are no finding.
They are tier B, because the core is found by the imports of the whole module, and the port whose output is taken back is not changed.

`named-interface-opens-the-domain-model`, `barrel-re-exports-the-domain-model`, `driven-port-implemented-inside-the-app`, `domain-imports-an-out-adapter` and `adapter-decides-a-business-rule`, with their clean twins `named-interface-opens-only-public-types`, `barrel-exports-only-port-and-public-types`, `driven-port-implemented-in-an-out-adapter`, `domain-reads-through-a-needed-port` and `adapter-only-checks-and-maps-the-input`, are written fresh, in fictional plant-nursery, bike-rental, dog-kennel, greenhouse and bakery domains, in Java, TypeScript, PHP and Python, after the subsections *Modular Monolith* and *Hexagonal Architecture* of the section *How the Principles Shape Modules*, in the chapter *The Principles at Every Scale*.
Writing them fresh is what makes them publishable.
They measure the module boundary of a hexagonal shape: a domain type that a declaration opens to other modules, a needed port implemented inside the app and an app that imports its own adapter are each a Prediction Failure, and an adapter that decides a rule of the business is Leaked Details, while a check of the input for the system is not.
They are tier B, because the shape, the published set and the imports are read from the whole repository.

`formats-beside-their-chooser`, `flat-handover-folder-mixes-steps-and-variants`, `flat-folder-of-fifteen-mixed-depot-parts`, `flat-folder-of-one-tracking-provider-each`, `flat-folder-holds-a-row-of-its-documents`, `flat-folder-of-documents-only`, `file-of-functions-named-for-the-scan-it-acts-on`, `file-of-functions-named-for-the-formatting-it-does` and `route-planning-split-into-input-planning-and-route` are written fresh in a fictional courier domain, in TypeScript.

`file-of-functions-named-for-the-readings-it-converts` and its clean twin `file-of-functions-named-for-the-conversion-it-does` are written fresh in a fictional tide station domain, in JavaScript, `file-named-for-another-thing-than-its-class` in a fictional ferry domain, in JavaScript, and `file-named-for-its-class-in-snake-case` in a fictional bakery domain, in Python.
`shell-functions-file-named-for-its-subject` is written fresh in a fictional pilot station domain, as a bash library, a bash script, a SQL file and a YAML file.
Writing them fresh is what makes them publishable.

`data-named-type-books-carriers` and its clean twin `work-named-type-books-carriers` are written fresh in a fictional freight domain, in Java, `shipping-utilities-folder-holds-a-service-and-order-entries` in a fictional bakery domain, in Java, and `consignment-folder-holds-types-and-service` with its clean twin `consignment-folder-holds-nested-types-and-service` in a fictional courier domain, in Java.

`record-converts-its-own-reading` is written fresh in a fictional harbour domain, in TypeScript.

`stored-record-beside-the-domain-record` and its clean twin `domain-record-carries-its-storage-markers` are written fresh, in a fictional harbour domain, in Java and TypeScript, after the subsection *Hexagonal Architecture* of the section *How the Principles Shape Modules*, in the chapter *The Principles at Every Scale*, where the book recommends 1 domain object that keeps its storage markers.
Writing them fresh is what makes them publishable.
They measure that 2 types of 1 change that hold most of the same members are 1 fact in 2 places to consider, while 1 domain object that carries its storage markers is not.
They are tier B, because the decision search reads the types of the repository.

`two-domain-records-of-one-harvest`, `exposed-record-mapped-from-the-domain-record` and `exposed-type-mapped-from-the-domain-class-in-typescript` are written fresh, in fictional beekeeping and library-loan domains, in Java and TypeScript, after the subsection *Hexagonal Architecture* of the section *How the Principles Shape Modules*, in the chapter *The Principles at Every Scale*, where the extra mapping into a separate set of classes is the price of the boundary.
Writing them fresh is what makes them publishable.
They measure that 2 domain types of 1 module with the same members are 1 fact in 2 places to consider, while a type that 1 module exposes to other modules and maps to and from its own domain type is no copy of that domain type.
They are tier B, because the decision search reads the types of the repository.

`partner-answer-copied-into-a-domain-type` and its clean twin `partner-answer-copied-into-an-out-adapter-type` are written fresh in a fictional greenhouse domain, in Java, and `request-type-in-the-in-folder-beside-the-domain-type` in a fictional pet boarding domain, in TypeScript, after the subsection *Hexagonal Architecture* of the section *How the Principles Shape Modules*, in the chapter *The Principles at Every Scale*, where the out side maps the data types of the other side into its own domain objects.

`bin-summary-mapped-to-and-from-the-bin` and its twin `bin-record-beside-the-bin` are written fresh, in a fictional warehouse domain, in Python, after the same subsection.
Writing them fresh is what makes them publishable.
They measure the same rule with no word in a name and no folder that says a type is exposed, so only the mapping and the import of the second package show the boundary.
They are tier B, because the decision search reads the types of the repository.

`comment-above-a-wrapped-method-head`, `comment-added-above-an-unchanged-method`, `missing-entries-filled-by-a-nested-builder-function`, `missing-entries-filled-by-a-named-factory`, `functions-nested-in-call-arguments`, `defended-comment-that-narrates-the-code`, `defended-comment-in-one-short-line` and `comment-beside-a-misnamed-method` are written fresh in the fictional harbour-ferry domain, in Java.
The comment cases follow the subsection *Self-Documenting Code* of the section *How Naming Goes Wrong*, in the chapter *The Common Pitfalls*, where a defended comment must be short, direct and compressed; the function cases follow the section *What Limits Understanding* of the chapter *What Simple Means*, where each step of a chained call that takes a function is a part of its method.

`copy-method-and-builder-steps-named-by-their-field` is written fresh in a fictional orchard domain, in Java, after the subsection *Builder* of the section *How Types Go Wrong*, in the chapter *The Common Pitfalls*, where "the prediction from the name matches what happens".
Writing it fresh is what makes it publishable.
It measures that a method that returns a copy of a value with 1 field changed, named with and that field, and a builder step named by the bare field it sets are no Prediction Failure, while a name that starts with with and is no copy method, as in `comment-beside-a-misnamed-method`, stays one.
It is tier A, because every line it grades is in the change.

`schedule-rebuilt-with-overflow-slots-in-the-service`, `schedule-gains-pilot-slots-from-a-roster-it-takes` and `overflow-slots-added-by-a-schedule-builder` are written fresh in a fictional marina domain, in Kotlin, after the subsection *Scoped Parameters* of the section *How Types Go Wrong*, in the chapter *The Common Pitfalls*, where the methods that work mostly on the fields of a parameter object belong on that class.
Writing them fresh is what makes them publishable.
They are tier B, because the value type the step rebuilds is read from the repository; for the same reason `missing-entries-filled-by-a-nested-builder-function` and `missing-entries-filled-by-a-named-factory` hold the quote, the request and the tariff book in a base state.

`decision-and-free-text-code-across-an-entry-boundary` is written fresh in a fictional bike-rental domain, after the section *How Abstraction Design Prevents Errors*, in the chapter *What Correctness Means*, where a decision repeated in many places drifts and a closed set of cases excludes an illegal state.
Writing it fresh is what makes it publishable.
It measures the entry boundary of 1 application read with its caller in another application, on 2 checks and 3 fields of 1 schema type: a region check that both applications make is Incomplete Mental Model on the field, a free-text code that the caller compares with a named constant is Exclude Illegal States on the field, and a value that the caller only shows is no finding.
It holds both shapes in 1 case because the judge of the entry boundary reads every changed field of 1 schema type in 1 call, so 1 fixture is the input that judge meets, and each shape has its own expected item and its own must-not lines, so a failure names its field and its check.
It is tier B, because the review finds the 2 applications by their build files and the caller by a search of the whole repository.

`decision-across-an-entry-boundary-on-imported-constants` is written fresh in a fictional mountain-hut domain, after the same section, and it takes the shape of the case above with both constants moved to a constants file of their own application.
Writing it fresh is what makes it publishable.
It measures the confidence of Incomplete Mental Model on the field where every line of the path is in the change or in the 2 constants files, beside a value that the caller only shows, which is no finding.
It is tier B for the same reason, and because the 2 constants files are not changed.

`partner-store-id-tested-in-a-frontend-across-an-entry-boundary` is written fresh in the fictional grocery-delivery domain of `partner-store-ids-in-sets-of-their-own-decisions`, after the same section as the case above, and it takes the shape of `decision-and-free-text-code-across-an-entry-boundary` with the free-text field replaced by the id of a partner store.
Writing it fresh is what makes it publishable.
It measures the clean side of the free-text code in that case: a caller that tests an id that names 1 entity registered as data against named ids of its own decision is no Exclude Illegal States finding, while the frame class of that case, a kind and not an id, stays one.
It is tier B for the same reason as that case.

`when-phase-missing-from-a-given-then-test` and `short-test-of-three-named-lines` are written fresh in a fictional bike-workshop domain, in Java, and `long-test-with-inline-request-details` and `end-to-end-test-of-named-steps` in a fictional box-office and a fictional garden-shop domain, in TypeScript.
Writing them fresh is what makes them publishable.
They measure that Given-When-Then is not forced, after the section *How Structure Goes Wrong*, in the chapter *The Common Pitfalls*, which reads the Given-When-Then test: a missing or merged phase is a Compression Failure only on a test written in the block shape, a test not written in that shape is judged by single level of abstraction alone, and a test whose phases are calls to steps named for their phase shows its phases by those names.
The script schedules Compression Failure only on a test whose body holds a phase comment named given, when or then, so the 3 cases with no such comment measure the schedule as well as the judge, and the step case measures that a step call named for its phase is no finding.

`test-name-with-no-outcome-in-python`, `phase-comments-in-production-code`, `production-code-grouped-by-blank-lines`, `note-of-work-left-in-the-code`, `note-of-work-that-names-its-ticket`, `value-named-by-a-single-letter`, `value-named-for-what-it-holds` and `late-fee-rule-cut-into-arithmetic-fragments` are written fresh, in fictional tool-library, greenhouse and allotment domains, in Python, TypeScript, Go and Java.
Writing them fresh is what makes them publishable.

`berth-windows-hold-batching-and-threads`, `harvest-slots-hold-a-worker-pool`, `berth-windows-asked-through-a-batched-terminal-client`, `ferry-boarding-in-named-layers`, `parcel-dispatch-with-private-per-carrier-methods`, `arrival-notice-with-client-and-mapper`, `tide-table-reads-one-set-of-fields` and `pilot-roster-logs-in-every-method` are written fresh, in fictional harbour, orchard-packhouse, ferry and parcel-depot domains, in Java, Python and TypeScript.
Writing them fresh is what makes them publishable.
They measure Missing Boundary, a check of the Design track on a class whose private methods and fields form groups that the class never names: the 2 positives hold such groups, and the clean cases hold the shapes the book reads as parts of the whole, or a class whose fields every method uses.
`inventory-reservation-below-order-placement` holds the same listing as `recursive-extraction-names-every-part` and comes by the second route; it is tier B because the script finds the member groups of a class only in repository mode.
The judge type `design-missing-boundary` that their `judges.txt` names lands in the next step: until its agent file exists, `runReview.mjs prepare --judges` stops on that name, so these cases build and their member groups can be printed, but they cannot be reviewed or graded.

`shared-instance-read-through-its-class`, `shared-instance-read-through-its-companion-in-kotlin` and `general-word-field-whose-type-names-no-purpose` are written fresh in fictional apiary and marina domains, in Java and Kotlin, after the section *How Naming Makes Boundaries Work*, in the chapter *The Encapsulation Principle*, where the book reads a call site as 2 names together: "when the outside already names the purpose, the inside does not need to repeat it".
Writing them fresh is what makes them publishable.
They measure that a constant a type declares to hold its 1 shared object, read only through the name of that type, is not a name built on a general word, beside a field whose name and type both leave its purpose unsaid, which is.

`conversion-name-hides-the-rows-it-drops` and its clean twin `conversion-name-says-it-keeps-parsable-rows` are written fresh in a fictional ferry terminal domain, in Java.
Writing them fresh is what makes them publishable.
They measure that a conversion whose name predicts that every row becomes an entry, while the rows it cannot read vanish, is a Prediction Failure for the drop, and that a name which says it keeps only what it can read is not.
They are tier B, because the response and row types the method reads are not changed.

`pickup-slots-matched-by-invented-keys`, `pickup-slots-matched-by-invented-keys-in-python`, `pickup-slots-keyed-by-order-number` and `pickup-slots-matched-by-position-inside-one-method` are written fresh in a fictional freight-yard domain, in Java and Python.
Writing them fresh is what makes them publishable.
They measure that a key a caller makes up only to match the answers to its requests, which the operation copies into its results and the caller reads back, is 1 decision in several places on the operation that takes the requests, and that neither a key with a meaning of its own nor a map that 1 method builds and reads again is.
They are tier B, because the request types, the outside planner and the shipment sit outside the change.

`configuration-key-mixes-executor-and-reminder-settings` and `configuration-keys-grouped-by-concept-then-execution` are written fresh in a fictional library app, as a YAML file and a properties file.
Writing them fresh is what makes them publishable.
They measure that the keys of a configuration file are read as a class that holds data: a key that holds other keys is judged like a record, its keys are its fields, and a key under it that describes another thing is a detail of a part the key never names.
They are tier A, because each change creates its whole file.

`test-folder-mirrors-its-code`, `test-support-beside-tests`, `test-folder-by-feature`, `test-name-puts-behavior-first`, `test-name-names-no-file` and `spec-beside-its-file` are written fresh in fictional greenhouse, ski lift, museum cloakroom, bistro and tram domains, in Java and TypeScript.
Writing them fresh is what makes them publishable.
They measure how the review reads the layout of tests: a test folder that mirrors its code or a spec beside its file is no finding, a test folder grouped by feature is read as the tests of what its path names, test support loose beside the tests is a part the folder never names, and a test file whose name does not start with the file it tests is a Prediction Failure the script raises on its own.
They are tier B, because the script reads the files of each folder and the folder a test folder mirrors from the repository, and a patch cannot carry them; each base holds only the application class or the package file.

`split-class-moves-its-methods-unchanged` and its twin `split-class-moves-a-method-of-another-purpose` are written fresh in a fictional library-lending domain, in Java.
Writing them fresh is what makes them publishable.
They measure that a move changes the holder and not the moved: a method whose body is unchanged after the rename map gets no method checks, while the class that receives it and the folder the file left are judged, and a moved method with 1 edited line is judged as a method.
They are tier B, because the old class and the folder it leaves are in the base state, and the review reads the move and the rename from the 2 commits.

Every case whose row names the book comes by the second route: its code is a listing from the book *Laminar Software Design*, and its expectation is the verdict the book's own text states on that listing.
The book is published, so its listings may be published as fixtures.
Each listing is kept as the book prints it.
Where the book leaves a body out, prints statements with no method around them or calls a method it does not show, the fill is the least code that makes the listing a change, and it is written so that it adds no finding the case grades.
The names of the classes around a listing, and the paths, belong to the fixture, in the shop domain of the book.
A case whose row starts with clean has no expected finding and is graded by its `## Must not appear` lines alone, and where its last line is `Any other finding`, also by the rule that the run raises nothing else.
Where the book reads a listing for 1 idea and the same code also holds a finding on another track, such as Looped I/O on a read that the book reads for its name, the row of the case says so and the case does not grade it, because one case tests one thing.

Nothing in any tree is meant to compile. A case holds a build file only where the review needs an application root, such as the test plan or the search for the core of a module.
