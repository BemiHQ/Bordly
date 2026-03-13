import { useQuery } from '@tanstack/react-query';
import { Link } from '@tanstack/react-router';
import { Loader2, Search, X } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { useRouteContext } from '@/hooks/use-route-context';
import { formattedTimeAgo } from '@/utils/time';
import { ROUTES } from '@/utils/urls';

const DEBOUNCE_DELAY_MS = 300;

export const BoardSearchButton = ({ boardId }: { boardId: string }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [isClosing, setIsClosing] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [debouncedQuery, setDebouncedQuery] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const { trpc } = useRouteContext();

  useEffect(() => {
    if (isOpen && inputRef.current) {
      inputRef.current.focus();
    }
  }, [isOpen]);

  useEffect(() => {
    const delayDebounce = setTimeout(() => {
      setDebouncedQuery(searchQuery);
    }, DEBOUNCE_DELAY_MS);

    return () => clearTimeout(delayDebounce);
  }, [searchQuery]);

  const { data: searchData, isFetching } = useQuery({
    ...trpc.boardCard.search.queryOptions({ boardId, query: debouncedQuery, limit: 5 }),
    enabled: !!debouncedQuery.trim(),
  });

  const searchResults = searchData?.results || [];

  const handleClose = () => {
    setIsClosing(true);
    setTimeout(() => {
      setIsOpen(false);
      setIsClosing(false);
      setSearchQuery('');
      setDebouncedQuery('');
    }, 200);
  };

  const handleClearInput = () => {
    setSearchQuery('');
    setDebouncedQuery('');
    inputRef.current?.focus();
  };

  return (
    <div className="relative flex items-center" ref={containerRef}>
      {isOpen ? (
        <div
          className={`flex items-center gap-1 ${isClosing ? 'animate-out slide-out-to-right-5 duration-200' : 'animate-in slide-in-from-right-5 duration-200'}`}
        >
          <Popover open={searchResults.length > 0 && !!searchQuery} onOpenChange={() => {}}>
            <PopoverTrigger asChild>
              <div className="relative">
                <Input
                  autoComplete="off"
                  ref={inputRef}
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  onBlur={(e) => {
                    if (!containerRef.current?.contains(e.relatedTarget as Node)) {
                      handleClose();
                    }
                  }}
                  placeholder="Search emails..."
                  className="w-64 h-8 text-sm pr-16"
                  onKeyDown={(e) => {
                    if (e.key === 'Escape') {
                      handleClose();
                    }
                  }}
                />
                <div className="absolute right-1 top-1/2 -translate-y-1/2 flex items-center gap-0.5">
                  {isFetching && <Loader2 className="size-3 text-muted-foreground animate-spin" />}
                  {searchQuery && (
                    <Button
                      variant="ghost"
                      size="icon-sm"
                      onMouseDown={(e) => e.preventDefault()}
                      onClick={handleClearInput}
                      className="h-6 w-6"
                    >
                      <X className="size-3 text-muted-foreground" />
                    </Button>
                  )}
                </div>
              </div>
            </PopoverTrigger>
            <PopoverContent align="end" className="w-96 p-0" onOpenAutoFocus={(e) => e.preventDefault()}>
              <div>
                {searchResults.map((result) => (
                  <Link
                    key={result.id}
                    to={ROUTES.BOARD_CARD.replace('$boardId', boardId).replace('$boardCardId', result.boardCardId)}
                    onMouseDown={(e) => e.preventDefault()}
                    onClick={handleClose}
                    className="block px-4 py-3 hover:bg-accent border-b last:border-b-0 cursor-pointer flex flex-col gap-0.5"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="font-medium text-xs truncate">{result.boardCardSubject}</div>
                      <div className="text-2xs text-muted-foreground flex-shrink-0">
                        {formattedTimeAgo(result.boardCardLastEventAt)}
                      </div>
                    </div>
                    <div className="text-xs text-muted-foreground line-clamp-2">{result.text}</div>
                  </Link>
                ))}
              </div>
            </PopoverContent>
          </Popover>
        </div>
      ) : (
        <Tooltip>
          <TooltipTrigger asChild>
            <Button variant="ghost" size="icon-sm" className="px-2" onClick={() => setIsOpen(true)}>
              <Search className="text-muted-foreground" />
            </Button>
          </TooltipTrigger>
          <TooltipContent side="bottom">Search</TooltipContent>
        </Tooltip>
      )}
    </div>
  );
};
