/**
 * TANDEM NEXUS SCHEMA v4.3
 * Fixed Rendering Logic & Models
 */

const SCHEMA_LIB = {
  "Thing": { icon: "category", fields: ["name", "url", "description"] },
  "Organization": { icon: "business", fields: ["name", "url", "logo", "sameAs", "contactPoint", "address", "telephone"] },
  "LocalBusiness": { icon: "store", fields: ["name", "image", "telephone", "email", "address", "geo", "priceRange", "openingHoursSpecification"] },
  "ProfessionalService": { icon: "handshake", fields: ["name", "image", "telephone", "email", "address", "openingHoursSpecification", "areaServed"] },
  "Place": { icon: "place", fields: ["name", "image", "address", "geo", "telephone", "openingHoursSpecification", "priceRange"] },
  "Product": { icon: "shopping_bag", fields: ["name", "image", "description", "sku", "brand", "offers", "aggregateRating"] },
  "Article": { icon: "article", fields: ["headline", "image", "datePublished", "dateModified", "author", "publisher"] },
  "FAQPage": { icon: "quiz", fields: ["mainEntity"] },
  "Question": { icon: "help", fields: ["name", "acceptedAnswer"] },
  "Answer": { icon: "check_circle", fields: ["text"] },
  "BreadcrumbList": { icon: "linear_scale", fields: ["itemListElement"] },
  "ListItem": { icon: "format_list_numbered", fields: ["position", "name", "item"] },
  "AggregateRating": { icon: "star_half", fields: ["ratingValue", "bestRating", "worstRating", "ratingCount", "reviewCount", "itemReviewed"] },
  "OpeningHoursSpecification": { icon: "schedule", fields: ["dayOfWeek", "opens", "closes"] },
  "VideoObject": { icon: "play_circle", fields: ["name", "description", "thumbnailUrl", "uploadDate"] },
  "WebSite": { icon: "public", fields: ["name", "url", "description", "publisher", "potentialAction"] },
  "WebPage": { icon: "insert_drive_file", fields: ["name", "url", "headline", "description", "datePublished", "dateModified", "breadcrumb"] },
  "Event": { icon: "event", fields: ["name", "description", "startDate", "endDate", "eventAttendanceMode", "eventStatus", "location", "image", "offers"] },
  "Person": { icon: "person", fields: ["name", "jobTitle", "url", "image", "sameAs", "worksFor"] },
  "PostalAddress": { icon: "home", fields: ["streetAddress", "addressLocality", "addressRegion", "postalCode", "addressCountry"] },
  "GeoCoordinates": { icon: "location_on", fields: ["latitude", "longitude"] },
  "Offer": { icon: "local_offer", fields: ["price", "priceCurrency", "availability", "url", "priceValidUntil"] },
  "AggregateOffer": { icon: "stacked_bar_chart", fields: ["lowPrice", "highPrice", "priceCurrency", "offerCount", "offers"] },
  "Review": { icon: "rate_review", fields: ["author", "datePublished", "reviewBody", "reviewRating"] },
  "Rating": { icon: "star", fields: ["ratingValue", "bestRating", "worstRating"] },
  "ImageObject": { icon: "image", fields: ["url", "contentUrl", "caption", "width", "height"] },
  "EntryPoint": { icon: "input", fields: ["urlTemplate", "actionPlatform"] },
  "SearchAction": { icon: "search", fields: ["target", "query-input"] },
  "ReadAction": { icon: "menu_book", fields: ["target"] }
};

const FIELD_TYPES = {
  "dayOfWeek": "week_checkbox", "opens": "time", "closes": "time",
  "image": "array", "sameAs": "array", "mainEntity": "nested_array",
  "itemListElement": "nested_array", "offers": "nested_object",
  "address": "nested_object", "geo": "nested_object", "acceptedAnswer": "nested_object",
  "potentialAction": "nested_object", "publisher": "nested_object", "location": "nested_object",
  "worksFor": "nested_object", "reviewRating": "nested_object", "itemReviewed": "nested_object",
  "target": "nested_object"
};

// When creating new blocks or nested structures, default them to useful schema shapes
const DEFAULT_NESTED_TYPES = {
  address: "PostalAddress",
  geo: "GeoCoordinates",
  acceptedAnswer: "Answer",
  potentialAction: "SearchAction",
  publisher: "Organization",
  location: "Place",
  worksFor: "Organization",
  reviewRating: "Rating",
  itemReviewed: "Thing",
  offers: "Offer",
  mainEntity: "Thing",
  itemListElement: "ListItem",
  target: "EntryPoint"
};

