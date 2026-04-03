const { badRequest } = require("./errors");

function isPlainObject(value) {
  if (value === null || typeof value !== "object" || Array.isArray(value)) {
    return false;
  }

  const prototype = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
}

function assertPlainObject(value, message = "Request body must be a JSON object.") {
  if (!isPlainObject(value)) {
    throw badRequest(message);
  }

  return value;
}

function addUnexpectedFieldErrors(payload, allowedFields, errors) {
  const allowedFieldSet = new Set(allowedFields);

  Object.keys(payload).forEach((field) => {
    if (!allowedFieldSet.has(field)) {
      errors.push({
        field,
        message: "Field is not allowed."
      });
    }
  });
}

function readSingularQueryParam(query, field, errors) {
  if (!Object.prototype.hasOwnProperty.call(query, field)) {
    return undefined;
  }

  const value = query[field];

  if (Array.isArray(value)) {
    errors.push({
      field,
      message: `Query parameter "${field}" must not be repeated.`
    });
    return undefined;
  }

  if (typeof value !== "string") {
    errors.push({
      field,
      message: `Query parameter "${field}" must be a string value.`
    });
    return undefined;
  }

  return value.trim();
}

module.exports = {
  addUnexpectedFieldErrors,
  assertPlainObject,
  isPlainObject,
  readSingularQueryParam
};
