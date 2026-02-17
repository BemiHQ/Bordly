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