// MANIFEST TEMPLATE (For Wizard)
const MANIFEST_TEMPLATE = (cid) => `{
  "name": "Tandem NEXUS Schema",
  "description": "Enterprise Schema Architect. Visual Editor & AI Integration.",
  "version": "4.3.0",
  "manifest_version": 3,
  "permissions": ["identity", "activeTab", "scripting", "storage", "clipboardWrite"],
  "host_permissions": ["https://tagmanager.googleapis.com/*", "https://generativelanguage.googleapis.com/*"],
  "oauth2": {
    "client_id": "${cid}",
    "scopes": [
      "https://www.googleapis.com/auth/tagmanager.edit.containers",
      "https://www.googleapis.com/auth/tagmanager.readonly",
      "https://www.googleapis.com/auth/tagmanager.manage.accounts"
    ]
  },
  "background": { "service_worker": "background.js" },
  "action": { "default_popup": "popup.html", "default_icon": {"16":"icon16.png","32":"icon32.png","48":"icon48.png","128":"icon128.png"} },
  "icons": {"16":"icon16.png","32":"icon32.png","48":"icon48.png","128":"icon128.png"},
  "content_scripts": [{ "matches": ["<all_urls>"], "js": ["content.js"] }]
}`;

// --- NETWORK CLIENT ---
class NetworkClient {
  constructor() {
    this.MAX_RETRIES = 20;
    this.BASE_DELAY = 2000;
    this.MAX_DELAY = 10000;
  }

  async fetchWithRetry(url, options, onProgress) {
    let attempt = 0;
    let lastError = null;

    while (attempt < this.MAX_RETRIES) {
      try {
        const response = await fetch(url, options);
        if (response.ok) {
          return await response.json();
        }

        const errorBody = await response.text();
        lastError = new Error(`Request failed with status ${response.status}: ${errorBody}`);
      } catch (error) {
        lastError = error;
      }

      attempt++;
      if (attempt >= this.MAX_RETRIES) {
        throw lastError || new Error("Max retries reached.");
      }

      const delay = Math.min(this.MAX_DELAY, this.BASE_DELAY * Math.pow(1.2, attempt));
      if (onProgress) onProgress(attempt, this.MAX_RETRIES, delay);
      await new Promise((resolve) => setTimeout(resolve, delay));
    }

    throw lastError || new Error("Max retries reached.");
  }
}

// --- APP CONTROLLER ---
class App {
  constructor() {
    this.state = {
      geminiKey: null,
      modelName: "gemini-pro-latest", // Default Model Updated
      authToken: null,
      schema: {},
      schemaList: [],
      currentSchemaIndex: 0,
      url: null,
      gtmId: null
    };
    this.net = new NetworkClient();
  }

  async init() {
    try {
      this.setupWindowResizeHandle();
      // 1. Load Settings
      const settings = await chrome.storage.sync.get(['geminiKey', 'modelName']);
      if(settings.geminiKey) this.state.geminiKey = settings.geminiKey;
      if(settings.modelName) this.state.modelName = settings.modelName;

      // 2. Check Manifest (Wizard)
      const manifest = chrome.runtime.getManifest();
      if (manifest.oauth2.client_id.includes("PLACEHOLDER")) {
        this.initWizard();
      } else {
        this.initApp();
      }
    } catch (e) { console.error("Init Failed", e); }
  }

  setupWindowResizeHandle() {
    const handle = document.getElementById('popup-resize-handle');
    if (!handle) return;

    const MIN_HEIGHT = 720;
    const MAX_HEIGHT = 1200;
    let startY = 0;
    let startHeight = window.outerHeight || document.documentElement.clientHeight;

    const applyHeight = (height) => {
      if (chrome?.windows?.update) {
        chrome.windows.getCurrent((win) => {
          if (chrome.runtime.lastError || !win?.id) return;
          chrome.windows.update(win.id, { height });
        });
      }
      if (typeof window.resizeTo === 'function') {
        window.resizeTo(window.outerWidth, height);
      }
      document.documentElement.style.height = `${height}px`;
      document.body.style.height = `${height}px`;
    };

    const stopDrag = () => {
      document.body.classList.remove('is-resizing');
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('mouseup', stopDrag);
      window.removeEventListener('mouseleave', stopDrag);
      window.removeEventListener('blur', stopDrag);
    };

    const onMouseMove = (event) => {
      const delta = event.screenY - startY;
      const targetHeight = Math.min(
        MAX_HEIGHT,
        Math.max(MIN_HEIGHT, startHeight + delta)
      );
      applyHeight(targetHeight);
    };

    handle.addEventListener('mousedown', (event) => {
      event.preventDefault();
      startY = event.screenY;
      startHeight = window.outerHeight || document.documentElement.clientHeight;
      document.body.classList.add('is-resizing');
      window.addEventListener('mousemove', onMouseMove);
      window.addEventListener('mouseup', stopDrag);
      window.addEventListener('mouseleave', stopDrag);
      window.addEventListener('blur', stopDrag);
    });
  }

