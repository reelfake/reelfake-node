export function capitalize(text: string) {
  const words = text.split(' ');
  const capitalized = words.map((w) => `${w.slice(0, 1).toUpperCase()}${w.slice(1).toLowerCase()}`).join(' ');
  return capitalized;
}
