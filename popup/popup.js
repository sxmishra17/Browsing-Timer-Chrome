/**
 * Browsing Timer — Popup Script
 * Shows today's top 5 sites by browsing time with proportional bars.
 */
(function () {
  "use strict";

  /** Format milliseconds as "Xh Ym" or "Xm Ys" */
  function formatTime(ms) {
    const totalSec = Math.floor(ms / 1000);
    const h = Math.floor(totalSec / 3600);
    const m = Math.floor((totalSec % 3600) / 60);
    const s = totalSec % 60;
    if (h > 0) return `${h}h ${m}m`;
    if (m > 0) return `${m}m ${s}s`;
    return `${s}s`;
  }

  async function render() {
    const todayStats = await BT_Storage.getDailyStats();
    const entries = Object.entries(todayStats)
      .map(([domain, data]) => ({ domain, ...data }))
      .sort((a, b) => b.timeMs - a.timeMs);

    // Total time today
    const totalMs = entries.reduce((sum, e) => sum + e.timeMs, 0);
    document.getElementById("totalTime").textContent = formatTime(totalMs);

    const container = document.getElementById("sitesList");

    if (entries.length === 0) {
      container.innerHTML = '<p class="empty-msg">No browsing data for today yet.</p>';
      return;
    }

    const top = entries.slice(0, 7);
    const maxMs = top[0].timeMs || 1;

    container.innerHTML = top.map((entry, i) => `
      <div class="site-row">
        <span class="site-rank">${i + 1}</span>
        <div class="site-info">
          <div class="site-domain" title="${escapeHtml(entry.domain)}">${escapeHtml(entry.domain)}</div>
          <div class="site-bar-wrap">
            <div class="site-bar" style="width:${Math.max(2, (entry.timeMs / maxMs) * 100)}%"></div>
          </div>
        </div>
        <div class="site-meta">
          <div class="site-time">${formatTime(entry.timeMs)}</div>
          <div class="site-visits">${entry.visits} visit${entry.visits !== 1 ? "s" : ""}</div>
        </div>
      </div>
    `).join("");
  }

  function escapeHtml(str) {
    const el = document.createElement("span");
    el.textContent = str;
    return el.innerHTML;
  }

  // Toggle button
  const toggleBtn = document.getElementById("toggleBtn");

  async function loadToggleState() {
    const result = await chrome.storage.local.get("trackingEnabled");
    const enabled = result.trackingEnabled !== false; // default true
    toggleBtn.className = "toggle-btn " + (enabled ? "on" : "off");
    toggleBtn.title = enabled ? "Tracking ON — click to pause" : "Tracking OFF — click to resume";
  }

  toggleBtn.addEventListener("click", async () => {
    const result = await chrome.storage.local.get("trackingEnabled");
    const wasEnabled = result.trackingEnabled !== false;
    const nowEnabled = !wasEnabled;
    await chrome.storage.local.set({ trackingEnabled: nowEnabled });
    toggleBtn.className = "toggle-btn " + (nowEnabled ? "on" : "off");
    toggleBtn.title = nowEnabled ? "Tracking ON — click to pause" : "Tracking OFF — click to resume";
  });

  loadToggleState();

  // Dashboard button
  document.getElementById("dashboardBtn").addEventListener("click", () => {
    chrome.tabs.create({ url: chrome.runtime.getURL("dashboard/dashboard.html") });
    window.close();
  });

  render();
})();
