# MCP Task Manager Server

CS 290 Final Challenge — an MCP server exposing **three tools** backed by native SQLite:

| Tool | What it does |
|------|-------------|
| `add_task` | Creates a task with title, description, priority (`low`/`medium`/`high`), and optional due date |
| `get_tasks` | Filters/searches tasks by status (`todo`/`in_progress`/`done`), priority, or keyword |
| `delete_task` | Deletes a task by ID or exact title |

## Running the Project & Web UI (The Easy Way)

To test the entire system instantly (Backend + Web Dashboard + SQLite DB), run this single automated command:

```bash
cd mcp-task-server
npm install
npm run start-ui
```

This single orchestrator command will:
1. Start the API Server (`http://localhost:3000`)
2. Automatically launch the beautiful Web UI Dashboard (`index.html`) directly in your default browser.
3. Automatically launch your native SQLite Database to prove everything syncs natively.

*(If you don't have a DB viewer installed, it will neatly prompt you in the terminal to install DB Browser with one click natively!).*

## IDE / Agent Configuration (MCP)

To connect an AI Agent directly to this server without the Web UI:

### VS Code / Cursor (`mcp.json`)
```json
{
  "mcpServers": {
    "task-manager": {
      "command": "npx",
      "args": [
        "tsx",
        "/ABSOLUTE/PATH/TO/mcp-task-server/src/index.ts"
      ],
      "env": {
        "MCP_TASK_DB_PATH": "/ABSOLUTE/PATH/TO/mcp-task-server"
      }
    }
  }
}
```

## Project Structure

```
mcp-task-server/
├── src/index.ts          ← Main MCP Server (Tools defined here)
├── web-ui-server.cjs     ← Standalone Express backend for the Web UI
├── open-db.js            ← Helper script to open tasks.db in DB Browser
├── package.json
├── tsconfig.json
└── tasks.db              ← Auto-created Native SQLite Database
task-ui/
└── index.html            ← Stylish Vibe Web UI Dashboard
```
