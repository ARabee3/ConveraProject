# Convera API Documentation (Unified)

This document provides a comprehensive guide to the Convera API endpoints implemented across **Infrastructure**, **Security**, **Accommodation**, **Events**, and **Booking & Payment** domains.

**Base URL**: `http://localhost:3000`

---

## 🔑 Authentication Flow

To test secured endpoints, follow this sequence:
1.  **Register**: `POST /auth/register` (creates unverified account).
2.  **Verify**: `POST /auth/verify` (uses 6-digit code).
3.  **Login**: `POST /auth/login` (returns Bearer `accessToken`).
4.  **Authorize**: Set the `Authorization` header in Postman to `Bearer {{accessToken}}`.

---

## 🛠 Infrastructure (Spec 1)

Endpoints for system health and internationalization.

### 1. Health Check
`GET /health`

**Response**:
```json
{
  "status": "ok",
  "timestamp": "2026-04-17T17:32:06.023Z"
}
```

### 2. Internationalized Hello
`GET /hello`

**Headers**:
- `Accept-Language`: `en` (default) or `ar`
- `x-custom-lang`: `en` or `ar`

**Example (English)**: `Hello World`
**Example (Arabic)**: `مرحبا بالعالم`

---

## 🛡 Security & Identity (Spec 2)

Endpoints for user management and RBAC.

### 1. Register User
`POST /auth/register`

**Body**:
```json
{
  "email": "test@example.com",
  "password": "Password123!"
}
```

### 2. Verify OTP
`POST /auth/verify`

**Body**:
```json
{
  "email": "test@example.com",
  "code": "123456"
}
```

### 3. Login
`POST /auth/login`

**Body**:
```json
{
  "email": "test@example.com",
  "password": "Password123!"
}
```

**Response**:
```json
{
  "data": {
    "accessToken": "ey...",
    "refreshToken": "...",
    "user": {
      "id": "...",
      "email": "test@example.com",
      "role": "CUSTOMER"
    }
  }
}
```

### 4. Token Refresh
`POST /auth/refresh`

**Body**:
```json
{
  "refreshToken": "..."
}
```

### 5. Forgot Password
`POST /auth/forgot-password`

**Body**:
```json
{
  "email": "test@example.com"
}
```

### 6. Reset Password
`POST /auth/reset-password`

**Body**:
```json
{
  "email": "test@example.com",
  "code": "123456",
  "password": "NewPassword123!"
}
```

### 7. Test Admin Access
`GET /auth/test-rbac`

**Auth Required**: `Bearer Token` (Admin role)

---

## 🏠 Accommodation Domain (Spec 3)

Endpoints for property discovery, host management, and reviews.

### 1. Search Properties (Public)
`GET /properties`

**Query Parameters**:
- `lat` (number): Latitude.
- `lng` (number): Longitude.
- `radius` (number): Search radius in km.
- `priceMin` (number): Minimum base price.
- `priceMax` (number): Maximum base price.
- `checkIn` (ISO Date): e.g., `2024-05-01`
- `checkOut` (ISO Date): e.g., `2024-05-10`
- `ratingMin` (number): Minimum 1-5.

### 2. Property Details (Public)
`GET /properties/:id`

Returns full details including amenities and reviews.

### 3. Host: List My Properties
`GET /host/properties`

**Auth Required**: `Bearer Token` (Host role)

### 4. Host: Create Property
`POST /host/properties`

**Auth Required**: `Bearer Token` (Host role)
**Body**:
```json
{
  "title": "Modern Apartment",
  "description": "City center view...",
  "type": "APARTMENT",
  "latitude": 30.0444,
  "longitude": 31.2357,
  "address": "123 Nile St, Cairo",
  "amenities": ["WiFi", "Pool"],
  "imageUrls": ["https://ex.com/img1.jpg"],
  "basePrice": 150
}
```

### 5. Host: Set Availability/Price Override
`POST /host/properties/:id/availability`

**Auth Required**: `Bearer Token` (Host role)
**Body**:
```json
{
  "startDate": "2024-06-01",
  "endDate": "2024-06-05",
  "status": "BLOCKED",
  "overridePrice": 200
}
```

### 6. Customer: Submit Review
`POST /properties/:propertyId/reviews`

**Auth Required**: `Bearer Token` (Customer role)
**Body**:
```json
{
  "bookingId": "uuid-here",
  "rating": 5,
  "comment": "Amazing stay!"
}
```

---

## 🎪 Events Domain (Spec 4)

Endpoints for event discovery, search, and external provider import management.

### 1. Search Events (Public)
`GET /events`

**Query Parameters**:
| Param | Type | Description |
|-------|------|-------------|
| `cursor` | string (UUID) | Pagination cursor from previous response |
| `limit` | number | Results per page (default: 20, max: 100) |
| `lat` | number | Latitude for geospatial search |
| `lng` | number | Longitude for geospatial search |
| `radius` | number | Search radius in km |
| `date` | ISO date | Filter events on or after date (e.g., `2026-05-01`) |
| `categoryId` | UUID | Filter by category |
| `priceMin` | number | Minimum price filter |
| `priceMax` | number | Maximum price filter |
| `minAge` | number | Minimum age restriction filter |
| `ticketTypes` | string[] | Filter by ticket types (e.g., `General,VIP`) |

