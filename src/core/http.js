const { AppError, badRequest } = require("./errors");

const JSON_LIMIT_BYTES = 1024 * 1024;

function sendJson(response, statusCode, payload) {
  const body = JSON.stringify(payload, null, 2);
  response.writeHead(statusCode, {
    "Content-Type": "application/json; charset=utf-8"
  });
  response.end(body);
}

async function readJsonBody(request) {
  if (request.body !== undefined) {
    return request.body;
  }

  const chunks = [];
  let totalLength = 0;

  for await (const chunk of request) {
    totalLength += chunk.length;

    if (totalLength > JSON_LIMIT_BYTES) {
      throw badRequest("Request body exceeds the 1 MB limit.");
    }

    chunks.push(chunk);
  }

  if (chunks.length === 0) {
    request.body = {};
    return request.body;
  }

  const rawBody = Buffer.concat(chunks).toString("utf8").trim();

  if (!rawBody) {
    request.body = {};
    return request.body;
  }

  try {
    request.body = JSON.parse(rawBody);
    return request.body;
  } catch (error) {
    throw badRequest("Request body contains invalid JSON.");
  }
}

function sendError(response, error) {
  if (error instanceof AppError) {
    sendJson(response, error.statusCode, {
      error: {
        code: error.code,
        message: error.message,
        details: error.details
      }
    });
    return;
  }

  sendJson(response, 500, {
    error: {
      code: "INTERNAL_SERVER_ERROR",
      message: "An unexpected error occurred."
    }
  });
}

module.exports = {
  readJsonBody,
  sendError,
  sendJson
};
