import { GenericMethodRoleFinder } from "../../generic/GenericMethodRoleFinder.mjs";
import { OutboundIo } from "../../generic/outside/OutboundIo.mjs";
import { TestCodeMarks } from "../../generic/testing/TestCodeMarks.mjs";

const SPRING_MAPPING_PATTERN = /^\s*@(Get|Post|Put|Delete|Patch|Request)Mapping\b/;
const REQUEST_METHOD_PATTERN = /RequestMethod\.(\w+)/;

export class JvmSpringMethodRoleFinder extends GenericMethodRoleFinder {
  family = "jvm";
  framework = "spring";
  dependencyLinePatterns = [/\borg\.springframework\b/];
  frameworkMarkPatterns = [/^\s*import\s+(?:static\s+)?org\.springframework\./, /^\s*@(?:SpringBootApplication|RestController|Controller|Service|Component|Repository|Configuration|(?:Get|Post|Put|Delete|Patch|Request)Mapping|(?:Query|Mutation|Schema|Subscription|Batch)Mapping|MessageMapping|KafkaListener|RabbitListener|JmsListener|Scheduled)\b/];
  methodMapping = SPRING_MAPPING_PATTERN;
  outboundIo = new OutboundIo({ exitModules: ["org.springframework.data", "org.springframework.jdbc", "org.springframework.orm", "org.springframework.transaction", "org.springframework.web.client", "org.springframework.web.reactive.function.client", "org.springframework.kafka", "org.springframework.amqp", "org.springframework.jms", "org.springframework.cloud.openfeign"] });
  testCodeMarks = new TestCodeMarks({ privateMethodsReached: [/\bReflectionTestUtils\.invokeMethod\b/] });
  schemaMapping = /^\s*@\w*Mapping\b/;

  readVerb(text) {
    const word = (SPRING_MAPPING_PATTERN.exec(text) || [])[1] || "";
    return word === "Request" ? (REQUEST_METHOD_PATTERN.exec(text) || [])[1] || "" : word.toUpperCase();
  }
}
