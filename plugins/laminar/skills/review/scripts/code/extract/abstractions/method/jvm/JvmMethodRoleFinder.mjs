import { GenericMethodRoleFinder } from "../generic/GenericMethodRoleFinder.mjs";
import { OutboundIo } from "../generic/outside/OutboundIo.mjs";

export class JvmMethodRoleFinder extends GenericMethodRoleFinder {
  family = "jvm";
  outboundIo = new OutboundIo({ exitModules: ["java.io", "java.nio", "java.net", "java.sql", "javax.sql", "java.rmi", "java.lang.ProcessBuilder", "kotlin.io", "org.hibernate", "org.jooq", "org.mybatis", "org.apache.ibatis", "com.mongodb", "org.mongodb", "redis.clients", "io.lettuce", "org.apache.kafka", "com.rabbitmq", "okhttp3", "org.apache.http", "org.apache.hc", "feign", "retrofit2", "io.ktor.client", "software.amazon.awssdk", "com.amazonaws", "com.google.cloud", "io.grpc", "org.elasticsearch", "co.elastic", "io.r2dbc", "io.vertx.sqlclient", "io.vertx.core.http", "org.jdbi", "com.zaxxer.hikari"] });
}
