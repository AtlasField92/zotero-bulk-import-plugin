# Bulk Importer — Zotero Plugin

A Zotero plugin for bulk importing scientific references from a `.txt` file containing a list of URLs, while retrieving metadata via Zotero translators (just like the browser extension).

---

## Features

- 📋 **Target collection**: selection via a hierarchical dropdown (libraries + collections + sub-collections)
- 📂 **File picker**: open a `.txt` file via the native file explorer
- ⏱ **Configurable delay** between requests (default: 3 s)
- 📊 **Progress bar** + real-time log
- ✋ **Stop button** to cleanly interrupt the import
- 🔄 **Fallback**: if no Zotero translator is available, the webpage is saved as is

---

## Input File Format

A `.txt` text file, **one URL per line**:

```
https://doi.org/10.1038/s41586-023-00000-0
https://www.nature.com/articles/s41586-023-00001-0
https://pubmed.ncbi.nlm.nih.gov/12345678/
```

Empty lines are ignored.

---

## Installation

### 1. Generate the `.xpi` file

```bash
chmod +x build.sh
./build.sh
```

The `bulk-importer.xpi` file will be created in the project directory.

### 2. Install in Zotero

1. Open Zotero
2. `Tools → Add-ons`
3. Click the ⚙ icon in the top right
4. Choose **"Install Add-on From File…"**
5. Select `bulk-importer.xpi`
6. Restart Zotero if prompted

### 3. Use the plugin

1. In Zotero, go to `Tools → Bulk Import from URL List…`
2. Choose the **target collection** from the dropdown
3. Click **Browse…** to select your `.txt` file
4. Adjust the delay if necessary
5. Click **🚀 Start Import**

---

## Development (test without rebuild)

To test in development mode without creating an XPI:

1. Close Zotero
2. In the [Zotero profile directory](https://www.zotero.org/support/kb/profile_directory), open the `extensions/` folder
3. Create a file named `bulk-importer@atlasfield` (without extension) containing the absolute path to this directory, for example:
   ```
   /Users/atlasfield92/zotero_bulk_importer_extension
   ```
4. In `prefs.js` (same profile directory), delete the lines `extensions.lastAppBuildId` and `extensions.lastAppVersion`
5. Restart Zotero — the plugin will be loaded automatically

---

## Compatibility

| Zotero | Supported |
|--------|---------|
| 9.x    | ✅ Yes  |
| 8.x    | ✅ Yes  |
| 7.x    | ✅ Yes  |
| 6.x    | ❌ No   |

---

## Project Structure

```
zotero_bulk_import_extension/
├── manifest.json           ← Plugin metadata
├── bootstrap.js            ← Lifecycle + Tools menu injection
├── build.sh                ← XPI packaging script
├── content/
│   ├── bulkImport.xhtml    ← Dialog interface
│   ├── bulkImportDialog.js ← Import logic
│   └── bulkImport.css      ← Styles
└── locale/
    └── en-US/
        └── bulkImport.ftl  ← Localization strings
```
