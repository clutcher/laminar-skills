# Plan: a member renews a loan at the web entry

A member renews 1 loan they hold, with a call to the web entry of the lending library. The renewal reuses the rule of renewal that `Loan#renew` already holds: the due date moves by 14 days, and a loan on hold for another member is not renewed. After a renewal, the member gets 1 mail with the new due date.

## The call

- `POST /members/{memberId}/loans/{loanId}/renewals`, with no body.
- A renewal answers the status 200 with a JSON body of 2 fields: `loanId`, the id of the renewed loan, and `newDueDate`, the new due date in the form `yyyy-MM-dd`. The answer holds nothing of the mail.

## The rules, in the order they are checked

1. No member has the id `memberId`: the status 404, as the loans of a member answer today, with the detail `no member has the id <memberId>`.
2. The member holds no loan with the id `loanId`: the status 404, with the detail `member <memberId> holds no loan with the id <loanId>`.
3. The loan is on hold for another member: the status 409, with the detail of the existing `LoanOnHoldException`, `loan <loanId> is on hold for another member`.
4. The member owes fines of 10.00 or more, by the sum that `FineStatement#sumOwedAmount` gives: the status 422, with the detail `member <memberId> owes fines of <owed amount>, and a renewal needs less than 10.00`. A member who owes 9.99 renews.
5. The loan was already renewed 2 times: the status 422, with the detail `loan <loanId> was renewed 2 times, the most a loan allows`. A loan renewed 1 time renews.

Each refusal answers a problem detail, as the loans of a member answer today, and changes no loan. A loan counts its renewals: a loan in the stores today counts 0, and each renewal adds 1.

## The mail

- After the renewal is stored, the member gets 1 mail at the address in the field `email` of `Member`, through `PostboxClient#send`, with the subject `Your loan is renewed` and the body `<item title> is now due on <new due date as yyyy-MM-dd>.`.
- Where `PostboxClient#send` throws `PostboxUnavailable`, the renewal stays stored, no second attempt is made, the renewal logs the failure as a warning, and the call answers 200 with the same body as a renewal with the mail sent.

## The tests

1 integration test per answer, through the web entry with `MockMvc`, with a substitute of the Postbox client past the exit boundary: a renewal with the mail sent, a renewal with the mail not sent, an unknown member, a loan the member does not hold, a loan on hold, fines of 10.00 or more, and a loan renewed 2 times. The test of a renewal checks the new due date in the answer, and the test of the mail sent checks the recipient, the subject and the body that the Postbox client received.