  // --- WIZARD ---
  initWizard() {
    this.ensureWizardMarkup();
    document.getElementById('app-container').style.display = 'none';
    document.getElementById('setup-wizard').style.display = 'flex';

    const persistStep = (id) => chrome.storage.sync.set({ wizardStep: id });
    const show = (id) => {
        document.querySelectorAll('.wizard-step').forEach(el => el.classList.remove('active'));
        document.getElementById(id).classList.add('active');
        persistStep(id);
    }

    const step1 = document.getElementById('btn-step-1');
    const step2 = document.getElementById('btn-step-2');
    const back2 = document.getElementById('back-step-2');
    const step3 = document.getElementById('btn-step-3');
    const back3 = document.getElementById('back-step-3');
    const step4 = document.getElementById('generate-manifest');
    const back4 = document.getElementById('back-step-4');
    const apiInput = document.getElementById('wiz-api-key');
    const clientInput = document.getElementById('new-client-id');
    const extensionIdDisplay = document.getElementById('extension-id-value');
    const copyExtensionBtn = document.getElementById('copy-extension-id');

    if (!step1 || !step2 || !back2 || !step3 || !back3 || !step4 || !back4 || !apiInput || !clientInput) {
      console.error('Wizard markup missing required elements');
      return;
    }

    step1.onclick = () => {
        const key = apiInput.value.trim();
        if(!key) return this.toast("API Key Required", "error");
        chrome.storage.sync.set({ geminiKey: key });
        this.state.geminiKey = key;
        show('step-2');
    };
    step2.onclick = () => show('step-3');
    back2.onclick = () => show('step-1');
    step3.onclick = () => {
        const cid = clientInput.value.trim();
        if(!cid) return this.toast("Client ID Required", "error");
        this.tempCid = cid;
        chrome.storage.sync.set({ wizardClientId: cid });
        show('step-4');
    }
    back3.onclick = () => show('step-2');
    step4.onclick = () => {
        const blob = new Blob([MANIFEST_TEMPLATE(this.tempCid)], {type: "application/json"});
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a'); a.href = url; a.download = "manifest.json"; a.click();
    }
    back4.onclick = () => show('step-3');

    const extensionId = chrome.runtime.id || 'Unavailable';
    if (extensionIdDisplay) {
      extensionIdDisplay.textContent = extensionId;
    }
    if (copyExtensionBtn) {
      copyExtensionBtn.onclick = async () => {
        try {
          await navigator.clipboard.writeText(extensionId);
          this.toast("Extension ID copied");
        } catch (error) {
          console.error('Copy failed', error);
          this.toast("Copy failed", "error");
        }
      };
    }

    chrome.storage.sync.get(['wizardStep', 'wizardClientId', 'geminiKey'], (data) => {
      if (chrome.runtime.lastError) {
        console.warn('Wizard state restore failed', chrome.runtime.lastError);
        return;
      }

      if (data.geminiKey && !this.state.geminiKey) {
        this.state.geminiKey = data.geminiKey;
      }
      apiInput.value = this.state.geminiKey || '';

      if (data.wizardClientId) {
        clientInput.value = data.wizardClientId;
        this.tempCid = data.wizardClientId;
      }

      const validSteps = new Set(['step-1', 'step-2', 'step-3', 'step-4']);
      const initialStep = validSteps.has(data.wizardStep) ? data.wizardStep : 'step-1';
      show(initialStep);
    });
  }

  ensureWizardMarkup() {
    const wizardRoot = document.getElementById('setup-wizard');
    if (!wizardRoot || wizardRoot.dataset.built === 'true') return;

    wizardRoot.dataset.built = 'true';
    wizardRoot.innerHTML = `
      <div class="wizard-card">
        <div id="step-1" class="wizard-step active">
          <h3 class="step-title">Welcome to Tandem NEXUS</h3>
          <p class="text-light">Enter your Gemini API key to begin.</p>
          <div class="key-input-wrapper" style="margin: 20px 0;">
            <span class="material-icons" style="font-size:16px; color:#009cd6;">key</span>
            <input id="wiz-api-key" type="password" placeholder="Gemini API Key" />
          </div>
          <div class="nav-row" style="justify-content:flex-start; gap:12px;">
            <a class="btn-external" href="https://aistudio.google.com/api-keys" target="_blank" rel="noreferrer noopener">
              <span class="material-icons">open_in_new</span> Make an API key
            </a>
          </div>
          <button id="btn-step-1" class="btn-next">Continue</button>
        </div>

        <div id="step-2" class="wizard-step">
          <h3 class="step-title">Enable Google APIs</h3>
          <p class="text-light">Ensure Tag Manager API access is enabled for your project.</p>
          <div class="nav-row">
            <a class="btn-external" href="https://console.cloud.google.com/apis/library/tagmanager.googleapis.com" target="_blank" rel="noreferrer noopener">
              <span class="material-icons">open_in_new</span> Open API Library
            </a>
          </div>
          <div class="nav-row">
            <button id="back-step-2" class="btn-back">Back</button>
            <button id="btn-step-2" class="btn-next">Next</button>
          </div>
        </div>

        <div id="step-3" class="wizard-step">
          <h3 class="step-title">Add OAuth Client ID</h3>
          <p class="text-light">Paste the OAuth client ID configured for this extension.</p>
          <div class="info-box">
            <div class="info-row">
              <span class="material-icons info-icon">extension</span>
              <div class="info-text">
                <div class="info-label">Extension ID</div>
                <div id="extension-id-value" class="info-value">Loading...</div>
              </div>
              <button id="copy-extension-id" class="copy-btn" title="Copy extension ID">
                <span class="material-icons">content_copy</span>
              </button>
            </div>
          </div>
          <a class="btn-external" href="https://console.cloud.google.com/auth/clients" target="_blank" rel="noreferrer noopener">
            <span class="material-icons">open_in_new</span> Open OAuth Client IDs
          </a>
          <input id="new-client-id" type="text" placeholder="OAuth Client ID" class="schema-input" style="width:100%; margin: 16px 0;" />
          <div class="nav-row">
            <button id="back-step-3" class="btn-back">Back</button>
            <button id="btn-step-3" class="btn-next">Continue</button>
          </div>
        </div>

        <div id="step-4" class="wizard-step">
          <h3 class="step-title">Download Manifest</h3>
          <p class="text-light">Download the generated manifest and replace the placeholder in your extension.</p>
          <button id="generate-manifest" class="btn-next" style="margin: 12px 0;">Download manifest.json</button>
          <button id="back-step-4" class="btn-back" style="width:100%;">Back</button>
        </div>
      </div>`;
  }

