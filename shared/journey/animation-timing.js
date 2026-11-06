export function frameAt(timeMs, durations) {
  const total = durations.reduce((sum, value) => sum + value, 0);
  if (!total || !durations.length) return 0;
  let cursor = ((timeMs % total) + total) % total;
  for (let index = 0; index < durations.length; index++) {
    if (cursor < durations[index]) return index;
    cursor -= durations[index];
  }
  return durations.length - 1;
}

// RAF timestamps can precede an input event's performance.now() by a fraction
// of a frame. Curve sampling must never receive a negative parameter.
export function revealProgress(timeMs, startMs, durationMs = 1050) {
  return Math.max(0, Math.min(1, (timeMs - startMs) / durationMs));
}

export function frameRect(frame, animation) {
  const col = frame % animation.columns, row = Math.floor(frame / animation.columns);
  const x = animation.margin + col * (animation.frameWidth + animation.spacing);
  const y = animation.margin + row * (animation.frameHeight + animation.spacing);
  return [
    (x + 0.5) / animation.width,
    1 - (y + animation.frameHeight - 0.5) / animation.height,
    (animation.frameWidth - 1) / animation.width,
    (animation.frameHeight - 1) / animation.height,
  ];
}
