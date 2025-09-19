# AirBoard Production Build Guide

**⚠️ UPDATED AFTER v4.16.49 - Complete process with all lessons learned**

## Overview
This document outlines the **complete** process for creating a production release of AirBoard. This was updated after v4.16.49 where several critical steps were initially missed, causing an incomplete GitHub release.

## 🎯 When to Create a Production Build
Only create a production build when explicitly requested by the user with phrases like:
- "make a new zxp"
- "create a new version" 
- "push to github"
- "let's push a new production build"
- **NEVER build automatically** - always ask user first

## 📋 COMPLETE Production Build Process

**⚠️ CRITICAL: Miss ANY step and the GitHub release will be incomplete!**

### Phase 1: Prepare ALL Files (Do NOT skip any!)

#### 1.1 Update Version in manifest.xml (AND convert to production mode)
```xml
<!-- STEP 1: Increment version number -->
<!-- FROM: ExtensionBundleVersion="4.16.49" -->
<!--   TO: ExtensionBundleVersion="4.16.50" -->

<!-- STEP 2: Convert ALL dev references to production -->
<!-- FROM: ExtensionBundleId="com.airboard.panel.dev" -->
<!--   TO: ExtensionBundleId="com.airboard.panel" -->

<!-- FROM: ExtensionBundleName="AirBoard Dev" -->
<!--   TO: ExtensionBundleName="AirBoard" -->

<!-- FROM: <Extension Id="com.airboard.panel.dev" Version="1.0.0" /> -->
<!--   TO: <Extension Id="com.airboard.panel" Version="1.0.0" /> -->

<!-- FROM: <Extension Id="com.airboard.panel.dev"> -->
<!--   TO: <Extension Id="com.airboard.panel"> -->

<!-- FROM: <Menu>AirBoard Dev</Menu> -->
<!--   TO: <Menu>AirBoard</Menu> -->
```

#### 1.2 Update CHANGELOG.md (REQUIRED!)
```markdown
## [4.16.50] - 2025-MM-DD ✨ **FEATURE NAME**
### ✨ New Features
- **Feature description**: What was added and why it helps users

### 🎨 UI/UX Improvements
- **Interface changes**: Any UI/UX improvements made

### 🔧 Technical Improvements  
- **Implementation details**: Technical changes made

## [4.16.49] - 2025-09-18 ✨ **SQUIRCLE RESOLUTION SCALING**
[Previous entries remain...]
```

#### 1.3 Update README.md (BOTH badge AND download link!)
```markdown
# FIND line ~4 - Version badge:
[![Version](https://img.shields.io/badge/version-4.16.50-blue.svg)](https://github.com/jonasnaimark/AirBoard/raw/main/dist/AirBoard-v4.16.50.zxp)

# FIND line ~8 - Download link:  
**[⬇️ Download AirBoard v4.16.50](https://github.com/jonasnaimark/AirBoard/raw/main/dist/AirBoard-v4.16.50.zxp)**
```

#### 1.4 Update build-latest.sh (ALL 3 locations!)
```bash
# Line ~41 - Manifest version update:
sed -i '' 's/ExtensionBundleVersion="[^"]*"/ExtensionBundleVersion="4.16.50"/g' temp-package/CSXS/manifest.xml

# Line ~47 - ZXP build command:
../ZXPSignCmd -sign . ../dist/AirBoard-v4.16.50.zxp ../new-cert.p12 mypassword

# Line ~56-58 - Verification check:
if [ -f "dist/AirBoard-v4.16.50.zxp" ]; then
    echo "✅ SUCCESS: ZXP created at dist/AirBoard-v4.16.50.zxp"
    ls -la dist/AirBoard-v4.16.50.zxp
```

#### d. Documentation (if applicable)
Update `KEYFRAME_SYSTEM_SUMMARY.md` footer:
```markdown
*Version: v4.16.28 - [Brief description of changes]*
```

---

### Phase 2: Build and Git Operations

#### 2.1 Build Production ZXP
```bash
./build-latest.sh
```

**MUST see this output:**
```
Creating production ZXP (removing DEV MODE markers)...
🧹 Removing [DEV MODE] markers for production...
✅ Production files cleaned
Signed successfully
✅ SUCCESS: ZXP created at dist/AirBoard-v4.16.50.zxp
```

#### 2.2 Stage ALL Changes (INCLUDING the ZXP file!)
```bash
git add -A                                    # Stage all modified files (including ZXP)
```

#### 2.3 Commit with Detailed Message
```bash
git commit -m "$(cat <<'EOF'
v4.16.50: Feature description with ZXP

✨ New Features:
- Feature 1: Detailed description of what was added
- Feature 2: How it benefits users

🎨 UI/UX Improvements:
- Interface improvement 1
- User experience enhancement 2

🔧 Technical:
- Implementation detail 1
- Code improvement 2

🤖 Generated with [Claude Code](https://claude.ai/code)

Co-Authored-By: Claude <noreply@anthropic.com>
EOF
)"
```

