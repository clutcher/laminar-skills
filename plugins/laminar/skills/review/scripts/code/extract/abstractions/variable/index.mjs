import { GraphQLVariableFinder } from "./graphql/GraphQLVariableFinder.mjs";
import { KeyTreeVariableFinder } from "./keytree/KeyTreeVariableFinder.mjs";
import { JavaVariableFinder } from "./java/JavaVariableFinder.mjs";
import { KotlinVariableFinder } from "./kotlin/KotlinVariableFinder.mjs";
import { ScalaVariableFinder } from "./scala/ScalaVariableFinder.mjs";
import { CSharpVariableFinder } from "./csharp/CSharpVariableFinder.mjs";
import { RustVariableFinder } from "./rust/RustVariableFinder.mjs";
import { GoVariableFinder } from "./go/GoVariableFinder.mjs";
import { SwiftVariableFinder } from "./swift/SwiftVariableFinder.mjs";
import { TypeScriptVariableFinder } from "./typescript/TypeScriptVariableFinder.mjs";
import { PythonVariableFinder } from "./python/PythonVariableFinder.mjs";
import { CppVariableFinder } from "./cpp/CppVariableFinder.mjs";
import { DartVariableFinder } from "./dart/DartVariableFinder.mjs";
import { AdaVariableFinder } from "./ada/AdaVariableFinder.mjs";
import { ObjectiveCVariableFinder } from "./objc/ObjectiveCVariableFinder.mjs";
import { PascalVariableFinder } from "./pascal/PascalVariableFinder.mjs";
import { PhpVariableFinder } from "./php/PhpVariableFinder.mjs";
import { RubyVariableFinder } from "./ruby/RubyVariableFinder.mjs";
import { SwiftVariableRelationFinder } from "./swift/SwiftVariableRelationFinder.mjs";
import { GenericVariableFinder } from "./generic/GenericVariableFinder.mjs";
import { GenericVariableRelationFinder } from "./generic/GenericVariableRelationFinder.mjs";
import { Scale } from "../../../graph/abstractions/Scale.mjs";
import { FinderRegistry } from "../../finders/FinderRegistry.mjs";

export const VARIABLE_FINDER_REGISTRY = new FinderRegistry({
  scale: Scale.VARIABLE,
  finders: [
    JavaVariableFinder,
    KotlinVariableFinder,
    ScalaVariableFinder,
    CSharpVariableFinder,
    RustVariableFinder,
    GoVariableFinder,
    SwiftVariableFinder,
    TypeScriptVariableFinder,
    PythonVariableFinder,
    CppVariableFinder,
    DartVariableFinder,
    AdaVariableFinder,
    ObjectiveCVariableFinder,
    PascalVariableFinder,
    PhpVariableFinder,
    RubyVariableFinder,
    GraphQLVariableFinder,
    KeyTreeVariableFinder,
  ],
  generic: GenericVariableFinder,
  genericRelationFinder: GenericVariableRelationFinder,
  relationFinders: [
    SwiftVariableRelationFinder,
  ],
});
