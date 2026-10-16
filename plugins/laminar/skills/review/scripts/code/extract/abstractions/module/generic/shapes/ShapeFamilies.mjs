export const SHAPE_FAMILIES = Object.freeze([
  Object.freeze({
    name: "api and spi, in and out",
    apiSpi: { api: ["api"], spi: ["spi"] },
    apiSpiBesideTheApp: true,
    inOut: { in: ["in"], out: ["out"] },
  }),
  Object.freeze({
    name: "in and out as api and spi",
    apiSpi: { api: ["in", "inbound", "incoming"], spi: ["out", "outbound", "outgoing"] },
    inOut: { in: ["in", "inbound"], out: ["out", "outbound"] },
  }),
  Object.freeze({
    name: "driving and driven",
    apiSpi: { api: ["driving", "primary"], spi: ["driven", "secondary"] },
    inOut: { in: ["driving"], out: ["driven"] },
    inOutWordsUnderTheParent: { in: ["primary"], out: ["secondary"] },
  }),
  Object.freeze({
    name: "provided and required",
    apiSpi: { api: ["provided"], spi: ["required"] },
    inOut: { in: [], out: [] },
  }),
]);
