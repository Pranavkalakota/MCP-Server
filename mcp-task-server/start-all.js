import { spawn, execSync } from 'child_process';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

console.log("Starting MCP Server Integration Task System...\n");

// 1. Start the Web UI backend server
console.log("1. Starting Web API Server on port 3000...");
const server = spawn('node', ['web-ui-server.cjs'], { stdio: 'inherit' });

// 2. Open the dashboard through Express instead of directly from filesystem
setTimeout(() => {
    console.log("2. Opening Web Dashboard in your browser...");
    try {
        execSync(`open "http://localhost:3000"`);
    } catch (e) {
        console.error("Could not automatically open browser.");
    }

    // 3. Open the SQLite database viewer
    console.log("3. Launching Database viewer...");
    try {
        spawn('node', ['open-db.js'], { stdio: 'inherit' });
    } catch (e) {
        console.error("Failed to launch DB viewer script.");
    }

    console.log("\n ALL SYSTEMS GO! Press Ctrl+C to stop the Web API server.");
}, 1500);

process.on('SIGINT', () => {
    console.log("\nShutting down MCP Server Integration servers...");
    server.kill();
    process.exit(0);
});