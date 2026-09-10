export const getOrReadAndRemember = (memo, key, read) => {
  if (!memo.has(key)) memo.set(key, read());
  return memo.get(key);
};

export const getOrReadGuardingReentry = (memo, key, placeholder, read) => {
  if (memo.has(key)) return memo.get(key);
  memo.set(key, placeholder);
  const found = read();
  memo.set(key, found);
  return found;
};
