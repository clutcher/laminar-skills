Implement borrowing and returning in this library lending service:

- A member borrows several books in 1 request, by ISBN. Standard members may hold at most 3 open loans in total, premium members at most 6. A book can be lent only while its open loans are fewer than its copies owned. If any requested book cannot be lent, or the member would pass their limit, the whole request is rejected and nothing is saved, with a reason the caller can show.
- The loan period is 14 days for standard members and 28 for premium members, from today.
- A member returns 1 loan by its id; returning sets the return date to today. Returning a loan that is already returned is rejected.
- Expose both as a REST controller (Spring Web annotations), and write the tests you consider right.
