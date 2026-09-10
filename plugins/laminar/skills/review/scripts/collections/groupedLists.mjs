export const appendTo = (listsByKeyMap, key, value) => {
  if (!listsByKeyMap.has(key)) listsByKeyMap.set(key, []);
  listsByKeyMap.get(key).push(value);
};

export const groupBy = (items, keyOf) => {
  const listsByKeyMap = new Map();
  for (const item of items) appendTo(listsByKeyMap, keyOf(item), item);
  return listsByKeyMap;
};
