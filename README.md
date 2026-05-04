# Microservice Social Media Platform

Distributed backend system powered by Node.js, TypeScript, PostgreSQL, Redis, Kafka, Socket.IO, and Docker.

Implements authentication, feed generation, media processing, real-time messaging, and social graph relationships using independently deployed services coordinated through event-driven communication.

---

## Core Capabilities

- Domain-driven microservice architecture
- Centralized API Gateway routing
- Event-driven communication using Kafka
- Real-time messaging with Socket.IO
- Redis-based session management across HTTP and WebSocket layers
- Independent PostgreSQL databases per service
- Media upload workflows integrated with Cloudinary
- Feed generation with cursor-based pagination
- Structured validation using Zod
- Observability using Prometheus and Grafana
- Containerized infrastructure using Docker Compose
- Unit testing for core modules


---

## Tech Stack

| Area | Technologies |
|---|---|
| Runtime | Node.js |
| Language | TypeScript |
| Framework | Express.js |
| API Gateway | http-proxy-middleware |
| Database | PostgreSQL |
| ORM | Prisma |
| Cache / Sessions | Redis |
| Messaging | Apache Kafka, KafkaJS |
| Real-time | Socket.IO |
| Media Storage | Cloudinary |
| Validation | Zod |
| Logging | Pino |
| Monitoring | Prometheus, Grafana |
| Testing | Jest, ts-jest, Supertest, jest-mock-extended |
| Containerization | Docker, Docker Compose |

---

## High-Level Architecture

```txt
                        ┌─────────────────────┐
                        │      Client App      │
                        │  Web / Mobile / UI   │
                        └──────────┬──────────┘
                                   │
                                   ▼
                        ┌─────────────────────┐
                        │     API Gateway     │
                        │      Port 8088      │
                        └──────────┬──────────┘
                                   │
          ┌────────────────────────┼────────────────────────┐
          │                        │                        │
          ▼                        ▼                        ▼
┌─────────────────┐      ┌─────────────────┐      ┌─────────────────┐
│  User Service   │      │  Post Service   │      │  Media Service  │
│    Port 4001    │      │    Port 4003    │      │    Port 4002    │
└───────┬─────────┘      └───────┬─────────┘      └───────┬─────────┘
        │                        │                        │
        ▼                        ▼                        ▼
┌─────────────────┐      ┌─────────────────┐      ┌─────────────────┐
│   user-db       │      │    post-db      │      │   Cloudinary    │
│ PostgreSQL      │      │  PostgreSQL     │      │  Media Storage  │
└─────────────────┘      └─────────────────┘      └─────────────────┘

          ┌────────────────────────┬────────────────────────┐
          │                        │                        │
          ▼                        ▼                        ▼
┌─────────────────┐      ┌─────────────────┐      ┌─────────────────┐
│  Chat Service   │      │ Social Graph    │      │      Redis      │
│    Port 4004    │      │ Service 4005    │      │ Sessions/Cache  │
└───────┬─────────┘      └───────┬─────────┘      └─────────────────┘
        │                        │
        ▼                        ▼
┌─────────────────┐      ┌─────────────────┐
│    chat-db      │      │ social-graph-db │
│  PostgreSQL     │      │   PostgreSQL    │
└─────────────────┘      └─────────────────┘

                        ┌─────────────────────┐
                        │   Kafka Cluster     │
                        │ kafka-1/2/3 brokers │
                        └──────────┬──────────┘
                                   │
                     ┌─────────────┴─────────────┐
                     ▼                           ▼
             ┌──────────────┐           ┌──────────────┐
             │  Prometheus  │           │   Grafana    │
             │  Port 9090   │           │  Port 5000   │
             └──────────────┘           └──────────────┘
```

---

## Services Overview

### 1. API Gateway

Location:

```txt
api-gateway/web-gateway
```

The API Gateway is the single entry point for external HTTP clients. It forwards requests to internal services using `http-proxy-middleware`.

| Gateway Route | Target Service |
|---|---|
| `/api/auth/*` | User Service |
| `/api/user/*` | User Service |
| `/api/media/*` | Media Service |
| `/api/posts/*` | Post Service |
| `/api/chat/*` | Chat Service |
| `/api/social-graph/*` | Social Graph Service |

