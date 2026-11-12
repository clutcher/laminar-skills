# lab-order-names-under-project-conventions

## Level 1

- checkDesign: no defect
- Convention override: project web.md §1; code-style spring.md §5
- Convention contradiction: project laborder.md §1; code-style naming.md §1 or code-style naming.md §8
- Model path present: LabOrderBody
- Model path absent: LabOrderRequest
- Model path absent: LabOrderResponse

## Level 2

- The design model lists `web.md` and `laborder.md` under `decisions.conventions.files`, although no folder of the base holds a file that `laborder.md` matches: only the files that the change creates under `laborder` match it.
- The design model names the types of the new call by the written project rule `project web.md §1`, with the suffix Body, and records that rule once as an override of the rule of the skill marked narrower than the book; `design.md` prints it in its head, and no question asks it.
- The design model does not follow `project laborder.md §1` for the class that checks the fasting and also fills in a missing sample time, because a name must predict all that the code does, with no change the name does not mention, a design direction of the book: the name of a validator of the fasting hides that the order comes back with another sample time. It records the clash once as a contradiction, and the tree keeps the correction apart from the check, each under a name that says it, such as a sample time filled in from the time of the order where the order is built and a method of `LabPanel` or `LabOrder` that answers whether the fasting is long enough, while the rejection stays in `LabOrderDesk`.
- A writer that writes the model raises no stop `model-breaks-code-style` on the Body names, and a run of the skill `check-conventions` on the written change reports the contradiction on the line of `laborder.md` and no finding of `code-style spring.md §5` on the Body names.