**Response**:
```json
{
  "events": [
    {
      "id": "550e8400-e29b-41d4-a716-446655440000",
      "title": "Summer Music Festival",
      "date": "2026-06-15T20:00:00Z",
      "address": "123 Concert Ave, Cairo",
      "price": 150.00,
      "coverImage": "https://cdn.example.com/events/cover.jpg",
      "category": {
        "id": "550e8400-e29b-41d4-a716-446655440001",
        "name": "Concert"
      },
      "remainingSpots": 500,
      "isSoldOut": false
    }
  ],
  "nextCursor": "550e8400-e29b-41d4-a716-446655440002"
}
```

**Notes**:
- Events are automatically filtered to show only `ACTIVE` events with future dates
- Results are sorted by date ascending
- `isSoldOut` is derived from `remainingSpots <= 0`

### 2. Event Details (Public)
`GET /events/:id`

Returns full event details including gallery images, eligibility restrictions, and source information.

**Response**:
```json
{
  "id": "550e8400-e29b-41d4-a716-446655440000",
  "title": "Summer Music Festival",
  "description": "The biggest music event of the summer...",
  "date": "2026-06-15T20:00:00Z",
  "address": "123 Concert Ave, Cairo",
  "price": 150.00,
  "coverImage": "https://cdn.example.com/events/cover.jpg",
  "category": {
    "id": "550e8400-e29b-41d4-a716-446655440001",
    "name": "Concert"
  },
  "remainingSpots": 500,
  "isSoldOut": false,
  "locationLat": 30.0444,
  "locationLng": 31.2357,
  "status": "ACTIVE",
  "maxCapacity": 1000,
  "galleryImages": [
    {
      "id": "550e8400-e29b-41d4-a716-446655440003",
      "imageUrl": "https://cdn.example.com/events/gallery1.jpg",
      "displayOrder": 0
    },
    {
      "id": "550e8400-e29b-41d4-a716-446655440004",
      "imageUrl": "https://cdn.example.com/events/gallery2.jpg",
      "displayOrder": 1
    }
  ],
  "eligibility": {
    "minAge": 18,
    "ticketTypes": ["General", "VIP", "VVIP"],
    "specialRequirements": "Valid ID required for entry"
  },
  "source": {
    "sourceType": "EXTERNAL",
    "externalProviderName": "Tazkarti",
    "externalEventId": "tazkarti-event-12345"
  }
}
```

**Notes**:
- `galleryImages` limited to max 5 images, ordered by `displayOrder`
- `eligibility` is optional (may be null for events without restrictions)
- `source` indicates if event was imported from external provider

### 3. Admin: Trigger Event Import
`POST /admin/events/import`

**Auth Required**: `Bearer Token` (Admin or System Admin role)

Triggers manual synchronization of events from configured external providers (e.g., Tazkarti).

**Response**:
```json
{
  "success": true,
  "imported": 25,
  "updated": 10
}
```

**Notes**:
- Imports events from all registered provider adapters
- Uses upsert logic: existing events (matched by `externalProviderName + externalEventId`) are updated, new events are created
- Automatically fetches and uploads event images to cloud storage
- Clears event cache after import to ensure fresh data

---

## 🏨 Booking & Payment Domain (Spec 6)

Endpoints for property reservations, payment processing, and transaction management.

### 1. Create Booking (Customer)
`POST /bookings`

**Auth Required**: `Bearer Token` (Customer role)
**Body**:
```json
{
  "propertyId": "uuid-here",
  "startDate": "2026-05-01",
  "endDate": "2026-05-05"
}
```

**Response**:
```json
{
  "id": "uuid-here",
  "propertyId": "uuid-here",
  "customerId": "uuid-here",
  "startDate": "2026-05-01T00:00:00.000Z",
  "endDate": "2026-05-05T00:00:00.000Z",
  "totalPrice": 400.00,
  "status": "PENDING_PAYMENT",
  "version": 1,
  "createdAt": "2026-04-22T00:00:00.000Z",
  "updatedAt": "2026-04-22T00:00:00.000Z"
}
```

**Notes**:
- Booking is created with `PENDING_PAYMENT` status and a 15-minute expiration timer
- Total price is calculated automatically from property basePrice and any price overrides
- Returns `409 Conflict` if dates overlap with an existing pending or confirmed booking
- Returns `400 Bad Request` if endDate is not after startDate

### 2. Initialize Payment
`POST /payments/initialize`

**Auth Required**: `Bearer Token` (Customer role)
**Body**:
```json
{
  "bookingId": "uuid-here",
  "provider": "STRIPE"
}
```

**Response**:
```json
{
  "transactionId": "uuid-here",
  "providerRef": "pi_test_123",
  "paymentUrl": "https://test.com/pay"
}
```

**Notes**:
- Supported providers: `STRIPE`, `PAYMOB`
- All transactions are processed in `EGP`
- Returns `400` if booking is not in `PENDING_PAYMENT` status