Default gateway port:

```txt
8088
```

---

### 2. User Service

Location:

```txt
user-service
```

Manages user registration, login, profile lookup, profile image updates, Redis web sessions, JWT mobile login, and publishing user domain events.

Capabilities:

- Create users
- Login for web clients using Redis-backed session cookies
- Login for mobile clients using JWT access tokens
- Get profile by user ID
- Get profile by username
- Update profile image
- Publish user events to Kafka
- Consume social graph events to update user-related counters/cache
- Outbox worker support for reliable event publishing

Important routes:

| Method | Route | Description |
|---|---|---|
| `POST` | `/api/user` | Create a new user |
| `GET` | `/api/user/profile/id/:id` | Get profile by ID |
| `GET` | `/api/user/profile/username/:username` | Get profile by username |
| `PATCH` | `/api/user/profile/profile-image` | Update authenticated user profile image |
| `POST` | `/api/auth/web/login` | Web login with Redis session cookie |
| `POST` | `/api/auth/mobile/login` | Mobile login with JWT token |

Database models include:

- `User`
- `OutboxEvent`

Kafka topics used:

- `user-events`
- `social-graph-events`
- `user-service-social-graph-events-dlq`

---

### 3. Post Service

Location:

```txt
post-service
```

Manages post creation, post retrieval, profile grid feed, profile feed windows, home feed pagination, likes, comments, and synchronization with user/media events.

Capabilities:

- Create text, media, or mixed posts
- Support carousel-style media through ordered media records
- Fetch single post by ID
- Fetch all posts with pagination
- Fetch authenticated user posts
- Fetch user profile grid posts
- Fetch profile feed windows
- Fetch personalized home feed
- Support before/after cursor pagination
- Like and unlike posts
- List post likes
- Create, list, and delete comments
- Cache user profile data from user events
- React to media upload completion events
- Publish post lifecycle events

Important routes:

| Method | Route | Description |
|---|---|---|
| `POST` | `/api/posts` | Create post |
| `GET` | `/api/posts` | Get all posts |
| `GET` | `/api/posts/me` | Get authenticated user posts |
| `GET` | `/api/posts/feed/home` | Get home feed |
| `GET` | `/api/posts/feed/home/before` | Get newer home feed posts |
| `GET` | `/api/posts/feed/home/after` | Get older home feed posts |
| `GET` | `/api/posts/user/:profileUserId/grid/cursor` | Cursor-based profile grid |
| `GET` | `/api/posts/user/:profileUserId/grid` | Offset-based profile grid |
| `GET` | `/api/posts/user/:profileUserId/feed/window` | Profile feed window |
| `GET` | `/api/posts/user/:profileUserId/feed/after` | Profile feed after cursor |
| `GET` | `/api/posts/user/:userId` | Get posts by user ID |
| `GET` | `/api/posts/:postId` | Get post by ID |
| `PATCH` | `/api/posts/:postId` | Update post |
| `DELETE` | `/api/posts/:postId` | Delete post |
| `POST` | `/api/posts/:postId/like` | Like post |
| `DELETE` | `/api/posts/:postId/like` | Unlike post |
| `GET` | `/api/posts/:postId/like` | Get post likes |
| `POST` | `/api/posts/:postId/comments` | Create comment |
| `GET` | `/api/posts/:postId/comments` | Get comments |
| `DELETE` | `/api/posts/:postId/comments/:commentId` | Delete comment |

Database models include:

- `Post`
- `PostMedia`
- `PostLike`
- `PostComment`
- `UserProfileCache`

Kafka topics used:

- `post-events`
- `user-events`
- `media-events`
- `post-service-user-events-dlq`
- `post-service-media-events-dlq`

---

### 4. Media Service

Location:

```txt
media-service
```

Manages Cloudinary media upload signatures and publishing media upload completion events after successful media upload metadata is received.

Capabilities:

- Generate profile image upload signatures
- Generate post media upload signatures
- Validate uploaded media metadata
- Publish media upload completion events
- Integrate Cloudinary with the backend workflow

Important routes:

