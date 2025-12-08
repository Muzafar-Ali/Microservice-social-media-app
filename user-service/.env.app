
# Application-level vars

# DATABASE
DB_HOST=user-db
DB_PORT=5432
DB_USER=postgres
DB_PASSWORD=postgres
DB_NAME=user-db
DATABASE_URL="postgresql://postgres:postgres@user-db:5432/user-db?schema=public"

# NODE_ENV=production
NODE_ENV=development
PORT=4001

# RABBITMQ_URL=amqp://appuser:supersecret@rabbitmq-broker:5672
REDIS_URL=redis://redis-cache:6379
# KAFKA_BROKERS=kafka:9092,kafka:9093

# pino logging 
SERVICE_NAME="user-service"
LOG_LEVEL="info"

# jwt
JWT_SECRET= "this is my user service secret."
SALT_ROUNDS=10