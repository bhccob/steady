import { readFileSync } from 'node:fs';
import { join } from 'node:path';

// An update published while the web app is open must never leave it blank. The open copy keeps
// running the old code, and the old build's files are gone from the site (and, once the new
// service worker takes over, from the offline cache too).
const ROOT = join(__dirname, '..', '..');
const app = JSON.parse(readFileSync(join(ROOT, 'app.json'), 'utf8')) as { expo: { plugins: (string | [string, Record<string, unknown>])[] } };
const vercel = JSON.parse(readFileSync(join(ROOT, 'vercel.json'), 'utf8')) as { rewrites: { source: string; destination: string }[] };
const rootLayout = readFileSync(join(ROOT, 'app', '_layout.tsx'), 'utf8');

/** Vercel matches a rewrite's source against the whole path. */
const rewritten = (path: string) => vercel.rewrites.some((r) => new RegExp(`^${r.source}$`).test(path));

it('ships every screen in the main web file, so no page has to load its code later', () => {
  // expo-router splits screens into their own files on the web unless told not to.
  const router = app.expo.plugins.find((p) => Array.isArray(p) && p[0] === 'expo-router') as [string, { asyncRoutes?: { web?: unknown } }] | undefined;
  expect(router?.[1].asyncRoutes?.web).toBe(false);
});

it('opens the app page for any app address', () => {
  expect(rewritten('/')).toBe(true);
  expect(rewritten('/home')).toBe(true);
  expect(rewritten('/settings/you')).toBe(true);
});

it('answers a missing code or asset file with not found, never the app page the offline cache would keep as code', () => {
  expect(rewritten('/_expo/static/js/web/calendar-0cfd309f07ccd130d83a2bda66124993.js')).toBe(false);
  expect(rewritten('/assets/node_modules/@expo-google-fonts/inter/Inter_400Regular.ttf')).toBe(false);
});

it('shows a way back instead of a blank app when a screen crashes', () => {
  expect(rootLayout).toMatch(/export function ErrorBoundary\(/);
});