| Method | Route | Description |
|---|---|---|
| `POST` | `/api/media/upload/profile-image/signature` | Generate profile image upload signature |
| `POST` | `/api/media/upload/profile-image/update` | Update authenticated user profile image after upload |
| `POST` | `/api/media/upload/media/signature` | Generate post media upload signature |
| `POST` | `/api/media/upload/media` | Confirm uploaded media and publish event |

Kafka topics used:

- `media-events`

Cloud provider:

- Cloudinary

---

### 5. Chat Service

Location:

```txt
chat-service
```

Manages real-time messaging, conversation management, and event-driven communication over Socket.IO.

Capabilities:

- Create direct conversations
- Create group conversations
- List user conversations
- Send messages
- Fetch conversation messages
- Mark conversation as read
- Add and remove participants
- Leave group conversations
- Update group metadata
- Delete messages
- Add and remove reactions
- Authenticate sockets through Redis session cookies
- Join users into conversation rooms
- Emit real-time message and group events
- Track user presence

Important HTTP routes:

| Method | Route | Description |
|---|---|---|
| `GET` | `/api/chat/me` | Get authenticated user ID from session |
| `GET` | `/api/chat/conversations` | List authenticated user conversations |
| `POST` | `/api/chat/conversations/direct` | Create direct conversation |
| `POST` | `/api/chat/conversations/group` | Create group conversation |
| `GET` | `/api/chat/conversations/:conversationId/messages` | Get messages |
| `POST` | `/api/chat/conversations/:conversationId/messages` | Send message |
| `POST` | `/api/chat/conversations/:conversationId/read` | Mark conversation as read |
| `POST` | `/api/chat/conversations/:conversationId/leave` | Leave group conversation |
| `POST` | `/api/chat/conversations/:conversationId/participants` | Add participants |
| `DELETE` | `/api/chat/conversations/:conversationId/participants/:participantUserId` | Remove participant |
| `PATCH` | `/api/chat/conversations/:conversationId` | Update group conversation |
| `POST` | `/api/chat/messages/:messageId/reactions` | Add reaction |
| `DELETE` | `/api/chat/messages/:messageId/reactions` | Remove reaction |
| `DELETE` | `/api/chat/messages/:messageId` | Delete message |

Database models include:

- `Conversation`
- `Participant`
- `Message`
- `MessageAttachment`
- `MessageReaction`
- `MessageReceipt`

Real-time concepts:

| Concept | Purpose |
|---|---|
| `user:<userId>` room | Send events to a specific user |
| `conversation:<conversationId>` room | Broadcast messages to conversation participants |
| Presence service | Tracks online/offline state |
| Socket auth middleware | Authenticates socket connection using Redis session cookie |

---

### 6. Social Graph Service

Location:

```txt
social-graph-service
```

Manages user follow/unfollow relationships, follower lists, following IDs, follower/following counts, user profile cache, and publishing social graph events.

Capabilities:

- Follow users
- Unfollow users
- Get followers
- Get follower/following counts
- Get authenticated user following IDs
- Consume user events and cache profile data
- Publish social graph events
- Use outbox worker for reliable event delivery

Important routes:

| Method | Route | Description |
|---|---|---|
| `POST` | `/api/social-graph/follow/:targetUserId` | Follow a user |
| `DELETE` | `/api/social-graph/follow/:targetUserId` | Unfollow a user |
| `GET` | `/api/social-graph/users/:targetUserId/followers` | Get followers |
| `GET` | `/api/social-graph/users/:targetUserId/counts` | Get follower/following counts |
| `GET` | `/api/social-graph/me/following/ids` | Get authenticated user's following IDs |

Database models include:

- `Follow`
- `UserProfileCache`
- `OutboxEvent`

Kafka topics used:

- `user-events`
- `social-graph-events`
- `social-graph-service-user-events-dlq`

---

## Event-Driven Communication

Services communicate through Kafka topics to propagate domain events and maintain data consistency across service boundaries without direct coupling.

### Kafka Topics

