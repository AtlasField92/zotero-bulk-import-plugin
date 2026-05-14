#!/usr/bin/env bash
# build.sh — Creates the .xpi file for the "Bulk Import from URL List" Zotero plugin
#
# Usage: ./build.sh
# Output: bulk-importer.xpi (in the current directory)

set -e

PLUGIN_DIR="$(cd "$(dirname "$0")" && pwd)"
OUTPUT="$PLUGIN_DIR/bulk-importer.xpi"

echo "📦 Building Zotero plugin..."
echo "   Source directory: $PLUGIN_DIR"
echo "   Output file: $OUTPUT"

# Delete old XPI if it exists
rm -f "$OUTPUT"

# Create ZIP (= XPI) from plugin root
cd "$PLUGIN_DIR"
zip -r "$OUTPUT" \
  manifest.json \
  bootstrap.js \
  content/ \
  locale/ \
  icon.png \
  --exclude "*.DS_Store" \
  --exclude "__MACOSX"

echo ""
echo "✅ File created: $OUTPUT"
echo ""
echo "👉 To install in Zotero:"
echo "   Tools → Add-ons → ⚙ → Install Add-on From File…"
echo "   Then select: $OUTPUT"
