# Finance Data Processing and Access Control Backend

This project is a compact backend for a finance dashboard assignment. It implements user and role management, financial record CRUD, dashboard summary endpoints, backend-enforced access control, JSON-file persistence, validation, and automated tests.

## Stack

- Node.js 20
- Built-in `http`, `fs`, `crypto`, and `node:test`
- JSON file persistence for a simple local setup with no external runtime dependencies

## Why this design

I chose a zero-dependency Node backend because the workspace started empty and package installation was not guaranteed. The goal here is correctness, separation of concerns, and clear backend logic rather than framework-specific features.

The implementation is split into:

- `src/server.js`: server bootstrap
- `src/app.js`: app composition and route registration
- `src/core/*`: transport utilities, router, error types, and validation helpers
- `src/middleware/auth.js`: mock authentication and RBAC
- `src/modules/users/*`: user management logic
- `src/modules/records/*`: financial record validation and CRUD
- `src/modules/dashboard/*`: aggregation and trend logic
- `src/storage/dataStore.js`: JSON persistence with serialized writes and an in-process read cache
- `src/seed/seedData.js`: default users and records for local testing

## Assumptions

- Authentication is intentionally simplified for local development.
- Users authenticate with a fixed bearer token stored on the user record.
- Viewer can read dashboard endpoints only.
- Analyst can read dashboard endpoints and financial records.
- Admin can manage users and create, update, and delete records.
- Record deletion is implemented as soft delete.
- Amounts are stored internally as integer cents to avoid floating-point drift.

## Setup

### Requirements

- Node.js 20+

### Run

```bash
npm start
```

The server starts on `http://localhost:3000` by default.

Optional environment variables:

- `PORT`: server port
- `DATA_FILE`: custom path for the JSON persistence file

### Frontend Preview

Open the static frontend in a separate shell:

```bash
npx http-server frontend -p 4000
```

Then browse `http://localhost:4000` while the backend runs on `http://localhost:3000`. Use the default bearer token (`admin-token`) to load all data and create records, or switch to `analyst-token`/`viewer-token` to demonstrate permission limits. The UI shows health, users, filtered records, dashboard totals, and a form to create a new record.

## Seed users

These users are created automatically when the data file does not exist.

| Role | Email | Token | Status |
| --- | --- | --- | --- |
| Admin | `admin@finance.local` | `admin-token` | active |
| Analyst | `analyst@finance.local` | `analyst-token` | active |
| Viewer | `viewer@finance.local` | `viewer-token` | active |
| Viewer | `inactive@finance.local` | `inactive-token` | inactive |

Use them with:

```http
Authorization: Bearer admin-token
```

## API overview

### Health

- `GET /health`

### Authentication helper

- `GET /me`

### User management

- `GET /users` admin only
- `POST /users` admin only
- `PATCH /users/:id` admin only

Example create user body:

```json
{
  "name": "Priya Ops",
  "email": "priya.ops@example.com",
  "role": "viewer",
  "status": "active"
}
```

If `token` is omitted, one is generated automatically and returned in the create response.
For safety, `GET /users` and `PATCH /users/:id` do not expose stored tokens unless a token is explicitly rotated in the update request.

### Financial records

- `GET /records` analyst/admin
- `GET /records/:id` analyst/admin
- `POST /records` admin only
- `PATCH /records/:id` admin only
- `DELETE /records/:id` admin only

Record payload:

```json
{
  "amount": 250.75,
  "type": "expense",
  "category": "Travel",
  "date": "2026-03-20",
  "notes": "Flight to client site"
}
```

Supported record query params:

- `type=income|expense`
- `category=Travel`
- `from=2026-01-01`
- `to=2026-03-31`
- `q=salary`
- `page=1`
- `pageSize=10`
- `sort=asc|desc`

### Dashboard

- `GET /dashboard/summary` viewer/analyst/admin
- `GET /dashboard/trends` viewer/analyst/admin

`/dashboard/summary` returns:

- total income
- total expenses
- net balance
- category totals
- recent activity
- monthly trend

`/dashboard/trends` supports:

- `groupBy=month|week`
- `points=6`
- `from=YYYY-MM-DD`
- `to=YYYY-MM-DD`

## Example requests

Create a record as admin:

```bash
curl -X POST http://localhost:3000/records ^
  -H "Authorization: Bearer admin-token" ^
  -H "Content-Type: application/json" ^
  -d "{\"amount\":250.75,\"type\":\"expense\",\"category\":\"Travel\",\"date\":\"2026-03-20\",\"notes\":\"Flight to client site\"}"
```

Read dashboard summary as viewer:

```bash
curl http://localhost:3000/dashboard/summary ^
  -H "Authorization: Bearer viewer-token"
```

## Validation and error handling

The API returns structured JSON errors:

```json
{
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Validation failed.",
    "details": [
      {
        "field": "email",
        "message": "Email must be valid."
      }
    ]
  }
}
```

Implemented behaviors include:

- invalid JSON handling
- request bodies must be JSON objects
- field-level validation
- rejection of unknown fields on create and update
- correct HTTP status codes
- `405 Method Not Allowed` responses with an `Allow` header for valid routes using the wrong method
- role-based authorization failures
- invalid date, date-range, sorting, grouping, and pagination checks
- rejection of repeated scalar query parameters that would otherwise be ambiguous
- protection against invalid operations such as updating a missing record

## Testing

Run:

```bash
npm test
```

The test suite covers:

- role-based access rules
- record CRUD and filtering
- dashboard summary correctness
- validation errors and malformed request handling
- inactive user access blocking
- HTTP method semantics and non-sensitive user responses

## Tradeoffs

- A JSON datastore is sufficient for the assignment, but a real system would likely use PostgreSQL or SQLite with migrations and indexed queries.
- Token-based auth is mocked to keep focus on backend logic and access control.
- The routing layer is intentionally small and framework-free, which keeps the code easy to inspect but omits convenience features a mature framework would provide.
