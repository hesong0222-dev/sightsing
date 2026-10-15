// 초견 노래방: 악보가 흘러가면 마이크로 불러서 음마다 판정한다. 옥타브는 무시하고 음이름만 본다.
const LEVELS = [
  { name: "도레미", lo: 0, hi: 4, leap: 1, durs: [1], tempo: 60, n: 8 },
  { name: "한 옥타브", lo: 0, hi: 7, leap: 2, durs: [1], tempo: 66, n: 10 },
  { name: "도약 시작", lo: 0, hi: 7, leap: 4, durs: [1, 2], tempo: 66, n: 10 },
  { name: "8분음표", lo: -1, hi: 9, leap: 4, durs: [1, 2, 0.5], tempo: 72, n: 12 },
  { name: "큰 도약", lo: -2, hi: 10, leap: 7, durs: [1, 0.5], tempo: 76, n: 12 },
  { name: "사장조", lo: 0, hi: 9, leap: 4, durs: [1, 0.5], tempo: 72, n: 12, key: "G" },
  { name: "임시표", lo: 0, hi: 9, leap: 4, durs: [1, 2], tempo: 72, n: 12, chrom: 0.25 },
  { name: "지옥", lo: -3, hi: 11, leap: 7, durs: [1, 0.5], tempo: 90, n: 14, chrom: 0.2 },
];
const SCALE = [0, 2, 4, 5, 7, 9, 11];
const NAMES = ["도", "레", "미", "파", "솔", "라", "시"];
const PX_PER_BEAT = 90, HEAD_X = 220, BOTTOM_LINE_Y = 190; // 미(E4)가 맨 아래 줄
const TEST = new URLSearchParams(location.search).get("test"); // 1 = 정확히 부르는 가상 목소리, bad = 틀리게
const $ = (id) => document.getElementById(id);
const svg = $("score"), NS = "http://www.w3.org/2000/svg";

let level = 0, ctx, analyser, buf, running = false;

const store = {
  get() { try { return JSON.parse(localStorage.getItem("sightsing") || "{}"); } catch { return {}; } },
  set(v) { try { localStorage.setItem("sightsing", JSON.stringify(v)); } catch {} },
};

// ---------- 레벨 버튼 ----------
function drawLevels() {
  const best = store.get();
  $("levels").innerHTML = LEVELS.map((L, i) => {
    const open = i === 0 || (best[i - 1] || 0) >= 1;
    const s = best[i] || 0;
    return `<button class="lv${i === level ? " on" : ""}" data-i="${i}" ${open ? "" : "disabled"}><b>Lv.${i + 1}</b>${L.name}<br><small>${"★".repeat(s)}${"☆".repeat(3 - s)}</small></button>`;
  }).join("");
  $("levels").querySelectorAll(".lv").forEach((b) => (b.onclick = () => { level = +b.dataset.i; drawLevels(); preview(); }));
}

// ---------- 멜로디 만들기 ----------
function midiOf(n) { // n.step: 도(C4)=0 부터 세는 음계 칸, n.acc: -1/0/1
  const oct = Math.floor(n.step / 7), deg = ((n.step % 7) + 7) % 7;
  return 60 + 12 * oct + SCALE[deg] + n.acc;
}
function makeMelody(L) {
  const tonic = L.key === "G" ? 4 : 0;
  const keyAcc = (step) => (L.key === "G" && ((step % 7) + 7) % 7 === 3 ? 1 : 0); // 사장조는 파#
  const notes = [];
  let step = tonic, beats = 0;
  const push = (s, d) => { notes.push({ step: s, acc: keyAcc(s), dur: d, beat: beats }); beats += d; };
  push(step, 1);
  while (notes.length < L.n - 1) {
    let next;
    do { next = step + Math.round((Math.random() * 2 - 1) * L.leap); } while (next === step || next < L.lo || next > L.hi);
    step = next;
    const d = L.durs[Math.floor(Math.random() * L.durs.length)];
    if (d === 0.5) { push(step, 0.5); let s2 = Math.min(L.hi, Math.max(L.lo, step + (Math.random() < 0.5 ? 1 : -1))); push(s2, 0.5); step = s2; }
    else push(step, d);
    const last = notes[notes.length - 1];
    if (L.chrom && Math.random() < L.chrom && last.acc === 0) last.acc = Math.random() < 0.5 ? 1 : -1;
  }
  push(tonic, 2);
  notes.forEach((n) => (n.midi = midiOf(n)));
  return { notes, beats, tonic: midiOf({ step: tonic, acc: 0 }) };
}

