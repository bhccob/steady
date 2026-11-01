// Writes assets/sounds/tink.wav, the soft sound as today's block lands on the path:
// three bell-like sine tones that fade out in 0.6 s. Run: node scripts/make-tink.cjs
const fs = require('fs');
const path = require('path');

const RATE = 22050;
const SECONDS = 0.6;
const TONES = [
  [1568, 0.5], // G6
  [2352, 0.22],
  [3136, 0.09],
];

const n = Math.round(RATE * SECONDS);
const pcm = Buffer.alloc(n * 2);
for (let i = 0; i < n; i++) {
  const t = i / RATE;
  const attack = Math.min(1, t / 0.008);
  const decay = Math.exp(-t * 9);
  let v = 0;
  for (const [hz, gain] of TONES) v += gain * Math.sin(2 * Math.PI * hz * t);
  pcm.writeInt16LE(Math.round(Math.max(-1, Math.min(1, v * attack * decay * 0.55)) * 32767), i * 2);
}

const header = Buffer.alloc(44);
header.write('RIFF', 0);
header.writeUInt32LE(36 + pcm.length, 4);
header.write('WAVE', 8);
header.write('fmt ', 12);
header.writeUInt32LE(16, 16); // fmt chunk size
header.writeUInt16LE(1, 20); // PCM
header.writeUInt16LE(1, 22); // mono
header.writeUInt32LE(RATE, 24);
header.writeUInt32LE(RATE * 2, 28); // bytes per second
header.writeUInt16LE(2, 32); // block align
header.writeUInt16LE(16, 34); // bits per sample
header.write('data', 36);
header.writeUInt32LE(pcm.length, 40);

const out = path.join(__dirname, '..', 'assets', 'sounds', 'tink.wav');
fs.mkdirSync(path.dirname(out), { recursive: true });
fs.writeFileSync(out, Buffer.concat([header, pcm]));
console.log(`${out}: ${44 + pcm.length} bytes`);
