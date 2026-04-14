import { NextResponse } from "next/server"
import { Pool } from "pg"

// One-time migration endpoint — adds missing columns/enums to the Neon DB.
// Hit GET /api/migrate once from the browser, then delete this file.
export async function GET() {
  const connectionString = process.env.DATABASE_URL
  if (!connectionString) {
    return NextResponse.json({ error: "DATABASE_URL not set" }, { status: 500 })
  }

  const pool = new Pool({ connectionString })

  try {
    // 1. Create PropertyType enum if it doesn't exist
    await pool.query(`
      DO $$ BEGIN
        CREATE TYPE "PropertyType" AS ENUM ('T0','T1','T2','T3','T4','T5_PLUS');
      EXCEPTION WHEN duplicate_object THEN NULL;
      END $$;
    `)

    // 2. Add propertyType column to Booking if it doesn't exist
    await pool.query(`
      ALTER TABLE "Booking"
        ADD COLUMN IF NOT EXISTS "propertyType" "PropertyType";
    `)

    await pool.end()
    return NextResponse.json({ ok: true, message: "Migration applied successfully" })
  } catch (err) {
    await pool.end()
    return NextResponse.json(
      { error: err instanceof Error ? err.message : String(err) },
      { status: 500 }
    )
  }
}
