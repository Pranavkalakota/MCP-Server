import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";
import readline from "node:readline";
import path from "node:path";
import { fileURLToPath } from "node:url";
import "dotenv/config";
import OpenAI from "openai";

const openai = process.env.OPENAI_API_KEY && process.env.OPENAI_API_KEY.startsWith("sk-")
    ? new OpenAI({ apiKey: process.env.OPENAI_API_KEY })
    : null;

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Initialize MCP Client Transport (spawns the MCP server as a child process)
const transport = new StdioClientTransport({
    command: process.execPath, // e.g., 'node'
    args: [path.join(__dirname, "dist/index.js")],
    env: { ...process.env, MCP_TASK_DB_PATH: __dirname }
});

const client = new Client({
    name: "cli-chat-client",
    version: "1.0.0"
}, {
    capabilities: {}
});

const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
});

async function main() {
    console.log("🤖 MCP Bot: Booting up and connecting to the MCP Task Server...");
    await client.connect(transport);
    console.log("🤖 MCP Bot: Connected! I am your conversational CLI assistant.");
    if (openai) {
        console.log("🤖 MCP Bot: Powered by OpenAI! You can ask me complex queries.");
    } else {
        console.log("🤖 MCP Bot: Since we don't have an OpenAI API key configured, I am using a lightweight local NLP engine.");
    }
    console.log("🤖 MCP Bot: You can say things like:");
    console.log("   - 'Add a high priority task to study algorithms due 2026-03-15'");
    console.log("   - 'Show me my tasks'");
    console.log("   - 'Delete task 2'");
    console.log("   (Type 'exit' to quit)\n");

    prompt();
}

function prompt() {
    rl.question("\x1b[36mYou: \x1b[0m", async (input) => {
        const text = input.trim();
        if (text.toLowerCase() === 'exit' || text.toLowerCase() === 'quit') {
            console.log("🤖 MCP Bot: Goodbye!");
            process.exit(0);
        }

        if (text) {
            await handleQuery(text);
        }
        prompt();
    });
}

