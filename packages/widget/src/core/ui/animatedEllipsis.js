export function createAnimatedEllipsis(node) {
  if (!node) return () => {};

  node.classList.add('valki-ellipsis');

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

  let cleanedUp = false;
  return () => {
    if (cleanedUp) return;
    cleanedUp = true;

    // Verwijder alleen wat we zelf toegevoegd hebben
    container.remove();
    if (shouldClearPlaceholder && node.childNodes.length === 0) {
      node.textContent = placeholderText;
    }
    node.classList.remove('valki-ellipsis');
  };
}
