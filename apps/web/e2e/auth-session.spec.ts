import { expect, test, type Browser, type Page } from "@playwright/test";

function uniqueEmail(prefix: string): string {
  return `${prefix}-${Date.now()}-${Math.floor(Math.random() * 10000)}@example.com`;
}

async function registerAndOpenDashboard(
  page: Page,
  overrides?: { email?: string; password?: string; name?: string }
): Promise<{ email: string; password: string }> {
  const email = overrides?.email ?? uniqueEmail("user");
  const password = overrides?.password ?? "Password12345!";
  const name = overrides?.name ?? "Playwright User";

  page.on("dialog", (dialog) => dialog.accept());
  await page.context().addInitScript(() => {
    localStorage.setItem("wd_toured", "1");
  });

  await page.goto("/register");
  await page.getByLabel("Full Name").fill(name);
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password").fill(password);
  await page.getByRole("button", { name: "Create Account" }).click();
  await expect(page).toHaveURL(/\/dashboard/, { timeout: 15000 });
  await expect(page.getByText("AI Work Diary")).toBeVisible();

  return { email, password };
}

async function login(page: Page, email: string, password: string): Promise<void> {
  page.on("dialog", (dialog) => dialog.accept());
  await page.context().addInitScript(() => {
    localStorage.setItem("wd_toured", "1");
  });

  await page.goto("/login");
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password").fill(password);
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page).toHaveURL(/\/dashboard/, { timeout: 15000 });
}

test("register, sign out, and sign in again", async ({ page }) => {
  const creds = await registerAndOpenDashboard(page);
  await page.getByRole("button", { name: "Sign out" }).click();
  await expect(page).toHaveURL(/\/login/);

  await page.getByLabel("Email").fill(creds.email);
  await page.getByLabel("Password").fill(creds.password);
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page).toHaveURL(/\/dashboard/);
});

test("unauthorized sessions API returns 401", async ({ page }) => {
  const response = await page.request.get("/api/sessions");
  expect(response.status()).toBe(401);
});

test("invalid refresh payload returns 401", async ({ page }) => {
  await registerAndOpenDashboard(page);
  const sessionId = await page.evaluate(() => localStorage.getItem("wd_session_id"));
  expect(sessionId).toBeTruthy();

  const response = await page.request.post("/api/auth/refresh", {
    data: {
      session_id: sessionId,
      refresh_token: "invalid-refresh-token",
    },
  });

  expect(response.status()).toBe(401);
});

test("multi-session management supports revoke and sign out all", async ({
  browser,
  page,
}) => {
  const creds = await registerAndOpenDashboard(page);
  const secondPage = await createSecondSession(browser, creds.email, creds.password);

  await page.getByRole("button", { name: "🖥 Sessions" }).click();
  await expect(page.getByRole("heading", { name: "Active Sessions" })).toBeVisible();
  await expect(page.getByText("This device")).toBeVisible();
  await expect(page.getByRole("button", { name: "Revoke" })).toBeVisible();

  await page.getByRole("button", { name: "Revoke" }).first().click();
  await expect(page.getByRole("button", { name: "Revoke" })).toHaveCount(0);

  await page.getByRole("button", { name: "Sign out all devices" }).click();
  await expect(page).toHaveURL(/\/login/);

  await secondPage.reload();
  await expect(secondPage).toHaveURL(/\/login/, { timeout: 15000 });
  await secondPage.close();
});

test("shows resilient error state when activities API fails", async ({ page }) => {
  await page.context().route("**/api/activities?limit=50", async (route) => {
    await route.fulfill({
      status: 500,
      contentType: "application/json",
      body: JSON.stringify({ error: "boom" }),
    });
  });
  await registerAndOpenDashboard(page);
  await expect(page.getByText("Could not load activities right now.")).toBeVisible(
    {
      timeout: 10000,
    }
  );
});

test("shows resilient error state when sessions API fails", async ({ page }) => {
  await registerAndOpenDashboard(page);
  await page.context().route("**/api/sessions", async (route) => {
    await route.fulfill({
      status: 500,
      contentType: "application/json",
      body: JSON.stringify({ error: "boom" }),
    });
  });

  await page.getByRole("button", { name: "🖥 Sessions" }).click();
  await expect(page.getByText("Could not load sessions.")).toBeVisible({
    timeout: 10000,
  });
});

async function createSecondSession(
  browser: Browser,
  email: string,
  password: string
): Promise<Page> {
  const context = await browser.newContext();
  await context.addInitScript(() => {
    localStorage.setItem("wd_toured", "1");
  });
  const page = await context.newPage();
  await login(page, email, password);
  return page;
}
