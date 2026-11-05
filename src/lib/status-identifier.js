// Standard query links plus the originally requested ?id+501 spelling.
export function readStatusIdentifier(search) {
  const params = new URLSearchParams(search);
  if (params.has("id")) return params.get("id");
  const legacy = /^\?id\+([^&]+)$/.exec(search);
  if (!legacy) return null;
  try {
    return decodeURIComponent(legacy[1]);
  } catch {
    return "";
  }
}
