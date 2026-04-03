const { validationError } = require("../../core/errors");
const { readSingularQueryParam } = require("../../core/validation");

function createDashboardService({ recordService }) {
  function summarizeTotals(records) {
    return records.reduce(
      (totals, record) => {
        if (record.type === "income") {
          totals.totalIncome += record.amountCents;
        } else {
          totals.totalExpenses += record.amountCents;
        }

        totals.netBalance = totals.totalIncome - totals.totalExpenses;
        return totals;
      },
      {
        totalIncome: 0,
        totalExpenses: 0,
        netBalance: 0
      }
    );
  }

  function summarizeByCategory(records) {
    const groups = new Map();

    for (const record of records) {
      const key = `${record.type}:${record.category}`;
      const current = groups.get(key) || {
        category: record.category,
        type: record.type,
        totalAmount: 0,
        entryCount: 0
      };

      current.totalAmount += record.amountCents;
      current.entryCount += 1;
      groups.set(key, current);
    }

    return [...groups.values()]
      .map((entry) => ({
        ...entry,
        totalAmount: Number((entry.totalAmount / 100).toFixed(2))
      }))
      .sort((left, right) => right.totalAmount - left.totalAmount);
  }

  function summarizeRecentActivity(records, limit = 5) {
    return records.slice(0, limit).map((record) => ({
      id: record.id,
      amount: Number((record.amountCents / 100).toFixed(2)),
      type: record.type,
      category: record.category,
      date: record.date,
      notes: record.notes
    }));
  }

  function summarizeTrends(records, groupBy = "month", points = 6) {
    const buckets = new Map();

    for (const record of records) {
      const key = groupBy === "week" ? weekKey(record.date) : record.date.slice(0, 7);
      const current = buckets.get(key) || {
        period: key,
        income: 0,
        expense: 0,
        netBalance: 0
      };

      if (record.type === "income") {
        current.income += record.amountCents;
      } else {
        current.expense += record.amountCents;
      }

      current.netBalance = current.income - current.expense;
      buckets.set(key, current);
    }

    return [...buckets.values()]
      .sort((left, right) => left.period.localeCompare(right.period))
      .slice(-points)
      .map((entry) => ({
        period: entry.period,
        income: Number((entry.income / 100).toFixed(2)),
        expense: Number((entry.expense / 100).toFixed(2)),
        netBalance: Number((entry.netBalance / 100).toFixed(2))
      }));
  }

  async function getSummary(query) {
    const { filters, records } = await recordService.getRecordsForDashboard(query);
    const totals = summarizeTotals(records);

    return {
      filters: {
        from: filters.from || null,
        to: filters.to || null
      },
      totals: {
        totalIncome: Number((totals.totalIncome / 100).toFixed(2)),
        totalExpenses: Number((totals.totalExpenses / 100).toFixed(2)),
        netBalance: Number((totals.netBalance / 100).toFixed(2))
      },
      categoryTotals: summarizeByCategory(records),
      recentActivity: summarizeRecentActivity(records),
      monthlyTrend: summarizeTrends(records, "month", 6)
    };
  }

  async function getTrends(query) {
    const errors = [];
    const groupByValue = readSingularQueryParam(query, "groupBy", errors);
    const pointsValue = readSingularQueryParam(query, "points", errors);

    let groupBy = "month";
    if (groupByValue !== undefined) {
      if (!["month", "week"].includes(groupByValue)) {
        errors.push({
          field: "groupBy",
          message: "Group by must be either month or week."
        });
      } else {
        groupBy = groupByValue;
      }
    }

    const points = pointsValue === undefined ? (groupBy === "week" ? 8 : 6) : Number(pointsValue);
    if (!Number.isInteger(points) || points < 1 || points > 52) {
      errors.push({
        field: "points",
        message: "Points must be an integer between 1 and 52."
      });
    }

    if (errors.length > 0) {
      throw validationError(errors);
    }

    const { records } = await recordService.getRecordsForDashboard(query);

    return {
      groupBy,
      points,
      items: summarizeTrends(records, groupBy, points)
    };
  }

  return {
    getSummary,
    getTrends
  };
}

function weekKey(isoDate) {
  const date = new Date(`${isoDate}T00:00:00.000Z`);
  const target = new Date(date.valueOf());
  const dayNumber = (date.getUTCDay() + 6) % 7;

  target.setUTCDate(target.getUTCDate() - dayNumber + 3);

  const firstThursday = new Date(Date.UTC(target.getUTCFullYear(), 0, 4));
  const firstThursdayDay = (firstThursday.getUTCDay() + 6) % 7;
  firstThursday.setUTCDate(firstThursday.getUTCDate() - firstThursdayDay + 3);

  const diffInWeeks = 1 + Math.round((target - firstThursday) / (7 * 24 * 60 * 60 * 1000));
  return `${target.getUTCFullYear()}-W${String(diffInWeeks).padStart(2, "0")}`;
}

module.exports = {
  createDashboardService
};
