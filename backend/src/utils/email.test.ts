import { describe, expect, it } from 'vitest';
import { parseHtmlBody, parseTextBody } from './email';

describe('parseTextBody', () => {
  it('parses quotes in the middle of text', () => {
    const input = `On 2024-01-15 10:30, contact@company.com wrote:
> Hello team,
>
> This is a reminder about the meeting.
> We have three sessions scheduled.
>
> Best regards,
> Manager

Sorry, I made an error.
There are actually four sessions scheduled.`;

    const result = parseTextBody(input);
    expect(result.quotedText).toContain('On 2024-01-15 10:30, contact@company.com wrote:');
    expect(result.quotedText).toContain('> Hello team,');
    expect(result.mainText).toContain('Sorry, I made an error');
    expect(result.mainText).not.toContain('> Hello team');
  });

  it('parses trailing quotes at the end', () => {
    const input = `Thank you for the update!

On 2024-01-10 14:20, user@domain.com wrote:
> Here is the original message
> with multiple lines
> of quoted content`;

    const result = parseTextBody(input);
    expect(result.mainText).toBe('Thank you for the update!');
    expect(result.quotedText).toContain('On 2024-01-10 14:20');
    expect(result.quotedText).toContain('> Here is the original message');
  });

  it('handles text with no quotes', () => {
    const input = 'This is just a plain email with no quotes.';
    const result = parseTextBody(input);
    expect(result.mainText).toBe(input);
    expect(result.quotedText).toBe('');
  });

  it('handles quotes without "On ... wrote:" header', () => {
    const input = `I have a comment.

> This is a quote
> from someone

And here is more text.`;

    const result = parseTextBody(input);
    expect(result.mainText).toContain('I have a comment.');
    expect(result.mainText).toContain('And here is more text.');
    expect(result.quotedText).toContain('> This is a quote');
  });

  it('handles multiple quote blocks and stops at first', () => {
    const input = `Reply text here.

On 2024-01-08 11:00, user1@example.com wrote:
> First quote block
> with content

This should be in main text.

On 2024-01-07 09:00, user2@example.com wrote:
> Second quote block`;

    const result = parseTextBody(input);
    expect(result.mainText).toContain('Reply text here.');
    expect(result.mainText).toContain('This should be in main text.');
    expect(result.quotedText).toContain('On 2024-01-08 11:00');
    expect(result.quotedText).toContain('> First quote block');
    expect(result.quotedText).not.toContain('Second quote block');
  });

  it('parses forwarded messages with visible content before', () => {
    const withContent = `Please review this.

---------- Forwarded message ---------
From: Person A <persona@example.com>
Date: Mon, Jan 20, 2024 at 3:15 PM
Subject: Important update
To: <personb@example.com>

This is the forwarded content.`;

    const result1 = parseTextBody(withContent);
    expect(result1.mainText).toBe('Please review this.');
    expect(result1.quotedText).toContain('Forwarded message');
    expect(result1.quotedText).toContain('forwarded content');

    const withMiddleContent = `Hi there,
---------- Forwarded message ---------
From: Person B <personb@example.com>
> Content here.

Let me know your thoughts.`;

    const result2 = parseTextBody(withMiddleContent);
    expect(result2.mainText).toContain('Hi there,');
    expect(result2.mainText).toContain('Let me know your thoughts.');
    expect(result2.quotedText).toContain('Forwarded message');
  });

  it('does not quote forwarded message without visible content before it', () => {
    const input = `---------- Forwarded message ---------
From: Person C <personc@example.com>
Date: Tue, 22 Jan 2024 at 08:45
Subject: Test email
To: <recipient@example.com>

Hey there, this is the forwarded content.`;

    const result = parseTextBody(input);
    expect(result.mainText).toContain('Forwarded message');
    expect(result.mainText).toContain('Hey there');
    expect(result.quotedText).toBe('');
  });
});

