const express = require('express');
const cors = require('cors');
const initSqlJs = require('sql.js');
const fs = require('fs');
const path = require('path');
require('dotenv').config();
const { OpenAI } = require('openai');

const openai = process.env.OPENAI_API_KEY && process.env.OPENAI_API_KEY.startsWith("sk-")
    ? new OpenAI({ apiKey: process.env.OPENAI_API_KEY })
    : null;

const DB_PATH = path.join(__dirname, 'tasks.db');

async function start() {
    console.log("Initializing SQL.js...");
    const SQL = await initSqlJs();
    let db;
    if (fs.existsSync(DB_PATH)) {
        db = new SQL.Database(fs.readFileSync(DB_PATH));
        console.log("Loaded DB");
    } else {
        db = new SQL.Database();
        console.log("New DB");
    }

    const app = express();
    app.use(cors());
    app.use(express.json());

    app.get('/tasks', (req, res) => {
        console.log("GET /tasks");
        const result = db.exec("SELECT * FROM tasks");
        if (!result.length) return res.json([]);
        const cols = result[0].columns;
        const tasks = result[0].values.map(row =>
            Object.fromEntries(cols.map((c, i) => [c, row[i]]))
        );
        res.json(tasks);
    });

    app.post('/tasks', (req, res) => {
        console.log("POST /tasks", req.body);
        const { title, priority, due_date } = req.body;
        db.run("INSERT INTO tasks (title, priority, due_date) VALUES (?, ?, ?)", [title, priority, due_date]);
        fs.writeFileSync(DB_PATH, Buffer.from(db.export()));
        res.json({ success: true });
    });

    app.delete('/tasks/:id', (req, res) => {
        console.log("DELETE /tasks/", req.params.id);
        const { id } = req.params;
        db.run("DELETE FROM tasks WHERE id = ?", [id]);
        fs.writeFileSync(DB_PATH, Buffer.from(db.export()));
        res.json({ success: true });
    });

    app.post('/chat', async (req, res) => {
        const query = (req.body.message || "").toLowerCase();

        if (openai) {
            try {
                const completion = await openai.chat.completions.create({
                    model: "gpt-4o-mini",
                    messages: [
                        {
                            role: "system",
                            content: "You are a task routing assistant. The user will ask you to manage tasks. Decide which action to take: 'add', 'delete', or 'list'. Return your decision strictly as a JSON object like { \"action\": \"add\", \"title\": \"Walk dog\", \"priority\": \"high\" }. If they want to delete, return { \"action\": \"delete\", \"id\": 5 }. If they want to list, return { \"action\": \"list\" }."
                        },
                        {
                            role: "user",
                            content: query
                        }
                    ],
                    response_format: { type: "json_object" }
                });

                const gptDecision = JSON.parse(completion.choices[0].message.content);

                if (gptDecision.action === "add") {
                    const priority = gptDecision.priority || "medium";
                    const title = gptDecision.title || "Untitled Task";
                    const due_date = gptDecision.due_date || null;
                    db.run("INSERT INTO tasks (title, priority, due_date) VALUES (?, ?, ?)", [title, priority, due_date]);
                    fs.writeFileSync(DB_PATH, Buffer.from(db.export()));
                    return res.json({ response: `Success! Added task: "${title}"` });
                }
                else if (gptDecision.action === "delete") {
                    if (gptDecision.id) {
                        db.run("DELETE FROM tasks WHERE id = ?", [gptDecision.id]);
                        fs.writeFileSync(DB_PATH, Buffer.from(db.export()));
                        return res.json({ response: `Success! Deleted task #${gptDecision.id}.` });
                    }
                }
                else if (gptDecision.action === "list") {
                    const result = db.exec("SELECT * FROM tasks");
                    if (!result.length) return res.json({ response: "You have no active tasks matching this query." });
                    return res.json({ response: `You currently have ${result[0].values.length} active task(s).` });
                }
                return res.json({ response: "I'm not exactly sure what to do with that." });
            } catch (err) {
                console.error("OpenAI Error (Falling back to local NLP):", err.message);
                // We don't return here anymore—we just let it fall through to the fallback logic below!
            }
        }

        // --- FALLBACK NLP LOGIC (if no valid API key) ---
        // 1. DELETE INTENT
        if (query.includes("delete") || query.includes("remove") || query.includes("cancel")) {
            const match = query.match(/(?:task\s+)?#?(\d+)/i);
            if (match) {
                const id = parseInt(match[1]);
                db.run("DELETE FROM tasks WHERE id = ?", [id]);
                fs.writeFileSync(DB_PATH, Buffer.from(db.export()));
                return res.json({ response: `Success! Deleted task #${id}.` });
            } else {
                return res.json({ response: "Which task ID would you like me to delete? (e.g., 'delete 5')" });
            }
        }

        // 2. READ INTENT
        if (query.includes("list") || query.includes("show") || query.includes("get") || query.includes("view")) {
            const result = db.exec("SELECT * FROM tasks");
            if (!result.length) return res.json({ response: "You have no active tasks matching this query." });
            return res.json({ response: `You currently have ${result[0].values.length} active task(s).` });
        }

        // 3. CREATE INTENT
        if (query.includes("add") || query.includes("create") || query.includes("new") || query.includes("remind")) {
            let priority = "medium";
            if (query.includes("high") || query.includes("urgent")) priority = "high";
            if (query.includes("low") || query.includes("whenever")) priority = "low";

            let due_date = null;
            const dateMatch = query.match(/\d{4}-\d{2}-\d{2}/);
            if (dateMatch) due_date = dateMatch[0];

            let title = req.body.message.replace(/(add|create|make|a|new|task|to|remind|me|high|medium|low|urgent|priority|due|on|date|\d{4}-\d{2}-\d{2})/gi, "").trim();
            title = title.replace(/^[^a-zA-Z0-9]+|[^a-zA-Z0-9]+$/g, '').trim();
            if (!title) title = "Untitled Task";

            db.run("INSERT INTO tasks (title, priority, due_date) VALUES (?, ?, ?)", [title, priority, due_date]);
            fs.writeFileSync(DB_PATH, Buffer.from(db.export()));
            return res.json({ response: `Success! Added task: "${title}"` });
        }

        res.json({ response: "I'm not sure what you mean. Try 'add a task', 'show tasks', or 'delete task 5'." });
    });

    app.listen(3000, () => {
        console.log("Web API running on http://localhost:3000");
    });
}

start().catch(err => console.error(err));
