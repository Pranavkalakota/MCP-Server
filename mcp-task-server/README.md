# MCP Task Manager Server

An MCP server exposing **three tools** backed by native SQLite, featuring a web dashboard and a conversational AI assistant.

| Tool | What it does |
|------|-------------|
| `add_task` | Creates a task with title, priority (`low`/`medium`/`high`), and optional due date |
| `get_tasks` | Filters/searches tasks by status, priority, or keyword |
| `delete_task` | Deletes a task by ID or exact title |

## Quick Start: Running the Project & Web UI

For graders, reviewers, or anyone else testing this project locally, simply clone the repository (or extract the ZIP) and run the following automated commands:

```bash
# 1. Navigate into the project directory
cd mcp-task-server

# 2. Install the required dependencies
npm install

# 3. Start the entire ecosystem automatically
npm run start-ui
```

This single orchestrator command will:
1. Start the API Server (`http://localhost:3000`).
2. Automatically launch the beautiful **MCP Server Integration Dashboard** directly in your default browser.
3. Automatically launch your native SQLite Database to prove everything syncs natively.

*(If you don't have a DB viewer installed, it will neatly prompt you in the terminal to install DB Browser with one click!).*

## Conversational AI Assistant (Web & CLI)

This project includes a powerful Conversational Assistant that can intelligently parse natural language to manage your tasks (e.g., *"add a high priority task to finish my project"*, *"show tasks"*, or *"delete task 2"*).

By default, the assistant uses a lightweight local NLP fallback engine so anyone can test it immediately.

### **✨ Unlock OpenAI Integration (Recommended)**
To upgrade the assistant to use ChatGPT (GPT-4o-mini) for highly complex natural language understanding:
1. Locate the `.env.example` file in the project folder.
2. Rename it to `.env`.
3. Paste your OpenAI API Key inside: `OPENAI_API_KEY="sk-..."`.

The Web UI and Terminal will now explicitly use OpenAI parsing!

**Terminal Chat App**
Want to manage your tasks inside the terminal instead of the web UI? Power up the native MCP Client chatbot:
```bash
npm run chat
```

## IDE / Agent Configuration (MCP)

To connect an AI Agent (like Claude Desktop or Cursor) directly to this server:

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
├── cli-chat.js           ← Conversational CLI MCP Client wrapper
├── open-db.js            ← Helper script to open tasks.db in DB Browser
├── start-all.js          ← Main Orchestration Script
├── .env.example          ← Template for OpenAI integration
├── package.json
├── tsconfig.json
└── tasks.db              ← Auto-created Native SQLite Database
task-ui/
└── index.html            ← Stylish MCP Server Integration Dashboard
```
