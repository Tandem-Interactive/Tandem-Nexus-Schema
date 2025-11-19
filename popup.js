/**
 * TANDEM NEXUS SCHEMA v4.3
 * Fixed Rendering Logic & Models
 */

const SCHEMA_LIB = {
  "Organization": { icon: "business", fields: ["name", "url", "logo", "sameAs", "contactPoint"] },
  "LocalBusiness": { icon: "store", fields: ["name", "image", "telephone", "email", "address", "geo", "priceRange", "openingHoursSpecification"] },
  "Product": { icon: "shopping_bag", fields: ["name", "image", "description", "sku", "brand", "offers", "aggregateRating"] },
  "Article": { icon: "article", fields: ["headline", "image", "datePublished", "dateModified", "author", "publisher"] },
  "FAQPage": { icon: "quiz", fields: ["mainEntity"] },
  "Question": { icon: "help", fields: ["name", "acceptedAnswer"] },
  "Answer": { icon: "check_circle", fields: ["text"] },
  "BreadcrumbList": { icon: "linear_scale", fields: ["itemListElement"] },
  "OpeningHoursSpecification": { icon: "schedule", fields: ["dayOfWeek", "opens", "closes"] },
  "VideoObject": { icon: "play_circle", fields: ["name", "description", "thumbnailUrl", "uploadDate"] }
};

