function buildSeedData() {
  const now = new Date().toISOString();

  return {
    meta: {
      seededAt: now,
      note: "Development seed data with fixed tokens for mock authentication."
    },
    users: [
      {
        id: "usr_admin_001",
        name: "Ava Admin",
        email: "admin@finance.local",
        role: "admin",
        status: "active",
        token: "admin-token",
        createdAt: now,
        updatedAt: now
      },
      {
        id: "usr_analyst_001",
        name: "Nora Analyst",
        email: "analyst@finance.local",
        role: "analyst",
        status: "active",
        token: "analyst-token",
        createdAt: now,
        updatedAt: now
      },
      {
        id: "usr_viewer_001",
        name: "Victor Viewer",
        email: "viewer@finance.local",
        role: "viewer",
        status: "active",
        token: "viewer-token",
        createdAt: now,
        updatedAt: now
      },
      {
        id: "usr_inactive_001",
        name: "Iris Inactive",
        email: "inactive@finance.local",
        role: "viewer",
        status: "inactive",
        token: "inactive-token",
        createdAt: now,
        updatedAt: now
      }
    ],
    records: [
      {
        id: "rec_001",
        amountCents: 125000,
        type: "income",
        category: "Salary",
        date: "2026-01-05",
        notes: "January salary",
        createdBy: "usr_admin_001",
        createdAt: now,
        updatedAt: now,
        deletedAt: null
      },
      {
        id: "rec_002",
        amountCents: 18500,
        type: "expense",
        category: "Rent",
        date: "2026-01-06",
        notes: "Office rent",
        createdBy: "usr_admin_001",
        createdAt: now,
        updatedAt: now,
        deletedAt: null
      },
      {
        id: "rec_003",
        amountCents: 42000,
        type: "income",
        category: "Consulting",
        date: "2026-02-10",
        notes: "Client advisory retainer",
        createdBy: "usr_admin_001",
        createdAt: now,
        updatedAt: now,
        deletedAt: null
      },
      {
        id: "rec_004",
        amountCents: 9600,
        type: "expense",
        category: "Software",
        date: "2026-02-15",
        notes: "Analytics tools",
        createdBy: "usr_admin_001",
        createdAt: now,
        updatedAt: now,
        deletedAt: null
      },
      {
        id: "rec_005",
        amountCents: 130500,
        type: "income",
        category: "Salary",
        date: "2026-03-05",
        notes: "March salary",
        createdBy: "usr_admin_001",
        createdAt: now,
        updatedAt: now,
        deletedAt: null
      },
      {
        id: "rec_006",
        amountCents: 12300,
        type: "expense",
        category: "Marketing",
        date: "2026-03-14",
        notes: "Campaign spend",
        createdBy: "usr_admin_001",
        createdAt: now,
        updatedAt: now,
        deletedAt: null
      }
    ]
  };
}

module.exports = {
  buildSeedData
};
