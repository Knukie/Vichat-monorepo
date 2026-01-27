export function createAnimatedEllipsis(node) {
  if (!node) return () => {};

  node.classList.add('valki-ellipsis');

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
    node.classList.remove('valki-ellipsis');
  };
}
