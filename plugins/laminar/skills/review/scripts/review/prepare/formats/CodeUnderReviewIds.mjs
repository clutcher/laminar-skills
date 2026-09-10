const CODE_UNDER_REVIEW_ID_MARK = "U";

export const createCodeUnderReviewId = number => `${CODE_UNDER_REVIEW_ID_MARK}${number}`;

export const numberCodeUnderReviewFrom = (everyCodeUnderReview, firstNumber) => everyCodeUnderReview.map((codeUnderReview, order) => ({ ...codeUnderReview, id: createCodeUnderReviewId(firstNumber + order) }));
