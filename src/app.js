const path = require("node:path");
const { readJsonBody, sendError, sendJson } = require("./core/http");
const { Router } = require("./core/router");
const { createAuth } = require("./middleware/auth");
const { createDashboardService } = require("./modules/dashboard/service");
const { createRecordService } = require("./modules/records/service");
const { createUserService, serializeUser } = require("./modules/users/service");
const { buildSeedData } = require("./seed/seedData");
const { DataStore } = require("./storage/dataStore");

function createApp({ dataFile } = {}) {
  const store = new DataStore({
    filePath: dataFile || path.join(process.cwd(), "data", "app-data.json"),
    seedFactory: buildSeedData
  });

  const userService = createUserService({ store });
  const recordService = createRecordService({ store });
  const dashboardService = createDashboardService({ recordService });
  const auth = createAuth({ userService });
  const router = new Router();

  router.register("GET", "/health", async (_request, response) => {
    sendJson(response, 200, { status: "ok" });
  });

  router.register("GET", "/me", async (request, response) => {
    const user = await auth.requireUser(request);
    sendJson(response, 200, {
      data: serializeUser(user, { includeToken: false })
    });
  });

  router.register(
    "GET",
    "/users",
    auth.requirePermissions(["users:manage"], async (_request, response) => {
      const users = await userService.listUsers();
      sendJson(response, 200, { data: users });
    })
  );

  router.register(
    "POST",
    "/users",
    auth.requirePermissions(["users:manage"], async (request, response) => {
      const payload = await readJsonBody(request);
      const user = await userService.createUser(payload);
      sendJson(response, 201, { data: user });
    })
  );

  router.register(
    "PATCH",
    "/users/:id",
    auth.requirePermissions(["users:manage"], async (request, response, user) => {
      const payload = await readJsonBody(request);
      const updatedUser = await userService.updateUser(request.params.id, payload, user);
      sendJson(response, 200, { data: updatedUser });
    })
  );

  router.register(
    "GET",
    "/records",
    auth.requirePermissions(["records:read"], async (request, response) => {
      const records = await recordService.listRecords(request.query);
      sendJson(response, 200, { data: records });
    })
  );

  router.register(
    "GET",
    "/records/:id",
    auth.requirePermissions(["records:read"], async (request, response) => {
      const record = await recordService.getRecordById(request.params.id);
      sendJson(response, 200, { data: record });
    })
  );

  router.register(
    "POST",
    "/records",
    auth.requirePermissions(["records:write"], async (request, response, user) => {
      const payload = await readJsonBody(request);
      const record = await recordService.createRecord(payload, user);
      sendJson(response, 201, { data: record });
    })
  );

  router.register(
    "PATCH",
    "/records/:id",
    auth.requirePermissions(["records:write"], async (request, response) => {
      const payload = await readJsonBody(request);
      const record = await recordService.updateRecord(request.params.id, payload);
      sendJson(response, 200, { data: record });
    })
  );

  router.register(
    "DELETE",
    "/records/:id",
    auth.requirePermissions(["records:write"], async (request, response) => {
      await recordService.deleteRecord(request.params.id);
      sendJson(response, 200, { data: { deleted: true } });
    })
  );

  router.register(
    "GET",
    "/dashboard/summary",
    auth.requirePermissions(["dashboard:read"], async (request, response) => {
      const summary = await dashboardService.getSummary(request.query);
      sendJson(response, 200, { data: summary });
    })
  );

  router.register(
    "GET",
    "/dashboard/trends",
    auth.requirePermissions(["dashboard:read"], async (request, response) => {
      const trends = await dashboardService.getTrends(request.query);
      sendJson(response, 200, { data: trends });
    })
  );

  async function handleRequest(request, response) {
    try {
      await router.handle(request, response);
    } catch (error) {
      sendError(response, error);
    }
  }

  return {
    handleRequest,
    init: () => store.init()
  };
}

module.exports = {
  createApp
};
