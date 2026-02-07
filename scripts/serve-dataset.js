#!/usr/bin/env node
/**
 * Start only the Python HTTP server for the dataset. Use when you want to run
 * iapp test yourself in another terminal.
 *
 * Terminal 1: npm run serve:dataset
 * Terminal 2: iapp test --inputFile "http://localhost:37655/test/dataset-example.json"
 *
 * If the app runs inside Docker and can't reach localhost, use your machine's IP
 * or on Mac/Windows: http://host.docker.internal:37655/test/dataset-example.json
 */
import path from "node:path";
import os from "node:os";
import { fileURLToPath } from "node:url";
import { spawn } from "node:child_process";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, "..");
const PORT = 37655;

function getHostIP() {
  const nets = os.networkInterfaces();
  for (const name of Object.keys(nets)) {
    for (const n of nets[name] || []) {
      if (n.family === "IPv4" && !n.internal) return n.address;
    }
  }
  return "127.0.0.1";
}

const host = getHostIP();
const url = `http://${host}:${PORT}/test/dataset-example.json`;
const localUrl = `http://localhost:${PORT}/test/dataset-example.json`;

console.log("Serving project root at http://0.0.0.0:" + PORT);
console.log("");
console.log("In another terminal run:");
console.log('  iapp test --inputFile "' + localUrl + '"');
console.log("");
console.log("If Docker cannot reach localhost, try:");
console.log('  iapp test --inputFile "' + url + '"');
console.log("  or on Mac/Windows: --inputFile \"http://host.docker.internal:" + PORT + "/test/dataset-example.json\"");
console.log("");
console.log("Press Ctrl+C to stop the server.");
console.log("---");

const python = process.platform === "win32" ? "python" : "python3";
const child = spawn(python, ["-m", "http.server", String(PORT), "--bind", "0.0.0.0"], {
  cwd: root,
  stdio: "inherit",
});

child.on("error", (err) => {
  console.error("Failed to start Python server:", err.message);
  console.error("Ensure Python 3 is installed (python3 or python).");
  process.exit(1);
});

child.on("exit", (code) => {
  process.exit(code ?? 0);
});
