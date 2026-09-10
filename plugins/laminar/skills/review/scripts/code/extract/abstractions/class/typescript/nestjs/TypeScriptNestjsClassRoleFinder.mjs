import { GenericClassRoleFinder } from "../../generic/GenericClassRoleFinder.mjs";

export class TypeScriptNestjsClassRoleFinder extends GenericClassRoleFinder {
  language = "javascript";
  framework = "nestjs";
  entryBoundaryMarks = /^\s*@(Controller|Resolver|Get|Post|Put|Delete|Patch|All|Sse|Query|Mutation|Subscription|EventPattern|MessagePattern)\s*\(/;
  typeMapping = /^\s*@Controller\s*\(/;
}
