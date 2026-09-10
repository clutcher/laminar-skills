export class Strategy {
  constructor(scale) {
    this.scale = scale;
    this.language = null;
    this.family = null;
    this.framework = null;
  }

  get name() {
    return this.constructor.name;
  }

  appliesTo(context) {
    return context.admits(this);
  }
}
