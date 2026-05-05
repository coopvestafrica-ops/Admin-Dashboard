/**
 * Seed Super Admin
 *
 * Creates the first super_admin user in the admin database.
 * Run once after setting up the production database.
 *
 * Usage:
 *   pnpm --filter @workspace/scripts run seed-super-admin
 *
 * Environment variables required (set in .env or environment):
 *   DATABASE_URL  — PostgreSQL connection string for the admin database
 *   ADMIN_EMAIL   — Email for the super admin (default: admin@coopvest.africa)
 *   ADMIN_NAME    — Display name (default: Super Admin)
 *   ADMIN_PASSWORD — Initial password (required — must be 12+ characters)
 */

import { drizzle } from "drizzle-orm/node-postgres";
import pkg from "pg";
import bcrypt from "bcryptjs";
import { usersTable, SUPER_ADMIN_CAP } from "@workspace/db";
import { eq, and } from "drizzle-orm";

const { Pool } = pkg;

const DATABASE_URL = process.env.DATABASE_URL;
if (!DATABASE_URL) {
  console.error("ERROR: DATABASE_URL environment variable is not set.");
  process.exit(1);
}

const ADMIN_EMAIL = (process.env.ADMIN_EMAIL || "admin@coopvest.africa").toLowerCase().trim();
const ADMIN_NAME = process.env.ADMIN_NAME || "Super Admin";
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD;

if (!ADMIN_PASSWORD || ADMIN_PASSWORD.length < 12) {
  console.error("ERROR: ADMIN_PASSWORD must be set and at least 12 characters long.");
  console.error("  Example: ADMIN_PASSWORD='MyStr0ng!Pass' pnpm --filter @workspace/scripts run seed-super-admin");
  process.exit(1);
}

async function main() {
  const pool = new Pool({ connectionString: DATABASE_URL });
  const db = drizzle(pool);

  console.log(`\nConnecting to database...`);

  // Check if super admin already exists
  const existing = await db
    .select({ id: usersTable.id, email: usersTable.email })
    .from(usersTable)
    .where(and(eq(usersTable.email, ADMIN_EMAIL), eq(usersTable.role, "super_admin")))
    .limit(1);

  if (existing.length > 0) {
    console.log(`\nSuper admin already exists: ${existing[0].email} (id=${existing[0].id})`);
    console.log("No changes made. To reset the password, use the Change Password feature after logging in.");
    await pool.end();
    return;
  }

  // Check cap
  const superAdmins = await db
    .select({ id: usersTable.id })
    .from(usersTable)
    .where(eq(usersTable.role, "super_admin"));

  if (superAdmins.length >= SUPER_ADMIN_CAP) {
    console.error(`ERROR: Super admin cap of ${SUPER_ADMIN_CAP} reached. Cannot add more.`);
    await pool.end();
    process.exit(1);
  }

  // Hash password
  console.log(`Hashing password...`);
  const passwordHash = await bcrypt.hash(ADMIN_PASSWORD, 12);

  // Insert
  const [created] = await db
    .insert(usersTable)
    .values({
      email: ADMIN_EMAIL,
      name: ADMIN_NAME,
      passwordHash,
      role: "super_admin",
      isActive: true,
      mustChangePassword: true,
      passwordChangedAt: new Date(),
    })
    .returning({ id: usersTable.id, email: usersTable.email, role: usersTable.role });

  console.log(`\nSuper admin created successfully!`);
  console.log(`  ID:    ${created.id}`);
  console.log(`  Email: ${created.email}`);
  console.log(`  Role:  ${created.role}`);
  console.log(`\nIMPORTANT: You will be prompted to change your password on first login.`);
  console.log(`           Privileged roles require MFA — set it up immediately after login.\n`);

  await pool.end();
}

main().catch((err) => {
  console.error("Seed failed:", err.message);
  process.exit(1);
});
