import path from "node:path";
import { AdaLanguage } from "./languages/ada/AdaLanguage.mjs";
import { BashLanguage } from "./languages/bash/BashLanguage.mjs";
import { BibtexLanguage } from "./languages/bibtex/BibtexLanguage.mjs";
import { CppLanguage } from "./languages/cpp/CppLanguage.mjs";
import { CSharpLanguage } from "./languages/csharp/CSharpLanguage.mjs";
import { CssLanguage } from "./languages/css/CssLanguage.mjs";
import { DtsLanguage } from "./languages/dts/DtsLanguage.mjs";
import { ElixirLanguage } from "./languages/elixir/ElixirLanguage.mjs";
import { FortranLanguage } from "./languages/fortran/FortranLanguage.mjs";
import { GoLanguage } from "./languages/go/GoLanguage.mjs";
import { GraphQLLanguage } from "./languages/graphql/GraphQLLanguage.mjs";
import { HtmlLanguage } from "./languages/html/HtmlLanguage.mjs";
import { JavaLanguage } from "./languages/java/JavaLanguage.mjs";
import { KotlinLanguage } from "./languages/kotlin/KotlinLanguage.mjs";
import { MarkdownLanguage } from "./languages/markdown/MarkdownLanguage.mjs";
import { ObjectiveCLanguage } from "./languages/objc/ObjectiveCLanguage.mjs";
import { PascalLanguage } from "./languages/pascal/PascalLanguage.mjs";
import { PerlLanguage } from "./languages/perl/PerlLanguage.mjs";
import { PhpLanguage } from "./languages/php/PhpLanguage.mjs";
import { PropertiesLanguage } from "./languages/properties/PropertiesLanguage.mjs";
import { PythonLanguage } from "./languages/python/PythonLanguage.mjs";
import { RubyLanguage } from "./languages/ruby/RubyLanguage.mjs";
import { RustLanguage } from "./languages/rust/RustLanguage.mjs";
import { SchemeLanguage } from "./languages/scheme/SchemeLanguage.mjs";
import { TexLanguage } from "./languages/tex/TexLanguage.mjs";
import { TypeScriptLanguage } from "./languages/typescript/TypeScriptLanguage.mjs";
import { ErlangLanguage } from "./languages/erlang/ErlangLanguage.mjs";
import { DartLanguage } from "./languages/dart/DartLanguage.mjs";
import { LuaLanguage } from "./languages/lua/LuaLanguage.mjs";
import { SwiftLanguage } from "./languages/swift/SwiftLanguage.mjs";
import { ScalaLanguage } from "./languages/scala/ScalaLanguage.mjs";
import { SqlLanguage } from "./languages/sql/SqlLanguage.mjs";
import { YamlLanguage } from "./languages/yaml/YamlLanguage.mjs";

export const LANGUAGES = Object.freeze([
  AdaLanguage,
  BashLanguage,
  BibtexLanguage,
  CppLanguage,
  CSharpLanguage,
  CssLanguage,
  DtsLanguage,
  ElixirLanguage,
  FortranLanguage,
  GoLanguage,
  GraphQLLanguage,
  HtmlLanguage,
  JavaLanguage,
  KotlinLanguage,
  MarkdownLanguage,
  ObjectiveCLanguage,
  PascalLanguage,
  PerlLanguage,
  PhpLanguage,
  PythonLanguage,
  RubyLanguage,
  RustLanguage,
  SchemeLanguage,
  TexLanguage,
  TypeScriptLanguage,
  ErlangLanguage,
  DartLanguage,
  LuaLanguage,
  SwiftLanguage,
  ScalaLanguage,
  SqlLanguage,
  YamlLanguage,
  PropertiesLanguage,
]);

const LANGUAGE_BY_DIFF_DRIVER_MAP = new Map(LANGUAGES.map(language => [language.diffDriver, language]));

const NO_LANGUAGE = Object.freeze({ diffDriver: "", extensions: [], commentForms: null });

export const findLanguage = diffDriver => LANGUAGE_BY_DIFF_DRIVER_MAP.get(diffDriver) || NO_LANGUAGE;

export const DIFF_DRIVER_BY_EXTENSION_MAP = Object.freeze(Object.fromEntries(LANGUAGES
  .flatMap(language => language.extensions.map(extension => [extension, language.diffDriver]))));

export const CUSTOM_PATTERN_BY_DIFF_DRIVER_MAP = Object.freeze(Object.fromEntries(LANGUAGES
  .filter(language => language.functionNamePattern)
  .map(language => [language.diffDriver, language.functionNamePattern])));

export const readExtension = filePath => path.posix.extname(String(filePath)).toLowerCase();

export const findDiffDriver = filePath => DIFF_DRIVER_BY_EXTENSION_MAP[readExtension(filePath)] || null;

export const readFamilyOfLanguage = language => (language ? findLanguage(language).family || language : null);

export const readLanguageFamily = filePath => readFamilyOfLanguage(findDiffDriver(filePath));

export const isOfTheFamilyOf = (filePath, language) => readLanguageFamily(filePath) === readFamilyOfLanguage(language);
