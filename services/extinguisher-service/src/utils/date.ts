export const formatDate = (value: Date | string) => new Date(value).toISOString().slice(0, 10);
