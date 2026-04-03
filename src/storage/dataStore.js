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
    this.initPromise = null;
    this.queue = Promise.resolve();
    this.snapshot = null;
  }

  async init() {
    if (this.initialized) {
      return;
    }

    if (!this.initPromise) {
      this.initPromise = this.#initialize();
    }

    await this.initPromise;
  }

  async read() {
    await this.init();
    return cloneData(this.snapshot);
  }

  async write(mutator) {
    return this.#runExclusive(async () => {
      await this.init();
      const draft = cloneData(this.snapshot);
      const maybeReplacement = await mutator(draft);
      const nextData = maybeReplacement === undefined ? draft : maybeReplacement;

      nextData.meta = {
        ...nextData.meta,
        lastPersistedAt: new Date().toISOString()
      };

      await this.#writeFileAtomically(JSON.stringify(nextData, null, 2));
      this.snapshot = cloneData(nextData);
      return cloneData(nextData);
    });
  }

  async #initialize() {
    await fs.mkdir(path.dirname(this.filePath), { recursive: true });

    try {
      await fs.access(this.filePath);
    } catch (error) {
      const seedData = this.seedFactory();
      await fs.writeFile(this.filePath, JSON.stringify(seedData, null, 2));
    }

    this.snapshot = await this.#readFile();
    this.initialized = true;
  }

  async #readFile() {
    const raw = await fs.readFile(this.filePath, "utf8");

    try {
      return JSON.parse(raw);
    } catch (error) {
      error.message = `Failed to parse datastore file at ${this.filePath}: ${error.message}`;
      throw error;
    }
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
