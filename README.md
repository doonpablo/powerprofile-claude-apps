# PowerProfile Connectors Directory

Curated, install-on-demand connector catalog for Claude PowerProfile.

Each catalog entry contains a real remote MCP configuration. Installing Gmail, Slack, Notion, or another card activates only that app's connection-management endpoint. The universal `PowerProfile Connectors` gateway remains responsible for discovering and executing app actions on demand.

This design keeps the directory visual without starting every connector at application launch.

## Included connectors

- Gmail, Google Drive, Google Calendar
- Microsoft Outlook and Microsoft Teams
- Slack, Notion, GitHub, Trello, Jira
- HubSpot, Salesforce, Dropbox
- Canva and Shopify

All plugins are disabled by default. The user chooses which cards to install.

## Authentication

Plugin `.mcp.json` files reference `${POWERPROFILE_API_KEY}`. The PowerProfile installer provides this variable in the managed Claude environment; credentials are not stored in this repository.

## Validate

```sh
node scripts/curate-connectors.mjs
claude plugin validate .
```
