/**
 * @vitest-environment jsdom
 */
import { describe, expect, it } from 'vitest';
import { sanitizedDisplayHtml } from './email';

type Attachment = {
  id: string;
  mimeType: string;
  filename: string;
  contentId: string | null | undefined;
};

describe('sanitizedDisplayHtml', () => {
  it('replaces cid: references with proxy URLs for inline images by filename', () => {
    const bodyHtml = '<div><img src="cid:image.png" /><p>Content</p></div>';
    const gmailAttachments = [
      {
        id: 'att123',
        mimeType: 'image/png',
        filename: 'image.png',
        contentId: null,
      },
    ];

    const { displayHtml } = sanitizedDisplayHtml({
      html: bodyHtml,
      gmailAttachments,
      boardId: 'board1',
      boardCardId: 'card1',
    });

    expect(displayHtml).toContain('gmailAttachmentId=att123');
    expect(displayHtml).toContain('boardId=board1');
    expect(displayHtml).toContain('boardCardId=card1');
    expect(displayHtml).not.toContain('cid:image.png');
  });

  it('replaces cid: references with proxy URLs for inline images by contentId', () => {
    const bodyHtml = '<div><img src="cid:abc123" /><p>Text</p></div>';
    const gmailAttachments = [
      {
        id: 'att456',
        mimeType: 'image/jpeg',
        filename: 'photo.jpg',
        contentId: 'abc123',
      },
    ];

    const { displayHtml } = sanitizedDisplayHtml({
      html: bodyHtml,
      gmailAttachments,
      boardId: 'board2',
      boardCardId: 'card2',
    });

    expect(displayHtml).toContain('gmailAttachmentId=att456');
    expect(displayHtml).not.toContain('cid:abc123');
  });

  it('handles multiple images with different cid references', () => {
    const bodyHtml = `
      <div>
        <img src="cid:image1.png" />
        <img src="cid:content-id-2" />
        <p>Text content</p>
      </div>
    `;
    const gmailAttachments = [
      {
        id: 'att1',
        mimeType: 'image/png',
        filename: 'image1.png',
        contentId: null,
      },
      {
        id: 'att2',
        mimeType: 'image/gif',
        filename: 'image2.gif',
        contentId: 'content-id-2',
      },
    ];

    const { displayHtml } = sanitizedDisplayHtml({
      html: bodyHtml,
      gmailAttachments,
      boardId: 'board3',
      boardCardId: 'card3',
    });

    expect(displayHtml).toContain('gmailAttachmentId=att1');
    expect(displayHtml).toContain('gmailAttachmentId=att2');
    expect(displayHtml).not.toContain('cid:image1.png');
    expect(displayHtml).not.toContain('cid:content-id-2');
  });

  it('does not replace non-image attachments', () => {
    const bodyHtml = '<div><img src="cid:document.pdf" /><p>Content</p></div>';
    const gmailAttachments = [
      {
        id: 'att789',
        mimeType: 'application/pdf',
        filename: 'document.pdf',
        contentId: null,
      },
    ];

    const { displayHtml } = sanitizedDisplayHtml({
      html: bodyHtml,
      gmailAttachments,
      boardId: 'board4',
      boardCardId: 'card4',
    });

    // Should not replace since it's not an image
    expect(displayHtml).toContain('cid:document.pdf');
    expect(displayHtml).not.toContain('gmailAttachmentId=att789');
  });

  it('handles HTML without any images', () => {
    const bodyHtml = '<div><p>Just text content</p></div>';
    const gmailAttachments = [
      {
        id: 'att111',
        mimeType: 'image/png',
        filename: 'unused.png',
        contentId: null,
      },
    ];

    const { displayHtml } = sanitizedDisplayHtml({
      html: bodyHtml,
      gmailAttachments,
      boardId: 'board5',
      boardCardId: 'card5',
    });

    expect(displayHtml).toBe('<div><p>Just text content</p></div>');
  });

  it('preserves non-cid image sources', () => {
    const bodyHtml = '<div><img src="https://example.com/image.png" /><p>Content</p></div>';
    const gmailAttachments: Attachment[] = [];

    const { displayHtml } = sanitizedDisplayHtml({
      html: bodyHtml,
      gmailAttachments,
      boardId: 'board6',
      boardCardId: 'card6',
    });

    expect(displayHtml).toContain('https://example.com/image.png');
  });

  it('sanitizes HTML before processing', () => {
    const bodyHtml = '<div><img src="cid:test.png" /><script>alert("bad")</script></div>';
    const gmailAttachments = [
      {
        id: 'att1',
        mimeType: 'image/png',
        filename: 'test.png',
        contentId: null,
      },
    ];

    const { displayHtml } = sanitizedDisplayHtml({
      html: bodyHtml,
      gmailAttachments,
      boardId: 'board7',
      boardCardId: 'card7',
    });

    expect(displayHtml).not.toContain('<script>');
    expect(displayHtml).not.toContain('alert');
    expect(displayHtml).toContain('gmailAttachmentId=att1');
  });

  it('removes dangerous event handlers via DOMPurify', () => {
    const bodyHtml = '<div onclick="evilCode()"><p onmouseover="steal()">Hover me</p></div>';
    const gmailAttachments: Attachment[] = [];

    const { displayHtml } = sanitizedDisplayHtml({
      html: bodyHtml,
      gmailAttachments,
      boardId: 'board8',
      boardCardId: 'card8',
    });

    expect(displayHtml).not.toContain('onclick');
    expect(displayHtml).not.toContain('onmouseover');
    expect(displayHtml).not.toContain('evilCode');
    expect(displayHtml).not.toContain('steal');
    expect(displayHtml).toContain('Hover me');
  });

  it('preserves allowed style attributes via DOMPurify', () => {
    const bodyHtml = '<div style="font-weight: bold; color: blue;"><p style="margin: 10px;">Styled content</p></div>';
    const gmailAttachments: Attachment[] = [];

    const { displayHtml } = sanitizedDisplayHtml({
      html: bodyHtml,
      gmailAttachments,
      boardId: 'board9',
      boardCardId: 'card9',
    });

    expect(displayHtml).toContain('style="font-weight: bold; color: blue;"');
    expect(displayHtml).toContain('style="margin: 10px;"');
    expect(displayHtml).toContain('Styled content');
  });
});
