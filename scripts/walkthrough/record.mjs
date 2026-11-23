// Records the narrated product walkthrough video (docs/walkthrough/maison-aurelia-walkthrough.mp4).
// Prerequisites: app running on http://localhost:3000 with seeded data, Google Chrome, ffmpeg, and
// `pip install edge-tts` (narration text is sent to Microsoft's online TTS; WALK_TTS=say uses the offline macOS voice).
// Voice/speed: WALK_VOICE (default en-US-AvaMultilingualNeural), WALK_RATE (default +6%). Audio is cached in ~/.cache.
// Usage: node scripts/walkthrough/record.mjs [sceneId ...]   (scene ids limit the run, for previews)
// Read-only against the app: it signs in as the demo accounts and opens dialogs, but never submits them.
import { execFileSync } from 'node:child_process';
import crypto from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { launch, signInAs, wait, BASE } from './cdp.mjs';
import { SCENES, SPEECH, SPEECH_NEURAL } from './scenes.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const OUT_DIR = path.resolve('docs/walkthrough');
const OUT = path.join(OUT_DIR, process.argv.length > 2 ? 'preview.mp4' : 'maison-aurelia-walkthrough.mp4');
const TMP = process.env.WALK_TMP ?? fs.mkdtempSync(path.join(os.tmpdir(), 'ma-walk-'));
// Narration: Microsoft neural voices via edge-tts (online; sends only the narration text), or WALK_TTS=say for the offline macOS voice.
const TTS = process.env.WALK_TTS ?? 'edge';
const VOICE = process.env.WALK_VOICE ?? (TTS === 'edge' ? 'en-US-AvaMultilingualNeural' : 'Samantha');
const RATE = process.env.WALK_RATE ?? (TTS === 'edge' ? '+6%' : '185');
const CACHE = path.join(os.homedir(), '.cache', 'maison-walkthrough-tts');
fs.mkdirSync(CACHE, { recursive: true });
const W = 1600, H = 900, DSF = 1.2; // captured at 1920×1080
const FPS = 30, F = 1 / FPS;
const only = process.argv.slice(2);
const scenes = SCENES.filter((s) => !only.length || only.includes(s.id));
for (const d of ['frames', 'audio', 'mobile']) fs.mkdirSync(path.join(TMP, d), { recursive: true });
fs.mkdirSync(OUT_DIR, { recursive: true });
console.log('work dir', TMP);

const sh = (cmd, args) => execFileSync(cmd, args, { stdio: ['ignore', 'pipe', 'pipe'] }).toString();
const probe = (f) => parseFloat(sh('ffprobe', ['-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', f]));
const ease = (x) => (x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2);

// ── 1. narration audio
let n = 0;
for (const s of scenes) for (const b of s.beats) {
  let text = b.say;
  for (const [re, to] of TTS === 'edge' ? SPEECH_NEURAL : SPEECH) text = text.replace(re, to);
  const key = crypto.createHash('sha1').update([TTS, VOICE, RATE, text].join('|')).digest('hex').slice(0, 16);
  b.audio = path.join(CACHE, `${key}.wav`);
  if (!fs.existsSync(b.audio)) {
    const raw = path.join(TMP, 'audio', `${s.id}-${n}.${TTS === 'edge' ? 'mp3' : 'aiff'}`);
    if (TTS === 'edge') {
      for (let attempt = 1; ; attempt++) {
        try { sh('python3', ['-m', 'edge_tts', '--voice', VOICE, `--rate=${RATE}`, '--text', text, '--write-media', raw]); break; }
        catch (e) { if (attempt >= 4) throw e; await wait(1500 * attempt); }
      }
    } else sh('say', ['-v', VOICE, '-r', RATE, '-o', raw, text]);
    // trim the engine's leading/trailing silence so beats follow each other tightly
    sh('ffmpeg', ['-y', '-i', raw, '-af', 'silenceremove=start_periods=1:start_threshold=-50dB,areverse,silenceremove=start_periods=1:start_threshold=-50dB,areverse', '-ar', '48000', '-ac', '1', b.audio]);
  }
  n++;
  b.speech = probe(b.audio);
}
console.log('narration', scenes.flatMap((s) => s.beats).reduce((a, b) => a + b.speech, 0).toFixed(1), 's');

// ── 2. frames
const b = await launch();
const frames = []; // [file, seconds]
const timeline = []; // { start, dur, text, audio }
let clock = 0, fi = 0;
async function shot(dur) {
  const r = await b.send('Page.captureScreenshot', { format: 'jpeg', quality: 92 });
  const file = path.join(TMP, 'frames', `f${String(fi++).padStart(5, '0')}.jpg`);
  fs.writeFileSync(file, Buffer.from(r.data, 'base64'));
  frames.push([file, dur]);
  return dur;
}
const metrics = (w = W, h = H, dsf = DSF, mobile = false) => b.send('Emulation.setDeviceMetricsOverride', { width: w, height: h, deviceScaleFactor: dsf, mobile });

