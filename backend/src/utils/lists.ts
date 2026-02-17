export const unique = <T>(array: T[]): T[] => {
  return Array.from(new Set(array));
};

export const presence = <T>(array?: T[]): T[] | undefined => {
  if (array?.length === 0) {
    return undefined;
  }
  return array;
};

// biome-ignore lint/suspicious/noExplicitAny: generic utility function
export const mapBy = <T, K extends keyof any>(array: T[], keyGetter: (item: T) => K): Record<K, T> => {
  return array.reduce(
    (acc, item) => {
      const key = keyGetter(item);
      acc[key] = item;
      return acc;
    },
    {} as Record<K, T>,
  );
};

// biome-ignore lint/suspicious/noExplicitAny: generic utility function
export const groupBy = <T, K extends keyof any>(array: T[], keyGetter: (item: T) => K): Record<K, T[]> => {
  return array.reduce(
    (acc, item) => {
      const key = keyGetter(item);
      if (!acc[key]) {
        acc[key] = [];
      }
      acc[key].push(item);
      return acc;
    },
    {} as Record<K, T[]>,
  );
};
