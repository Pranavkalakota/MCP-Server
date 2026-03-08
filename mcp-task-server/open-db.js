import { execSync } from 'child_process';
import readline from 'readline';

const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
});

function isInstalled(appPath) {
    try {
        execSync(`ls "${appPath}"`, { stdio: 'ignore' });
        return true;
    } catch {
        return false;
    }
}

async function main() {
    const appPath = '/Applications/DB Browser for SQLite.app';
    const dbPath = 'tasks.db';

    if (isInstalled(appPath)) {
        console.log("Opening tasks.db in DB Browser for SQLite...");
        execSync(`open -a "DB Browser for SQLite" "${dbPath}"`);
        process.exit(0);
    } else {
        rl.question("DB Browser for SQLite is not installed. Would you like to install it via Homebrew? (y/n): ", (answer) => {
            if (answer.toLowerCase() === 'y' || answer.toLowerCase() === 'yes') {
                console.log("Installing DB Browser for SQLite...");
                try {
                    execSync("brew install --cask db-browser-for-sqlite", { stdio: 'inherit' });
                    console.log("Installation complete! Opening tasks.db...");
                    execSync(`open -a "DB Browser for SQLite" "${dbPath}"`);
                } catch (e) {
                    console.error("Failed to install. Falling back to terminal sqlite3...", e.message);
                    console.log("You can view tasks live by typing: sqlite3 tasks.db -header -column 'SELECT * FROM tasks;'");
                }
            } else {
                console.log("Skipping installation. You can view tasks live in your terminal by typing:");
                console.log("sqlite3 tasks.db -header -column 'SELECT * FROM tasks;'");
            }
            process.exit(0);
        });
    }
}

main();
