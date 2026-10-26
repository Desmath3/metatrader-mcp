#!/bin/sh
# Add the hosted Tickwire MCP server to Claude Code.

# Option 1: sign in with Tickwire (OAuth). Run this, then type /mcp in Claude Code,
# choose tickwire, sign in, pick the accounts and choose Look only or Look and trade.
claude mcp add --transport http tickwire https://api.tickwire.io/mcp

# Option 2: an agent key from the Tickwire dashboard. Start with a read-only key.
# claude mcp add --transport http tickwire https://api.tickwire.io/mcp \
#   --header "Authorization: Bearer twag_your_agent_key"
