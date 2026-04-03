/**
 * Storage helpers for Browsing Timer extension.
 * All data is stored in chrome.storage.local with the following structure:
 *
 * "dailyStats": {
 *   "YYYY-MM-DD": {
 *     "domain.com": { timeMs: number, visits: number, freshVisits: number }
 *   }
 * }
 *
 * "session": {
 *   activeTabId: number|null,
 *   activeDomain: string|null,
 *   startTime: number|null,
 *   isPaused: boolean
 * }
 */
const BT_Storage = {
  /** Returns today's date key in YYYY-MM-DD format */
  _todayKey() {
    const d = new Date();
    const mm = String(d.getMonth() + 1).padStart(2, "0");
    const dd = String(d.getDate()).padStart(2, "0");
    return `${d.getFullYear()}-${mm}-${dd}`;
  },

  /** Get all daily stats from storage */
  async getAllDailyStats() {
    const result = await chrome.storage.local.get("dailyStats");
    return result.dailyStats || {};
  },

  /** Get stats for a specific date (defaults to today) */
  async getDailyStats(dateKey) {
    const all = await this.getAllDailyStats();
    return all[dateKey || this._todayKey()] || {};
  },

  /** Save full dailyStats object */
  async setAllDailyStats(dailyStats) {
    await chrome.storage.local.set({ dailyStats });
  },

  /**
   * Add browsing time to a domain for today.
   * @param {string} domain
   * @param {number} ms - milliseconds to add
   */
  async addTime(domain, ms) {
    if (!domain || ms <= 0) return;
    const all = await this.getAllDailyStats();
    const today = this._todayKey();
    if (!all[today]) all[today] = {};
    if (!all[today][domain]) {
      all[today][domain] = { timeMs: 0, visits: 0, freshVisits: 0 };
    }
    all[today][domain].timeMs += ms;
    await this.setAllDailyStats(all);
  },

  /**
   * Increment visit count for a domain today.
   * @param {string} domain
   * @param {boolean} isFresh - true if this is a fresh visit (typed/bookmarked)
   */
  async addVisit(domain, isFresh) {
    if (!domain) return;
    const all = await this.getAllDailyStats();
    const today = this._todayKey();
    if (!all[today]) all[today] = {};
    if (!all[today][domain]) {
      all[today][domain] = { timeMs: 0, visits: 0, freshVisits: 0 };
    }
    all[today][domain].visits += 1;
    if (isFresh) {
      all[today][domain].freshVisits += 1;
    }
    await this.setAllDailyStats(all);
  },

  /** Remove data older than 30 days */
  async pruneOldData() {
    const all = await this.getAllDailyStats();
    const cutoff = Date.now() - 30 * 24 * 60 * 60 * 1000;
    let changed = false;
    for (const dateKey of Object.keys(all)) {
      if (new Date(dateKey + "T00:00:00").getTime() < cutoff) {
        delete all[dateKey];
        changed = true;
      }
    }
    if (changed) {
      await this.setAllDailyStats(all);
    }
  },

  /** Get the transient session state */
  async getSession() {
    const result = await chrome.storage.local.get("session");
    return result.session || {
      activeTabId: null,
      activeDomain: null,
      startTime: null,
      isPaused: true
    };
  },

  /** Save transient session state */
  async setSession(session) {
    await chrome.storage.local.set({ session });
  },

  /** Check if tracking is globally enabled (default: true) */
  async isTrackingEnabled() {
    const result = await chrome.storage.local.get("trackingEnabled");
    return result.trackingEnabled !== false;
  }
};
