import { GenericMethodRoleFinder } from "../generic/GenericMethodRoleFinder.mjs";
import { OutboundIo } from "../generic/outside/OutboundIo.mjs";
import { TestCodeMarks } from "../generic/testing/TestCodeMarks.mjs";

export class PythonMethodRoleFinder extends GenericMethodRoleFinder {
  language = "python";
  outboundIo = new OutboundIo({
    exitModules: ["os", "io", "socket", "subprocess", "shutil", "pathlib", "tempfile", "glob", "urllib", "http", "ftplib", "smtplib", "sqlite3", "dbm", "shelve", "requests", "httpx", "aiohttp", "urllib3", "sqlalchemy", "psycopg", "psycopg2", "pymysql", "mysql", "asyncpg", "pymongo", "motor", "redis", "boto3", "botocore", "kafka", "confluent_kafka", "pika", "celery", "django.db", "peewee", "tortoise", "elasticsearch", "grpc"],
    globalCallees: ["open", "input"],
  });
  testCodeMarks = new TestCodeMarks({ privateMethodsReached: [/(?<!\bself|\bcls)\.\s*_(?!_)\w+\s*\(/] });
}
