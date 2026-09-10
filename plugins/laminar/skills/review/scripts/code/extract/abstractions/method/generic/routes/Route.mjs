import { findTextLiterals } from "../../../../../inputs/source/text/TextLiterals.mjs";

const TEMPLATE_EXPRESSION_PATTERN = /\$\{[^}]*\}/g;
const PARAMETER_PATTERN = /^(?:\{[^}]*\}|:\w+|\*)$/;
const PREFIX_WORD_PATTERN = /^(?:api|rest|v\d+)$/i;
const SCHEME_AND_HOST_PATTERN = /^[a-z]+:\/\/[^/]*/i;
const QUERY_AND_FRAGMENT_PATTERN = /[?#].*$/;
const WORD_RUN_PATTERN = /[A-Za-z_$][\w$]*/g;
const ROUTE_PARAMETER_PLACEHOLDER = "{}";

export const MIN_STATIC_SEGMENTS = 2;

export const joinRoute = (...routePieces) => `/${routePieces.map(routePiece => String(routePiece || "").replace(/^\/+|\/+$/g, "")).filter(Boolean).join("/")}`;

export const splitSegments = route => String(route).replace(SCHEME_AND_HOST_PATTERN, "").replace(QUERY_AND_FRAGMENT_PATTERN, "").split("/").filter(Boolean);

export const isAParameter = segment => PARAMETER_PATTERN.test(segment) || segment === ROUTE_PARAMETER_PLACEHOLDER;

export const filterStaticSegments = route => splitSegments(route).filter(segment => !isAParameter(segment));

export const isAReliableRoute = route => filterStaticSegments(route).filter(segment => !PREFIX_WORD_PATTERN.test(segment)).length >= MIN_STATIC_SEGMENTS;

export const searchWordOf = route => filterStaticSegments(route)
  .filter(segment => !PREFIX_WORD_PATTERN.test(segment))
  .flatMap(segment => segment.match(WORD_RUN_PATTERN) || [])
  .reduce((longest, word) => (word.length > longest.length ? word : longest), "");

export const readRouteTextOfTheLiterals = text => findTextLiterals(text)
  .map(literal => literal.text.replace(TEMPLATE_EXPRESSION_PATTERN, ROUTE_PARAMETER_PLACEHOLDER))
  .join(ROUTE_PARAMETER_PLACEHOLDER);

const doesSegmentMatch = (routeSegment, textSegment) => isAParameter(routeSegment) || routeSegment === textSegment;

const countStaticSegments = segments => segments.filter(segment => !isAParameter(segment)).length;

const doesSuffixMatch = (routeSegments, textSegments, from) => {
  const suffix = routeSegments.slice(from);
  const start = textSegments.length - suffix.length;
  return start >= 0 && suffix.every((segment, at) => doesSegmentMatch(segment, textSegments[start + at]));
};

const isSpecificEnough = suffix => countStaticSegments(suffix) >= MIN_STATIC_SEGMENTS;

const findSpecificSuffixStarts = routeSegments => [...routeSegments.keys()].filter(from => isSpecificEnough(routeSegments.slice(from)));

export function callsTheRoute(lineText, route) {
  const routeSegments = splitSegments(route);
  const textSegments = splitSegments(readRouteTextOfTheLiterals(lineText));
  return findSpecificSuffixStarts(routeSegments).some(from => doesSuffixMatch(routeSegments, textSegments, from));
}
