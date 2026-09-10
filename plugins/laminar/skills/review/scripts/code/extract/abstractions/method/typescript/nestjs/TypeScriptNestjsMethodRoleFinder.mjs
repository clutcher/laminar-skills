import { GenericMethodRoleFinder } from "../../generic/GenericMethodRoleFinder.mjs";
import { OutboundIo } from "../../generic/outside/OutboundIo.mjs";

const NEST_MAPPING_PATTERN = /^\s*@(Get|Post|Put|Delete|Patch|All)\s*\(/;

export class TypeScriptNestjsMethodRoleFinder extends GenericMethodRoleFinder {
  language = "javascript";
  framework = "nestjs";
  dependencyLinePatterns = [/^@nestjs\//];
  frameworkMarkPatterns = [/\bfrom\s+["']@nestjs\//, /\brequire\s*\(\s*["']@nestjs\//];
  methodMapping = NEST_MAPPING_PATTERN;
  outboundIo = new OutboundIo({ exitModules: ["@nestjs/typeorm", "@nestjs/mongoose", "@nestjs/axios"] });

  readVerb(text) {
    return ((NEST_MAPPING_PATTERN.exec(text) || [])[1] || "").toUpperCase();
  }
}
