**Project Constitution: Convera Backend**

**1. Tech Stack & Infrastructure**

- **Framework:** NestJS. All modules must utilize dependency injection, decorators, and strict TypeScript.

- **Primary Database:** MySQL. This is mandatory to ensure strict ACID properties for all booking transactions to prevent double-booking. Use TypeORM or Prisma as the ORM.

- **Caching & Real-Time:** Redis. Must be used for caching search queries, managing session states/OTPs, and handling the real-time pub/sub messaging for the chat system to ensure latency stays under 1 second.

- **Environment:** The system will be deployed on a Linux (Ubuntu) environment. All infrastructure must be containerized using Docker and Docker Compose for seamless local development and deployment.

**2. Architectural Guidelines**

- **Structure:** Follow a highly modular architecture. Separate the application into distinct feature modules (e.g., `AuthModule`, `BookingModule`, `ChatModule`).

- **Clean Architecture:** Strictly separate concerns. Controllers handle HTTP/WebSocket routing, Services handle business logic, and Repositories handle data access. Do not leak database logic into controllers.

**3. Coding Standards & Conventions**

- **Error Handling:** Implement a global exception filter. All API responses must follow a unified JSON format for both success and error states.

- **Security:** Enforce Role-Based Access Control (RBAC) globally using NestJS Guards.
  Sensitive data (passwords, payments) must never be returned in API payloads.

- **Validation:** Use `class-validator` and `class-transformer` globally to validate all incoming DTOs on both frontend and backend.
