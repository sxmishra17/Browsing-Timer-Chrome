# Browsing Timer — Chrome Extension

> Track your browsing time per website. See how long and how often you visit each site.

---

## Features

- ⏱️ **Per-Site Time Tracking** — Automatically records time spent on each website in real time
- 📊 **Visual Dashboard** — Interactive chart showing daily and weekly browsing patterns
- 🌐 **Domain Grouping** — Intelligently groups subdomains under the main domain
- 🔔 **Idle Detection** — Pauses tracking when you step away from the browser
- 💾 **Persistent Storage** — Data is saved locally and survives browser restarts
- 🎨 **Clean Popup UI** — Quick overview of today's top sites right from the toolbar

---

## Installation

### From Chrome Web Store
Search **"Browsing Timer"** on the [Chrome Web Store](https://chrome.google.com/webstore)

### Developer Install
1. Clone or download this repository
2. Open Chrome and navigate to `chrome://extensions/`
3. Enable **Developer mode** (top-right toggle)
4. Click **Load unpacked** and select the `browsingtime-chrome` folder
5. The extension will appear in your toolbar

---

## How to Use

1. Click the **Browsing Timer** icon in the Chrome toolbar to see today's stats
2. Browse normally — time is tracked automatically in the background
3. Click **Dashboard** to view detailed charts and historical data
4. Use the reset option to clear browsing data when needed

---

## Project Structure

```
browsingtime-chrome/
├── manifest.json              # MV3 manifest — permissions and configuration
├── background/
│   └── background.js          # Service worker — tab tracking, idle detection
├── popup/
│   ├── popup.html             # Toolbar popup UI
│   ├── popup.css              # Popup styles
│   └── popup.js               # Popup logic — display top sites
├── dashboard/
│   ├── dashboard.html         # Full dashboard page
│   ├── dashboard.css          # Dashboard styles
│   └── dashboard.js           # Charts and historical data
├── utils/
│   ├── domains.js             # Domain parsing and grouping utilities
│   └── storage.js             # Storage abstraction layer
├── lib/
│   └── chart.min.js           # Chart.js for data visualization
└── icons/                     # Extension icons (48, 96px)
```

---

## Third-Party Libraries

| Library | License | Purpose |
|---------|---------|---------|
| [Chart.js](https://www.chartjs.org/) | MIT | Data visualization and charts |

---

## Privacy

**No data leaves your device.** All browsing time data is stored locally using Chrome's `chrome.storage.local` API. No external network requests are made.

---

## Developer

**YuvaTech**

---

## License

All Rights Reserved — free to use, modify, and distribute.
