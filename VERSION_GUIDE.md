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
# Build ZXP file
./build/build.sh v1.0.0

# Output: dist/AirBoard_v1.0.0.zxp
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

