export const getInternalSecret = () => {
  if (!process.env.INTERNAL_SECRET) throw new Error("INTERNAL_SECRET is required");
  return process.env.INTERNAL_SECRET;
};
