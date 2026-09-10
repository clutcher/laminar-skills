import { JavaModuleFinder } from "./java/JavaModuleFinder.mjs";
import { KotlinModuleFinder } from "./kotlin/KotlinModuleFinder.mjs";
import { TypeScriptModuleFinder } from "./typescript/TypeScriptModuleFinder.mjs";
import { PythonModuleFinder } from "./python/PythonModuleFinder.mjs";
import { GoModuleFinder } from "./go/GoModuleFinder.mjs";
import { RustModuleFinder } from "./rust/RustModuleFinder.mjs";
import { CSharpModuleFinder } from "./csharp/CSharpModuleFinder.mjs";
import { CppModuleFinder } from "./cpp/CppModuleFinder.mjs";
import { GoModuleRelationFinder } from "./go/GoModuleRelationFinder.mjs";
import { PythonModuleRelationFinder } from "./python/PythonModuleRelationFinder.mjs";
import { TypeScriptModuleRelationFinder } from "./typescript/TypeScriptModuleRelationFinder.mjs";
import { ScalaModuleRelationFinder } from "./scala/ScalaModuleRelationFinder.mjs";
import { RustModuleRelationFinder } from "./rust/RustModuleRelationFinder.mjs";
import { PhpModuleRelationFinder } from "./php/PhpModuleRelationFinder.mjs";
import { CSharpModuleRelationFinder } from "./csharp/CSharpModuleRelationFinder.mjs";
import { JvmModuleRelationFinder } from "./jvm/JvmModuleRelationFinder.mjs";
import { JvmSpringModuleRelationFinder } from "./jvm/spring/JvmSpringModuleRelationFinder.mjs";
import { JvmSpringModuleFinder } from "./jvm/spring/JvmSpringModuleFinder.mjs";
import { JvmSpringModulithModuleFinder } from "./jvm/spring-modulith/JvmSpringModulithModuleFinder.mjs";
import { JvmSpringModulithModuleRoleFinder } from "./jvm/spring-modulith/JvmSpringModulithModuleRoleFinder.mjs";
import { GenericModuleFinder } from "./generic/GenericModuleFinder.mjs";
import { GenericModuleRelationFinder } from "./generic/GenericModuleRelationFinder.mjs";
import { GenericHexagonalShapeFinder } from "./generic/shapes/GenericHexagonalShapeFinder.mjs";
import { Scale } from "../../../graph/abstractions/Scale.mjs";
import { FinderRegistry } from "../../finders/FinderRegistry.mjs";

export const MODULE_FINDER_REGISTRY = new FinderRegistry({
  scale: Scale.MODULE,
  finders: [
    JavaModuleFinder,
    KotlinModuleFinder,
    TypeScriptModuleFinder,
    PythonModuleFinder,
    GoModuleFinder,
    RustModuleFinder,
    CSharpModuleFinder,
    CppModuleFinder,
    JvmSpringModuleFinder,
    JvmSpringModulithModuleFinder,
  ],
  generic: GenericModuleFinder,
  relationFinders: [
    GoModuleRelationFinder,
    PythonModuleRelationFinder,
    TypeScriptModuleRelationFinder,
    ScalaModuleRelationFinder,
    RustModuleRelationFinder,
    PhpModuleRelationFinder,
    CSharpModuleRelationFinder,
    JvmModuleRelationFinder,
    JvmSpringModuleRelationFinder,
  ],
  genericRelationFinder: GenericModuleRelationFinder,
  roleFinders: [
    JvmSpringModulithModuleRoleFinder,
  ],
  shapeFinders: [
    GenericHexagonalShapeFinder,
  ],
});
