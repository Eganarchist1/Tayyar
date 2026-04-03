const API_BASE_URL = process.env.API_BASE_URL || "http://127.0.0.1:3001";
const WEB_BASE_URL = process.env.WEB_BASE_URL || "http://127.0.0.1:3000";
const PASSWORD = process.env.DEMO_PASSWORD || "Tayyar@123";

const demoUsers = {
  admin: { email: "admin@tayyar.app", role: "ADMIN", home: "/admin" },
  merchant: { email: "owner@merchant.com", role: "MERCHANT_OWNER", home: "/merchant" },
  supervisor: { email: "supervisor@tayyar.app", role: "SUPERVISOR", home: "/supervisor/map" },
  branchManager: {
    email: "branch.manager@tayyar.app",
    role: "BRANCH_MANAGER",
    home: "/branch/orders",
  },
};

function pass(message) {
  console.log(`PASS ${message}`);
}

function fail(message) {
  console.error(`FAIL ${message}`);
}

async function expectOk(url, init, label) {
  const response = await fetch(url, init);
  if (!response.ok) {
    const body = await response.text();
    throw new Error(`${label} failed with ${response.status}: ${body}`);
  }
  return response;
}

async function postJson(url, body, headers = {}) {
  return expectOk(
    url,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...headers,
      },
      body: JSON.stringify(body),
    },
    url,
  ).then((response) => response.json());
}

async function getJson(url, token) {
  const response = await expectOk(
    url,
    {
      headers: token ? { Authorization: `Bearer ${token}` } : undefined,
    },
    url,
  );
  return response.json();
}

