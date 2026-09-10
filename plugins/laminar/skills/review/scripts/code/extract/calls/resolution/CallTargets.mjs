export const MAX_TARGETS_PER_CALL = 4;

export const capTheCallTargets = targets => targets.slice(0, MAX_TARGETS_PER_CALL);

export const fansOutPastTheCap = targets => targets.length > MAX_TARGETS_PER_CALL;

export const readIds = methods => methods.map(method => method.id);

export const collectEveryCallTarget = (declared, implemented) => [...new Set([...declared, ...implemented])];

export const capTheTargetsOfATypeAndItsImplementations = (declared, implemented) => {
  const everyOne = collectEveryCallTarget(declared, implemented);
  return fansOutPastTheCap(everyOne) ? capTheCallTargets(declared) : everyOne;
};
