const http = require("node:http");
const path = require("node:path");
const { createApp } = require("./app");

async function startServer({ port = Number(process.env.PORT) || 3000, dataFile } = {}) {
  const app = createApp({
    dataFile: dataFile || process.env.DATA_FILE || path.join(process.cwd(), "data", "app-data.json")
  });

  await app.init();

  const server = http.createServer(app.handleRequest);

  await new Promise((resolve) => {
    server.listen(port, resolve);
  });

  return {
    app,
    port: server.address().port,
    server
  };
}

if (require.main === module) {
  startServer()
    .then(({ port }) => {
      process.stdout.write(`Finance backend listening on http://localhost:${port}\n`);
    })
    .catch((error) => {
      process.stderr.write(`${error.stack || error.message}\n`);
      process.exitCode = 1;
    });
}

module.exports = {
  startServer
};
