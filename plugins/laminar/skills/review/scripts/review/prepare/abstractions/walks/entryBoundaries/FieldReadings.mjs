import { Scale } from "../../../../../code/index.mjs";

const READ_SCALES = new Set([Scale.VARIABLE.name, Scale.CLASS.name]);

const readFieldDisplayNames = abstraction => (abstraction.fields ? abstraction.fields.map(field => field.displayName) : [abstraction.displayName]);

export class FieldReadings {
  constructor(readings) {
    this.readings = readings;
    this.readingByDisplayNameMap = new Map(readings.map(reading => [reading.displayName, reading]));
  }

  findFieldReadings(abstraction) {
    if (!READ_SCALES.has(abstraction.scale)) return [];
    if (abstraction.scale === Scale.CLASS.name) return this.readings.filter(reading => reading.enclosingTypeDisplayName === abstraction.displayName && reading.path === abstraction.path);
    return readFieldDisplayNames(abstraction).map(displayName => this.readingByDisplayNameMap.get(displayName)).filter(reading => reading && reading.path === abstraction.path);
  }
}