async function handleQuery(query) {
    if (openai) {
        try {
            console.log(`🤖 MCP Bot: Asking OpenAI...`);
            const completion = await openai.chat.completions.create({
                model: "gpt-4o-mini",
                messages: [
                    {
                        role: "system",
                        content: "You are a task routing assistant. The user will ask you to manage tasks. Decide which action to take: 'add', 'delete', or 'list'. Return your decision strictly as a JSON object like { \"action\": \"add\", \"title\": \"Walk dog\", \"priority\": \"high\" }. If they want to delete, return { \"action\": \"delete\", \"id\": 5 }. If they want to list, return { \"action\": \"list\" }."
                    },
                    { role: "user", content: query }
                ],
                response_format: { type: "json_object" }
            });

            const gptDecision = JSON.parse(completion.choices[0].message.content);

            if (gptDecision.action === "add") {
                const priority = gptDecision.priority || "medium";
                const title = gptDecision.title || "Untitled Task";
                const due_date = gptDecision.due_date || undefined;
                console.log(`🤖 MCP Bot: Calling MCP tool 'add_task'...`);
                const res = await client.callTool({ name: "add_task", arguments: { title, priority, due_date } });
                console.log(`🤖 MCP Bot: Successfully added "${title}"!`);
            }
            else if (gptDecision.action === "delete") {
                if (gptDecision.id) {
                    console.log(`🤖 MCP Bot: Calling MCP tool 'delete_task'...`);
                    const res = await client.callTool({ name: "delete_task", arguments: { id: parseInt(gptDecision.id) } });
                    console.log(`🤖 MCP Bot: Deleted task #${gptDecision.id}`);
                }
            }
            else if (gptDecision.action === "list") {
                console.log(`🤖 MCP Bot: Calling MCP tool 'get_tasks'...`);
                const res = await client.callTool({ name: "get_tasks", arguments: {} });
                const content = res.content[0].text;
                if (content.startsWith("No ")) {
                    console.log(`🤖 MCP Bot: ${content}`);
                } else {
                    const tasks = JSON.parse(content);
                    console.log(`🤖 MCP Bot: You have ${tasks.length} active task(s):`);
                    tasks.forEach(t => {
                        const color = t.priority === 'high' ? '\x1b[31m' : t.priority === 'medium' ? '\x1b[33m' : '\x1b[32m';
                        console.log(`   [ID: ${t.id}] ${t.title} ${color}(${t.priority})\x1b[0m - Due: ${t.due_date || 'None'}`);
                    });
                }
            }
            return;
        } catch (err) {
            console.log(`🤖 MCP Bot: OpenAI parsing failed. Details: ${err.message}`);
        }
    }

    // --- FALLBACK NLP LOGIC (if no valid API key) ---
    const q = query.toLowerCase();

    // 1. DELETE INTENT
    if (q.includes("delete") || q.includes("remove") || q.includes("cancel")) {
        const match = q.match(/(?:task\s+)?#?(\d+)/i);
        if (match) {
            const id = parseInt(match[1]);
            console.log(`🤖 MCP Bot: Calling MCP tool 'delete_task' with { id: ${id} }...`);
            try {
                const res = await client.callTool({ name: "delete_task", arguments: { id } });
                console.log(`🤖 MCP Bot: ${res.content[0].text}`);
            } catch (e) {
                console.log(`🤖 MCP Bot: Error: ${e.message}`);
            }
        } else {
            console.log("🤖 MCP Bot: Which task ID would you like me to delete? (e.g., 'delete 5')");
        }
        return;
    }

    // 2. READ INTENT
    if (q.includes("list") || q.includes("show") || q.includes("get") || q.includes("view")) {
        console.log(`🤖 MCP Bot: Calling MCP tool 'get_tasks'...`);
        try {
            const res = await client.callTool({ name: "get_tasks", arguments: {} });
            const content = res.content[0].text;
            if (content.startsWith("No ")) {
                console.log(`🤖 MCP Bot: ${content}`);
            } else {
                const tasks = JSON.parse(content);
                console.log(`🤖 MCP Bot: You have ${tasks.length} active task(s):`);
                tasks.forEach(t => {
                    const color = t.priority === 'high' ? '\x1b[31m' : t.priority === 'medium' ? '\x1b[33m' : '\x1b[32m';
                    console.log(`   [ID: ${t.id}] ${t.title} ${color}(${t.priority})\x1b[0m - Due: ${t.due_date || 'None'}`);
                });
            }
        } catch (e) {
            console.log(`🤖 MCP Bot: Error retrieving tasks.`);
        }
        return;
    }

    // 3. CREATE INTENT
    if (q.includes("add") || q.includes("create") || q.includes("new") || q.includes("remind")) {
        let priority = "medium";
        if (q.includes("high") || q.includes("urgent")) priority = "high";
        if (q.includes("low") || q.includes("whenever")) priority = "low";

        let due_date = undefined;
        const dateMatch = q.match(/\d{4}-\d{2}-\d{2}/);
        if (dateMatch) due_date = dateMatch[0];

        // Strip common command words to isolate the title
        let title = query.replace(/(add|create|make|a|new|task|to|remind|me|high|medium|low|urgent|priority|due|on|date|\d{4}-\d{2}-\d{2})/gi, "").trim();
        // Clean up leading/trailing punctuation or extra spaces
        title = title.replace(/^[^a-zA-Z0-9]+|[^a-zA-Z0-9]+$/g, '').trim();
        if (!title) title = "Untitled Task";

        console.log(`🤖 MCP Bot: Calling MCP tool 'add_task' with { title: "${title}", priority: "${priority}", due_date: "${due_date || 'null'}" }...`);
        try {
            const res = await client.callTool({ name: "add_task", arguments: { title, priority, due_date } });
            try {
                const added = JSON.parse(res.content[0].text);
                console.log(`🤖 MCP Bot: Success! Added task #${added.id}: "${added.title}"`);
            } catch {
                console.log(`🤖 MCP Bot: Success! ${res.content[0].text}`);
            }
        } catch (e) {
            console.log(`🤖 MCP Bot: Error adding task: ${e.message}`);
        }
        return;
    }

    console.log("🤖 MCP Bot: I'm not sure what you mean. Try using words like 'add', 'show', or 'delete'.");
}

main().catch((err) => {
    console.error("Fatal Error:", err);
    process.exit(1);
});