  // --- MAIN APP ---
  initApp() {
    document.getElementById('setup-wizard').style.display = 'none';
    document.getElementById('app-container').style.display = 'flex'; // Flex for column layout
    this.bindUI();
    this.renderSchemaTabs();
    this.checkAuth();
    this.scanPage();
  }

  bindUI() {
    const jsonEditor = document.getElementById('json-editor');

    const copyJsonBtn = document.getElementById('copy-json');
    if (copyJsonBtn) {
      copyJsonBtn.onclick = async () => {
        const text = (jsonEditor?.value || '').trim();
        if (!text) {
          this.toast('No JSON available to copy', 'error');
          return;
        }
        try {
          await navigator.clipboard.writeText(text);
          this.toast('JSON copied to clipboard');
        } catch (error) {
          console.error('Copy JSON failed', error);
          this.toast('Unable to copy JSON', 'error');
        }
      };
    }

    const richResultsBtn = document.getElementById('rich-results-btn');
    if (richResultsBtn) {
      richResultsBtn.onclick = () => this.openGoogleValidator();
    }

    const schemaOrgBtn = document.getElementById('schema-org-btn');
    if (schemaOrgBtn) {
      schemaOrgBtn.onclick = () => this.openSchemaValidator();
    }

    document.getElementById('settings-btn').onclick = () => {
      document.getElementById('api-key').value = this.state.geminiKey || '';
      document.getElementById('model-select').value = this.state.modelName;
      document.getElementById('config-modal').style.display = 'flex';
    };
    document.getElementById('save-config').onclick = () => {
      const k = document.getElementById('api-key').value.trim();
      const m = document.getElementById('model-select').value;
      chrome.storage.sync.set({ geminiKey: k, modelName: m });
      this.state.geminiKey = k; this.state.modelName = m;
      document.getElementById('config-modal').style.display = 'none';
      this.toast("Settings Saved");
    };
    document.querySelectorAll('.close-modal').forEach(e => e.onclick = () => document.querySelectorAll('.modal').forEach(m=>m.style.display='none'));

    document.getElementById('fab-add').onclick = () => this.openAddModal();
    document.getElementById('login-btn').onclick = () => this.login();
    document.getElementById('ai-scan-btn').onclick = () => this.runAI();
    document.getElementById('validate-btn').onclick = () => this.validateJson();
    document.getElementById('publish-btn').onclick = () => this.publish();
    document.getElementById('undo-btn').onclick = () => this.scanPage();

    // JSON Editor Sync
    jsonEditor.oninput = (e) => {
      const value = e.target.value;
      this.updateJsonValidity(value);

      try {
        const parsed = JSON.parse(value);
        this.updateState(parsed, 'json');
      } catch (err) {
        // Ignore parse errors while typing; validity indicator communicates state.
      }
    };

    document.getElementById('format-json').onclick = () => {
      const raw = jsonEditor.value.trim();
      if (!raw) {
        this.updateJsonValidity('');
        jsonEditor.value = '';
        return;
      }

      try {
        const parsed = JSON.parse(raw);
        const pretty = JSON.stringify(parsed, null, 2);
        jsonEditor.value = pretty;
        this.updateState(parsed, 'json');
        this.updateJsonValidity(pretty);
      } catch (error) {
        this.updateJsonValidity(raw);
        this.toast('Invalid JSON: unable to prettify', 'error');
      }
    };
    
    // Tab Switch
    document.querySelectorAll('.tab').forEach(t => t.onclick = (e) => {
        document.querySelectorAll('.tab').forEach(x => x.classList.remove('active'));
        document.querySelectorAll('.view').forEach(x => x.classList.remove('active'));
        e.target.classList.add('active');
        document.getElementById(e.target.dataset.view + '-view').classList.add('active');
    });

    const googleValidatorBtn = document.getElementById('open-google-validator');
    if (googleValidatorBtn) {
      googleValidatorBtn.onclick = () => this.openGoogleValidator();
    }

    const schemaValidatorBtn = document.getElementById('open-schema-validator');
    if (schemaValidatorBtn) {
      schemaValidatorBtn.onclick = () => this.openSchemaValidator();
    }

    this.updateJsonValidity(jsonEditor.value);
  }

