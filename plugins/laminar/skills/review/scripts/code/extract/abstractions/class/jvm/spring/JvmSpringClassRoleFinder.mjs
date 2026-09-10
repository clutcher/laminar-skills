import { GenericClassRoleFinder } from "../../generic/GenericClassRoleFinder.mjs";

export class JvmSpringClassRoleFinder extends GenericClassRoleFinder {
  family = "jvm";
  framework = "spring";
  entryBoundaryMarks = /^\s*@(RestController|Controller|(Get|Post|Put|Delete|Patch|Request)Mapping|(Query|Mutation|Schema|Subscription)Mapping|MessageMapping|KafkaListener|RabbitListener|JmsListener|Scheduled)\b/;
  typeMapping = /^\s*@RequestMapping\b/;
  applicationMark = /^\s*@(?:[\w.]+\.)?SpringBootApplication\b/;
}
