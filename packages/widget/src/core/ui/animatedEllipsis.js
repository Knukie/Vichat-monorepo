export function createAnimatedEllipsis(node, options = {}) {
  if (!node) return () => {};

  node.classList.add('valki-ellipsis');

  const { interval = 450 } = options;
  const placeholderText = node.childElementCount === 0 ? node.textContent : null;
  const shouldClearPlaceholder =
    placeholderText && placeholderText.trim() === '.';

  if (shouldClearPlaceholder) {
    node.textContent = '';
  }

  // Container zodat we alleen "onze" dots verwijderen (geen side effects)
  const container = document.createElement('span');
  container.className = 'valki-ellipsis-dots';
  container.setAttribute('aria-hidden', 'true');

  const dots = Array.from({ length: 3 }, () => {
    const dot = document.createElement('span');
    dot.className = 'valki-ellipsis-dot';
    dot.textContent = '.';
    container.appendChild(dot);
    return dot;
  });

  node.appendChild(container);

  dots.forEach((dot) => {
    dot.style.animation = 'none';
    dot.style.opacity = '0.35';
    dot.style.transition = 'opacity 0.2s ease-in-out';
  });

  const prefersReducedMotion = typeof window !== 'undefined'
    && typeof window.matchMedia === 'function'
    && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  let intervalId = 0;
  if (!prefersReducedMotion) {
    let tick = 0;
    const updateDots = () => {
      const activeCount = tick % (dots.length + 1);
      dots.forEach((dot, index) => {
        dot.style.opacity = index < activeCount ? '1' : '0.35';
      });
      tick += 1;
    };
    updateDots();
    intervalId = window.setInterval(updateDots, interval);
  }

  let cleanedUp = false;
  return () => {
    if (cleanedUp) return;
    cleanedUp = true;

    if (intervalId) {
      clearInterval(intervalId);
      intervalId = 0;
    }

    // Verwijder alleen wat we zelf toegevoegd hebben
    container.remove();
    if (shouldClearPlaceholder && node.childNodes.length === 0) {
      node.textContent = placeholderText;
    }
    node.classList.remove('valki-ellipsis');
  };
}