const HELPERS = fs.readFileSync(path.join(HERE, 'overlay.js'), 'utf8');
const ev = (js) => b.evaluate(js);
const inject = () => ev(HELPERS);

async function fade(from, to, frames_) { let t = 0; for (let i = 1; i <= frames_; i++) { await ev(`__wt.fade(${from + (to - from) * (i / frames_)})`); t += await shot(F); } return t; }

async function scrollTo(y) {
  const cur = await ev('scrollY');
  const target = await ev(`Math.max(0, Math.min(${Math.round(y)}, document.documentElement.scrollHeight - innerHeight))`);
  if (Math.abs(target - cur) < 3) return 0;
  const steps = Math.round(Math.min(24, Math.max(12, Math.abs(target - cur) / 40)));
  let t = 0;
  for (let i = 1; i <= steps; i++) { await ev(`scrollTo(0, ${cur + (target - cur) * ease(i / steps)})`); t += await shot(F); }
  return t;
}

// mobile screenshots for the phone card
for (const s of scenes) if (s.mobileShots) {
  await signInAs(b, null); await metrics(390, 844, 2, true);
  s.beats[0].card.imgs = [];
  for (const [i, route] of s.mobileShots.entries()) {
    await b.send('Page.navigate', { url: BASE + route }); await wait(4500);
    await ev(`document.querySelectorAll('nextjs-portal').forEach(e => e.remove())`);
    const r = await b.send('Page.captureScreenshot', { format: 'png' });
    const file = path.join(TMP, 'mobile', `m${i}.png`); fs.writeFileSync(file, Buffer.from(r.data, 'base64'));
    s.beats[0].card.imgs.push({ src: pathToFileURL(file).href, label: ['Home', 'Rooms', 'Room & booking'][i] });
  }
}

for (const s of scenes) {
  console.log('scene', s.id);
  await metrics();
  const isCard = !s.route;
  if (isCard) {
    await b.send('Page.navigate', { url: pathToFileURL(path.join(HERE, 'card.html')).href });
    await wait(1200);
  } else {
    await signInAs(b, s.who);
    await b.send('Page.navigate', { url: BASE + s.route });
    await wait(5000);
    // trigger every scroll-in animation once, then return to the top
    const full = await ev('document.documentElement.scrollHeight');
    for (let y = 0; y < full; y += 500) { await ev(`scrollTo(0, ${y})`); await wait(180); }
    await ev('scrollTo(0, 0)'); await wait(900);
  }
  await inject();
  await ev('__wt.fade(1)');

  for (const [bi, beat] of s.beats.entries()) {
    let used = 0;
    const first = bi === 0, last = bi === s.beats.length - 1;
    if (isCard) {
      const prev = s.beats[bi - 1]?.card;
      const st = { ...beat.card };
      if (st.show !== undefined) { st.fresh = []; for (let i = first ? 0 : (prev?.show ?? 0); i < st.show; i++) st.fresh.push(i); st.freshFoot = !!st.footShow && !prev?.footShow; }
      await ev(`render(${JSON.stringify(st)})`); await wait(250);
      if (first) used += await fade(1, 0, 7);
      if (st.fresh?.length || st.freshFoot) for (let i = 1; i <= 9; i++) { await ev(`reveal(${ease(i / 9)})`); used += await shot(F); }
    } else {
      await ev(`__wt.clear(); __wt.caption(${JSON.stringify({ chapter: s.chapter, title: beat.title, badge: beat.badge, tag: beat.tag, text: beat.click && beat.hl?.some((h) => h.sel) ? '' : beat.say, side: !!beat.side || (!!beat.click && !!beat.hl?.some((h) => h.sel)) })})`);
      if (first) used += await fade(1, 0, 7);
      if (beat.click) {
        const box = await ev(`__wt.box(${JSON.stringify([beat.click])})`);
        if (!box) throw new Error(`click target not found in ${s.id}: ${beat.click.t ?? beat.click.sel}`);
        if (box.y - (await ev('scrollY')) > H - 230 || box.y < (await ev('scrollY'))) used += await scrollTo(box.cy - 330);
        const sy = await ev('scrollY');
        const to = { x: box.cx, y: box.cy - sy };
        await ev('__wt.cursor(true)');
        const from = await ev('__wt.cursorPos()');
        for (let i = 1; i <= 11; i++) { const k = ease(i / 11); await ev(`__wt.moveCursor(${from.x + (to.x - from.x) * k}, ${from.y + (to.y - from.y) * k})`); used += await shot(F); }
        await ev('__wt.press(true)'); used += await shot(F * 3);
        await ev(`__wt.click(${JSON.stringify(beat.click)})`); await ev('__wt.press(false)');
        await wait(beat.wait ?? 1600);
        await ev('__wt.cursor(false)');
      } else await ev('__wt.cursor(false)');

      const boxes = beat.hl ? await ev(`__wt.boxes(${JSON.stringify(beat.hl)})`) : [];
      if (beat.hl && boxes.some((x) => !x)) throw new Error(`highlight not found in ${s.id}/${bi}: ${JSON.stringify(beat.hl[boxes.findIndex((x) => !x)])}`);
      let y = beat.y;
      if (y === undefined && boxes.length) {
        const top = Math.min(...boxes.map((x) => x.y)), bot = Math.max(...boxes.map((x) => x.y + x.h));
        y = bot - top < H - 300 ? Math.min((top + bot) / 2 - (H - 190) / 2, top - 130) : top - 130;
      }
      if (typeof y === 'number') used += await scrollTo(y);
      await wait(500);
      if (boxes.length) {
        await ev(`__wt.highlight(${JSON.stringify(beat.hl)})`);
        for (let i = 1; i <= 6; i++) { await ev(`__wt.hlOpacity(${i / 6})`); used += await shot(F); }
      }
    }
    const want = beat.speech + (beat.pad ?? 0.3);
    const outro = last ? 8 * F : 0;
    used += await shot(Math.max(want - used - outro, 0.4));
    if (last) used += await fade(0, 1, 8);
    timeline.push({ start: clock, dur: used, text: beat.say, audio: beat.audio });
    clock += used;
  }
}
b.close();
console.log('frames', frames.length, 'length', clock.toFixed(1), 's');

