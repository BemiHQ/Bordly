import { type ChangeEvent, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectGroup, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import type { EmailAddress } from '@/query-helpers/email-addresses';

export const participantToInput = (participant: { name?: string | null; email: string }) =>
  participant.name ? `${participant.name} <${participant.email}>` : participant.email;

export const Participants = ({
  from,
  setFrom,
  to,
  setTo,
  cc,
  setCc,
  bcc,
  setBcc,
  fromEmailAddresses,
  onChange,
}: {
  from: string;
  setFrom: (value: string) => void;
  to: string;
  setTo: (value: string) => void;
  cc: string;
  setCc: (value: string) => void;
  bcc: string;
  setBcc: (value: string) => void;
  fromEmailAddresses: EmailAddress[];
  onChange: () => void;
}) => {
  const [showCcBcc, setShowCcBcc] = useState(cc !== '' || bcc !== '');

  const handleFieldChange = (setter: (value: string) => void) => (event: ChangeEvent<HTMLInputElement>) => {
    setter(event.target.value);
    onChange();
  };

  return (
    <div className="px-4 mt-3 mb-2">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <div className="text-xs text-muted-foreground">From</div>
          <Select
            value={from}
            onValueChange={(value) => {
              setFrom(value);
              onChange();
            }}
          >
            <SelectTrigger size="sm" variant="ghost" className="h-7">
              <SelectValue placeholder={from} />
            </SelectTrigger>
            <SelectContent>
              <SelectGroup>
                {fromEmailAddresses.map((address: EmailAddress) => (
                  <SelectItem size="sm" key={address.email} value={participantToInput(address)}>
                    {participantToInput(address)}
                  </SelectItem>
                ))}
              </SelectGroup>
            </SelectContent>
          </Select>
        </div>
        <Button
          type="button"
          variant="ghost"
          size="xs"
          onClick={() => setShowCcBcc((prev) => !prev)}
          className="text-muted-foreground"
        >
          {showCcBcc ? 'Hide Cc/Bcc' : 'Add Cc/Bcc'}
        </Button>
      </div>
      <div className="flex items-center gap-1">
        <div className="text-xs text-muted-foreground">To</div>
        <Input inputSize="sm" className="h-7" variant="ghost" value={to} onChange={handleFieldChange(setTo)} />
      </div>
      {showCcBcc && (
        <>
          <div className="flex items-center gap-1">
            <div className="text-xs text-muted-foreground">Cc</div>
            <Input inputSize="sm" className="h-7" variant="ghost" value={cc} onChange={handleFieldChange(setCc)} />
          </div>
          <div className="flex items-center gap-1">
            <div className="text-xs text-muted-foreground">Bcc</div>
            <Input inputSize="sm" className="h-7" variant="ghost" value={bcc} onChange={handleFieldChange(setBcc)} />
          </div>
        </>
      )}
    </div>
  );
};
