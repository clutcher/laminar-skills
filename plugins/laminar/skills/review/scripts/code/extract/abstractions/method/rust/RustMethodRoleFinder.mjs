import { GenericMethodRoleFinder } from "../generic/GenericMethodRoleFinder.mjs";
import { OutboundIo } from "../generic/outside/OutboundIo.mjs";
import { TestCodeMarks } from "../generic/testing/TestCodeMarks.mjs";

export class RustMethodRoleFinder extends GenericMethodRoleFinder {
  language = "rust";
  outboundIo = new OutboundIo({ exitModules: ["std::fs", "std::net", "std::io", "std::process", "std::env", "std::os", "tokio::fs", "tokio::net", "tokio::process", "reqwest", "hyper", "sqlx", "diesel", "sea_orm", "mongodb", "redis", "rdkafka", "lapin", "aws_sdk", "tonic"] });
  testCodeMarks = new TestCodeMarks({
    inlineTestForm: Object.freeze({
      testModule: /^\s*#\[cfg\(test\)\]/,
      testFunction: /^\s*#\[(?:[A-Za-z_]\w*::)*test\b/,
      functionName: /\bfn\s+([A-Za-z_]\w*)/,
    }),
    testOpeners: [/#\[(?:[A-Za-z_]\w*::)*test\b/],
  });
}
