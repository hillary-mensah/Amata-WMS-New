export function formatZPL(data: unknown): string {
  return "";
}

export function printLabel(content: string): string {
  return `^XA${content}^XZ`;
}
