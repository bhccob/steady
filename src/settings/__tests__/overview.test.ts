import { accountLine, pillsLine, quietLine } from '../overview';

const NOW = Date.parse('2026-11-01T12:00:00Z');

describe('Settings first page', () => {
  it('says where the backup stands, or that there is no account', () => {
    expect(accountLine(null, NOW)).toBe('No account');
    expect(accountLine({ email: 'sam@example.com', savedAt: NOW - 2 * 3_600_000, state: 'ok' }, NOW)).toBe('Backed up 2 h ago');
    expect(accountLine({ email: 'sam@example.com', savedAt: null, state: 'ok' }, NOW)).toBe('Signed in, not backed up yet');
    expect(accountLine({ email: 'sam@example.com', savedAt: NOW - 60_000, state: 'offline' }, NOW)).toBe('Backed up 1 min ago, will retry');
    expect(accountLine({ email: 'sam@example.com', savedAt: NOW, state: 'elsewhere' }, NOW)).toBe('Backup on another device');
  });

  it('counts pills', () => {
    expect(pillsLine(0)).toBe('None yet');
    expect(pillsLine(1)).toBe('1 pill');
    expect(pillsLine(3)).toBe('3 pills');
  });

  it('shows quiet hours', () => {
    expect(quietLine(1320, 420)).toBe('Quiet 22:00–07:00');
  });
});
