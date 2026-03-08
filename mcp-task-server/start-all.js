const { spawn, execSync } = require('child_process');
const path = require('path');

console.log("🚀 Starting TaskVibe Task System...\n");

// 1. Start the Web UI backend server
console.log("1. Starting Web API Server on port 3000...");
const server = spawn('node', ['web-ui-server.cjs'], { stdio: 'inherit' });

// 2. Open the frontend inside the default browser
setTimeout(() => {
    console.log("2. Opening Web Dashboard in your browser...");
    try {
        const uiPath = path.resolve(__dirname, '../task-ui/index.html');
        // 'open' works on macOS, which is what we target
        execSync(`open "${uiPath}"`);
    } catch (e) {
        console.error("Could not automatically open browser.");
    }

    // 3. Open the SQLite database via our smart script
    console.log("3. Launching Database viewer...");
    try {
        require('./open-db.js');
    } catch (e) {
        spawn('node', ['open-db.js'], { stdio: 'inherit' });
    }

    console.log("\n✅ ALL SYSTEMS GO! Press Ctrl+C to stop the Web API server.");
}, 1500); // 1.5s delay to assure the server is up before opening browser

// Catch Ctrl+C to cleanly kill the server
process.on('SIGINT', () => {
    console.log("\nShutting down TaskVibe servers...");
    server.kill();
    process.exit(0);
});