async function run() {
  const failures = [];

  async function step(label, fn) {
    try {
      await fn();
      pass(label);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      failures.push(`${label}: ${message}`);
      fail(`${label}: ${message}`);
    }
  }

  await step("API health responds", async () => {
    await expectOk(`${API_BASE_URL}/health`, undefined, "health");
  });

  await step("API readiness responds", async () => {
    await expectOk(`${API_BASE_URL}/health/ready`, undefined, "readiness");
  });

  await step("Web login page responds", async () => {
    await expectOk(`${WEB_BASE_URL}/login`, undefined, "login page");
  });

  await step("Protected web route redirects when no session cookie exists", async () => {
    const response = await fetch(`${WEB_BASE_URL}/admin`, { redirect: "manual" });
    if (![307, 308].includes(response.status)) {
      throw new Error(`expected redirect, got ${response.status}`);
    }
    const location = response.headers.get("location") || "";
    if (!location.includes("/login")) {
      throw new Error(`unexpected redirect target: ${location}`);
    }
  });

  const sessions = {};

  for (const [key, account] of Object.entries(demoUsers)) {
    await step(`Password login works for ${account.role}`, async () => {
      const payload = await postJson(`${API_BASE_URL}/v1/auth/login`, {
        email: account.email,
        password: PASSWORD,
      });

      if (!payload.accessToken || !payload.refreshToken || payload.user?.role !== account.role) {
        throw new Error(`unexpected session payload for ${account.email}`);
      }

      sessions[key] = payload;
    });

    await step(`Role home route responds for ${account.role}`, async () => {
      await expectOk(`${WEB_BASE_URL}${account.home}`, undefined, account.home);
    });
  }

  await step("Hero OTP flow works", async () => {
    const requestPayload = await postJson(`${API_BASE_URL}/v1/auth/otp/request`, {
      phone: "+201000000004",
    });

    if (!requestPayload.devCode) {
      throw new Error("dev OTP code not returned");
    }

    const verifyPayload = await postJson(`${API_BASE_URL}/v1/auth/otp/verify`, {
      phone: "+201000000004",
      code: requestPayload.devCode,
    });

    if (!verifyPayload.accessToken || verifyPayload.user?.role !== "HERO") {
      throw new Error("hero OTP verify did not return a hero session");
    }
  });

  await step("Activation and password-reset flow works", async () => {
    const adminToken = sessions.admin.accessToken;
    const unique = Date.now();
    const email = `smoke.user.${unique}@tayyar.app`;
    const activationPassword = "SmokePass!123";
    const resetPassword = "SmokePass!124";
    const changedPassword = "SmokePass!125";

    const created = await postJson(
      `${API_BASE_URL}/v1/admin/users`,
      {
        name: `Smoke User ${unique}`,
        email,
        role: "SUPERVISOR",
        language: "en",
      },
      { Authorization: `Bearer ${adminToken}` },
    );

    if (!created.activationUrl) {
      throw new Error("activation link was not returned for invited user");
    }

    const activationToken = new URL(created.activationUrl).searchParams.get("token");
    if (!activationToken) {
      throw new Error("activation token missing");
    }

    const activated = await postJson(`${API_BASE_URL}/v1/auth/activate`, {
      token: activationToken,
      password: activationPassword,
    });

    if (activated.user?.email !== email) {
      throw new Error("activation did not sign in the invited user");
    }

    const forgot = await postJson(`${API_BASE_URL}/v1/auth/forgot-password`, { email });
    if (!forgot.resetUrl) {
      throw new Error("reset link was not returned");
    }

    const resetToken = new URL(forgot.resetUrl).searchParams.get("token");
    if (!resetToken) {
      throw new Error("reset token missing");
    }

    await postJson(`${API_BASE_URL}/v1/auth/reset-password`, {
      token: resetToken,
      password: resetPassword,
    });

    const loggedIn = await postJson(`${API_BASE_URL}/v1/auth/login`, {
      email,
      password: resetPassword,
    });

    if (loggedIn.user?.email !== email) {
      throw new Error("password reset login did not succeed");
    }

    await postJson(
      `${API_BASE_URL}/v1/auth/change-password`,
      {
        currentPassword: resetPassword,
        nextPassword: changedPassword,
      },
      { Authorization: `Bearer ${loggedIn.accessToken}` },
    );

    const relogged = await postJson(`${API_BASE_URL}/v1/auth/login`, {
      email,
      password: changedPassword,
    });

    if (relogged.user?.email !== email) {
      throw new Error("change password login did not succeed");
    }
  });

  await step("Admin APIs respond with authenticated session", async () => {
    const token = sessions.admin.accessToken;
    await getJson(`${API_BASE_URL}/v1/auth/me`, token);
    await getJson(`${API_BASE_URL}/v1/admin/users`, token);
    await getJson(`${API_BASE_URL}/v1/admin/heroes`, token);
    await getJson(`${API_BASE_URL}/v1/admin/zones`, token);
    await getJson(`${API_BASE_URL}/v1/admin/branches`, token);
  });

  await step("Merchant APIs respond with authenticated session", async () => {
    const token = sessions.merchant.accessToken;
    await getJson(`${API_BASE_URL}/v1/auth/me`, token);
    await getJson(`${API_BASE_URL}/v1/merchants/bootstrap`, token);
    await getJson(`${API_BASE_URL}/v1/merchants/branches`, token);
    await getJson(`${API_BASE_URL}/v1/merchants/orders`, token);
  });

  await step("Supervisor APIs respond with authenticated session", async () => {
    const token = sessions.supervisor.accessToken;
    await getJson(`${API_BASE_URL}/v1/auth/me`, token);
    await getJson(`${API_BASE_URL}/v1/supervisors/map/live`, token);
    await getJson(`${API_BASE_URL}/v1/supervisors/alerts`, token);
  });

  await step("Hero device registration responds", async () => {
    await postJson(
      `${API_BASE_URL}/v1/heroes/me/device`,
      {
        installationId: `smoke-${Date.now()}`,
        platform: "web",
        appVersion: "smoke",
      },
      {
        "x-dev-role": "HERO",
        "x-dev-email": "hero@tayyar.app",
      },
    );
  });

  await step("Critical web routes respond", async () => {
    const criticalRoutes = [
      "/merchant/orders/new",
      "/merchant/branches",
      "/admin/users",
      "/admin/heroes",
      "/admin/zones",
      "/admin/map",
      "/supervisor/map",
      "/branch/orders",
    ];

    for (const route of criticalRoutes) {
      await expectOk(`${WEB_BASE_URL}${route}`, undefined, route);
    }
  });

  if (failures.length) {
    console.error("");
    console.error("Launch-core smoke failed:");
    for (const failure of failures) {
      console.error(`- ${failure}`);
    }
    process.exit(1);
  }

  console.log("");
  console.log("Launch-core smoke passed.");
}

run().catch((error) => {
  const message = error instanceof Error ? error.stack || error.message : String(error);
  console.error(message);
  process.exit(1);
});