// ---------- 악보 그리기 ----------
const el = (tag, attrs, parent = svg) => { const e = document.createElementNS(NS, tag); for (const k in attrs) e.setAttribute(k, attrs[k]); parent.appendChild(e); return e; };
const yOf = (step) => BOTTOM_LINE_Y - (step - 2) * 10;
function drawStaff(song) {
  svg.innerHTML = "";
  svg.setAttribute("viewBox", "0 0 1000 300");
  for (let i = 0; i < 5; i++) el("line", { x1: 0, x2: 1000, y1: 110 + i * 20, y2: 110 + i * 20, stroke: "currentColor", "stroke-opacity": .35 });
  el("text", { x: 14, y: 196, "font-size": 104, fill: "currentColor", "font-family": "Apple Symbols, Segoe UI Symbol, Noto Music, serif" }).textContent = "𝄞";
  el("line", { id: "playhead", x1: HEAD_X, x2: HEAD_X, y1: 60, y2: 250, stroke: "#2f6fed", "stroke-width": 3, "stroke-opacity": .6 });
  const g = el("g", { id: "roll" });
  song.notes.forEach((n, i) => {
    const x = HEAD_X + n.beat * PX_PER_BEAT + 20, y = yOf(n.step);
    const ng = el("g", { id: "n" + i, fill: "currentColor", stroke: "currentColor" }, g);
    for (let s = n.step; s <= 0; s += 2) if (s % 2 === 0) el("line", { x1: x - 15, x2: x + 15, y1: yOf(s), y2: yOf(s), "stroke-width": 1.5 }, ng);
    for (let s = 12; s <= n.step; s += 2) el("line", { x1: x - 15, x2: x + 15, y1: yOf(s), y2: yOf(s), "stroke-width": 1.5 }, ng);
    const head = { cx: x, cy: y, rx: 9.5, ry: 7, transform: `rotate(-20 ${x} ${y})`, "stroke-width": 2.2 };
    if (n.dur >= 2) head.fill = "none"; // 2분음표는 속이 빈 머리, 나머지는 그룹 색(판정 색)을 그대로 따름
    el("ellipse", head, ng);
    const up = n.step < 6;
    el("line", { x1: up ? x + 8.5 : x - 8.5, x2: up ? x + 8.5 : x - 8.5, y1: y, y2: up ? y - 52 : y + 52, "stroke-width": 2 }, ng);
    if (n.dur === 0.5) el("path", { d: up ? `M${x + 8.5} ${y - 52} q14 12 8 30` : `M${x - 8.5} ${y + 52} q14 -12 8 -30`, fill: "none", "stroke-width": 2 }, ng);
    if (n.acc) { const t = el("text", { x: x - 28, y: y + 7, "font-size": 22, stroke: "none" }, ng); t.textContent = n.acc > 0 ? "♯" : "♭"; }
    const lab = el("text", { x, y: 262, "font-size": 13, "text-anchor": "middle", stroke: "none", "fill-opacity": .5 }, ng);
    lab.textContent = NAMES[((n.step % 7) + 7) % 7] + (n.acc > 0 ? "#" : n.acc < 0 ? "b" : "");
  });
  el("polyline", { id: "trace", points: "", fill: "none", stroke: "#f59e0b", "stroke-width": 3, "stroke-linejoin": "round" }, g);
  return g;
}
let current;
function preview() { current = makeMelody(LEVELS[level]); drawStaff(current); $("title").textContent = `Lv.${level + 1} ${LEVELS[level].name}`; $("result").style.display = "none"; }

