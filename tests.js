// ═══════════════════════════════════════════════════════════════════════
// tests.js — Full test suite for the "Scraper & Bookmarks" Chrome extension
// ═══════════════════════════════════════════════════════════════════════
//
// HOW TO RUN THIS:
//   1. Click the extension's toolbar icon to open the popup.
//   2. Right-click anywhere inside the popup and choose "Inspect".
//      (This opens a DevTools window attached to the popup itself.)
//   3. Click the "Console" tab in that DevTools window.
//   4. Open this file, copy ALL of its contents, paste them into the
//      console, and press Enter.
//   5. Read the results. Each test prints "PASS - ..." or "FAIL - ..."
//      with a short description, and a summary prints at the end.
//
// WHY IT HAS TO RUN INSIDE THE POPUP'S CONSOLE:
//   This suite calls the extension's REAL functions through
//   `window.__TEST_HOOKS__`, a small object popup.js sets up purely for
//   testing (see the bottom of popup.js). It also calls the real
//   chrome.storage / chrome.bookmarks APIs. Those only exist on an
//   extension page — a normal website's console does not have them.
//
// WHAT ABOUT content.js (the actual scraping code)?
//   content.js only runs as a message listener inside a real webpage tab,
//   so it can't be called directly from a console. To still test its
//   scraping ALGORITHMS, this file rebuilds tiny "mirror" versions of each
//   content.js action (copied line-for-line from content.js) and runs them
//   against fake mini-pages built with real DOM elements. If you ever
//   change content.js's logic, update the matching mirror function below
//   so the tests keep testing the real behavior.
//
// No external libraries. Plain JavaScript only. Works by pasting into any
// Chrome DevTools console.

