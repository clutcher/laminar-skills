import { MavenApplicationFinder } from "./maven/MavenApplicationFinder.mjs";
import { GradleApplicationFinder } from "./gradle/GradleApplicationFinder.mjs";
import { NpmApplicationFinder } from "./npm/NpmApplicationFinder.mjs";
import { ComposerApplicationFinder } from "./composer/ComposerApplicationFinder.mjs";
import { PythonApplicationFinder } from "./python/PythonApplicationFinder.mjs";
import { CargoApplicationFinder } from "./cargo/CargoApplicationFinder.mjs";
import { GoApplicationFinder } from "./go/GoApplicationFinder.mjs";
import { BundlerApplicationFinder } from "./bundler/BundlerApplicationFinder.mjs";
import { MixApplicationFinder } from "./mix/MixApplicationFinder.mjs";
import { DotnetApplicationFinder } from "./dotnet/DotnetApplicationFinder.mjs";
import { SbtApplicationFinder } from "./sbt/SbtApplicationFinder.mjs";
import { Scale } from "../../../graph/abstractions/Scale.mjs";
import { FinderRegistry } from "../../finders/FinderRegistry.mjs";
import { readsTheDependenciesOf } from "./generic/dependencies/DependencyFormats.mjs";
import { readFileName } from "../../../../files/paths.mjs";

export const APPLICATION_FINDER_REGISTRY = new FinderRegistry({
  scale: Scale.APPLICATION,
  finders: [
    MavenApplicationFinder,
    GradleApplicationFinder,
    NpmApplicationFinder,
    ComposerApplicationFinder,
    PythonApplicationFinder,
    CargoApplicationFinder,
    GoApplicationFinder,
    BundlerApplicationFinder,
    MixApplicationFinder,
    DotnetApplicationFinder,
    SbtApplicationFinder,
  ],
});

export const findFinderReadingTheFile = filePath => APPLICATION_FINDER_REGISTRY.finders.find(finder => readsTheDependenciesOf(finder, filePath)) || null;

export const findFinderDeclaringTheApplication = rootPath => APPLICATION_FINDER_REGISTRY.finders.find(finder => finder.declaresAnApplicationIn(readFileName(rootPath))) || null;

export const findFinderOfASharedBuildScript = filePath => APPLICATION_FINDER_REGISTRY.finders.find(finder => finder.recognizesTheBuildFile(readFileName(filePath)) && !finder.declaresAnApplicationIn(readFileName(filePath))) || null;

export const isABuildFile =filePath => APPLICATION_FINDER_REGISTRY.finders.some(finder => finder.recognizesTheBuildFile(readFileName(filePath)));
