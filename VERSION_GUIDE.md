# Version Management Guide - AirBoard Plugin

## Version Number Format

### Semantic Versioning (SemVer)
We follow Semantic Versioning 2.0.0: **MAJOR.MINOR.PATCH**

```
1.0.0
│ │ └── PATCH: Bug fixes, minor improvements
│ └──── MINOR: New features, backward compatible
└────── MAJOR: Breaking changes, major features
```

## Version Increment Rules

### PATCH Version (x.x.X)
Increment when:
- Fixing bugs
- Minor performance improvements
- Typo corrections
- Small UI adjustments
- Documentation fixes

Examples:
- `1.0.0` → `1.0.1`: Fixed gesture animation timing
- `1.2.3` → `1.2.4`: Corrected status bar positioning

### MINOR Version (x.X.x)
Increment when:
- Adding new features
- Adding new device presets
- Adding new gesture types
- Adding new effects
- Non-breaking improvements

Examples:
- `1.0.5` → `1.1.0`: Added Android device support
- `1.3.2` → `1.4.0`: Added new material effects

### MAJOR Version (X.x.x)
Increment when:
- Breaking API changes
- Major UI overhaul
- Removing features
- Changing core functionality
- Incompatible changes

Examples:
- `1.5.3` → `2.0.0`: Complete rewrite of effect system
- `2.4.1` → `3.0.0`: Dropped support for CC 2019

## Pre-release Versions

### Format
```
MAJOR.MINOR.PATCH-PRERELEASE.NUMBER
```

### Pre-release Tags
- `alpha`: Early testing, may be unstable
- `beta`: Feature complete, testing phase
- `rc`: Release candidate, final testing

### Examples
- `1.0.0-alpha.1`: First alpha of version 1.0.0
- `1.0.0-beta.3`: Third beta release
- `1.0.0-rc.1`: Release candidate

## Build Metadata

### Format
```
MAJOR.MINOR.PATCH+BUILD
```

### Examples
- `1.0.0+20240115`: Built on January 15, 2024
- `1.0.0+build.29`: Build number 29
- `1.0.0+sha.5114f85`: Git commit hash

## Version Update Checklist

### Files to Update

1. **CSXS/manifest.xml**
```xml
ExtensionBundleVersion="1.0.0"
```

2. **package.json**
```json
{
  "version": "1.0.0"
}
```

3. **README.md**
```markdown
# AirBoard Plugin v1.0.0
```

4. **jsx/main.jsx**
```javascript
var PLUGIN_VERSION = "1.0.0";
```

5. **CHANGELOG.md**
```markdown
## [1.0.0] - 2024-01-15
### Added
- Initial release
```

## Git Tag Convention

### Creating Version Tags

1. **For releases:**
```bash
git tag -a v1.0.0 -m "Release version 1.0.0"
git push origin v1.0.0
```

2. **For pre-releases:**
```bash
git tag -a v1.0.0-beta.1 -m "Beta release 1.0.0-beta.1"
git push origin v1.0.0-beta.1
```

### Tag Naming Rules
- Always prefix with `v`
- Use exact version number
- Include descriptive message

## Release Process

### 1. Pre-release Checklist
- [ ] All tests passing
- [ ] Documentation updated
- [ ] CHANGELOG.md updated
- [ ] Version numbers synchronized

### 2. Version Bump
```bash
# On release branch
git checkout -b release/v1.0.0

# Update version in all files
# Run tests
# Commit changes
git commit -m "chore(release): bump version to 1.0.0"
```

### 3. Create Release
```bash
# Merge to main
git checkout main
git merge --no-ff release/v1.0.0

# Tag the release
git tag -a v1.0.0 -m "Release version 1.0.0"

# Push everything
git push origin main
git push origin v1.0.0
```

### 4. Build Distribution
```bash
# Current ZXP build process
rm -rf temp-package && mkdir temp-package
cp -r CSXS client jsx assets temp-package/
./ZXPSignCmd -sign temp-package dist/AirBoard_v2.8.6.zxp new-cert.p12 mypassword
rm -rf temp-package

# Verify build
ls -la dist/AirBoard_v2.8.6.zxp

# Output: dist/AirBoard_v[VERSION].zxp
```

## 🚀 Quick ZXP Build Guide

### Complete ZXP Build Process

**IMPORTANT: Always increment version number before building!**

#### Step 1: Update Version in Manifest
```bash
# Edit CSXS/manifest.xml
# Change: ExtensionBundleVersion="4.8.0" 
# To:     ExtensionBundleVersion="4.9.0"
```

#### Step 2: Update build-latest.sh Script
```bash
# Edit build-latest.sh
# Update ZXP filename to new version:
# Change: AirBoard-v4.8.0.zxp
# To:     AirBoard-v4.9.0.zxp
```

