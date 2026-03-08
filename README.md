# 🚀 MCP Task Manager Server
**Conversational AI Assistant & Dashboard**

This is a comprehensive Task Management system built on the **Model Context Protocol (MCP)**. It features a high-performance SQLite backend, a stunning Glassmorphism Web Dashboard, and an intelligent Conversational AI Assistant that can manage your life through simple natural language.

---

## 🏗️ Multi-User & Privacy First
This project is designed for "Zero-Config" deployment.
- **Private Databases:** Every user has their own independent `tasks.db`. Because the database file is `.gitignored`, your personal tasks are never pushed to GitHub or shared with others.
- **Automatic Initialization:** When a new user (like a grader) runs the project (e.g., via `npm run start-ui`), the system instantly detects the missing database and creates a fresh, empty task list for them automatically.
- **No SQLite Required:** The project uses the `sqlite3` driver which is automatically handled by `npm install`. No external database software installation is needed.

---

## ⚡ Quick Start (For New Users)

### 1. Installation
Ensure you have Node.js installed, then run:
```bash
cd mcp-task-server
npm install
```

### 2. Launch Everything (Web UI + Database + API)
This command will start the server, open your browser, and launch the database viewer all at once:
```bash
npm run start-ui
```

### 3. Launch the AI Chatbot
In a separate terminal, talk to the AI system directly:
```bash
npm run chat
```

---

## 🤖 Intelligent Conversational AI
The system features two processing modes:
1.  **OpenAI Mode (Premium):** If an OpenAI API Key is provided in a `.env` file, the bot uses GPT-4o-mini for incredibly flexible natural language understanding (e.g., *"Delete the coding task I added earlier"*).
2.  **Local Fallback (Standard):** If no API key is detected, the system automatically falls back to a **Built-in Local NLP Engine** that identifies keywords (add, list, delete) to ensure 100% functionality out-of-the-box.

### 🔑 Enabling OpenAI Integration
1. Rename `.env.example` to `.env`.
2. Paste your `OPENAI_API_KEY`.
3. Restart the server.

---

## 🛠️ Project Structure
- **/src/index.ts**: The core MCP Server (stdio transport).
- **web-ui-server.cjs**: The backend API for the dashboard (Native SQLite).
- **/task-ui/index.html**: The premium Glassmorphism frontend.
- **cli-chat.js**: The conversational CLI client.
- **tasks.db**: Your private, local task storage.
