import { GenericMethodRoleFinder } from "../generic/GenericMethodRoleFinder.mjs";
import { OutboundIo } from "../generic/outside/OutboundIo.mjs";
import { TestCodeMarks } from "../generic/testing/TestCodeMarks.mjs";

export class TypeScriptMethodRoleFinder extends GenericMethodRoleFinder {
  language = "javascript";
  outboundIo = new OutboundIo({
    exitModules: ["fs", "fs/promises", "net", "http", "https", "http2", "dgram", "child_process", "dns", "tls", "cluster", "worker_threads", "node:fs", "node:fs/promises", "node:net", "node:http", "node:https", "node:http2", "node:dgram", "node:child_process", "node:dns", "node:tls", "axios", "node-fetch", "got", "superagent", "undici", "ky", "pg", "mysql", "mysql2", "sqlite3", "better-sqlite3", "mongodb", "mongoose", "redis", "ioredis", "typeorm", "sequelize", "knex", "@prisma/client", "prisma", "drizzle-orm", "kafkajs", "amqplib", "@aws-sdk", "aws-sdk", "@google-cloud", "@grpc/grpc-js", "@elastic/elasticsearch"],
    globalCallees: ["fetch"],
  });
  testCodeMarks = new TestCodeMarks({ privateMethodsReached: [/\(\s*[\w$.]+\s+as\s+any\s*\)\s*\.\s*[\w$]+\s*\(/, /[\w$)\]]\s*\[\s*(["'`])[\w$]+\1\s*\]\s*\(/] });
}
