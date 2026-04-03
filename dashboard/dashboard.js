/**
 * Browsing Timer — Dashboard Script
 * Full-page view with Chart.js bar charts and a sortable data table.
 */
(function () {
  "use strict";

  let selectedDays = 1;
  let dailyChart = null;
  let domainChart = null;
  let currentSort = { key: "timeMs", asc: false };

  /* ── Helpers ───────────────────────────────────────────── */

  function formatTime(ms) {
    const totalSec = Math.floor(ms / 1000);
    const h = Math.floor(totalSec / 3600);
    const m = Math.floor((totalSec % 3600) / 60);
    if (h > 0) return `${h}h ${m}m`;
    return `${m}m`;
  }

  function formatTimeLong(ms) {
    const totalSec = Math.floor(ms / 1000);
    const h = Math.floor(totalSec / 3600);
    const m = Math.floor((totalSec % 3600) / 60);
    const s = totalSec % 60;
    if (h > 0) return `${h}h ${m}m`;
    if (m > 0) return `${m}m ${s}s`;
    return `${s}s`;
  }

  /** Generate array of date keys for the last N days (including today) */
  function dateKeysForRange(days) {
    const keys = [];
    const now = new Date();
    for (let i = days - 1; i >= 0; i--) {
      const d = new Date(now);
      d.setDate(d.getDate() - i);
      const mm = String(d.getMonth() + 1).padStart(2, "0");
      const dd = String(d.getDate()).padStart(2, "0");
      keys.push(`${d.getFullYear()}-${mm}-${dd}`);
    }
    return keys;
  }

  function shortDate(dateKey) {
    const parts = dateKey.split("-");
    const months = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
    return `${months[parseInt(parts[1], 10) - 1]} ${parseInt(parts[2], 10)}`;
  }

  function escapeHtml(str) {
    const el = document.createElement("span");
    el.textContent = str;
    return el.innerHTML;
  }

  /* ── Aggregation ──────────────────────────────────────── */

  function aggregateByDay(allStats, dateKeys) {
    return dateKeys.map(key => {
      const day = allStats[key] || {};
      const totalMs = Object.values(day).reduce((s, d) => s + d.timeMs, 0);
      return { date: key, totalMs };
    });
  }

  function aggregateByDomain(allStats, dateKeys) {
    const map = {};
    for (const key of dateKeys) {
      const day = allStats[key] || {};
      for (const [domain, data] of Object.entries(day)) {
        if (!map[domain]) map[domain] = { domain, timeMs: 0, visits: 0, freshVisits: 0 };
        map[domain].timeMs += data.timeMs;
        map[domain].visits += data.visits;
        map[domain].freshVisits += data.freshVisits;
      }
    }
    return Object.values(map).sort((a, b) => b.timeMs - a.timeMs);
  }

  /* ── Chart rendering ─────────────────────────────────── */

  const chartColors = {
    bar: "rgba(127, 90, 240, 0.75)",
    barBorder: "rgba(127, 90, 240, 1)",
    domainBar: "rgba(44, 182, 125, 0.75)",
    domainBorder: "rgba(44, 182, 125, 1)",
    gridColor: "rgba(255, 255, 255, 0.06)",
    tickColor: "#888"
  };

  function renderDailyChart(dailyData) {
    const ctx = document.getElementById("dailyChart");
    const count = dailyData.length;
    // Ensure minimum bar width: at least 40px per bar, minimum 400px
    const canvasW = Math.max(400, count * 40);
    ctx.width = canvasW;
    ctx.height = 350;
    ctx.style.width = canvasW + "px";
    ctx.style.height = "350px";

    if (dailyChart) dailyChart.destroy();

    dailyChart = new Chart(ctx, {
      type: "bar",
      data: {
        labels: dailyData.map(d => shortDate(d.date)),
        datasets: [{
          label: "Browsing Time",
          data: dailyData.map(d => d.totalMs / 3_600_000), // hours
          backgroundColor: chartColors.bar,
          borderColor: chartColors.barBorder,
          borderWidth: 1,
          borderRadius: 4
        }]
      },
      options: {
        responsive: false,
        maintainAspectRatio: false,
        plugins: {
          legend: { display: false },
          tooltip: {
            callbacks: {
              label: (ctx) => formatTimeLong(ctx.raw * 3_600_000)
            }
          }
        },
        scales: {
          x: {
            ticks: { color: chartColors.tickColor, maxRotation: 45, font: { size: 10 } },
            grid: { display: false }
          },
          y: {
            beginAtZero: true,
            ticks: {
              color: chartColors.tickColor,
              callback: (v) => `${v}h`,
              font: { size: 11 }
            },
            grid: { color: chartColors.gridColor }
          }
        }
      }
    });
  }

  function renderDomainChart(domainData) {
    const ctx = document.getElementById("domainChart");
    const top = domainData.slice(0, 15);
    // Ensure minimum point spacing: at least 60px per point, minimum 400px
    const canvasW = Math.max(400, top.length * 60);
    ctx.width = canvasW;
    ctx.height = 350;
    ctx.style.width = canvasW + "px";
    ctx.style.height = "350px";

    if (domainChart) domainChart.destroy();

    domainChart = new Chart(ctx, {
      type: "line",
      data: {
        labels: top.map(d => d.domain),
        datasets: [{
          label: "Time (min)",
          data: top.map(d => d.timeMs / 60_000),
          borderColor: chartColors.domainBorder,
          backgroundColor: "rgba(44, 182, 125, 0.15)",
          pointBackgroundColor: chartColors.domainBorder,
          pointBorderColor: "#fff",
          pointBorderWidth: 2,
          pointRadius: 5,
          pointHoverRadius: 7,
          borderWidth: 2,
          fill: true,
          tension: 0.3
        }]
      },
      options: {
        responsive: false,
        maintainAspectRatio: false,
        plugins: {
          legend: { display: false },
          tooltip: {
            callbacks: {
              label: (ctx) => formatTimeLong(ctx.raw * 60_000)
            }
          }
        },
        scales: {
          x: {
            ticks: {
              color: chartColors.tickColor,
              maxRotation: 45,
              font: { size: 10 }
            },
            grid: { color: chartColors.gridColor }
          },
          y: {
            beginAtZero: true,
            title: {
              display: true,
              text: "Minutes",
              color: chartColors.tickColor,
              font: { size: 11 }
            },
            ticks: {
              color: chartColors.tickColor,
              callback: (v) => `${Math.round(v)}m`,
              font: { size: 11 }
            },
            grid: { color: chartColors.gridColor }
          }
        }
      }
    });
  }

  /* ── Table rendering ──────────────────────────────────── */

  function renderTable(domainData) {
    const sorted = [...domainData].sort((a, b) => {
      let va = a[currentSort.key];
      let vb = b[currentSort.key];
      if (currentSort.key === "avg") {
        va = a.visits ? a.timeMs / a.visits : 0;
        vb = b.visits ? b.timeMs / b.visits : 0;
      }
      if (typeof va === "string") {
        return currentSort.asc ? va.localeCompare(vb) : vb.localeCompare(va);
      }
      return currentSort.asc ? va - vb : vb - va;
    });

    const tbody = document.getElementById("tableBody");
    tbody.innerHTML = sorted.map(d => {
      const avg = d.visits ? d.timeMs / d.visits : 0;
      return `<tr>
        <td class="domain-cell" title="${escapeHtml(d.domain)}">${escapeHtml(d.domain)}</td>
        <td class="time-cell">${formatTimeLong(d.timeMs)}</td>
        <td>${d.visits}</td>
        <td>${d.freshVisits}</td>
        <td>${formatTimeLong(avg)}</td>
      </tr>`;
    }).join("");

    // Update sort arrows
    document.querySelectorAll(".data-table th").forEach(th => {
      const arrow = th.querySelector(".sort-arrow");
      if (th.dataset.sort === currentSort.key) {
        arrow.textContent = currentSort.asc ? "▲" : "▼";
      } else {
        arrow.textContent = "";
      }
    });
  }

  /* ── Summary cards ────────────────────────────────────── */

  function renderSummary(domainData) {
    const totalMs = domainData.reduce((s, d) => s + d.timeMs, 0);
    const totalVisits = domainData.reduce((s, d) => s + d.visits, 0);
    const totalFresh = domainData.reduce((s, d) => s + d.freshVisits, 0);

    document.getElementById("cardTotalTime").textContent = formatTimeLong(totalMs);
    document.getElementById("cardSites").textContent = domainData.length;
    document.getElementById("cardVisits").textContent = totalVisits;
    document.getElementById("cardFresh").textContent = totalFresh;
  }

  /* ── Main render ──────────────────────────────────────── */

  async function renderAll() {
    const allStats = await BT_Storage.getAllDailyStats();
    const dateKeys = dateKeysForRange(selectedDays);
    const dailyData = aggregateByDay(allStats, dateKeys);
    const domainData = aggregateByDomain(allStats, dateKeys);

    renderSummary(domainData);
    renderDailyChart(dailyData);
    renderDomainChart(domainData);
    renderTable(domainData);
  }

  /* ── Events ───────────────────────────────────────────── */

  // Range toggle
  const customWrap = document.getElementById("customDaysWrap");
  const customInput = document.getElementById("customDaysInput");

  document.getElementById("rangeToggle").addEventListener("click", (e) => {
    const btn = e.target.closest(".range-btn");
    if (!btn) return;

    document.querySelectorAll(".range-btn").forEach(b => b.classList.remove("active"));
    btn.classList.add("active");

    if (btn.dataset.days === "custom") {
      customWrap.style.display = "flex";
      customInput.focus();
      return;
    }

    customWrap.style.display = "none";
    selectedDays = parseInt(btn.dataset.days, 10);
    renderAll();
  });

  document.getElementById("customDaysApply").addEventListener("click", () => {
    const val = parseInt(customInput.value, 10);
    if (val >= 1 && val <= 30) {
      selectedDays = val;
      renderAll();
    }
  });

  customInput.addEventListener("keydown", (e) => {
    if (e.key === "Enter") {
      document.getElementById("customDaysApply").click();
    }
  });

  // Column sorting
  document.querySelector(".data-table thead").addEventListener("click", (e) => {
    const th = e.target.closest("th");
    if (!th || !th.dataset.sort) return;
    if (currentSort.key === th.dataset.sort) {
      currentSort.asc = !currentSort.asc;
    } else {
      currentSort.key = th.dataset.sort;
      currentSort.asc = false;
    }
    renderAll();
  });

  // Initial render
  renderAll();

  /* ── Export helpers ────────────────────────────────────── */

  function buildExportHtml() {
    const dailyCanvas = document.getElementById("dailyChart");
    const domainCanvas = document.getElementById("domainChart");
    const dailyImg = dailyCanvas.toDataURL("image/png");
    const domainImg = domainCanvas.toDataURL("image/png");
    const tableHtml = document.getElementById("dataTable").outerHTML;
    const cards = document.getElementById("summaryCards").innerText;

    return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<title>Browsing Timer Report</title>
<style>
  body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; background: #0f0f1a; color: #e0e0e0; padding: 32px; }
  h1 { color: #fff; margin-bottom: 8px; }
  .meta { color: #888; margin-bottom: 24px; font-size: 13px; }
  .summary { display: flex; gap: 20px; margin-bottom: 28px; flex-wrap: wrap; }
  .card { background: rgba(255,255,255,0.04); border: 1px solid rgba(255,255,255,0.08); border-radius: 10px; padding: 16px 20px; }
  .card-label { font-size: 11px; color: #888; text-transform: uppercase; }
  .card-value { font-size: 22px; font-weight: 700; color: #7f5af0; }
  .chart-img { max-width: 100%; border-radius: 8px; background: rgba(255,255,255,0.04); padding: 12px; margin-bottom: 24px; }
  table { width: 100%; border-collapse: collapse; font-size: 13px; margin-top: 20px; }
  th { text-align: left; padding: 10px 12px; border-bottom: 2px solid rgba(255,255,255,0.1); color: #999; }
  td { padding: 9px 12px; border-bottom: 1px solid rgba(255,255,255,0.04); }
  .domain-cell { color: #f0f0f0; font-weight: 500; }
  .time-cell { color: #2cb67d; font-weight: 600; }
</style>
</head>
<body>
<h1>Browsing Timer Report</h1>
<p class="meta">Range: Last ${selectedDays} day${selectedDays > 1 ? "s" : ""} &mdash; Generated: ${new Date().toLocaleString()}</p>
<div class="summary">
${Array.from(document.querySelectorAll(".card")).map(c => {
  const label = c.querySelector(".card-label").textContent;
  const value = c.querySelector(".card-value").textContent;
  return `<div class="card"><div class="card-label">${escapeHtml(label)}</div><div class="card-value">${escapeHtml(value)}</div></div>`;
}).join("\n")}
</div>
<h2 style="color:#ccc">Daily Browsing Time</h2>
<img class="chart-img" src="${dailyImg}" alt="Daily chart">
<h2 style="color:#ccc">Time Per Website</h2>
<img class="chart-img" src="${domainImg}" alt="Domain chart">
<h2 style="color:#ccc">All Websites</h2>
${tableHtml}
</body>
</html>`;
  }

  document.getElementById("exportHtml").addEventListener("click", () => {
    const html = buildExportHtml();
    const blob = new Blob([html], { type: "text/html" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `browsing-timer-${new Date().toISOString().slice(0,10)}.html`;
    a.click();
    URL.revokeObjectURL(url);
  });

  document.getElementById("exportPdf").addEventListener("click", () => {
    // Build a hidden iframe with the export HTML, then trigger print-to-PDF
    const html = buildExportHtml();
    const printCSS = `<style>@media print { body { -webkit-print-color-adjust: exact; print-color-adjust: exact; background: #0f0f1a !important; } }</style>`;
    const fullHtml = html.replace("</head>", printCSS + "</head>");
    const blob = new Blob([fullHtml], { type: "text/html" });
    const url = URL.createObjectURL(blob);
    const iframe = document.createElement("iframe");
    iframe.style.position = "fixed";
    iframe.style.left = "-9999px";
    iframe.src = url;
    document.body.appendChild(iframe);
    iframe.onload = () => {
      iframe.contentWindow.print();
      setTimeout(() => {
        document.body.removeChild(iframe);
        URL.revokeObjectURL(url);
      }, 1000);
    };
  });

})();
