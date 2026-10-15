import { GenericDriver } from "./generic/GenericDriver.mjs";
import { GraphQLDriver } from "../languages/graphql/GraphQLDriver.mjs";
import { ProseDriver } from "./generic/ProseDriver.mjs";
import { KeyTreeDriver } from "./generic/KeyTreeDriver.mjs";
import { DIFF_DRIVER_BY_EXTENSION_MAP, findDiffDriver, readExtension, findLanguage } from "../Languages.mjs";

export { findDiffDriver, readExtension, isOfTheFamilyOf, readLanguageFamily } from "../Languages.mjs";

const GRAPHQL = "graphql";

const chooseDriverClass = diffDriver => {
  if (diffDriver === GRAPHQL) return GraphQLDriver;
  if (findLanguage(diffDriver).holdsKeyTrees) return KeyTreeDriver;
  return findLanguage(diffDriver).holdsProse ? ProseDriver : GenericDriver;
};

const driverByDiffDriverMap = new Map();

export const findDriver = filePath => findDriverForExtension(readExtension(filePath));

export const holdsProseAt = filePath => Boolean(findDriver(filePath)?.holdsProse);

export const holdsKeyTreesAt = filePath => Boolean(findDriver(filePath)?.holdsKeyTrees);

export const holdsCodeAt = filePath => {
  const diffDriver = findDiffDriver(filePath);
  return Boolean(findDriver(filePath)) && !holdsProseAt(filePath) && !holdsKeyTreesAt(filePath) && !(diffDriver && findLanguage(diffDriver).holdsPresentationOnly);
};

export const isATypesOnlyFile = filePath => Boolean(findDriver(filePath)?.fileHoldsTypesOnly);

export const isAFileWithBehavior = filePath => Boolean(findDriver(filePath)) && !findDriver(filePath).fileHoldsTypesOnly && !findDriver(filePath).holdsKeyTrees;

export function findDriverForExtension(extension) {
  const diffDriver = DIFF_DRIVER_BY_EXTENSION_MAP[String(extension).toLowerCase()];
  if (!diffDriver) return null;
  if (!driverByDiffDriverMap.has(diffDriver)) {
    const Driver = chooseDriverClass(diffDriver);
    driverByDiffDriverMap.set(diffDriver, new Driver(diffDriver));
  }
  return driverByDiffDriverMap.get(diffDriver);
}
