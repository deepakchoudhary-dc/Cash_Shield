const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs/promises");
const os = require("node:os");
const path = require("node:path");
const crypto = require("node:crypto");
const { startServer } = require("../src/server");

async function createTestContext() {
  const dataFile = path.join(os.tmpdir(), `finance-backend-${crypto.randomUUID()}.json`);
  const { server, port } = await startServer({ port: 0, dataFile });

  async function request(method, pathname, { token, body, rawBody, headers } = {}) {
    const response = await fetch(`http://127.0.0.1:${port}${pathname}`, {
      method,
      headers: {
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        ...(body !== undefined || rawBody !== undefined ? { "Content-Type": "application/json" } : {}),
        ...headers
      },
      body:
        rawBody !== undefined ? rawBody : body !== undefined ? JSON.stringify(body) : undefined
    });

    const payload = await response.json();
    return { response, payload };
  }

  async function cleanup() {
    await new Promise((resolve, reject) => {
      server.close((error) => (error ? reject(error) : resolve()));
    });
    await fs.rm(dataFile, { force: true });
  }

  return { cleanup, request };
}

test("viewer can read dashboard but cannot read records", async () => {
  const context = await createTestContext();

  try {
    const summaryResult = await context.request("GET", "/dashboard/summary", {
      token: "viewer-token"
    });

    assert.equal(summaryResult.response.status, 200);
    assert.equal(summaryResult.payload.data.totals.totalIncome, 2975);
    assert.equal(summaryResult.payload.data.totals.totalExpenses, 404);
    assert.equal(summaryResult.payload.data.totals.netBalance, 2571);

    const recordsResult = await context.request("GET", "/records", {
      token: "viewer-token"
    });

    assert.equal(recordsResult.response.status, 403);
    assert.equal(recordsResult.payload.error.code, "FORBIDDEN");
  } finally {
    await context.cleanup();
  }
});

test("health endpoint accepts a trailing slash", async () => {
  const context = await createTestContext();

  try {
    const result = await context.request("GET", "/health/");

    assert.equal(result.response.status, 200);
    assert.equal(result.payload.status, "ok");
  } finally {
    await context.cleanup();
  }
});

test("analyst can list records but cannot create them", async () => {
  const context = await createTestContext();

  try {
    const listResult = await context.request("GET", "/records?pageSize=2", {
      token: "analyst-token"
    });

    assert.equal(listResult.response.status, 200);
    assert.equal(listResult.payload.data.items.length, 2);
    assert.equal(listResult.payload.data.pagination.totalItems, 6);

    const createResult = await context.request("POST", "/records", {
      token: "analyst-token",
      body: {
        amount: 25,
        type: "expense",
        category: "Travel",
        date: "2026-03-18"
      }
    });

    assert.equal(createResult.response.status, 403);
  } finally {
    await context.cleanup();
  }
});

test("admin can create filter update and soft delete records", async () => {
  const context = await createTestContext();

  try {
    const createResult = await context.request("POST", "/records", {
      token: "admin-token",
      body: {
        amount: 250.75,
        type: "expense",
        category: "Travel",
        date: "2026-03-20",
        notes: "Flight to client site"
      }
    });

    assert.equal(createResult.response.status, 201);
    assert.equal(createResult.payload.data.amount, 250.75);

    const recordId = createResult.payload.data.id;

    const filterResult = await context.request("GET", "/records?category=Travel", {
      token: "admin-token"
    });

    assert.equal(filterResult.response.status, 200);
    assert.equal(filterResult.payload.data.items.length, 1);
    assert.equal(filterResult.payload.data.items[0].id, recordId);

    const updateResult = await context.request("PATCH", `/records/${recordId}`, {
      token: "admin-token",
      body: {
        notes: "Updated flight booking"
      }
    });

    assert.equal(updateResult.response.status, 200);
    assert.equal(updateResult.payload.data.notes, "Updated flight booking");

    const deleteResult = await context.request("DELETE", `/records/${recordId}`, {
      token: "admin-token"
    });

    assert.equal(deleteResult.response.status, 200);

    const getDeleted = await context.request("GET", `/records/${recordId}`, {
      token: "admin-token"
    });

    assert.equal(getDeleted.response.status, 404);
  } finally {
    await context.cleanup();
  }
});

