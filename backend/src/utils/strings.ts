export const slugify = (text: string): string => {
  return text
    .toString()
    .toLowerCase()
    .trim()
    .replace(/\s+/g, '-') // Replace spaces with -
    .replace(/[^\w-]+/g, '') // Remove all non-word chars
    .replace(/--+/g, '-'); // Replace multiple - with single -
};

export const renderTemplate = (template: string, variables: { [key: string]: string }): string => {
  return template.replace(/{{\s*([^}]+)\s*}}/g, (_match, p1) => {
    const key = p1.trim();
    if (!variables[key]) throw new Error(`Missing variable for template: ${key}`);
    return variables[key];
  });
};
