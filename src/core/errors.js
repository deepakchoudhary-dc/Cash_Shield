class AppError extends Error {
  constructor(statusCode, code, message, details, headers = {}) {
    super(message);
    this.name = "AppError";
    this.statusCode = statusCode;
    this.code = code;
    this.details = details;
    this.headers = headers;
  }
}

function badRequest(message, details) {
  return new AppError(400, "BAD_REQUEST", message, details);
}

function unauthorized(message = "Authentication is required.") {
  return new AppError(401, "UNAUTHORIZED", message);
}

function forbidden(message = "You do not have permission to perform this action.") {
  return new AppError(403, "FORBIDDEN", message);
}

function notFound(message = "The requested resource was not found.") {
  return new AppError(404, "NOT_FOUND", message);
}

function methodNotAllowed(allowedMethods) {
  return new AppError(
    405,
    "METHOD_NOT_ALLOWED",
    "The requested method is not supported for this endpoint.",
    undefined,
    {
      Allow: [...new Set(allowedMethods)].join(", ")
    }
  );
}

function validationError(details) {
  return new AppError(422, "VALIDATION_ERROR", "Validation failed.", details);
}

module.exports = {
  AppError,
  badRequest,
  forbidden,
  methodNotAllowed,
  notFound,
  unauthorized,
  validationError
};
