import { NextResponse } from "next/server";
import pool from "../../../lib/db";

// GET /api/migrate — run DB migrations safely (idempotent, ADD COLUMN IF NOT EXISTS)
export async function GET() {
  const results: Record<string, string> = {};

  // 1. Add description_ai column to findings (AI-improved description)
  try {
    await pool.query(`
      ALTER TABLE findings
      ADD COLUMN IF NOT EXISTS description_ai TEXT
    `);
    results.description_ai = "OK";
  } catch (e: any) {
    results.description_ai = `ERROR: ${e.message}`;
  }

  // 2. Add recommendations column to findings (AI recommendations)
  try {
    await pool.query(`
      ALTER TABLE findings
      ADD COLUMN IF NOT EXISTS recommendations TEXT
    `);
    results.recommendations = "OK";
  } catch (e: any) {
    results.recommendations = `ERROR: ${e.message}`;
  }

  // 3. Drop ai_analysis column — no longer used (wrapped in try, may already be gone)
  // NOTE: We keep ai_analysis for now to avoid breaking existing data.
  // We simply stop writing to it. Can be dropped later manually if desired.
  results.ai_analysis = "KEPT (stop writing, kept for backward compat)";

  return NextResponse.json({ ok: true, migrations: results });
}
