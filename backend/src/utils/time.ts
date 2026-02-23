export const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

export const msAgoFrom = (date: Date) => new Date(date.getTime() - 1);

export const shortDateTimeWithWeekday = (date: Date, { timeZone = 'UTC' }: { timeZone?: string }) => {
  const weekday = date.toLocaleDateString('en-US', { timeZone, weekday: 'short' });
  const dateStr = date.toLocaleDateString('en-US', {
    timeZone,
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
  const timeStr = date
    .toLocaleTimeString('en-US', {
      timeZone,
      hour: 'numeric',
      minute: '2-digit',
      hour12: true,
    })
    .toLowerCase();

  return `${weekday}, ${dateStr} at ${timeStr}`;
};
