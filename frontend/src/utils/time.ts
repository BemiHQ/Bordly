export const formattedTimeAgo = (date: Date) => {
  const now = new Date();
  const secondsAgo = Math.floor((now.getTime() - date.getTime()) / 1_000);

  if (secondsAgo < 60) {
    return `${secondsAgo}s`;
  } else if (secondsAgo < 3_600) {
    const minutes = Math.floor(secondsAgo / 60);
    return `${minutes}m`;
  } else if (secondsAgo < 86_400) {
    const hours = Math.floor(secondsAgo / 3_600);
    return `${hours}h`;
  } else {
    return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
  }
};

export const formattedShortTime = (date: Date) => {
  const now = new Date();
  const isToday =
    date.getDate() === now.getDate() && date.getMonth() === now.getMonth() && date.getFullYear() === now.getFullYear();

  const timeStr = date
    .toLocaleTimeString('en-US', {
      hour: 'numeric',
      minute: '2-digit',
      hour12: true,
    })
    .toLowerCase();

  if (isToday) {
    return timeStr;
  }

  const isDifferentYear = date.getFullYear() !== now.getFullYear();

  const dateStr = date.toLocaleDateString('en-US', {
    day: 'numeric',
    month: 'short',
    ...(isDifferentYear && { year: 'numeric' }),
  });

  return `${dateStr} at ${timeStr}`;
};

export const shortDateTime = (date: Date) => {
  const timeStr = date
    .toLocaleTimeString('en-US', {
      hour: 'numeric',
      minute: '2-digit',
      hour12: true,
    })
    .toLowerCase();

  const dateStr = date.toLocaleDateString('en-US', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });

  return `${dateStr} at ${timeStr}`;
};

export const shortDateTimeWithWeekday = (date: Date) => {
  return `${date.toLocaleDateString('en-US', { weekday: 'short' })}, ${shortDateTime(date)}`;
};
