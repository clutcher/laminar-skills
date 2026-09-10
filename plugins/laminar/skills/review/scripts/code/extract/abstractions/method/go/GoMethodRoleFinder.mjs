import { GenericMethodRoleFinder } from "../generic/GenericMethodRoleFinder.mjs";
import { OutboundIo } from "../generic/outside/OutboundIo.mjs";

export class GoMethodRoleFinder extends GenericMethodRoleFinder {
  language = "golang";
  outboundIo = new OutboundIo({ exitModules: ["net", "os", "io/ioutil", "io/fs", "database", "syscall", "plugin", "log/syslog", "github.com/jackc/pgx", "github.com/lib/pq", "github.com/go-sql-driver/mysql", "gorm.io", "github.com/jmoiron/sqlx", "go.mongodb.org", "github.com/redis", "github.com/go-redis", "github.com/segmentio/kafka-go", "github.com/confluentinc", "github.com/rabbitmq", "github.com/streadway/amqp", "github.com/aws", "cloud.google.com", "google.golang.org/grpc", "github.com/go-resty"] });
}
