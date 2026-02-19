/**
 * @vitest-environment jsdom
 */
import { describe, expect, it } from 'vitest';
import { parseTrailingBackquotes, parseTrailingBlockquotes, removeTrailingEmpty } from './email';

describe('parseTrailingBackquotes', () => {
  it('parses quotes in the middle of text', () => {
    const input = `On 2026-02-12 15:08, teacher@school.edu wrote:
> Good morning students,
>
> I wanted to remind you about the class schedule.
> We have three classes left.
>
> Have a great week,
> Teacher

Sorry, I made a mistake.
There are actually four classes left.`;

    const result = parseTrailingBackquotes(input);
    expect(result.backquotesText).toContain('On 2026-02-12 15:08, teacher@school.edu wrote:');
    expect(result.backquotesText).toContain('> Good morning students,');
    expect(result.mainText).toContain('Sorry, I made a mistake');
    expect(result.mainText).not.toContain('> Good morning students');
  });

  it('parses trailing quotes at the end', () => {
    const input = `Thank you for the update!

On 2026-02-11 10:30, sender@example.com wrote:
> Here is the original message
> with multiple lines
> of quoted content`;

    const result = parseTrailingBackquotes(input);
    expect(result.mainText).toBe('Thank you for the update!');
    expect(result.backquotesText).toContain('On 2026-02-11 10:30');
    expect(result.backquotesText).toContain('> Here is the original message');
  });

  it('handles text with no quotes', () => {
    const input = 'This is just a plain email with no quotes.';
    const result = parseTrailingBackquotes(input);
    expect(result.mainText).toBe(input);
    expect(result.backquotesText).toBe('');
  });

  it('handles quotes without "On ... wrote:" header', () => {
    const input = `I have a comment.

> This is a quote
> from someone

And here is more text.`;

    const result = parseTrailingBackquotes(input);
    expect(result.mainText).toContain('I have a comment.');
    expect(result.mainText).toContain('And here is more text.');
    expect(result.backquotesText).toContain('> This is a quote');
  });

  it('handles multiple quote blocks and stop at first', () => {
    const input = `Reply text here.

On 2026-02-10 14:00, first@example.com wrote:
> First quote block
> with content

This should be in main text.

On 2026-02-09 12:00, second@example.com wrote:
> Second quote block`;

    const result = parseTrailingBackquotes(input);
    expect(result.mainText).toContain('Reply text here.');
    expect(result.mainText).toContain('This should be in main text.');
    expect(result.backquotesText).toContain('On 2026-02-10 14:00');
    expect(result.backquotesText).toContain('> First quote block');
    expect(result.backquotesText).not.toContain('Second quote block');
  });

  it('parses forwarded message at the end', () => {
    const input = `Please review this.

---------- Forwarded message ---------
From: John Doe <john@example.com>
Date: Wed, Feb 18, 2026 at 5:17 PM
Subject: Important update
To: <jane@example.com>

This is the forwarded content.`;

    const result = parseTrailingBackquotes(input);
    expect(result.mainText).toBe('Please review this.');
    expect(result.backquotesText).toContain('---------- Forwarded message ---------');
    expect(result.backquotesText).toContain('From: John Doe');
    expect(result.backquotesText).toContain('This is the forwarded content.');
  });

  it('parses forwarded message in the middle with backquotes', () => {
    const input = `Hi there,
---------- Forwarded message ---------
From: Alice <alice@example.com>
Date: Mon, Feb 17, 2026 at 3:00 PM
Subject: Update
To: <bob@example.com>

> Content here.

Let me know your thoughts.`;

    const result = parseTrailingBackquotes(input);
    expect(result.mainText).toContain('Hi there,');
    expect(result.mainText).toContain('Let me know your thoughts.');
    expect(result.backquotesText).toContain('Forwarded message');
    expect(result.backquotesText).toContain('From: Alice');
    expect(result.backquotesText).toContain('> Content here');
  });
});

