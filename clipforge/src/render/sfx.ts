import fs from "node:fs";
import path from "node:path";
import { PUBLIC_DIR } from "../config";
import { ffmpeg } from "../ffmpeg";

// SFX sintetizados com ffmpeg: sem downloads e sem direitos autorais.
// Troque os arquivos em public/sfx por samples próprios se quiser outro som.
const SFX: Record<string, string[]> = {
  "impact.wav": [
    "-f", "lavfi", "-i",
    "aevalsrc='0.95*sin(2*PI*(58-34*t)*t)*exp(-3.5*t)+0.45*(random(0)*2-1)*exp(-22*t)':s=48000:d=1.4",
    "-af", "lowpass=f=5000,afade=t=out:st=1.1:d=0.3",
  ],
  "whoosh.wav": [
    "-f", "lavfi", "-i", "anoisesrc=d=0.7:c=pink:a=0.8:r=48000",
    "-af", "highpass=f=300,lowpass=f=4500,volume='0.9*sin(PI*t/0.7)^2':eval=frame",
  ],
  "glitch.wav": [
    "-f", "lavfi", "-i",
    "aevalsrc='0.35*sgn(sin(2*PI*(700+500*sin(2*PI*31*t))*t))*lt(mod(t\\,0.08)\\,0.05)':s=48000:d=0.4",
  ],
  "pop.wav": [
    "-f", "lavfi", "-i",
    "aevalsrc='0.7*sin(2*PI*(1100-2600*t)*t)*exp(-20*t)':s=48000:d=0.3",
  ],
};

export async function ensureSfx(force = false) {
  const dir = path.join(PUBLIC_DIR, "sfx");
  fs.mkdirSync(dir, { recursive: true });
  for (const [file, args] of Object.entries(SFX)) {
    const out = path.join(dir, file);
    if (!force && fs.existsSync(out)) continue;
    await ffmpeg([...args, "-ac", "2", "-ar", "48000", out]);
  }
}
