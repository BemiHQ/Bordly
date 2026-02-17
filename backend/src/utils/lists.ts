export const unique = <T>(array: T[]): T[] => {
  return Array.from(new Set(array));
};

export const presence = <T>(array?: T[]): T[] | undefined => {
  if (array?.length === 0) {
    return undefined;
  }
  return array;
};
