import * as cheerio from 'cheerio';
import type { AnyNode, Element, Text } from 'domhandler';

const FORWARDED_MESSAGE_REGEX = /^-+\s*Forwarded message\s*-+/i;
const QUOTE_HEADER_REGEX = /On\s+.+\s+wrote:|^-+\s*Forwarded message\s*-+/i;

const isNonEmptyNode = (node: AnyNode) => node.type === 'tag' || (node.type === 'text' && (node as Text).data.trim());

const isQuoteHeader = (text: string): boolean => QUOTE_HEADER_REGEX.test(text);
const isForwardedHeader = (text: string): boolean => FORWARDED_MESSAGE_REGEX.test(text);

const findQuoteContainerChildren = (
  elem: Element,
  $: cheerio.CheerioAPI,
): { onWroteIndex: number; blockquoteIndex: number } | null => {
  const children = $(elem).contents().toArray().filter(isNonEmptyNode);

  for (let i = 0; i < children.length - 1; i++) {
    const child1 = children[i];
    const child2 = children[i + 1];
    if (!child1 || !child2) continue;

    if (child1.type === 'tag' && child2.type === 'tag') {
      const text = $(child1).text().trim();
      const nextElem = child2 as Element;
      if (isQuoteHeader(text) && (nextElem.tagName === 'blockquote' || $(nextElem).find('blockquote').length > 0)) {
        return { onWroteIndex: i, blockquoteIndex: i + 1 };
      }
    }
  }
  return null;
};

const findGmailQuote = (elem: Element, $: cheerio.CheerioAPI): Element | null => {
  const $elem = $(elem);
  const isGmailQuote = $elem.hasClass('gmail_quote') && $elem.find('blockquote').length > 0;
  if (isGmailQuote) return elem;

  const nested = $elem.find('.gmail_quote');
  return nested.find('blockquote').length > 0 ? (nested[0] as Element) : null;
};

const hasVisibleContent = (elem: Element, $: cheerio.CheerioAPI): boolean => {
  if ($(elem).text().trim()) {
    return true;
  }
  const visibleTags = ['img', 'video', 'audio', 'iframe', 'svg', 'canvas', 'hr'];
  if (visibleTags.includes(elem.tagName.toLowerCase())) {
    return true;
  }
  return $(elem)
    .children()
    .toArray()
    .some((child) => hasVisibleContent(child as Element, $));
};

const hasVisibleContentBefore = (children: AnyNode[], beforeIndex: number, $: cheerio.CheerioAPI): boolean => {
  return children.slice(0, beforeIndex).some((node) => {
    if (node.type === 'text') return !!(node as Text).data.trim();
    if (node.type === 'tag') return hasVisibleContent(node as Element, $);
    return false;
  });
};

const shouldSkipForwardedMessage = (
  isForwarded: boolean,
  children: AnyNode[],
  index: number,
  $: cheerio.CheerioAPI,
): boolean => {
  return isForwarded && !hasVisibleContentBefore(children, index, $);
};

const removeTrailingEmpty = ($elem: cheerio.Cheerio<Element>, $: cheerio.CheerioAPI) => {
  const children = $elem.contents().toArray();
  for (let i = children.length - 1; i >= 0; i--) {
    const node = children[i];
    if (!node) continue;

    if (node.type === 'text' && !(node as Text).data.trim()) {
      $(node).remove();
      continue;
    }

    if (node.type === 'tag') {
      const elem = node as Element;
      if (!hasVisibleContent(elem, $)) {
        $(node).remove();
        continue;
      }
      removeTrailingEmpty($(elem), $);
    }

    if (node.type === 'tag' || (node.type === 'text' && (node as Text).data.trim())) {
      break;
    }
  }
};

