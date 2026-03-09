#!/usr/bin/env node
"use strict";

/**
 * Standalone test: verify cloud sync by writing to Supabase user_notes and
 * reading back. Does NOT run the Next app. Uses SUPABASE_SERVICE_ROLE_KEY
 * so RLS is bypassed and we can use a test user ID.
 *
 * Usage:
 *   Set in .env.local (or env): NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY
 *   npm run test:cloud-sync
 *
 * Optional: CLOUD_SYNC_TEST_USER_ID (if set, uses that UUID; otherwise gets or creates test user test-simple-sync@blob.local)
 */

const path = require("path");
const fs = require("fs");
const { createClient } = require("@supabase/supabase-js");

const root = path.join(__dirname, "..");
const envPath = path.join(root, ".env.local");

function loadEnvLocal() {
  try {
    const content = fs.readFileSync(envPath, "utf8");
    content.split("\n").forEach((line) => {
      const m = line.match(/^([^#=]+)=(.*)$/);
      if (m) {
        const key = m[1].trim();
        let val = m[2].trim();
        if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'")))
          val = val.slice(1, -1);
        process.env[key] = val;
      }
    });
  } catch (_) {
    // .env.local optional if vars set in shell
  }
}

loadEnvLocal();

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY ?? "";
const TEST_EMAIL = "test-simple-sync@blob.local";
const TEST_PASSWORD = "test-simple-sync-dummy-password";

function main() {
  if (!supabaseUrl || !serviceRoleKey) {
    console.error(
      "Missing env. Set NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY (e.g. in .env.local)."
    );
    process.exit(1);
  }

  const supabase = createClient(supabaseUrl, serviceRoleKey, { auth: { persistSession: false } });

  async function getOrCreateTestUserId() {
    const explicitId = process.env.CLOUD_SYNC_TEST_USER_ID;
    if (explicitId) return explicitId;
    const { data: createData, error: createError } = await supabase.auth.admin.createUser({
      email: TEST_EMAIL,
      password: TEST_PASSWORD,
      email_confirm: true,
    });
    if (createData?.user?.id) return createData.user.id;
    if (createError?.message?.includes("already been registered") || createError?.code === "user_already_exists") {
      const { data: listData } = await supabase.auth.admin.listUsers({ perPage: 1000 });
      const user = listData?.users?.find((u) => u.email === TEST_EMAIL);
      if (user?.id) return user.id;
    }
    throw new Error(
      "Could not get or create test user. Create a user in the app (or Supabase Auth > Users), then set CLOUD_SYNC_TEST_USER_ID to that user's UUID in .env.local."
    );
  }

  const now = new Date().toISOString();
  const testBlobs = [
    {
      id: "test-blob-" + Date.now(),
      x: 100,
      y: 200,
      content: "# Cloud sync test\n\nIf you see this, round-trip works.",
      createdAt: now,
      updatedAt: now,
      locked: false,
      hidden: false,
    },
  ];
  const testPreferences = { theme: "dark", blobbyColor: "green" };

  async function run() {
    console.log("Cloud sync test (no app): write then read from user_notes…");
    const testUserId = await getOrCreateTestUserId();
    console.log("Test user_id:", testUserId);

    // 1) Upsert (same shape as lib/persistence.ts upsertUserBlobs)
    const { error: upsertError } = await supabase.from("user_notes").upsert(
      {
        user_id: testUserId,
        data: { notes: testBlobs, preferences: testPreferences },
        updated_at: new Date().toISOString(),
      },
      { onConflict: "user_id" }
    );

    if (upsertError) {
      console.error("Upsert failed:", upsertError.message, upsertError.code);
      process.exit(1);
    }
    console.log("Upsert OK.");

    // 2) Fetch (same shape as lib/persistence.ts fetchUserBlobs)
    const { data, error } = await supabase
      .from("user_notes")
      .select("data, updated_at")
      .eq("user_id", testUserId)
      .single();

    if (error) {
      console.error("Fetch failed:", error.message, error.code);
      process.exit(1);
    }
    if (!data) {
      console.error("Fetch returned no row.");
      process.exit(1);
    }

    const dataObj = data.data ?? {};
    const notes = Array.isArray(dataObj.notes) ? dataObj.notes : [];
    const prefs = dataObj.preferences ?? null;

    const notesOk =
      notes.length === testBlobs.length &&
      notes[0].id === testBlobs[0].id &&
      notes[0].content === testBlobs[0].content;
    const prefsOk = prefs && prefs.theme === testPreferences.theme && prefs.blobbyColor === testPreferences.blobbyColor;

    if (!notesOk || !prefsOk) {
      console.error("Round-trip failed.");
      console.error("Expected notes:", JSON.stringify(testBlobs, null, 2));
      console.error("Got notes:", JSON.stringify(notes, null, 2));
      console.error("Expected preferences:", testPreferences);
      console.error("Got preferences:", prefs);
      process.exit(1);
    }

    console.log("Fetch OK. Notes and preferences round-trip match.");
    console.log("Cloud sync store is working (write + read).");
  }

  run().catch((err) => {
    console.error(err);
    process.exit(1);
  });
}

main();