  openAddModal() {
    const list = document.getElementById('schema-type-list'); list.innerHTML = '';
    Object.keys(SCHEMA_LIB).forEach(key => {
      const item = document.createElement('div'); item.className = 'type-item';
      item.innerHTML = `<span class="material-icons">${SCHEMA_LIB[key].icon}</span> ${key}`;
      item.onclick = () => this.addBlock(key);
      list.appendChild(item);
    });
    document.getElementById('add-block-modal').style.display = 'flex';
  }

  addBlock(type) {
    const block = { "@type": type };
    if(SCHEMA_LIB[type].fields) {
      SCHEMA_LIB[type].fields.forEach(f => block[f] = this.defaultValueForField(f));
    }

    let current = this.state.schema;
    if(Object.keys(current).length === 0) current = { "@context": "https://schema.org", ...block };
    else if(current['@graph']) current['@graph'].push(block);
    else { const old = JSON.parse(JSON.stringify(current)); delete old['@context']; current = { "@context": "https://schema.org", "@graph": [old, block] }; }
    
    this.updateState(current);
    document.getElementById('add-block-modal').style.display = 'none';
  }

  defaultValueForField(fieldName) {
    const type = FIELD_TYPES[fieldName];
    if (type === 'nested_object') {
      const defaultType = DEFAULT_NESTED_TYPES[fieldName];
      return defaultType ? { '@type': defaultType } : {};
    }
    if (type === 'nested_array') {
      const defaultType = DEFAULT_NESTED_TYPES[fieldName];
      return defaultType ? [{ '@type': defaultType }] : [];
    }
    if (type === 'array') return [];
    return "";
  }

  // --- VISUAL RENDERER (FIXED DATA FLOW) ---
  renderVisual(data) {
    const container = document.getElementById('visual-editor');
    container.innerHTML = '';

    const cards = [];
    const traverse = (node, path = []) => {
      if (!node || typeof node !== 'object') return;

      if (Array.isArray(node)) {
        node.forEach((entry, idx) => traverse(entry, [...path, idx]));
        return;
      }

      if (node['@type']) {
        cards.push({ item: node, path });
      }

      if (Array.isArray(node['@graph'])) {
        node['@graph'].forEach((entry, idx) => traverse(entry, [...path, '@graph', idx]));
      }
    };

    if (Array.isArray(data['@graph'])) {
      data['@graph'].forEach((entry, idx) => traverse(entry, ['@graph', idx]));
    } else {
      traverse(data, []);
    }

    if(cards.length === 0) {
        container.innerHTML = `<div class="empty-state"><div class="empty-icon-bg"><span class="material-icons">schema</span></div><p>No Schema Data</p><small>Use AI or click '+' to add.</small></div>`;
    } else {
        cards.forEach(({ item, path }) => {
            container.appendChild(this.createCard(item, path));
        });
    }
    
    // Always restore FAB
    const fab = document.createElement('button'); fab.id = 'fab-add'; fab.className = 'fab'; fab.innerHTML = '<span class="material-icons">add</span>';
    fab.onclick = () => this.openAddModal();
    container.appendChild(fab);
  }

  createCard(item, path) {
    const primaryType = Array.isArray(item['@type']) ? item['@type'][0] : item['@type'] || 'Thing';
    const displayType = Array.isArray(item['@type']) ? item['@type'].join(', ') : (item['@type'] || 'Thing');
    const def = SCHEMA_LIB[primaryType] || { icon: 'code', fields: [] };
    const keys = new Set([...(def.fields || []), ...Object.keys(item).filter(k => !k.startsWith('@'))]);

    const card = document.createElement('div'); card.className = 'schema-card';
    card.innerHTML = `<div class="card-header"><div class="card-title"><span class="material-icons">${def.icon}</span> ${displayType}</div><div class="card-actions"><span class="material-icons delete-card" style="color:#ef4444; cursor:pointer;">delete</span><span class="material-icons expand-icon">expand_more</span></div></div><div class="card-body"></div>`;
    
    card.querySelector('.card-header').onclick = (e) => { if(!e.target.closest('.delete-card')) card.classList.toggle('collapsed'); };
    card.querySelector('.delete-card').onclick = () => this.deletePath(path);
    
    const body = card.querySelector('.card-body');
    keys.forEach(key => body.appendChild(this.createField(key, item[key], [...path, key])));
    return card;
  }

