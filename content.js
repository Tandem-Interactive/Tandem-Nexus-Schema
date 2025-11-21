// content.js

// Prevent multiple injections
if (!window.hasTandemListener) {
  window.hasTandemListener = true;

  const SCAN_DEBOUNCE_MS = 400;
  let lastScanResult = { schemas: [], hadErrors: false };
  let scanTimer = null;

  /**
   * Find a Google Tag Manager container ID from script tags or raw HTML.
   */
  function getGtmId() {
    if (window.google_tag_manager && typeof window.google_tag_manager === 'object') {
      const gtmKey = Object.keys(window.google_tag_manager).find((key) => key.startsWith('GTM-'));
      if (gtmKey) {
        return gtmKey;
      }
    }

    const scripts = document.querySelectorAll('script[src*="googletagmanager.com"]');
    for (const script of scripts) {
      const idMatch = script.src.match(/[?&]id=(GTM-[A-Z0-9]+)/);
      if (idMatch) {
        return idMatch[1];
      }
      const pathMatch = script.src.match(/(GTM-[A-Z0-9]{6,})/);
      if (pathMatch) {
        return pathMatch[1];
      }
    }

    return null;
  }

  /**
   * Safely sanitize and parse JSON-LD script content.
   */
  function parseJsonLd(scriptContent) {
    const cleaned = (scriptContent || '').replace(/[\u0000-\u0008\u000B-\u000C\u000E-\u001F]+/g, '');
    return JSON.parse(cleaned);
  }

  /**
   * Build a microdata object recursively from an itemscope node.
   */
  function extractMicrodataItem(element) {
    const item = {};

    const type = element.getAttribute('itemtype');
    if (type) item['@type'] = type.trim();

    const id = element.getAttribute('itemid');
    if (id) item['@id'] = id.trim();

    const properties = element.querySelectorAll('[itemprop]');
    properties.forEach((prop) => {
      const propName = prop.getAttribute('itemprop');
      if (!propName) return;

      if (prop.hasAttribute('itemscope')) {
        item[propName] = extractMicrodataItem(prop);
        return;
      }

      const value = prop.getAttribute('content') || prop.textContent || '';
      if (item[propName]) {
        item[propName] = Array.isArray(item[propName])
          ? [...item[propName], value.trim()]
          : [item[propName], value.trim()];
      } else {
        item[propName] = value.trim();
      }
    });

    return item;
  }

  /**
   * Scan the page for JSON-LD and microdata schemas.
   */
  function scanSchemas() {
    const schemas = [];
    let hadErrors = false;

    const scripts = document.querySelectorAll('script[type="application/ld+json"]');
    scripts.forEach((script) => {
      try {
        const json = parseJsonLd(script.textContent || script.innerText || '');
        schemas.push(json);
      } catch (error) {
        hadErrors = true;
        console.warn('Tandem Nexus: Invalid JSON-LD found', error);
        schemas.push({
          error: 'Invalid JSON-LD',
          rawSnippet: (script.textContent || '').trim().slice(0, 120)
        });
      }
    });

    const microdataItems = document.querySelectorAll('[itemscope]:not([itemprop])');
    microdataItems.forEach((node) => {
      try {
        const item = extractMicrodataItem(node);
        if (Object.keys(item).length > 0) {
          schemas.push({ '@context': 'https://schema.org', ...item });
        }
      } catch (error) {
        hadErrors = true;
        console.warn('Tandem Nexus: Unable to parse microdata', error);
      }
    });

    lastScanResult = { schemas, hadErrors };
    updateSchemaStatusBadge();
    return schemas.length > 0 ? schemas : null;
  }

  /**
   * Capture key page content to seed AI prompts.
   */
  function getPageContent() {
    const title = document.title || '';
    const description = document.querySelector('meta[name="description"]')?.content || '';
    const h1 = document.querySelector('h1')?.innerText || '';

    const headers = Array.from(document.querySelectorAll('h2, h3'))
      .slice(0, 15)
      .map((h) => `${h.tagName}: ${h.innerText}`)
      .join('\n');

    const bodyText = document.body.innerText.substring(0, 50000).replace(/\s+/g, ' ');

    return `
      URL: ${window.location.href}
      Title: ${title}
      H1: ${h1}
      Description: ${description}
      Structure:
      ${headers}
      Content Snippet:
      ${bodyText}
    `.trim();
  }

  function updateSchemaStatusBadge() {
    let status = 'none';
    if (lastScanResult.hadErrors) {
      status = 'error';
    } else if (lastScanResult.schemas.length > 0) {
      status = 'found';
    }

    try {
      chrome.runtime.sendMessage({ type: 'schema-status', status });
    } catch (error) {
      // Service worker may be unavailable; ignore transient failures.
      console.warn('Tandem Nexus: Unable to update action icon', error);
    }
  }

  function scheduleRescan() {
    if (scanTimer) {
      clearTimeout(scanTimer);
    }
    scanTimer = setTimeout(() => {
      scanSchemas();
    }, SCAN_DEBOUNCE_MS);
  }

  // Initial scan and observer for dynamic content.
  scanSchemas();
  const observer = new MutationObserver(scheduleRescan);
  observer.observe(document.documentElement || document.body, {
    childList: true,
    subtree: true,
    attributes: true,
    characterData: true
  });

  // Message Listener
  chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.action === 'scanPage') {
      sendResponse({
        url: window.location.href,
        gtmId: getGtmId(),
        content: getPageContent(),
        existingSchema: scanSchemas(),
        hadSchemaErrors: lastScanResult.hadErrors
      });
    }

    return true;
  });
}