describe('parseTrailingBlockquotes', () => {
  it('parses Gmail quote structure in the middle', () => {
    const html = `<p>I reply to this</p>
<div class="gmail_quote">
  <div class="gmail_attr">On Wed, Feb 11, 2026 at 1:38 PM sender@example.com wrote:</div>
  <blockquote class="gmail_quote">
    <p>Original message content</p>
  </blockquote>
</div>`;

    const parser = new DOMParser();
    const doc = parser.parseFromString(html, 'text/html');
    const result = parseTrailingBlockquotes(doc.body);

    expect(result).toHaveLength(1);
    expect(result[0].outerHTML).toContain('gmail_quote');
    expect(result[0].outerHTML).toContain('On Wed, Feb 11, 2026');
  });

  it('does not capture blockquotes in main content', () => {
    const html = `<p>Paragraph 1</p>
<p>Paragraph 2</p>
<blockquote><p>This is a regular quote in content</p></blockquote>
<p>More content</p>
<div class="gmail_quote">
  <div class="gmail_attr">On Wed, Feb 11, 2026 at 1:38 PM sender@example.com wrote:</div>
  <blockquote class="gmail_quote">
    <p>Email quote</p>
  </blockquote>
</div>`;

    const parser = new DOMParser();
    const doc = parser.parseFromString(html, 'text/html');
    const result = parseTrailingBlockquotes(doc.body);

    expect(result).toHaveLength(1);
    expect(result[0].outerHTML).toContain('gmail_quote');
    expect(result[0].textContent).not.toContain('This is a regular quote in content');
  });

  it('handles nested Gmail quotes', () => {
    const html = `<p>I reply</p>
<div class="gmail_quote">
  <div class="gmail_attr">On Wed, Feb 11, 2026 at 5:28 PM person@example.com wrote:</div>
  <blockquote class="gmail_quote">
    <p>See attachment</p>
    <div class="gmail_quote">
      <div class="gmail_attr">On Wed, Feb 11, 2026 at 1:23 PM other@example.com wrote:</div>
      <blockquote class="gmail_quote">
        <p>Original message</p>
      </blockquote>
    </div>
  </blockquote>
</div>`;

    const parser = new DOMParser();
    const doc = parser.parseFromString(html, 'text/html');
    const result = parseTrailingBlockquotes(doc.body);

    expect(result).toHaveLength(1);
    expect(result[0].outerHTML).toContain('On Wed, Feb 11, 2026 at 5:28 PM');
  });

  it('handles content with blockquote but no quote structure', () => {
    const html = `<p>Some text</p>
<blockquote><p>A regular quote</p></blockquote>
<p>More text</p>`;

    const parser = new DOMParser();
    const doc = parser.parseFromString(html, 'text/html');
    const result = parseTrailingBlockquotes(doc.body);

    expect(result).toHaveLength(0);
  });

  it('handles multiple content elements before quote', () => {
    const html = `<p>Paragraph 1</p>
<p>Paragraph 2</p>
<p><strong>Bold text</strong></p>
<p><em>Italic text</em></p>
<ul><li>List item</li></ul>
<blockquote><p>Regular quote in content</p></blockquote>
<p>More content</p>
<div class="gmail_quote">
  <div class="gmail_attr">On Mon, Feb 9, 2026 at 5:01 PM sender@example.com wrote:</div>
  <blockquote class="gmail_quote">
    <p>Hi, this is the email quote</p>
  </blockquote>
</div>`;

    const parser = new DOMParser();
    const doc = parser.parseFromString(html, 'text/html');
    const result = parseTrailingBlockquotes(doc.body);

    expect(result).toHaveLength(1);
    expect(result[0].outerHTML).toContain('email quote');
    expect(result[0].outerHTML).not.toContain('Regular quote in content');
  });

  it('handles quote at the beginning', () => {
    const html = `<div class="gmail_quote">
  <div class="gmail_attr">On Wed, Feb 11, 2026 at 1:38 PM sender@example.com wrote:</div>
  <blockquote class="gmail_quote">
    <p>Original message</p>
  </blockquote>
</div>`;

    const parser = new DOMParser();
    const doc = parser.parseFromString(html, 'text/html');
    const result = parseTrailingBlockquotes(doc.body);

    expect(result).toHaveLength(1);
    expect(result[0].outerHTML).toContain('Original message');
  });

  it('stops at first quote and keep subsequent content in main', () => {
    const html = `<p>First reply</p>
<div class="gmail_quote">
  <div class="gmail_attr">On Wed, Feb 11, 2026 at 2:00 PM sender@example.com wrote:</div>
  <blockquote class="gmail_quote">
    <p>First quote</p>
  </blockquote>
</div>
<p>This should stay in main content</p>
<div class="gmail_quote">
  <div class="gmail_attr">On Wed, Feb 11, 2026 at 1:00 PM other@example.com wrote:</div>
  <blockquote class="gmail_quote">
    <p>Second quote</p>
  </blockquote>
</div>`;

    const parser = new DOMParser();
    const doc = parser.parseFromString(html, 'text/html');
    const result = parseTrailingBlockquotes(doc.body);

    expect(result).toHaveLength(1);
    expect(result[0].textContent).toContain('First quote');
    expect(result[0].textContent).not.toContain('This should stay in main content');
    expect(result[0].textContent).not.toContain('Second quote');
  });

  it('finds quote container nested in wrapper div', () => {
    const html = `<div dir="ltr">
  <div>I reply</div>
  <br>
  <div class="gmail_quote gmail_quote_container">
    <div dir="ltr" class="gmail_attr">On Wed, Feb 11, 2026 at 1:38 PM sender@example.com wrote:</div>
    <blockquote class="gmail_quote">
      <div dir="ltr">
        <div>See</div>
        <div>This message</div>
      </div>
    </blockquote>
  </div>
</div>`;

    const parser = new DOMParser();
    const doc = parser.parseFromString(html, 'text/html');
    const result = parseTrailingBlockquotes(doc.body);

    expect(result).toHaveLength(1);
    expect(result[0].outerHTML).toContain('gmail_quote');
    expect(result[0].textContent).toContain('See');
    expect(result[0].textContent).toContain('This message');
    expect(result[0].textContent).not.toContain('I reply');
  });

  it('handles "On ... wrote:" followed by sibling blockquote wrapper (Missive style)', () => {
    const html = `<div>
  <div>Thanks for update.</div>
  <div><br></div>
  <div>John Doe</div>
  <div><br></div>
  <div>On February 2, 2026 at 6:19 AM, Alice Smith (alice@example.com) wrote:</div>
  <div class="missive_quote">
    <blockquote style="margin-top:0;margin-bottom:0" type="cite">
      <div dir="ltr">
        Hi friends,<br>
        <br>
        <strong>Highlights</strong>
      </div>
      <ul style="margin-top:0;margin-bottom:0">
        <li><div>Launched the rocket</div></li>
      </ul>
    </blockquote>
  </div>
</div>`;

    const parser = new DOMParser();
    const doc = parser.parseFromString(html, 'text/html');
    const result = parseTrailingBlockquotes(doc.body);

    expect(result).toHaveLength(2);
    // First element should be the "On ... wrote:" div
    expect(result[0].textContent).toContain('On February 2, 2026');
    // Second element should be the missive_quote div containing the blockquote
    expect(result[1].classList.contains('missive_quote')).toBe(true);
    expect(result[1].textContent).toContain('Hi friends');
    expect(result[1].textContent).toContain('Highlights');
    // The main message should not be in the quoted elements
    expect(result[0].textContent).not.toContain('Thanks for update.');
    expect(result[1].textContent).not.toContain('Thanks for update.');
  });

  it('parses forwarded message structure', () => {
    const html = `<p>Please see below.</p>
<div class="gmail_quote">
  <div dir="ltr" class="gmail_attr">
    ---------- Forwarded message ---------<br>
    From: <strong>John Doe</strong> <span>&lt;<a href="mailto:john@example.com">john@example.com</a>&gt;</span><br>
    Date: Wed, Feb 18, 2026 at 5:17 PM<br>
    Subject: Project update<br>
    To: &lt;<a href="mailto:jane@example.com">jane@example.com</a>&gt;<br>
  </div>
  <div dir="ltr">
    <div>Content of the forwarded message.</div>
  </div>
</div>`;

    const parser = new DOMParser();
    const doc = parser.parseFromString(html, 'text/html');
    const result = parseTrailingBlockquotes(doc.body);

    expect(result).toHaveLength(1);
    expect(result[0].outerHTML).toContain('gmail_quote');
    expect(result[0].textContent).toContain('Forwarded message');
    expect(result[0].textContent).toContain('john@example.com');
    expect(result[0].textContent).not.toContain('Please see below');
  });

  it('parses forwarded message with content in container', () => {
    const html = `<p>Review this.</p>
<div>
  <div>---------- Forwarded message ---------</div>
  <div>
    <div>From: Alice &lt;alice@example.com&gt;</div>
    <div>Date: Mon, Feb 17, 2026 at 2:00 PM</div>
    <div>Subject: Important</div>
    <div>Message content here.</div>
  </div>
</div>`;

    const parser = new DOMParser();
    const doc = parser.parseFromString(html, 'text/html');
    const result = parseTrailingBlockquotes(doc.body);

    expect(result.length).toBeGreaterThan(0);
    const combinedText = result.map((el) => el.textContent).join(' ');
    expect(combinedText).toContain('Forwarded message');
    expect(combinedText).toContain('From: Alice');
    expect(combinedText).toContain('Message content here');
  });

  it('parses deeply nested gmail_quote inside wrapper divs', () => {
    const html = `<div>
  <div>
    <div class="">Hello Alice - Thanks for thinking of me!</div>
    <div class="gmail_signature"><b>Bob Smith</b></div>
    <div>
      <div class="gmail_quote">
        On Wed, Feb 18, 2026 at 7:07 PM, Alice wrote:<br>
        <blockquote class="gmail_quote">
          <div>Hi Bob, would you be interested?</div>
        </blockquote>
      </div>
    </div>
  </div>
</div>`;

    const parser = new DOMParser();
    const doc = parser.parseFromString(html, 'text/html');
    const result = parseTrailingBlockquotes(doc.body);

    expect(result).toHaveLength(1);
    expect(result[0].className).toContain('gmail_quote');
    expect(result[0].textContent).toContain('On Wed, Feb 18, 2026');
    expect(result[0].textContent).not.toContain('Hello Alice');
    expect(result[0].textContent).not.toContain('Bob Smith');
  });
});