  createField(key, value, path) {
    const row = document.createElement('div'); row.className = 'field-row';
    const label = document.createElement('label'); label.className = 'field-label';
    label.innerText = key.replace(/([A-Z])/g, ' $1').trim();
    row.appendChild(label);

    if(typeof value === 'object' && value !== null) {
        const nest = document.createElement('div'); nest.className = 'nested-container';
        if(Array.isArray(value)) {
           if(value.length > 0 && typeof value[0] === 'object') {
               value.forEach((v, i) => nest.appendChild(this.createCard(v, [...path, i])));
               const btn = document.createElement('button'); btn.className = 'btn-add-nested'; btn.innerText = '+ Add Item'; btn.onclick = () => this.addItemToArray(path); nest.appendChild(btn);
           } else {
               const txt = document.createElement('textarea'); txt.className = 'schema-input'; txt.value = value.join('\n');
               txt.onchange = (e) => this.modifyPath(path, e.target.value.split('\n').filter(x=>x)); nest.appendChild(txt);
               const btn = document.createElement('button'); btn.className = 'btn-add-nested'; btn.innerText = '+ Add Item'; btn.onclick = () => this.addItemToArray(path); nest.appendChild(btn);
           }
        } else {
           Object.keys(value).forEach(k => { if(!k.startsWith('@')) nest.appendChild(this.createField(k, value[k], [...path, k])); });

           const valueType = Array.isArray(value['@type']) ? value['@type'][0] : value['@type'];
           const available = valueType && SCHEMA_LIB[valueType] ? SCHEMA_LIB[valueType].fields || [] : [];
           const existing = new Set(Object.keys(value).filter(k => !k.startsWith('@')));
           const missing = available.filter(f => !existing.has(f));

           if (missing.length > 0) {
              const controls = document.createElement('div'); controls.className = 'nested-add-row';
              const select = document.createElement('select'); select.className = 'schema-input';
              missing.forEach(f => { const opt = document.createElement('option'); opt.value = f; opt.innerText = f; select.appendChild(opt); });
              const btn = document.createElement('button'); btn.className = 'btn-add-nested'; btn.innerText = '+ Add Field';
              btn.onclick = () => this.addFieldToObject(path, select.value);
              controls.appendChild(select); controls.appendChild(btn);
              nest.appendChild(controls);
           }
        }
        row.appendChild(nest); return row;
    }

    const input = document.createElement('input'); input.className = 'schema-input';
    if(FIELD_TYPES[key] === 'time') input.type = 'time';
    input.value = value || ''; 
    input.onchange = (e) => this.modifyPath(path, e.target.value);
    row.appendChild(input); return row;
  }

  // --- DATA MODIFIERS ---
  modifyPath(path, val) { let s = JSON.parse(JSON.stringify(this.state.schema)); let ref = s; for(let i=0; i<path.length-1; i++) { if(!ref[path[i]]) ref[path[i]]={}; ref=ref[path[i]]; } ref[path[path.length-1]] = val; this.updateState(s, 'visual'); }
  deletePath(path) { let s = JSON.parse(JSON.stringify(this.state.schema)); let ref = s; for(let i=0; i<path.length-1; i++) ref=ref[path[i]]; const last = path[path.length-1]; if(Array.isArray(ref)) ref.splice(last, 1); else delete ref[last]; this.updateState(s, 'visual'); }
  addItemToArray(path) {
    let s = JSON.parse(JSON.stringify(this.state.schema)); let ref = s; for(let i=0; i<path.length; i++) ref=ref[path[i]];
    if(Array.isArray(ref)) {
      const parentField = path[path.length-1];
      const isPrimitiveArray = FIELD_TYPES[parentField] === 'array' || ref.every(v => typeof v !== 'object');
      if (isPrimitiveArray) {
        ref.push("");
      } else {
        const tmpl = ref.length > 0 ? JSON.parse(JSON.stringify(ref[0])) : this.createDefaultNestedItem(parentField);
        const wipe = (o) => Object.keys(o).forEach(k=>{ if(typeof o[k]==='object') wipe(o[k]); else o[k]=""}); if(typeof tmpl === 'object') wipe(tmpl);
        ref.push(tmpl);
      }
    }
    this.updateState(s, 'visual');
  }
  addFieldToObject(path, field) { let s = JSON.parse(JSON.stringify(this.state.schema)); let ref = s; for(let i=0; i<path.length; i++) ref=ref[path[i]]; if(ref && typeof ref === 'object' && !Array.isArray(ref)) { ref[field] = this.defaultValueForField(field); } this.updateState(s, 'visual'); }
  createDefaultNestedItem(parentField) {
    const defaultType = DEFAULT_NESTED_TYPES[parentField];
    return defaultType ? { '@type': defaultType } : { '@type': 'Thing' };
  }

  updateState(newSchema, source) {
    if (source === 'json') {
      const list = this.state.schemaList.length ? [...this.state.schemaList] : [];
      const index = this.state.currentSchemaIndex || 0;
      list[index] = newSchema;
      this.state.schemaList = list;
    } else if (newSchema && Array.isArray(newSchema['@graph'])) {
      this.state.schemaList = newSchema['@graph'];
      const maxIndex = Math.max(0, this.state.schemaList.length - 1);
      this.state.currentSchemaIndex = Math.min(this.state.currentSchemaIndex, maxIndex);
    } else {
      this.state.schemaList = [newSchema];
      this.state.currentSchemaIndex = 0;
    }

    const aggregate = this.state.schemaList.length > 1
      ? { '@context': 'https://schema.org', '@graph': this.state.schemaList }
      : this.state.schemaList[0] || {};

    this.state.schema = aggregate;

    // Always re-render the visual view so UI updates reflect schema mutations
    // triggered from both the JSON editor and the visual builder.
    this.renderVisual(aggregate);

    const currentSchema = this.state.schemaList[this.state.currentSchemaIndex] || {};
    const jsonText = JSON.stringify(currentSchema, null, 2);
    const editor = document.getElementById('json-editor');
    if (editor) {
      editor.value = jsonText;
    }
    this.updateJsonValidity(jsonText);
    this.renderSchemaTabs();
    this.persistDraft(aggregate);
  }

