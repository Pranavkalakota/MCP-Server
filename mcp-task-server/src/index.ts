// ============================================================
// MCP Task Manager Server — CS 290 Final Challenge
// Team Members: Pranav Kalakota
// ============================================================
// Two tools:
//   1. add_task  — Create a task (title, description, priority, due date)
//   2. get_tasks — Filter/search tasks by status, priority, or keyword
//
// Storage: SQLite (sql.js)  |  Transport: stdio
// ============================================================

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import initSqlJs, { type Database } from "sql.js";
import path from "node:path";
import fs from "node:fs";

// ———————————————— Database ————————————————

const DB_PATH = path.join(process.env.MCP_TASK_DB_PATH || process.cwd(), "tasks.db");
let db: Database;

async function initDatabase(): Promise<void> {
    const SQL = await initSqlJs();

    if (fs.existsSync(DB_PATH)) {
        db = new SQL.Database(fs.readFileSync(DB_PATH));
        console.error(`[mcp-task-server] Loaded DB from ${DB_PATH}`);
    } else {
        db = new SQL.Database();
        console.error(`[mcp-task-server] Created new DB at ${DB_PATH}`);
    }

    db.run(`
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
    saveDb();
}

function saveDb(): void {
    fs.writeFileSync(DB_PATH, Buffer.from(db.export()));
}

// ———————————————— MCP Server ————————————————

const server = new McpServer({
    name: "mcp-task-server",
    version: "1.0.0",
});

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
        const desc = description ?? "";
        const prio = priority ?? "medium";
        const due = due_date ?? null;

        db.run(
            `INSERT INTO tasks (title, description, priority, due_date) VALUES (?, ?, ?, ?)`,
            [title, desc, prio, due]
        );
        saveDb();

        // Grab the newly inserted row
        const result = db.exec(
            `SELECT * FROM tasks WHERE id = last_insert_rowid()`
        );
        const cols = result[0].columns;
        const vals = result[0].values[0];
        const task = Object.fromEntries(cols.map((c: string, i: number) => [c, vals[i]]));

        return {
            content: [
                {
                    type: "text" as const,
                    text: JSON.stringify(task, null, 2),
                },
            ],
        };
    }
);

// ──────────── Tool 2: get_tasks ────────────

server.tool(
    "get_tasks",
    "Search and filter tasks. Returns matching tasks as JSON. All parameters are optional — calling with no filters returns all tasks.",
    {
        status: z.enum(["todo", "in_progress", "done"]).optional().describe("Filter by task status"),
        priority: z.enum(["low", "medium", "high"]).optional().describe("Filter by priority level"),
        keyword: z.string().optional().describe("Search keyword — matches against title and description"),
    },
    async ({ status, priority, keyword }) => {
        const conditions: string[] = [];
        const params: string[] = [];

        if (status) {
            conditions.push("status = ?");
            params.push(status);
        }
        if (priority) {
            conditions.push("priority = ?");
            params.push(priority);
        }
        if (keyword) {
            conditions.push("(title LIKE ? OR description LIKE ?)");
            params.push(`%${keyword}%`, `%${keyword}%`);
        }

        const where = conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : "";
        const query = `SELECT * FROM tasks ${where} ORDER BY
      CASE priority WHEN 'high' THEN 1 WHEN 'medium' THEN 2 WHEN 'low' THEN 3 END,
      due_date ASC NULLS LAST,
      created_at DESC`;

        const result = db.exec(query.replace(/\?/g, () => {
            const val = params.shift()!;
            return `'${val.replace(/'/g, "''")}'`;
        }));

        if (!result.length || !result[0].values.length) {
            return {
                content: [{ type: "text" as const, text: "No tasks found matching your filters." }],
            };
        }

        const cols = result[0].columns;
        const tasks = result[0].values.map((row: any[]) =>
            Object.fromEntries(cols.map((c: string, i: number) => [c, row[i]]))
        );

        return {
            content: [
                {
                    type: "text" as const,
                    text: JSON.stringify(tasks, null, 2),
                },
            ],
        };
    }
);

// ———————————————— Start Server ————————————————

async function main(): Promise<void> {
    await initDatabase();
    const transport = new StdioServerTransport();
    await server.connect(transport);
    console.error("[mcp-task-server] Server running on stdio");
}

main().catch((err) => {
    console.error("[mcp-task-server] Fatal error:", err);
    process.exit(1);
});
