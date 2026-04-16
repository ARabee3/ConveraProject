# Convera Backend

This is the backend API for Convera, built with NestJS, Prisma, MySQL, and Redis.

## Prerequisites

- Docker Desktop
- Docker Compose
- Node.js 20+

## Setup & Environment Launch

1. Clone the environment variables template:
```bash
cp .env.example .env
```

2. Launch the full environment (Application, MySQL 8, Redis 7):
```bash
docker-compose up --build
```

3. The API will be available at http://localhost:3000.

## Database Management

To run database migrations after starting the environment:
```bash
npx prisma migrate dev --name init
```

## Tests

```bash
# unit tests
$ npm run test

# e2e tests
$ npm run test:e2e

# test coverage
$ npm run test:cov
```

## Features

- **NestJS 10.x** & **TypeScript 5.x**
- **Prisma ORM** with MySQL 8 & Optimistic Locking pattern
- **Redis 7** integration
- **I18n** via `nestjs-i18n` (Default: en, Secondary: ar)
- **JSON Logging** via `nestjs-pino`
- **Validation** via `class-validator`
- Global unified JSON exception filters
