/**
 * bootstrap.js — Bulk Import from URL List (Zotero plugin)
 *
 * Lifecycle hooks for a bootstrapped Zotero plugin.
 * Injects a "Bulk Import from URL List…" menu item under Tools.
 */

var chromeHandle;

/**
 * Called once when the plugin is first installed.
 */
function install(data, reason) { }

/**
 * Called when the plugin is enabled or Zotero starts.
 * Registers chrome resources and sets up window observers.
 */
function startup({ id, version, rootURI }, reason) {
  // Plugin is bootstrapped here

  // Register chrome content so dialogs can load resources
  var aomStartup = Cc["@mozilla.org/addons/addon-manager-startup;1"].getService(
    Ci.amIAddonManagerStartup
  );
  var manifestURI = Services.io.newURI(rootURI + "manifest.json");
  chromeHandle = aomStartup.registerChrome(manifestURI, [
    ["content", "bulk-import", rootURI + "content/"],
    ["locale", "bulk-import", "en-US", rootURI + "locale/en-US/"],
    ["locale", "bulk-import", "fr-FR", rootURI + "locale/fr-FR/"],
    ["locale", "bulk-import", "zh-CN", rootURI + "locale/zh-CN/"],
    ["locale", "bulk-import", "hi-IN", rootURI + "locale/hi-IN/"],
    ["locale", "bulk-import", "es-ES", rootURI + "locale/es-ES/"],
    ["locale", "bulk-import", "ar", rootURI + "locale/ar/"],
    ["locale", "bulk-import", "pt-BR", rootURI + "locale/pt-BR/"],
    ["locale", "bulk-import", "ru-RU", rootURI + "locale/ru-RU/"],
    ["locale", "bulk-import", "ja-JP", rootURI + "locale/ja-JP/"],
    ["locale", "bulk-import", "de-DE", rootURI + "locale/de-DE/"],
  ]);

  // Store rootURI for use in window hooks
  Zotero.BulkImport = { rootURI };

  // Register for every (current + future) main window
  for (let win of Zotero.getMainWindows()) {
    onMainWindowLoad({ window: win });
  }
  Zotero.BulkImport._windowListener = {
    onOpenWindow(xulWindow) { },
    onCloseWindow(xulWindow) { },
  };
  // Use Zotero's own hook mechanism
}

/**
 * Called when a main Zotero window opens.
 * Injects the Tools menu item.
 */
function onMainWindowLoad({ window }) {
  Zotero.debug("bulk-import: onMainWindowLoad triggered");
  var doc = window.document;

  // Avoid double-injection
  if (doc.getElementById("bulk-import-menu-item")) {
    Zotero.debug("bulk-import: menu item already exists");
    return;
  }

  // Try multiple possible IDs for the tools menu popup
  var toolsMenu = doc.getElementById("menu_ToolsPopup") || doc.getElementById("menu_toolsPopup");
  if (!toolsMenu) {
    Zotero.debug("bulk-import: toolsMenu not found! Available menus:");
    Zotero.debug("bulk-import: menu_Tools: " + !!doc.getElementById("menu_Tools"));
    return;
  }

  Zotero.debug("bulk-import: toolsMenu found, creating menuitem");
  var menuItem = doc.createXULElement("menuitem");
  menuItem.id = "bulk-import-menu-item";

  // Localize menu item based on Zotero locale
  var label = "Bulk Import from URL List…"; // Default English
  if (Zotero.locale === "fr-FR") {
    label = "Import en masse depuis un fichier d'URLs…";
  }
  menuItem.setAttribute("label", label);
  menuItem.addEventListener("command", () => _openDialog(window));

  // Insert before the first separator or at the end
  var firstSep = toolsMenu.querySelector("menuseparator");
  if (firstSep) {
    toolsMenu.insertBefore(menuItem, firstSep);
  } else {
    toolsMenu.appendChild(menuItem);
  }

  Zotero.debug("bulk-import: menuitem successfully injected");

  Zotero.BulkImport._injectedWindows = Zotero.BulkImport._injectedWindows || new Set();
  Zotero.BulkImport._injectedWindows.add(doc);
}

/**
 * Called when a main Zotero window closes.
 * Nothing special needed here — DOM is auto-cleaned.
 */
function onMainWindowUnload({ window }) { }

/**
 * Called when the plugin is disabled, uninstalled, or Zotero shuts down.
 * Remove injected UI from all open windows.
 */
function shutdown(data, reason) {
  if (chromeHandle) {
    chromeHandle.destruct();
    chromeHandle = null;
  }

  for (let win of Zotero.getMainWindows()) {
    win.document.getElementById("bulk-import-menu-item")?.remove();
  }

  delete Zotero.BulkImport;
}

/**
 * Called when the plugin is uninstalled (after shutdown).
 */
function uninstall(data, reason) { }

/**
 * Opens the Bulk Import dialog window.
 */
function _openDialog(win) {
  var rootURI = Zotero.BulkImport.rootURI;
  win.openDialog(
    "chrome://bulk-import/content/bulkImport.xhtml",
    "bulk-import-dialog",
    "chrome,centerscreen,resizable=yes,width=680,height=620",
    { Zotero: Zotero, Cc: Cc, Ci: Ci, Services: Services }
  );
}
