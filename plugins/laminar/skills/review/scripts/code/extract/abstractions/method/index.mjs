import { GraphQLMethodFinder } from "./graphql/GraphQLMethodFinder.mjs";
import { JavaMethodRelationFinder } from "./java/JavaMethodRelationFinder.mjs";
import { KotlinMethodRelationFinder } from "./kotlin/KotlinMethodRelationFinder.mjs";
import { ScalaMethodRelationFinder } from "./scala/ScalaMethodRelationFinder.mjs";
import { TypeScriptMethodRelationFinder } from "./typescript/TypeScriptMethodRelationFinder.mjs";
import { GoMethodRelationFinder } from "./go/GoMethodRelationFinder.mjs";
import { PythonMethodRelationFinder } from "./python/PythonMethodRelationFinder.mjs";
import { CSharpMethodRelationFinder } from "./csharp/CSharpMethodRelationFinder.mjs";
import { RustMethodRelationFinder } from "./rust/RustMethodRelationFinder.mjs";
import { RubyMethodRelationFinder } from "./ruby/RubyMethodRelationFinder.mjs";
import { ErlangMethodRelationFinder } from "./erlang/ErlangMethodRelationFinder.mjs";
import { SchemeMethodRelationFinder } from "./scheme/SchemeMethodRelationFinder.mjs";
import { AdaMethodFinder } from "./ada/AdaMethodFinder.mjs";
import { CppMethodFinder } from "./cpp/CppMethodFinder.mjs";
import { CSharpMethodFinder } from "./csharp/CSharpMethodFinder.mjs";
import { DartMethodFinder } from "./dart/DartMethodFinder.mjs";
import { GoMethodFinder } from "./go/GoMethodFinder.mjs";
import { JavaMethodFinder } from "./java/JavaMethodFinder.mjs";
import { KotlinMethodFinder } from "./kotlin/KotlinMethodFinder.mjs";
import { ObjectiveCMethodFinder } from "./objc/ObjectiveCMethodFinder.mjs";
import { PascalMethodFinder } from "./pascal/PascalMethodFinder.mjs";
import { PhpMethodFinder } from "./php/PhpMethodFinder.mjs";
import { PythonMethodFinder } from "./python/PythonMethodFinder.mjs";
import { RustMethodFinder } from "./rust/RustMethodFinder.mjs";
import { ScalaMethodFinder } from "./scala/ScalaMethodFinder.mjs";
import { SwiftMethodFinder } from "./swift/SwiftMethodFinder.mjs";
import { TypeScriptMethodFinder } from "./typescript/TypeScriptMethodFinder.mjs";
import { TypeScriptJestMethodFinder } from "./typescript/jest/TypeScriptJestMethodFinder.mjs";
import { TypeScriptVitestMethodFinder } from "./typescript/vitest/TypeScriptVitestMethodFinder.mjs";
import { TypeScriptMochaMethodFinder } from "./typescript/mocha/TypeScriptMochaMethodFinder.mjs";
import { TypeScriptNodeTestMethodFinder } from "./typescript/node-test/TypeScriptNodeTestMethodFinder.mjs";
import { AdaMethodRelationFinder } from "./ada/AdaMethodRelationFinder.mjs";
import { BashMethodRelationFinder } from "./bash/BashMethodRelationFinder.mjs";
import { CppMethodRelationFinder } from "./cpp/CppMethodRelationFinder.mjs";
import { DartMethodRelationFinder } from "./dart/DartMethodRelationFinder.mjs";
import { ElixirMethodRelationFinder } from "./elixir/ElixirMethodRelationFinder.mjs";
import { FortranMethodRelationFinder } from "./fortran/FortranMethodRelationFinder.mjs";
import { LuaMethodRelationFinder } from "./lua/LuaMethodRelationFinder.mjs";
import { ObjectiveCMethodRelationFinder } from "./objc/ObjectiveCMethodRelationFinder.mjs";
import { PascalMethodRelationFinder } from "./pascal/PascalMethodRelationFinder.mjs";
import { PerlMethodRelationFinder } from "./perl/PerlMethodRelationFinder.mjs";
import { PhpMethodRelationFinder } from "./php/PhpMethodRelationFinder.mjs";
import { SqlMethodRelationFinder } from "./sql/SqlMethodRelationFinder.mjs";
import { SwiftMethodRelationFinder } from "./swift/SwiftMethodRelationFinder.mjs";
import { JvmMethodRoleFinder } from "./jvm/JvmMethodRoleFinder.mjs";
import { ScalaMethodRoleFinder } from "./scala/ScalaMethodRoleFinder.mjs";
import { TypeScriptMethodRoleFinder } from "./typescript/TypeScriptMethodRoleFinder.mjs";
import { GoMethodRoleFinder } from "./go/GoMethodRoleFinder.mjs";
import { PythonMethodRoleFinder } from "./python/PythonMethodRoleFinder.mjs";
import { RustMethodRoleFinder } from "./rust/RustMethodRoleFinder.mjs";
import { JvmSpringMethodRoleFinder } from "./jvm/spring/JvmSpringMethodRoleFinder.mjs";
import { JvmJakartaMethodRoleFinder } from "./jvm/jakarta/JvmJakartaMethodRoleFinder.mjs";
import { JvmMockitoMethodRoleFinder } from "./jvm/mockito/JvmMockitoMethodRoleFinder.mjs";
import { TypeScriptNestjsMethodRoleFinder } from "./typescript/nestjs/TypeScriptNestjsMethodRoleFinder.mjs";
import { TypeScriptJestMethodRoleFinder } from "./typescript/jest/TypeScriptJestMethodRoleFinder.mjs";
import { TypeScriptVitestMethodRoleFinder } from "./typescript/vitest/TypeScriptVitestMethodRoleFinder.mjs";
import { PythonFastapiMethodRoleFinder } from "./python/fastapi/PythonFastapiMethodRoleFinder.mjs";
import { PythonFlaskMethodRoleFinder } from "./python/flask/PythonFlaskMethodRoleFinder.mjs";
import { PythonMockMethodRoleFinder } from "./python/mock/PythonMockMethodRoleFinder.mjs";
import { CSharpMoqMethodRoleFinder } from "./csharp/moq/CSharpMoqMethodRoleFinder.mjs";
import { CSharpNSubstituteMethodRoleFinder } from "./csharp/nsubstitute/CSharpNSubstituteMethodRoleFinder.mjs";
import { CSharpMethodRoleFinder } from "./csharp/CSharpMethodRoleFinder.mjs";
import { CSharpMstestMethodRoleFinder } from "./csharp/mstest/CSharpMstestMethodRoleFinder.mjs";
import { CSharpNunitMethodRoleFinder } from "./csharp/nunit/CSharpNunitMethodRoleFinder.mjs";
import { CSharpXunitMethodRoleFinder } from "./csharp/xunit/CSharpXunitMethodRoleFinder.mjs";
import { GoTestingMethodRoleFinder } from "./go/testing/GoTestingMethodRoleFinder.mjs";
import { JavaMethodRoleFinder } from "./java/JavaMethodRoleFinder.mjs";
import { JvmGuavaMethodRoleFinder } from "./jvm/guava/JvmGuavaMethodRoleFinder.mjs";
import { JvmJunitMethodRoleFinder } from "./jvm/junit/JvmJunitMethodRoleFinder.mjs";
import { JvmTestngMethodRoleFinder } from "./jvm/testng/JvmTestngMethodRoleFinder.mjs";
import { JvmPowermockMethodRoleFinder } from "./jvm/powermock/JvmPowermockMethodRoleFinder.mjs";
import { PythonPytestMockMethodRoleFinder } from "./python/pytest-mock/PythonPytestMockMethodRoleFinder.mjs";
import { PythonPytestMethodRoleFinder } from "./python/pytest/PythonPytestMethodRoleFinder.mjs";
import { PythonUnittestMethodRoleFinder } from "./python/unittest/PythonUnittestMethodRoleFinder.mjs";
import { TypeScriptMochaMethodRoleFinder } from "./typescript/mocha/TypeScriptMochaMethodRoleFinder.mjs";
import { GenericMethodFinder } from "./generic/GenericMethodFinder.mjs";
import { GenericMethodRelationFinder } from "./generic/GenericMethodRelationFinder.mjs";
import { CSharpCallEffects } from "./csharp/calls/CSharpCallEffects.mjs";
import { ErlangCallEffects } from "./erlang/calls/ErlangCallEffects.mjs";
import { GoCallEffects } from "./go/calls/GoCallEffects.mjs";
import { JavaCallEffects } from "./java/calls/JavaCallEffects.mjs";
import { KotlinCallEffects } from "./kotlin/calls/KotlinCallEffects.mjs";
import { PythonCallEffects } from "./python/calls/PythonCallEffects.mjs";
import { RubyCallEffects } from "./ruby/calls/RubyCallEffects.mjs";
import { RustCallEffects } from "./rust/calls/RustCallEffects.mjs";
import { ScalaCallEffects } from "./scala/calls/ScalaCallEffects.mjs";
import { SchemeCallEffects } from "./scheme/calls/SchemeCallEffects.mjs";
import { TypeScriptCallEffects } from "./typescript/calls/TypeScriptCallEffects.mjs";
import { GenericCallEffects } from "./generic/calls/GenericCallEffects.mjs";
import { Scale } from "../../../graph/abstractions/Scale.mjs";
import { FinderRegistry } from "../../finders/FinderRegistry.mjs";

