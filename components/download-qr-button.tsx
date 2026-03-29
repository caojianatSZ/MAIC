'use client';

import { useState } from 'react';
import { generateBrandedQRCode } from '@/lib/qrcode/generate-branded-qr';

interface DownloadQRButtonProps {
  shareToken: string;
  organization: {
    name: string;
    logoMimeType: string;
    logoData: string;
  };
}

export function DownloadQRButton({ shareToken, organization }: DownloadQRButtonProps) {
  const [isGenerating, setIsGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleDownload = async () => {
    setIsGenerating(true);
    setError(null);

    try {
      const logoUrl = `data:${organization.logoMimeType};base64,${organization.logoData}`;
      const qrDataUrl = await generateBrandedQRCode(shareToken, logoUrl);

      const link = document.createElement('a');
      link.href = qrDataUrl;
      link.download = `${organization.name}-课程二维码.png`;
      link.click();
    } catch (err) {
      console.error('QR generation error:', err);
      setError('生成二维码失败，请稍后重试');
    } finally {
      setIsGenerating(false);
    }
  };

  return (
    <div>
      <button
        onClick={handleDownload}
        disabled={isGenerating}
        className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50"
      >
        {isGenerating ? '生成中...' : '下载二维码'}
      </button>
      {error && <p className="text-red-500 text-sm mt-1">{error}</p>}
    </div>
  );
}
