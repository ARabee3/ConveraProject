<!--
Sync Impact Report:
Version change: N/A → 1.0.0
List of modified principles:
- [PRINCIPLE_1_NAME] → I. NestJS Modular & Clean Architecture
- [PRINCIPLE_2_NAME] → II. MySQL ACID Compliant Persistence
- [PRINCIPLE_3_NAME] → III. High-Performance Redis Integration
- [PRINCIPLE_4_NAME] → IV. Global Standardized API & Validation
- [PRINCIPLE_5_NAME] → V. Security, Containerization & Environment Isolation
Added sections:
- Infrastructure & Deployment
- Development Standards
Removed sections:
- None
Templates requiring updates:
- .specify/templates/plan-template.md (✅ verified)
- .specify/templates/spec-template.md (✅ verified)
- .specify/templates/tasks-template.md (✅ verified)
- .gemini/commands/*.toml (✅ verified)
Follow-up TODOs:
- None
-->

# Convera Backend Constitution

## Core Principles

### I. NestJS Modular & Clean Architecture
Feature modules (e.g., AuthModule, BookingModule, ChatModule) are mandatory. Utilize dependency injection, decorators, and strict TypeScript. Maintain strict separation: Controllers handle routing, Services handle business logic, and Repositories handle data access.

### II. MySQL ACID Compliant Persistence
MySQL is the primary database for all booking transactions to ensure strict ACID properties and prevent double-booking. Data access must be performed via TypeORM or Prisma.

### III. High-Performance Redis Integration
Redis is mandatory for caching search queries, managing session states/OTPs, and handling real-time pub/sub messaging for the chat system. Operations must target latency under 1 second.

### IV. Global Standardized API & Validation
Implement a global exception filter and ensure all API responses follow a unified JSON format for success and error states. Mandatory global use of `class-validator` and `class-transformer` for all DTOs.

### V. Security, Containerization & Environment Isolation
Enforce Role-Based Access Control (RBAC) globally using NestJS Guards. Sensitive data must never be returned in API payloads. All infrastructure must be containerized with Docker and Docker Compose for Linux (Ubuntu) deployment.

## Infrastructure & Deployment
All services must be containerized using Docker. Use Docker Compose for local development and orchestration. The target environment is Linux (Ubuntu).

## Development Standards
Strict TypeScript must be used across all modules. Modular design is required to ensure scalability and maintainability. Unified error handling and validation must be enforced at the gateway/controller level.

## Governance
The Constitution supersedes all other development practices. Amendments require a version bump, documentation of rationale, and a migration plan if applicable. All pull requests must verify compliance with these principles.

**Version**: 1.0.0 | **Ratified**: 2026-04-15 | **Last Amended**: 2026-04-15
