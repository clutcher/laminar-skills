import { GraphQLClassFinder } from "./graphql/GraphQLClassFinder.mjs";
import { KeyTreeClassFinder } from "./keytree/KeyTreeClassFinder.mjs";
import { JavaClassFinder } from "./java/JavaClassFinder.mjs";
import { KotlinClassFinder } from "./kotlin/KotlinClassFinder.mjs";
import { CSharpClassFinder } from "./csharp/CSharpClassFinder.mjs";
import { ScalaClassFinder } from "./scala/ScalaClassFinder.mjs";
import { SwiftClassFinder } from "./swift/SwiftClassFinder.mjs";
import { TypeScriptClassFinder } from "./typescript/TypeScriptClassFinder.mjs";
import { PythonClassFinder } from "./python/PythonClassFinder.mjs";
import { GoClassFinder } from "./go/GoClassFinder.mjs";
import { RustClassFinder } from "./rust/RustClassFinder.mjs";
import { ObjectiveCClassFinder } from "./objc/ObjectiveCClassFinder.mjs";
import { PerlClassFinder } from "./perl/PerlClassFinder.mjs";
import { GoClassRelationFinder } from "./go/GoClassRelationFinder.mjs";
import { PythonClassRelationFinder } from "./python/PythonClassRelationFinder.mjs";
import { JvmSpringClassRoleFinder } from "./jvm/spring/JvmSpringClassRoleFinder.mjs";
import { JvmJakartaClassRoleFinder } from "./jvm/jakarta/JvmJakartaClassRoleFinder.mjs";
import { TypeScriptNestjsClassRoleFinder } from "./typescript/nestjs/TypeScriptNestjsClassRoleFinder.mjs";
import { PythonFlaskClassRoleFinder } from "./python/flask/PythonFlaskClassRoleFinder.mjs";
import { GenericClassFinder } from "./generic/GenericClassFinder.mjs";
import { GenericClassRelationFinder } from "./generic/GenericClassRelationFinder.mjs";
import { GenericClassRoleFinder } from "./generic/GenericClassRoleFinder.mjs";
import { Scale } from "../../../graph/abstractions/Scale.mjs";
import { FinderRegistry } from "../../finders/FinderRegistry.mjs";

export const CLASS_FINDER_REGISTRY = new FinderRegistry({
  scale: Scale.CLASS,
  finders: [
    JavaClassFinder,
    KotlinClassFinder,
    CSharpClassFinder,
    ScalaClassFinder,
    SwiftClassFinder,
    TypeScriptClassFinder,
    PythonClassFinder,
    GoClassFinder,
    RustClassFinder,
    ObjectiveCClassFinder,
    PerlClassFinder,
    GraphQLClassFinder,
    KeyTreeClassFinder,
  ],
  generic: GenericClassFinder,
  genericRelationFinder: GenericClassRelationFinder,
  genericRoleFinder: GenericClassRoleFinder,
  relationFinders: [
    PythonClassRelationFinder,
    GoClassRelationFinder,
  ],
  roleFinders: [
    JvmSpringClassRoleFinder,
    JvmJakartaClassRoleFinder,
    TypeScriptNestjsClassRoleFinder,
    PythonFlaskClassRoleFinder,
  ],
});