const FIELD_TYPES = {
  "dayOfWeek": "week_checkbox", "opens": "time", "closes": "time",
  "image": "array", "sameAs": "array", "mainEntity": "nested_array",
  "itemListElement": "nested_array", "offers": "nested_object",
  "address": "nested_object", "geo": "nested_object", "acceptedAnswer": "nested_object"
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
  constructor() { this.MAX_RETRIES = 20; this.BASE_DELAY = 2000; this.MAX_DELAY = 10000; }
  async fetchWithRetry(url, options, onProgress) {
    let attempt = 0;
    while (attempt < this.MAX_RETRIES) {
      try {
        const response = await fetch(url, options);
        if (response.ok) return await response.json();
      } catch (error) {}
      attempt++;
      if (attempt >= this.MAX_RETRIES) throw new Error("Max retries reached.");
      const delay = Math.min(this.MAX_DELAY, this.BASE_DELAY * Math.pow(1.2, attempt));
      if (onProgress) onProgress(attempt, this.MAX_RETRIES, delay);
      await new Promise(r => setTimeout(r, delay));
    }
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
      url: null,
      gtmId: null
    };
    this.net = new NetworkClient();
  }

  async init() {
    try {
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

  // --- WIZARD ---
  initWizard() {
    document.getElementById('app-container').style.display = 'none';
    document.getElementById('setup-wizard').style.display = 'flex';
    
    const show = (id) => {
        document.querySelectorAll('.wizard-step').forEach(el => el.classList.remove('active'));
        document.getElementById(id).classList.add('active');
    }

    document.getElementById('btn-step-1').onclick = () => {
        const key = document.getElementById('wiz-api-key').value.trim();
        if(!key) return this.toast("API Key Required", "error");
        chrome.storage.sync.set({geminiKey: key});
        this.state.geminiKey = key;
        show('step-2');
    };
    document.getElementById('btn-step-2').onclick = () => show('step-3');
    document.getElementById('back-step-2').onclick = () => show('step-1');
    document.getElementById('btn-step-3').onclick = () => {
        const cid = document.getElementById('new-client-id').value.trim();
        if(!cid) return this.toast("Client ID Required", "error");
        this.tempCid = cid;
        show('step-4');
    }
    document.getElementById('back-step-3').onclick = () => show('step-2');
    document.getElementById('generate-manifest').onclick = () => {
        const blob = new Blob([MANIFEST_TEMPLATE(this.tempCid)], {type: "application/json"});
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a'); a.href = url; a.download = "manifest.json"; a.click();
    }
    document.getElementById('back-step-4').onclick = () => show('step-3');
  }

  // --- MAIN APP ---
  initApp() {
    document.getElementById('setup-wizard').style.display = 'none';
    document.getElementById('app-container').style.display = 'flex'; // Flex for column layout
    this.bindUI();
    this.checkAuth();
    this.scanPage();
  }

  bindUI() {
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
    document.getElementById('publish-btn').onclick = () => this.publish();
    document.getElementById('undo-btn').onclick = () => this.scanPage();

    // JSON Editor Sync
    document.getElementById('json-editor').oninput = (e) => {
      try { const j = JSON.parse(e.target.value); this.state.schema = j; this.renderVisual(j); } catch(e){}
    };
    
    // Tab Switch
    document.querySelectorAll('.tab').forEach(t => t.onclick = (e) => {
        document.querySelectorAll('.tab').forEach(x => x.classList.remove('active'));
        document.querySelectorAll('.view').forEach(x => x.classList.remove('active'));
        e.target.classList.add('active');
        document.getElementById(e.target.dataset.view + '-view').classList.add('active');
    });
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
    if(SCHEMA_LIB[type].fields) SCHEMA_LIB[type].fields.forEach(f => block[f] = "");
    
    let current = this.state.schema;
    if(Object.keys(current).length === 0) current = { "@context": "https://schema.org", ...block };
    else if(current['@graph']) current['@graph'].push(block);
    else { const old = JSON.parse(JSON.stringify(current)); delete old['@context']; current = { "@context": "https://schema.org", "@graph": [old, block] }; }
    
    this.updateState(current);
    document.getElementById('add-block-modal').style.display = 'none';
  }

  // --- VISUAL RENDERER (FIXED DATA FLOW) ---
  renderVisual(data) {
    const container = document.getElementById('visual-editor'); 
    container.innerHTML = '';
    
    let items = [];
    if(data['@graph']) items = data['@graph'];
    else if(Object.keys(data).length > 0) items = [data];

    if(items.length === 0) {
        container.innerHTML = `<div class="empty-state"><div class="empty-icon-bg"><span class="material-icons">schema</span></div><p>No Schema Data</p><small>Use AI or click '+' to add.</small></div>`;
    } else {
        items.forEach((item, index) => {
            const path = data['@graph'] ? ['@graph', index] : [];
            container.appendChild(this.createCard(item, path));
        });
    }
    
    // Always restore FAB
    const fab = document.createElement('button'); fab.id = 'fab-add'; fab.className = 'fab'; fab.innerHTML = '<span class="material-icons">add</span>';
    fab.onclick = () => this.openAddModal();
    container.appendChild(fab);
  }

  createCard(item, path) {
    const type = item['@type'] || 'Thing';
    const def = SCHEMA_LIB[type] || { icon: 'code', fields: [] };
    const keys = new Set([...(def.fields || []), ...Object.keys(item).filter(k => !k.startsWith('@'))]);
    
    const card = document.createElement('div'); card.className = 'schema-card';
    card.innerHTML = `<div class="card-header"><div class="card-title"><span class="material-icons">${def.icon}</span> ${type}</div><div class="card-actions"><span class="material-icons delete-card" style="color:#ef4444; cursor:pointer;">delete</span><span class="material-icons expand-icon">expand_more</span></div></div><div class="card-body"></div>`;
    
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
           }
        } else {
           Object.keys(value).forEach(k => { if(!k.startsWith('@')) nest.appendChild(this.createField(k, value[k], [...path, k])); });
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
  addItemToArray(path) { let s = JSON.parse(JSON.stringify(this.state.schema)); let ref = s; for(let i=0; i<path.length; i++) ref=ref[path[i]]; if(Array.isArray(ref)) { const tmpl = ref.length > 0 ? JSON.parse(JSON.stringify(ref[0])) : {"@type":"Thing"}; const wipe = (o) => Object.keys(o).forEach(k=>{ if(typeof o[k]==='object') wipe(o[k]); else o[k]=""}); wipe(tmpl); ref.push(tmpl); } this.updateState(s, 'visual'); }

  updateState(newSchema, source) {
    this.state.schema = newSchema;
    if(source !== 'visual') this.renderVisual(newSchema);
    
    // We do NOT aggressive clean here to prevent losing data while editing
    document.getElementById('json-editor').value = JSON.stringify(newSchema, null, 2);
    
    if(this.state.url) {
        const key = `draft_${btoa(this.state.url).slice(0,32)}`;
        chrome.storage.local.set({ [key]: newSchema });
    }
  }

  // --- SYSTEM ---
  async checkAuth() { chrome.identity.getAuthToken({interactive: false}, (t) => { if(t) { this.state.authToken = t; document.getElementById('auth-status').className = 'status-dot online'; document.getElementById('login-btn').style.display = 'none'; } }); }
  async login() { chrome.identity.getAuthToken({interactive: true}, (t) => { if(t) { this.state.authToken = t; document.getElementById('auth-status').className = 'status-dot online'; document.getElementById('login-btn').style.display = 'none'; } }); }
  
  async scanPage() {
    chrome.tabs.query({active:true, currentWindow:true}, (tabs) => {
       if(!tabs[0]) return;
       chrome.tabs.sendMessage(tabs[0].id, {action:"scanPage"}, (res) => {
           if(res) {
               this.state.url = res.url; this.state.gtmId = res.gtmId;
               document.getElementById('current-url').innerText = res.url;
               document.getElementById('gtm-status').innerText = res.gtmId || "No GTM";
               
               // LOADING FIX: Check existing schema properly
               if(res.existingSchema && res.existingSchema.length > 0) {
                   const found = res.existingSchema.length === 1 ? res.existingSchema[0] : {"@context":"https://schema.org", "@graph":res.existingSchema};
                   this.updateState(found);
                   this.toast(`Loaded ${res.existingSchema.length} Schema Objects!`);
               }
           }
       });
    });
  }

  async runAI() {
    if(!this.state.geminiKey) return this.toast("API Key Required", "error");
    const btn = document.getElementById('ai-scan-btn'); btn.innerHTML = 'Thinking...';
    document.getElementById('progress-container').style.display = 'block';
    chrome.tabs.query({active:true, currentWindow:true}, (tabs) => {
        chrome.tabs.sendMessage(tabs[0].id, {action:"scanPage"}, async (res) => {
            const prompt = `Generate JSON-LD Schema for:\n${res.content}\nStrict JSON only.`;
            try {
                const data = await this.net.fetchWithRetry(`https://generativelanguage.googleapis.com/v1beta/models/${this.state.modelName}:generateContent?key=${this.state.geminiKey}`, { method: 'POST', headers: {'Content-Type':'application/json'}, body: JSON.stringify({contents:[{parts:[{text:prompt}]}]})}, (a,m) => document.querySelector('.progress-fill').style.width = `${(a/m)*100}%`);
                let txt = data.candidates[0].content.parts[0].text.replace(/```json/g,'').replace(/```/g,'').trim();
                this.updateState(JSON.parse(txt)); this.toast("AI Generated!");
            } catch(e) { this.toast("AI Error", "error"); }
            btn.innerHTML = '<span class="material-icons">auto_awesome</span><span class="btn-text">AI Generate</span>'; document.getElementById('progress-container').style.display = 'none';
        });
    });
  }

  async publish() {
     // Placeholder for GTM Publish Logic - In full version this connects to GTM API
     if(!this.state.authToken) return this.toast("Please Login", "error");
     this.toast("Sending to GTM...");
  }

  toast(msg, type="info") { const t = document.createElement('div'); t.className = `toast ${type}`; t.innerText = msg; document.getElementById('toast-container').appendChild(t); setTimeout(()=>t.remove(), 3000); }
}

const app = new App();
document.addEventListener('DOMContentLoaded', () => app.init());