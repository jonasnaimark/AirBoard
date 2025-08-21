# 🛠️ AirBoard Development Environment Setup

## ⚠️ CRITICAL: Read This Every Time Context is Lost

### 🎯 **Quick Dev Environment Check**
```bash
# 1. Check if dev extension exists
ls -la "$HOME/Library/Application Support/Adobe/CEP/extensions/airboard-dev"

# 2. Should show: airboard-dev -> /Users/jonas_naimark/Documents/airboard-plugin

# 3. Check manifest is in DEV mode
grep "com.airboard.panel.dev" ~/Documents/airboard-plugin/CSXS/manifest.xml

# 4. Should show: ExtensionBundleId="com.airboard.panel.dev"
```

### 🚨 **If Dev Environment is Missing/Broken:**

#### Step 1: Fix Manifest (CRITICAL)
```bash
cd ~/Documents/airboard-plugin
```

**Edit `CSXS/manifest.xml` - Change these lines:**
```xml
<!-- FROM (Production): -->
ExtensionBundleId="com.airboard.panel"
ExtensionBundleName="AirBoard"
<Extension Id="com.airboard.panel" Version="1.0.0" />
<Extension Id="com.airboard.panel">
<Menu>AirBoard</Menu>

<!-- TO (Development): -->
ExtensionBundleId="com.airboard.panel.dev"
ExtensionBundleName="AirBoard Dev"
<Extension Id="com.airboard.panel.dev" Version="1.0.0" />
<Extension Id="com.airboard.panel.dev">
<Menu>AirBoard Dev</Menu>
```

#### Step 2: Enable CEP Debugging
```bash
defaults write com.adobe.CSXS.9.plist PlayerDebugMode 1
defaults write com.adobe.CSXS.10.plist PlayerDebugMode 1
defaults write com.adobe.CSXS.11.plist PlayerDebugMode 1
```

#### Step 3: Recreate Development Symlink
```bash
cd ~/Documents/airboard-plugin
./dev-sync.sh
```

#### Step 4: Restart After Effects
- **Quit After Effects completely**
- **Wait 5 seconds**
- **Restart After Effects**
- **Look for "AirBoard Dev" in Window > Extensions**

### ✅ **How to Verify Dev Environment is Working:**

When you open "AirBoard Dev" you should see:
- ✅ **"Device Templates [DEV MODE]"** in the header
- ✅ **🐛 Debug button** next to Device Templates
- ✅ **Debug panel appears** when clicking shadow/blur buttons
- ✅ **File changes reflect immediately** (after AE restart)

### 🔒 **Git Push Protection for Dev Environment:**

#### Problem: Git Push Resets Manifest to Production
When you push to GitHub, the build script temporarily changes the manifest to production mode, but this shouldn't affect your local dev files.

#### Solution: Git Hooks for Dev Environment Protection
```bash
# This is already implemented in .git/hooks/pre-push
# But here's what it does:

# 1. Creates backup before any git operations
# 2. Preserves your dev environment settings
# 3. Automatically restores dev mode after push
```

#### Manual Protection Commands:
```bash
# Before any git push, run:
cp CSXS/manifest.xml CSXS/manifest.xml.dev-backup

# After git push, restore dev mode:
cd ~/Documents/airboard-plugin
./dev-sync.sh
# Then fix manifest.xml if needed (see Step 1 above)
```

### 🔄 **Daily Development Workflow:**

#### Starting Development:
1. **Verify dev environment**: `ls -la "$HOME/Library/Application Support/Adobe/CEP/extensions/airboard-dev"`
2. **Check manifest is dev mode**: `grep "\.dev" ~/Documents/airboard-plugin/CSXS/manifest.xml`
3. **Open After Effects** → Window > Extensions → **"AirBoard Dev"**

#### Making Changes:
1. **Edit files** in `~/Documents/airboard-plugin/`
2. **Restart After Effects** to see changes
3. **Use debug panel** to troubleshoot

#### Before Git Operations:
1. **Create backup**: The pre-push hook does this automatically
2. **Push changes**: `git push origin main`
3. **Verify dev environment still works** after push

### 🚨 **Emergency Recovery Commands:**

If you lose your dev environment completely:
```bash
# 1. Restore from GitHub
cd ~/Documents
git clone https://github.com/jonasnaimark/AirBoard.git airboard-plugin-recovery
cp -r airboard-plugin-recovery/* airboard-plugin/

# 2. Fix manifest for dev mode (see Step 1 above)

# 3. Recreate symlink
cd ~/Documents/airboard-plugin
./dev-sync.sh

# 4. Enable CEP debugging (see Step 2 above)

# 5. Restart After Effects
```

### 📝 **Context Loss Prevention:**

**When working with Claude Code after context loss:**
1. **First, run the Quick Dev Environment Check** (top of this document)
2. **If broken, follow the "If Dev Environment is Missing/Broken" steps**
3. **Always verify you see "AirBoard Dev" with [DEV MODE] before continuing work**

### 🎯 **Key Files to Monitor:**

- **`CSXS/manifest.xml`** - Should contain `.dev` extensions IDs
- **`client/index.html`** - Should contain `[DEV MODE]` and debug button
- **Symlink** - Should exist at `~/Library/Application Support/Adobe/CEP/extensions/airboard-dev`

---

## ⚡ **Quick Reference:**

**✅ Dev Working**: "AirBoard Dev" in Extensions, [DEV MODE] header, debug button
**❌ Dev Broken**: Only "AirBoard" in Extensions, or no extension at all
**🔧 Fix Command**: Run steps 1-4 from "If Dev Environment is Missing/Broken"

**REMEMBER: Always check dev environment first when starting work after context loss!**