| Topic | Producer | Consumers | Purpose |
|---|---|---|---|
| `user-events` | User Service | Post Service, Social Graph Service | Sync user profile data across services |
| `media-events` | Media Service | Post Service | Attach uploaded media metadata to posts |
| `post-events` | Post Service | Future consumers | Publish post lifecycle changes |
| `social-graph-events` | Social Graph Service | User Service | Sync follow/unfollow counters and graph events |

### Event Names

User events:

```txt
user.created
user.updated
```

Media events:

```txt
media.upload.completed
media.deleted
```

Post events:

```txt
post.created
post.updated
post.deleted
post.published
post.archived
post.restored
post.media.attached
post.media.detached
post.visibility.changed
```

Social graph events:

```txt
follow.created
follow.removed
follow.requested
follow.accepted
```

### Dead Letter Topics

The project includes DLQ topics for failed event processing:

```txt
user-service-social-graph-events-dlq
post-service-user-events-dlq
post-service-media-events-dlq
social-graph-service-user-events-dlq
```

---

## Authentication Strategy

Authentication is handled differently for web and mobile clients to support both session-based and token-based access patterns.

### Web Authentication

Web login creates a server-side session in Redis and stores the session ID in an HTTP cookie.

Flow:

```txt
POST /api/auth/web/login
        │
        ▼
Validate credentials
        │
        ▼
Create Redis session: session:<sid>
        │
        ▼
Set session cookie
        │
        ▼
Authenticated APIs read sid cookie and resolve userId from Redis
```

### Mobile Authentication

Mobile login returns a JWT access token.

Flow:

```txt
POST /api/auth/mobile/login
        │
        ▼
Validate credentials
        │
        ▼
Generate JWT
        │
        ▼
Return access token
```

---

## Real-Time Chat Architecture

Real-time communication is implemented using Socket.IO with Redis-backed session validation and room-based message routing.

Typical flow:

```txt
Client connects to Socket.IO
        │
        ▼
Socket auth middleware reads sid cookie
        │
        ▼
Redis resolves session:<sid>
        │
        ▼
Socket stores userId in socket.data
        │
        ▼
Socket joins user:<userId> room
        │
        ▼
Conversation events use conversation:<conversationId> rooms
```

This enables:

- Direct user notifications
- Group conversation broadcasting
- Participant add/remove events
- Room-based message delivery
- Presence updates
- Typing indicators and chat events

---

## Database Ownership

Each service owns its database to maintain clear data boundaries and avoid cross-service coupling.

| Service | Database | Port Mapping |
|---|---|---|
| User Service | `user-db` PostgreSQL | `5433:5432` |
| Post Service | `post-db` PostgreSQL | `5434:5432` |
| Chat Service | `chat-db` PostgreSQL | `5435:5432` |
| Social Graph Service | `social-graph-db` PostgreSQL | `5436:5432` |

The Media Service does not use a local database in the current implementation. It integrates with Cloudinary and publishes Kafka events.

---

## Observability

The system includes a production-style observability stack for monitoring, debugging, and system health analysis.

### Monitoring

- 📊 Metrics collection using Prometheus across all services  
- 📈 Grafana dashboards for real-time system performance and health visibility  
- ⚡ End-to-end monitoring for APIs and background workflows  

### Alerting

- 🚨 Configured alerting for:
  - Service availability issues
  - Performance degradation
  - System and application failures  
- ⏱️ Alert evaluation and grouping for controlled signal noise  

### Logging

- 📝 Centralized structured logging using Pino  
- 🔍 Log aggregation and querying through Loki  
- 🧠 Consistent log format with service-level context (service, environment, level)  

### Observability Design

- 🔗 Correlation between metrics, logs, and system events for faster debugging  
- 🧩 Service-level dashboards for scalable monitoring architecture  
- 🛠️ End-to-end pipeline from application logs to visualization  

---

Monitoring services:

| Tool | Port | Purpose |
|---|---|---|
| Prometheus | `9090` | Metrics collection |
| Grafana | `5000` | Dashboard visualization |
| Loki | `3100` | Log aggregation |
| Promtail | `9080` | Log shipping |
| Redpanda Console | `8080` | Kafka inspection |
| Kafdrop | `19000` | Kafka topic/browser UI |

---

## Local Development Setup

### Prerequisites

Install the following:

