import { spawn, execSync } from 'child_process';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

console.log("🚀 Starting MCP Server Integration Task System...\n");

// 1. Start the Web UI backend server (which is in CommonJS)
console.log("1. Starting Web API Server on port 3000...");
const server = spawn('node', ['web-ui-server.cjs'], { stdio: 'inherit' });

// 2. Open the frontend inside the default browser
setTimeout(() => {
    console.log("2. Opening Web Dashboard in your browser...");
    try {
        const uiPath = path.resolve(__dirname, '../task-ui/index.html');
        // 'open' works natively on macOS seamlessly
        execSync(`open "${uiPath}"`);
    } catch (e) {
        console.error("Could not automatically open browser.");
    }

    // 3. Open the SQLite database via our smart script
    console.log("3. Launching Database viewer...");
    try {
        // Since open-db is an ES module, we just spawn a Node process
        spawn('node', ['open-db.js'], { stdio: 'inherit' });
    } catch (e) {
        console.error("Failed to launch DB viewer script.");
    }

    console.log("\n✅ ALL SYSTEMS GO! Press Ctrl+C to stop the Web API server.");
}, 1500);

// Catch Ctrl+C to cleanly kill the server
process.on('SIGINT', () => {
    console.log("\nShutting down MCP Server Integration servers...");
    server.kill();
    process.exit(0);
});
