export class UnionFind {
  constructor() {
    this.parentByKeyMap = new Map();
  }

  findRoot(key) {
    if (!this.parentByKeyMap.has(key)) this.parentByKeyMap.set(key, key);
    let rootKey = key;
    while (this.parentByKeyMap.get(rootKey) !== rootKey) rootKey = this.parentByKeyMap.get(rootKey);
    this.parentByKeyMap.set(key, rootKey);
    return rootKey;
  }

  join(left, right) {
    this.parentByKeyMap.set(this.findRoot(left), this.findRoot(right));
  }

  isJoined(left, right) {
    return this.findRoot(left) === this.findRoot(right);
  }
}
