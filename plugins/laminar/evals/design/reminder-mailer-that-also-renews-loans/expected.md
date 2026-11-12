# reminder-mailer-that-also-renews-loans

## Level 1

- checkDesign: no defect
- No name holds: notice
- Model path absent: ReminderLoan
- Class text absent: `0 0 7 * * *`

## Level 2

- The designer runs with no Workflow tool, returns the run folder of each shape run after the prepare command, and reads `review.md` of the run folder that the calling session sends back. Its report gives the cost of each shape run as the cost the calling session sent, or as `not measured`, and never the cost plan of the prepare command.
- The designer decides the change of each kept item itself: it does not take the rename to `DueNoticeService` of the fix table, nor the name of the `To confirm:` line of the class finding, because the decided list carries the user's rejection of the word notice.
- The tree of the model moves the renewal out of the class of the reminders, to `LoanDesk#renew`, which owns the rule of 14 days and the refusal of a loan on hold, so the class that sends the reminders holds only what its name says. Where a shape run still keeps a Prediction Failure on a second name of that class, the next change moves members and gives no third name.
- The model reads the due loans as `Loan`, the domain object of the module `loan`, and creates no second type with the same members, neither `ReminderLoan` nor a row type for the copy to the staff or for the CSV list.
- The model keeps the schedule of the tree, `0 */30 * * * *` of `reminders.properties`, and the report names the difference from the schedule that the calling session stated.
- The model decides each fact of the vendored library Postbox before the plan ends, in a body, a field type, a failure line or a question: at most 50 recipients per call of `send`, for the 64 addresses of the staff; no attachment in the free edition, so the CSV list is a question of the model or a body that does not call `sendWithAttachment`; and `DeliveryReceipt#sentAt` in seconds since the epoch.
- No planned constructor calls an instance method in the call of the constructor of `ScheduledTask`, and each task name has the form `<task>@<cron expression>` that the README of Postbox states.
- The object of `decisions.findings` or the no-step line of `ReminderMailer#formatDueDate` carries the reason `fix apart`, its `says` and `decidedBy` `user` as the decided list gives them.
- A review of the code that the writers write from the model, run with the judge types of `judges.txt`, raises no Prediction Failure on the class of the reminders and no Incomplete Mental Model on the renewal.
- The model adds no type that only holds a list of loans or of recipients and no interface with 1 implementation outside `api` and `spi`; where the design check reports `type-holds-only-a-collection` or `interface-with-one-implementation`, the model answers it under `decisions.scriptCases` with the need that the smaller form cannot hold.
- Each fix of a kept item first moves the step up to its caller or beside it to `LoanDesk`, before it adds a part below.
- A rename of the plan on a name that no item of the run folder, of a shape run or of the decided list names makes the name better; where the design check reports `renamed-without-finding`, the model answers it under `decisions.scriptCases` with 1 line on why the new name is better.
- Each option of a question of the model that adds, removes, merges or splits a class, such as an option for the CSV list of the staff copy, holds its `code`, so the design check reports no `option-without-code` and `design.md` prints the code under the option.
