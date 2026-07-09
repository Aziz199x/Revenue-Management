import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const outputDir = join(process.cwd(), "android", "app", "src", "main", "res", "raw");
mkdirSync(outputDir, { recursive: true });

function createWave(fileName, notes) {
  const sampleRate = 22050;
  const samples = [];
  for (const { frequency, duration, volume = 0.35 } of notes) {
    const count = Math.round(sampleRate * duration);
    for (let index = 0; index < count; index += 1) {
      const fade = Math.min(1, index / 180, (count - index) / 240);
      samples.push(Math.round(Math.sin(2 * Math.PI * frequency * index / sampleRate) * 32767 * volume * fade));
    }
  }
  const dataSize = samples.length * 2;
  const wav = Buffer.alloc(44 + dataSize);
  wav.write("RIFF", 0);
  wav.writeUInt32LE(36 + dataSize, 4);
  wav.write("WAVEfmt ", 8);
  wav.writeUInt32LE(16, 16);
  wav.writeUInt16LE(1, 20);
  wav.writeUInt16LE(1, 22);
  wav.writeUInt32LE(sampleRate, 24);
  wav.writeUInt32LE(sampleRate * 2, 28);
  wav.writeUInt16LE(2, 32);
  wav.writeUInt16LE(16, 34);
  wav.write("data", 36);
  wav.writeUInt32LE(dataSize, 40);
  samples.forEach((sample, index) => wav.writeInt16LE(sample, 44 + index * 2));
  writeFileSync(join(outputDir, fileName), wav);
}

createWave("contract_reminder.wav", [
  { frequency: 660, duration: 0.18 },
  { frequency: 880, duration: 0.28 },
]);
createWave("payment_overdue.wav", [
  { frequency: 440, duration: 0.22, volume: 0.42 },
  { frequency: 330, duration: 0.16, volume: 0.42 },
  { frequency: 440, duration: 0.22, volume: 0.42 },
]);
