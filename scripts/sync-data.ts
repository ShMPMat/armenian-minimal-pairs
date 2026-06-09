/**
 * Reads data/armenian_minimal_pairs.csv and data/audios/, copies audio into
 * public/audios/, and writes public/data.json for the trainer.
 *
 * Audio layout: data/audios/{word}/anything.mp3
 *
 * Usage: deno task sync
 */
import { walk } from "@std/fs/walk";
import * as path from "@std/path";

import { parseMinimalPairsCsv } from "../src/lib/csv.ts";
import type { PairSet, TrainerData } from "../src/lib/schema.ts";

const AUDIO_EXT = new Set([".mp3", ".wav", ".ogg", ".m4a", ".webm", ".flac"]);

const ROOT = Deno.cwd();
const CSV_PATH = path.join(ROOT, "data", "armenian_minimal_pairs.csv");
const AUDIOS_SRC = path.join(ROOT, "data", "audios");
const AUDIOS_DEST = path.join(ROOT, "public", "audios");
const MANIFEST_PATH = path.join(ROOT, "public", "data.json");

type AudioCandidate = { word: string; srcPath: string; score: number };

function isAudioFile(filePath: string): boolean {
  return AUDIO_EXT.has(path.extname(filePath).toLowerCase());
}

async function ensureDir(dir: string): Promise<void> {
  await Deno.mkdir(dir, { recursive: true });
}

async function removeDir(dir: string): Promise<void> {
  try {
    await Deno.remove(dir, { recursive: true });
  } catch (e) {
    if (!(e instanceof Deno.errors.NotFound)) throw e;
  }
}

function scoreAudioFile(word: string, filePath: string): number {
  const base = path.basename(filePath);
  const ext = path.extname(filePath).toLowerCase();
  let score = 0;
  if (base === `Hy-${word}${ext}`) score += 100;
  if (base.startsWith(`Hy-${word}`)) score += 80;
  if (ext === ".ogg") score += 20;
  if (ext === ".mp3") score += 10;
  if (!/^[a-z0-9_-]+\./i.test(base)) score += 5;
  score -= base.length * 0.01;
  return score;
}

async function collectAudios(): Promise<Map<string, string>> {
  const best = new Map<string, AudioCandidate>();

  try {
    const st = await Deno.stat(AUDIOS_SRC);
    if (!st.isDirectory)
      return new Map();
  } catch (e) {
    if (e instanceof Deno.errors.NotFound)
      return new Map();
    throw e;
  }

  for await (
    const entry of walk(AUDIOS_SRC, {
      includeDirs: false,
      followSymlinks: false,
    })
  ) {
    if (!entry.isFile || !isAudioFile(entry.path))
      continue;

    const rel = path.relative(AUDIOS_SRC, entry.path).replace(/\\/g, "/");
    const parts = rel.split("/");

    if (parts.length !== 2) {
      console.warn(`Skipping unrecognized audio path: ${entry.path}`);
      continue;
    }

    const word = parts[0];

    const score = scoreAudioFile(word, entry.path);
    const prev = best.get(word);
    if (!prev || score > prev.score) {
      best.set(word, { word, srcPath: entry.path, score });
    }
  }

  return new Map([...best.entries()].map(([word, c]) => [word, c.srcPath]));
}

async function copyAudio(srcPath: string, word: string): Promise<string> {
  const ext = path.extname(srcPath).toLowerCase();
  await ensureDir(AUDIOS_DEST);
  const destName = `${word}${ext}`;
  const destAbs = path.join(AUDIOS_DEST, destName);
  await Deno.copyFile(srcPath, destAbs);
  return `/audios/${word}${ext}`;
}

async function buildManifest(): Promise<TrainerData> {
  const csvText = await Deno.readTextFile(CSV_PATH);
  const rows = parseMinimalPairsCsv(csvText);
  const audios = await collectAudios();

  const bySet = new Map<number, { phonemeGroup: string; items: PairSet["items"] }>();
  const copied = new Map<string, string>();

  for (const row of rows) {
    const srcPath = audios.get(row.word);
    if (!srcPath)
      continue;

    let audio = copied.get(row.word);
    if (!audio) {
      audio = await copyAudio(srcPath, row.word);
      copied.set(row.word, audio);
    }

    let set = bySet.get(row.setId);
    if (!set) {
      set = { phonemeGroup: row.phonemeGroup, items: [] };
      bySet.set(row.setId, set);
    }

    if (set.items.some((item) => item.word === row.word))
      continue;

    set.items.push({
      word: row.word,
      ipa: row.ipa,
      meaningEnglish: row.meaningEnglish,
      audio,
    });
  }

  const sets: PairSet[] = [...bySet.entries()]
    .filter(([, set]) => set.items.length >= 2)
    .sort(([a], [b]) => a - b)
    .map(([id, set]) => ({
      id,
      phonemeGroup: set.phonemeGroup,
      items: set.items,
    }));

  return { sets };
}

async function main(): Promise<void> {
  await ensureDir(path.dirname(MANIFEST_PATH));
  await removeDir(AUDIOS_DEST);
  await ensureDir(AUDIOS_DEST);

  const manifest = await buildManifest();
  await Deno.writeTextFile(
    MANIFEST_PATH,
    `${JSON.stringify(manifest, null, 2)}\n`,
  );

  const itemCount = manifest.sets.reduce((n, s) => n + s.items.length, 0);
  console.log(
    `Synced ${manifest.sets.length} set(s), ${itemCount} item(s) with audio.`,
  );
}

if (import.meta.main) {
  await main();
}
