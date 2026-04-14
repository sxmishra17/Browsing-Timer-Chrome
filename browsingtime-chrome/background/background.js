/**
 * Browsing Timer — Background Service Worker (Chrome MV3)
 *
 * Core timer engine that tracks active browsing time per domain.
 * Pauses on: browser minimize, window focus loss, idle (120s), tab switch.
 * Resumes on: window focus gain, user activity, tab activation.
 * Flushes accumulated time to storage every 10 seconds via chrome.alarms.
 *
 * State is persisted in chrome.storage.session so it survives service worker
 * restarts. No data is collected or sent externally — everything stays local.
 */

// Import utility scripts into service worker scope
importScripts("../utils/domains.js", "../utils/storage.js");

(function () {
  "use strict";

  /* ── State ─────────────────────────────────────────────────── */
  let currentTabId = null;
  let currentDomain = null;
  let timerStart = null;       // Date.now() when tracking started / resumed
  let pendingMs = 0;           // unflushed milliseconds for currentDomain
  let isPaused = true;
  let windowFocused = true;
  let userIdle = false;
  let globalEnabled = true;

  const FLUSH_ALARM_NAME = "bt_flush";
  const FLUSH_PERIOD_MINUTES = 10 / 60; // ~10 seconds (Chrome minimum is actually 0.5 min for repeating)
  const IDLE_SECONDS = 120;

  // Chrome enforces a minimum alarm period of 30 seconds. For more frequent
  // flushing we set a 0.5-minute repeating alarm and also flush on every
  // state transition (tab switch, pause, etc.) which provides effective
  // sub-minute persistence.
  const ALARM_PERIOD = 0.5; // minutes — Chrome enforced minimum for repeating

  /* ── Session persistence ───────────────────────────────────── */
  // Service workers can be killed at any time. We save critical state to
  // chrome.storage.session (in-memory, per-session storage) to survive restarts.

  async function saveState() {
    await chrome.storage.session.set({
      _btState: {
        currentTabId,
        currentDomain,
        timerStart,
        pendingMs,
        isPaused,
        windowFocused,
        userIdle,
        globalEnabled
      }
    });
  }

  async function restoreState() {
    try {
      const result = await chrome.storage.session.get("_btState");
      if (result._btState) {
        const s = result._btState;
        currentTabId = s.currentTabId;
        currentDomain = s.currentDomain;
        timerStart = s.timerStart;
        pendingMs = s.pendingMs;
        isPaused = s.isPaused;
        windowFocused = s.windowFocused;
        userIdle = s.userIdle;
        globalEnabled = s.globalEnabled;
      }
    } catch {
      // First install or session cleared — use defaults
    }
  }

  /* ── Helpers ───────────────────────────────────────────────── */

  /** Accumulate elapsed time since last checkpoint into pendingMs */
  function checkpoint() {
    if (timerStart !== null) {
      pendingMs += Date.now() - timerStart;
      timerStart = Date.now();
    }
  }

  /** Write pendingMs to storage and reset */
  async function flush() {
    checkpoint();
    if (currentDomain && pendingMs > 0) {
      await BT_Storage.addTime(currentDomain, pendingMs);
    }
    pendingMs = 0;
    await saveState();
  }

  function startFlushAlarm() {
    chrome.alarms.get(FLUSH_ALARM_NAME, (existing) => {
      if (!existing) {
        chrome.alarms.create(FLUSH_ALARM_NAME, { periodInMinutes: ALARM_PERIOD });
      }
    });
  }

  function stopFlushAlarm() {
    chrome.alarms.clear(FLUSH_ALARM_NAME);
  }

  /** Can we actively track right now? */
  function canTrack() {
    return globalEnabled && windowFocused && !userIdle;
  }

  /* ── Core actions ──────────────────────────────────────────── */

  async function pauseTracking() {
    if (isPaused) return;
    checkpoint();
    await flush();
    timerStart = null;
    isPaused = true;
    stopFlushAlarm();
    await updateBadge();
    await saveState();
  }

  async function resumeTracking() {
    if (!canTrack() || currentDomain === null) return;
    timerStart = Date.now();
    isPaused = false;
    startFlushAlarm();
    await updateBadge();
    await saveState();
  }

  /**
   * Begin tracking a new tab. Pauses old domain first, then starts new one.
   * @param {number} tabId
   */
  async function switchToTab(tabId) {
    // Pause whatever was active
    if (!isPaused) {
      await flush();
      timerStart = null;
      isPaused = true;
      stopFlushAlarm();
    }

    currentTabId = tabId;

    try {
      const tab = await chrome.tabs.get(tabId);
      const domain = BT_Domains.extractDomain(tab.url);
      currentDomain = domain;

      if (domain && canTrack()) {
        timerStart = Date.now();
        isPaused = false;
        startFlushAlarm();
      }
    } catch {
      // Tab may have been closed between events
      currentDomain = null;
    }
    await updateBadge();
    await saveState();
  }

  /**
   * Handle URL change within the same tab.
   */
  async function handleUrlChange(tabId, newUrl) {
    if (tabId !== currentTabId) return;
    const newDomain = BT_Domains.extractDomain(newUrl);
    if (newDomain === currentDomain) return;

    // Flush time for old domain
    if (!isPaused) {
      await flush();
    }

    currentDomain = newDomain;
    pendingMs = 0;

    if (newDomain && canTrack()) {
      timerStart = Date.now();
      isPaused = false;
      startFlushAlarm();
    } else {
      timerStart = null;
      isPaused = true;
      stopFlushAlarm();
    }
    await updateBadge();
    await saveState();
  }

  /* ── Badge ─────────────────────────────────────────────────── */

  async function updateBadge() {
    try {
      if (isPaused || !currentDomain) {
        await chrome.action.setBadgeText({ text: "" });
        return;
      }
      // Show a small green dot to indicate active tracking
      await chrome.action.setBadgeText({ text: "●" });
      await chrome.action.setBadgeBackgroundColor({ color: "#4CAF50" });
    } catch { /* ignore if popup not available */ }
  }

  /* ── Event listeners ───────────────────────────────────────── */

  // Tab activated (switched to)
  chrome.tabs.onActivated.addListener(async (activeInfo) => {
    await restoreState();
    await switchToTab(activeInfo.tabId);
  });

  // Tab URL changed (navigation within same tab)
  chrome.tabs.onUpdated.addListener((tabId, changeInfo, _tab) => {
    if (changeInfo.url) {
      restoreState().then(() => handleUrlChange(tabId, changeInfo.url));
    }
  });

  // Tab closed
  chrome.tabs.onRemoved.addListener(async (tabId) => {
    await restoreState();
    if (tabId === currentTabId) {
      await pauseTracking();
      currentTabId = null;
      currentDomain = null;
      await saveState();
    }
  });

  // Window focus changed
  chrome.windows.onFocusChanged.addListener(async (windowId) => {
    await restoreState();
    if (windowId === chrome.windows.WINDOW_ID_NONE) {
      windowFocused = false;
      await pauseTracking();
    } else {
      windowFocused = true;
      // Find the active tab in the focused window
      const tabs = await chrome.tabs.query({ active: true, windowId });
      if (tabs.length > 0) {
        await switchToTab(tabs[0].id);
      } else {
        await resumeTracking();
      }
    }
  });

  // Idle detection – 120 second threshold
  chrome.idle.setDetectionInterval(IDLE_SECONDS);
  chrome.idle.onStateChanged.addListener(async (state) => {
    await restoreState();
    if (state === "active") {
      userIdle = false;
      await resumeTracking();
    } else {
      // "idle" or "locked"
      userIdle = true;
      await pauseTracking();
    }
  });

  // Listen for global toggle changes from popup
  chrome.storage.onChanged.addListener(async (changes, area) => {
    if (area === "local" && "trackingEnabled" in changes) {
      await restoreState();
      globalEnabled = changes.trackingEnabled.newValue !== false;
      if (globalEnabled) {
        await resumeTracking();
      } else {
        await pauseTracking();
      }
    }
  });

  // Fresh visit detection via webNavigation
  chrome.webNavigation.onCommitted.addListener((details) => {
    // Only track main frame navigations
    if (details.frameId !== 0) return;
    const domain = BT_Domains.extractDomain(details.url);
    if (!domain) return;

    // Count every navigation as a visit
    const freshTypes = new Set(["typed", "auto_bookmark", "generated"]);
    const isFresh = freshTypes.has(details.transitionType);
    BT_Storage.addVisit(domain, isFresh);
  });

  // Alarm listeners — handles both flush and daily cleanup
  chrome.alarms.onAlarm.addListener(async (alarm) => {
    if (alarm.name === FLUSH_ALARM_NAME) {
      await restoreState();
      await flush();
    } else if (alarm.name === "dailyCleanup") {
      await BT_Storage.pruneOldData();
    }
  });

  // Daily cleanup alarm
  chrome.alarms.create("dailyCleanup", { periodInMinutes: 1440 });

  /* ── Startup ───────────────────────────────────────────────── */

  async function init() {
    // Restore any persisted state from a previous service worker instance
    await restoreState();

    // Load global enabled state
    globalEnabled = await BT_Storage.isTrackingEnabled();

    // Prune old data on startup
    await BT_Storage.pruneOldData();

    // Start tracking the currently active tab
    try {
      const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
      if (tabs.length > 0) {
        windowFocused = true;
        await switchToTab(tabs[0].id);
      }
    } catch { /* first install, no tabs yet */ }
  }

  init();
})();
