const BASE_URL = "http://127.0.0.1:3000";

const tokenInput = document.getElementById("auth-token");
const healthStatus = document.getElementById("health-status");
const healthDetail = document.getElementById("health-detail");
const usersList = document.getElementById("users-list");
const recordsList = document.getElementById("records-list");
const dashboardSummary = document.getElementById("dashboard-summary");
const dashboardTrend = document.getElementById("dashboard-trend");
const recordFormMessage = document.getElementById("record-form-message");

const refreshAll = document.getElementById("refresh-all");
const refreshHealth = document.getElementById("refresh-health");
const refreshUsers = document.getElementById("refresh-users");
const refreshRecords = document.getElementById("refresh-records");
const refreshDashboard = document.getElementById("refresh-dashboard");

const recordsFilter = document.getElementById("records-filter");
const recordForm = document.getElementById("record-form");

function authHeaders() {
  const token = tokenInput.value.trim();
  return token ? { Authorization: `Bearer ${token}` } : {};
}

async function fetchJson(path, opts = {}) {
  const response = await fetch(`${BASE_URL}${path}`, {
    ...opts,
    headers: {
      "Content-Type": opts.body ? "application/json" : undefined,
      ...authHeaders(),
      ...opts.headers
    },
    body: opts.body ? JSON.stringify(opts.body) : opts.body
  });

  const payload = await response.json();
  if (!response.ok) {
    throw payload;
  }

  return payload;
}

function renderList(element, data, mapper) {
  element.innerHTML = "";
  if (!data.length) {
    element.textContent = "No data yet.";
    return;
  }

  data.forEach((item) => {
    const card = document.createElement("article");
    card.className = "list-item";
    card.innerHTML = mapper(item);
    element.appendChild(card);
  });
}

async function refreshHealthStatus() {
  try {
    const body = await fetchJson("/health", { method: "GET" });
    healthStatus.textContent = "ok";
    healthDetail.textContent = JSON.stringify(body);
  } catch (error) {
    healthStatus.textContent = "error";
    healthDetail.textContent = error?.error?.message || "Unable to connect";
  }
}

async function refreshUsersView() {
  try {
    const { data } = await fetchJson("/users", { method: "GET" });
    renderList(usersList, data, (user) => {
      return `
        <div><strong>${user.name}</strong> (${user.role})</div>
        <div>${user.email}</div>
        <div>${user.status}</div>
      `;
    });
  } catch (error) {
    usersList.textContent = error?.error?.message || "Not permitted";
  }
}

async function refreshRecordsView(params = {}) {
  const query = new URLSearchParams(params).toString();
  try {
    const { data } = await fetchJson(`/records${query ? `?${query}` : ""}`, { method: "GET" });
    const { items } = data;
    renderList(recordsList, items, (record) => {
      return `
        <div>${record.date} – <strong>${record.category}</strong></div>
        <div>${record.type} · $${record.amount.toFixed(2)}</div>
        <div>${record.notes || "no notes"}</div>
      `;
    });
  } catch (error) {
    recordsList.textContent = error?.error?.message || "Failed to load";
  }
}

async function refreshDashboardView() {
  try {
    const { data: summary } = await fetchJson("/dashboard/summary", { method: "GET" });
    dashboardSummary.innerHTML = `
      <div class="summary-card">
        <strong>Total Income</strong>
        <p>$${summary.totals.totalIncome.toFixed(2)}</p>
      </div>
      <div class="summary-card">
        <strong>Total Expenses</strong>
        <p>$${summary.totals.totalExpenses.toFixed(2)}</p>
      </div>
      <div class="summary-card">
        <strong>Net</strong>
        <p>$${summary.totals.netBalance.toFixed(2)}</p>
      </div>
    `;

    const { data: trends } = await fetchJson("/dashboard/trends", { method: "GET" });
    renderList(dashboardTrend, trends.items, (point) => {
      return `
        <div><strong>${point.period}</strong></div>
        <div>Income: $${point.income.toFixed(2)}</div>
        <div>Expense: $${point.expense.toFixed(2)}</div>
        <div>Net: $${point.netBalance.toFixed(2)}</div>
      `;
    });
  } catch (error) {
    dashboardSummary.textContent = error?.error?.message || "Unable to load dashboard";
    dashboardTrend.textContent = "";
  }
}

recordForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  const formData = new FormData(recordForm);
  const payload = {
    amount: Number(formData.get("amount")),
    type: formData.get("type"),
    category: formData.get("category"),
    date: formData.get("date"),
    notes: formData.get("notes")
  };

  try {
    await fetchJson("/records", { method: "POST", body: payload });
    recordFormMessage.textContent = "Record created.";
    recordFormMessage.style.color = "#22c55e";
    recordForm.reset();
    await refreshRecordsView();
    await refreshDashboardView();
  } catch (error) {
    recordFormMessage.textContent = error?.error?.message || "Unable to create record";
    recordFormMessage.style.color = "#f43f5e";
  }
});

recordsFilter.addEventListener("submit", (event) => {
  event.preventDefault();
  const formData = new FormData(recordsFilter);
  const filters = {};
  ["type", "category", "from", "to"].forEach((field) => {
    const value = formData.get(field);
    if (value) {
      filters[field] = value;
    }
  });
  refreshRecordsView(filters);
});

const refreshAllViews = () => {
  refreshHealthStatus();
  refreshUsersView();
  refreshRecordsView();
  refreshDashboardView();
};

refreshHealth.addEventListener("click", refreshHealthStatus);
refreshUsers.addEventListener("click", refreshUsersView);
refreshRecords.addEventListener("click", () => refreshRecordsView());
refreshDashboard.addEventListener("click", refreshDashboardView);
refreshAll.addEventListener("click", refreshAllViews);

refreshAllViews();
