# 🚀 MCP Task Manager Server
**Conversational AI Assistant & Dashboard**

This is a comprehensive Task Management system built on the **Model Context Protocol (MCP)**. It features a high-performance SQLite backend, a stunning Glassmorphism Web Dashboard, and an intelligent Conversational AI Assistant.

---

## 🏗️ Multi-User & Privacy First
- **Individual "Clean Slates":** Every user has their own independent `tasks.db`. Your personal tasks are **not** shared because the database is `.gitignored`.
- **Automatic Initialization:** The system detects a missing database and builds a fresh one automatically on first launch.
- **Dynamic ID Synchronization:** Tasks are strictly numbered **1, 2, 3...** in both the UI and SQL database. If you delete task #1, everything slides up to fill the gap.

---

## ⚡ Quick Start

### 1. Installation
```bash
cd mcp-task-server
npm install
```

### 2. Launch Everything
```bash
npm run start-ui
```

### 3. Smart Conversational Features
Talk to the assistant in the purple chat box on the dashboard. It supports:
- **Undo / Redo:** Use keywords like *"undo"*, *"redo"*, *"oops"*, *"revert"*, or *"bring back"* to reverse your last action.
- **Contextual Deletion:** Say *"delete the task I just made"* to remove your most recent entry.
- **Confirmation Safety:** The AI will always ask *"Are you sure?"* before deleting anything. Just say *"yes"* to confirm.
- **Smart Parsing:** High-performance title extraction (*"add a task to eat lunch"* correctly creates *"eat lunch"*).

---

## 🤖 AI Customization (OpenAI Key)
1. Rename `.env.example` to `.env`.
2. Paste your `OPENAI_API_KEY`.
3. Restart the server for advanced natural language features.

---

## 🛠️ Tech Stack
- **Frontend:** Vanilla JS + Glassmorphism CSS.
- **Backend:** Node.js + Express (Web UI Server).
- **Database:** Native SQLite (sqlite3) with persistent transaction history.
- **Protocol:** MCP Standard stdio transport.
