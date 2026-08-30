export function apForMiss(): number {
  return 1;
}

export function apForHit(): number {
  return 2;
}

export function apForSink(): number {
  return 3;
}

/** Award AP for one resolved strike action (cells struck this action). */
export function computeApGain(opts: {
  hits: number;
  misses: number;
  sunk: number;
}): number {
  let ap = 0;
  ap += opts.misses * apForMiss();
  ap += opts.hits * apForHit();
  ap += opts.sunk * apForSink();
  return ap;
}
