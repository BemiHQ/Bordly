import { useCallback, useEffect, useRef, useState } from 'react';

export function useScrollContainer() {
  const [isScrolled, setIsScrolled] = useState(false);
  const [scrollContainer, setScrollContainer] = useState<HTMLDivElement | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);

  const scrollContainerRef = useCallback((node: HTMLDivElement | null) => {
    if (node) setScrollContainer(node);
  }, []);

  useEffect(() => {
    if (!scrollContainer) return;

    const handleScroll = () => {
      setIsScrolled(scrollContainer.scrollTop > 0);
    };

    scrollContainer.addEventListener('scroll', handleScroll);
    return () => scrollContainer.removeEventListener('scroll', handleScroll);
  }, [scrollContainer]);

  const scrollToBottom = useCallback(() => {
    if (bottomRef.current && scrollContainer) {
      bottomRef.current.scrollIntoView({ behavior: 'smooth', block: 'end' });
    }
  }, [scrollContainer]);

  const scrollToTop = useCallback(
    (behavior: ScrollBehavior = 'smooth') => {
      if (scrollContainer) {
        scrollContainer.scrollTo({ top: scrollContainer.scrollHeight, behavior });
      }
    },
    [scrollContainer],
  );

  return {
    isScrolled,
    scrollContainerRef,
    bottomRef,
    scrollToBottom,
    scrollToTop,
  };
}
