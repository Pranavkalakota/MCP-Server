# MCP Task Manager Server

CS 290 Final Challenge — an MCP server exposing **two tools** backed by SQLite:

| Tool | What it does |
|------|-------------|
| `add_task` | Creates a task with title, description, priority (`low`/`medium`/`high`), and optional due date |
| `get_tasks` | Filters/searches tasks by status (`todo`/`in_progress`/`done`), priority, or keyword |

## Quick Start

```bash
npm install
npm start        # runs the server on stdio
```

## IDE / Agent Configuration

### Claude Desktop (`claude_desktop_config.json`)
```json
{
  "mcpServers": {
    "task-manager": {
      "command": "npx",
      "args": ["tsx", "src/index.ts"],
      "cwd": "/ABSOLUTE/PATH/TO/mcp-task-server"
    }
  }
}
```

### Claude Code
```bash
claude mcp add task-manager -- npx tsx /ABSOLUTE/PATH/TO/mcp-task-server/src/index.ts
```

### VS Code (`.vscode/mcp.json`)
```json
{
  "servers": {
    "task-manager": {
      "command": "npx",
      "args": ["tsx", "src/index.ts"],
      "cwd": "${workspaceFolder}"
    }
  }
}
```

### Gemini CLI (`.gemini/settings.json`)
```json
{
  "mcpServers": {
    "task-manager": {
      "command": "npx",
      "args": ["tsx", "src/index.ts"],
      "cwd": "/ABSOLUTE/PATH/TO/mcp-task-server"
    }
  }
}
```

## Project Structure

```
mcp-task-server/
├── src/index.ts      ← MCP server (both tools defined here)
├── package.json
├── tsconfig.json
└── tasks.db          ← auto-created on first run
```

For graders, reviewers, or anyone else testing this project locally, simply clone the repository (or extract the ZIP) and run the following automated commands:

```bash
# 1. Navigate into the project directory
cd mcp-task-server

# 2. Install the required dependencies
npm install

# 3. Start the entire ecosystem automatically
npm run start-ui

## What to Vibe Code Next

Once the MCP server is running, point your IDE agent at it and vibe code a client app that talks to these tools. Ideas:
- A CLI task manager ("add a high-priority task: finish CS 290 project")
- A web dashboard that shows all tasks in a kanban board
- A chat interface that lets you manage tasks conversationally
