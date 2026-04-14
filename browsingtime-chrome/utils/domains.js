/**
 * Domain extraction utility for Browsing Timer extension.
 * Extracts a clean domain from any URL, returning null for non-trackable pages.
 */
const BT_Domains = {
  /** Set of URL schemes that should not be tracked */
  _nonTrackable: new Set([
    "about:",
    "chrome:",
    "chrome-extension:",
    "edge:",
    "resource:",
    "file:",
    "data:",
    "blob:",
    "javascript:"
  ]),

  /**
   * Extract a trackable domain from a URL string.
   * Returns the hostname with "www." stripped, or null if non-trackable.
   * @param {string} url
   * @returns {string|null}
   */
  extractDomain(url) {
    if (!url || typeof url !== "string") return null;

    for (const scheme of this._nonTrackable) {
      if (url.startsWith(scheme)) return null;
    }

    try {
      const hostname = new URL(url).hostname;
      if (!hostname) return null;
      return hostname.startsWith("www.") ? hostname.slice(4) : hostname;
    } catch {
      return null;
    }
  }
};
