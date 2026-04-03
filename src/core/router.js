const { methodNotAllowed, notFound } = require("./errors");
const { CORS_HEADERS } = require("./cors");

function normalizePathname(pathname) {
  if (!pathname || pathname === "/") {
    return "/";
  }

  return pathname.endsWith("/") ? pathname.slice(0, -1) : pathname;
}

function parseQuery(searchParams) {
  const query = {};

  for (const [key, value] of searchParams.entries()) {
    if (Object.prototype.hasOwnProperty.call(query, key)) {
      const current = query[key];
      query[key] = Array.isArray(current) ? [...current, value] : [current, value];
    } else {
      query[key] = value;
    }
  }

  return query;
}

function compilePath(pathname) {
  const parameterNames = [];
  const normalizedPath = normalizePathname(pathname);
  const pattern = normalizedPath.replace(/:([A-Za-z0-9_]+)/g, (_, name) => {
    parameterNames.push(name);
    return "([^/]+)";
  });

  return {
    parameterNames,
    regex: new RegExp(`^${pattern}$`)
  };
}

class Router {
  constructor() {
    this.routes = [];
  }

  register(method, pathname, handler) {
    const compiled = compilePath(pathname);

    this.routes.push({
      method: method.toUpperCase(),
      pathname,
      handler,
      ...compiled
    });
  }

  async handle(request, response) {
    const url = new URL(request.url, "http://localhost");
    const pathname = normalizePathname(url.pathname);
    const requestMethod = request.method.toUpperCase();
    request.parsedUrl = url;
    request.query = parseQuery(url.searchParams);

    if (requestMethod === "OPTIONS") {
      response.writeHead(204, CORS_HEADERS);
      response.end();
      return;
    }

    const matchingRoutes = this.routes.filter((candidate) => candidate.regex.test(pathname));
    const route = matchingRoutes.find((candidate) => candidate.method === requestMethod);

    if (!route) {
      if (matchingRoutes.length > 0) {
        throw methodNotAllowed(matchingRoutes.map((candidate) => candidate.method));
      }

      throw notFound("The requested endpoint does not exist.");
    }

    const match = pathname.match(route.regex);
    request.params = {};

    route.parameterNames.forEach((name, index) => {
      request.params[name] = match[index + 1];
    });

    await route.handler(request, response);
  }
}

module.exports = {
  Router
};
