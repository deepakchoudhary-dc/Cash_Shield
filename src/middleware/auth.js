const { forbidden, unauthorized } = require("../core/errors");

const ROLE_PERMISSIONS = {
  viewer: ["dashboard:read"],
  analyst: ["dashboard:read", "records:read"],
  admin: ["dashboard:read", "records:read", "records:write", "users:manage"]
};

function extractToken(request) {
  const authorization = request.headers.authorization;

  if (authorization && authorization.startsWith("Bearer ")) {
    return authorization.slice("Bearer ".length).trim();
  }

  const fallbackHeader = request.headers["x-auth-token"];
  return typeof fallbackHeader === "string" ? fallbackHeader.trim() : null;
}

function createAuth({ userService }) {
  async function requireUser(request) {
    if (request.currentUser) {
      return request.currentUser;
    }

    const token = extractToken(request);

    if (!token) {
      throw unauthorized("Provide a bearer token to authenticate this request.");
    }

    const user = await userService.findUserByToken(token);

    if (!user) {
      throw unauthorized("The supplied token is invalid.");
    }

    if (user.status !== "active") {
      throw forbidden("This user is inactive and cannot access the system.");
    }

    request.currentUser = user;
    return user;
  }

  function requirePermissions(requiredPermissions, handler) {
    return async (request, response) => {
      const user = await requireUser(request);
      const grantedPermissions = ROLE_PERMISSIONS[user.role] || [];
      const missingPermission = requiredPermissions.find(
        (permission) => !grantedPermissions.includes(permission)
      );

      if (missingPermission) {
        throw forbidden(`Role ${user.role} cannot perform this action.`);
      }

      return handler(request, response, user);
    };
  }

  return {
    requirePermissions,
    requireUser
  };
}

module.exports = {
  ROLE_PERMISSIONS,
  createAuth
};
