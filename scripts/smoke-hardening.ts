type Scenario =
  | "order-intent-write"
  | "create-order-from-intent"
  | "order-status-update"
  | "communication-retry-processor"
  | "track-order-lookup";

const scenario = (process.argv[2] as Scenario | undefined) ?? "order-intent-write";
const baseUrl = (process.env.SMOKE_BASE_URL ?? "http://localhost:3000").replace(/\/+$/, "");

function fail(message: string): never {
  throw new Error(`[smoke] ${message}`);
}

async function parseJson<T>(response: Response): Promise<T> {
  const json = (await response.json().catch(() => null)) as T | null;
  if (!json) fail(`Expected JSON response from ${response.url}`);
  return json;
}

async function loginAdmin(): Promise<string> {
  const password = process.env.SMOKE_ADMIN_PASSWORD?.trim();
  const email = process.env.SMOKE_ADMIN_EMAIL?.trim();
  if (!password) {
    fail("SMOKE_ADMIN_PASSWORD is required for admin API smoke tests.");
  }

  const response = await fetch(`${baseUrl}/api/admin/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(email ? { email, password } : { password }),
  });
  if (!response.ok) {
    const body = await response.text();
    fail(`Admin login failed (${response.status}): ${body}`);
  }

  const setCookie = response.headers.get("set-cookie");
  if (!setCookie) fail("Admin login succeeded but no session cookie was returned.");
  return setCookie.split(";")[0];
}

async function createOrder(cookie: string): Promise<{ id: string; phone: string }> {
  const phone = process.env.SMOKE_CUSTOMER_PHONE?.trim() || "03001234567";
  const payload = {
    productSlug: "fly-high-swaddle",
    productName: "Fly High Swaddle",
    category: "Swaddle",
    pricePkr: 1500,
    quantity: 1,
    customerName: "Smoke Test Customer",
    customerPhone: phone,
    sourcePage: "/smoke-test",
    notes: "Smoke test order",
  };

  const response = await fetch(`${baseUrl}/api/admin/orders`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Cookie: cookie,
    },
    body: JSON.stringify(payload),
  });
  const json = await parseJson<{ ok: boolean; orderId?: string; error?: string }>(response);
  if (!response.ok || !json.ok || !json.orderId) {
    fail(`Create order failed: ${json.error ?? `HTTP ${response.status}`}`);
  }
  return { id: json.orderId, phone };
}

async function smokeOrderIntentWrite() {
  const response = await fetch(`${baseUrl}/api/order-intent`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      productSlug: "fly-high-swaddle",
      productName: "Fly High Swaddle",
      category: "Swaddle",
      pricePkr: 1500,
      sourcePage: "/smoke-test",
      timestamp: new Date().toISOString(),
    }),
  });
  const json = await parseJson<{ ok: boolean }>(response);
  if (!response.ok || !json.ok) fail("Order intent write failed.");
  console.log("[smoke] order intent write ok");
}

async function smokeCreateOrderFromIntent() {
  const cookie = await loginAdmin();
  const created = await createOrder(cookie);
  console.log(`[smoke] create order from intent ok (${created.id})`);
}

async function smokeOrderStatusUpdate() {
  const cookie = await loginAdmin();
  const created = await createOrder(cookie);
  const response = await fetch(`${baseUrl}/api/admin/orders/${created.id}/status`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Cookie: cookie },
    body: JSON.stringify({ status: "contacted", note: "Smoke status update" }),
  });
  const json = await parseJson<{ ok: boolean; error?: string }>(response);
  if (!response.ok || !json.ok) fail(`Order status update failed: ${json.error ?? "unknown"}`);
  console.log(`[smoke] order status update ok (${created.id})`);
}

async function smokeCommunicationRetryProcessor() {
  const cookie = await loginAdmin();
  const response = await fetch(`${baseUrl}/api/admin/communications/process-retries`, {
    method: "POST",
    headers: { Cookie: cookie },
  });
  const json = await parseJson<{ ok: boolean; error?: string }>(response);
  if (!response.ok || !json.ok) fail(`Communication retry processor failed: ${json.error ?? "unknown"}`);
  console.log("[smoke] communication retry processor ok");
}

async function smokeTrackOrderLookup() {
  const cookie = await loginAdmin();
  const created = await createOrder(cookie);
  const shortRef = created.id.slice(0, 8);
  const response = await fetch(`${baseUrl}/api/track-order`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ orderRef: shortRef, phone: created.phone }),
  });
  const json = await parseJson<{ ok: boolean; error?: string }>(response);
  if (!response.ok || !json.ok) fail(`Track order lookup failed: ${json.error ?? "unknown"}`);
  console.log(`[smoke] track order lookup ok (${shortRef})`);
}

const runners: Record<Scenario, () => Promise<void>> = {
  "order-intent-write": smokeOrderIntentWrite,
  "create-order-from-intent": smokeCreateOrderFromIntent,
  "order-status-update": smokeOrderStatusUpdate,
  "communication-retry-processor": smokeCommunicationRetryProcessor,
  "track-order-lookup": smokeTrackOrderLookup,
};

async function main() {
  const run = runners[scenario];
  if (!run) {
    fail(`Unknown scenario: ${scenario}`);
  }
  await run();
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
