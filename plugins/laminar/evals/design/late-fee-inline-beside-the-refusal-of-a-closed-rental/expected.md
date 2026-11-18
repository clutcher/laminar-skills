# late-fee-inline-beside-the-refusal-of-a-closed-rental

## Level 1

- checkDesign: no defect

## Level 2

- The model closes the Unnamed Part Failure on `ReturnDesk#closeRental` with named parts, such as a part that finds the open rental and a part that prices the delay, and `closeRental` calls them in order.
- The model keeps the refusal of a closed rental: the `body` of `ReturnDesk#closeRental`, or the `body` of the named part that it calls to find the rental, holds `throw new RentalAlreadyClosedException`, or an object of `exits` whose `from` is that method or that part names `RentalAlreadyClosedException` in its failure line.
- The model writes no question on the status 409 of a closed rental, and `design.md` names no change of the response of `ReturnDeskRestController#closeRental` to a closed rental. The model removes neither `ReturnDeskTest#shouldRefuseTheReturnWhenTheRentalIsAlreadyClosed` nor `ReturnDeskRestControllerTest#shouldAnswerConflictWhenTheRentalIsAlreadyClosed`.
- A model whose new bodies hold no throw of `RentalAlreadyClosedException`, whose `exits` name no such failure, and that names no decision of the person on the change fails the case. The finding asks for no change of the refusal, so a finding is never such a decision.