describe('parseHtmlBody', () => {
  it('parses Gmail quote structure in the middle', () => {
    const html = `<html><body><p>I reply to this</p>
<div class="gmail_quote">
  <div class="gmail_attr">On Mon, Jan 12, 2024 at 2:45 PM user@example.com wrote:</div>
  <blockquote class="gmail_quote">
    <p>Original message content</p>
  </blockquote>
</div></body></html>`;

    const result = parseHtmlBody(html);
    expect(result.mainHtml).toContain('I reply to this');
    expect(result.mainHtml).not.toContain('gmail_quote');
    expect(result.quotedHtml).toContain('gmail_quote');
    expect(result.quotedHtml).toContain('On Mon, Jan 12, 2024');
  });

  it('does not capture blockquotes in main content', () => {
    const html = `<html><body><p>Paragraph 1</p>
<p>Paragraph 2</p>
<blockquote><p>This is a regular quote in content</p></blockquote>
<p>More content</p>
<div class="gmail_quote">
  <div class="gmail_attr">On Mon, Jan 12, 2024 at 2:45 PM user@example.com wrote:</div>
  <blockquote class="gmail_quote">
    <p>Email quote</p>
  </blockquote>
</div></body></html>`;

    const result = parseHtmlBody(html);
    expect(result.mainHtml).toContain('Paragraph 1');
    expect(result.mainHtml).toContain('This is a regular quote in content');
    expect(result.mainHtml).not.toContain('Email quote');
    expect(result.quotedHtml).toContain('gmail_quote');
    expect(result.quotedHtml).toContain('Email quote');
    expect(result.quotedHtml).not.toContain('This is a regular quote in content');
  });

  it('handles nested Gmail quotes', () => {
    const html = `<html><body><p>I reply</p>
<div class="gmail_quote">
  <div class="gmail_attr">On Mon, Jan 12, 2024 at 6:20 PM person@example.com wrote:</div>
  <blockquote class="gmail_quote">
    <p>See attachment</p>
    <div class="gmail_quote">
      <div class="gmail_attr">On Mon, Jan 12, 2024 at 2:15 PM other@example.com wrote:</div>
      <blockquote class="gmail_quote">
        <p>Original message</p>
      </blockquote>
    </div>
  </blockquote>
</div></body></html>`;

    const result = parseHtmlBody(html);
    expect(result.mainHtml).toContain('I reply');
    expect(result.mainHtml).not.toContain('See attachment');
    expect(result.quotedHtml).toContain('On Mon, Jan 12, 2024 at 6:20 PM');
  });

  it('handles content with blockquote but no quote structure', () => {
    const html = `<html><body><p>Some text</p>
<blockquote><p>A regular quote</p></blockquote>
<p>More text</p></body></html>`;

    const result = parseHtmlBody(html);
    expect(result.mainHtml).toContain('Some text');
    expect(result.mainHtml).toContain('A regular quote');
    expect(result.quotedHtml).toBe('');
  });

  it('handles multiple content elements before quote', () => {
    const html = `<html><body><p>Paragraph 1</p>
<p>Paragraph 2</p>
<p><strong>Bold text</strong></p>
<p><em>Italic text</em></p>
<ul><li>List item</li></ul>
<blockquote><p>Regular quote in content</p></blockquote>
<p>More content</p>
<div class="gmail_quote">
  <div class="gmail_attr">On Fri, Jan 10, 2024 at 4:30 PM user@example.com wrote:</div>
  <blockquote class="gmail_quote">
    <p>Hi, this is the email quote</p>
  </blockquote>
</div></body></html>`;

    const result = parseHtmlBody(html);
    expect(result.mainHtml).toContain('Bold text');
    expect(result.mainHtml).toContain('List item');
    expect(result.mainHtml).toContain('Regular quote in content');
    expect(result.quotedHtml).toContain('email quote');
    expect(result.quotedHtml).not.toContain('Regular quote in content');
  });

  it('handles quote at the beginning', () => {
    const html = `<html><body><div class="gmail_quote">
  <div class="gmail_attr">On Mon, Jan 12, 2024 at 2:45 PM user@example.com wrote:</div>
  <blockquote class="gmail_quote">
    <p>Original message</p>
  </blockquote>
</div></body></html>`;

    const result = parseHtmlBody(html);
    expect(result.mainHtml.trim()).toBe('');
    expect(result.quotedHtml).toContain('Original message');
  });

  it('stops at first quote and keeps subsequent content in main', () => {
    const html = `<html><body><p>First reply</p>
<div class="gmail_quote">
  <div class="gmail_attr">On Mon, Jan 12, 2024 at 3:00 PM user@example.com wrote:</div>
  <blockquote class="gmail_quote">
    <p>First quote</p>
  </blockquote>
</div>
<p>This should stay in main content</p>
<div class="gmail_quote">
  <div class="gmail_attr">On Mon, Jan 12, 2024 at 2:00 PM other@example.com wrote:</div>
  <blockquote class="gmail_quote">
    <p>Second quote</p>
  </blockquote>
</div></body></html>`;

    const result = parseHtmlBody(html);
    expect(result.mainHtml).toContain('First reply');
    expect(result.mainHtml).toContain('This should stay in main content');
    expect(result.mainHtml).toContain('Second quote');
    expect(result.quotedHtml).toContain('First quote');
    expect(result.quotedHtml).not.toContain('This should stay in main content');
    expect(result.quotedHtml).not.toContain('Second quote');
  });

  it('finds quote container nested in wrapper div', () => {
    const html = `<html><body><div dir="ltr">
  <div>I reply</div>
  <br>
  <div class="gmail_quote gmail_quote_container">
    <div dir="ltr" class="gmail_attr">On Mon, Jan 12, 2024 at 2:45 PM user@example.com wrote:</div>
    <blockquote class="gmail_quote">
      <div dir="ltr">
        <div>See</div>
        <div>This message</div>
      </div>
    </blockquote>
  </div>
</div></body></html>`;

    const result = parseHtmlBody(html);
    expect(result.mainHtml).toContain('I reply');
    expect(result.mainHtml).not.toContain('See');
    expect(result.quotedHtml).toContain('gmail_quote');
    expect(result.quotedHtml).toContain('See');
    expect(result.quotedHtml).toContain('This message');
  });

  it('handles "On ... wrote:" followed by sibling blockquote wrapper (Missive style)', () => {
    const html = `<html><body><div>
  <div>Thanks for update.</div>
  <div><br></div>
  <div>Person Name</div>
  <div><br></div>
  <div>On January 5, 2024 at 7:25 AM, Person B (personb@example.com) wrote:</div>
  <div class="missive_quote">
    <blockquote style="margin-top:0;margin-bottom:0" type="cite">
      <div dir="ltr">
        Hi friends,<br>
        <br>
        <strong>Highlights</strong>
      </div>
      <ul style="margin-top:0;margin-bottom:0">
        <li><div>Launched the project</div></li>
      </ul>
    </blockquote>
  </div>
</div></body></html>`;

    const result = parseHtmlBody(html);
    expect(result.mainHtml).toContain('Thanks for update');
    expect(result.mainHtml).toContain('Person Name');
    expect(result.mainHtml).not.toContain('On January 5, 2024');
    expect(result.quotedHtml).toContain('On January 5, 2024');
    expect(result.quotedHtml).toContain('Hi friends');
    expect(result.quotedHtml).toContain('Highlights');
  });

  it('parses forwarded message structures with visible content before', () => {
    const withGmailQuote = `<html><body><p>Please see below.</p>
<div class="gmail_quote">
  <div dir="ltr" class="gmail_attr">
    ---------- Forwarded message ---------<br>
    From: <strong>Person A</strong> <span>&lt;<a href="mailto:persona@example.com">persona@example.com</a>&gt;</span><br>
  </div>
  <div dir="ltr"><div>Content of the forwarded message.</div></div>
</div></body></html>`;

    const result1 = parseHtmlBody(withGmailQuote);
    expect(result1.mainHtml).toContain('Please see below');
    expect(result1.mainHtml).not.toContain('Forwarded message');
    expect(result1.quotedHtml).toContain('Forwarded message');

    const withContainer = `<html><body><p>Review this.</p>
<div>
  <div>---------- Forwarded message ---------</div>
  <div>
    <div>From: Person B &lt;personb@example.com&gt;</div>
    <div>Message content here.</div>
  </div>
</div></body></html>`;

    const result2 = parseHtmlBody(withContainer);
    expect(result2.mainHtml).toContain('Review this');
    expect(result2.quotedHtml).toContain('Forwarded message');
    expect(result2.quotedHtml).toContain('Message content here');
  });

  it('parses deeply nested gmail_quote inside wrapper divs', () => {
    const html = `<html><body><div>
  <div>
    <div class="">Hello Person - Thanks for thinking of me!</div>
    <div class="gmail_signature"><b>Name Here</b></div>
    <div>
      <div class="gmail_quote">
        On Mon, Jan 20, 2024 at 8:15 PM, Person wrote:<br>
        <blockquote class="gmail_quote">
          <div>Hi, would you be interested?</div>
        </blockquote>
      </div>
    </div>
  </div>
</div></body></html>`;

    const result = parseHtmlBody(html);
    expect(result.mainHtml).toContain('Hello Person');
    expect(result.mainHtml).toContain('Name Here');
    expect(result.mainHtml).not.toContain('On Mon, Jan 20, 2024');
    expect(result.quotedHtml).toContain('gmail_quote');
    expect(result.quotedHtml).toContain('On Mon, Jan 20, 2024');
  });

  it('does not quote forwarded message without visible content before it', () => {
    const html = `<html><body><div dir="ltr">
  <br>
  <br>
  <div class="gmail_quote gmail_quote_container">
    <div dir="ltr" class="gmail_attr">
      ---------- Forwarded message ---------<br>
      From: <strong class="gmail_sendername" dir="auto">Person Name</strong> <span dir="auto">&lt;<a href="mailto:person@example.com">person@example.com</a>&gt;</span><br>
      Date: Tue, 22 Jan 2024 at 10:30<br>
      Subject: Test email<br>
      To: &lt;<a href="mailto:recipient@example.com">recipient@example.com</a>&gt;<br>
    </div><br>
    <br>
    <p style="margin:0px;line-height:1.5;font-size:14px;min-height:1.5em"><span style="font-family:ui-sans-serif,system-ui,sans-serif;font-size:14px">Hey there</span></p>
  </div>
</div></body></html>`;

    const result = parseHtmlBody(html);
    expect(result.mainHtml).toContain('Forwarded message');
    expect(result.mainHtml).toContain('Hey there');
    expect(result.quotedHtml).toBe('');
  });

  it('quotes forwarded message when there is visible content before it', () => {
    const html = `<html><body><div dir="ltr">
  <p>Please see the message below.</p>
  <div class="gmail_quote gmail_quote_container">
    <div dir="ltr" class="gmail_attr">
      ---------- Forwarded message ---------<br>
      From: <strong class="gmail_sendername" dir="auto">Person Name</strong> <span dir="auto">&lt;<a href="mailto:person@example.com">person@example.com</a>&gt;</span><br>
      Date: Tue, 22 Jan 2024 at 10:30<br>
      Subject: Important<br>
      To: &lt;<a href="mailto:recipient@example.com">recipient@example.com</a>&gt;<br>
    </div><br>
    <br>
    <p>Message content here</p>
  </div>
</div></body></html>`;

    const result = parseHtmlBody(html);
    expect(result.mainHtml).toContain('Please see the message below');
    expect(result.mainHtml).not.toContain('Forwarded message');
    expect(result.quotedHtml).toContain('gmail_quote');
    expect(result.quotedHtml).toContain('Forwarded message');
  });

  it('preserves images at the end of content', () => {
    const html = `<html><body>
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
    </body></html>`;

    const result = parseHtmlBody(html);
    expect(result.mainHtml).toContain('logo.png');
    expect(result.mainHtml).toContain('<img');
  });

  it('removes empty divs and br tags without removing images', () => {
    const html = `<html><body>
      <div>
        <p>Content</p>
        <div><br></div>
        <img src="https://example.com/image.png">
        <br>
      </div>
    </body></html>`;

    const result = parseHtmlBody(html);
    expect(result.mainHtml).toContain('image.png');
    expect(result.mainHtml).toContain('<img');
  });

  it('removes trailing empty elements but preserves content', () => {
    const html = `<html><body>
      <div>
        <p>Hello</p>
        <div><br></div>
        <div></div>
      </div>
    </body></html>`;

    const result = parseHtmlBody(html);
    expect(result.mainHtml).toContain('Hello');
  });

  it('handles nested elements with images', () => {
    const html = `<html><body>
      <div>
        <div>
          <div>Text content</div>
          <div>
            <a href="http://example.com"><img src="https://example.com/nested.png"></a>
          </div>
        </div>
        <br>
      </div>
    </body></html>`;

    const result = parseHtmlBody(html);
    expect(result.mainHtml).toContain('nested.png');
    expect(result.mainHtml).toContain('Text content');
  });

  it('removes only trailing whitespace nodes', () => {
    const html = `<html><body>
      <div>
        <span>First</span>
        <br>
        <span>Second</span>
        <br>
        <br>
      </div>
    </body></html>`;

    const result = parseHtmlBody(html);
    expect(result.mainHtml).toContain('First');
    expect(result.mainHtml).toContain('Second');
  });

  it('extracts styles from head', () => {
    const html = `<html>
<head>
  <style>
    .main { color: blue; }
  </style>
  <style>
    .secondary { color: red; }
  </style>
</head>
<body>
  <p>Content</p>
</body>
</html>`;

    const result = parseHtmlBody(html);
    expect(result.styles).toContain('.main { color: blue; }');
    expect(result.styles).toContain('.secondary { color: red; }');
  });
});
