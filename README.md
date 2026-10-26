# MetaTrader MCP server and API for MT4 and MT5

Connect Claude, ChatGPT, Cursor, VS Code or your own trading bot to a
**MetaTrader 4 or MetaTrader 5** account. [Tickwire](https://tickwire.io) runs a
real MetaTrader terminal for each account in the cloud and gives you one API
for both platforms: a hosted **MCP server**, a **REST API** and a **WebSocket**
stream. It works with any broker that offers MetaTrader, from Mac, Linux or
Windows. You don't need Windows, Wine or a VPS.

This repo holds the connection settings and two small quickstarts. The server
itself is hosted:

```
https://api.tickwire.io/mcp
```

- MCP page: https://tickwire.io/metatrader-mcp-server/
- Docs: https://tickwire.io/docs/
- OpenAPI: https://tickwire.io/openapi.json
- Free sandbox: https://tickwire.io/docs/sandbox/
- Pricing: https://tickwire.io/pricing/ (7-day free trial, then from $12 per account a month)

## What an AI agent can do

| Look | Trade (only with "Look and trade") |
| --- | --- |
| `list_accounts`, `get_agent_permissions`, `get_account_health` | `place_order` |
| `get_account_info`, `get_account_snapshot` | `modify_position`, `close_position` |
| `get_positions`, `get_orders`, `get_history` | `modify_order`, `cancel_order` |
| `get_quote`, `get_symbol_spec`, `get_candles` | `get_trade_status` |
| `get_audit_log`, `search_tickwire_docs` | |

Every tool is marked read-only or not, so your AI app can ask you before it
changes anything.

How it keeps your account safe:

- **You choose.** When you sign in you pick the accounts and choose **Look
  only** or **Look and trade**. Start with Look only.
- **Never twice.** Every order carries an idempotency key. Sending the same
  call again returns the first answer and never places a second order.
- **Honest results.** Every trade answers `applied`, `rejected`, `held`,
  `no_change` or `unknown`. `unknown` means it may have executed: check
  positions before doing anything else. The agent is told never to retry it.
- **A reason on every trade.** Each trade records who sent it and why, in an
  audit log you can read.
- **Your rules.** Kill switches and your own pre-trade hook can stop or hold
  any order. Tickwire has no size or loss limits of its own: you set them.
- **Truthful health.** An account is `CONNECTED` only when its terminal says
  so, and stale prices are reported as stale.

## Connect

You need a Tickwire login. In every app below you can sign in with Tickwire
(OAuth: no key to copy), or send an agent key you made in the dashboard as
`Authorization: Bearer twag_...`. Use a demo account first.

### Claude (claude.ai and the Claude desktop app)

1. Open **Customize** > **Connectors**, press **+ Add**, then **Add custom connector**.
2. Name it Tickwire, paste `https://api.tickwire.io/mcp` and press **Continue**.
3. Keep the sign-in settings Claude suggests and press **Add**.
4. Sign in with Tickwire, pick the accounts, choose **Look only** or **Look and trade**, and press **Allow**.
5. In a chat, press **+** > **Connectors** and turn Tickwire on.

Team and Enterprise: an owner adds the connector under **Organization
settings** > **Connectors** first.

### Claude Code

```sh
claude mcp add --transport http tickwire https://api.tickwire.io/mcp
```

Then type `/mcp`, choose tickwire and sign in. With an agent key instead, see
[`mcp-config/claude-code.sh`](mcp-config/claude-code.sh).

### ChatGPT (Plus, Pro, Business, Enterprise, Education)

1. On chatgpt.com, open **Settings** > **Security and login** and turn on **Developer mode**.
2. Go to **Plugins** and press **+** to create an app.
3. Name it Tickwire, paste `https://api.tickwire.io/mcp` under **Connection**, choose **OAuth** and create it.
4. Sign in with Tickwire, pick the accounts, choose **Look only** or **Look and trade**, and press **Allow**.
5. In a new chat, open the **+** menu, choose **Developer mode** and select Tickwire.

These steps follow OpenAI's documentation.

### Cursor

Put this in `~/.cursor/mcp.json` (or `.cursor/mcp.json` in a project), then
sign in when Cursor asks:

```json
{
  "mcpServers": {
    "tickwire": {
      "url": "https://api.tickwire.io/mcp"
    }
  }
}
```

With an agent key: [`mcp-config/cursor-agent-key.mcp.json`](mcp-config/cursor-agent-key.mcp.json).

### VS Code

Put this in `.vscode/mcp.json`, then start the server and sign in:

```json
{
  "servers": {
    "tickwire": {
      "type": "http",
      "url": "https://api.tickwire.io/mcp"
    }
  }
}
```

With an agent key (VS Code asks for it and stores it securely):
[`mcp-config/vscode-agent-key.mcp.json`](mcp-config/vscode-agent-key.mcp.json).

### Any other MCP client

Use the streamable HTTP address `https://api.tickwire.io/mcp`. The server
publishes its OAuth details at
`https://api.tickwire.io/.well-known/oauth-protected-resource`, with the scopes
`tickwire.read` and `tickwire.trade`. If your client can't sign in, send an
agent key as `Authorization: Bearer twag_...`.

## Try the API in two minutes (free sandbox)

The sandbox gives you simulated MT4 and MT5 accounts that answer the real API.
No card, no broker login, no sign-in.

```sh
export TW=https://api.tickwire.io

# 1. A sandbox key and a connected MT5 account
curl -s -X POST "$TW/v1/sandbox/signup" -H "content-type: application/json" -d '{"platform": "mt5"}'

export TW_KEY=twsk_...   # apiKey from the answer, shown once
export ACC=acc_...       # account.id from the answer

# 2. Read the account
curl -s "$TW/users/current/accounts/$ACC/account-information" -H "auth-token: $TW_KEY"

# 3. Buy 0.01 EURUSD, with an idempotency key
curl -s -X POST "$TW/users/current/accounts/$ACC/trade" \
  -H "auth-token: $TW_KEY" -H "Idempotency-Key: first-order-1" \
  -H "X-Actor: quickstart" -H "X-Reason: trying Tickwire" \
  -H "content-type: application/json" \
  -d '{"actionType": "ORDER_TYPE_BUY", "symbol": "EURUSD", "volume": 0.01}'

# 4. See the position
curl -s "$TW/users/current/accounts/$ACC/positions" -H "auth-token: $TW_KEY"
```

The trade answers `"outcome": "applied"` with `numericCode` 10009. Send step 3
again with the same `Idempotency-Key` and you get the same answer and no second
position.

Want to see the hard cases? Sandbox logins simulate them: `1031` (reply lost,
but the order filled), `1032` (outcome unknown), `1019` (rejected, no money),
`1050` (frozen quotes) and `1040` (disconnect and reconnect). See
[magic logins](https://tickwire.io/docs/sandbox/#magic-logins).

### Python

[`python/quickstart.py`](python/quickstart.py) uses only the standard library:

```sh
python3 python/quickstart.py
```

### TypeScript

[`typescript/quickstart.ts`](typescript/quickstart.ts) uses only the built-in
`fetch` (Node 18+):

```sh
npx tsx typescript/quickstart.ts
```

Both scripts get a sandbox, wait until the account reports `CONNECTED`, place
one order with its own idempotency key and reason, handle each outcome (and
never retry `unknown`), then close the position.

### Stream prices

```sh
websocat "wss://api.tickwire.io/users/current/accounts/$ACC/ws?auth-token=$TW_KEY"
{"type":"subscribe","marketData":[{"symbol":"EURUSD","subscriptions":[{"type":"quotes"}]}]}
```

## Moving to a broker account

Sign in at [tickwire.io](https://tickwire.io), connect a broker account (login,
password and server; demo or live, your choice), and swap the sandbox key and
account id for yours. The paths, fields and outcomes stay the same. Your broker
password is write-only: it is never returned or logged.

## FAQ

**Do I need Windows?** No. The terminals run in Tickwire's cloud. Your code or
AI app can run anywhere.

**MT4 and MT5?** Both, through the same API. Where MT4 can't do something (market
depth, tick history), the API says `not_supported_on_mt4` instead of making up
data.

**Is the broker's time UTC?** Not always. The API labels broker time, and the
docs explain [time zones](https://tickwire.io/docs/time-zones/).

**Can an AI agent lose money?** Yes, if you let it trade. Start with Look only
on a demo account, add a pre-trade hook with your own limits, and read the
audit log.

## License

The code and settings in this repo are under the [MIT license](LICENSE). The
Tickwire service has its own [terms](https://tickwire.io/legal/terms/).
