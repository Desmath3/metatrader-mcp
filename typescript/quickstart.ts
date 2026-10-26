// Tickwire quickstart in TypeScript: a free sandbox MT5 account, one order, one close.
//
// Uses only the public Tickwire API and the built-in fetch (Node 18+). No dependencies.
// No card, no broker login, no real money: the sandbox is a simulated terminal.
//
//   npx tsx quickstart.ts
//
// To reuse a sandbox you already have, set both:
//
//   export TICKWIRE_SANDBOX_KEY=twsk_...
//   export TICKWIRE_ACCOUNT_ID=acc_...
//
// Docs: https://tickwire.io/docs/sandbox/

import { randomUUID } from "node:crypto";

const API = (process.env.TICKWIRE_API_URL ?? "https://api.tickwire.io").replace(/\/+$/, "");

type Json = Record<string, any>;

interface TradeResult {
  outcome?: "applied" | "rejected" | "held" | "unknown" | "no_change";
  numericCode?: number;
  stringCode?: string;
  message?: string;
  orderId?: string;
  positionId?: string;
  error?: string;
}

async function call(
  method: string,
  path: string,
  key?: string,
  body?: Json,
  headers: Record<string, string> = {},
): Promise<{ status: number; body: any }> {
  const h: Record<string, string> = { "content-type": "application/json", accept: "application/json", ...headers };
  if (key) h["auth-token"] = key;
  const res = await fetch(API + path, {
    method,
    headers: h,
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const text = await res.text();
  let parsed: any = {};
  try {
    parsed = text ? JSON.parse(text) : {};
  } catch {
    parsed = { error: "http_error", message: text };
  }
  return { status: res.status, body: parsed };
}

function fail(message: string): never {
  console.error(message);
  process.exit(1);
}

async function getSandbox(): Promise<{ key: string; account: string }> {
  const key = process.env.TICKWIRE_SANDBOX_KEY;
  const account = process.env.TICKWIRE_ACCOUNT_ID;
  if (key && account) {
    if (!key.startsWith("twsk_")) fail("This quickstart only runs on a sandbox key (twsk_...).");
    return { key, account };
  }
  const { status, body } = await call("POST", "/v1/sandbox/signup", undefined, { platform: "mt5" });
  if (status !== 201 && status !== 200) fail(`Sandbox sign-up failed: ${status} ${JSON.stringify(body)}`);
  console.log("New sandbox. The key is shown once, so keep it:");
  console.log(`  export TICKWIRE_SANDBOX_KEY=${body.apiKey}`);
  console.log(`  export TICKWIRE_ACCOUNT_ID=${body.account.id}`);
  return { key: body.apiKey, account: body.account.id };
}

/** Wait until the account reports CONNECTED. Never assume it. */
async function waitConnected(key: string, account: string, timeoutMs = 120_000): Promise<void> {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    const { status, body } = await call("GET", `/users/current/accounts/${account}`, key);
    if (status === 200 && body.connectionStatus === "CONNECTED") return;
    await new Promise((r) => setTimeout(r, 2000));
  }
  fail("The account did not report CONNECTED in time. Check its health before trading.");
}

/** Send one order with its own idempotency key, actor and reason. */
async function trade(key: string, account: string, order: Json, reason: string): Promise<TradeResult> {
  const { status, body } = await call("POST", `/users/current/accounts/${account}/trade`, key, order, {
    "Idempotency-Key": `quickstart-${randomUUID()}`,
    "X-Actor": "quickstart",
    "X-Reason": reason,
  });
  if (status >= 400 && body.outcome === undefined) fail(`Order refused: ${status} ${body.error} ${body.message}`);
  return body as TradeResult;
}

async function main(): Promise<void> {
  const { key, account } = await getSandbox();
  await waitConnected(key, account);

  const info = (await call("GET", `/users/current/accounts/${account}/account-information`, key)).body;
  console.log(`Balance ${info.balance} ${info.currency}, broker time ${info.brokerTime} (not UTC)`);

  const buy = await trade(
    key,
    account,
    { actionType: "ORDER_TYPE_BUY", symbol: "EURUSD", volume: 0.01 },
    "quickstart: buy 0.01 EURUSD on the sandbox",
  );
  console.log(`Buy: outcome=${buy.outcome} numericCode=${buy.numericCode}`);

  if (buy.outcome === "unknown") {
    // It MAY have executed. Never resend with a new key: look first.
    const positions = (await call("GET", `/users/current/accounts/${account}/positions`, key)).body;
    console.log(`Outcome unknown. Positions now: ${positions.length}. Decide from these, do not retry blindly.`);
    return;
  }
  if (buy.outcome !== "applied") {
    console.log(`Not executed: ${buy.message}`);
    return;
  }

  const positions = (await call("GET", `/users/current/accounts/${account}/positions`, key)).body;
  console.log(`Open positions: ${positions.length}`);

  const close = await trade(
    key,
    account,
    { actionType: "POSITION_CLOSE_ID", positionId: buy.positionId },
    "quickstart: close the test position",
  );
  console.log(`Close: outcome=${close.outcome} numericCode=${close.numericCode}`);
}

main().catch((err) => fail(String(err)));