export const METHOD_FINDER_REGISTRY = new FinderRegistry({
  scale: Scale.METHOD,
  finders: [
    AdaMethodFinder,
    CppMethodFinder,
    CSharpMethodFinder,
    DartMethodFinder,
    GoMethodFinder,
    JavaMethodFinder,
    KotlinMethodFinder,
    ObjectiveCMethodFinder,
    PascalMethodFinder,
    PhpMethodFinder,
    PythonMethodFinder,
    RustMethodFinder,
    ScalaMethodFinder,
    SwiftMethodFinder,
    TypeScriptMethodFinder,
    TypeScriptJestMethodFinder,
    TypeScriptVitestMethodFinder,
    TypeScriptMochaMethodFinder,
    TypeScriptNodeTestMethodFinder,
    GraphQLMethodFinder,
  ],
  generic: GenericMethodFinder,
  genericRelationFinder: GenericMethodRelationFinder,
  relationFinders: [
    JavaMethodRelationFinder,
    KotlinMethodRelationFinder,
    ScalaMethodRelationFinder,
    TypeScriptMethodRelationFinder,
    GoMethodRelationFinder,
    PythonMethodRelationFinder,
    CSharpMethodRelationFinder,
    RustMethodRelationFinder,
    RubyMethodRelationFinder,
    ErlangMethodRelationFinder,
    SchemeMethodRelationFinder,
    AdaMethodRelationFinder,
    BashMethodRelationFinder,
    CppMethodRelationFinder,
    DartMethodRelationFinder,
    ElixirMethodRelationFinder,
    FortranMethodRelationFinder,
    LuaMethodRelationFinder,
    ObjectiveCMethodRelationFinder,
    PascalMethodRelationFinder,
    PerlMethodRelationFinder,
    PhpMethodRelationFinder,
    SqlMethodRelationFinder,
    SwiftMethodRelationFinder,
  ],
  roleFinders: [
    JvmMethodRoleFinder,
    ScalaMethodRoleFinder,
    TypeScriptMethodRoleFinder,
    GoMethodRoleFinder,
    PythonMethodRoleFinder,
    RustMethodRoleFinder,
    JvmSpringMethodRoleFinder,
    JvmJakartaMethodRoleFinder,
    JvmMockitoMethodRoleFinder,
    TypeScriptNestjsMethodRoleFinder,
    TypeScriptJestMethodRoleFinder,
    TypeScriptVitestMethodRoleFinder,
    PythonFastapiMethodRoleFinder,
    PythonFlaskMethodRoleFinder,
    PythonMockMethodRoleFinder,
    CSharpMoqMethodRoleFinder,
    CSharpNSubstituteMethodRoleFinder,
    CSharpMethodRoleFinder,
    CSharpMstestMethodRoleFinder,
    CSharpNunitMethodRoleFinder,
    CSharpXunitMethodRoleFinder,
    GoTestingMethodRoleFinder,
    JavaMethodRoleFinder,
    JvmGuavaMethodRoleFinder,
    JvmJunitMethodRoleFinder,
    JvmTestngMethodRoleFinder,
    JvmPowermockMethodRoleFinder,
    PythonPytestMockMethodRoleFinder,
    PythonPytestMethodRoleFinder,
    PythonUnittestMethodRoleFinder,
    TypeScriptMochaMethodRoleFinder,
  ],
});

const createCallEffects = CallEffects => Object.freeze(new CallEffects());

export const GENERIC_CALL_EFFECTS = createCallEffects(GenericCallEffects);

const CALL_EFFECTS_OF_EACH_LANGUAGE = [
  CSharpCallEffects,
  ErlangCallEffects,
  GoCallEffects,
  JavaCallEffects,
  KotlinCallEffects,
  PythonCallEffects,
  RubyCallEffects,
  RustCallEffects,
  ScalaCallEffects,
  SchemeCallEffects,
  TypeScriptCallEffects,
];

export const LANGUAGE_CALL_EFFECTS = Object.freeze(CALL_EFFECTS_OF_EACH_LANGUAGE.map(createCallEffects));
