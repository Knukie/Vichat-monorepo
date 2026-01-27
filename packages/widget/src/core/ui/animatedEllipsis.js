export function createAnimatedEllipsis(node) {
  if (!node) return () => {};
  node.textContent = '';
  node.classList.add('valki-ellipsis');
  const dots = Array.from({ length: 3 }, () => {
    const dot = document.createElement('span');
    dot.className = 'valki-ellipsis-dot';
    dot.textContent = '.';
    node.appendChild(dot);
    return dot;
  });
  return () => {
    dots.forEach((dot) => dot.remove());
    node.classList.remove('valki-ellipsis');
  };
}