#### 2.4 Push to GitHub
```bash
git push origin main
```

---

### Phase 3: Restore Development Environment

#### 3.1 Convert manifest.xml BACK to Dev Mode
```xml
<!-- REVERT ALL production changes back to dev: -->

<!-- FROM: ExtensionBundleId="com.airboard.panel" -->
<!--   TO: ExtensionBundleId="com.airboard.panel.dev" -->

<!-- FROM: ExtensionBundleName="AirBoard" -->
<!--   TO: ExtensionBundleName="AirBoard Dev" -->

<!-- FROM: <Extension Id="com.airboard.panel" Version="1.0.0" /> -->
<!--   TO: <Extension Id="com.airboard.panel.dev" Version="1.0.0" /> -->

<!-- FROM: <Extension Id="com.airboard.panel"> -->
<!--   TO: <Extension Id="com.airboard.panel.dev"> -->

<!-- FROM: <Menu>AirBoard</Menu> -->
<!--   TO: <Menu>AirBoard Dev</Menu> -->
```

**Keep the incremented version number, only change the dev/production settings!**

---

## ✅ COMPLETE Production Build Verification Checklist

**Before marking build complete, verify ALL of these:**

### Files Updated Correctly:
- [ ] manifest.xml version incremented (e.g., 4.16.49 → 4.16.50)
- [ ] manifest.xml converted to production mode (no .dev, no "Dev")
- [ ] CHANGELOG.md has new version entry with detailed changes
- [ ] README.md version badge shows new version
- [ ] README.md download link points to new ZXP file
- [ ] build-latest.sh updated in all 3 places

### Build and Git Process:
- [ ] ZXP file built successfully (./build-latest.sh completed)
- [ ] All changes staged (git add -A)
- [ ] Commit created with detailed feature description
- [ ] Changes pushed to GitHub main branch

### GitHub Verification:
- [ ] GitHub page shows correct version number in README
- [ ] Version badge links to correct ZXP file
- [ ] Download link works and downloads new ZXP
- [ ] ZXP file is visible in GitHub dist/ folder
- [ ] Source code includes all new features

### Development Environment Restored:
- [ ] manifest.xml converted back to dev mode
- [ ] "AirBoard Dev" appears in After Effects Extensions menu
- [ ] Dev extension loads correctly
- [ ] Ready for continued development

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

---

## ⚠️ CRITICAL ISSUES LEARNED FROM v4.16.49

**These issues caused an incomplete GitHub release. DO NOT repeat them!**

### Issue #1: README.md Version References Not Updated
**Problem**: GitHub page shows old version badge and download link  
**Solution**: Update BOTH the version badge AND download link in README.md  
**Result if missed**: GitHub page looks outdated, confuses users

### Issue #2: build-latest.sh Has Hardcoded Versions  
**Problem**: Build script has version in 3 different places that must all be updated  
**Solution**: Update ALL 3 version references: manifest update, ZXP filename, verification check  
**Result if missed**: ZXP built with wrong version number

### Issue #3: Incomplete Push to GitHub
**Problem**: Push source code changes but forget ZXP file and README  
**Solution**: Follow complete checklist, verify all files pushed together  
**Result if missed**: GitHub repository incomplete, download links broken

### Issue #4: Dev Mode Not Restored
**Problem**: Leave manifest.xml in production mode, breaks dev environment  
**Solution**: ALWAYS restore dev mode settings after successful push  
**Result if missed**: Can't continue development, plugin broken in After Effects

---

## 🚨 Emergency Fixes

### If ZXP File Missing from GitHub:
```bash
git add dist/AirBoard-vX.X.X.zxp
git commit -m "Add missing v4.16.X ZXP file to repository"
git push origin main
```

### If README Shows Wrong Version:
```bash
# Update README.md badge and download link
git add README.md  
git commit -m "Update README.md version links to vX.X.X"
git push origin main
```

### If Build Script Has Wrong Version:
```bash
# Update all 3 version references in build-latest.sh
# Rebuild ZXP with correct version
./build-latest.sh
git add dist/AirBoard-vX.X.X.zxp build-latest.sh
git commit -m "Fix build script version and rebuild ZXP" 
git push origin main
```

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

**Example: When user says "make a new zxp and push to github" →**

1. ✅ Update version 4.16.49 → 4.16.50 in manifest.xml + convert to production mode
2. ✅ Update CHANGELOG.md with v4.16.50 entry  
3. ✅ Update README.md badge and download link to v4.16.50
4. ✅ Update build-latest.sh in all 3 places to v4.16.50
5. ✅ Run ./build-latest.sh (verify ZXP created)
6. ✅ git add -A (now includes ZXP files automatically)
7. ✅ Commit with detailed message
8. ✅ git push origin main  
9. ✅ Restore dev mode in manifest.xml
10. ✅ Verify GitHub shows v4.16.50 and ZXP downloads work

---

*Last Updated: December 2024 - After v4.16.49 lessons learned*  
*This document was completely revised to prevent incomplete GitHub releases*