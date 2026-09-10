import { GenericMethodRoleFinder } from "../generic/GenericMethodRoleFinder.mjs";
import { OutboundIo } from "../generic/outside/OutboundIo.mjs";

export class ScalaMethodRoleFinder extends GenericMethodRoleFinder {
  language = "scala";
  outboundIo = new OutboundIo({ exitModules: ["scala.io", "slick", "doobie", "sttp", "akka.http"] });
}
