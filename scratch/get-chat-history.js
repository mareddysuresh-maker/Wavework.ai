const { execSync } = require('child_process');
const fs = require('fs');

try {
  console.log("Running git show...");
  const output = execSync('git log -p -n 5 -- frontend/src/components/ChatEngineView.tsx', { encoding: 'utf8' });
  fs.writeFileSync('scratch/chat-history.txt', output);
  console.log("Done!");
} catch (err) {
  console.error("Error:", err.message);
  fs.writeFileSync('scratch/chat-history.txt', "Error running git log: " + err.message + "\nStack: " + err.stack);
}
