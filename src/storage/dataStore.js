const fs = require("node:fs/promises");
const path = require("node:path");
const crypto = require("node:crypto");

function cloneData(value) {
  return JSON.parse(JSON.stringify(value));
}

class DataStore {
  constructor({ filePath, seedFactory }) {
    this.filePath = filePath;
    this.seedFactory = seedFactory;
    this.initialized = false;
    this.queue = Promise.resolve();
  }

  async init() {
    if (this.initialized) {
      return;
    }

    await fs.mkdir(path.dirname(this.filePath), { recursive: true });

    try {
      await fs.access(this.filePath);
    } catch (error) {
      const seedData = this.seedFactory();
      await fs.writeFile(this.filePath, JSON.stringify(seedData, null, 2));
    }

    this.initialized = true;
  }

  async read() {
    await this.init();
    const raw = await fs.readFile(this.filePath, "utf8");

    try {
      return JSON.parse(raw);
    } catch (error) {
      error.message = `Failed to parse datastore file at ${this.filePath}: ${error.message}`;
      throw error;
    }
  }

  async write(mutator) {
    return this.#runExclusive(async () => {
      const current = await this.read();
      const draft = cloneData(current);
      const maybeReplacement = await mutator(draft);
      const nextData = maybeReplacement === undefined ? draft : maybeReplacement;

      nextData.meta = {
        ...nextData.meta,
        lastPersistedAt: new Date().toISOString()
      };

      await this.#writeFileAtomically(JSON.stringify(nextData, null, 2));
      return cloneData(nextData);
    });
  }

  async #writeFileAtomically(contents) {
    const directory = path.dirname(this.filePath);
    const tempFilePath = path.join(
      directory,
      `.${path.basename(this.filePath)}.${process.pid}.${crypto.randomUUID()}.tmp`
    );

    await fs.writeFile(tempFilePath, contents);
    await fs.rename(tempFilePath, this.filePath);
  }

  async #runExclusive(operation) {
    const result = this.queue.then(operation, operation);
    this.queue = result.catch(() => {});
    return result;
  }
}

module.exports = {
  DataStore
};
