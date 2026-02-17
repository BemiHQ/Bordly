import DOMPurify from 'dompurify';
import { type RefObject, useEffect, useRef } from 'react';
import emailIframeStyles from '@/email-iframe.css?inline';

const MAX_RESIZE_COUNT = 5;

export const useEmailIframe = (
  iframeRef: RefObject<HTMLIFrameElement | null>,
  {
    html,
    styles = '',
    enabled = true,
  }: {
    html: string;
    styles?: string;
    enabled?: boolean;
  },
) => {
  const resizeCount = useRef(0);

  useEffect(() => {
    if (!enabled || !iframeRef.current || !html) return;

    const iframe = iframeRef.current;
    const iframeDoc = iframe.contentDocument;
    if (!iframeDoc) return;

    const sanitized = DOMPurify.sanitize(html, {
      WHOLE_DOCUMENT: false,
      ADD_ATTR: ['style'],
    });

    iframeDoc.documentElement.innerHTML = `<!DOCTYPE html>
<html>
  <head>
    <meta charset="utf-8">
    <style>${emailIframeStyles}</style>
    ${styles ? `<style>${styles}</style>` : ''}
  </head>
  <body class="bordly-email">${sanitized}</body>
</html>`;

    const links = iframeDoc.querySelectorAll('a');
    links.forEach((link) => {
      link.setAttribute('target', '_blank');
      link.setAttribute('rel', 'noopener noreferrer');
    });

    const resizeObserver = new ResizeObserver(() => {
      if (resizeCount.current >= MAX_RESIZE_COUNT) {
        resizeObserver.disconnect();
        return;
      }

      const iframeHtmlScrollHeight = iframeDoc.documentElement.scrollHeight;
      const bodyRectHeight = iframeDoc.body.getBoundingClientRect().height;
      const bodyChildrenRectHeight = [...iframeDoc.body.children].reduce(
        (sum, e) => sum + e.getBoundingClientRect().height,
        0,
      );

      const height = Math.max(iframeHtmlScrollHeight, bodyRectHeight, bodyChildrenRectHeight);

      iframe.style.height = `${Math.ceil(height)}px`;
      resizeCount.current += 1;
    });
    resizeObserver.observe(iframeDoc.body);

    return () => resizeObserver.disconnect();
  }, [iframeRef, html, styles, enabled]);
};
