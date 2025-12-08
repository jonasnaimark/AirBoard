#!/bin/bash
echo "Creating production ZXP (removing DEV MODE markers)..."
cd /Users/jonas_naimark/Documents/airboard-plugin

# Clean up any existing temp directory
if [ -d "temp-package" ]; then
    rm -rf temp-package
fi

# Create temp directory and copy files
mkdir temp-package
cp -r CSXS client jsx assets temp-package/

# Clean up development markers from production build
echo "🧹 Removing [DEV MODE] markers for production..."

# Remove [DEV MODE] from HTML titles and clean up extra spaces
sed -i '' 's/ \[DEV MODE\]//g' temp-package/client/index.html

# Remove debug button from production build (multi-line button)
# First remove the entire debug button block
perl -i -0pe 's/<button onclick="addDebugPanel\(\)"[^>]*>.*?<\/button>//gs' temp-package/client/index.html
# Then clean up the [DEV MODE] text
sed -i '' 's/Device Templates \[DEV MODE\]/Device Templates/g' temp-package/client/index.html

# Remove ALL debug panel related code from main.js
# 1. Remove the addDebugPanel function definition (multi-line)
sed -i '' '/\/\/ Add simple debug panel to the extension UI (DEV MODE only)/,/^};$/d' temp-package/client/js/main.js

# 2. Remove the auto-initialization call
sed -i '' '/addDebugPanel();/d' temp-package/client/js/main.js

# 3. Remove the comment about debug panel
sed -i '' '/\/\/ Add debug panel for testing (DEV MODE)/d' temp-package/client/js/main.js

# Reset manifest to production settings (remove .dev from IDs)
sed -i '' 's/com\.airboard\.panel\.dev/com.airboard.panel/g' temp-package/CSXS/manifest.xml
sed -i '' 's/AirBoard Dev/AirBoard/g' temp-package/CSXS/manifest.xml

# Update version number in manifest to match ZXP filename
sed -i '' 's/ExtensionBundleVersion="[^"]*"/ExtensionBundleVersion="4.16.92"/g' temp-package/CSXS/manifest.xml

echo "✅ Production files cleaned"

# Navigate to temp directory and create ZXP
cd temp-package
../ZXPSignCmd -sign . ../dist/AirBoard-v4.16.92.zxp ../new-cert.p12 mypassword

# Return to parent directory
cd ..

# Clean up temp directory
rm -rf temp-package

# Verify the file was created
if [ -f "dist/AirBoard-v4.16.92.zxp" ]; then
    echo "✅ SUCCESS: ZXP created at dist/AirBoard-v4.16.92.zxp"
    ls -la dist/AirBoard-v4.16.92.zxp
else
    echo "❌ ERROR: ZXP file was not created"
fi