// Data model, spec §2. SCHEMA_V1 is the exact DDL from the spec; each later version
// is a migration on top of it (append only).

export type DoseStatus = 'pending' | 'taken_ontime' | 'taken_late' | 'excused' | 'missed';
export type MedForm = 'pill' | 'capsule' | 'liquid' | 'patch' | 'injection' | 'inhaler' | 'drops' | 'other';
export type Mood = 'happy' | 'okay' | 'rough';
export type GuardianChannel = 'inapp' | 'whatsapp' | 'wechat' | 'sms' | 'instagram';
export type SupportLevel = 'light' | 'steady' | 'close';
/** How Steady nudges after bedtime until the user taps Goodnight. */
export type StillUp = 'off' | 'once' | 'every30' | 'every15';
/** 0 mild, 1 moderate, 2 severe. */
export type Severity = 0 | 1 | 2;

export const TABLES = [
  'profile',
  'meds',
  'schedules',
  'doses',
  'checkins',
  'guardians',
  'events',
  'badges',
  'support_conditions',
  'trophies',
  'evening_checkins',
  'harder_times',
] as const;
export type TableName = (typeof TABLES)[number];

export const PRAGMAS = `
PRAGMA journal_mode = WAL;
PRAGMA foreign_keys = ON;
`;

export const SCHEMA_V1 = `
CREATE TABLE profile (
  id INTEGER PRIMARY KEY CHECK (id = 1),
  display_name TEXT NOT NULL,
  mascot_name TEXT NOT NULL DEFAULT 'Pip',
  mascot_hue INTEGER NOT NULL DEFAULT 18,
  scarf_id TEXT NOT NULL DEFAULT 'bandana',
  scarf_hue INTEGER NOT NULL DEFAULT 8,
  scarf_pattern INTEGER NOT NULL DEFAULT 0,
  tail_dye_hue INTEGER,
  charm_id TEXT,
  timezone TEXT NOT NULL,
  quiet_start_min INTEGER NOT NULL DEFAULT 1320,
  quiet_end_min INTEGER NOT NULL DEFAULT 420,
  craving_windows_enabled INTEGER NOT NULL DEFAULT 0,
  biometric_lock INTEGER NOT NULL DEFAULT 0,
  disclaimer_accepted_at TEXT,
  age_confirmed_at TEXT,
  created_at TEXT NOT NULL
);

CREATE TABLE meds (
  id TEXT PRIMARY KEY,
  label TEXT,
  dose_amount TEXT,
  form TEXT DEFAULT 'pill',
  color TEXT,
  active INTEGER NOT NULL DEFAULT 1,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL
);

CREATE TABLE schedules (
  id TEXT PRIMARY KEY,
  med_id TEXT NOT NULL REFERENCES meds(id) ON DELETE CASCADE,
  times_json TEXT NOT NULL,
  days_json TEXT NOT NULL,
  active INTEGER NOT NULL DEFAULT 1
);

CREATE TABLE doses (
  id TEXT PRIMARY KEY,
  med_id TEXT NOT NULL REFERENCES meds(id) ON DELETE CASCADE,
  due_at_utc TEXT NOT NULL,
  due_local_date TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending',
  taken_at_utc TEXT,
  backfilled INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL
);
CREATE INDEX idx_doses_date ON doses(due_local_date);
CREATE INDEX idx_doses_status ON doses(status, due_at_utc);

CREATE TABLE checkins (
  id TEXT PRIMARY KEY,
  date_local TEXT NOT NULL UNIQUE,
  mood TEXT NOT NULL,
  created_at TEXT NOT NULL
);

CREATE TABLE guardians (
  id TEXT PRIMARY KEY,
  display_name TEXT NOT NULL,
  relationship TEXT,
  channel TEXT NOT NULL,
  contact TEXT,
  consented_at TEXT,
  invite_token TEXT,
  share_med_names INTEGER NOT NULL DEFAULT 0,
  revoked_at TEXT,
  created_at TEXT NOT NULL
);

CREATE TABLE events (
  id TEXT PRIMARY KEY,
  type TEXT NOT NULL,
  payload_json TEXT,
  created_at TEXT NOT NULL
);

CREATE TABLE badges (
  id TEXT PRIMARY KEY,
  earned_at TEXT NOT NULL,
  seen INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE scarves (
  id TEXT PRIMARY KEY,
  unlocked_at TEXT NOT NULL,
  equipped INTEGER NOT NULL DEFAULT 0
);
`;

