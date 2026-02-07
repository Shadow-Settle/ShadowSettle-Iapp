#!/usr/bin/env node
/**
 * ShadowSettle iApp — confidential settlement logic (TEE).
 * Reads dataset from IEXEC_IN, computes eligible payouts, writes result to IEXEC_OUT.
 * One task, many participants (bulk processing).
 */

import fs from "fs";
import path from "path";
import { createHash } from "crypto";

const IEXEC_IN = process.env.IEXEC_IN;
const IEXEC_OUT = process.env.IEXEC_OUT;

function fail(msg) {
  console.error("ERROR:", msg);
  process.exit(1);
}

function loadDataset() {
  if (!IEXEC_IN || !IEXEC_OUT) {
    fail("Missing IEXEC_IN or IEXEC_OUT");
  }

  const inDir = path.resolve(IEXEC_IN);
  if (!fs.existsSync(inDir)) {
    fail(`IEXEC_IN directory not found: ${inDir}`);
  }

  // When run with iapp run --inputFile <url>, the worker sets IEXEC_INPUT_FILE_NAME_1 (e.g. test_data.json).
  const inputFilesNumber = parseInt(process.env.IEXEC_INPUT_FILES_NUMBER || "0", 10);
  const inputFileName1 = process.env.IEXEC_INPUT_FILE_NAME_1;
  let dataPath = null;
  if (inputFilesNumber >= 1 && inputFileName1) {
    dataPath = path.join(inDir, inputFileName1);
  }
  if (!dataPath || !fs.existsSync(dataPath)) {
    dataPath = path.join(inDir, "dataset.json");
  }
  if (!fs.existsSync(dataPath)) {
    const files = fs.readdirSync(inDir).filter((f) => f.endsWith(".json"));
    if (files.length === 0) fail("No JSON dataset found in IEXEC_IN");
    dataPath = path.join(inDir, files[0]);
  }

  const raw = fs.readFileSync(dataPath, "utf8");
  let data;
  try {
    data = JSON.parse(raw);
  } catch (e) {
    fail("Invalid JSON in dataset: " + e.message);
  }

  if (!data.rules || typeof data.rules.minScore !== "number" || typeof data.rules.maxRisk !== "number") {
    fail("Dataset must have rules.minScore and rules.maxRisk (numbers)");
  }
  if (!Array.isArray(data.participants) || data.participants.length === 0) {
    fail("Dataset must have a non-empty participants array");
  }

  return data;
}

/**
 * Eligibility: score >= minScore AND risk <= maxRisk.
 * Payout: proportional to score among eligible; total = totalPool if provided, else sum of weights.
 */
function computePayouts(dataset) {
  const { rules, participants, totalPool } = dataset;
  const minScore = rules.minScore;
  const maxRisk = rules.maxRisk;

  const eligible = participants.filter(
    (p) => typeof p.score === "number" && typeof p.risk === "number" && p.score >= minScore && p.risk <= maxRisk
  );

  if (eligible.length === 0) {
    return { payouts: [], tee_attestation: "" };
  }

  const totalScore = eligible.reduce((s, p) => s + p.score, 0);
  if (totalScore <= 0) {
    return { payouts: eligible.map((p) => ({ wallet: p.wallet, amount: 0 })), tee_attestation: "" };
  }

  const pool = typeof totalPool === "number" && totalPool > 0 ? totalPool : totalScore;
  const amounts = eligible.map((p) => ({
    wallet: String(p.wallet),
    amount: Math.floor((Number(p.score) / totalScore) * pool),
  }));

  // Normalize to avoid rounding dust: give remainder to first
  const sum = amounts.reduce((s, a) => s + a.amount, 0);
  if (sum < pool && amounts.length > 0) {
    amounts[0].amount += (pool - sum);
  }

  const payouts = amounts.filter((a) => a.amount > 0);

  const result = { payouts };
  const resultJson = JSON.stringify(result, null, 0);
  const tee_attestation = createHash("sha256").update(resultJson).digest("hex");
  result.tee_attestation = "0x" + tee_attestation;

  return result;
}

function writeOutput(result) {
  fs.mkdirSync(IEXEC_OUT, { recursive: true });

  const resultPath = path.join(IEXEC_OUT, "result.json");
  fs.writeFileSync(resultPath, JSON.stringify(result, null, 2), "utf8");

  const computed = {
    "deterministic-output-path": path.join(IEXEC_OUT, "result.json"),
  };
  fs.writeFileSync(path.join(IEXEC_OUT, "computed.json"), JSON.stringify(computed), "utf8");
}

function main() {
  const dataset = loadDataset();
  const result = computePayouts(dataset);
  writeOutput(result);
  console.log("ShadowSettle iApp: computed", result.payouts.length, "payouts");
}

main();
