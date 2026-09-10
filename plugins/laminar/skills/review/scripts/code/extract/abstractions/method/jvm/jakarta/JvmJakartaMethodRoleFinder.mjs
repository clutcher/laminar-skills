import { GenericMethodRoleFinder } from "../../generic/GenericMethodRoleFinder.mjs";
import { OutboundIo } from "../../generic/outside/OutboundIo.mjs";

const REQUEST_METHOD_PATTERN = /RequestMethod\.(\w+)/;

export class JvmJakartaMethodRoleFinder extends GenericMethodRoleFinder {
  family = "jvm";
  framework = "jakarta";
  dependencyLinePatterns = [/\b(?:jakarta|javax)\.(?:ws\.rs|servlet|websocket|persistence|jms)\b/, /\bjersey\b/, /\bresteasy\b/];
  frameworkMarkPatterns = [/^\s*import\s+(?:static\s+)?(?:jakarta|javax)\.(?:ws\.rs|servlet|websocket|persistence|jms)\./, /^\s*@(?:Path|WebServlet|ServerEndpoint|GET|POST|PUT|DELETE|PATCH)\b/];
  methodMapping = /^\s*@Path\b/;
  bareVerb = /^\s*@(GET|POST|PUT|DELETE|PATCH)\b/;
  outboundIo = new OutboundIo({ exitModules: ["javax.persistence", "jakarta.persistence", "javax.jms", "jakarta.jms"] });

  readVerb(text) {
    return (REQUEST_METHOD_PATTERN.exec(text) || [])[1] || "";
  }
}
