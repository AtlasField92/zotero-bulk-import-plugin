/**
 * bulkImportDialog.js — Bulk Import from URL List
 *
 * Logic for the Bulk Import dialog window (bulkImport.xhtml).
 */

"use strict";

const { Zotero, Cc, Ci, Services } = window.arguments[0];
const DONATE_URL = "https://www.buymeacoffee.com/atlasfield92";

var BulkImportDialog = {
  _selectedFilePath: null,
  _isRunning: false,
  _shouldStop: false,

  get _collectionSelect() { return document.getElementById("bi-collection-select"); },
  get _collectionPopup() { return document.getElementById("bi-collection-popup"); },
  get _filePathInput() { return document.getElementById("bi-file-path"); },
  get _delayInput() { return document.getElementById("bi-delay-input"); },
  get _progressContainer() { return document.getElementById("bi-progress-container"); },
  get _progressBar() { return document.getElementById("bi-progress-bar"); },
  get _progressLabel() { return document.getElementById("bi-progress-label"); },
  get _logContainer() { return document.getElementById("bi-log-container"); },
  get _startBtn() { return document.getElementById("bi-start-btn"); },
  get _closeBtn() { return document.getElementById("bi-close-btn"); },

  async onLoad() {
    this._populateCollections();
    var readyMsg = await document.l10n.formatValue("bulk-import-log-ready");
    this._log(readyMsg, "info");
  },

  onUnload() { this._shouldStop = true; },

  async _populateCollections() {
    var popup = this._collectionPopup;
    popup.innerHTML = "";
    var placeholderLabel = "— Select a collection —";
    try { placeholderLabel = await document.l10n.formatValue("bulk-import-collection-placeholder"); } catch (e) { }
    var placeholder = document.createXULElement("menuitem");
    placeholder.setAttribute("label", placeholderLabel);
    placeholder.setAttribute("value", "");
    placeholder.setAttribute("disabled", "true");
    popup.appendChild(placeholder);
    this._collectionSelect.selectedItem = placeholder;

    var libraryIDs = Zotero.Libraries.getAll().map(lib => lib.libraryID);
    for (let libID of libraryIDs) {
      var library = Zotero.Libraries.get(libID);
      var collections = Zotero.Collections.getByLibrary(libID, true);
      for (let col of collections) {
        var label = this._buildCollectionLabel(col, library.name);
        var item = document.createXULElement("menuitem");
        item.setAttribute("label", label);
        item.setAttribute("value", col.id);
        popup.appendChild(item);
      }
    }
  },

  _buildCollectionLabel(collection, libName) {
    var parts = [collection.name];
    var current = collection;
    while (current.parentID) {
      var parent = Zotero.Collections.get(current.parentID);
      if (!parent) break;
      parts.unshift(parent.name);
      current = parent;
    }
    parts.unshift(libName);
    return parts.join(" › ");
  },

  browseFile() {
    var fp = Cc["@mozilla.org/filepicker;1"].createInstance(Ci.nsIFilePicker);
    fp.init(window, "Select URL file", Ci.nsIFilePicker.modeOpen);
    fp.appendFilter("Text files (*.txt)", "*.txt");
    fp.open(rv => {
      if (rv === Ci.nsIFilePicker.returnOK) {
        this._selectedFilePath = fp.file.path;
        this._filePathInput.value = fp.file.path;
      }
    });
  },

  async startImport() {
    var collectionID = parseInt(this._collectionSelect.value, 10);
    if (!collectionID) {
      this._showError(await document.l10n.formatValue("bulk-import-error-no-collection"));
      return;
    }
    if (!this._selectedFilePath) {
      this._showError(await document.l10n.formatValue("bulk-import-error-no-file"));
      return;
    }

    var fileContents = Zotero.File.getContents(this._selectedFilePath);
    var urls = fileContents.split("\n").map(u => u.trim()).filter(Boolean);
    if (urls.length === 0) {
      this._showError(await document.l10n.formatValue("bulk-import-error-empty-file"));
      return;
    }

    var collection = Zotero.Collections.get(collectionID);
    var delayMs = (parseInt(this._delayInput.value, 10) || 3) * 1000;

    this._isRunning = true;
    this._shouldStop = false;
    this._setUIRunning(true);
    this._progressContainer.style.display = "flex";
    this._clearLog();

    var successCount = 0;
    var errorCount = 0;

    for (let i = 0; i < urls.length; i++) {
      if (this._shouldStop) { break; }
      var url = urls[i];
      this._updateProgress(i, urls.length);
      try {
        var result = await this._importURL(url, collection);
        if (result) {
          successCount++;
          let okMsg = await document.l10n.formatValue("bulk-import-url-ok", { url: url });
          this._log(`${okMsg} [${result === true ? "metadata" : result}]`, "ok");
        } else {
          errorCount++;
          let errMsg = await document.l10n.formatValue("bulk-import-url-error", { url: url, error: "No translator found" });
          this._log(errMsg, "warn");
        }
      } catch (e) {
        errorCount++;
        let errMsg = await document.l10n.formatValue("bulk-import-url-error", { url: url, error: e.message || e });
        this._log(errMsg, "err");
      }
      if (i < urls.length - 1 && !this._shouldStop) await this._sleep(delayMs);
    }

    this._updateProgress(urls.length, urls.length);
    this._isRunning = false;
    this._setUIRunning(false);
    let doneMsg = await document.l10n.formatValue("bulk-import-done", { success: successCount, errors: errorCount });
    Services.prompt.alert(window, "Import Summary", doneMsg);
  },

  async _importURL(url, collection) {
    if (!url) return false;

    // 1. Direct Extension check
    if (url.toLowerCase().split(/[?#]/)[0].endsWith(".pdf")) {
      return await this._importPDF(url, collection);
    }

    return new Promise((resolve, reject) => {
      let resolved = false;
      const timeoutId = setTimeout(() => { if (!resolved) { cleanup(); reject(new Error("Timeout")); } }, 60000);
      const stopCheck = setInterval(() => { if (this._shouldStop && !resolved) { cleanup(); reject(new Error("Stopped")); } }, 500);
      const cleanup = () => { resolved = true; clearTimeout(timeoutId); clearInterval(stopCheck); };

      try {
        Zotero.HTTP.processDocuments(url, async (doc) => {
          if (resolved) return;
          try {
            let res = doc ? await this._importByDocument(doc, collection) : false;
            if (!res) {
              // Fallback: check headers if no doc or no metadata
              if (await this._checkIfPDF(url)) res = await this._importPDF(url, collection);
            }
            cleanup(); resolve(res);
          } catch (e) { cleanup(); reject(e); }
        }, async (err) => {
          if (resolved) return;
          try {
            if (await this._checkIfPDF(url)) {
              let res = await this._importPDF(url, collection);
              if (res) { cleanup(); resolve(res); return; }
            }
          } catch (e) { }
          cleanup(); resolve(false);
        });
      } catch (e) { cleanup(); reject(e); }
    });
  },

  async _checkIfPDF(url) {
    if (!url) return false;
    try {
      let response = await fetch(url, { method: "HEAD" });
      let ct = response.headers.get("Content-Type") || "";
      return ct.toLowerCase().includes("application/pdf");
    } catch (e) { return false; }
  },

  async _importByDocument(doc, collection) {
    let translate = new Zotero.Translate.Web();
    translate.setDocument(doc);
    let translators = await translate.getTranslators();
    if (translators && translators.length > 0) {
      translate.setTranslator(translators);
      let items = await translate.translate();
      if (items && items.length > 0) {
        for (let item of items) { item.addToCollection(collection.id); await item.saveTx(); }
        return "metadata";
      }
    }
    return await this._saveSnapshot(doc, collection);
  },

  async _saveSnapshot(doc, collection) {
    let zPane = Zotero.getActiveZoteroPane();
    if (zPane) {
      let item = await zPane.addItemFromDocument(doc);
      if (item) { item.addToCollection(collection.id); await item.saveTx(); return "snapshot"; }
    }
    return false;
  },

  async _importPDF(url, collection) {
    let filename = url.split('/').pop().split(/[?#]/)[0] || "document.pdf";
    if (!filename.toLowerCase().endsWith(".pdf")) filename += ".pdf";

    // Zotero often uses a single object as argument for its APIs
    let attachment = await Zotero.Attachments.importFromURL({
      url: url,
      libraryID: collection.libraryID,
      collections: [collection.id],
      title: filename
    });

    if (attachment) {
      if (Zotero.RecognizePDF) {
        try {
          // RecognizePDF.recognize also usually takes an item/attachment object
          await Zotero.RecognizePDF.recognize(attachment);
        } catch (e) {
          Zotero.debug(`BulkImport: PDF recognition failed: ${e.message}`);
        }
      }
      return "pdf";
    }
    return false;
  },

  _setUIRunning(running) {
    this._startBtn.style.display = running ? "none" : "inline-block";
    this._closeBtn.textContent = running ? "Stop" : "Close";
    this._closeBtn.onclick = running ? () => this._stop() : () => window.close();
  },

  _stop() { this._shouldStop = true; this._closeBtn.disabled = true; },

  _updateProgress(current, total) {
    this._progressBar.value = total > 0 ? (current / total) * 100 : 0;
    document.l10n.setArgs(this._progressLabel, { current, total });
  },

  _log(msg, type = "info") {
    let p = document.createElement("p");
    p.className = `log-${type}`;
    p.textContent = msg;
    this._logContainer.appendChild(p);
    this._logContainer.scrollTop = this._logContainer.scrollHeight;
  },

  _clearLog() { this._logContainer.innerHTML = ""; },
  _showError(msg) { Services.prompt.alert(window, "Error", msg); },
  _sleep(ms) { return new Promise(r => setTimeout(r, ms)); },
  openDonate() { Zotero.launchURL(DONATE_URL); }
};
