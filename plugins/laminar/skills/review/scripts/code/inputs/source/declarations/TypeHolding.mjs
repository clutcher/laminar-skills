import { Scale } from "../../../graph/abstractions/Scale.mjs";
import { findInnermostHolding, doesSpanHoldLine } from "../../../graph/abstractions/Place.mjs";

export const isATypeDeclaration = declaration => declaration.scale === Scale.CLASS.name;

export const isATypeHoldingTheLine = (declaration, line) => isATypeDeclaration(declaration) && doesSpanHoldLine(declaration.span, line);

const isATypeHoldingTheLineBelowItsHead = (declaration, line) => isATypeHoldingTheLine(declaration, line) && declaration.line < line;

export const findTypeHolding = (declarations, line) => findInnermostHolding(declarations.filter(declaration => isATypeHoldingTheLineBelowItsHead(declaration, line)), line, declaration => declaration.span);