const parseTrailingBlockquotes = ($container: cheerio.Cheerio<Element>, $: cheerio.CheerioAPI): Element[] => {
  const children = $container.contents().toArray();
  const quotedElements: Element[] = [];
  let foundFirstQuote = false;

  for (let i = 0; i < children.length; i++) {
    const node = children[i];
    if (!node) continue;

    if (node.type === 'text' && !(node as Text).data.trim()) continue;
    if (node.type !== 'tag') continue;

    const elem = node as Element;

    const gmailQuote = findGmailQuote(elem, $);
    if (gmailQuote) {
      const gmailAttr = $(gmailQuote).find('.gmail_attr')[0];
      const isForwarded = !!(gmailAttr && isForwardedHeader($(gmailAttr).text().trim()));

      if (shouldSkipForwardedMessage(isForwarded, children, i, $)) break;

      foundFirstQuote = true;
      quotedElements.push(gmailQuote);
      continue;
    }

    const quoteIndices = findQuoteContainerChildren(elem, $);
    if (quoteIndices) {
      const childNodes = $(elem).contents().toArray().filter(isNonEmptyNode);
      const headerElem = childNodes[quoteIndices.onWroteIndex];
      if (!headerElem) continue;

      const isForwarded = isForwardedHeader($(headerElem).text().trim());

      if (shouldSkipForwardedMessage(isForwarded, children, i, $)) break;

      foundFirstQuote = true;
      quotedElements.push(childNodes[quoteIndices.onWroteIndex] as Element);
      quotedElements.push(childNodes[quoteIndices.blockquoteIndex] as Element);
      continue;
    }

    const text = $(elem).text().trim();
    if (isQuoteHeader(text)) {
      if (shouldSkipForwardedMessage(isForwardedHeader(text), children, i, $)) break;

      foundFirstQuote = true;
      quotedElements.push(elem);

      for (let j = i + 1; j < children.length; j++) {
        const nextNode = children[j];
        if (!nextNode) continue;

        if (nextNode.type === 'text' && !(nextNode as Text).data.trim()) continue;
        if (nextNode.type !== 'tag') continue;

        const nextElem = nextNode as Element;
        if (nextElem.tagName === 'blockquote' || $(nextElem).find('blockquote').length > 0) {
          quotedElements.push(nextElem);
          i = j;
          break;
        }
        if ($(nextElem).text().trim()) break;
      }
      continue;
    }

    if (foundFirstQuote && quotedElements.length > 0) break;

    if (!foundFirstQuote && $(elem).children().length > 0) {
      const childQuotes = parseTrailingBlockquotes($(elem), $);
      if (childQuotes.length > 0) {
        quotedElements.push(...childQuotes);
        foundFirstQuote = true;
      }
    }
  }

  return quotedElements;
};

const parseTrailingBackquotes = (text: string): { mainText: string; backquotesText: string } => {
  const lines = text.split('\n');
  let quoteStartIndex = -1;
  let quoteEndIndex = -1;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (!line) continue;

    const trimmedLine = line.trim();
    if (!trimmedLine) continue;

    const isQuoteLine = isQuoteHeader(trimmedLine) || /^>/.test(trimmedLine);

    if (isQuoteLine) {
      if (quoteStartIndex === -1) quoteStartIndex = i;
      if (/^>/.test(trimmedLine)) quoteEndIndex = i;
    } else if (quoteStartIndex !== -1 && quoteEndIndex !== -1) {
      break;
    }
  }

  if (quoteStartIndex !== -1) {
    const beforeQuote = lines.slice(0, quoteStartIndex).join('\n').trim();
    const quoteStartLine = lines[quoteStartIndex];
    if (!quoteStartLine) return { mainText: text.trimEnd(), backquotesText: '' };

    const isForwardedMessage = isForwardedHeader(quoteStartLine.trim());

    if (isForwardedMessage && !beforeQuote) {
      return { mainText: text.trimEnd(), backquotesText: '' };
    }

    const endIndex = quoteEndIndex !== -1 ? quoteEndIndex + 1 : lines.length;
    const mainText = `${lines.slice(0, quoteStartIndex).join('\n')}\n${lines.slice(endIndex).join('\n')}`.trim();
    const backquotesText = lines.slice(quoteStartIndex, endIndex).join('\n');
    return { mainText, backquotesText };
  }

  return { mainText: text.trimEnd(), backquotesText: '' };
};

// ---------------------------------------------------------------------------------------------------------------------

export const htmlToText = (html: string): string => {
  const $ = cheerio.load(html);
  return $.text().replace(/\r\n/g, '\n').trim();
};

export const parseHtmlBody = (bodyHtml: string): { mainHtml: string; styles: string; quotedHtml: string } => {
  const $ = cheerio.load(bodyHtml);

  const styles = $('head style')
    .map((_, style) => $(style).html() || '')
    .get()
    .join('\n');

  const trailingBlockquotes = parseTrailingBlockquotes($('body'), $);
  const quotedHtml = trailingBlockquotes.map((bq) => $.html(bq)).join('');
  for (const bq of trailingBlockquotes) {
    $(bq).remove();
  }

  removeTrailingEmpty($('body'), $);
  const mainHtml = $('body').html() || '';

  return { mainHtml, quotedHtml, styles };
};

export const parseTextBody = (bodyText: string): { mainText: string; quotedText: string } => {
  const { mainText, backquotesText } = parseTrailingBackquotes(bodyText);
  return { mainText: mainText, quotedText: backquotesText };
};
