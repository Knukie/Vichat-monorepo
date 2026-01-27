export function createAnimatedEllipsis(node) {
  if (!node) return () => {};
  node.textContent = '';
  node.classList.add('valki-ellipsis');
  return () => node.classList.remove('valki-ellipsis');
}
