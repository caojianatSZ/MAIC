'use client';

import QRCode from 'qrcode';

export async function generateBrandedQRCode(
  shareToken: string,
  logoUrl: string
): Promise<string> {
  if (typeof window === 'undefined') {
    throw new Error('QR code generation must run on client side');
  }

  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d')!;

  // Generate QR code (300x300)
  await QRCode.toCanvas(canvas, `${window.location.origin}/share/${shareToken}`, {
    width: 300,
    margin: 2,
    color: {
      dark: '#000000',
      light: '#FFFFFF'
    }
  });

  // Load logo
  const img = new Image();
  img.src = logoUrl;
  await new Promise<void>((resolve, reject) => {
    img.onload = () => resolve();
    img.onerror = reject;
  });

  // Draw logo in center (circular mask)
  const logoSize = 60;
  const logoX = (canvas.width - logoSize) / 2;
  const logoY = (canvas.height - logoSize) / 2;

  ctx.save();
  ctx.beginPath();
  ctx.arc(canvas.width / 2, canvas.height / 2, logoSize / 2, 0, Math.PI * 2);
  ctx.closePath();
  ctx.clip();

  ctx.drawImage(img, logoX, logoY, logoSize, logoSize);
  ctx.restore();

  // Export as PNG
  return canvas.toDataURL('image/png');
}
