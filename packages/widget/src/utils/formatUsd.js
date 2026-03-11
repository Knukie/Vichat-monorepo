export function formatUsd(value) {
  if (value === null || value === undefined || value === '' || isNaN(value)) {
    return '—';
  }

  const num = Number(value);

  if (!isFinite(num)) {
    return '—';
  }

  let str = num.toFixed(10);
  str = str.replace(/\.?0+$/, '');

  return `$${str}`;
}
