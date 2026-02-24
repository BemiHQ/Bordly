import { useCallback, useEffect, useRef, useState } from 'react';

export function useScrollContainer() {
  const [isScrolled, setIsScrolled] = useState(false);
  const scrollContainerRef = useRef<HTMLDivElement | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);

  const scrollContainerCallback = useCallback((node: HTMLDivElement | null) => {
    scrollContainerRef.current = node;
  }, []);

  useEffect(() => {
    const scrollContainer = scrollContainerRef.current;
    if (!scrollContainer) return;

    const handleScroll = () => {
      setIsScrolled(scrollContainer.scrollTop > 0);
    };

    scrollContainer.addEventListener('scroll', handleScroll);
    return () => scrollContainer.removeEventListener('scroll', handleScroll);
  }, []);

  const scrollToBottom = useCallback(() => {
    if (bottomRef.current && scrollContainerRef.current) {
      bottomRef.current.scrollIntoView({ behavior: 'smooth', block: 'end' });
    }
  }, []);

  return {
    isScrolled,
    scrollContainerRef: scrollContainerCallback,
    scrollContainerElement: scrollContainerRef,
    bottomRef,
    scrollToBottom,
  };
}