- Node.js 20+
- Docker
- Docker Compose
- Git
- PostgreSQL client, optional
- Cloudinary account, for media upload workflows

---

## Environment Variables

Each service expects its own `.env` and/or `.env.docker` file.

### Root `.env`

Used by Docker Compose build args.

```env
DATABASE_URL_USER=postgresql://USER:PASSWORD@user-db:5432/USER_DB?schema=public
DATABASE_URL_POST=postgresql://USER:PASSWORD@post-db:5432/POST_DB?schema=public
DATABASE_URL_CHAT=postgresql://USER:PASSWORD@chat-db:5432/CHAT_DB?schema=public
DATABASE_URL_SOCIAL_GRAPH=postgresql://USER:PASSWORD@social-graph-db:5432/SOCIAL_GRAPH_DB?schema=public
```

### Common Service Variables

```env
NODE_ENV=development
PORT=4001
SERVICE_NAME=user-service
LOG_LEVEL=info
DATABASE_URL=postgresql://USER:PASSWORD@localhost:5432/DATABASE_NAME?schema=public
REDIS_URL=redis://redis-cache:6379
JWT_SECRET=replace-with-a-secure-secret
SALT_ROUNDS=10
```

### Media Service Variables

```env
NODE_ENV=development
PORT=4002
SERVICE_NAME=media-service
LOG_LEVEL=info
REDIS_URL=redis://redis-cache:6379
JWT_SECRET=replace-with-a-secure-secret
CLOUDINARY_CLOUD_NAME=your-cloud-name
CLOUDINARY_API_KEY=your-api-key
CLOUDINARY_API_SECRET=your-api-secret
```

### API Gateway Variables

```env
PORT=8088
USER_SERVICE_URL=http://user-service:4001
MEDIA_SERVICE_URL=http://media-service:4002
POST_SERVICE_URL=http://post-service:4003
CHAT_SERVICE_URL=http://chat-service:4004
SOCIAL_GRAPH_SERVICE_URL=http://social-graph-service:4005
REDIS_URL=redis://redis-cache:6379
```

> Do not commit real secrets, database passwords, JWT secrets, or Cloudinary API secrets to GitHub.

---

## Running with Docker Compose

From the project root:

```bash
docker compose up --build
```

This starts:

- 3 Kafka brokers
- Redis
- PostgreSQL databases
- User Service
- Media Service
- Post Service
- Chat Service
- Social Graph Service
- API Gateway
- Prometheus
- Grafana
- Redpanda Console
- Kafdrop

To stop everything:

```bash
docker compose down
```

To remove containers and volumes:

```bash
docker compose down -v
```

---

## Running Services Manually

For local service-by-service development:

```bash
cd user-service
npm install
npm run build
npm run dev
```

For Prisma-based services:

```bash
npm run prisma:generate
npm run prisma:migrate
npm run build
npm run dev
```

Repeat similarly for:

```txt
user-service
post-service
chat-service
social-graph-service
media-service
api-gateway/web-gateway
```

---

## Useful URLs

| Service | URL |
|---|---|
| API Gateway | `http://localhost:8088` |
| User Service | `http://localhost:4001` |
| Media Service | `http://localhost:4002` |
| Post Service | `http://localhost:4003` |
| Chat Service | `http://localhost:4004` |
| Social Graph Service | `http://localhost:4005` |
| Prometheus | `http://localhost:9090` |
| Grafana | `http://localhost:5000` |
| Redpanda Console | `http://localhost:8080` |
| Kafdrop | `http://localhost:19000` |

---

## Testing

The project includes Jest-based tests for selected modules.

Run tests in User Service:

```bash
cd user-service
npm test
```

Run tests in Post Service:

```bash
cd post-service
npm test
```

Test coverage includes examples for:

- Controllers
- Services
- Validation schemas
- Mocked repositories
- Event publisher expectations

---

## Folder Structure

