#!/usr/bin/env node
// validate-benchmark.mjs — validate a benchmark.json against
// compute/schemas/benchmark.schema.json (TASKS item 11).
//
// Usage: node compute/scripts/validate-benchmark.mjs <benchmark.json|-> [--schema <schema.json>]
//   "-" reads the report from stdin.
// Exit 0 when the report validates; exit 1 with one error per line on stderr.
// Human-readable logs belong on stderr — never on stdout, which stays
// machine-readable for pipelines.
//
// Implements the JSON Schema draft 2020-12 subset used by the benchmark
// schema: $ref (local #/$defs/...), $defs, type, required, properties,
// additionalProperties, enum, const, minimum, exclusiveMinimum, maximum,
// minItems, maxItems, items, minLength, maxLength, pattern.

import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const DEFAULT_SCHEMA = path.join(HERE, "..", "schemas", "benchmark.schema.json");

function resolveRef(ref, root) {
  if (!ref.startsWith("#/")) throw new Error(`unsupported $ref: ${ref}`);
  return ref
    .slice(2)
    .split("/")
    .reduce((node, part) => node?.[part.replace(/~1/g, "/").replace(/~0/g, "~")], root);
}

function typeOf(value) {
  if (value === null) return "null";
  if (Array.isArray(value)) return "array";
  if (Number.isInteger(value)) return "integer";
  return typeof value;
}

function check(schema, value, where, root, errors) {
  if (schema.$ref) schema = resolveRef(schema.$ref, root);
  const expected = schema.type;
  if (expected) {
    const actual = typeOf(value);
    const ok = expected === "number" ? actual === "number" || actual === "integer" : actual === expected;
    if (!ok) {
      errors.push(`${where}: expected type ${expected}, got ${actual}`);
      return;
    }
  }
  if (schema.const !== undefined && JSON.stringify(value) !== JSON.stringify(schema.const)) {
    errors.push(`${where}: must equal ${JSON.stringify(schema.const)}`);
  }
  if (schema.enum && !schema.enum.some((choice) => JSON.stringify(choice) === JSON.stringify(value))) {
    errors.push(`${where}: ${JSON.stringify(value)} is not one of ${JSON.stringify(schema.enum)}`);
  }
  if (typeof value === "number") {
    if (schema.minimum !== undefined && value < schema.minimum)
      errors.push(`${where}: ${value} is below minimum ${schema.minimum}`);
    if (schema.exclusiveMinimum !== undefined && value <= schema.exclusiveMinimum)
      errors.push(`${where}: ${value} must be greater than ${schema.exclusiveMinimum}`);
    if (schema.maximum !== undefined && value > schema.maximum)
      errors.push(`${where}: ${value} is above maximum ${schema.maximum}`);
  }
  if (typeof value === "string") {
    if (schema.minLength !== undefined && value.length < schema.minLength)
      errors.push(`${where}: shorter than minLength ${schema.minLength}`);
    if (schema.maxLength !== undefined && value.length > schema.maxLength)
      errors.push(`${where}: longer than maxLength ${schema.maxLength}`);
    if (schema.pattern && !new RegExp(schema.pattern).test(value))
      errors.push(`${where}: does not match pattern ${schema.pattern}`);
  }
  if (Array.isArray(value)) {
    if (schema.minItems !== undefined && value.length < schema.minItems)
      errors.push(`${where}: fewer than minItems ${schema.minItems}`);
    if (schema.maxItems !== undefined && value.length > schema.maxItems)
      errors.push(`${where}: more than maxItems ${schema.maxItems}`);
    if (schema.items) value.forEach((item, index) => check(schema.items, item, `${where}[${index}]`, root, errors));
  }
  if (value !== null && typeof value === "object" && !Array.isArray(value)) {
    for (const name of schema.required || []) {
      if (!(name in value)) errors.push(`${where}: missing required property '${name}'`);
    }
    const properties = schema.properties || {};
    for (const [name, sub] of Object.entries(value)) {
      if (name in properties) check(properties[name], sub, `${where}.${name}`, root, errors);
      else if (schema.additionalProperties === false) errors.push(`${where}: unknown property '${name}'`);
    }
  }
}

/** Validate a parsed benchmark report against the schema. Returns error strings ([] = valid). */
export function validateBenchmark(report, schema) {
  const errors = [];
  check(schema, report, "$", schema, errors);
  return errors;
}

export async function loadSchema(schemaPath = DEFAULT_SCHEMA) {
  return JSON.parse(await readFile(schemaPath, "utf8"));
}

async function main() {
  const args = process.argv.slice(2);
  let reportPath = null;
  let schemaPath = DEFAULT_SCHEMA;
  for (let i = 0; i < args.length; i++) {
    if (args[i] === "--schema") schemaPath = args[++i];
    else if (!reportPath) reportPath = args[i];
    else {
      console.error("usage: validate-benchmark.mjs <benchmark.json|-> [--schema <schema.json>]");
      process.exit(2);
    }
  }
  if (!reportPath) {
    console.error("usage: validate-benchmark.mjs <benchmark.json|-> [--schema <schema.json>]");
    process.exit(2);
  }
  let raw;
  if (reportPath === "-") {
    raw = await new Promise((resolve, reject) => {
      let data = "";
      process.stdin.setEncoding("utf8");
      process.stdin.on("data", (chunk) => (data += chunk));
      process.stdin.on("end", () => resolve(data));
      process.stdin.on("error", reject);
    });
  } else {
    raw = await readFile(reportPath, "utf8").catch((error) => {
      console.error(`cannot read ${reportPath}: ${error.message}`);
      process.exit(2);
    });
  }
  let report;
  try {
    report = JSON.parse(raw);
  } catch (error) {
    console.error(`invalid JSON: ${error.message}`);
    process.exit(1);
  }
  const schema = await loadSchema(schemaPath).catch((error) => {
    console.error(`cannot load schema ${schemaPath}: ${error.message}`);
    process.exit(2);
  });
  const errors = validateBenchmark(report, schema);
  if (errors.length) {
    for (const error of errors) console.error(error);
    console.error(`invalid: ${errors.length} error(s)`);
    process.exit(1);
  }
  console.log(JSON.stringify({ valid: true, schema_version: report.schema_version ?? null }));
}

if (process.argv[1] === fileURLToPath(import.meta.url)) await main();
