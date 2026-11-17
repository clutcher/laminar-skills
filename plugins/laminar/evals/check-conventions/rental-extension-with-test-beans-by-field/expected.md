# rental-extension-with-test-beans-by-field

The change is `main...change`, checked with the argument `change`. A place names the file and the line at the head of the change. Where 2 ids stand after a place, either one matches. Each item names its scale, which the finding must carry as the last word of its first line, after ` · `. With the argument `change scales: module,class`, no item must appear, and the first line of the report must name `variable` with the number of findings left out.

## Must appear

1. `RentalService:13`, `project rentals.md §1`, scale `variable`: the limit on an extension is the bare number of hours 4 and not a Duration.

## Allowed

- `RentalService#extendRental:22`, `project rentals.md §1`, scale `variable` or `method`: the method compares the hours of the extension with the bare number of the limit.
- `RentalService#extendRental`, any line from 21 to 35, `code-style methods.md §10`, scale `method`: the method checks the extension, fetches the rental and extends it in 1 body, a calculation the book puts apart from the fetching.

## Must not appear

- Any finding on `RentalControllerTest`, lines 21 to 25, that names `code-style spring.md §1`, `code-style spring.md §9` or any other rule for the 2 beans that the test class takes by field injection: `project tests.md §1` asks for field injection in a test class and wins over the rules of the skill.
- Any finding on `RentalControllerTest` that asks for a constructor in the test class or for a final field in it.
- Any finding on `.claude/rules/conventions/tests.md`: the file is not changed, and its rule overrides only rules of the skill, never a design direction of the book.
- Any finding on a line the change does not add or change, such as the entry `ExtensionRequest`, which takes the hours as a number by the limits of `project rentals.md §1`.
- Any finding that names a book direction that is not marked narrower than the book, such as `code-style naming.md §1` or `code-style tests.md §1`, on code, except a design direction that section 2 of the skill lists among those the review does not judge yet, such as `code-style methods.md §10`.
- Any finding whose first line does not end in ` · ` and 1 of the words application, module, class, method or variable.
- With the argument `change scales: module,class`, any finding of scale `application`, `method` or `variable`.
