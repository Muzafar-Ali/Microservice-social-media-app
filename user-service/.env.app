
# Application-level vars
DB_HOST=user-db
DB_PORT=5432
DB_USER=postgres
DB_PASSWORD=postgres
DB_NAME=user-db

# NODE_ENV=production
NODE_ENV=development
PORT=4001

DATABASE_URL="postgresql://postgres:postgres@user-db:5432/user-db?schema=public"
RABBITMQ_URL=amqp://appuser:supersecret@rabbitmq-broker:5672
REDIS_URL=redis://redis-cache:6379
KAFKA_BROKERS=