import express from "express";
import cors from "cors";
import initSqlJs from "sql.js";
import path from "node:path";
import fs from "node:fs";
const DB_PATH = path.join(process.env.MCP_TASK_DB_PATH || process.cwd(), "tasks.db");
let db;
async function initDatabase() {
    const SQL = await initSqlJs();
    if (fs.existsSync(DB_PATH)) {
        db = new SQL.Database(fs.readFileSync(DB_PATH));
        console.error(`[task-web-api] Loaded DB from ${DB_PATH}`);
    }
    else {
        db = new SQL.Database();
        console.error(`[task-web-api] Created new DB at ${DB_PATH}`);
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
}
function saveDb() {
    fs.writeFileSync(DB_PATH, Buffer.from(db.export()));
}
async function start() {
    await initDatabase();
    const app = express();
    app.use(cors());
    app.use(express.json());
    app.get("/tasks", (req, res) => {
        const result = db.exec("SELECT * FROM tasks ORDER BY id DESC");
        if (!result.length)
            return res.json([]);
        const cols = result[0].columns;
        const tasks = result[0].values.map(row => Object.fromEntries(cols.map((c, i) => [c, row[i]])));
        res.json(tasks);
    });
    app.post("/tasks", (req, res) => {
        const { title, description, priority, due_date } = req.body;
        db.run(`INSERT INTO tasks (title, description, priority, due_date) VALUES (?, ?, ?, ?)`, [title, description || "", priority || "medium", due_date || null]);
        saveDb();
        res.json({ success: true });
    });
    app.listen(3000, () => {
        console.log("Web API running at http://localhost:3000");
    });
}
start();
//# sourceMappingURL=web-api.js.map