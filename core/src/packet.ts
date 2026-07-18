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

