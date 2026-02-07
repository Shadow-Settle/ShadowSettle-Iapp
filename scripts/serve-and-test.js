#!/usr/bin/env node
/**
 * Start a minimal HTTP server so iapp test can fetch the local dataset (iapp CLI uses fetch(), which doesn't support file://).
 * Serves project root; then runs: iapp test --inputFile http://localhost:PORT/test/dataset-example.json
 */
import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import { fileURLToPath } from "node:url";
import { execSync } from "node:child_process";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, "..");
const PORT = 37654;

/** Host IP reachable from this machine and from Docker container (avoids host.docker.internal / 127.0.0.1 issues). */
function getHostIP() {
  const nets = os.networkInterfaces();
  for (const name of Object.keys(nets)) {
    for (const n of nets[name] || []) {
      if (n.family === "IPv4" && !n.internal) return n.address;
    }
  }
  return "127.0.0.1";
}

const server = http.createServer((req, res) => {
  const urlPath = (req.url?.split("?")[0] || "/").replace(/^\//, "");
  const filePath = path.resolve(root, decodeURIComponent(urlPath));
  if (!filePath.startsWith(root)) {
    res.writeHead(403).end();
    return;
  }
  fs.readFile(filePath, (err, data) => {
    if (err) {
      res.writeHead(404).end();
      return;
    }
    const ext = path.extname(filePath);
    const types = { ".json": "application/json", ".js": "application/javascript" };
    res.setHeader("Content-Type", types[ext] || "application/octet-stream");
    res.end(data);
  });
});

// Bind to all interfaces so both host and container can reach this server
server.listen(PORT, "0.0.0.0", () => {
  const hostIP = getHostIP();
  const url = `http://${hostIP}:${PORT}/test/dataset-example.json`;
  // Give the server a moment to accept connections before the child fetches
  setTimeout(() => {
    try {
      execSync(`iapp test --inputFile "${url}"`, { stdio: "inherit", cwd: root });
    } finally {
      server.close();
    }
  }, 200);
});
