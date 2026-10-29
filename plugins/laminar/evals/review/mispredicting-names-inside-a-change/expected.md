# mispredicting-names-inside-a-change

## Simplicity

### Production code

1. Variable `noticesWithoutRefundOnFailedVoucher` in `QuoteNoticeService#resolveLineNotices`
   - Prediction Failure
2. Variable `voucherFailed` in `QuoteNoticeService#suppressMemberRefundWhenVoucherFailed`
   - Prediction Failure
3. Class `QuoteNotice.VoucherPricingFailed` used bare in `QuoteNoticeService#suppressMemberRefundWhenVoucherFailed`
   - Prediction Failure
4. Class `QuoteNotice.MemberRefundApplied` used bare in `QuoteNoticeService#suppressMemberRefundWhenVoucherFailed`
   - Prediction Failure

### Test code

5. Method `shouldExposeOnlyTheInvalidVoucherMessageWhenTheBookingSystemAlsoReportsMemberRefundForTheLine` in `StayQuoteGraphQLControllerMessagesTest`
   - Prediction Failure

## Must not appear

Class `QuoteNoticeService`, Compression Failure
Class `QuoteNoticeService`, Unnamed Part Failure
Method `shouldReportOnlyTheInvalidVoucherWhenTheBookingSystemReportsItBeforeTheMemberRefund` in `QuoteNoticeServiceTest`, Prediction Failure
Class `QuoteNoticeService`, Unit Test Needed
Class `QuoteNoticeService`, Integration Test Needed
Class `QuoteNoticeServiceTest`, Unit Test to Remove