/** Dose reconciliation (§5.1) is idempotent by (med_id, due_at_utc); this makes it a constraint. */
export const SCHEMA_V2 = `
CREATE UNIQUE INDEX idx_doses_med_due ON doses(med_id, due_at_utc);
`;

/**
 * The mascot is gone (user decision, 2026-10-25), so are its columns and the scarves table.
 * Adds sleep settings, the support level, and what the user is working through.
 * support_conditions is local only: never in notifications, never shown to guardians.
 */
export const SCHEMA_V3 = `
ALTER TABLE profile DROP COLUMN mascot_name;
ALTER TABLE profile DROP COLUMN mascot_hue;
ALTER TABLE profile DROP COLUMN scarf_id;
ALTER TABLE profile DROP COLUMN scarf_hue;
ALTER TABLE profile DROP COLUMN scarf_pattern;
ALTER TABLE profile DROP COLUMN tail_dye_hue;
ALTER TABLE profile DROP COLUMN charm_id;
ALTER TABLE profile ADD COLUMN bedtime_min INTEGER;
ALTER TABLE profile ADD COLUMN wake_min INTEGER;
ALTER TABLE profile ADD COLUMN wind_down INTEGER NOT NULL DEFAULT 1;
ALTER TABLE profile ADD COLUMN still_up TEXT;
ALTER TABLE profile ADD COLUMN support_level TEXT NOT NULL DEFAULT 'light';
ALTER TABLE profile ADD COLUMN support_level_chosen INTEGER NOT NULL DEFAULT 0;
DROP TABLE scarves;
CREATE TABLE support_conditions (
  name TEXT PRIMARY KEY,
  severity INTEGER NOT NULL CHECK (severity BETWEEN 0 AND 2),
  created_at TEXT NOT NULL
);
`;

/** Weekly trophies on the streak path. One row per collected week; points are derived. */
export const SCHEMA_V4 = `
CREATE TABLE trophies (
  week_start TEXT PRIMARY KEY,
  days_marked INTEGER NOT NULL,
  collected_at TEXT NOT NULL
);
`;

/** The crisis line the user picked, overriding the phone's region (spec §8.4). Null follows the phone. */
export const SCHEMA_V5 = `
ALTER TABLE profile ADD COLUMN crisis_region TEXT;
`;

/** Hide in app switcher (off by default: on Android it also blocks screenshots), and Close's evening check-in. */
export const SCHEMA_V6 = `
ALTER TABLE profile ADD COLUMN hide_in_switcher INTEGER NOT NULL DEFAULT 0;
CREATE TABLE evening_checkins (
  id TEXT PRIMARY KEY,
  date_local TEXT NOT NULL UNIQUE,
  mood TEXT NOT NULL,
  created_at TEXT NOT NULL
);
`;

/** "My harder times" (spec §6.2a): up to three, each on some weekdays (empty = every day). */
export const SCHEMA_V7 = `
CREATE TABLE harder_times (
  id TEXT PRIMARY KEY,
  days_json TEXT NOT NULL,
  start_min INTEGER NOT NULL CHECK (start_min BETWEEN 0 AND 1440),
  end_min INTEGER NOT NULL CHECK (end_min BETWEEN 0 AND 1440),
  created_at TEXT NOT NULL
);
`;

/** The Get set up list on Home: steps answered even with "none" (support, sleep), and when it was hidden. */
export const SCHEMA_V8 = `
ALTER TABLE profile ADD COLUMN setup_answered_json TEXT NOT NULL DEFAULT '[]';
ALTER TABLE profile ADD COLUMN setup_hidden_at TEXT;
`;

/** Settings > Sound when marking: a soft tink as today's block lands. Off by default. */
export const SCHEMA_V9 = `
ALTER TABLE profile ADD COLUMN mark_sound INTEGER NOT NULL DEFAULT 0;
`;
