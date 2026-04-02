const crypto = require("node:crypto");
const { notFound, validationError } = require("../../core/errors");
const {
  applyRecordFilters,
  normalizeRecordFilters,
  serializeRecord,
  sortRecords,
  validateRecordPayload
} = require("./recordUtils");

function createRecordService({ store }) {
  async function listRecords(query) {
    const filters = normalizeRecordFilters(query);
    const data = await store.read();
    const filteredRecords = sortRecords(applyRecordFilters(data.records, filters), filters.sort);

    const startIndex = (filters.page - 1) * filters.pageSize;
    const items = filteredRecords
      .slice(startIndex, startIndex + filters.pageSize)
      .map(serializeRecord);

    return {
      items,
      pagination: {
        page: filters.page,
        pageSize: filters.pageSize,
        totalItems: filteredRecords.length,
        totalPages: Math.max(1, Math.ceil(filteredRecords.length / filters.pageSize))
      }
    };
  }

  async function getRecordById(recordId) {
    const data = await store.read();
    const record = data.records.find((candidate) => candidate.id === recordId && !candidate.deletedAt);

    if (!record) {
      throw notFound("Financial record not found.");
    }

    return serializeRecord(record);
  }

  async function createRecord(payload, actor) {
    const validated = validateRecordPayload(payload);
    const timestamp = new Date().toISOString();
    const nextRecord = {
      id: `rec_${crypto.randomUUID()}`,
      ...validated,
      createdBy: actor.id,
      createdAt: timestamp,
      updatedAt: timestamp,
      deletedAt: null
    };

    await store.write((data) => {
      data.records.push(nextRecord);
    });

    return serializeRecord(nextRecord);
  }

  async function updateRecord(recordId, payload) {
    if (!payload || Object.keys(payload).length === 0) {
      throw validationError([
        {
          field: "body",
          message: "At least one field must be provided for update."
        }
      ]);
    }

    const validated = validateRecordPayload(payload, { partial: true });
    let updatedRecord = null;

    await store.write((data) => {
      const record = data.records.find((candidate) => candidate.id === recordId && !candidate.deletedAt);

      if (!record) {
        throw notFound("Financial record not found.");
      }

      Object.assign(record, validated, {
        updatedAt: new Date().toISOString()
      });

      updatedRecord = { ...record };
    });

    return serializeRecord(updatedRecord);
  }

  async function deleteRecord(recordId) {
    let deleted = false;

    await store.write((data) => {
      const record = data.records.find((candidate) => candidate.id === recordId && !candidate.deletedAt);

      if (!record) {
        throw notFound("Financial record not found.");
      }

      record.deletedAt = new Date().toISOString();
      record.updatedAt = record.deletedAt;
      deleted = true;
    });

    return deleted;
  }

  async function getRecordsForDashboard(query = {}) {
    const filters = normalizeRecordFilters(
      {
        ...query,
        page: 1,
        pageSize: 1000
      },
      {
        defaultPage: 1,
        defaultPageSize: 1000,
        maxPageSize: 10000
      }
    );
    const data = await store.read();
    return sortRecords(applyRecordFilters(data.records, filters), filters.sort);
  }

  return {
    createRecord,
    deleteRecord,
    getRecordById,
    getRecordsForDashboard,
    listRecords,
    updateRecord
  };
}

module.exports = {
  createRecordService
};
