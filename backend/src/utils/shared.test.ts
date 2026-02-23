import { describe, expect, it } from 'vitest';
import { createQuotedHtml } from './shared';

describe('createQuotedHtml', () => {
  it('should create quoted HTML with from name and HTML content', () => {
    const result = createQuotedHtml({
      from: { name: 'Alice Smith', email: 'alice@example.com' },
      sentAt: 'Mon, Jan 15, 2024 at 10:30 am',
      html: '<div>Original message content</div>',
      text: '',
    });

    expect(result).toContain('On Mon, Jan 15, 2024 at 10:30 am Alice Smith');
    expect(result).toContain('alice@example.com');
    expect(result).toContain('<div>Original message content</div>');
    expect(result).toContain('class="gmail_quote"');
  });

  it('should create quoted HTML with email only when name is null', () => {
    const result = createQuotedHtml({
      from: { name: null, email: 'bob@example.com' },
      sentAt: 'Tue, Jan 16, 2024 at 2:45 pm',
      html: '<p>Reply message</p>',
      text: '',
    });

    expect(result).toContain('On Tue, Jan 16, 2024 at 2:45 pm bob@example.com');
    expect(result).toContain('<p>Reply message</p>');
  });

  it('should convert text to HTML when html is empty', () => {
    const result = createQuotedHtml({
      from: { name: 'Carol Jones', email: 'carol@example.com' },
      sentAt: 'Wed, Jan 17, 2024 at 9:00 am',
      html: '',
      text: 'First line\nSecond line\n\nThird line',
    });

    expect(result).toContain('On Wed, Jan 17, 2024 at 9:00 am Carol Jones');
    expect(result).toContain('<div>First line</div>');
    expect(result).toContain('<div>Second line</div>');
    expect(result).toContain('<div><br></div>');
    expect(result).toContain('<div>Third line</div>');
  });
});
