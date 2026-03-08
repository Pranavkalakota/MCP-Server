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
                CREATE TABLE IF NOT EXISTS undo_history (
                    id      INTEGER PRIMARY KEY AUTOINCREMENT,
                    type    TEXT NOT NULL,
                    data    TEXT NOT NULL,
                    is_redo INTEGER DEFAULT 0
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

    const get = (query, params = []) => new Promise((resolve, reject) => {
        db.get(query, params, (err, row) => err ? reject(err) : resolve(row));
    });

    // Helper to re-sequence IDs to match 1, 2, 3...
    const syncIds = async () => {
        const rows = await all("SELECT * FROM tasks ORDER BY id ASC");
        await run("DELETE FROM tasks");
        await run("DELETE FROM sqlite_sequence WHERE name='tasks'");
        for (const t of rows) {
            await run("INSERT INTO tasks (title, description, priority, status, due_date, created_at) VALUES (?, ?, ?, ?, ?, ?)",
                [t.title, t.description, t.priority, t.status, t.due_date, t.created_at]);
        }
    };

    const pushHistory = async (type, data, isRedo = 0) => {
        await run("INSERT INTO undo_history (type, data, is_redo) VALUES (?, ?, ?)", [type, JSON.stringify(data), isRedo]);
    };

    const performHistoryAction = async (isUndoRequest) => {
        const typeFilter = isUndoRequest ? 0 : 1;
        const history = await all("SELECT * FROM undo_history WHERE is_redo = ? ORDER BY id DESC LIMIT 1", [typeFilter]);
        if (!history.length) return null;

        const entry = history[0];
        const data = JSON.parse(entry.data);
        await run("DELETE FROM undo_history WHERE id = ?", [entry.id]);

        if (entry.type === "add") {
            // Re-adding a deleted task
            await run("INSERT INTO tasks (title, description, priority, status, due_date) VALUES (?, ?, ?, ?, ?)",
                [data.title, data.description, data.priority, data.status, data.due_date]);
            await pushHistory("delete", { title: data.title }, isUndoRequest ? 1 : 0);
        } else if (entry.type === "delete") {
            // Deleting an added task
            const matches = await all("SELECT * FROM tasks WHERE title = ? ORDER BY id DESC LIMIT 1", [data.title]);
            if (matches.length) {
                const target = matches[0];
                await run("DELETE FROM tasks WHERE id = ?", [target.id]);
                await pushHistory("add", target, isUndoRequest ? 1 : 0);
            }
        }
        await syncIds();
        return entry.type === "add" ? `restored task "${data.title}"` : `removed task "${data.title}"`;
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
            await pushHistory("delete", { title });
            await syncIds();
            res.json({ success: true });
        } catch (err) {
            res.status(500).json({ error: err.message });
        }
    });

    app.delete('/tasks/:id', async (req, res) => {
        const { id } = req.params;
        try {
            const task = await get("SELECT * FROM tasks WHERE id = ?", [id]);
            if (task) await pushHistory("add", task);
            await run("DELETE FROM tasks WHERE id = ?", [id]);
            await syncIds();
            res.json({ success: true });
        } catch (err) {
            res.status(500).json({ error: err.message });
        }
    });

    const OPENAI_MODEL = process.env.OPENAI_MODEL || "gpt-4o-mini";
    const modelName = openai ? OPENAI_MODEL : "Local Standard Engine";

    app.get('/status', (req, res) => {
        res.json({ model: modelName, isPro: !!openai });
    });

    app.post('/chat', async (req, res) => {
        const { message, lastResponse } = req.body;
        const msg = (message || "").toLowerCase();
        const tasks = await all("SELECT * FROM tasks ORDER BY id ASC");
        const prefix = openai ? `[Mode: ${OPENAI_MODEL}] ` : `[Mode: ${modelName}] `;

        // --- GLOBAL CONFIRMATION HANDLER (Runs before ANY AI/NLP logic) ---
        // If the user says "yes" to a confirmation prompt, we handle it strictly based on the ID in that prompt.
        const confirmationWords = ["yes", "do it", "confirm", "yea", "yup", "sure", "ok"];
        if (confirmationWords.includes(msg) && lastResponse && (lastResponse.includes("confirm you want to delete") || lastResponse.includes("confirm you want to remove"))) {
            const idMatch = lastResponse.match(/#(\d+)/);
            if (idMatch) {
                const targetId = parseInt(idMatch[1]);
                const task = await get("SELECT * FROM tasks WHERE id = ?", [targetId]);
                if (task) {
                    const deletedTitle = task.title; // Capture title before deletion
                    await pushHistory("add", task);
                    await run("DELETE FROM tasks WHERE id = ?", [targetId]);
                    await syncIds();
                    return res.json({ response: `${prefix}Confirmed. Success! Removed Task #${targetId} ("${deletedTitle}").`, model: modelName });
                } else {
                    return res.json({ response: `${prefix}Wait, I can't find Task #${targetId} anymore. Did it get deleted already?`, model: modelName });
                }
            }
        }

        if (openai) {
            console.log(`AI CHAT: Using Pro Mode (${OPENAI_MODEL})`);
            try {
                const completion = await openai.chat.completions.create({
                    model: OPENAI_MODEL,
                    messages: [
                        {
                            role: "system",
                            content: `You are a task routing assistant.
                            CURRENT TASKS:
                            ${tasks.map(t => `- [ID: ${t.id}] "${t.title}"`).join('\n') || "None"}
                            
                            LAST RESPONSE: "${lastResponse || "None"}"

                            CURRENT DATABASE SNAPSHOT (IDs):
                            ${tasks.map(t => `#${t.id}: "${t.title}"`).join(', ') || "EMPTY"}
                            
                            LAST_ID_ADDED: ${tasks.length > 0 ? tasks[tasks.length - 1].id : "None"}

                            STRICT AI RULES:
                            1. DO NOT SIMULATE SUCCESS. If you want to delete/undo/redo, return the ACTION name. The system will create the "Success" message after the DB actually updates.
                            2. NO HALLUCINATIONS: Do not refer to IDs that are not in the SNAPSHOT above.
                            3. CONTEXT: "Delete last" always means Target ID: ${tasks.length > 0 ? tasks[tasks.length - 1].id : "None"}.
                            4. TYPO TOLERANCE: Treat "adddd" as "add", etc.
                            5. RETURN JSON ONLY: { "action": "add"|"delete"|"ask_confirmation"|"undo"|"redo"|"message", "id": number|null, "title": "string"|null, "message": "string"|null }`
                        },
                        { role: "user", content: message }
                    ],
                    response_format: { type: "json_object" }
                });

                const gpt = JSON.parse(completion.choices[0].message.content);
                const prefix = `[Mode: ${OPENAI_MODEL}] `;

                if (gpt.action === "add") {
                    const title = gpt.title || message;
                    await run("INSERT INTO tasks (title, priority) VALUES (?, ?)", [title, "medium"]);
                    await pushHistory("delete", { title });
                    await syncIds();
                    return res.json({ response: `${prefix}Added task: "${title}"`, model: OPENAI_MODEL });
                }
                else if (gpt.action === "ask_confirmation" || gpt.action === "message") {
                    return res.json({ response: `${prefix}${gpt.message}`, model: OPENAI_MODEL });
                }
                else if (gpt.action === "delete") {
                    // Logic override for "delete last" or hallucinated IDs
                    let targetId = gpt.id;
                    const lastKeywords = ["last", "latest", "recent", "just added", "just made"];
                    if (lastKeywords.some(k => message.toLowerCase().includes(k)) && tasks.length > 0) {
                        targetId = tasks[tasks.length - 1].id;
                    }

                    if (!targetId) return res.json({ response: `${prefix}Which task should I delete? Use the ID or name.`, model: OPENAI_MODEL });

                    const task = await get("SELECT * FROM tasks WHERE id = ?", [targetId]);
                    if (!task) return res.json({ response: `${prefix}Error: Task #${targetId} does not exist in the database.`, model: OPENAI_MODEL });

                    await pushHistory("add", task);
                    await run("DELETE FROM tasks WHERE id = ?", [targetId]);
                    await syncIds();
                    return res.json({ response: `${prefix}Success! Removed Task #${targetId} ("${task.title}").`, model: OPENAI_MODEL });
                }

                return res.json({ response: `${prefix}I'm not sure how to help. Try 'add lunch'.`, model: OPENAI_MODEL });
            } catch (err) {
                console.error(`OpenAI Error (${OPENAI_MODEL}):`, err.message);
                // Fall through to local NLP logic below
            }
        }

        console.log("AI CHAT: Using Local NLP Fallback");
        const fallbackPrefix = `[Mode: ${modelName}] `;

        // Fuzzy Match Regex Patterns (Handles repeated letters)
        const addRegex = /\b(a+d+s?|c+r+e+a+t+e+|m+a+k+e+|n+e+w+)\b/i;
        const deleteRegex = /\b(d+e+l+e+t+e+|r+e+m+o+v+e+|c+l+e+a+r+|t+a+k+e+\s+o+u+t+|d+e+l+)\b/i;
        const undoRegex = /\b(u+n+d+o+|r+e+v+e+r+t+|o+o+p+s+)\b/i;
        const redoRegex = /\b(r+e+d+o+|b+r+i+n+g+\s+b+a+c+k+)\b/i;

        // 2. Undo/Redo (Fuzzy)
        if (undoRegex.test(msg)) {
            const resText = await performHistoryAction(true);
            return res.json({ response: resText ? `${fallbackPrefix}Undone! ${resText}.` : `${fallbackPrefix}Nothing to undo.`, model: modelName });
        }
        if (redoRegex.test(msg)) {
            const resText = await performHistoryAction(false);
            return res.json({ response: resText ? `${fallbackPrefix}Redone! ${resText}.` : `${fallbackPrefix}Nothing to redo.`, model: modelName });
        }

        // 3. Delete (Fuzzy & Keywords)
        if (deleteRegex.test(msg) && !addRegex.test(msg)) {
            let targetId = null;
            let targetTitle = "";
            const lastKeywords = ["last", "latest", "recent", "just made", "just added"];
            const isLastRequest = lastKeywords.some(k => msg.includes(k));

            if (isLastRequest) {
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
                    targetTitle = t ? t.title : null;
                } else {
                    for (const t of tasks) {
                        const titleLower = t.title.toLowerCase();
                        const escapedTitle = titleLower.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
                        const titleRegex = new RegExp(`\\b${escapedTitle}\\b`, 'i');
                        if (titleRegex.test(msg)) {
                            targetId = t.id;
                            targetTitle = t.title;
                            break;
                        }
                    }
                }
            }

            if (targetId && targetTitle) {
                return res.json({ response: `${fallbackPrefix}Please confirm you want to delete task #${targetId} ("${targetTitle}")? (Yes/No)`, model: modelName });
            }
        }

        // 4. List Check
        if (msg.includes("list") || msg.includes("show") || msg.includes("tasks")) {
            return res.json({ response: `${fallbackPrefix}You have ${tasks.length} task(s).`, model: modelName });
        }

        // 5. Default to Add
        let title = message;
        if (addRegex.test(msg)) {
            title = message.replace(new RegExp(addRegex.source, 'gi'), "").trim();
            title = title.replace(/\b(task|to|remind|me|a|an)\b/gi, "").trim();
            title = title.replace(/^[^a-zA-Z0-9]+|[^a-zA-Z0-9]+$/g, '').trim();
        }

        if (!title) title = "New Task";
        await run("INSERT INTO tasks (title) VALUES (?)", [title]);
        await pushHistory("delete", { title });
        await syncIds();
        return res.json({ response: `${fallbackPrefix}Added task: "${title}"`, model: modelName });
    });


    app.listen(3000, () => {
        console.log("Web API running on http://localhost:3000");
    });
}

start().catch(err => console.error(err));