describe('removeTrailingEmpty', () => {
  it('preserves images at the end of content', () => {
    const html = `
      <div>
        <div>
          <p>Name</p>
          <a href="https://example.com/calendar">Book a meeting</a>
        </div>
        <div>
          <br>
        </div>
        <a href="http://example.com"><img width="96" height="15" src="https://example.com/logo.png"></a>
        <br>
        <br>
      </div>
    `;
    const parser = new DOMParser();
    const doc = parser.parseFromString(html, 'text/html');
    const container = doc.body.firstElementChild as Element;

    removeTrailingEmpty(container);

    const imgs = container.querySelectorAll('img');
    expect(imgs.length).toBe(1);
    expect(imgs[0].src).toContain('logo.png');
  });

  it('removes empty divs and br tags without removing images', () => {
    const html = `
      <div>
        <p>Content</p>
        <div><br></div>
        <img src="https://example.com/image.png">
        <br>
      </div>
    `;
    const parser = new DOMParser();
    const doc = parser.parseFromString(html, 'text/html');
    const container = doc.body.firstElementChild as Element;

    removeTrailingEmpty(container);

    const img = container.querySelector('img');
    expect(img).not.toBeNull();
    expect(img?.src).toContain('image.png');
  });

  it('removes trailing empty elements but preserves content', () => {
    const html = `
      <div>
        <p>Hello</p>
        <div><br></div>
        <div></div>
      </div>
    `;
    const parser = new DOMParser();
    const doc = parser.parseFromString(html, 'text/html');
    const container = doc.body.firstElementChild as Element;

    removeTrailingEmpty(container);

    expect(container.textContent?.trim()).toBe('Hello');
    const emptyDivs = Array.from(container.querySelectorAll('div')).filter((div) => !div.textContent?.trim());
    expect(emptyDivs.length).toBe(0);
  });

  it('handles nested elements with images', () => {
    const html = `
      <div>
        <div>
          <div>Text content</div>
          <div>
            <a href="http://example.com"><img src="https://example.com/nested.png"></a>
          </div>
        </div>
        <br>
      </div>
    `;
    const parser = new DOMParser();
    const doc = parser.parseFromString(html, 'text/html');
    const container = doc.body.firstElementChild as Element;

    removeTrailingEmpty(container);

    const img = container.querySelector('img');
    expect(img).not.toBeNull();
    expect(container.textContent).toContain('Text content');
  });

  it('removes only trailing whitespace nodes', () => {
    const html = `
      <div>
        <span>First</span>
        <br>
        <span>Second</span>
        <br>
        <br>
      </div>
    `;
    const parser = new DOMParser();
    const doc = parser.parseFromString(html, 'text/html');
    const container = doc.body.firstElementChild as Element;

    removeTrailingEmpty(container);

    expect(container.textContent).toContain('First');
    expect(container.textContent).toContain('Second');
  });
});
