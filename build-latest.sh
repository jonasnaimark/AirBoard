#!/bin/bash
echo "Creating performance-optimized ZXP..."
cd /Users/jonas_naimark/Documents/airboard-plugin

# Clean up any existing temp directory
if [ -d "temp-package" ]; then
    rm -rf temp-package
fi

# Create temp directory and copy files
mkdir temp-package
cp -r CSXS client jsx assets temp-package/

# Navigate to temp directory and create ZXP
cd temp-package
../ZXPSignCmd -sign . ../dist/AirBoard-v4.1.2.zxp ../new-cert.p12 mypassword

# Return to parent directory
cd ..

# Clean up temp directory
rm -rf temp-package

# Verify the file was created
if [ -f "dist/AirBoard-v4.1.2.zxp" ]; then
    echo "✅ SUCCESS: ZXP created at dist/AirBoard-v4.1.2.zxp"
    ls -la dist/AirBoard-v4.1.2.zxp
else
    echo "❌ ERROR: ZXP file was not created"
fi