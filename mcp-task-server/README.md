# 🚀 MCP Task Manager Server
**Conversational AI Assistant & Dashboard**

This is a comprehensive Task Management system built on the **Model Context Protocol (MCP)**. It features a high-performance SQLite backend, a stunning Glassmorphism Web Dashboard, and an intelligent Conversational AI Assistant.

---

## 🏗️ Multi-User & Privacy First
This project is designed for "Zero-Config" deployment for multiple users (like professors or TAs).
- **Individual "Clean Slates":** Every user has their own independent `tasks.db`. Because this file is `.gitignored`, your personal tasks will **not** be seen by others. When someone else runs the project, the system instantly detects the missing database and creates a **fresh, empty task list** for them automatically.
- **No SQLite Install Required:** The project uses the `sqlite3` driver which is automatically handled by `npm install`.
- **Dynamic ID Synchronization:** Tasks are always numbered **1, 2, 3...** in BOTH the UI and the SQL database, even after deletions, making it incredibly intuitive to manage.

---

## ⚡ Quick Start (For New Users)

### 1. Installation
Ensure you have Node.js installed, then run:
```bash
cd mcp-task-server
npm install
```

### 2. Launch Everything
This command starts the Web API, opens the **Web Dashboard** in your browser, and launches the database viewer all at once:
```bash
npm run start-ui
```

### 3. Talk to the AI
You can talk to the AI **directly from the Web Dashboard** (the purple chat box at the bottom). 

---

## 🤖 AI Customization (OpenAI Key)
The system works out-of-the-box using a **Built-in Local NLP Engine** (no API key required!). However, you can enable "Pro Mode" for advanced natural language understanding:

1. Look for the `.env.example` file in the root folder.
2. Rename it to `.env`.
3. Open it and paste your `OPENAI_API_KEY`.
4. Restart the server.

The Assistant will now handle much more complex requests like *"Delete the task I just made"* or *"Is there anything about CS290?"*. **Note:** The AI will always ask for confirmation before deleting any task.

---

## 🛠️ Key Files
- **/task-ui/index.html**: The premium Glassmorphism frontend and Chat UI.
- **web-ui-server.cjs**: The core backend logic and ID re-sequencing engine.
- **/src/index.ts**: The technical MCP Server implementation.
- **tasks.db**: Your private, local task storage.