  persistDraft(schema) {
    if (!this.state.url) return;
    const key = `draft_${btoa(this.state.url).slice(0, 32)}`;
    chrome.storage.local.set({ [key]: schema });
  }

  applySchemaList(list = []) {
    const schemas = Array.isArray(list) ? list.filter(Boolean) : [];
    this.state.schemaList = schemas;
    this.state.currentSchemaIndex = 0;

    const aggregate = schemas.length > 1
      ? { '@context': 'https://schema.org', '@graph': schemas }
      : schemas[0] || {};

    this.state.schema = aggregate;
    this.renderVisual(aggregate);

    const editor = document.getElementById('json-editor');
    const current = schemas[0] || {};
    const jsonText = Object.keys(current).length ? JSON.stringify(current, null, 2) : '';
    if (editor) editor.value = jsonText;
    this.updateJsonValidity(jsonText);
    this.renderSchemaTabs();
    this.persistDraft(aggregate);
  }

  setCurrentSchema(index) {
    if (index < 0 || index >= this.state.schemaList.length) return;
    this.state.currentSchemaIndex = index;

    const aggregate = this.state.schemaList.length > 1
      ? { '@context': 'https://schema.org', '@graph': this.state.schemaList }
      : this.state.schemaList[index] || {};

    this.state.schema = aggregate;
    const current = this.state.schemaList[index] || {};
    const jsonText = Object.keys(current).length ? JSON.stringify(current, null, 2) : '';
    const editor = document.getElementById('json-editor');
    if (editor) editor.value = jsonText;
    this.updateJsonValidity(jsonText);
    this.renderVisual(aggregate);
    this.renderSchemaTabs();
    this.persistDraft(aggregate);
  }

  renderSchemaTabs() {
    const container = document.getElementById('schema-tab-list');
    if (!container) return;
    container.textContent = '';

    if (!this.state.schemaList.length) {
      const empty = document.createElement('div');
      empty.className = 'schema-tab';
      empty.textContent = 'No schema detected';
      container.appendChild(empty);
      return;
    }

    this.state.schemaList.forEach((schema, idx) => {
      const button = document.createElement('button');
      button.className = `schema-tab ${idx === this.state.currentSchemaIndex ? 'active' : ''}`;

      const dot = document.createElement('span');
      dot.className = `status-dot ${schema?.error ? 'offline' : 'online'}`;
      button.appendChild(dot);

      const label = document.createElement('span');
      label.textContent = `Schema ${idx + 1}`;
      button.appendChild(label);

      button.addEventListener('click', () => this.setCurrentSchema(idx));
      container.appendChild(button);
    });
  }

  // --- SYSTEM ---
  setAuthStatus(isOnline) {
    const dot = document.getElementById('auth-status');
    if (!dot) return;

    dot.classList.remove('online', 'offline');
    dot.classList.add(isOnline ? 'online' : 'offline');
    document.getElementById('login-btn').style.display = isOnline ? 'none' : 'block';
  }

  async checkAuth() {
    chrome.identity.getAuthToken({ interactive: false }, (t) => {
      if (chrome.runtime.lastError || !t) {
        this.setAuthStatus(false);
        return;
      }

      this.state.authToken = t;
      this.setAuthStatus(true);
    });
  }

  async login() {
    chrome.identity.getAuthToken({ interactive: true }, (t) => {
      if (chrome.runtime.lastError || !t) {
        this.setAuthStatus(false);
        return;
      }

      this.state.authToken = t;
      this.setAuthStatus(true);
    });
  }
  
  async scanPage() {
    chrome.tabs.query({active:true, currentWindow:true}, (tabs) => {
      if(!tabs[0]) return;
      chrome.tabs.sendMessage(tabs[0].id, {action:"scanPage"}, (res) => {
           if (chrome.runtime.lastError || !res) {
             console.warn('Scan request failed', chrome.runtime.lastError);
             this.toast('Unable to scan page context', 'error');
             return;
           }

           this.state.url = res.url; this.state.gtmId = res.gtmId;
           document.getElementById('current-url').textContent = res.url;
           document.getElementById('gtm-status').textContent = res.gtmId || "No GTM";

          if(res.existingSchema && res.existingSchema.length > 0) {
               this.applySchemaList(res.existingSchema);
               const warning = res.hadSchemaErrors ? ' (with syntax issues detected)' : '';
               this.toast(`Loaded ${res.existingSchema.length} Schema Objects${warning}!`);
               return;
           }

           this.restoreDraft();
       });
    });
  }