test("user management enforces validation and inactive users are blocked", async () => {
  const context = await createTestContext();

  try {
    const invalidCreate = await context.request("POST", "/users", {
      token: "admin-token",
      body: {
        name: "Q",
        email: "not-an-email",
        role: "boss"
      }
    });

    assert.equal(invalidCreate.response.status, 422);
    assert.equal(invalidCreate.payload.error.code, "VALIDATION_ERROR");

    const inactiveMe = await context.request("GET", "/me", {
      token: "inactive-token"
    });

    assert.equal(inactiveMe.response.status, 403);

    const createUser = await context.request("POST", "/users", {
      token: "admin-token",
      body: {
        name: "Priya Ops",
        email: "priya.ops@example.com",
        role: "viewer"
      }
    });

    assert.equal(createUser.response.status, 201);
    assert.equal(createUser.payload.data.status, "active");

    const updateUser = await context.request("PATCH", `/users/${createUser.payload.data.id}`, {
      token: "admin-token",
      body: {
        status: "inactive",
        role: "analyst"
      }
    });

    assert.equal(updateUser.response.status, 200);
    assert.equal(updateUser.payload.data.status, "inactive");
    assert.equal(updateUser.payload.data.role, "analyst");
  } finally {
    await context.cleanup();
  }
});

test("record filters reject malformed query input instead of returning 500s", async () => {
  const context = await createTestContext();

  try {
    const duplicateCategory = await context.request(
      "GET",
      "/records?category=Rent&category=Travel",
      {
        token: "admin-token"
      }
    );

    assert.equal(duplicateCategory.response.status, 422);
    assert.equal(duplicateCategory.payload.error.code, "VALIDATION_ERROR");

    const invalidRange = await context.request(
      "GET",
      "/records?from=2026-03-31&to=2026-01-01",
      {
        token: "admin-token"
      }
    );

    assert.equal(invalidRange.response.status, 422);
    assert.equal(invalidRange.payload.error.code, "VALIDATION_ERROR");

    const invalidSort = await context.request("GET", "/records?sort=sideways", {
      token: "admin-token"
    });

    assert.equal(invalidSort.response.status, 422);
    assert.equal(invalidSort.payload.error.code, "VALIDATION_ERROR");
  } finally {
    await context.cleanup();
  }
});

test("transport layer rejects unsupported methods and malformed bodies", async () => {
  const context = await createTestContext();

  try {
    const wrongMethod = await context.request("POST", "/health");

    assert.equal(wrongMethod.response.status, 405);
    assert.equal(wrongMethod.response.headers.get("allow"), "GET");

    const invalidBodyType = await context.request("POST", "/records", {
      token: "admin-token",
      rawBody: JSON.stringify(["not", "an", "object"])
    });

    assert.equal(invalidBodyType.response.status, 400);
    assert.equal(invalidBodyType.payload.error.code, "BAD_REQUEST");
  } finally {
    await context.cleanup();
  }
});

test("dashboard trends and user responses stay strict and non-sensitive", async () => {
  const context = await createTestContext();

  try {
    const usersResult = await context.request("GET", "/users", {
      token: "admin-token"
    });

    assert.equal(usersResult.response.status, 200);
    assert.equal("token" in usersResult.payload.data[0], false);

    const invalidTrend = await context.request(
      "GET",
      "/dashboard/trends?groupBy=year&points=2",
      {
        token: "viewer-token"
      }
    );

    assert.equal(invalidTrend.response.status, 422);
    assert.equal(invalidTrend.payload.error.code, "VALIDATION_ERROR");

    const invalidRecordUpdate = await context.request("PATCH", "/records/rec_001", {
      token: "admin-token",
      body: {
        ignored: true
      }
    });

    assert.equal(invalidRecordUpdate.response.status, 422);
    assert.equal(invalidRecordUpdate.payload.error.code, "VALIDATION_ERROR");
  } finally {
    await context.cleanup();
  }
});
