export class ReviewedChange {
  constructor(change = null, extractedReview = null) {
    this.change = change;
    this.extractedReview = extractedReview;
    Object.freeze(this);
  }

  toJSON() {
    return {
      ...(this.change ? { change: this.change } : {}),
      ...(this.extractedReview ? { extractedReview: this.extractedReview } : {}),
    };
  }

  static createFromJSON(saved) {
    return new ReviewedChange(saved.change || null, saved.extractedReview || null);
  }
}
