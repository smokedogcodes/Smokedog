"use client";

let audioCtx: AudioContext | null = null;

function getCtx(): AudioContext {
  if (!audioCtx) audioCtx = new AudioContext();
  return audioCtx;
}

function tone(
  frequency: number,
  duration: number,
  type: OscillatorType = "sine",
  gain = 0.08
) {
  try {
    const ctx = getCtx();
    if (ctx.state === "suspended") void ctx.resume();
    const osc = ctx.createOscillator();
    const g = ctx.createGain();
    osc.type = type;
    osc.frequency.value = frequency;
    g.gain.value = gain;
    osc.connect(g);
    g.connect(ctx.destination);
    osc.start();
    g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + duration);
    osc.stop(ctx.currentTime + duration);
  } catch {
    /* audio unavailable */
  }
}

export function playVoteStart() {
  tone(440, 0.12);
  setTimeout(() => tone(554, 0.15), 80);
}

export function playGoodNews() {
  tone(523, 0.1);
  setTimeout(() => tone(659, 0.1), 90);
  setTimeout(() => tone(784, 0.2), 180);
}

export function playBadNews() {
  tone(220, 0.25, "triangle", 0.1);
  setTimeout(() => tone(165, 0.35, "triangle", 0.08), 120);
}

export function playActionNeeded() {
  tone(880, 0.08, "square", 0.05);
  setTimeout(() => tone(880, 0.08, "square", 0.05), 160);
}

export function playCardDeal() {
  tone(520, 0.06, "triangle", 0.04);
  setTimeout(() => tone(680, 0.05, "triangle", 0.03), 40);
}

export function playRoundComplete() {
  tone(392, 0.12, "sine", 0.06);
  setTimeout(() => tone(523, 0.18, "sine", 0.05), 120);
}

/** Escalating lobby host-offline warning (host-only). */
export function playLobbyIdleWarning(stage: 1 | 2 | 3) {
  if (stage === 1) {
    tone(660, 0.1, "square", 0.05);
    return;
  }
  if (stage === 2) {
    playActionNeeded();
    return;
  }
  playBadNews();
}

export function playBattleshipHit() {
  tone(180, 0.08, "square", 0.07);
  setTimeout(() => tone(120, 0.18, "sawtooth", 0.06), 60);
}

export function playBattleshipMiss() {
  tone(320, 0.12, "sine", 0.04);
  setTimeout(() => tone(240, 0.2, "triangle", 0.03), 80);
}

export function playBattleshipSink() {
  tone(200, 0.1, "square", 0.07);
  setTimeout(() => tone(150, 0.15, "sawtooth", 0.08), 90);
  setTimeout(() => tone(90, 0.35, "triangle", 0.09), 200);
}
