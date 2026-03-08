// ============================================================
// MCP Task Manager Server
// Team Members: Pranav Kalakota
// ============================================================
// Three tools:
//   1. add_task    — Create a task (title, description, priority, due date)
//   2. get_tasks   — Filter/search tasks by status, priority, or keyword
//   3. delete_task — Delete a task by ID or Title
//
// Storage: SQLite (sql.js)  |  Transport: stdio
// ============================================================

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import sqlite3 from "sqlite3";
import { open, type Database } from "sqlite";
import path from "node:path";
import fs from "node:fs";
import express from "express";
import cors from "cors";

// ———————————————— Database ————————————————

const DB_PATH = path.join(process.env.MCP_TASK_DB_PATH || process.cwd(), "tasks.db");
let db: Database;

async function initDatabase(): Promise<void> {
    db = await open({
        filename: DB_PATH,
        driver: sqlite3.Database
    });

    console.error(`[mcp-task-server] Connected to real SQLite DB at ${DB_PATH}`);

    await db.exec(`
    CREATE TABLE IF NOT EXISTS tasks (
      id          INTEGER PRIMARY KEY AUTOINCREMENT,
      title       TEXT    NOT NULL,
      description TEXT    DEFAULT '',
      priority    TEXT    CHECK(priority IN ('low','medium','high')) DEFAULT 'medium',
      status      TEXT    CHECK(status IN ('todo','in_progress','done')) DEFAULT 'todo',
      due_date    TEXT    DEFAULT NULL,
      created_at  TEXT    DEFAULT (datetime('now')),
      updated_at  TEXT    DEFAULT (datetime('now'))
    );
  `);
}

// "saveDb" is removed because native sqlite3 writes instantly to the disk!


// ———————————————— MCP Server ————————————————

const server = new McpServer({
    name: "mcp-task-server",
    version: "1.0.0",
});

// ———————————————— Sync Logic ————————————————

async function syncIds(): Promise<void> {
    const rows = await db.all("SELECT * FROM tasks ORDER BY id ASC");
    await db.exec("DELETE FROM tasks");
    await db.exec("DELETE FROM sqlite_sequence WHERE name='tasks'");
    for (const t of rows) {
        await db.run(
            `INSERT INTO tasks (title, description, priority, status, due_date, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?)`,
            [t.title, t.description, t.priority, t.status, t.due_date, t.created_at, t.updated_at]
        );
    }
}

// ──────────── Tool 1: add_task ────────────

server.tool(
    "add_task",
    "Create a new task. Returns the created task with its ID.",
    {
        title: z.string().describe("Task title (required)"),
        description: z.string().optional().describe("Detailed description of the task"),
        priority: z.enum(["low", "medium", "high"]).optional().describe("Priority level — defaults to medium"),
        due_date: z.string().optional().describe("Due date in YYYY-MM-DD format"),
    },
    async ({ title, description, priority, due_date }) => {
        try {
            await db.run(
                `INSERT INTO tasks (title, description, priority, due_date) VALUES (?, ?, ?, ?)`,
                [title, description ?? "", priority ?? "medium", due_date ?? null]
            );
            await syncIds();
            const task = await db.get(`SELECT * FROM tasks ORDER BY id DESC LIMIT 1`);
            return {
                content: [{ type: "text" as const, text: JSON.stringify(task, null, 2) }],
            };
        } catch (err: any) {
            return {
                content: [{ type: "text" as const, text: `Error: ${err.message}` }],
                isError: true
            };
        }
    }
);

// ──────────── Tool 2: get_tasks ────────────

server.tool(
    "get_tasks",
    "Search and filter tasks. Returns all tasks as JSON.",
    {},
    async () => {
        const tasks = await db.all(`SELECT * FROM tasks ORDER BY id ASC`);
        return {
            content: [{ type: "text" as const, text: JSON.stringify(tasks, null, 2) }],
        };
    }
);

// ──────────── Tool 3: delete_task ────────────

server.tool(
    "delete_task",
    "Delete a task by ID.",
    {
        id: z.number().describe("Internal task ID"),
    },
    async ({ id }) => {
        await db.run(`DELETE FROM tasks WHERE id = ?`, [id]);
        await syncIds();
        return {
            content: [{ type: "text" as const, text: `Successfully deleted task #${id}.` }],
        };
    }
);

// ———————————————— Start Server ————————————————

async function startWebServer(): Promise<void> {
    const app = express();
    app.use(cors());
    app.use(express.json());

    app.get("/tasks", async (req, res) => {
        const tasks = await db.all("SELECT * FROM tasks ORDER BY id DESC");
        res.json(tasks);
    });

    app.post("/tasks", async (req, res) => {
        const { title, description, priority, due_date } = req.body;
        await db.run(
            `INSERT INTO tasks (title, description, priority, due_date) VALUES (?, ?, ?, ?)`,
            [title, description || "", priority || "medium", due_date || null]
        );
        res.json({ success: true });
    });

    app.delete("/tasks/:id", async (req, res) => {
        const { id } = req.params;
        await db.run(`DELETE FROM tasks WHERE id = ?`, [id]);
        res.json({ success: true });
    });

    app.listen(3000, () => {
        console.error("[mcp-task-server] HTTP API running on http://localhost:3000");
    });
}

async function main(): Promise<void> {
    await initDatabase();

    const transport = new StdioServerTransport();
    await server.connect(transport);
    console.error("[mcp-task-server] MCP Server running on stdio");
}

main().catch((err) => {
    console.error("[mcp-task-server] Fatal error:", err);
    process.exit(1);
});
