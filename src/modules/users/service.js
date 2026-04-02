const crypto = require("node:crypto");
const { badRequest, notFound, validationError } = require("../../core/errors");

const USER_ROLES = ["viewer", "analyst", "admin"];
const USER_STATUSES = ["active", "inactive"];

function serializeUser(user, { includeToken = true } = {}) {
  const payload = {
    id: user.id,
    name: user.name,
    email: user.email,
    role: user.role,
    status: user.status,
    createdAt: user.createdAt,
    updatedAt: user.updatedAt
  };

  if (includeToken) {
    payload.token = user.token;
  }

  return payload;
}

function validateEmail(email) {
  return typeof email === "string" && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

function validateUserPayload(payload, { partial = false } = {}) {
  const errors = [];
  const next = {};

  if (!partial || Object.prototype.hasOwnProperty.call(payload, "name")) {
    if (typeof payload.name !== "string" || payload.name.trim().length < 2) {
      errors.push({
        field: "name",
        message: "Name must be at least 2 characters long."
      });
    } else {
      next.name = payload.name.trim();
    }
  }

  if (!partial || Object.prototype.hasOwnProperty.call(payload, "email")) {
    if (!validateEmail(payload.email)) {
      errors.push({
        field: "email",
        message: "Email must be valid."
      });
    } else {
      next.email = payload.email.trim().toLowerCase();
    }
  }

  if (!partial || Object.prototype.hasOwnProperty.call(payload, "role")) {
    if (!USER_ROLES.includes(payload.role)) {
      errors.push({
        field: "role",
        message: "Role must be viewer, analyst, or admin."
      });
    } else {
      next.role = payload.role;
    }
  }

  if (Object.prototype.hasOwnProperty.call(payload, "status")) {
    if (!USER_STATUSES.includes(payload.status)) {
      errors.push({
        field: "status",
        message: "Status must be active or inactive."
      });
    } else {
      next.status = payload.status;
    }
  } else if (!partial) {
    next.status = "active";
  }

  if (Object.prototype.hasOwnProperty.call(payload, "token")) {
    if (typeof payload.token !== "string" || payload.token.trim().length < 8) {
      errors.push({
        field: "token",
        message: "Token must be a string with at least 8 characters."
      });
    } else {
      next.token = payload.token.trim();
    }
  }

  if (errors.length > 0) {
    throw validationError(errors);
  }

  return next;
}

function createUserService({ store }) {
  async function listUsers() {
    const data = await store.read();
    return data.users.map((user) => serializeUser(user));
  }

  async function findUserByToken(token) {
    const data = await store.read();
    return data.users.find((candidate) => candidate.token === token) || null;
  }

  async function createUser(payload) {
    const validated = validateUserPayload(payload);
    const token = validated.token || crypto.randomBytes(16).toString("hex");
    const timestamp = new Date().toISOString();
    const nextUser = {
      id: `usr_${crypto.randomUUID()}`,
      ...validated,
      token,
      createdAt: timestamp,
      updatedAt: timestamp
    };

    await store.write((data) => {
      const emailExists = data.users.some((user) => user.email === nextUser.email);
      const tokenExists = data.users.some((user) => user.token === nextUser.token);

      if (emailExists) {
        throw badRequest("A user with this email already exists.");
      }

      if (tokenExists) {
        throw badRequest("A user with this token already exists.");
      }

      data.users.push(nextUser);
    });

    return serializeUser(nextUser);
  }

  async function updateUser(userId, payload, actingUser) {
    if (!payload || Object.keys(payload).length === 0) {
      throw validationError([
        {
          field: "body",
          message: "At least one field must be provided for update."
        }
      ]);
    }

    const validated = validateUserPayload(payload, { partial: true });
    let updatedUser = null;

    await store.write((data) => {
      const user = data.users.find((candidate) => candidate.id === userId);

      if (!user) {
        throw notFound("User not found.");
      }

      if (actingUser.id === user.id && validated.status === "inactive") {
        throw badRequest("You cannot deactivate your own user.");
      }

      if (actingUser.id === user.id && validated.role && validated.role !== "admin") {
        throw badRequest("You cannot remove your own admin role.");
      }

      if (
        validated.email &&
        data.users.some((candidate) => candidate.id !== user.id && candidate.email === validated.email)
      ) {
        throw badRequest("A user with this email already exists.");
      }

      if (
        validated.token &&
        data.users.some((candidate) => candidate.id !== user.id && candidate.token === validated.token)
      ) {
        throw badRequest("A user with this token already exists.");
      }

      Object.assign(user, validated, {
        updatedAt: new Date().toISOString()
      });

      updatedUser = { ...user };
    });

    return serializeUser(updatedUser);
  }

  return {
    createUser,
    findUserByToken,
    listUsers,
    updateUser
  };
}

module.exports = {
  USER_ROLES,
  USER_STATUSES,
  createUserService,
  serializeUser
};