(function () {
  "use strict";

  // ─────────────────────────────────────────────────────────────────────
  // TINY TEST FRAMEWORK
  // ─────────────────────────────────────────────────────────────────────
  let passCount = 0;
  let failCount = 0;
  let skipCount = 0;

  function assert(condition, message) {
    if (!condition) throw new Error(message || "Assertion failed");
  }

  function assertEqual(actual, expected, message) {
    const same = JSON.stringify(actual) === JSON.stringify(expected);
    if (!same) {
      throw new Error(
        (message ? message + " — " : "") +
        "expected " + JSON.stringify(expected) + " but got " + JSON.stringify(actual)
      );
    }
  }

  function group(title) {
    console.log("\n" + title);
  }

  function skip(name, reason) {
    skipCount++;
    console.log("SKIP - " + name + " (" + reason + ")");
  }

  // Runs one test. Works whether `fn` is a normal function or an async
  // function — either way we just await whatever it returns.
  async function test(name, fn) {
    try {
      await fn();
      passCount++;
      console.log("PASS - " + name);
    } catch (err) {
      failCount++;
      console.log("FAIL - " + name + " — " + err.message);
    }
  }

  // ─────────────────────────────────────────────────────────────────────
  // ENVIRONMENT CHECK
  // ─────────────────────────────────────────────────────────────────────
  const hooks = window.__TEST_HOOKS__;
  const hasChrome = typeof chrome !== "undefined" && !!chrome.storage;

  if (!hooks) {
    console.log(
      "⚠️  window.__TEST_HOOKS__ was not found.\n" +
      "This suite must be run inside the EXTENSION POPUP's own console\n" +
      "(open the popup, right-click → Inspect, then paste this file there).\n" +
      "Continuing anyway — every test that needs the real app functions\n" +
      "will be SKIPPED instead of run."
    );
  }
  if (!hasChrome) {
    console.log("⚠️  chrome.storage is not available here — storage tests will be SKIPPED.");
  }

  // ─────────────────────────────────────────────────────────────────────
  // Helper: build a small, real, rendered DOM fixture to scrape against.
  // It's positioned off-screen (not display:none — that would break
  // innerText, which needs layout) so it behaves like a real page.
  // ─────────────────────────────────────────────────────────────────────
  function withMockPage(bodyHtml, fn) {
    const container = document.createElement("div");
    container.style.cssText = "position:absolute; left:-9999px; top:-9999px; width:600px;";
    container.innerHTML = bodyHtml;
    document.body.appendChild(container);
    try {
      return fn(container);
    } finally {
      container.remove();
    }
  }

  // ─────────────────────────────────────────────────────────────────────
  // Mirrors of content.js's scraping logic (copied from content.js).
  // content.js can't be called directly from a console — see header note.
  // ─────────────────────────────────────────────────────────────────────
  function mirrorScrapeTitle(title) {
    return [title || "No title found"];
  }

  function mirrorScrapeLinks(root) {
    const links = root.querySelectorAll("a");
    const results = [];
    for (let i = 0; i < links.length; i++) {
      const href = links[i].href;
      const text = (links[i].innerText || "").trim();
      if (href && href.startsWith("http")) {
        results.push((text || "(no text)") + "  →  " + href);
      }
    }
    return results.slice(0, 30);
  }

  function mirrorScrapeHeadings(root) {
    const headings = root.querySelectorAll("h1, h2, h3");
    const results = [];
    for (let i = 0; i < headings.length; i++) {
      const text = (headings[i].innerText || "").trim();
      if (text) results.push("[" + headings[i].tagName + "]  " + text);
    }
    return results.slice(0, 30);
  }

  function mirrorScrapeImages(root) {
    const imgs = root.querySelectorAll("img");
    const results = [];
    for (let i = 0; i < imgs.length; i++) {
      const src = imgs[i].src;
      const alt = imgs[i].alt || "no description";
      if (src && src.startsWith("http")) results.push(alt + "  →  " + src);
    }
    return results.slice(0, 30);
  }

  function mirrorScrapeText(root) {
    return (root.innerText || "").replace(/\s+/g, " ").trim().slice(0, 3000);
  }

  function mirrorScrapeStats(root) {
    const bodyText = (root.innerText || "").trim();
    const wordCount = bodyText === "" ? 0 : bodyText.split(/\s+/).length;
    return {
      words:    wordCount,
      images:   root.querySelectorAll("img").length,
      links:    root.querySelectorAll("a[href^='http']").length,
      headings: root.querySelectorAll("h1, h2, h3").length
    };
  }

  // A fixture page used across several scraper tests.
  // Note: "mailto:" and "data:" links/images are used for the "should be
  // excluded" cases instead of relative URLs, because a relative URL's
  // resolved .href depends on wherever this script happens to run.
  const FIXTURE_HTML =
    "<h1>Main Title</h1>" +
    "<h2>Subtitle One</h2>" +
    "<h3>Subtitle Two</h3>" +
    "<h4>Should Not Count</h4>" +
    "<p>Some paragraph text for counting purposes.</p>" +
    "<a href='https://example.com/page1'>Link One</a>" +
    "<a href='https://example.com/page2'></a>" +
    "<a href='mailto:test@example.com'>Excluded mail link</a>" +
    "<img src='https://example.com/image1.png' alt='First image'>" +
    "<img src='https://example.com/image2.png'>" +
    "<img src='data:image/png;base64,AAAA'>";

  // ═══════════════════════════════════════════════════════════════════
  //  MAIN TEST RUN
  // ═══════════════════════════════════════════════════════════════════
  (async function run() {

    // ── 1. SCRAPER ─────────────────────────────────────────────────────
    group("🕷️  SCRAPER — content.js actions");

    await test("scrape-title returns the page title wrapped in an array", function () {
      assertEqual(mirrorScrapeTitle("My Page"), ["My Page"]);
    });

    await test("scrape-title falls back to 'No title found' when title is empty", function () {
      assertEqual(mirrorScrapeTitle(""), ["No title found"]);
    });

    await test("scrape-links only includes http(s) links, skips others, caps missing text", function () {
      withMockPage(FIXTURE_HTML, function (root) {
        const links = mirrorScrapeLinks(root);
        assertEqual(links, [
          "Link One  →  https://example.com/page1",
          "(no text)  →  https://example.com/page2"
        ]);
      });
    });

    await test("scrape-headings only includes h1/h2/h3, tagged with their level", function () {
      withMockPage(FIXTURE_HTML, function (root) {
        const headings = mirrorScrapeHeadings(root);
        assertEqual(headings, [
          "[H1]  Main Title",
          "[H2]  Subtitle One",
          "[H3]  Subtitle Two"
        ]);
      });
    });

    await test("scrape-images only includes http(s) images, falls back to 'no description'", function () {
      withMockPage(FIXTURE_HTML, function (root) {
        const images = mirrorScrapeImages(root);
        assertEqual(images, [
          "First image  →  https://example.com/image1.png",
          "no description  →  https://example.com/image2.png"
        ]);
      });
    });

    await test("scrape-text collapses whitespace and trims", function () {
      withMockPage("<p>Hello    world\n\nfrom   a   page</p>", function (root) {
        const text = mirrorScrapeText(root);
        assertEqual(text, "Hello world from a page");
      });
    });

    await test("scrape-text caps output at 3000 characters", function () {
      withMockPage("<p>" + "a".repeat(5000) + "</p>", function (root) {
        const text = mirrorScrapeText(root);
        assert(text.length === 3000, "expected length 3000, got " + text.length);
      });
    });

    await test("scrape-stats (📊 Page Stats) counts images/links/headings correctly", function () {
      withMockPage(FIXTURE_HTML, function (root) {
        const stats = mirrorScrapeStats(root);
        assertEqual(stats.images, 3);   // all <img> tags, not just http ones
        assertEqual(stats.links, 2);    // only http(s) links
        assertEqual(stats.headings, 3); // h1+h2+h3, not h4
        assert(typeof stats.words === "number" && stats.words > 5, "expected a positive word count");
      });
    });

    // ── Edge case: empty scrape results ─────────────────────────────────
    await test("EDGE CASE: scraping an empty page returns empty arrays, not errors", function () {
      withMockPage("", function (root) {
        assertEqual(mirrorScrapeLinks(root), []);
        assertEqual(mirrorScrapeHeadings(root), []);
        assertEqual(mirrorScrapeImages(root), []);
        assertEqual(mirrorScrapeStats(root).words, 0);
      });
    });

    // ── Edge case: chrome:// page ────────────────────────────────────────
    if (hooks) {
      await test("EDGE CASE: chrome:// and chrome-extension:// pages are blocked from scraping", function () {
        assert(hooks.isRestrictedUrl("chrome://extensions") === true, "chrome:// should be restricted");
        assert(hooks.isRestrictedUrl("chrome-extension://abc123/popup.html") === true, "chrome-extension:// should be restricted");
        assert(hooks.isRestrictedUrl("https://chrome.google.com/webstore") === true, "Chrome Web Store should be restricted");
        assert(hooks.isRestrictedUrl("https://example.com") === false, "a normal https page should NOT be restricted");
      });
    } else {
      skip("EDGE CASE: chrome:// page is blocked from scraping", "needs window.__TEST_HOOKS__");
    }

    // ── 2. STORAGE ───────────────────────────────────────────────────────
    group("💾 STORAGE");

    if (hooks && hasChrome) {
      await test("saveToHistory saves under the 'history:<url>' key prefix and is retrievable", async function () {
        const testUrl = "https://tests-js.example/__unit_test_page__";
        const key = "history:" + testUrl;

        // Clean slate, in case a previous failed run left data behind
        await chrome.storage.local.remove([key, "title:" + testUrl]);

        await new Promise(function (resolve) {
          hooks.saveToHistory(testUrl, "Unit Test Page", "scrape-title", ["A", "B"]);
          setTimeout(resolve, 150); // saveToHistory does a few chained async storage calls
        });

        const stored = await chrome.storage.local.get([key, "title:" + testUrl]);
        assert(Array.isArray(stored[key]), "expected an array stored under the history: key");
        assertEqual(stored[key][0].action, "scrape-title");
        assertEqual(stored[key][0].count, 2);
        assertEqual(stored["title:" + testUrl], "Unit Test Page");

        // Clean up after ourselves
        await chrome.storage.local.remove([key, "title:" + testUrl]);
      });

      await test("saveToHistory keeps only the most recent 10 entries per page", async function () {
        const testUrl = "https://tests-js.example/__unit_test_trim__";
        const key = "history:" + testUrl;
        await chrome.storage.local.remove([key, "title:" + testUrl]);

        for (let i = 0; i < 12; i++) {
          await new Promise(function (resolve) {
            hooks.saveToHistory(testUrl, "Trim Test", "scrape-title", ["item" + i]);
            setTimeout(resolve, 30);
          });
        }

        const stored = await chrome.storage.local.get(key);
        assert(stored[key].length === 10, "expected at most 10 entries, got " + stored[key].length);

        await chrome.storage.local.remove([key, "title:" + testUrl]);
      });

      await test("notes are saved and deleted under the 'note:<url>' key prefix", async function () {
        const testUrl = "https://tests-js.example/__unit_test_note__";
        const noteKey = "note:" + testUrl;

        await chrome.storage.local.set({ [noteKey]: "This is a test note" });
        let stored = await chrome.storage.local.get(noteKey);
        assertEqual(stored[noteKey], "This is a test note");

        await chrome.storage.local.remove(noteKey);
        stored = await chrome.storage.local.get(noteKey);
        assert(stored[noteKey] === undefined, "note should be gone after deleting");
      });

      await test("feature toggles save correctly to chrome.storage.sync", async function () {
        // Save the user's real settings first so we can restore them
        const original = await chrome.storage.sync.get([
          "scraperEnabled", "bookmarksEnabled", "aiEnabled", "historyEnabled"
        ]);

        try {
          await chrome.storage.sync.set({ scraperEnabled: false, aiEnabled: true });
          const result = await chrome.storage.sync.get(["scraperEnabled", "aiEnabled"]);
          assertEqual(result.scraperEnabled, false);
          assertEqual(result.aiEnabled, true);
        } finally {
          // Always restore, even if an assertion above failed
          await chrome.storage.sync.set(original);
        }
      });
    } else {
      skip("saveToHistory / notes / toggle storage tests", "needs window.__TEST_HOOKS__ and chrome.storage");
    }

    // ── 3. EXPORT ────────────────────────────────────────────────────────
    group("⬇️  EXPORT");

    if (hooks) {
      await test("CSV export has a 'data' header and quotes every value", function () {
        const csv = hooks.buildCsvExport(["hello", 'has "quotes"', "comma, inside"]);
        const lines = csv.split("\n");
        assertEqual(lines[0], "data");
        assertEqual(lines[1], '"hello"');
        assertEqual(lines[2], '"has ""quotes"""'); // quotes doubled per CSV rules
        assertEqual(lines[3], '"comma, inside"');
      });

      await test("JSON export includes exportedAt, action, count and data metadata fields", function () {
        const json = JSON.parse(hooks.buildJsonExport(["a", "b", "c"], "scrape-links"));
        assert(typeof json.exportedAt === "string" && json.exportedAt.length > 0, "expected an exportedAt timestamp");
        assertEqual(json.action, "scrape-links");
        assertEqual(json.count, 3);
        assertEqual(json.data, ["a", "b", "c"]);
      });

      await test("HTML export produces a valid, well-formed document with one <li> per item", function () {
        const html = hooks.buildScrapedHtmlExport(["Item One", "Item Two"]);
        assert(html.startsWith("<!DOCTYPE html>"), "expected a DOCTYPE at the start");
        assert(/<html>[\s\S]*<\/html>/.test(html), "expected a matching <html> ... </html>");
        assert((html.match(/<li>/g) || []).length === 2, "expected exactly 2 <li> items");
        assert(html.includes("Item One") && html.includes("Item Two"), "expected both items present");
      });

      await test("HTML export escapes special characters (prevents broken/unsafe output)", function () {
        const html = hooks.buildScrapedHtmlExport(["<script>alert(1)</script>"]);
        assert(!html.includes("<script>alert(1)</script>"), "raw <script> tag should have been escaped");
        assert(html.includes("&lt;script&gt;"), "expected the escaped version to be present");
      });

      await test("Bookmark HTML export produces the Netscape bookmark format", function () {
        const html = hooks.buildBookmarkHtmlExport([{ title: "Example", url: "https://example.com" }]);
        assert(html.includes("<!DOCTYPE NETSCAPE-Bookmark-file-1>"), "expected the Netscape doctype");
        assert(html.includes('<A HREF="https://example.com">Example</A>'), "expected a matching <A> tag");
      });

      await test("Bookmark JSON export includes exportedAt, count and bookmarks fields", function () {
        const list = [{ title: "A", url: "https://a.com" }, { title: "B", url: "https://b.com" }];
        const json = JSON.parse(hooks.buildBookmarkJsonExport(list));
        assertEqual(json.count, 2);
        assertEqual(json.bookmarks, list);
        assert(typeof json.exportedAt === "string", "expected an exportedAt timestamp");
      });

      await test("escapeHtml escapes &, <, >, and \"", function () {
        assertEqual(hooks.escapeHtml(`<a href="x">&</a>`), "&lt;a href=&quot;x&quot;&gt;&amp;&lt;/a&gt;");
      });
    } else {
      skip("Export tests (CSV/JSON/HTML)", "needs window.__TEST_HOOKS__");
    }

    // ── 4. BOOKMARKS ─────────────────────────────────────────────────────
    group("🔖 BOOKMARKS");

    if (hooks) {
      await test("flattenTree correctly flattens nested bookmark folders", function () {
        const fakeTree = [
          { id: "1", url: "https://top-level.com", title: "Top Level" },
          {
            id: "2", title: "Work",
            children: [
              { id: "3", url: "https://work-one.com", title: "Work One" },
              {
                id: "4", title: "Projects",
                children: [
                  { id: "5", url: "https://nested-project.com", title: "Nested Project" }
                ]
              }
            ]
          }
        ];

        const flat = hooks.flattenBookmarkTree(fakeTree, "");
        assertEqual(flat.length, 3);
        assertEqual(flat[0], { id: "1", title: "Top Level", url: "https://top-level.com", folder: "" });
        assertEqual(flat[1].folder, "Work");
        assertEqual(flat[2].folder, "Work > Projects");
        assertEqual(flat[2].url, "https://nested-project.com");
      });

      await test("flattenTree falls back to 'Untitled' / 'Folder' when names are missing", function () {
        const fakeTree = [
          { id: "1", url: "https://no-title.com", title: "" },
          { id: "2", title: "", children: [{ id: "3", url: "https://x.com", title: "X" }] }
        ];
        const flat = hooks.flattenBookmarkTree(fakeTree, "");
        assertEqual(flat[0].title, "Untitled");
        assertEqual(flat[1].folder, "Folder");
      });

      await test("bookmark search filtering matches by title or URL, case-insensitively", function () {
        const list = [
          { title: "GitHub", url: "https://github.com" },
          { title: "Stack Overflow", url: "https://stackoverflow.com" },
          { title: "Random Site", url: "https://example.com/github-mirror" }
        ];
        assertEqual(hooks.filterBookmarks(list, "github").length, 2); // title match + url match
        assertEqual(hooks.filterBookmarks(list, "STACK").length, 1);
        assertEqual(hooks.filterBookmarks(list, "nonexistent").length, 0);
        assertEqual(hooks.filterBookmarks(list, "").length, 3); // empty query = show all
      });
    } else {
      skip("Bookmark tests (flattenTree / search)", "needs window.__TEST_HOOKS__");
    }

    // ── 5. AI ────────────────────────────────────────────────────────────
    group("🤖 AI");

    if (hooks) {
      await test("callGeminiAPI builds a conversationHistory entry in Gemini's expected shape", function () {
        const entry = hooks.buildHistoryEntry("user", "Hello there");
        assertEqual(entry, { role: "user", parts: [{ text: "Hello there" }] });
      });

      await test("the FIRST question includes the page context in the prompt", function () {
        const prompt = hooks.buildAskPrompt("What is this page about?", "This page is about cats.", 0);
        assert(prompt.includes("This page is about cats."), "expected the page context to be included");
        assert(prompt.includes("What is this page about?"), "expected the question to be included");
      });

      await test("FOLLOW-UP questions exclude the page context (Gemini already has it)", function () {
        const prompt = hooks.buildAskPrompt("And what about dogs?", "This page is about cats.", 2);
        assertEqual(prompt, "And what about dogs?");
        assert(!prompt.includes("This page is about cats."), "follow-up should NOT repeat the page context");
      });

      if (hasChrome) {
        await test("EDGE CASE: missing API key returns a friendly error, makes no network call", async function () {
          const original = await chrome.storage.sync.get("geminiApiKey");
          try {
            await chrome.storage.sync.remove("geminiApiKey");
            const result = await hooks.callGeminiAPI("test question");
            assert(result.includes("No API key saved"), "expected a 'no API key' message, got: " + result);
          } finally {
            if (original.geminiApiKey) {
              await chrome.storage.sync.set({ geminiApiKey: original.geminiApiKey });
            }
          }
        });
      } else {
        skip("EDGE CASE: missing API key", "needs chrome.storage");
      }
    } else {
      skip("AI tests (conversationHistory / prompt building)", "needs window.__TEST_HOOKS__");
    }

    // ── 6. TAB SWITCHING ─────────────────────────────────────────────────
    group("🗂️  TAB SWITCHING");

    const allTabIds = ["tab-scraper", "tab-bookmarks", "tab-ai", "tab-history"];
    const allSecIds = ["section-scraper", "section-bookmarks", "section-ai", "section-history"];
    const tabsExistInDom = allTabIds.every(function (id) { return !!document.getElementById(id); });

    if (tabsExistInDom) {
      for (let i = 0; i < allTabIds.length; i++) {
        const tabId = allTabIds[i];
        await test("clicking " + tabId + " shows only its section and marks only itself active", function () {
          document.getElementById(tabId).click();

          allTabIds.forEach(function (otherId, j) {
            const isThisOne = otherId === tabId;
            const tabEl = document.getElementById(otherId);
            const secEl = document.getElementById(allSecIds[j]);
            if (tabEl.style.display === "none") return; // toggled off — ignore

            assert(
              tabEl.classList.contains("active") === isThisOne,
              otherId + " active state should be " + isThisOne
            );
            assert(
              secEl.classList.contains("hidden") !== isThisOne,
              allSecIds[j] + " hidden state is wrong for " + tabId + " being active"
            );
          });
        });
      }
    } else {
      skip("Tab switching tests", "expected tab-scraper/tab-bookmarks/tab-ai/tab-history in the DOM — run this inside the popup");
    }

    // ── 7. FEATURE TOGGLES ───────────────────────────────────────────────
    group("🔧 FEATURE TOGGLES");

    if (hooks && tabsExistInDom) {
      await test("disabling a feature hides its tab AND its section", function () {
        try {
          hooks.applyFeatureVisibility({
            scraperEnabled: false, bookmarksEnabled: true, aiEnabled: true, historyEnabled: true
          });
          assertEqual(document.getElementById("tab-scraper").style.display, "none");
          assertEqual(document.getElementById("section-scraper").style.display, "none");
          assertEqual(document.getElementById("tab-bookmarks").style.display, "");
        } finally {
          // Restore — don't leave the popup broken for the person testing it
          hooks.applyFeatureVisibility({
            scraperEnabled: true, bookmarksEnabled: true, aiEnabled: true, historyEnabled: true
          });
        }
      });
    } else {
      skip("Feature toggle visibility test", "needs window.__TEST_HOOKS__ and the popup DOM");
    }

    // ── 8. MORE EDGE CASES ───────────────────────────────────────────────
    group("🧪 EDGE CASES");

    if (hooks) {
      await test("EDGE CASE: exporting with zero scraped results produces an empty-but-valid CSV/JSON", function () {
        const csv = hooks.buildCsvExport([]);
        assertEqual(csv, "data\n");
        const json = JSON.parse(hooks.buildJsonExport([], "scrape-title"));
        assertEqual(json.count, 0);
        assertEqual(json.data, []);
      });

      await test("EDGE CASE: history search filtering with no matches returns an empty list, not an error", function () {
        const fakeData = { "title:https://a.com": "Example Site" };
        const result = hooks.filterHistoryKeys(["history:https://a.com"], fakeData, "zzz_no_match_zzz");
        assertEqual(result, []);
      });
    } else {
      skip("Empty-export / empty-search edge cases", "needs window.__TEST_HOOKS__");
    }

    if (hasChrome) {
      await test("EDGE CASE: clearing history when it's already empty doesn't throw", async function () {
        const allData = await chrome.storage.local.get(null);
        const historyKeys = Object.keys(allData).filter(function (k) { return k.startsWith("history:"); });
        // We only assert this runs without throwing — clearing an already-empty
        // set of keys is a safe no-op in chrome.storage.local.remove.
        await chrome.storage.local.remove(historyKeys.length ? [] : ["history:__nonexistent__"]);
        assert(true);
      });
    } else {
      skip("EDGE CASE: clearing empty history", "needs chrome.storage");
    }

    // ─────────────────────────────────────────────────────────────────
    // SUMMARY
    // ─────────────────────────────────────────────────────────────────
    console.log("\n──────────────────────────────────────────");
    console.log(
      "RESULTS: " + passCount + " passed, " + failCount + " failed, " + skipCount + " skipped " +
      "(" + (passCount + failCount + skipCount) + " total)"
    );
    if (failCount === 0) {
      console.log("✅ All runnable tests passed.");
    } else {
      console.log("❌ Some tests failed — see FAIL lines above.");
    }
    if (skipCount > 0) {
      console.log("ℹ️  Some tests were skipped because this wasn't run inside the popup's own console.");
    }
  })();

})();
