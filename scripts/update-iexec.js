#!/usr/bin/env node
/**
 * Update iexec.json from environment variables (for deploy).
 * OWNER, DOCKER_IMAGE (e.g. user/repo:tag), CHECKSUM (0x + 64 hex).
 * Usage: OWNER=0x... DOCKER_IMAGE=user/shadowsettle:latest CHECKSUM=0x... node scripts/update-iexec.js
 */
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, "..");
const iexecPath = path.join(root, "iexec.json");

const config = JSON.parse(fs.readFileSync(iexecPath, "utf8"));
if (process.env.OWNER) config.app.owner = process.env.OWNER;
if (process.env.DOCKER_IMAGE) config.app.multiaddr = process.env.DOCKER_IMAGE;
if (process.env.CHECKSUM) config.app.checksum = process.env.CHECKSUM;

fs.writeFileSync(iexecPath, JSON.stringify(config, null, 2) + "\n");
console.log("Updated iexec.json");
