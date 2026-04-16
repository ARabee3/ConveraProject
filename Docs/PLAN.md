# Convera Backend Implementation Plan

## Objective
To implement the backend infrastructure, domains, and core logic for Convera, based on NestJS, MySQL, and Redis, deployed on Ubuntu via Docker.

## Background & Motivation
The application requires a robust, scalable backend handling property listings, event discovery, booking transactions with strict ACID properties (to prevent double-booking), and real-time chat. The architecture will strictly adhere to the project's `CONSTITUTION.md`, leveraging NestJS modules and dependency injection. Based on user clarification, the plan now explicitly integrates multi-language (i18n) support, Nodemailer/SMTP for notifications, and payment capture workflows (no refunds logic).

## Scope & Impact
The implementation is structured into 7 modular areas:

1. **Area 1: Infrastructure & Database Setup**
   - **Project Initialization**: NestJS setup with strict TypeScript, Prettier, and global i18n configuration for multi-language support.
   - **Dockerization**: `docker-compose.yml` for local development (MySQL, Redis, NestJS container).
   - **Database Configuration**: Prisma ORM with MySQL connection. Implementing `@VersionColumn` pattern for optimistic locking.
   - **Redis Integration**: Redis client setup for caching (search) and Pub/Sub (chat).
   - **Base Migrations**: Version-controlled initial schema setup.

2. **Area 2: Core Architecture & Security**
   - **Global Exception Filter**: Unified JSON response structure.
   - **Validation Pipeline**: Global `class-validator` and `class-transformer` pipes.
   - **Authentication Module (`AuthModule`)**: Email/Password registration/login, Redis OTP generation/verification, JWT issuance.
   - **Authorization (RBAC)**: Global Guards enforcing roles (Customer, Host, Admin, System Admin).

3. **Area 3: The Accommodation Domain**
   - **AccommodationModule**: APIs for hosts to manage property listings (apartments, hotels). Integrate i18n for listing content.
   - **Search & Filtering**: Complex query building for distance, price, rating, availability, leveraging Redis caching.
   - **Review System**: APIs to submit and view reviews/ratings.

4. **Area 4: The Event Domain**
   - **EventModule**: APIs for admin/system input of events (location, date, price, eligibility). Integrate i18n for event details.
   - **Event Discovery**: Search and filtering by category, date range, ticket type.

5. **Area 5: Booking & Financial Engine**
   - **BookingModule**: Transaction pipeline with optimistic locking. Rollbacks on version hash mismatches.
   - **PaymentModule**: Standardized Payment Adapter interface with strategies for Stripe and Paymob (Capture Only). Webhook handling for status updates.

6. **Area 6: Real-Time Communications**
   - **ChatModule**: WebSocket Gateway with JWT authentication.
   - **Redis Pub/Sub**: Message routing between scalable instances.
   - **Asynchronous Persistence**: BullMQ queue to batch-insert chat messages into MySQL.

7. **Area 7: Notifications & Admin**
   - **Notification Engine**: Listeners for booking and chat events to trigger emails via Nodemailer/SMTP, utilizing i18n templates.
   - **Admin Dashboard APIs**: System admin endpoints to monitor activity, users, events, and properties.

## Implementation Steps
This plan outlines 7 separate iterations (specifications) for development. Each will be executed sequentially to maintain strict modularity and clean architecture. Note that after plan approval, this file will be provisioned to `docs/PLAN.md` in the execution phase.

## Verification & Testing
- Unit and integration tests for each module.
- Validation of successful Docker builds and MySQL/Redis connectivity.
- End-to-end tests for critical pathways: Booking race conditions (optimistic locking), Payment Webhook processing, and Real-time chat performance under 1s latency.