// ---------- 소리 ----------
function tone(midi, at, len, vol = 0.18) {
  const o = ctx.createOscillator(), g = ctx.createGain();
  o.type = "triangle"; o.frequency.value = 440 * 2 ** ((midi - 69) / 12);
  g.gain.setValueAtTime(0, at); g.gain.linearRampToValueAtTime(vol, at + 0.02); g.gain.setValueAtTime(vol, at + len - 0.05); g.gain.linearRampToValueAtTime(0, at + len);
  o.connect(g).connect(ctx.destination); o.start(at); o.stop(at + len + 0.02);
}
function click(at, hi) {
  const o = ctx.createOscillator(), g = ctx.createGain();
  o.frequency.value = hi ? 1600 : 1000; g.gain.setValueAtTime(0.25, at); g.gain.exponentialRampToValueAtTime(0.001, at + 0.06);
  o.connect(g).connect(ctx.destination); o.start(at); o.stop(at + 0.07);
}

// ---------- 음높이 (자기상관) ----------
function detectPitch() {
  analyser.getFloatTimeDomainData(buf);
  let rms = 0; for (const v of buf) rms += v * v;
  if (Math.sqrt(rms / buf.length) < 0.01) return null;
  const W = 1024, minLag = Math.floor(ctx.sampleRate / 1200), maxLag = Math.ceil(ctx.sampleRate / 70);
  const c = new Float32Array(maxLag + 2);
  let c0 = 0; for (let i = 0; i < W; i++) c0 += buf[i] * buf[i];
  let best = 0;
  for (let lag = minLag; lag <= maxLag + 1; lag++) { let s = 0; for (let i = 0; i < W; i++) s += buf[i] * buf[i + lag]; c[lag] = s; if (lag <= maxLag && s > best) best = s; }
  if (best < c0 * 0.3) return null;
  let lag = minLag; // 옥타브 실수를 줄이려고 최댓값의 90%를 넘는 첫 봉우리를 고른다
  for (let l = minLag + 1; l < maxLag; l++) if (c[l] >= best * 0.9 && c[l] >= c[l - 1] && c[l] >= c[l + 1]) { lag = l; break; }
  const A = (c[lag - 1] + c[lag + 1] - 2 * c[lag]) / 2, B = (c[lag + 1] - c[lag - 1]) / 2;
  const hz = ctx.sampleRate / (A ? lag - B / (2 * A) : lag);
  return hz > 70 && hz < 1200 ? hz : null;
}
const cents = (sungMidi, target) => { let d = ((sungMidi - target) % 12 + 18) % 12 - 6; return d * 100; }; // 옥타브 무시

