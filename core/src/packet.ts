import * as fs from "node:fs";
import * as path from "node:path";
import Ajv2020 from "ajv/dist/2020";
import type { ProofPacket } from "./types";

/** Locate the Proof Packet JSON schema whether running from src, dist, or a copy in core/. */
export function schemaPath(): string {
  const candidates = [
    path.join(__dirname, "..", "..", "schema", "proof-packet.schema.json"), // repo root (core/src|dist → repo)
    path.join(__dirname, "..", "schema", "proof-packet.schema.json"), // bundled copy in core/
    path.join(process.cwd(), "schema", "proof-packet.schema.json"),
  ];
  for (const c of candidates) if (fs.existsSync(c)) return c;
  throw new Error("proof-packet.schema.json not found (looked in repo/schema and core/schema)");
}

export function loadSchema(): object {
  return JSON.parse(fs.readFileSync(schemaPath(), "utf8"));
}

export interface ValidationResult {
  valid: boolean;
  errors: string[];
}

/** Validate a packet against the JSON schema — the runtime source of truth. */
export function validate(packet: unknown): ValidationResult {
  const ajv = new Ajv2020({ allErrors: true, strict: false });
  ajv.addFormat("date-time", true); // permissive; we don't need strict date validation
  const v = ajv.compile(loadSchema());
  const valid = v(packet) as boolean;
  const errors = (v.errors ?? []).map((e) => `${e.instancePath || "/"} ${e.message ?? ""}`.trim());
  return { valid, errors };
}

/** Write the machine record to .prism/runs/<id>.json and return its path. */
export function writeRun(repoRoot: string, packet: ProofPacket): string {
  const dir = path.join(repoRoot, ".prism", "runs");
  fs.mkdirSync(dir, { recursive: true });
  const file = path.join(dir, `${packet.id}.json`);
  fs.writeFileSync(file, JSON.stringify(packet, null, 2) + "\n");
  return file;
}

/** Locate the HTML renderer template (repo root renderer/ or a copy in core/). */
export function rendererPath(): string {
  const candidates = [
    path.join(__dirname, "..", "..", "renderer", "proof-packet.html"),
    path.join(__dirname, "..", "renderer", "proof-packet.html"),
    path.join(process.cwd(), "renderer", "proof-packet.html"),
  ];
  for (const c of candidates) if (fs.existsSync(c)) return c;
  throw new Error("renderer/proof-packet.html not found");
}