#### Step 3: Build Production ZXP (for sharing)
```bash
# Use the production build script (RECOMMENDED for sharing)
./build-latest.sh

# This automatically:
# - Removes [DEV MODE] markers from HTML
# - Removes debug button from production build
# - Converts com.airboard.panel.dev → com.airboard.panel
# - Changes "AirBoard Dev" → "AirBoard"
# - Creates: dist/AirBoard-v4.9.0.zxp
```

#### Alternative: Manual Dev Build (for testing)
```bash
# Only use this for development testing, NOT for sharing
rm -rf temp-package && mkdir temp-package
cp -r CSXS client jsx assets temp-package/
./ZXPSignCmd -sign temp-package dist/AirBoard_v4.9.0.zxp new-cert.p12 mypassword
rm -rf temp-package
# Creates: dist/AirBoard_v4.9.0.zxp (keeps dev settings)
```

#### Step 4: Verify Build
```bash
# Check the new ZXP exists in dist folder
ls -la dist/AirBoard-v4.9.0.zxp

# Should show file with current timestamp
```

## 🚨 CRITICAL: Production vs Development ZXP

### ⚠️ DON'T BUILD DEV ZXP FOR SHARING!

**WRONG** ❌ - Building dev ZXP for sharing:
```bash
# This creates a DEV ZXP with debug features - DON'T share this!
./ZXPSignCmd -sign temp-package dist/AirBoard_v4.9.0.zxp new-cert.p12 mypassword
```

**RIGHT** ✅ - Building production ZXP for sharing:
```bash
# This creates a PRODUCTION ZXP for public sharing
./build-latest.sh
```

### Key Differences

| Feature | Development ZXP | Production ZXP |
|---------|-----------------|----------------|
| **Extension Name** | "AirBoard Dev" | "AirBoard" |
| **Extension ID** | com.airboard.panel.dev | com.airboard.panel |
| **Debug Button** | ✅ Visible | ❌ Removed |
| **[DEV MODE] Labels** | ✅ Shown | ❌ Removed |
| **Intended Use** | Testing/Development | Public Sharing |

### When to Use Each

**Development ZXP** (`AirBoard_v4.9.0.zxp`):
- Testing new features locally
- Development and debugging
- Internal use only
- Installs alongside production version

**Production ZXP** (`AirBoard-v4.9.0.zxp`):
- Public distribution and sharing
- Clean UI without debug elements  
- Final release version
- Replaces any previous production installs

### ZXP Naming Convention

**Development Format**: `AirBoard_v[MAJOR].[MINOR].[PATCH].zxp` (underscore, keeps dev features)
**Production Format**: `AirBoard-v[MAJOR].[MINOR].[PATCH].zxp` (hyphen, clean for sharing)

**Examples**:
- `AirBoard_v2.8.6.zxp` → `AirBoard_v2.8.7.zxp` (patch increment)
- `AirBoard_v2.8.9.zxp` → `AirBoard_v2.9.0.zxp` (minor increment)
- `AirBoard_v2.9.9.zxp` → `AirBoard_v3.0.0.zxp` (major increment)

### ZXP Storage Location

**Location**: `dist/` folder in project root

**Structure**:
```
AirBoard/
├── dist/
│   ├── AirBoard_v2.8.5.zxp  ← Previous versions
│   ├── AirBoard_v2.8.6.zxp
│   ├── AirBoard_v2.8.7.zxp  ← Latest version
│   └── _Archive/            ← Old versions (optional)
├── CSXS/
├── client/
└── jsx/
```

### Common Build Issues

#### Issue: ZXP not appearing in dist/
**Solution**: Make sure you're using the correct path:
```bash
# Correct: Uses dist/ folder
./ZXPSignCmd -sign temp-package dist/AirBoard_v2.8.7.zxp new-cert.p12 mypassword

# Wrong: Missing dist/ folder
./ZXPSignCmd -sign temp-package AirBoard_v2.8.7.zxp new-cert.p12 mypassword
```

#### Issue: Version number confusion
**Solution**: Always check manifest.xml version matches ZXP filename:
```bash
# Manifest shows: ExtensionBundleVersion="2.8.7"
# ZXP should be: AirBoard_v2.8.7.zxp
```

#### Issue: "Signed successfully" but no file
**Solution**: Check if dist/ folder exists:
```bash
# Create dist folder if missing
mkdir -p dist
```

## Current Versioning Practices (v2.8.6)

### Quick Version Update Workflow
```bash
# 1. Update version in manifest
# Edit CSXS/manifest.xml: ExtensionBundleVersion="2.8.7"

# 2. Update CHANGELOG.md
# Add new version entry with detailed changes

# 3. Build ZXP
./ZXPSignCmd -sign temp-package dist/AirBoard_v2.8.7.zxp new-cert.p12 mypassword

# 4. Commit with descriptive message
git add .
git commit -m "v2.8.7: Brief description of changes

Detailed technical changes and improvements...

🤖 Generated with Claude Code
Co-Authored-By: Claude <noreply@anthropic.com>"

# 5. Push to GitHub
git push origin main
```

