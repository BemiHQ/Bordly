import { useMutation, useQuery } from '@tanstack/react-query';
import { MemoryFormality } from 'bordly-backend/utils/shared';
import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { NativeSelect, NativeSelectOption } from '@/components/ui/native-select';
import { Spinner } from '@/components/ui/spinner';
import { Textarea } from '@/components/ui/textarea';
import { useRouteContext } from '@/hooks/use-route-context';
import type { Board } from '@/query-helpers/board';

interface MemoryFormData {
  greeting: string;
  opener: string;
  signature: string;
  formality: string;
  meetingLink: string;
}

export const AgentMemoryDialog = ({
  board,
  open,
  onOpenChange,
}: {
  board: Board;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) => {
  const { trpc } = useRouteContext();
  const [formData, setFormData] = useState<MemoryFormData>({
    greeting: '',
    opener: '',
    signature: '',
    formality: '',
    meetingLink: '',
  });
  const [initialData, setInitialData] = useState<MemoryFormData>({
    greeting: '',
    opener: '',
    signature: '',
    formality: '',
    meetingLink: '',
  });

  const { data: memoryData, isLoading } = useQuery({
    ...trpc.boardMember.memory.queryOptions({ boardId: board.id }),
    enabled: open,
  });

  useEffect(() => {
    if (memoryData?.memory) {
      const data = {
        greeting: memoryData.memory.greeting || '',
        opener: memoryData.memory.opener || '',
        signature: memoryData.memory.signature || '',
        formality: memoryData.memory.formality || '',
        meetingLink: memoryData.memory.meetingLink || '',
      };
      setFormData(data);
      setInitialData(data);
    }
  }, [memoryData]);

  const setMemoryMutation = useMutation(
    trpc.boardMember.setMemory.mutationOptions({
      onSuccess: () => {
        toast.success('Agent memory updated successfully', { position: 'top-center' });
        setInitialData(formData);
      },
      onError: () => toast.error('Failed to update agent memory. Please try again.', { position: 'top-center' }),
    }),
  );

  const hasChanges =
    formData.greeting !== initialData.greeting ||
    formData.opener !== initialData.opener ||
    formData.signature !== initialData.signature ||
    formData.formality !== initialData.formality ||
    formData.meetingLink !== initialData.meetingLink;

  const handleSubmit = () => {
    setMemoryMutation.mutate({
      boardId: board.id,
      memory: {
        greeting: formData.greeting || null,
        opener: formData.opener || null,
        signature: formData.signature || null,
        formality: formData.formality || null,
        meetingLink: formData.meetingLink || null,
      },
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Agent memory</DialogTitle>
          <DialogDescription className="text-xs">
            Configure how the AI agent should write emails on your behalf.
          </DialogDescription>
        </DialogHeader>

        {isLoading ? (
          <div className="flex items-center justify-center py-8">
            <Spinner />
          </div>
        ) : (
          <div className="flex flex-col gap-4 pt-1 pb-2">
            <div className="flex flex-col gap-2">
              <Label htmlFor="greeting" className="text-xs font-medium">
                Greeting
              </Label>
              <Input
                id="greeting"
                inputSize="sm"
                value={formData.greeting}
                onChange={(e) => setFormData({ ...formData, greeting: e.target.value })}
                placeholder="Hi [First Name],"
              />
            </div>

            <div className="flex flex-col gap-2">
              <Label htmlFor="opener" className="text-xs font-medium">
                Opener
              </Label>
              <Input
                id="opener"
                inputSize="sm"
                value={formData.opener}
                onChange={(e) => setFormData({ ...formData, opener: e.target.value })}
                placeholder="Hope you're doing well!"
              />
            </div>

            <div className="flex flex-col gap-2">
              <Label htmlFor="signature" className="text-xs font-medium">
                Signature
              </Label>
              <Textarea
                id="signature"
                size="sm"
                value={formData.signature}
                onChange={(e) => setFormData({ ...formData, signature: e.target.value })}
                placeholder="Best,&#10;John Smith"
                className="min-h-20 max-h-40"
                autoResize
              />
            </div>

            <div className="flex flex-col gap-2">
              <Label htmlFor="formality" className="text-xs font-medium">
                Formality
              </Label>
              <NativeSelect
                id="formality"
                value={formData.formality}
                onChange={(e) => setFormData({ ...formData, formality: e.target.value })}
                groupClassName="w-full"
                size="sm"
              >
                <NativeSelectOption value="">Select formality level</NativeSelectOption>
                <NativeSelectOption value={MemoryFormality.FORMAL}>Formal</NativeSelectOption>
                <NativeSelectOption value={MemoryFormality.SEMI_FORMAL}>Semi-formal</NativeSelectOption>
                <NativeSelectOption value={MemoryFormality.CASUAL}>Casual</NativeSelectOption>
              </NativeSelect>
            </div>

            <div className="flex flex-col gap-2">
              <Label htmlFor="meetingLink" className="text-xs font-medium">
                Meeting link
              </Label>
              <Input
                id="meetingLink"
                inputSize="sm"
                value={formData.meetingLink}
                onChange={(e) => setFormData({ ...formData, meetingLink: e.target.value })}
                placeholder="https://example.com/my-calendar-link"
              />
            </div>

            <div>
              <Button
                size="sm"
                onClick={handleSubmit}
                disabled={!hasChanges || setMemoryMutation.isPending}
                className="mt-2"
              >
                {setMemoryMutation.isPending ? (
                  <>
                    <Spinner data-icon="inline-start" />
                    Saving...
                  </>
                ) : (
                  'Save changes'
                )}
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
};
