// Only accept file URLs that were produced by our UploadThing uploads.
export function isUploadThingUrl(value: string): boolean {
  try {
    const u = new URL(value);
    if (u.protocol !== "https:") return false;
    const h = u.hostname.toLowerCase();
    return h === "utfs.io" || h.endsWith(".ufs.sh") || h.endsWith(".utfs.io");
  } catch {
    return false;
  }
}
