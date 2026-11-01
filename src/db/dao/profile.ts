import { nowIso } from '../../lib/time';
import type { StillUp, SupportLevel } from '../schema';
import { setClause, toSql } from '../sql';
import type { Db } from '../types';

export interface Profile {
  displayName: string;
  timezone: string;
  quietStartMin: number;
  quietEndMin: number;
  cravingWindowsEnabled: boolean;
  biometricLock: boolean;
  disclaimerAcceptedAt: string | null;
  ageConfirmedAt: string | null;
  /** Minutes after local midnight. Null until the user sets up sleep. */
  bedtimeMin: number | null;
  wakeMin: number | null;
  windDown: boolean;
  /** Null means "follow my support level". */
  stillUp: StillUp | null;
  supportLevel: SupportLevel;
  /** True when the user picked the level themselves instead of the suggested one. */
  supportLevelChosen: boolean;
  /** Crisis line region the user picked; null follows the phone's region. */
  crisisRegion: string | null;
  /** Blur the app in the app switcher (iOS) or mark the window secure (Android, which also blocks screenshots). */
  hideInSwitcher: boolean;
  /** A soft tink as today's block lands on the path. */
  markSound: boolean;
  /** Setup steps the user answered, even with nothing picked (see src/home/setup.ts). */
  setupAnswered: string[];
  /** When the user hid Home's Get set up list; null while it shows. */
  setupHiddenAt: string | null;
  createdAt: string;
}

/** `setupAnswered` only grows, through noteSetupAnswered. */
export type ProfilePatch = Partial<Omit<Profile, 'createdAt' | 'setupAnswered'>>;

interface ProfileRow {
  display_name: string;
  timezone: string;
  quiet_start_min: number;
  quiet_end_min: number;
  craving_windows_enabled: number;
  biometric_lock: number;
  disclaimer_accepted_at: string | null;
  age_confirmed_at: string | null;
  bedtime_min: number | null;
  wake_min: number | null;
  wind_down: number;
  still_up: StillUp | null;
  support_level: SupportLevel;
  support_level_chosen: number;
  crisis_region: string | null;
  hide_in_switcher: number;
  mark_sound: number;
  setup_answered_json: string;
  setup_hidden_at: string | null;
  created_at: string;
}

const COLUMNS: Record<keyof ProfilePatch, string> = {
  displayName: 'display_name',
  timezone: 'timezone',
  quietStartMin: 'quiet_start_min',
  quietEndMin: 'quiet_end_min',
  cravingWindowsEnabled: 'craving_windows_enabled',
  biometricLock: 'biometric_lock',
  disclaimerAcceptedAt: 'disclaimer_accepted_at',
  ageConfirmedAt: 'age_confirmed_at',
  bedtimeMin: 'bedtime_min',
  wakeMin: 'wake_min',
  windDown: 'wind_down',
  stillUp: 'still_up',
  supportLevel: 'support_level',
  supportLevelChosen: 'support_level_chosen',
  crisisRegion: 'crisis_region',
  hideInSwitcher: 'hide_in_switcher',
  markSound: 'mark_sound',
  setupHiddenAt: 'setup_hidden_at',
};

/** The stored list of answered steps; a backup can carry anything, so junk reads as none. */
function answeredFrom(json: string): string[] {
  try {
    const list: unknown = JSON.parse(json);
    return Array.isArray(list) ? list.filter((s): s is string => typeof s === 'string') : [];
  } catch {
    return [];
  }
}

function fromRow(r: ProfileRow): Profile {
  return {
    displayName: r.display_name,
    timezone: r.timezone,
    quietStartMin: r.quiet_start_min,
    quietEndMin: r.quiet_end_min,
    cravingWindowsEnabled: r.craving_windows_enabled === 1,
    biometricLock: r.biometric_lock === 1,
    disclaimerAcceptedAt: r.disclaimer_accepted_at,
    ageConfirmedAt: r.age_confirmed_at,
    bedtimeMin: r.bedtime_min,
    wakeMin: r.wake_min,
    windDown: r.wind_down === 1,
    stillUp: r.still_up,
    supportLevel: r.support_level,
    supportLevelChosen: r.support_level_chosen === 1,
    crisisRegion: r.crisis_region,
    hideInSwitcher: r.hide_in_switcher === 1,
    markSound: r.mark_sound === 1,
    setupAnswered: answeredFrom(r.setup_answered_json),
    setupHiddenAt: r.setup_hidden_at,
    createdAt: r.created_at,
  };
}

export async function getProfile(db: Db): Promise<Profile | null> {
  const row = await db.getFirstAsync<ProfileRow>('SELECT * FROM profile WHERE id = 1', []);
  return row ? fromRow(row) : null;
}

/** Single-row table, written in one statement. Unset fields take the schema defaults. */
export async function createProfile(
  db: Db,
  input: { displayName: string; timezone: string } & ProfilePatch,
): Promise<void> {
  const keys = (Object.keys(input) as (keyof ProfilePatch)[]).filter((k) => input[k] !== undefined);
  const cols = ['id', 'created_at', ...keys.map((k) => COLUMNS[k])];
  const values = [1, nowIso(), ...keys.map((k) => toSql(input[k]))];
  await db.runAsync(`INSERT INTO profile (${cols.join(', ')}) VALUES (${cols.map(() => '?').join(', ')})`, values);
}

export async function updateProfile(db: Db, patch: ProfilePatch): Promise<void> {
  const { sql, values } = setClause(patch, COLUMNS);
  if (!sql) return;
  await db.runAsync(`UPDATE profile SET ${sql} WHERE id = 1`, values);
}

/** Notes a setup step as answered; once is enough. */
export async function noteSetupAnswered(db: Db, step: string): Promise<void> {
  const profile = await getProfile(db);
  if (!profile || profile.setupAnswered.includes(step)) return;
  await db.runAsync('UPDATE profile SET setup_answered_json = ? WHERE id = 1', [JSON.stringify([...profile.setupAnswered, step])]);
}
