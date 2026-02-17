export const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

export const msAgoFrom = (date: Date) => new Date(date.getTime() - 1);
