const createStrategies = Strategies => Object.freeze(Strategies.map(Strategy => Object.freeze(new Strategy())));

const createStrategyWhenGiven = Strategy => (Strategy ? Object.freeze(new Strategy()) : null);

export class FinderRegistry {
  #foundByKeyMap = new Map();

  constructor({ scale, finders = [], relationFinders = [], roleFinders = [], shapeFinders = [], generic = null, genericRelationFinder = null, genericRoleFinder = null }) {
    this.scale = scale;
    this.finders = createStrategies(finders);
    this.generic = createStrategyWhenGiven(generic);
    this.relationFinders = createStrategies(relationFinders);
    this.genericRelationFinder = createStrategyWhenGiven(genericRelationFinder);
    this.roleFinders = createStrategies(roleFinders);
    this.genericRoleFinder = createStrategyWhenGiven(genericRoleFinder);
    this.shapeFinders = createStrategies(shapeFinders);
    Object.freeze(this);
  }

  listEveryStrategy() {
    return [...this.finders, ...this.relationFinders, ...this.roleFinders, ...this.shapeFinders];
  }

  findFinder(context) {
    return this.#remember(`finder|${context.key}`, () => this.finders.find(finder => finder.appliesTo(context)) || null);
  }

  findFinders(context) {
    return this.#remember(`finders|${context.key}`, () => Object.freeze(this.finders.filter(finder => finder.appliesTo(context))));
  }

  findFrameworkFinders(context) {
    return this.#remember(`frameworks|${context.key}`, () => Object.freeze(this.finders.filter(finder => finder.framework && finder.appliesTo(context))));
  }

  findWalkingFinder(context) {
    return this.findFinder(context) || this.generic;
  }

  findRelationFinder(context) {
    return this.#remember(`relation|${context.key}`, () => this.relationFinders.find(finder => finder.appliesTo(context)) || this.genericRelationFinder);
  }

  findRelationFinders(context) {
    return this.#remember(`relations|${context.key}`, () => Object.freeze(this.relationFinders.filter(finder => finder.appliesTo(context))));
  }

  findRoleFinders(context) {
    return this.#remember(`role|${context.key}`, () => Object.freeze(this.roleFinders.filter(finder => finder.appliesTo(context))));
  }

  #remember(key, find) {
    if (!this.#foundByKeyMap.has(key)) this.#foundByKeyMap.set(key, find());
    return this.#foundByKeyMap.get(key);
  }
}
