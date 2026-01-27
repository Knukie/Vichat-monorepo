const DEFAULT_INTERVAL = 450;
const FRAMES = ['.', '..', '...'];

export function createAnimatedEllipsis(node, { interval = DEFAULT_INTERVAL } = {}) {
  if (!node) return () => {};
  let frame = 0;
  node.textContent = FRAMES[frame];
  const timer = window.setInterval(() => {
    frame = (frame + 1) % FRAMES.length;
    node.textContent = FRAMES[frame];
  }, interval);
  return () => window.clearInterval(timer);
}
