import { savedAgo } from '../account/savedAgo';
import { formatHm } from '../lib/time';
import type { AccountState } from '../state/app';

// The short lines beside each row on Settings' first page.

export function accountLine(account: AccountState | null, now: number): string {
  if (!account) return 'No account';
  if (account.state === 'elsewhere') return 'Backup on another device';
  const saved = account.savedAt === null ? 'Signed in, not backed up yet' : `Backed up ${savedAgo(account.savedAt, now)}`;
  return account.state === 'offline' ? `${saved}, will retry` : saved;
}

export function pillsLine(count: number): string {
  if (count === 0) return 'None yet';
  return count === 1 ? '1 pill' : `${count} pills`;
}

export function quietLine(startMin: number, endMin: number): string {
  return `Quiet ${formatHm(startMin)}–${formatHm(endMin)}`;
}
