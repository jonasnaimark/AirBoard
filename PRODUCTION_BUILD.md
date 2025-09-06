# Production Build Instructions

## Overview
This document outlines the complete process for creating a new production release of AirBoard when requested.

## When to Create a Production Build
Only create a production build when explicitly requested by the user with phrases like:
- "make a new zxp"
- "create a new version"
- "push to github"
- "build and release"

## Complete Production Build Process

### 1. Update Version Numbers
Increment the version number (e.g., from 4.16.27 to 4.16.28) in the following files:

#### a. Source Manifest (`CSXS/manifest.xml`)
```xml
ExtensionBundleVersion="4.16.28"
```
Keep the `.dev` ID and "AirBoard Dev" name - these are for development.

#### b. Build Script (`build-latest.sh`)
Update TWO locations:
```bash
# Line ~41
sed -i '' 's/ExtensionBundleVersion="[^"]*"/ExtensionBundleVersion="4.16.28"/g' temp-package/CSXS/manifest.xml

# Line ~47
../ZXPSignCmd -sign . ../dist/AirBoard-v4.16.28.zxp ../new-cert.p12 mypassword

# Line ~56
if [ -f "dist/AirBoard-v4.16.28.zxp" ]; then
    echo "✅ SUCCESS: ZXP created at dist/AirBoard-v4.16.28.zxp"
    ls -la dist/AirBoard-v4.16.28.zxp
```

#### c. README.md
Update TWO locations:
```markdown
[![Version](https://img.shields.io/badge/version-4.16.28-blue.svg)](https://github.com/jonasnaimark/AirBoard/releases/tag/v4.16.28)

**[⬇️ Download AirBoard v4.16.28](dist/AirBoard-v4.16.28.zxp)**
```

#### d. Documentation (if applicable)
Update `KEYFRAME_SYSTEM_SUMMARY.md` footer:
```markdown
*Version: v4.16.28 - [Brief description of changes]*
```

### 2. Build the ZXP Package
Run the build script:
```bash
./build-latest.sh
```

This script automatically:
- Creates a temp directory with all plugin files
- Removes `[DEV MODE]` markers from HTML
- Removes debug panel code from production
- Changes manifest IDs from `.dev` to production
- Changes "AirBoard Dev" to "AirBoard"
- Updates version number in the package
- Signs the ZXP with certificate
- Creates the final ZXP in `dist/` folder

Expected output:
```
Creating production ZXP (removing DEV MODE markers)...
🧹 Removing [DEV MODE] markers for production...
✅ Production files cleaned
Signed successfully
✅ SUCCESS: ZXP created at dist/AirBoard-v4.16.28.zxp
```

### 3. Commit Changes
Stage all modified files:
```bash
git add -A
```

Create a descriptive commit message:
```bash
git commit -m "$(cat <<'EOF'
[Brief description of main changes]

- [Specific fix or feature 1]
- [Specific fix or feature 2]
- Version 4.16.28

🤖 Generated with [Claude Code](https://claude.ai/code)

Co-Authored-By: Claude <noreply@anthropic.com>
EOF
)"
```

### 4. Push to GitHub
```bash
git push origin main
```

This triggers the safety backup script which:
- Creates a backup at `/Users/jonas_naimark/Documents/airboard-backups/`
- Then pushes to GitHub

### 5. Verify the Release
After pushing, verify:
- [ ] ZXP file exists in `dist/` folder
- [ ] README shows correct version number and download link
- [ ] GitHub repository has the latest commit
- [ ] Download link in README works (after push completes)

## Version Numbering Convention
- **Major version** (4.x.x): Significant feature additions or architecture changes
- **Minor version** (x.16.x): New features or substantial improvements
- **Patch version** (x.x.28): Bug fixes, small improvements, documentation updates

## Important Notes

### What the Build Script Does
1. **Copies files** to temp directory (excludes dev-only files)
2. **Removes DEV markers** from HTML titles
3. **Removes debug panel** button and code from production
4. **Fixes manifest IDs** (removes `.dev` suffix)
5. **Updates version** in manifest
6. **Signs the ZXP** with certificate
7. **Cleans up** temp files

### Files That Get Modified During Build
- `client/index.html` - DEV MODE markers removed
- `client/js/main.js` - Debug panel code removed
- `CSXS/manifest.xml` - IDs and version updated

### What NOT to Do
- Don't build ZXP without user request
- Don't push to GitHub without user approval
- Don't skip version number updates
- Don't modify production IDs in source files (keep `.dev` in source)

## Common Issues and Solutions

### Certificate Issues
If signing fails with certificate error:
- Certificate file: `new-cert.p12`
- Password: `mypassword`
- Certificate must be in plugin root directory

### Version Conflicts
If version numbers get out of sync:
1. Check latest version in `dist/` folder
2. Update all files to match the next version
3. Rebuild the ZXP

### Build Script Errors
If `build-latest.sh` fails:
- Check file permissions: `chmod +x build-latest.sh`
- Verify ZXPSignCmd exists and is executable
- Ensure certificate file exists

## Example Full Release Flow

When user says "make a new zxp and push to github":

1. Update version from 4.16.27 to 4.16.28 in all files
2. Run `./build-latest.sh`
3. Commit with descriptive message about changes
4. Push to GitHub
5. Confirm completion to user with version number

## Testing Before Release

Always test in development environment first:
- Changes work as expected in After Effects
- No JavaScript errors in debug console
- All features still functional
- Delay nudging modes work correctly

## Archive Management

Old versions are automatically moved to `dist/_Archive/` when you manually organize them. The current version should always be directly in `dist/` folder for the README download link to work.

---

*Last Updated: December 2024*
*This document ensures consistent and complete production builds*