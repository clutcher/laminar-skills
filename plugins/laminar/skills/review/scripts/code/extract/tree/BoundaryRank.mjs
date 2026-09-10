import { VISIBILITIES } from "./AbstractionTree.mjs";
import { BOUNDARY_RANKS, isAnEntryBoundaryRole, findBoundaryRankOfFolderRoles } from "../../graph/abstractions/Role.mjs";

export function readBoundaryRank(roles, folderRoles, visibility) {
  if (roles.some(isAnEntryBoundaryRole)) return BOUNDARY_RANKS.IN_CODE;
  const byConvention = findBoundaryRankOfFolderRoles(folderRoles);
  if (byConvention) return byConvention;
  return visibility === VISIBILITIES.EXPOSED ? BOUNDARY_RANKS.MODULE_BOUNDARY : BOUNDARY_RANKS.UNKNOWN;
}
