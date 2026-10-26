"""Tickwire quickstart in Python: a free sandbox MT5 account, one order, one close.

Uses only the public Tickwire API and the Python standard library (3.9+).
No card, no broker login, no real money: the sandbox is a simulated terminal.

    python3 quickstart.py

To reuse a sandbox you already have, set both:

    export TICKWIRE_SANDBOX_KEY=twsk_...
    export TICKWIRE_ACCOUNT_ID=acc_...

Docs: https://tickwire.io/docs/sandbox/
"""

from __future__ import annotations

import json
import os
import sys
import time
import urllib.error
import urllib.request
import uuid

API = os.environ.get("TICKWIRE_API_URL", "https://api.tickwire.io").rstrip("/")


def call(method: str, path: str, key: str | None = None, body: dict | None = None,
         headers: dict | None = None) -> tuple[int, dict]:
    """Send one request and return (status, JSON body)."""
    h = {"content-type": "application/json", "accept": "application/json"}
    if key:
        h["auth-token"] = key
    h.update(headers or {})
    data = json.dumps(body).encode() if body is not None else None
    req = urllib.request.Request(API + path, data=data, method=method, headers=h)
    try:
        with urllib.request.urlopen(req, timeout=60) as resp:
            raw = resp.read()
            return resp.status, (json.loads(raw) if raw else {})
    except urllib.error.HTTPError as err:
        raw = err.read()
        try:
            return err.code, json.loads(raw) if raw else {}
        except ValueError:
            return err.code, {"error": "http_error", "message": raw.decode(errors="replace")}


def get_sandbox() -> tuple[str, str]:
    """Return (sandbox key, account id), signing up for a new sandbox if needed."""
    key = os.environ.get("TICKWIRE_SANDBOX_KEY")
    account = os.environ.get("TICKWIRE_ACCOUNT_ID")
    if key and account:
        if not key.startswith("twsk_"):
            sys.exit("This quickstart only runs on a sandbox key (twsk_...).")
        return key, account
    status, body = call("POST", "/v1/sandbox/signup", body={"platform": "mt5"})
    if status != 201 and status != 200:
        sys.exit(f"Sandbox sign-up failed: {status} {body}")
    print("New sandbox. The key is shown once, so keep it:")
    print(f"  export TICKWIRE_SANDBOX_KEY={body['apiKey']}")
    print(f"  export TICKWIRE_ACCOUNT_ID={body['account']['id']}")
    return body["apiKey"], body["account"]["id"]


def wait_connected(key: str, account: str, timeout_s: int = 120) -> None:
    """Wait until the account reports CONNECTED. Never assume it."""
    deadline = time.time() + timeout_s
    while time.time() < deadline:
        status, body = call("GET", f"/users/current/accounts/{account}", key)
        if status == 200 and body.get("connectionStatus") == "CONNECTED":
            return
        time.sleep(2)
    sys.exit("The account did not report CONNECTED in time. Check its health before trading.")


def trade(key: str, account: str, order: dict, reason: str) -> dict:
    """Send one order with its own idempotency key, actor and reason."""
    status, body = call(
        "POST", f"/users/current/accounts/{account}/trade", key, body=order,
        headers={
            "Idempotency-Key": f"quickstart-{uuid.uuid4()}",
            "X-Actor": "quickstart",
            "X-Reason": reason,
        },
    )
    if status >= 400 and "outcome" not in body:
        sys.exit(f"Order refused: {status} {body.get('error')} {body.get('message')}")
    return body


def main() -> None:
    key, account = get_sandbox()
    wait_connected(key, account)

    _, info = call("GET", f"/users/current/accounts/{account}/account-information", key)
    print(f"Balance {info.get('balance')} {info.get('currency')}, broker time {info.get('brokerTime')} (not UTC)")

    result = trade(key, account,
                   {"actionType": "ORDER_TYPE_BUY", "symbol": "EURUSD", "volume": 0.01},
                   "quickstart: buy 0.01 EURUSD on the sandbox")
    outcome = result.get("outcome")
    print(f"Buy: outcome={outcome} numericCode={result.get('numericCode')}")

    if outcome == "unknown":
        # It MAY have executed. Never resend with a new key: look first.
        _, positions = call("GET", f"/users/current/accounts/{account}/positions", key)
        print(f"Outcome unknown. Positions now: {len(positions)}. Decide from these, do not retry blindly.")
        return
    if outcome != "applied":
        print(f"Not executed: {result.get('message')}")
        return

    _, positions = call("GET", f"/users/current/accounts/{account}/positions", key)
    print(f"Open positions: {len(positions)}")

    close = trade(key, account,
                  {"actionType": "POSITION_CLOSE_ID", "positionId": result["positionId"]},
                  "quickstart: close the test position")
    print(f"Close: outcome={close.get('outcome')} numericCode={close.get('numericCode')}")


if __name__ == "__main__":
    main()
