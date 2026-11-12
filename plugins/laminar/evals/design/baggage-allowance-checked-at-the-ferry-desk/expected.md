# baggage-allowance-checked-at-the-ferry-desk

## Level 1

- checkDesign: no defect
- New files: at most 2

## Level 2

- The design model gives the allowance of a fare class 1 owner, in `BoardingPass` or `FareClass`, reached through a method, and `CheckInDesk` calls it and holds no copy of the 2 values.
- The design check of the last model prints no `repeated-table` recheck case that the model cannot answer, and no object of `decisions.scriptCases` answers a `repeated-table` case on the allowance as 2 rules.
- The existing constant `FLEX` of `FareClass` keeps its name; where a shape run keeps an item on it, the model leaves it as `outside the change`, and `design.md` shows it as an existing defect outside the change.
