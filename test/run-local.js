#!/usr/bin/env node
/**
 * Run the iApp logic locally (no Docker, no TEE).
 * Sets IEXEC_IN and IEXEC_OUT to ./test/workspace/in and ./test/workspace/out.
 * Usage: node test/run-local.js [path-to-dataset.json]
 */

import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, "..");

const workspaceIn = path.join(root, "test", "workspace", "in");
const workspaceOut = path.join(root, "test", "workspace", "out");

const datasetPath = process.argv[2] || path.join(root, "test", "dataset-example.json");

if (!fs.existsSync(datasetPath)) {
  fs.mkdirSync(path.dirname(datasetPath), { recursive: true });
  const example = {
    rules: { minScore: 70, maxRisk: 0.3 },
    participants: [
      { wallet: "0xA", score: 85, risk: 0.2 },
      { wallet: "0xB", score: 60, risk: 0.1 },
      { wallet: "0xC", score: 90, risk: 0.25 },
    ],
    totalPool: 1000,
  };
  fs.writeFileSync(datasetPath, JSON.stringify(example, null, 2));
  console.log("Created example dataset at", datasetPath);
}

fs.mkdirSync(workspaceIn, { recursive: true });
fs.mkdirSync(workspaceOut, { recursive: true });
fs.copyFileSync(datasetPath, path.join(workspaceIn, "dataset.json"));

process.env.IEXEC_IN = workspaceIn;
process.env.IEXEC_OUT = workspaceOut;

await import("../app/index.js");

console.log("Output in", workspaceOut);
console.log("result.json:", fs.readFileSync(path.join(workspaceOut, "result.json"), "utf8"));