  async runAI() {
    if (!this.state.geminiKey) {
      this.toast("API Key Required", "error");
      return;
    }

    const btn = document.getElementById('ai-scan-btn');
    btn.disabled = true;
    btn.innerHTML = 'Thinking...';
    document.getElementById('progress-container').style.display = 'block';

    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      if (!tabs || !tabs[0]) {
        this.toast("No active tab found", "error");
        this.resetAiButton(btn);
        return;
      }

      chrome.tabs.sendMessage(tabs[0].id, { action: "scanPage" }, async (res) => {
        if (chrome.runtime.lastError || !res) {
          console.warn('AI scan request failed', chrome.runtime.lastError);
          this.toast("Unable to scan page", "error");
          this.resetAiButton(btn);
          return;
        }

        const prompt = `Generate JSON-LD Schema for:\n${res.content}\nStrict JSON only.`;

        try {
          const data = await this.net.fetchWithRetry(
            `https://generativelanguage.googleapis.com/v1beta/models/${this.state.modelName}:generateContent?key=${this.state.geminiKey}`,
            {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }] })
            },
            (a, m) => document.querySelector('.progress-fill').style.width = `${(a / m) * 100}%`
          );

          const candidateText = data?.candidates?.[0]?.content?.parts?.[0]?.text;
          if (!candidateText) {
            throw new Error("No AI response content");
          }

          const sanitized = candidateText.replace(/```json/g, '').replace(/```/g, '').trim();
          const parsed = JSON.parse(sanitized);

          this.updateState(parsed);
          this.toast("AI Generated!");
        } catch (error) {
          console.error('AI generation failed', error);
          const message = error instanceof Error ? error.message : 'AI Error';
          this.toast(message, "error");
        } finally {
          this.resetAiButton(btn);
        }
      });
    });
  }

  resetAiButton(btn) {
    btn.disabled = false;
    btn.innerHTML = '<span class="material-icons">auto_awesome</span><span class="btn-text">AI Generate</span>';
    document.getElementById('progress-container').style.display = 'none';
    document.querySelector('.progress-fill').style.width = '0%';
  }

  async publish() {
     // Placeholder for GTM Publish Logic - In full version this connects to GTM API
     if(!this.state.authToken) return this.toast("Please Login", "error");
     this.toast("Sending to GTM...");
  }

  restoreDraft() {
    if (!this.state.url) return;

    const key = `draft_${btoa(this.state.url).slice(0,32)}`;
    chrome.storage.local.get([key], (data) => {
      if (chrome.runtime.lastError) {
        console.warn('Draft restore failed', chrome.runtime.lastError);
        return;
      }

      if (data && data[key]) {
        const stored = data[key];
        if (stored && Array.isArray(stored['@graph'])) {
          this.applySchemaList(stored['@graph']);
        } else if (stored) {
          this.applySchemaList([stored]);
        }
        this.toast('Restored saved draft');
      }
    });
  }

  openGoogleValidator() {
    if (!this.state.url) {
      this.toast('Scan a page before opening Rich Results Test', 'error');
      return;
    }

    const testUrl = `https://search.google.com/test/rich-results?url=${encodeURIComponent(this.state.url)}`;
    chrome.tabs.create({ url: testUrl });
  }

  openSchemaValidator() {
    if (!this.state.url) {
      this.toast('Scan a page before opening Schema.org Validator', 'error');
      return;
    }

    const testUrl = `https://validator.schema.org/#url=${encodeURIComponent(this.state.url)}`;
    chrome.tabs.create({ url: testUrl });
  }

  validateJson() {
    const editor = document.getElementById('json-editor');
    if (!editor) return;

    const raw = editor.value || '';
    const trimmed = raw.trim();
    this.updateJsonValidity(trimmed);

    if (!trimmed) {
      this.toast('No JSON to validate', 'error');
      return;
    }

    let parsed;
    try {
      parsed = JSON.parse(trimmed);
    } catch (error) {
      this.toast('JSON is invalid: unable to parse', 'error');
      return;
    }

    const issues = [];
    if (Array.isArray(parsed) || typeof parsed !== 'object' || parsed === null) {
      issues.push('Root should be a JSON object.');
    }
    if (!parsed['@context']) {
      issues.push('Missing @context.');
    }
    if (!parsed['@type'] && !parsed['@graph']) {
      issues.push('Schema should include @type or @graph.');
    }
    if (parsed['@graph'] && !Array.isArray(parsed['@graph'])) {
      issues.push('@graph must be an array.');
    }

    if (issues.length === 0) {
      this.toast('JSON-LD looks valid');
      this.updateState(parsed, 'json');
    } else {
      this.toast(issues.join(' '), 'error');
    }
  }

  toast(msg, type="info") { const t = document.createElement('div'); t.className = `toast ${type}`; t.innerText = msg; document.getElementById('toast-container').appendChild(t); setTimeout(()=>t.remove(), 3000); }

  updateJsonValidity(text) {
    const indicator = document.getElementById('json-validity');
    if (!indicator) return;

    indicator.classList.remove('json-valid', 'json-invalid', 'json-empty');

    const trimmed = (text || '').trim();
    if (!trimmed) {
      indicator.textContent = 'No JSON';
      indicator.classList.add('json-empty');
      return;
    }

    try {
      JSON.parse(trimmed);
      indicator.textContent = 'Valid JSON';
      indicator.classList.add('json-valid');
    } catch (err) {
      indicator.textContent = 'Invalid JSON';
      indicator.classList.add('json-invalid');
    }
  }
}

const app = new App();
document.addEventListener('DOMContentLoaded', () => app.init());