// ---------- 진행 ----------
async function start() {
  if (running) return;
  running = true; $("go").disabled = true; $("result").style.display = "none";
  ctx = ctx || new AudioContext();
  await ctx.resume();
  analyser = ctx.createAnalyser(); analyser.fftSize = 2048; buf = new Float32Array(analyser.fftSize);
  let fake;
  if (TEST) { fake = ctx.createOscillator(); fake.type = "sawtooth"; fake.connect(analyser); fake.start(); }
  else {
    try { const stream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: false, noiseSuppression: false, autoGainControl: false } }); ctx.createMediaStreamSource(stream).connect(analyser); }
    catch { $("msg").textContent = "마이크를 허용해야 할 수 있어요"; running = false; $("go").disabled = false; return; }
  }
  const song = current, L = LEVELS[level], spb = 60 / L.tempo;
  song.notes.forEach((n) => { n.judged = false; n.hit = false; });
  drawStaff(song);
  const t0 = ctx.currentTime + 0.2;
  tone(song.tonic, t0, 1.2);                        // 도 음 들려주기
  const countAt = t0 + 1.6;
  for (let i = 0; i < 4; i++) click(countAt + i * spb, i === 0);
  const songAt = countAt + 4 * spb;
  for (let b = 0; b < song.beats; b++) click(songAt + b * spb, false);
  $("msg").textContent = "도 음 듣고… 4박 세고 시작!";
  const frames = song.notes.map(() => []), trace = [];
  const roll = $("roll");
  await new Promise((done) => {
    const loop = () => {
      const now = ctx.currentTime, beat = (now - songAt) / spb;
      roll.setAttribute("transform", `translate(${-Math.max(beat, -4) * PX_PER_BEAT} 0)`);
      const idx = song.notes.findIndex((n) => beat >= n.beat && beat < n.beat + n.dur);
      if (fake) { const n = song.notes[Math.max(0, idx)]; fake.frequency.value = 220 * 2 ** ((n.midi + (TEST === "bad" && idx % 2 ? 1.5 : 0) - 57) / 12); }
      const hz = detectPitch();
      if (idx >= 0 && hz) {
        const n = song.notes[idx], sung = 69 + 12 * Math.log2(hz / 440);
        const inNote = (beat - n.beat) / n.dur;
        if (inNote > 0.15 && inNote < 0.9) frames[idx].push(cents(sung, n.midi));
        const shifted = n.midi + cents(sung, n.midi) / 100;               // 옥타브 맞춰서 그림
        const stepF = (shifted - 64) * 7 / 12 + 2;
        trace.push(`${(HEAD_X + beat * PX_PER_BEAT + 20).toFixed(1)},${yOf(stepF).toFixed(1)}`);
        $("trace").setAttribute("points", trace.join(" "));
      } else if (trace.length && trace[trace.length - 1] !== "") { trace.push(""); }
      song.notes.forEach((n, i) => { if (!n.judged && beat >= n.beat + n.dur) { n.judged = true; judge(n, i, frames[i]); } });
      if (beat < song.beats + 0.3) requestAnimationFrame(loop); else done();
    };
    loop();
  });
  if (fake) fake.stop();
  finish(song);
}
function judge(n, i, f) {
  const good = f.filter((c) => Math.abs(c) <= 60).length;
  n.hit = f.length > 3 && good / f.length >= 0.4;
  $("n" + i).setAttribute("fill", n.hit ? "#16a34a" : "#e11d48");
  $("n" + i).setAttribute("stroke", n.hit ? "#16a34a" : "#e11d48");
}
const FAIL = ["그건 좀… 안타까웠다", "음정이 가출함", "삑사리 대잔치", "That was unfortunate…", "음치 판정 (농담)"];
const PASS = ["합격!", "초견 천재?", "음대 가자", "귀가 좋으시네요"];
// 끝나면 곡 전체를 한 화면에: 초록/빨강 판정과 내가 부른 음높이 선이 다 보이게(캡처용)
function overview(song) {
  const width = 90 + song.beats * PX_PER_BEAT + 60;
  svg.setAttribute("viewBox", `0 0 ${Math.max(1000, width)} 300`);
  svg.querySelectorAll("line:not(#roll line)").forEach((l) => { if (l.id !== "playhead") l.setAttribute("x2", Math.max(1000, width)); });
  $("roll").setAttribute("transform", `translate(${90 - HEAD_X} 0)`);
  $("playhead").remove();
}
function finish(song) {
  running = false; $("go").disabled = false;
  overview(song);
  const hits = song.notes.filter((n) => n.hit).length, rate = hits / song.notes.length;
  const stars = rate >= 0.95 ? 3 : rate >= 0.85 ? 2 : rate >= 0.7 ? 1 : 0;
  const best = store.get(); if (stars > (best[level] || 0)) { best[level] = stars; store.set(best); }
  const pick = (a) => a[Math.floor(Math.random() * a.length)];
  $("stars").textContent = "★".repeat(stars) + "☆".repeat(3 - stars);
  $("verdict").textContent = stars ? pick(PASS) : pick(FAIL);
  $("detail").textContent = `Lv.${level + 1} ${LEVELS[level].name} · ${song.notes.length}음 중 ${hits}음 (${Math.round(rate * 100)}%)`;
  $("result").style.display = "block";
  $("msg").textContent = stars && level < LEVELS.length - 1 ? `다음 레벨 열림` : "다시 도전 ㄱㄱ";
  window.lastResult = { level: level + 1, stars, rate, hits, total: song.notes.length };
  drawLevels();
}

$("go").onclick = start;
$("again").onclick = () => { preview(); start(); };
$("share").onclick = () => {
  const r = window.lastResult; if (!r) return;
  const text = `초견 노래방 Lv.${r.level} ${"★".repeat(r.stars)}${"☆".repeat(3 - r.stars)} ${Math.round(r.rate * 100)}% — ${location.origin}${location.pathname}`;
  navigator.clipboard?.writeText(text).then(() => ($("msg").textContent = "복사됨! 붙여넣어서 자랑하기"), () => ($("msg").textContent = text));
};
drawLevels(); preview();