### 3. Stripe Webhook
`POST /payments/webhooks/stripe`

**Headers**:
- `stripe-signature`: Webhook signature from Stripe

**Body**: Stripe event payload

**Response**:
```json
{ "received": true }
```

**Notes**:
- Automatically confirms booking on `payment_intent.succeeded`
- Automatically cancels booking on failed payment events
- Verifies webhook signature using `STRIPE_WEBHOOK_SECRET`

### 4. Paymob Webhook
`POST /payments/webhooks/paymob`

**Headers**:
- `hmac`: HMAC signature from Paymob

**Body**: Paymob callback payload

**Response**:
```json
{ "received": true }
```

**Notes**:
- Verifies webhook signature using HMAC-SHA512 with `PAYMOB_HMAC_SECRET`
- Automatically confirms or cancels bookings based on payment result

---

## 💬 Real-Time Communications (Spec 7)

Endpoints and WebSocket events for secure, moderated chat between Customers and Hosts.

### REST API

#### 1. Retrieve Chat History
`GET /chat/:sessionId/history`

**Auth Required**: `Bearer Token` (Participant only)
**Query Parameters**:
- `limit` (number): Max messages to return (default: 50).
- `offset` (number): Pagination offset.

**Response**:
```json
{
  "data": [
    {
      "id": "uuid",
      "sessionId": "uuid",
      "senderId": "uuid",
      "content": "Hello!",
      "createdAt": "2026-04-25T12:00:00Z"
    }
  ]
}
```

---

### WebSocket Gateway

**Endpoint**: `ws://localhost:3000/chat`
**Namespace**: `/chat`
**Auth**: JWT must be provided in the `Authorization` header or `auth.token` object.

#### 1. Client -> Server Events

| Event | Payload | Description |
|-------|---------|-------------|
| `subscribe` | `{ "sessionId": "uuid" }` | Join a specific chat room. |
| `send_message` | `{ "sessionId": "uuid", "content": "text" }` | Send a new message. |
| `mark_as_read` | `{ "sessionId": "uuid", "lastMessageId": "uuid" }` | Sync read receipts. |

#### 2. Server -> Client Events

| Event | Payload | Description |
|-------|---------|-------------|
| `new_message` | `ChatMessagePayload` | Broadcasted to room members. |
| `read_receipt` | `{ "sessionId": "uuid", "lastReadMessageId": "uuid", "readerId": "uuid" }` | Notification of Seen status. |
| `policy_violation` | `{ "sessionId": "uuid", "message": "string" }` | Sent on moderation rejection. |
| `exception` | `{ "status": "error", "message": "string" }` | Generic error notification. |

---

## 🚀 Postman Testing Guide

### 1. Environment Setup
Create a new Environment in Postman and add:
- `baseUrl`: `http://localhost:3000`
- `accessToken`: (Leave empty, will be set via script)

### 2. Automated Token Pickup
In your **Login** request, go to the **Tests** tab and add:
```javascript
const response = pm.response.json();
if (response.data && response.data.accessToken) {
    pm.environment.set("accessToken", response.data.accessToken);
}
```

### 3. Collection Import (Raw JSON)

<details>
<summary>Click to expand Postman Collection JSON</summary>

```json
{
	"info": {
		"_postman_id": "convera-api-collection",
		"name": "Convera API",
		"schema": "https://schema.getpostman.com/json/collection/v2.1.0/collection.json"
	},
	"item": [
		{
			"name": "Auth",
			"item": [
				{
					"name": "Register",
					"request": {
						"method": "POST",
						"header": [],
						"body": {
							"mode": "raw",
							"raw": "{\n  \"email\": \"user@example.com\",\n  \"password\": \"Password123!\"\n}",
							"options": { "raw": { "language": "json" } }
						},
						"url": "{{baseUrl}}/auth/register"
					}
				},
				{
					"name": "Login",
					"event": [
						{
							"listen": "test",
							"script": {
								"exec": [
									"const response = pm.response.json();",
									"if (response.data && response.data.accessToken) {",
									"    pm.environment.set(\"accessToken\", response.data.accessToken);",
									"}"
								],
								"type": "text/javascript"
							}
						}
					],
					"request": {
						"method": "POST",
						"header": [],
						"body": {
							"mode": "raw",
							"raw": "{\n  \"email\": \"user@example.com\",\n  \"password\": \"Password123!\"\n}",
							"options": { "raw": { "language": "json" } }
						},
						"url": "{{baseUrl}}/auth/login"
					}
				}
			]
		},
		{
			"name": "Accommodation",
			"item": [
				{
					"name": "Search Properties",
					"request": {
						"method": "GET",
						"header": [],
						"url": {
							"raw": "{{baseUrl}}/properties?lat=30.04&lng=31.23&radius=10",
							"host": ["{{baseUrl}}"],
							"path": ["properties"],
							"query": [
								{ "key": "lat", "value": "30.04" },
								{ "key": "lng", "value": "31.23" },
								{ "key": "radius", "value": "10" }
							]
						}
					}
				}
			]
		}
	]
}
```
</details>
