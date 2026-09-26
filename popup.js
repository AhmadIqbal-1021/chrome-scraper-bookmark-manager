// popup.js — Final Version with Export Features

document.addEventListener("DOMContentLoaded", function () {

  // We store the last scraped data here so export buttons can access it
  let lastScrapedData = [];
  let lastScrapedAction = "";

  // ══════════════════════════════════════════════
  //   TOAST NOTIFICATIONS (Task 3E)
  //   A tiny "✅ copied!" style message that fades out on its own.
  //   Any feature can call showToast("message") to use it.
  // ══════════════════════════════════════════════
  function showToast(message) {
    const container = document.getElementById("toast-container");
    if (!container) return;
    const toast = document.createElement("div");
    toast.className = "toast";
    toast.textContent = message;
    container.appendChild(toast);
    setTimeout(function () { toast.remove(); }, 2000);
  }

  // ══════════════════════════════════════════════
  //   HISTORY TAB COUNT BADGE (Task 3D)
  // ══════════════════════════════════════════════
  function updateHistoryCountBadge() {
    chrome.storage.local.get(null, function (allData) {
      const count = Object.keys(allData).filter(function (key) {
        return key.startsWith("history:");
      }).length;
      const badge = document.getElementById("history-count-badge");
      if (badge) badge.textContent = count > 0 ? String(count) : "";
    });
  }
  updateHistoryCountBadge();

  // ══════════════════════════════════════════════
  //   ESCAPE KEY — close any open result (Task 3E)
  // ══════════════════════════════════════════════
  document.addEventListener("keydown", function (e) {
    if (e.key === "Escape") {
      resetScraperResults();
    }
  });

  // Hides/shows each tab + section based on the feature toggle flags saved
  // in Settings. Pulled into its own function (it used to be four copy-pasted
  // if-blocks) so it's one rule instead of four, and so tests.js can call it
  // directly with fake flags instead of relying on real chrome.storage.sync.
  function applyFeatureVisibility(flags) {
    const featureMap = {
      scraperEnabled:   ["tab-scraper", "section-scraper"],
      bookmarksEnabled: ["tab-bookmarks", "section-bookmarks"],
      aiEnabled:        ["tab-ai", "section-ai"],
      historyEnabled:   ["tab-history", "section-history"]
    };
    Object.keys(featureMap).forEach(function (flagName) {
      const isOn = flags[flagName] ?? true;
      const ids  = featureMap[flagName];
      document.getElementById(ids[0]).style.display = isOn ? "" : "none";
      document.getElementById(ids[1]).style.display = isOn ? "" : "none";
    });
  }

        //===========================
        //================================================== DARK MODE TOGGLE





// ── DARK MODE ────────────────────────────────────────────────────────────
// When popup opens, check if dark mode was previously saved and apply it immediately.
// We do this FIRST so there's no flash of light theme before dark kicks in.
chrome.storage.local.get("darkMode", function (result) {
  // result.darkMode will be true, false, or undefined (if never set)
  // If it's true, add the "dark" class to body
  if (result.darkMode === true) {
    document.body.classList.add("dark");
    // Icon-only label (Task 1 redesigned this into a small sidebar icon button)
    document.getElementById("btn-dark-mode").textContent = "☀️";
  }
});

document.getElementById("btn-dark-mode").addEventListener("click", function () {
  // Toggle: if body currently has "dark" class, remove it; otherwise add it
  const isDark = document.body.classList.toggle("dark");
  // isDark is the NEW state — true if we just turned dark ON, false if we turned it OFF

  // Update button icon to reflect the opposite action
  this.textContent = isDark ? "☀️" : "🌙";

  // Save the preference so it persists after popup closes
  chrome.storage.local.set({ darkMode: isDark });
});











    // ── READ FEATURE TOGGLES AND SHOW/HIDE TABS ───────────────
// This runs every time the popup opens.
// We check what the user saved in settings and hide disabled features.

chrome.storage.sync.get(
  ["scraperEnabled", "bookmarksEnabled", "aiEnabled","historyEnabled"],
  function (result) {

    const scraperOn   = result.scraperEnabled   ?? true;
    const bookmarksOn = result.bookmarksEnabled ?? true;
    const aiOn        = result.aiEnabled        ?? true;
    const historyOn   = result.historyEnabled   ?? true;

    // If a feature is OFF — hide its tab button AND its section
    applyFeatureVisibility({
      scraperEnabled:   scraperOn,
      bookmarksEnabled: bookmarksOn,
      aiEnabled:        aiOn,
      historyEnabled:   historyOn
    });

    // ── SMART DEFAULT: activate the first VISIBLE tab ──────
    // If scraper is disabled, we can't leave it as the default active tab.
    // We find whichever tab is still visible and activate that one instead.

    const tabIds = ["tab-scraper", "tab-bookmarks", "tab-ai", "tab-history"];
    const secIds = ["section-scraper", "section-bookmarks", "section-ai","section-history"];

    // First, mark ALL tabs and sections as inactive/hidden
    tabIds.forEach(id => document.getElementById(id).classList.remove("active"));
    secIds.forEach(id => document.getElementById(id).classList.add("hidden"));

    // ── REMEMBER LAST ACTIVE TAB (Task 3E) ────────────────────
    // If the user had a tab open when they last closed the popup,
    // reopen on that same tab instead of always defaulting to Scraper.
    chrome.storage.local.get("lastActiveTab", function (saved) {
      let activated = false;
      const preferred = saved.lastActiveTab;

      if (preferred) {
        const idx = tabIds.indexOf(preferred);
        if (idx !== -1) {
          const tab = document.getElementById(tabIds[idx]);
          const sec = document.getElementById(secIds[idx]);
          if (tab.style.display !== "none") {
            tab.classList.add("active");
            sec.classList.remove("hidden");
            activated = true;
          }
        }
      }

      // Fall back to the first visible tab if there's no saved tab,
      // or the saved tab is no longer visible (its feature got disabled)
      if (!activated) {
        for (let i = 0; i < tabIds.length; i++) {
          const tab = document.getElementById(tabIds[i]);
          const sec = document.getElementById(secIds[i]);

          if (tab.style.display !== "none") {
            tab.classList.add("active");      // highlight the tab button
            sec.classList.remove("hidden");   // show its section
            break;                            // stop after the first visible one
          }
        }
      }

      // Load the content for whichever tab ended up active, since we
      // didn't get here via a click (so the click handlers never ran).
      if (document.getElementById("tab-bookmarks").classList.contains("active")) {
        loadBookmarks();
      }
      if (document.getElementById("tab-history").classList.contains("active")) {
        loadHistory();
        loadNoteForCurrentPage();
      }
      if (document.getElementById("tab-ai").classList.contains("active")) {
        chrome.storage.sync.get("geminiApiKey", function (r) {
          document.getElementById("ai-no-key-warning").style.display = r.geminiApiKey ? "none" : "block";
        });
      }
    });

    // Edge case: if ALL features are disabled, show a friendly message
    // Bug fix: this used to look for ".tabs", a class that only existed in
    // the old top-tabs layout. The new sidebar layout uses ".app-shell", so
    // the old selector returned null and calling .style.display on it would
    // throw an error, silently breaking the popup for anyone with every
    // feature toggled off.
    const allOff = !scraperOn && !bookmarksOn && !aiOn && !historyOn;
    if (allOff) {
      const shell = document.querySelector(".app-shell");
      shell.style.display = "none";
      const msg = document.createElement("p");
      msg.style.cssText = "text-align:center; color:var(--text-secondary); font-size:13px; padding:20px;";
      msg.textContent = "All features are disabled. Open ⚙️ Settings to turn them back on.";
      shell.insertAdjacentElement("afterend", msg);
    }

  }
);













  // ══════════════════════════════════════════════
  //              TAB SWITCHING
  // ══════════════════════════════════════════════

  const tabScraper   = document.getElementById("tab-scraper");
  const tabBookmarks = document.getElementById("tab-bookmarks");
  const secScraper   = document.getElementById("section-scraper");
  const secBookmarks = document.getElementById("section-bookmarks");
  const tabAI        = document.getElementById("tab-ai");
  const secAI        = document.getElementById("section-ai");

  tabScraper.addEventListener("click", function () {
    secScraper.classList.remove("hidden");
    secBookmarks.classList.add("hidden");
    tabScraper.classList.add("active");
    tabBookmarks.classList.remove("active");
    secAI.classList.add("hidden");
    tabAI.classList.remove("active");
     document.getElementById("section-history").classList.add("hidden");
     document.getElementById("tab-history").classList.remove("active");
     chrome.storage.local.set({ lastActiveTab: "tab-scraper" });
  });

  tabBookmarks.addEventListener("click", function () {
    secBookmarks.classList.remove("hidden");
    secScraper.classList.add("hidden");
    tabBookmarks.classList.add("active");
    tabScraper.classList.remove("active");
    secAI.classList.add("hidden");
    tabAI.classList.remove("active");
    document.getElementById("section-history").classList.add("hidden");
    document.getElementById("tab-history").classList.remove("active");
    chrome.storage.local.set({ lastActiveTab: "tab-bookmarks" });

    loadBookmarks();
  });

   // history tab click handler

                        document.getElementById("tab-history").addEventListener("click", function () {
                          document.getElementById("section-history").classList.remove("hidden");
                          document.getElementById("section-scraper").classList.add("hidden");
                          document.getElementById("section-bookmarks").classList.add("hidden");
                          document.getElementById("section-ai").classList.add("hidden");
                          document.querySelectorAll(".tab-btn").forEach(b => b.classList.remove("active"));
                          document.getElementById("tab-history").classList.add("active");
                          chrome.storage.local.set({ lastActiveTab: "tab-history" });

                          loadHistory();
                          loadNoteForCurrentPage();
                        });


  // ══════════════════════════════════════════════
  //              SCRAPER SECTION
  // ══════════════════════════════════════════════

  const resultsBox = document.getElementById("results-box");
  const exportRow  = document.getElementById("export-row");

  // Pages the scraper refuses to touch (Chrome blocks content-script
  // injection into these anyway). Pulled into its own function so both
  // scrapeData() and scrapePageStats() share one definition, and so the
  // test suite can verify this edge case directly.
  function isRestrictedUrl(url) {
    url = url || "";
    return url.startsWith("chrome://") ||
           url.startsWith("chrome-extension://") ||
           url.startsWith("https://chrome.google.com");
  }

  function scrapeData(action) {
    resultsBox.innerHTML = "<p class='placeholder'>⏳ Scraping...</p>";
    exportRow.style.display = "none";
    lastScrapedData = [];

    chrome.tabs.query({ active: true, currentWindow: true }, function (tabs) {
      if (!tabs || tabs.length === 0) {
        showScraperError("Could not find active tab.");
        return;
      }

      const tabId  = tabs[0].id;
      const tabUrl = tabs[0].url || "";

      if (isRestrictedUrl(tabUrl)) {
        showScraperError("❌ Can't scrape Chrome pages.\n\nVisit a normal website first.");
        return;
      }

      // Step 1: Inject content.js into the page
      chrome.scripting.executeScript(
        {
          target: { tabId: tabId },
          files: ["content.js"]
        },
        function () {

          if (chrome.runtime.lastError) {
            showScraperError("❌ Injection failed: " + chrome.runtime.lastError.message);
            return;
          }

          // Step 2: Wait 50ms for content.js to fully finish loading
          // then send the scrape request
          // 50ms is tiny — user won't notice — but enough for content.js to be ready
          setTimeout(function () {

            chrome.tabs.sendMessage(tabId, { action: action }, function (response) {

              if (chrome.runtime.lastError) {
                showScraperError("❌ " + chrome.runtime.lastError.message);
                return;
              }

              if (response && response.data && response.data.length > 0) {
                lastScrapedData   = response.data;
                lastScrapedAction = action;
                displayScraperResults(response.data);
                exportRow.style.display = "flex";
                document.getElementById("rescrape-row").style.display = "flex";
                saveToHistory(tabs[0].url, tabs[0].title, action, response.data);
              } else {
                resultsBox.innerHTML = "<p class='placeholder'>⚠️ Nothing found.</p>";
              }
            });

          }, 50); // 50 milliseconds — tiny but enough
        }
      );
    });
  }


  function displayScraperResults(dataArray) {
  resultsBox.innerHTML = "";

  const count = document.createElement("p");
  count.style.cssText = "font-size:11px; color:var(--text-secondary); margin-bottom:6px;";
  count.textContent = "✅ Found " + dataArray.length + " result(s):";
  resultsBox.appendChild(count);

  dataArray.forEach(function (item) {
    const div = document.createElement("div");
    div.className = "result-item";

    // Try to pull a URL out of this item string.
    // Our scraper formats links as:  "Link Text  →  https://..."
    // and images as:                 "Alt text  →  https://..."
    // So we split on "  →  " and check if the second part starts with http.
    const parts = item.split("  →  ");
    // parts[0] = the label text (link text or alt text)
    // parts[1] = the URL (or undefined if this wasn't a link/image item)

    const url = parts[1] && parts[1].startsWith("http") ? parts[1].trim() : null;
    // If parts[1] exists AND starts with "http", we have a real URL.
    // Otherwise url is null — meaning this is a title or heading, not a link.

    if (url) {
      // ── This item has a URL — make it clickable ──────────────────────

      const label = document.createElement("span");
      label.textContent = parts[0] || url;
      // Show the label text if it exists, otherwise just show the URL itself.
      // This handles cases where the link had no visible text.

      label.style.cssText = "flex:1; overflow:hidden; text-overflow:ellipsis; white-space:nowrap;";
      // flex:1 makes the label take all available space
      // text-overflow:ellipsis cuts off long text with "..." instead of wrapping

      const urlSpan = document.createElement("span");
      urlSpan.textContent = parts[1].length > 40 ? parts[1].slice(0, 40) + "…" : parts[1];
      // Show the URL underneath, but truncate it if it's longer than 40 characters.
      // We don't want a 200-character URL breaking the layout.
      urlSpan.style.cssText = "font-size:10px; color:var(--text-link); opacity:0.7; white-space:nowrap; overflow:hidden; text-overflow:ellipsis;";

      const textCol = document.createElement("div");
      textCol.style.cssText = "display:flex; flex-direction:column; gap:1px; flex:1; overflow:hidden;";
      // A small column that stacks the label on top and URL below it
      textCol.appendChild(label);
      textCol.appendChild(urlSpan);

      const openBtn = document.createElement("button");
      openBtn.textContent = "↗";
      openBtn.title = "Open in new tab";
      // title= adds a native browser tooltip on hover — free UX, zero work
      openBtn.style.cssText = "background:none; border:1.5px solid var(--border-color); border-radius:6px; padding:2px 7px; cursor:pointer; font-size:12px; color:var(--text-link); flex-shrink:0; transition:all 0.15s;";
      openBtn.addEventListener("mouseenter", function () {
        this.style.background = "var(--accent)";
        this.style.color = "white";
        this.style.borderColor = "var(--accent)";
      });
      openBtn.addEventListener("mouseleave", function () {
        this.style.background = "none";
        this.style.color = "var(--text-link)";
        this.style.borderColor = "var(--border-color)";
      });
      // mouseenter/mouseleave give us hover styling on a dynamically created button.
      // We can't use CSS :hover here because this element doesn't have a class —
      // it's created in JavaScript. We could add a class, but inline hover via
      // JS events works fine for small cases like this.

      openBtn.addEventListener("click", function () {
        chrome.tabs.create({ url: url });
        // chrome.tabs.create opens a new tab with the given URL.
        // This is the Chrome Extension way — you can't just do window.open()
        // reliably inside an extension popup.
      });

      div.style.cssText = "display:flex; align-items:center; gap:8px; cursor:default;";
      div.appendChild(textCol);
      div.appendChild(openBtn);

      // Also make clicking the label text open the link
      textCol.style.cursor = "pointer";
      textCol.addEventListener("click", function () {
        chrome.tabs.create({ url: url });
      });

    } else {
      // ── No URL found — render as plain text (titles, headings) ───────
      div.textContent = item;
      // Nothing special needed. Titles and headings are just text.
    }

    resultsBox.appendChild(div);
  });
}











  function showScraperError(msg) {
    resultsBox.innerHTML = "";
    const p = document.createElement("p");
    p.style.cssText = "color:red; font-size:12px; white-space:pre-wrap; line-height:1.6;";
    p.textContent = msg;
    resultsBox.appendChild(p);
  }

  document.getElementById("scrape-title").addEventListener("click", function () {
    scrapeData("scrape-title");
  });
  document.getElementById("scrape-links").addEventListener("click", function () {
    scrapeData("scrape-links");
  });
  document.getElementById("scrape-headings").addEventListener("click", function () {
    scrapeData("scrape-headings");
  });
  document.getElementById("scrape-images").addEventListener("click", function () {
    scrapeData("scrape-images");
  });

  // Shared reset used by both the "Clear Results" button and the
  // Escape key shortcut (Task 3E), so they stay perfectly in sync.
  function resetScraperResults() {
    resultsBox.innerHTML = "<p class='placeholder'>Results will appear here...</p>";
    exportRow.style.display = "none";
    document.getElementById("rescrape-row").style.display = "none";
    lastScrapedData = [];
    lastScrapedAction = "";
  }

  document.getElementById("clear-results").addEventListener("click", function () {
    resetScraperResults();
  });

  // ══════════════════════════════════════════════
  //   📊 PAGE STATS (Task 3A)
  // ══════════════════════════════════════════════
  function scrapePageStats() {
    resultsBox.innerHTML = "<p class='placeholder'>⏳ Scraping...</p>";
    exportRow.style.display = "none";
    document.getElementById("rescrape-row").style.display = "none";

    chrome.tabs.query({ active: true, currentWindow: true }, function (tabs) {
      if (!tabs || tabs.length === 0) {
        showScraperError("Could not find active tab.");
        return;
      }

      const tabId  = tabs[0].id;
      const tabUrl = tabs[0].url || "";

      if (isRestrictedUrl(tabUrl)) {
        showScraperError("❌ Can't scrape Chrome pages.\n\nVisit a normal website first.");
        return;
      }

      chrome.scripting.executeScript(
        { target: { tabId: tabId }, files: ["content.js"] },
        function () {
          if (chrome.runtime.lastError) {
            showScraperError("❌ Injection failed: " + chrome.runtime.lastError.message);
            return;
          }

          setTimeout(function () {
            chrome.tabs.sendMessage(tabId, { action: "scrape-stats" }, function (response) {
              if (chrome.runtime.lastError) {
                showScraperError("❌ " + chrome.runtime.lastError.message);
                return;
              }
              if (!response || !response.data) {
                resultsBox.innerHTML = "<p class='placeholder'>⚠️ Nothing found.</p>";
                return;
              }

              lastScrapedAction = "scrape-stats";
              displayPageStats(response.data);
              document.getElementById("rescrape-row").style.display = "flex";
            });
          }, 50);
        }
      );
    });
  }

  function displayPageStats(stats) {
    resultsBox.innerHTML = "";
    const grid = document.createElement("div");
    grid.className = "stats-summary-grid";

    const tiles = [
      { label: "📝 Words",    value: stats.words },
      { label: "🖼️ Images",   value: stats.images },
      { label: "🔗 Links",    value: stats.links },
      { label: "📌 Headings", value: stats.headings }
    ];

    tiles.forEach(function (t) {
      const tile = document.createElement("div");
      tile.className = "stat-tile";

      const val = document.createElement("div");
      val.className = "stat-value";
      val.textContent = t.value;

      const lab = document.createElement("div");
      lab.className = "stat-label";
      lab.textContent = t.label;

      tile.appendChild(val);
      tile.appendChild(lab);
      grid.appendChild(tile);
    });

    resultsBox.appendChild(grid);
  }

  document.getElementById("scrape-stats").addEventListener("click", function () {
    scrapePageStats();
  });

  // ══════════════════════════════════════════════
  //   🔄 RE-SCRAPE (Task 3A) — repeats the last action instantly
  // ══════════════════════════════════════════════
  document.getElementById("re-scrape-btn").addEventListener("click", function () {
    if (!lastScrapedAction) return;
    if (lastScrapedAction === "scrape-stats") {
      scrapePageStats();
    } else {
      scrapeData(lastScrapedAction);
    }
  });


  // ══════════════════════════════════════════════
  //         EXPORT SCRAPED DATA
  // ══════════════════════════════════════════════

  // Helper: trigger a file download in the browser
  // content = the text content of the file
  // filename = what to name the downloaded file
  // mimeType = the file type (text/csv or application/json)
  // Bug fix: the HTML export functions below used to insert scraped text /
  // bookmark titles straight into the HTML string. A page title containing
  // "<" or "&" would corrupt the exported file (or, worse, embed a working
  // <script> tag that runs when the file is opened). Escaping fixes that.
  function escapeHtml(str) {
    return String(str)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  function downloadFile(content, filename, mimeType) {

    // Create a "Blob" — a chunk of data treated as a file
    const blob = new Blob([content], { type: mimeType });

    // Create a temporary invisible link pointing to the blob
    const url  = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href     = url;
    link.download = filename; // This tells browser to download, not navigate

    // Programmatically click the link to start download
    link.click();

    // Clean up — revoke the temporary URL to free memory
    URL.revokeObjectURL(url);
  }

  // These builder functions are pulled out of the click handlers so the
  // test suite (tests.js) can call the exact same code the app uses,
  // instead of a guessed re-implementation.
  function buildCsvExport(dataArray) {
    // CSV format: first row is the header, then one item per row
    // We wrap each value in quotes to handle commas inside values
    const header = "data\n";
    const rows   = dataArray
      .map(function (item) {
        // Escape any quotes inside the value by doubling them
        return '"' + item.replace(/"/g, '""') + '"';
      })
      .join("\n");
    return header + rows;
  }

  function buildScrapedHtmlExport(dataArray) {
    let html = "<!DOCTYPE html><html><head><meta charset='UTF-8'><title>Exported Data</title>";
    html += "<style>body{font-family:sans-serif;padding:20px;}h1{color:#333;}ul{list-style-type:none;padding:0;}li{background:#f0f0f0;margin:5px 0;padding:10px;border-radius:4px;}</style>";
    html += "</head><body>";
    html += "<h1>Exported Data (" + dataArray.length + " items)</h1><ul>";
    dataArray.forEach(function (item) {
      html += "<li>" + escapeHtml(item) + "</li>";
    });
    html += "</ul></body></html>";
    return html;
  }

  function buildJsonExport(dataArray, action) {
    // Build a nice object with metadata
    const exportObj = {
      exportedAt: new Date().toISOString(), // current date/time
      action:     action,
      count:      dataArray.length,
      data:       dataArray
    };
    // JSON.stringify converts JS object → JSON string
    // The '2' means indent with 2 spaces (pretty print)
    return JSON.stringify(exportObj, null, 2);
  }

  // Export as CSV (comma-separated values — opens in Excel/Sheets)
  document.getElementById("export-csv").addEventListener("click", function () {
    if (lastScrapedData.length === 0) return;
    const csvContent = buildCsvExport(lastScrapedData);
    const filename    = lastScrapedAction + "-" + Date.now() + ".csv";
    downloadFile(csvContent, filename, "text/csv");
  });

  // Export as HTML (a simple webpage showing the results in list form)
  document.getElementById("export-html").addEventListener("click", function () {
    if (lastScrapedData.length === 0) return;
    const html     = buildScrapedHtmlExport(lastScrapedData);
    const filename = lastScrapedAction + "-" + Date.now() + ".html";
    downloadFile(html, filename, "text/html");
  });

  // Export as JSON (structured data — useful for developers)
  document.getElementById("export-json").addEventListener("click", function () {
    if (lastScrapedData.length === 0) return;
    const jsonContent = buildJsonExport(lastScrapedData, lastScrapedAction);
    const filename    = lastScrapedAction + "-" + Date.now() + ".json";
    downloadFile(jsonContent, filename, "application/json");
  });


  // ══════════════════════════════════════════════
  //           BOOKMARKS SECTION
  // ══════════════════════════════════════════════

  const bookmarkList = document.getElementById("bookmark-list");
  const searchInput  = document.getElementById("search-input");

  // Recursively turns Chrome's nested bookmark tree into a flat array of
  // { id, title, url, folder } objects. Pulled out to its own top-level
  // function (it used to be defined inline inside loadBookmarks) so the
  // test suite can call it directly with fake tree data.
  function flattenBookmarkTree(nodes, folderPath) {
    const result = [];
    (nodes || []).forEach(function (node) {
      if (node.url) {
        result.push({
          id:     node.id,
          title:  node.title || "Untitled",
          url:    node.url,
          folder: folderPath
        });
      } else if (node.children) {
        const thisFolderName = node.title || "Folder";
        const newPath = folderPath === ""
          ? thisFolderName
          : folderPath + " > " + thisFolderName;
        result.push.apply(result, flattenBookmarkTree(node.children, newPath));
      }
    });
    return result;
  }

  function loadBookmarks() {
    bookmarkList.innerHTML = "<p class='placeholder'>⏳ Loading...</p>";

    chrome.bookmarks.getTree(function (treeNodes) {
      bookmarkList.innerHTML = "";
      const allBookmarks = flattenBookmarkTree(treeNodes[0].children, "");

      // ── 📊 STATS LINE (Task 3B) — total bookmarks + folder count ──
      const folderCount = new Set(allBookmarks.map(function (bm) { return bm.folder; })).size;
      const statsEl = document.getElementById("bookmark-stats");
      statsEl.textContent = allBookmarks.length === 0
        ? ""
        : "📊 " + allBookmarks.length + " bookmark" + (allBookmarks.length === 1 ? "" : "s") +
          " in " + folderCount + " folder" + (folderCount === 1 ? "" : "s");

      if (allBookmarks.length === 0) {
        bookmarkList.innerHTML = "<p class='placeholder'>No bookmarks found.</p>";
        return;
      }

      renderBookmarkList(allBookmarks);
      bookmarkList._allBookmarks = allBookmarks;
    });
  }

  function renderBookmarkList(bookmarks) {
    bookmarkList.innerHTML = "";

    if (bookmarks.length === 0) {
      bookmarkList.innerHTML = "<p class='placeholder'>No results found.</p>";
      return;
    }

    let currentFolder = "";

    bookmarks.forEach(function (bm) {
      if (bm.folder !== currentFolder) {
        currentFolder = bm.folder;
        const folderDiv = document.createElement("div");
        folderDiv.className = "bookmark-folder";
        folderDiv.textContent = "📁 " + currentFolder;
        bookmarkList.appendChild(folderDiv);
      }

      const item = document.createElement("div");
      item.className = "bookmark-item";

      const link = document.createElement("span");
      link.className   = "bookmark-link";
      link.textContent = bm.title;
      link.title       = bm.url;
      link.addEventListener("click", function () {
        chrome.tabs.create({ url: bm.url });
      });

      const deleteBtn = document.createElement("button");
      deleteBtn.className   = "bookmark-delete";
      deleteBtn.textContent = "✕";
      deleteBtn.addEventListener("click", function () {
        deleteBookmark(bm.id, item);
      });

      item.appendChild(link);
      item.appendChild(deleteBtn);
      bookmarkList.appendChild(item);
    });
  }

  // Task 3B — pressing Enter in the title input adds the bookmark too
  document.getElementById("bookmark-title-input").addEventListener("keydown", function (e) {
    if (e.key === "Enter") {
      document.getElementById("btn-add-bookmark").click();
    }
  });

  document.getElementById("btn-add-bookmark").addEventListener("click", function () {
    chrome.tabs.query({ active: true, currentWindow: true }, function (tabs) {
      if (!tabs || tabs.length === 0) return;
      const tab         = tabs[0];
      const titleInput  = document.getElementById("bookmark-title-input");
      const customTitle = titleInput.value.trim();
      const bookmarkTitle = customTitle || tab.title || "Untitled";
      const bookmarkUrl   = tab.url;

      if (!bookmarkUrl || bookmarkUrl.startsWith("chrome://")) {
        showStatus("❌ Can't bookmark this page.", "error");
        return;
      }

      chrome.bookmarks.create({ title: bookmarkTitle, url: bookmarkUrl },
        function (newBookmark) {
          titleInput.value = "";
          showStatus("✅ Bookmarked: " + newBookmark.title, "success");
          loadBookmarks();
        }
      );
    });
  });

  function deleteBookmark(bookmarkId, rowElement) {
    chrome.bookmarks.remove(bookmarkId, function () {
      if (chrome.runtime.lastError) {
        showStatus("❌ Could not delete.", "error");
        return;
      }
      rowElement.style.transition = "opacity 0.3s";
      rowElement.style.opacity    = "0";
      setTimeout(function () { rowElement.remove(); }, 300);
      showStatus("🗑️ Bookmark deleted.", "success");
    });
  }

  // Pulled into its own function so tests.js can verify the filtering
  // logic directly with fake bookmark data.
  function filterBookmarks(list, query) {
    const q = (query || "").toLowerCase().trim();
    if (q === "") return list;
    return list.filter(function (bm) {
      return bm.title.toLowerCase().includes(q) ||
             bm.url.toLowerCase().includes(q);
    });
  }

  searchInput.addEventListener("input", function () {
    const all = bookmarkList._allBookmarks || [];
    renderBookmarkList(filterBookmarks(all, searchInput.value));
  });

  document.getElementById("btn-refresh").addEventListener("click", function () {
    searchInput.value = "";
    loadBookmarks();
  });


  // ══════════════════════════════════════════════
  //         EXPORT BOOKMARKS
  // ══════════════════════════════════════════════

  // Standard Netscape Bookmark File Format — all browsers understand this
  function buildBookmarkHtmlExport(bookmarks) {
    let html = '<!DOCTYPE NETSCAPE-Bookmark-file-1>\n';
    html += '<META HTTP-EQUIV="Content-Type" CONTENT="text/html; charset=UTF-8">\n';
    html += '<TITLE>Bookmarks</TITLE>\n';
    html += '<H1>Bookmarks</H1>\n';
    html += '<DL><p>\n';
    bookmarks.forEach(function (bm) {
      html += '  <DT><A HREF="' + escapeHtml(bm.url) + '">' + escapeHtml(bm.title) + '</A>\n';
    });
    html += '</DL><p>';
    return html;
  }

  function buildBookmarkJsonExport(bookmarks) {
    const exportObj = {
      exportedAt: new Date().toISOString(),
      count:      bookmarks.length,
      bookmarks:  bookmarks
    };
    return JSON.stringify(exportObj, null, 2);
  }

  // Export bookmarks as HTML (this format can be IMPORTED into any browser!)
  document.getElementById("export-bm-html").addEventListener("click", function () {
    const all = bookmarkList._allBookmarks || [];
    if (all.length === 0) {
      showStatus("⚠️ No bookmarks to export.", "error");
      return;
    }
    const html = buildBookmarkHtmlExport(all);
    downloadFile(html, "bookmarks-" + Date.now() + ".html", "text/html");
    showStatus("✅ Bookmarks exported as HTML!", "success");
  });

  // Export bookmarks as JSON
  document.getElementById("export-bm-json").addEventListener("click", function () {
    const all = bookmarkList._allBookmarks || [];
    if (all.length === 0) {
      showStatus("⚠️ No bookmarks to export.", "error");
      return;
    }
    const jsonContent = buildBookmarkJsonExport(all);
    downloadFile(jsonContent, "bookmarks-" + Date.now() + ".json", "application/json");
    showStatus("✅ Bookmarks exported as JSON!", "success");
  });


  // ══════════════════════════════════════════════
  //              STATUS HELPER
  // ══════════════════════════════════════════════

  function showStatus(message, type) {
    const existing = document.querySelector(".status-msg");
    if (existing) existing.remove();

    const div = document.createElement("div");
    div.className   = "status-msg " + type;
    div.textContent = message;

    const section = document.getElementById("section-bookmarks");
    section.insertBefore(div, section.firstChild);

    setTimeout(function () { div.remove(); }, 3000);
  }
          /////////////////////////  AI SECTION: API KEY STORAGE
          ////////////////////////////
          ////////////////////////


                              // This array stores the entire conversation
                    // It starts empty every time the popup opens
                    let conversationHistory = [];
                    let pageContext = "";
                    // Task 3C — state needed for the copy/regenerate/word-counter features
                    let lastAIResponse  = "";
                    let lastActionType  = "";   // "summarize" or "ask"
                    let lastQuestionText = "";

                    function updateContextWordCounter() {
                      const el = document.getElementById("context-word-count");
                      if (!el) return;
                      if (!pageContext) { el.textContent = ""; return; }
                      const words = pageContext.trim().split(/\s+/).filter(Boolean).length;
                      el.textContent = "📄 Page context: " + words + " words";
                    }





                        ///===============================
                        // new code 
                        // ── CHECK FOR API KEY WHEN AI TAB IS CLICKED ──────────────
                        
                          document.getElementById("tab-ai").addEventListener("click", function () {
                            document.getElementById("section-scraper").classList.add("hidden");
                            document.getElementById("section-bookmarks").classList.add("hidden");
                            document.getElementById("section-ai").classList.remove("hidden");
                             document.getElementById("section-history").classList.add("hidden");
                            document.querySelectorAll(".tab-btn").forEach(function (btn) {
                              btn.classList.remove("active");
                            });
                            document.getElementById("tab-ai").classList.add("active");
                            chrome.storage.local.set({ lastActiveTab: "tab-ai" });

                            // Check if API key exists — show warning if not
                            chrome.storage.sync.get("geminiApiKey", function (result) {
                              const warning = document.getElementById("ai-no-key-warning");
                              if (!result.geminiApiKey) {
                                warning.style.display = "block";   // show the red warning
                              } else {
                                warning.style.display = "none";    // hide it if key exists
                              }
                            });
                          });

                          // ── "Open Settings" LINK inside the warning ───────────────
                          document.getElementById("link-to-settings").addEventListener("click", function () {
                            chrome.runtime.openOptionsPage();
                          });








                  /////////////////////////////
                  ///////       CALL API 
                  /////////////////////////////              
                                        // Builds one Gemini "contents" entry. Pulled out to its own
                                        // function so the test suite can verify the exact shape
                                        // callGeminiAPI pushes into conversationHistory.
                                        function buildHistoryEntry(role, text) {
                                          return { role: role, parts: [{ text: text }] };
                                        }

                                        async function callGeminiAPI(newUserMessage) {
                          const result = await chrome.storage.sync.get("geminiApiKey");
                          const apiKey = result.geminiApiKey;

                          if (!apiKey) {
                            return "❌ No API key saved. Please paste your Gemini API key and save it.";
                          }

                          // Step 1: Add the new user message to history
                          conversationHistory.push(buildHistoryEntry("user", newUserMessage));

                          // Step 2: Send the ENTIRE history to Gemini
                          const response = await fetch(
                            `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-lite:generateContent?key=${apiKey}`,
                            {
                              method: "POST",
                              headers: { "Content-Type": "application/json" },
                              body: JSON.stringify({
                                contents: conversationHistory
                              })
                            }
                          );

                          if (!response.ok) {
                            const err = await response.text();
                            // Remove the message we just pushed since it failed
                            conversationHistory.pop();
                            return "❌ HTTP Error: " + err;
                          }

                          const data = await response.json();

                          try {
                            const aiReply = data.candidates[0].content.parts[0].text;

                            // Step 3: Add AI reply to history too
                            conversationHistory.push(buildHistoryEntry("model", aiReply));

                            return aiReply;

                          } catch (e) {
                            conversationHistory.pop();
                            return "❌ Error: " + JSON.stringify(data);
                          }
                        }

                                      //button click handler
                                      ///////
                                      ///////
                                    // summarize button
                            async function runSummarize() {
                              const box = document.getElementById("ai-results-box");

                              try {
                                const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });

                                await chrome.scripting.executeScript({
                                  target: { tabId: tab.id },
                                  files: ["content.js"]
                                });

                                await new Promise(resolve => setTimeout(resolve, 50));

                                const response = await new Promise(function (resolve) {
                                  chrome.tabs.sendMessage(tab.id, { action: "scrape-text" }, function (res) {
                                    resolve(res);
                                  });
                                });

                                if (!response || !response.data) {
                                  box.innerHTML = "<p>❌ Could not scrape page text.</p>";
                                  return;
                                }

                                // Save page text so Ask button can reuse it without re-scraping
                                pageContext = response.data;
                                updateContextWordCounter();
                                lastActionType = "summarize";

                                const prompt = `Please summarize this webpage content in 3-5 clear bullet points. Be concise and focus on the main ideas.

                            Page content:
                            ${pageContext}`;

                                // Show user's request as a chat bubble
                                addMessageToDisplay("user", "✨ Summarize this page");

                                // Show loading inside the box AFTER the user bubble
                                const loadingP = document.createElement("p");
                                loadingP.classList.add("placeholder");
                                loadingP.id = "loading-msg";
                                loadingP.textContent = "⏳ Thinking...";
                                box.appendChild(loadingP);
                                box.scrollTop = box.scrollHeight;

                                const summary = await callGeminiAPI(prompt);

                                // Remove loading message
                                const loading = document.getElementById("loading-msg");
                                if (loading) loading.remove();

                                addMessageToDisplay("ai", summary);

                              } catch (err) {
                                box.innerHTML = "<p>❌ Something went wrong: " + err.message + "</p>";
                              }
                            }

                            document.getElementById("btn-summarize").addEventListener("click", runSummarize);
                /////////////ASK A QUESTION BUTTON
                ////////////////////
                /////////////////////

                      //   ask button
                    // Only the FIRST question in a conversation needs the page content —
                    // after that, Gemini already has it from conversation history.
                    // Pulled out to its own function so the test suite can verify this
                    // "first message vs. follow-up" behavior directly.
                    function buildAskPrompt(question, currentPageContext, historyLength) {
                      if (historyLength === 0) {
                        return `Here is the content of a webpage:

                    ${currentPageContext}

                    Based only on this content, please answer:
                    ${question}`;
                      }
                      return question;
                    }

                    // isRegenerate=true skips re-adding a duplicate user bubble
                    // and skips clearing the input — used by the 🔁 Regenerate button.
                    async function runAsk(question, isRegenerate) {
                      if (!question) {
                        alert("Please type a question first.");
                        return;
                      }

                      const box = document.getElementById("ai-results-box");

                      try {
                        // If no page has been scraped yet, scrape it now
                        if (!pageContext) {
                          const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });

                          await chrome.scripting.executeScript({
                            target: { tabId: tab.id },
                            files: ["content.js"]
                          });

                          await new Promise(resolve => setTimeout(resolve, 50));

                          const response = await new Promise(function (resolve) {
                            chrome.tabs.sendMessage(tab.id, { action: "scrape-text" }, function (res) {
                              resolve(res);
                            });
                          });

                          if (!response || !response.data) {
                            box.innerHTML = "<p>❌ Could not read page.</p>";
                            return;
                          }

                          pageContext = response.data;
                          updateContextWordCounter();
                        }

                        lastActionType   = "ask";
                        lastQuestionText = question;

                        if (!isRegenerate) {
                          // Show user's question as a bubble immediately
                          addMessageToDisplay("user", question);
                          // Clear the input box
                          document.getElementById("question-input").value = "";
                        }

                        // Show loading
                        const loadingP = document.createElement("p");
                        loadingP.classList.add("placeholder");
                        loadingP.id = "loading-msg";
                        loadingP.textContent = "⏳ Thinking...";
                        box.appendChild(loadingP);
                        box.scrollTop = box.scrollHeight;

                        // Build prompt — only include page context on the FIRST question
                        // After that, Gemini already has it in conversation history
                        const prompt = buildAskPrompt(question, pageContext, conversationHistory.length);

                        const answer = await callGeminiAPI(prompt);

                        const loading = document.getElementById("loading-msg");
                        if (loading) loading.remove();

                        addMessageToDisplay("ai", answer);

                      } catch (err) {
                        box.innerHTML = "<p>❌ Something went wrong: " + err.message + "</p>";
                      }
                    }

                    document.getElementById("btn-ask").addEventListener("click", function () {
                      const question = document.getElementById("question-input").value.trim();
                      runAsk(question, false);
                    });

                    // ── 🔁 REGENERATE (Task 3C) ───────────────────────────────
                    document.getElementById("btn-regenerate").addEventListener("click", function () {
                      if (lastActionType === "summarize") {
                        runSummarize();
                      } else if (lastActionType === "ask" && lastQuestionText) {
                        runAsk(lastQuestionText, true);
                      } else {
                        showToast("Nothing to regenerate yet");
                      }
                    });

                    // ── 📋 COPY LAST RESPONSE (Task 3C) ───────────────────────
                    document.getElementById("btn-copy-response").addEventListener("click", async function () {
                      if (!lastAIResponse) {
                        showToast("No response yet");
                        return;
                      }
                      try {
                        await navigator.clipboard.writeText(lastAIResponse);
                      } catch (e) {
                        // Fallback for contexts where the Clipboard API is unavailable
                        const ta = document.createElement("textarea");
                        ta.value = lastAIResponse;
                        document.body.appendChild(ta);
                        ta.select();
                        document.execCommand("copy");
                        ta.remove();
                      }
                      showToast("✅ copied!");
                    });

                    // chat message display 
                                              function addMessageToDisplay(role, text) {
                            const box = document.getElementById("ai-results-box");

                            // Remove the placeholder text the first time a message appears
                            const placeholder = box.querySelector(".placeholder");
                            if (placeholder) {
                              placeholder.remove();
                            }

                            // Create the message bubble container
                            const messageDiv = document.createElement("div");
                            messageDiv.classList.add("chat-message");
                            messageDiv.classList.add(role === "user" ? "user-message" : "ai-message");

                            // Create the label (You / AI)
                            const labelSpan = document.createElement("span");
                            labelSpan.classList.add("message-label");
                            labelSpan.textContent = role === "user" ? "🧑 You" : "🤖 AI";

                            // Create the text bubble
                            const textP = document.createElement("p");
                            textP.style.whiteSpace = "pre-wrap";
                            textP.textContent = text;

                            // Put label and text inside the bubble
                            messageDiv.appendChild(labelSpan);
                            messageDiv.appendChild(textP);

                            // Put the bubble in the results box
                            box.appendChild(messageDiv);

                            // Remember the latest AI reply for the "📋 Copy Last Response" button
                            if (role === "ai") {
                              lastAIResponse = text;
                            }

                            // Auto-scroll to the bottom so user always sees the latest message
                            box.scrollTop = box.scrollHeight;
                          }



                          // Clear chat button
                          document.getElementById("btn-clear-chat").addEventListener("click", function () {
                            // Empty the history array
                            conversationHistory = [];
                            pageContext = "";
                            lastAIResponse   = "";
                            lastActionType   = "";
                            lastQuestionText = "";
                            updateContextWordCounter();

                            // Clear the display
                            document.getElementById("ai-results-box").innerHTML =
                              "<p class='placeholder'>AI response will appear here...</p>";
                          });





                          // ── OPEN SETTINGS PAGE ──────────────────────────────────────
                          // chrome.runtime.openOptionsPage() is a built-in Chrome function
                          // It opens whatever page is registered as options_page in manifest.json
                          // We don't have to know the URL — Chrome handles it

                          document.getElementById("btn-open-settings").addEventListener("click", function () {
                            chrome.runtime.openOptionsPage();
                          });




                          //===========================
                          //===========================
                          // HISTORY FUNCTION

                          function saveToHistory(pageUrl, pageTitle, action, dataArray) {
                          // Create a key unique to this page
                          const storageKey = "history:" + pageUrl;

                          // First, read whatever we already saved for this page
                          chrome.storage.local.get(storageKey, function (result) {
                            // If nothing saved yet, start with an empty array
                            const existing = result[storageKey] || [];

                            // Build the new entry
                            const entry = {
                              action:    action,
                              count:     dataArray.length,
                              timestamp: Date.now(),      // milliseconds since 1970 — we'll convert to human-readable later
                              data:      dataArray
                            };

                            // Add the new entry at the front (newest first)
                            existing.unshift(entry);

                            // Keep only the last 10 scrapes per page (avoid filling up storage)
                            const trimmed = existing.slice(0, 10);

                            // Save back. We use a computed property [storageKey] to set the key dynamically.
                            const toSave = {};
                            toSave[storageKey] = trimmed;
                            chrome.storage.local.set(toSave);

                            // Also save the page's title so we can display it in the history list
                            chrome.storage.local.set({ ["title:" + pageUrl]: pageTitle || pageUrl });

                            updateHistoryCountBadge();
                          });
                        }

                          //======================================

                          // load note for current page 


                                // ── NOTES SYSTEM ─────────────────────────────────────────
                                let currentPageUrl = "";   // we'll store this once when the History tab opens

                                function loadNoteForCurrentPage() {
                                  chrome.tabs.query({ active: true, currentWindow: true }, function (tabs) {
                                    if (!tabs || tabs.length === 0) return;
                                    currentPageUrl = tabs[0].url;

                                    chrome.storage.local.get("note:" + currentPageUrl, function (result) {
                                      const savedNote = result["note:" + currentPageUrl] || "";
                                      const textarea  = document.getElementById("note-input");
                                      textarea.value  = savedNote;

                                      // Show delete button only if a note exists
                                      updateDeleteNoteButton(savedNote !== "");
                                    });
                                  });
                                }

                                function updateDeleteNoteButton(hasNote) {
                                  const btn = document.getElementById("btn-delete-note");
                                  btn.style.display = hasNote ? "inline-block" : "none";
                                }

                                // Auto-save on every keystroke — professional pattern (like Notion/Google Docs)
                                document.getElementById("note-input").addEventListener("input", function () {
                                  if (!currentPageUrl) return;   // safety check: don't save if we don't know which page

                                  const noteText = this.value;   // "this" inside an event listener = the element that fired the event

                                  chrome.storage.local.set({ ["note:" + currentPageUrl]: noteText }, function () {
                                    const status = document.getElementById("note-save-status");
                                    status.textContent = "✅ Saved";
                                    setTimeout(function () { status.textContent = ""; }, 1500);

                                    // Update delete button visibility based on whether there's any text
                                    updateDeleteNoteButton(noteText.trim() !== "");
                                    loadHistory(); // refreshes the list so the note badge updates live
                                  });
                                });

                                // Delete note button
                                document.getElementById("btn-delete-note").addEventListener("click", function () {
                                  if (!currentPageUrl) return;

                                  chrome.storage.local.remove("note:" + currentPageUrl, function () {
                                    document.getElementById("note-input").value = "";
                                    document.getElementById("note-save-status").textContent = "🗑️ Note deleted";
                                    setTimeout(function () {
                                      document.getElementById("note-save-status").textContent = "";
                                    }, 1500);

                                    updateDeleteNoteButton(false);

                                    // Refresh the history list so the note badge disappears immediately
                                    loadHistory();
                                  });
                                });








                      //================================================
                      //=========================================
                      // load and display history function 




                        function loadHistory() {
                      const historyList = document.getElementById("history-list");
                      historyList.innerHTML = "<p class='placeholder'>⏳ Loading...</p>";

                      // chrome.storage.local.get() with no key returns EVERYTHING stored
                      chrome.storage.local.get(null, function (allData) {
                        // Filter only keys that start with "history:"
                        const historyKeys = Object.keys(allData).filter(function (key) {
                          return key.startsWith("history:");
                        });

                        // Remember the raw data so the search box can re-render without
                        // hitting storage again (Task 3D)
                        historyList._allData      = allData;
                        historyList._historyKeys  = historyKeys;

                        renderHistoryList(historyKeys, allData);
                        updateHistoryCountBadge();
                      });
                    }

                    // Builds the card-based history list (also used by the search filter).
                    // Fixes a bug where history cards used hardcoded light-theme colors
                    // that never adapted to dark mode — now they use CSS classes/variables.
                    function renderHistoryList(historyKeys, allData) {
                      const historyList = document.getElementById("history-list");

                      if (historyKeys.length === 0) {
                        historyList.innerHTML = "<p class='placeholder'>No scraping history yet. Scrape a page first!</p>";
                        return;
                      }

                      historyList.innerHTML = "";

                      // Sort pages by most recently scraped (look at the newest entry in each page's array)
                      const sortedKeys = historyKeys.slice().sort(function (a, b) {
                        const aTime = allData[a][0].timestamp;  // [0] = newest entry (we used unshift)
                        const bTime = allData[b][0].timestamp;
                        return bTime - aTime;                   // descending order (newest first)
                      });

                      sortedKeys.forEach(function (key) {
                        const pageUrl    = key.replace("history:", "");
                        const pageTitle  = allData["title:" + pageUrl] || pageUrl;
                        const entries    = allData[key];          // array of scrape entries
                        const noteKey    = "note:" + pageUrl;
                        const savedNote  = allData[noteKey] || "";

                        // Card for this page
                        const card = document.createElement("div");
                        card.className = "history-card";

                        // Page title (clickable → opens page in new tab)
                        const titleEl = document.createElement("p");
                        titleEl.className = "history-title";
                        titleEl.textContent = pageTitle;
                        titleEl.title       = pageUrl;
                        titleEl.addEventListener("click", function () { chrome.tabs.create({ url: pageUrl }); });
                        card.appendChild(titleEl);

                        // List of scrape entries for this page, each with a timestamp pill badge
                        entries.forEach(function (entry) {
                          const row = document.createElement("div");
                          row.className = "history-entry-row";

                          const text = document.createElement("span");
                          text.className = "history-entry-text";
                          text.textContent = "• " + entry.action + " — " + entry.count + " results";

                          const pill = document.createElement("span");
                          pill.className = "timestamp-pill";
                          pill.textContent = new Date(entry.timestamp).toLocaleString();

                          row.appendChild(text);
                          row.appendChild(pill);
                          card.appendChild(row);
                        });

                        // Note display (if exists)
                        if (savedNote) {
                          const noteEl = document.createElement("p");
                          noteEl.className = "history-note";
                          noteEl.textContent = "📝 " + savedNote;
                          card.appendChild(noteEl);
                        }

                        historyList.appendChild(card);
                      });
                    }

                    // Pulled into its own function so tests.js can verify the
                    // filtering logic directly with fake history data.
                    function filterHistoryKeys(allKeys, allData, query) {
                      const q = (query || "").toLowerCase().trim();
                      if (q === "") return allKeys;
                      return allKeys.filter(function (key) {
                        const pageUrl   = key.replace("history:", "");
                        const pageTitle = (allData["title:" + pageUrl] || pageUrl).toLowerCase();
                        return pageTitle.includes(q) || pageUrl.toLowerCase().includes(q);
                      });
                    }

                    // ── 🔍 SEARCH HISTORY (Task 3D) ─────────────────────────────
                    document.getElementById("history-search-input").addEventListener("input", function () {
                      const historyList = document.getElementById("history-list");
                      const allData  = historyList._allData     || {};
                      const allKeys  = historyList._historyKeys || [];
                      const filtered = filterHistoryKeys(allKeys, allData, this.value);

                      if (filtered.length === 0) {
                        historyList.innerHTML = "<p class='placeholder'>No matching history found.</p>";
                        return;
                      }

                      renderHistoryList(filtered, allData);
                    });

                    // ── 📤 EXPORT HISTORY (Task 3D) ─────────────────────────────
                    document.getElementById("btn-export-history").addEventListener("click", function () {
                      chrome.storage.local.get(null, function (allData) {
                        const historyKeys = Object.keys(allData).filter(function (key) {
                          return key.startsWith("history:");
                        });

                        if (historyKeys.length === 0) {
                          showToast("No history to export");
                          return;
                        }

                        const exportObj = {
                          exportedAt: new Date().toISOString(),
                          pages: historyKeys.map(function (key) {
                            const pageUrl = key.replace("history:", "");
                            return {
                              url:     pageUrl,
                              title:   allData["title:" + pageUrl] || pageUrl,
                              note:    allData["note:" + pageUrl] || "",
                              entries: allData[key]
                            };
                          })
                        };

                        downloadFile(
                          JSON.stringify(exportObj, null, 2),
                          "history-" + Date.now() + ".json",
                          "application/json"
                        );
                        showToast("📤 History exported!");
                      });
                    });

                    //===================================================
                    //===================================
                    // CLEAR ALL HISTORY



                                            document.getElementById("btn-clear-history").addEventListener("click", function () {
                          if (!confirm("Delete all scraping history and notes? This cannot be undone.")) return;

                          chrome.storage.local.get(null, function (allData) {
                            const keysToDelete = Object.keys(allData).filter(function (key) {
                              return key.startsWith("history:") || key.startsWith("note:") || key.startsWith("title:");
                            });

                            chrome.storage.local.remove(keysToDelete, function () {
                              loadHistory();
                              updateHistoryCountBadge();
                            });
                          });
                        });


                        //////=====================================
                        //============================

  // ══════════════════════════════════════════════
  //   TEST HOOKS (Task 2) — exposes real internal functions so the
  //   test suite in tests.js can verify actual app logic instead of a
  //   guessed re-implementation. This has zero effect on normal usage;
  //   it only matters if something reads window.__TEST_HOOKS__.
  // ══════════════════════════════════════════════
  window.__TEST_HOOKS__ = {
    escapeHtml:               escapeHtml,
    buildCsvExport:           buildCsvExport,
    buildJsonExport:          buildJsonExport,
    buildScrapedHtmlExport:   buildScrapedHtmlExport,
    buildBookmarkHtmlExport:  buildBookmarkHtmlExport,
    buildBookmarkJsonExport:  buildBookmarkJsonExport,
    flattenBookmarkTree:      flattenBookmarkTree,
    buildAskPrompt:           buildAskPrompt,
    buildHistoryEntry:        buildHistoryEntry,
    resetScraperResults:      resetScraperResults,
    renderBookmarkList:       renderBookmarkList,
    renderHistoryList:        renderHistoryList,
    saveToHistory:            saveToHistory,
    updateHistoryCountBadge:  updateHistoryCountBadge,
    updateContextWordCounter: updateContextWordCounter,
    showToast:                showToast,
    isRestrictedUrl:          isRestrictedUrl,
    callGeminiAPI:            callGeminiAPI,
    applyFeatureVisibility:   applyFeatureVisibility,
    filterBookmarks:          filterBookmarks,
    filterHistoryKeys:        filterHistoryKeys,
    getLastScrapedData:       function () { return lastScrapedData; },
    getLastScrapedAction:     function () { return lastScrapedAction; }
  };





                        

});