import { Download, X } from 'lucide-react';
import { Spinner } from '@/components/ui/spinner';
import { formatBytes } from '@/utils/strings';

export const UploadingAttachment = ({ filename }: { filename: string }) => {
  return (
    <div className="flex items-center gap-2 px-3.5 py-1.5 bg-muted/50 rounded-lg text-xs w-fit">
      <Spinner data-icon="inline-start" className="size-3.5" />
      <div className="truncate text-text-secondary font-medium">{filename}</div>
    </div>
  );
};

export const Attachment = ({
  filename,
  size,
  onDownload,
  onDelete,
  className = '',
}: {
  filename: string;
  size: number;
  onDownload?: () => void;
  onDelete?: () => void;
  className?: string;
}) => {
  return (
    <div
      className={`flex items-center gap-2 px-3.5 py-1.5 bg-muted rounded-lg text-xs w-fit ${className}`}
      onClick={onDownload}
      onKeyDown={
        onDownload
          ? (e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                onDownload();
              }
            }
          : undefined
      }
      role={onDownload ? 'button' : undefined}
      tabIndex={onDownload ? 0 : undefined}
      style={{ cursor: onDownload ? 'pointer' : 'default' }}
    >
      {onDownload && <Download className="size-3.5 flex-shrink-0 text-muted-foreground mb-0.5" />}
      <div className="flex items-end gap-1.5">
        <div className="truncate text-text-secondary font-medium">{filename}</div>
        <div className="text-muted-foreground text-2xs">({formatBytes(size)})</div>
      </div>
      {onDelete && (
        <button
          type="button"
          onClick={(e) => {
            e.preventDefault();
            onDelete();
          }}
          className="text-muted-foreground hover:text-foreground ml-0.5 cursor-pointer"
        >
          <X className="size-3.5" />
        </button>
      )}
    </div>
  );
};
