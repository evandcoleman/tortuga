export function extractForwardUser(
  req: Request,
  headerName: string,
): { id: string; email: string } | null {
  const value = req.headers.get(headerName);
  if (!value) return null;
  return { id: value, email: value };
}