// ── 3. assemble
const list = path.join(TMP, 'frames.txt');
fs.writeFileSync(list, frames.map(([f, d]) => `file '${f}'\nduration ${d.toFixed(4)}`).join('\n') + `\nfile '${frames.at(-1)[0]}'\n`);
const video = path.join(TMP, 'video.mp4');
sh('ffmpeg', ['-y', '-f', 'concat', '-safe', '0', '-i', list, '-vf', `fps=${FPS},format=yuv420p`, '-c:v', 'libx264', '-preset', 'slow', '-crf', '19', '-movflags', '+faststart', video]);

const parts = timeline.map((t, i) => {
  const f = path.join(TMP, 'audio', `beat${i}.wav`);
  sh('ffmpeg', ['-y', '-i', t.audio, '-af', `apad,atrim=0:${t.dur.toFixed(4)},afade=t=in:d=0.02`, '-ar', '48000', '-ac', '2', f]);
  return f;
});
const alist = path.join(TMP, 'audio.txt');
fs.writeFileSync(alist, parts.map((p) => `file '${p}'`).join('\n'));
const audio = path.join(TMP, 'voice.wav');
sh('ffmpeg', ['-y', '-f', 'concat', '-safe', '0', '-i', alist, '-af', 'loudnorm=I=-16:TP=-1.5:LRA=11', '-ar', '48000', audio]);

const ts = (s) => { const ms = Math.round(s * 1000); const p = (v, l = 2) => String(v).padStart(l, '0'); return `${p(Math.floor(ms / 3600000))}:${p(Math.floor(ms / 60000) % 60)}:${p(Math.floor(ms / 1000) % 60)},${p(ms % 1000, 3)}`; };
const srt = OUT.replace(/\.mp4$/, '.srt');
fs.writeFileSync(srt, timeline.map((t, i) => `${i + 1}\n${ts(t.start + 0.1)} --> ${ts(t.start + t.dur - 0.1)}\n${t.text}\n`).join('\n'));

sh('ffmpeg', ['-y', '-i', video, '-i', audio, '-i', srt, '-map', '0:v', '-map', '1:a', '-map', '2:s', '-c:v', 'copy', '-c:a', 'aac', '-b:a', '160k',
  '-c:s', 'mov_text', '-metadata:s:s:0', 'language=eng', '-shortest', '-movflags', '+faststart', OUT]);
console.log('saved', path.relative(process.cwd(), OUT), `(${(fs.statSync(OUT).size / 1e6).toFixed(1)} MB, ${clock.toFixed(1)} s)`);
console.log('saved', path.relative(process.cwd(), srt));
if (!process.env.WALK_TMP) fs.rmSync(TMP, { recursive: true, force: true });
process.exit(0);
