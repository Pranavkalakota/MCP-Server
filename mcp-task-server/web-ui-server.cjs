const express = require('express');
const cors = require('cors');
const initSqlJs = require('sql.js');
const fs = require('fs');
const path = require('path');

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

    app.listen(3005, () => {
        console.log("Web API running on http://localhost:3005");
    });
}

start().catch(err => console.error(err));
