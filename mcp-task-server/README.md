# MCP Task Manager Server

CS 290 Final Challenge — an MCP server exposing **three tools** backed by native SQLite:

| Tool | What it does |
|------|-------------|
| `add_task` | Creates a task with title, description, priority (`low`/`medium`/`high`), and optional due date |
| `get_tasks` | Filters/searches tasks by status (`todo`/`in_progress`/`done`), priority, or keyword |
| `delete_task` | Deletes a task by ID or exact title |

## Running the Project & Web UI

If you want to run this project natively, test the tools, or use the Web UI dashboard, simply run the following in your terminal:

```bash
cd mcp-task-server
npm install
node web-ui-server.cjs
```

The Web API will then be available on `http://localhost:3000`. You can now open `/task-ui/index.html` in your browser to interact with the database via a beautiful UI!

## Viewing the Database Automatically
If you want to view the SQLite database visually and live, run:

```bash
cd mcp-task-server
npm run open-db
```

This automated script will check if you have **DB Browser for SQLite** installed. If you do, it automatically opens `tasks.db`. If you do NOT have it, it will ask for your permission to install it via Homebrew and then open it for you!

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
