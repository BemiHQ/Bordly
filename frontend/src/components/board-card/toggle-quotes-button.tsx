import { Ellipsis } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/utils/strings';

export const ToggleQuotesButton = ({ expanded, toggle }: { expanded: boolean; toggle: () => void }) => {
  return (
    <Button
      variant="ghost"
      size="sm"
      onClick={toggle}
      className={cn(
        'self-start mt-4 h-3 px-1.5 text-muted-foreground hover:text-muted-foreground bg-border hover:bg-ring',
        expanded ? 'mb-4' : '',
      )}
    >
      <Ellipsis className="size-4" />
    </Button>
  );
};
