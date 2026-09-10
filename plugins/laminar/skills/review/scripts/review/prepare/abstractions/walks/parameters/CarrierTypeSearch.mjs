import { readLanguageFamily } from "../../../../../code/index.mjs";
import { groupBy } from "../../../../../collections/groupedLists.mjs";

const readCarriedMember = (construction, carrierMembers) => (construction.name && carrierMembers.includes(construction.name)
  ? construction.name
  : carrierMembers[construction.position] || "");

const matchCalledByAny = operations => {
  const called = new Set(operations.flatMap(operation => operation.called.map(id => `${operation.family}:${id}`)));
  return operation => called.has(`${operation.family}:${operation.id}`);
};

const dropRepeatedReadPlaces = places => places.filter((place, index) => places.findIndex(other => other.path === place.path && other.line === place.line && other.member === place.member) === index);

const groupByCarrierTypeName = carriedPlaces => groupBy(carriedPlaces, carriedPlace => carriedPlace.construction.typeName);

const findMembersReadAfterCarrying = (carrier, carried, operations) => {
  const carriedNames = carried.map(item => item.as);
  return carrier.members.filter(member => carriedNames.includes(member) && operations.some(operation => operation.reads.includes(member)));
};

export class CarrierTypeSearch {
  constructor(parameterReads, typeAbstractions) {
    this.reads = parameterReads;
    this.typeAbstractions = typeAbstractions;
  }

  findCarriedPlaces(type, added) {
    const places = type.operations.flatMap(operation => operation.readPlaces).filter(place => added.includes(place.member));
    return dropRepeatedReadPlaces(places).map(place => ({ place, construction: this.reads.findTheConstructionOfTheRead(place) })).filter(carriedPlace => carriedPlace.construction && carriedPlace.construction.typeName !== type.name);
  }

  findCarriers(type, added) {
    const reachedFromTheType = matchCalledByAny(type.operations);
    return [...groupByCarrierTypeName(this.findCarriedPlaces(type, added))]
      .map(([name, carriedPlaces]) => this.buildTheCarrier(name, carriedPlaces, reachedFromTheType))
      .filter(Boolean);
  }

  buildTheCarrier(name, carriedPlaces, reachedFromTheType) {
    const carrier = this.typeAbstractions.findProductionTypeNamed(name, readLanguageFamily(carriedPlaces[0].place.path));
    if (!carrier) return null;
    const carried = carriedPlaces.map(({ place, construction }) => ({ member: place.member, as: readCarriedMember(construction, carrier.members), path: place.path, line: place.line }))
      .filter(item => item.as);
    if (!carried.length) return null;
    const operations = this.reads.findOperations(carrier.name, carrier.members).filter(reachedFromTheType);
    return { ...carrier, carried, operations, readAfterCarrying: findMembersReadAfterCarrying(carrier, carried, operations) };
  }
}
