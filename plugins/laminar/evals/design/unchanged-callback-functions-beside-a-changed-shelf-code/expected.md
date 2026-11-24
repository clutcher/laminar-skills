# unchanged-callback-functions-beside-a-changed-shelf-code

## Level 1

- checkDesign: no defect
- No file moves
- New files: at most 0
- Class text absent: `statusLabel: labelOf(book.status)`
- Class text absent: `shownLabels.add(parts.statusLabel)`

## Level 2

- The design model marks `toShelfParts` and `toUniqueStatusShelfParts` as `unchanged`, with no `body`, because the plan changes neither of them. Both take a callback parameter, `labelOf` or `statusLabelOf`, whose type holds its own parentheses: `toShelfParts` is a function declaration, and `toUniqueStatusShelfParts` an arrow function assigned to a const with its parameters on several lines.
- No call site of either function passes arguments named as its parameters, so the design check can confirm the mark only from the declaration.
- The shape runs raise no item on either function, nor on the locals `shownLabels` and `parts`, because they stand outside the change.
