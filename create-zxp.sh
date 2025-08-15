#!/bin/bash
cd /Users/jonas_naimark/Documents/airboard-plugin
rm -rf temp-package
mkdir temp-package
cp -r CSXS client jsx assets temp-package/
cd temp-package
../ZXPSignCmd -sign . ../dist/AirBoard-v2.4.9-performance-fix.zxp ../new-cert.p12 mypassword
cd ..
rm -rf temp-package
echo "ZXP created: dist/AirBoard-v2.4.9-performance-fix.zxp"
ls -la dist/AirBoard-v2.4.9-performance-fix.zxp