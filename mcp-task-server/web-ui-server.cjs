const express = require('express');
const cors = require('cors');
const sqlite3 = require('sqlite3').verbose();
const fs = require('fs');
const path = require('path');
require('dotenv').config();
const { OpenAI } = require('openai');

const openai = process.env.OPENAI_API_KEY && process.env.OPENAI_API_KEY.startsWith("sk-")
    ? new OpenAI({ apiKey: process.env.OPENAI_API_KEY })
    : null;

const DB_PATH = path.join(__dirname, 'tasks.db');

async function start() {
    console.log("Connecting to Native SQLite database...");
    const db = new sqlite3.Database(DB_PATH, (err) => {
        if (err) console.error("Database error:", err.message);
        else {
            console.log("Connected to local SQLite database.");
            // Automatically initialize the table for new users (professors, TAs, etc.)
            db.exec(`
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
    });

    const app = express();
    app.use(cors());
    app.use(express.json());

    const all = (query, params = []) => new Promise((resolve, reject) => {
        db.all(query, params, (err, rows) => err ? reject(err) : resolve(rows));
    });

    const run = (query, params = []) => new Promise((resolve, reject) => {
        db.run(query, params, function (err) { err ? reject(err) : resolve(this); });
    });

    // Helper to re-sequence IDs to match 1, 2, 3...
    const syncIds = async () => {
        const rows = await all("SELECT * FROM tasks ORDER BY id ASC");
        // Clear all tasks
        await run("DELETE FROM tasks");
        // Reset the auto-increment counter
        await run("DELETE FROM sqlite_sequence WHERE name='tasks'");
        // Re-insert tasks with fresh sequential IDs
        for (const t of rows) {
            await run("INSERT INTO tasks (title, description, priority, status, due_date, created_at) VALUES (?, ?, ?, ?, ?, ?)",
                [t.title, t.description, t.priority, t.status, t.due_date, t.created_at]);
        }
    };

    app.get('/tasks', async (req, res) => {
        try {
            const rows = await all("SELECT * FROM tasks ORDER BY id ASC");
            res.json(rows);
        } catch (err) {
            res.status(500).json({ error: err.message });
        }
    });

    app.post('/tasks', async (req, res) => {
        const { title, priority, due_date } = req.body;
        try {
            await run("INSERT INTO tasks (title, priority, due_date) VALUES (?, ?, ?)", [title, priority, due_date]);
            await syncIds(); // Keep IDs 1, 2, 3...
            res.json({ success: true });
        } catch (err) {
            res.status(500).json({ error: err.message });
        }
    });

    app.delete('/tasks/:id', async (req, res) => {
        const { id } = req.params;
        try {
            await run("DELETE FROM tasks WHERE id = ?", [id]);
            await syncIds(); // Re-sequence after deletion
            res.json({ success: true });
        } catch (err) {
            res.status(500).json({ error: err.message });
        }
    });

    app.post('/chat', async (req, res) => {
        const { message, lastResponse } = req.body;
        const msg = (message || "").toLowerCase();

        const tasks = await all("SELECT * FROM tasks ORDER BY id ASC");

        if (openai) {
            try {
                const completion = await openai.chat.completions.create({
                    model: "gpt-4o-mini",
                    messages: [
                        {
                            role: "system",
                            content: `You are a task routing assistant.
                            CURRENT TASKS:
                            ${tasks.map(t => `- [ID: ${t.id}] "${t.title}"`).join('\n') || "None"}
                            
                            LAST RESPONSE: "${lastResponse || "None"}"

                            INSTRUCTIONS:
                            1. FOR DELETION: You MUST use "ask_confirmation" first unless the user is explicitly confirming (e.g. "yes", "do it") a specific task you just asked about.
                            2. CONTEXTUAL DELETE: If they say "delete the last task" or "task you just made", target the one with the HIGHEST ID.
                            3. Return strictly JSON: { "action": "add"|"delete"|"ask_confirmation"|"message", "id": ..., "title": "...", "message": "..." }`
                        },
                        { role: "user", content: message }
                    ],
                    response_format: { type: "json_object" }
                });

                const gpt = JSON.parse(completion.choices[0].message.content);

                if (gpt.action === "add") {
                    await run("INSERT INTO tasks (title, priority) VALUES (?, ?)", [gpt.title || "New Task", "medium"]);
                    await syncIds();
                    return res.json({ response: `Added: "${gpt.title}"` });
                }
                else if (gpt.action === "ask_confirmation") return res.json({ response: gpt.message });
                else if (gpt.action === "delete" && gpt.id) {
                    await run("DELETE FROM tasks WHERE id = ?", [gpt.id]);
                    await syncIds();
                    return res.json({ response: `Success! Task #${gpt.id} deleted. IDs re-synchronized.` });
                }
                else if (gpt.action === "message") return res.json({ response: gpt.message });
            } catch (err) {
                console.error("OpenAI Fallback:", err.message);
            }
        }

        // --- SECURE FALLBACK NLP (Confirmation & Contextual) ---

        // Check for confirmation of previous question
        if ((msg === "yes" || msg === "do it" || msg === "confirm") && lastResponse.includes("confirm you want to delete")) {
            const idMatch = lastResponse.match(/\d+/);
            if (idMatch) {
                const targetId = parseInt(idMatch[0]);
                await run("DELETE FROM tasks WHERE id = ?", [targetId]);
                await syncIds();
                return res.json({ response: `Confirmed. Task #${targetId} removed.` });
            }
        }

        if (msg.includes("delete") || msg.includes("remove") || msg.includes("clear")) {
            let targetId = null;
            let targetTitle = "";

            // Handle "last task" or "just made"
            if (msg.includes("last") || msg.includes("just made") || msg.includes("just added")) {
                if (tasks.length > 0) {
                    const lastTask = tasks[tasks.length - 1];
                    targetId = lastTask.id;
                    targetTitle = lastTask.title;
                }
            } else {
                const idMatch = msg.match(/\b\d+\b/);
                if (idMatch) {
                    targetId = parseInt(idMatch[0]);
                    const t = tasks.find(x => x.id === targetId);
                    targetTitle = t ? t.title : `Task #${targetId}`;
                } else {
                    for (const t of tasks) {
                        if (msg.includes(t.title.toLowerCase())) {
                            targetId = t.id;
                            targetTitle = t.title;
                            break;
                        }
                    }
                }
            }

            if (targetId) {
                return res.json({ response: `Please confirm you want to delete task #${targetId} ("${targetTitle}")? (Yes/No)` });
            }
            return res.json({ response: "I couldn't find that task. Try 'delete 1' or 'delete the last task'." });
        }

        if (msg.includes("add") || msg.includes("create") || msg.includes("new")) {
            let title = message.replace(/\b(add|create|make|new|task|to|remind|me|a|an)\b/gi, "").trim();
            title = title.replace(/^[^a-zA-Z0-9]+|[^a-zA-Z0-9]+$/g, '').trim();
            if (!title) title = "Quick Note";
            await run("INSERT INTO tasks (title) VALUES (?)", [title]);
            await syncIds();
            return res.json({ response: `Added task: "${title}"` });
        }

        if (msg.includes("list") || msg.includes("show")) return res.json({ response: `You have ${tasks.length} tasks.` });

        res.json({ response: "I'm not sure. Try 'add laundry' or 'delete the last task'." });
    });


    app.listen(3000, () => {
        console.log("Web API running on http://localhost:3000");
    });
}

start().catch(err => console.error(err));
