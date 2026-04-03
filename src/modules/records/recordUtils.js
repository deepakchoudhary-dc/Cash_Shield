const { validationError } = require("../../core/errors");
const { addUnexpectedFieldErrors, readSingularQueryParam } = require("../../core/validation");

const RECORD_TYPES = ["income", "expense"];
const RECORD_FIELDS = ["amount", "type", "category", "date", "notes"];
const RECORD_SORTS = ["asc", "desc"];

function serializeRecord(record) {
  return {
    id: record.id,
    amount: Number((record.amountCents / 100).toFixed(2)),
    type: record.type,
    category: record.category,
    date: record.date,
    notes: record.notes,
    createdBy: record.createdBy,
    createdAt: record.createdAt,
    updatedAt: record.updatedAt,
    deletedAt: record.deletedAt
  };
}

function isValidDateString(value) {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return false;
  }

  const [year, month, day] = value.split("-").map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));

  return (
    date.getUTCFullYear() === year &&
    date.getUTCMonth() === month - 1 &&
    date.getUTCDate() === day
  );
}

function parseAmountToCents(value) {
  const normalized = String(value).trim();

  if (!/^(?:0|[1-9]\d*)(?:\.\d{1,2})?$/.test(normalized)) {
    throw validationError([
      {
        field: "amount",
        message: "Amount must be a positive number with up to 2 decimal places."
      }
    ]);
  }

  const [wholePart, fractionalPart = ""] = normalized.split(".");
  const cents = Number(wholePart) * 100 + Number(fractionalPart.padEnd(2, "0"));

  if (!Number.isSafeInteger(cents)) {
    throw validationError([
      {
        field: "amount",
        message: "Amount is too large to store safely."
      }
    ]);
  }

  if (cents <= 0) {
    throw validationError([
      {
        field: "amount",
        message: "Amount must be greater than 0."
      }
    ]);
  }

  return cents;
}

function validateRecordPayload(payload, { partial = false } = {}) {
  const errors = [];
  const next = {};

  addUnexpectedFieldErrors(payload, RECORD_FIELDS, errors);

  if (!partial || Object.prototype.hasOwnProperty.call(payload, "amount")) {
    try {
      next.amountCents = parseAmountToCents(payload.amount);
    } catch (error) {
      if (error.details) {
        errors.push(...error.details);
      } else {
        throw error;
      }
    }
  }

  if (!partial || Object.prototype.hasOwnProperty.call(payload, "type")) {
    if (!RECORD_TYPES.includes(payload.type)) {
      errors.push({
        field: "type",
        message: "Type must be either income or expense."
      });
    } else {
      next.type = payload.type;
    }
  }

  if (!partial || Object.prototype.hasOwnProperty.call(payload, "category")) {
    if (typeof payload.category !== "string" || payload.category.trim().length < 2) {
      errors.push({
        field: "category",
        message: "Category must be at least 2 characters long."
      });
    } else {
      next.category = payload.category.trim();
    }
  }

  if (!partial || Object.prototype.hasOwnProperty.call(payload, "date")) {
    if (!isValidDateString(payload.date)) {
      errors.push({
        field: "date",
        message: "Date must be a valid ISO date in YYYY-MM-DD format."
      });
    } else {
      next.date = payload.date;
    }
  }

  if (Object.prototype.hasOwnProperty.call(payload, "notes")) {
    if (payload.notes !== null && typeof payload.notes !== "string") {
      errors.push({
        field: "notes",
        message: "Notes must be a string when provided."
      });
    } else if (typeof payload.notes === "string" && payload.notes.length > 500) {
      errors.push({
        field: "notes",
        message: "Notes cannot exceed 500 characters."
      });
    } else {
      next.notes = payload.notes ? payload.notes.trim() : "";
    }
  } else if (!partial) {
    next.notes = "";
  }

  if (errors.length > 0) {
    throw validationError(errors);
  }

  return next;
}

