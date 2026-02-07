#!/usr/bin/env node
/**
 * Run iapp test using Python's built-in HTTP server to serve the dataset.
 * Use this if the Node-based serve-and-test.js doesn't work (e.g. Docker networking).
 *
 * 1. Starts: python3 -m http.server PORT --bind 0.0.0.0 (from project root)
 * 2. Runs: iapp test --inputFile "http://HOST:PORT/test/dataset-example.json"
 * 3. Stops the Python server
 *
 * Optional: set HOST_FOR_DOCKER=host.docker.internal (Mac/Windows) if the default host IP fails.
 */
import path from "node:path";
import os from "node:os";
import { fileURLToPath } from "node:url";
import { spawn, execSync } from "node:child_process";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, "..");
const PORT = 37655;

function getHostIP() {
  if (process.env.HOST_FOR_DOCKER) return process.env.HOST_FOR_DOCKER;
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

// Prefer python3, fallback to python
const python = process.platform === "win32" ? "python" : "python3";
const args = ["-m", "http.server", String(PORT), "--bind", "0.0.0.0"];

console.log("Starting Python HTTP server on 0.0.0.0:" + PORT + " (project root: " + root + ")");
console.log("Dataset URL for iapp test:", url);

const child = spawn(python, args, {
  cwd: root,
  stdio: ["ignore", "pipe", "pipe"],
});

let stderr = "";
child.stderr.on("data", (chunk) => {
  stderr += chunk;
});
child.stdout.on("data", (chunk) => {
  process.stdout.write(chunk);
});

function killServer() {
  try {
    child.kill("SIGTERM");
  } catch (_) {}
}

process.on("exit", killServer);
process.on("SIGINT", () => {
  killServer();
  process.exit(130);
});
process.on("SIGTERM", () => {
  killServer();
  process.exit(143);
});

// Wait for server to be ready (Python prints "Serving HTTP on ..." when ready)
await new Promise((resolve) => setTimeout(resolve, 1500));

try {
  execSync(`iapp test --inputFile "${url}"`, { stdio: "inherit", cwd: root });
} catch (err) {
  if (err.stderr) process.stderr.write(err.stderr);
  process.exitCode = err.status ?? 1;
} finally {
  killServer();
}