## 📋 **REQUIRED: Main Branch Push Checklist**

**CRITICAL: Always complete ALL steps before pushing to main branch:**

### ✅ Pre-Push Requirements
1. **Update manifest.xml version** (increment MAJOR.MINOR.PATCH)
2. **Update CHANGELOG.md** with new version entry and detailed changes
3. **Build new ZXP** with incremented version number
4. **Test functionality** (if applicable)
5. **Commit with version number** in commit message
6. **Push to main branch**

### 📝 CHANGELOG.md Update Format
```markdown
## [X.X.X] - YYYY-MM-DD ✨ **CURRENT RELEASE**
### ✨ Added
- New features and functionality

### 🎨 UI Improvements  
- Interface and design changes

### 🔧 Technical Details
- Implementation details and technical changes
- Associated with AirBoard_vX.X.X.zxp
```

### 🚨 Never Push to Main Without:
- [ ] Version number increment in manifest.xml
- [ ] CHANGELOG.md entry for the new version
- [ ] Associated ZXP file build
- [ ] Version number in commit message

### ⚠️ ZXP Build Policy
**IMPORTANT: NEVER build ZXP files automatically!**
- **ALWAYS ask the user first** before building any ZXP files
- ZXP builds should only happen when explicitly requested by the user
- Do not proactively create ZXP files during development or git operations
- Only build ZXP when user specifically requests "make a zxp" or similar

### Version Numbering Strategy

**Current Major Versions:**
- **v2.x.x**: Modern CEP-based plugin with unified UI system
- **v3.x.x**: Reserved for future major architectural changes

**Minor Version Increments:**
- **v2.1.x** → **v2.2.x**: New major features (Components system)
- **v2.8.x** → **v2.9.x**: UI refactoring and new sections

**Patch Version Increments:**
- **v2.8.1** → **v2.8.2**: Bug fixes, small improvements
- Performance optimizations, styling tweaks

### ZXP Association Pattern

Every commit should associate the ZXP file:
```markdown
v2.8.6: Update scrollbar color to darker theme

- Technical changes listed here
- Associated with AirBoard_v2.8.6.zxp

🤖 Generated with Claude Code
Co-Authored-By: Claude <noreply@anthropic.com>
```

## Version History Tracking

### CHANGELOG.md Format

```markdown
# Changelog

All notable changes to AirBoard Plugin will be documented here.

## [Unreleased]
### Added
- Feature in development

## [1.1.0] - 2024-01-20
### Added
- New Samsung device presets
- Pinch gesture animation

### Changed
- Improved tap gesture timing

### Fixed
- Status bar alignment issue

## [1.0.1] - 2024-01-16
### Fixed
- Critical bug in effect application

## [1.0.0] - 2024-01-15
### Added
- Initial release
- iPhone device presets
- Basic gesture animations
- Material effects
```

### Change Categories
- **Added**: New features
- **Changed**: Changes in existing functionality
- **Deprecated**: Soon-to-be removed features
- **Removed**: Removed features
- **Fixed**: Bug fixes
- **Security**: Security updates

## Version Comparison Rules

### Precedence Rules
1. Major version has highest precedence
2. Minor version has second precedence
3. Patch version has third precedence
4. Pre-release versions have lower precedence than normal versions
5. Build metadata is ignored for precedence

### Examples
```
2.0.0 > 1.9.9
1.1.0 > 1.0.9
1.0.1 > 1.0.0
1.0.0 > 1.0.0-rc.1
1.0.0-rc.1 > 1.0.0-beta.1
1.0.0-beta.2 > 1.0.0-beta.1
```

## Deprecation Policy

### Deprecation Timeline
1. **Mark as deprecated** in MINOR release
2. **Warn users** for at least 2 MINOR releases
3. **Remove** in next MAJOR release

### Deprecation Notice Format
```javascript
/**
 * @deprecated Since version 1.2.0. Will be removed in 2.0.0.
 * Use createDeviceArtboard() instead.
 */
function oldCreateDevice() {
    console.warn("oldCreateDevice() is deprecated. Use createDeviceArtboard()");
    // Legacy implementation
}
```

## Version Support Matrix

| Plugin Version | After Effects Versions | Status |
|---------------|------------------------|---------|
| 3.x.x | CC 2022 - 2024 | Current |
| 2.x.x | CC 2020 - 2023 | Supported |
| 1.x.x | CC 2019 - 2021 | Deprecated |
| 0.x.x | CC 2018 - 2019 | Unsupported |

## Emergency Hotfix Procedure

For critical bugs in production:

1. Create hotfix branch from main
```bash
git checkout -b hotfix/v1.0.1 main
```

2. Fix the issue (minimal changes only)

3. Update patch version

4. Fast-track merge
```bash
git checkout main
git merge --no-ff hotfix/v1.0.1
git tag -a v1.0.1 -m "Hotfix: [description]"
```

5. Immediately build and distribute

---

*Last Updated: [Current Date]*
*Guide Version: 1.0.0*