function normalizeRecordCriteria(query) {
  const filters = {};
  const errors = [];

  const type = readSingularQueryParam(query, "type", errors);
  if (type !== undefined) {
    if (!RECORD_TYPES.includes(type)) {
      errors.push({
        field: "type",
        message: "Filter type must be either income or expense."
      });
    } else {
      filters.type = type;
    }
  }

  const category = readSingularQueryParam(query, "category", errors);
  if (category !== undefined) {
    if (!category) {
      errors.push({
        field: "category",
        message: "Category filter cannot be empty."
      });
    } else {
      filters.category = category.toLowerCase();
    }
  }

  const search = readSingularQueryParam(query, "q", errors);
  if (search !== undefined) {
    if (!search) {
      errors.push({
        field: "q",
        message: "Search query cannot be empty."
      });
    } else {
      filters.search = search.toLowerCase();
    }
  }

  const from = readSingularQueryParam(query, "from", errors);
  if (from !== undefined) {
    if (!isValidDateString(from)) {
      errors.push({
        field: "from",
        message: "From date must use YYYY-MM-DD format."
      });
    } else {
      filters.from = from;
    }
  }

  const to = readSingularQueryParam(query, "to", errors);
  if (to !== undefined) {
    if (!isValidDateString(to)) {
      errors.push({
        field: "to",
        message: "To date must use YYYY-MM-DD format."
      });
    } else {
      filters.to = to;
    }
  }

  if (filters.from && filters.to && filters.from > filters.to) {
    errors.push({
      field: "dateRange",
      message: "From date must be earlier than or equal to to date."
    });
  }

  if (errors.length > 0) {
    throw validationError(errors);
  }

  return filters;
}

function normalizeRecordFilters(query, options = {}) {
  const filters = {
    ...normalizeRecordCriteria(query)
  };
  const errors = [];
  const defaultPage = options.defaultPage || 1;
  const defaultPageSize = options.defaultPageSize || 10;
  const maxPageSize = options.maxPageSize || 100;

  const pageValue = readSingularQueryParam(query, "page", errors);
  const pageSizeValue = readSingularQueryParam(query, "pageSize", errors);
  const sortValue = readSingularQueryParam(query, "sort", errors);

  const page = pageValue === undefined ? defaultPage : Number(pageValue);
  const pageSize = pageSizeValue === undefined ? defaultPageSize : Number(pageSizeValue);

  if (!Number.isInteger(page) || page < 1) {
    errors.push({
      field: "page",
      message: "Page must be a positive integer."
    });
  }

  if (!Number.isInteger(pageSize) || pageSize < 1 || pageSize > maxPageSize) {
    errors.push({
      field: "pageSize",
      message: `Page size must be between 1 and ${maxPageSize}.`
    });
  }

  filters.page = page;
  filters.pageSize = pageSize;
  if (sortValue === undefined) {
    filters.sort = "desc";
  } else if (!RECORD_SORTS.includes(sortValue)) {
    errors.push({
      field: "sort",
      message: "Sort must be either asc or desc."
    });
  } else {
    filters.sort = sortValue;
  }

  if (errors.length > 0) {
    throw validationError(errors);
  }

  return filters;
}

function normalizeDashboardRecordFilters(query) {
  return normalizeRecordCriteria(query);
}

function applyRecordFilters(records, filters) {
  return records.filter((record) => {
    if (record.deletedAt) {
      return false;
    }

    if (filters.type && record.type !== filters.type) {
      return false;
    }

    if (filters.category && record.category.toLowerCase() !== filters.category) {
      return false;
    }

    if (filters.search) {
      const haystack = `${record.category} ${record.notes}`.toLowerCase();
      if (!haystack.includes(filters.search)) {
        return false;
      }
    }

    if (filters.from && record.date < filters.from) {
      return false;
    }

    if (filters.to && record.date > filters.to) {
      return false;
    }

    return true;
  });
}

function sortRecords(records, sort = "desc") {
  const direction = sort === "asc" ? 1 : -1;

  return [...records].sort((left, right) => {
    const leftKey = `${left.date}:${left.createdAt}`;
    const rightKey = `${right.date}:${right.createdAt}`;

    if (leftKey === rightKey) {
      return 0;
    }

    return leftKey > rightKey ? direction : -direction;
  });
}

module.exports = {
  RECORD_TYPES,
  applyRecordFilters,
  isValidDateString,
  normalizeDashboardRecordFilters,
  normalizeRecordFilters,
  serializeRecord,
  sortRecords,
  validateRecordPayload
};
