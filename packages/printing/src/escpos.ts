export function formatReceipt(data: unknown): Buffer {
  return Buffer.from("");
}

export function cutPaper(): Buffer {
  return Buffer.from([0x1d, 0x56, 0x00]);
}

export function openCashDrawer(): Buffer {
  return Buffer.from([0x1b, 0x70, 0x00, 0x19, 0xfa]);
}

export function printBarcode(data: string, format: string = "CODE128"): Buffer {
  return Buffer.from("");
}

export function printQRCode(data: string): Buffer {
  return Buffer.from("");
}

export function setAlignment(align: "left" | "center" | "right"): Buffer {
  const codes = { left: 0, center: 1, right: 2 };
  return Buffer.from([0x1b, 0x61, codes[align]]);
}

export function setBold(enable: boolean): Buffer {
  return Buffer.from([0x1b, 0x45, enable ? 1 : 0]);
}

export function setFont(font: "A" | "B" | "C"): Buffer {
  const fonts: Record<string, number> = { A: 0, B: 1, C: 2 };
  return Buffer.from([0x1b, 0x4d, fonts[font] ?? 0]);
}

export function setTextSize(width: number, height: number): Buffer {
  const w = width & 0xff;
  const h = height & 0xff;
  return Buffer.from([0x1d, 0x21, w | (h << 4)]);
}