```txt
Microservice-social-media-app/
├── api-gateway/
│   └── web-gateway/
│       └── src/
│           └── app.ts
│
├── user-service/
│   ├── prisma/
│   ├── src/
│   │   ├── modules/
│   │   │   ├── auth/
│   │   │   └── user/
│   │   ├── events/
│   │   ├── middlewares/
│   │   ├── monitoring/
│   │   ├── utils/
│   │   └── app.ts
│   └── tests/
│
├── post-service/
│   ├── prisma/
│   ├── src/
│   │   ├── controllers/
│   │   ├── services/
│   │   ├── repositories/
│   │   ├── events/
│   │   ├── validation/
│   │   ├── monitoring/
│   │   └── app.ts
│   └── tests/
│
├── media-service/
│   └── src/
│       ├── controllers/
│       ├── services/
│       ├── repositories/
│       ├── events/
│       ├── validations/
│       └── app.ts
│
├── chat-service/
│   ├── prisma/
│   └── src/
│       ├── controllers/
│       ├── services/
│       ├── repositories/
│       ├── socket/
│       ├── validations/
│       ├── monitoring/
│       └── app.ts
│
├── social-graph-service/
│   ├── prisma/
│   └── src/
│       ├── controllers/
│       ├── services/
│       ├── repository/
│       ├── events/
│       ├── workers/
│       ├── validations/
│       └── app.ts
│
├── monitoring/
│   └── prometheus.yml
│
└── docker-compose.yaml
```

---

## Key Design Decisions

### 1. One Database per Service

Each service owns its own database. This keeps services loosely coupled and allows each service to evolve its schema independently.

### 2. Kafka for Cross-Service Synchronization

Instead of directly calling every service synchronously, services publish events such as `user.created`, `media.upload.completed`, and `follow.created`. Other services consume those events and update local data where needed.

### 3. Redis for Session-Based Authentication

Web authentication uses Redis sessions. This allows fast session validation and makes authentication usable across services and Socket.IO connections.

### 4. API Gateway for Client Simplicity

Clients do not need to know internal service ports. They call the API Gateway, and the gateway forwards traffic to the correct service.

### 5. Socket.IO Rooms for Chat Scalability

The Chat Service uses user rooms and conversation rooms. This keeps real-time delivery organized and supports direct chats, group chats, and targeted user notifications.

### 6. Zod for Runtime Validation

Each service validates request input before business logic execution, reducing invalid data and improving API reliability.

### 7. Prometheus and Grafana for Monitoring

Metrics support helps analyze service behavior, request performance, and system health during development or deployment.

---

## Security Notes

Security is enforced through middleware, session management, validation, and controlled access patterns.

- Helmet for secure HTTP headers
- CORS with credentials support
- Redis-backed sessions for web authentication
- JWT support for mobile authentication
- Zod validation for input safety
- Cookie parsing and authenticated route guards
- Password hashing support through bcrypt
---

## Example API Flow

### Create User and Login

```txt
1. POST /api/user
2. POST /api/auth/web/login
3. Redis stores session:<sid>
4. Browser receives session cookie
5. Authenticated requests use the cookie
```

### Upload Media and Create Post

```txt
1. Client requests upload signature from Media Service
2. Client uploads file to Cloudinary
3. Client confirms upload metadata to Media Service
4. Media Service publishes media.upload.completed
5. Post Service consumes media event
6. User creates post with media reference
7. Post Service publishes post.created
```

### Follow User

```txt
1. Authenticated user calls Social Graph Service
2. Follow record is created
3. Social Graph Service publishes follow.created
4. User Service consumes event and can update counters/cache
```

### Send Chat Message

```txt
1. User connects to Socket.IO with session cookie
2. Chat Service authenticates socket through Redis
3. User joins user:<userId> room
4. User sends message to conversation
5. Chat Service stores message
6. Chat Service emits event to conversation:<conversationId> room
```

---

## System Design Focus

- Service-level isolation with independent databases
- Event-driven synchronization across domains
- Real-time communication using persistent socket connections
- Scalable feed and pagination strategies
- Session sharing across HTTP and WebSocket layers
- API Gateway abstraction for client simplicity
- Modular service structure for independent scaling and deployment
---

## Architecture Summary

This system is structured around service isolation, asynchronous communication, and real-time interaction patterns, enabling scalable backend design across independently evolving domains.

## Author

**Muzafar Ali**

Backend / Full-Stack Developer focused on Node.js, TypeScript, microservices, real-time systems, and scalable API architecture.
