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

# Remove debug button from production build and clean up whitespace
sed -i '' '/<button onclick="addDebugPanel()"/,/<\/button>/d' temp-package/client/index.html
sed -i '' 's/Device Templates \[DEV MODE\] *$/Device Templates/g' temp-package/client/index.html

# Reset manifest to production settings (remove .dev from IDs)
sed -i '' 's/com\.airboard\.panel\.dev/com.airboard.panel/g' temp-package/CSXS/manifest.xml
sed -i '' 's/AirBoard Dev/AirBoard/g' temp-package/CSXS/manifest.xml

echo "✅ Production files cleaned"

# Navigate to temp directory and create ZXP
cd temp-package
../ZXPSignCmd -sign . ../dist/AirBoard-v4.9.3.zxp ../new-cert.p12 mypassword

# Return to parent directory
cd ..

# Clean up temp directory
rm -rf temp-package

# Verify the file was created
if [ -f "dist/AirBoard-v4.9.3.zxp" ]; then
    echo "✅ SUCCESS: ZXP created at dist/AirBoard-v4.9.3.zxp"
    ls -la dist/AirBoard-v4.9.3.zxp
else
    echo "❌ ERROR: ZXP file was not created"
fi