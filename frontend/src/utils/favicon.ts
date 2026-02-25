import { ENV } from '@/utils/env';

const ORIGINAL_FAVICON = '/images/favicon-32x32.png';
const SIZE = 32;

export const updateFaviconBadge = (show: boolean) => {
  const favicon = document.querySelector<HTMLLinkElement>('link[rel="icon"][sizes="32x32"]');
  if (!favicon) return;

  const isDevelopment = ENV.NODE_ENV === 'development';

  if (!show && !isDevelopment) {
    favicon.href = ORIGINAL_FAVICON;
    return;
  }

  const img = new Image();
  img.onload = () => {
    const canvas = document.createElement('canvas');
    canvas.width = SIZE;
    canvas.height = SIZE;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    if (isDevelopment) {
      ctx.globalAlpha = 0.5;
    }

    ctx.drawImage(img, 0, 0, SIZE, SIZE);

    if (show) {
      if (isDevelopment) {
        ctx.globalAlpha = 1.0;
      }

      const badgeSize = Math.floor(SIZE * 0.3);
      const x = SIZE - badgeSize - 1;
      const y = 1;

      ctx.fillStyle = '#ef4444';
      ctx.beginPath();
      ctx.arc(x + badgeSize / 2, y + badgeSize / 2, badgeSize / 2, 0, 2 * Math.PI);
      ctx.fill();
    }

    favicon.href = canvas.toDataURL('image/png');
  };

  img.onerror = () => {
    console.error(`Failed to load favicon: ${ORIGINAL_FAVICON}`);
  };

  img.src = ORIGINAL_FAVICON;
};
