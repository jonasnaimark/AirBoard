# AirBoard Plugin - Claude Code Context

## 🎯 Project Overview
**AirBoard After Effects Plugin v4.16.52** - Professional animation tools and presets for Adobe After Effects

**Current Status**: Mature, feature-rich plugin with sophisticated keyframe manipulation, device templates, gesture library, and comprehensive folder management systems.

## 🏆 Critical Technical Knowledge

### Most Important Pattern: Resolution Scaling (v2.0.5 Breakthrough)
**This was extremely difficult to solve and is crucial for all features:**

```javascript
// PROVEN PATTERN - Use for ALL new features
function addLayerFromTemplate(templateCompName, layerName, multiplier) {
    var layerCountBefore = comp.numLayers;
    sourceLayer.copyToComp(comp);
    if (comp.numLayers <= layerCountBefore) return "error";
    var newLayer = comp.layers[1]; // ALWAYS the newest layer
    var scalePercentage = getScalePercentage(multiplier);
    newLayer.transform.scale.setValue([scalePercentage, scalePercentage]);
    newLayer.startTime = comp.time; // Playhead positioning
}

function getScalePercentage(multiplier) {
    // NEVER change these battle-tested values
    switch(multiplier) {
        case 1: return 50;   case 2: return 100;  case 3: return 150;
        case 4: return 200;  case 5: return 250;  case 6: return 300;
        default: return 100;
    }
}
```

### Key Technical Principles
1. **Index-1 Targeting**: copyToComp() always places new layer at index 1
2. **Layer Count Verification**: Verify layer was added before targeting
3. **No Name Validation**: Avoid AE's unreliable internal naming
4. **Playhead Positioning**: newLayer.startTime = comp.time for timeline awareness

## 🏗 Project Structure
```
AirBoard/
├── CSXS/manifest.xml          # Version: ExtensionBundleVersion
├── client/                    # Frontend UI
│   ├── css/styles.css        # Unified .section/.control-row classes
│   ├── index.html            # Semantic section-based layout
│   └── js/main.js            # UI events → ExtendScript calls
├── jsx/main.jsx              # Core scaling/positioning/keyframe logic
├── assets/templates/         # AirBoard Templates.aep
├── docs/                     # All documentation (NEW: v4.16.52)
│   ├── DOCUMENTATION_INDEX.md # Complete guide to all docs
│   ├── CHANGELOG.md          # Version history
│   ├── DEVELOPMENT.md        # Dev environment & workflow
│   ├── TECHNICAL_DOCS.md     # UI patterns & technical details
│   ├── KEYFRAME_SYSTEM_SUMMARY.md # Deep keyframe documentation
│   ├── PRODUCTION_BUILD.md   # Release process
│   ├── SAFETY_GUIDE.md       # Backup protocols
│   └── CLAUDE_CONTEXT.md     # AI assistant guidelines
└── dist/                     # ZXP releases
```

## ✨ Current Features (v4.16.52)
- **Keyframe Nudger**: Precise control over keyframe timing, duration, staggers, and position with smart snapping and multi-property support
- **Device Templates**: Auto-generate iPhone and desktop compositions with proper scaling and automatic project folder expansion
- **Gesture Library**: Pre-built tap, click, and interaction animations
- **Effects**: Squircles, shadows, materials, shimmers, and UI elements
- **Components**: Loaders, counters, logos
- **File Setup**: Auto-generate AE and Finder folder structures with intelligent subfolder restoration
- **Elevation Shadows**: Complete shadow system with resolution-based presets
- **User Preferences**: Resolution multiplier persists between AE sessions

## 🎨 UI Patterns (CRITICAL for consistency)
```html
<!-- ALWAYS use this structure for new sections -->
<section class="section">
    <h2 class="section-header">Feature Name</h2>
    <div class="control-row">
        <select id="featureType" class="dropdown">
            <option value="option1">Option 1</option>
        </select>
        <button id="addFeature" class="main-button">Add Feature</button>
    </div>
</section>
```

**Global spacing control:**
```css
.control-row { margin-bottom: 10px; } /* Change this affects ALL rows */
```

## 🔧 Development Workflow

### Adding New Features
1. **HTML**: Use `.section` wrapper with `.section-header` and `.control-row`
2. **JavaScript**: Event handler → csInterface.evalScript() call
3. **ExtendScript**: Follow proven scaling pattern from above
4. **Template**: Add to AirBoard Templates.aep if needed

### 🚨 CRITICAL: Production Build Process
**ALWAYS follow docs/PRODUCTION_BUILD.md for releases!**

```bash
# Phase 1: Update ALL files
# 1. Update manifest.xml version AND convert to production mode
# 2. Update CHANGELOG.md with new version entry
# 3. Update README.md badge AND download link
# 4. Update build-latest.sh (all 3 version references)

# Phase 2: Build and commit
./build-latest.sh
git add -A
git commit -m "vX.X.X: Feature description with ZXP"
git push origin main

# Phase 3: Restore dev mode in manifest.xml
```

## 📚 Essential Documentation Files (NEW: All in docs/ folder)
- **docs/DOCUMENTATION_INDEX.md**: Complete guide to all documentation
- **docs/DEVELOPMENT.md**: Environment setup, workflow, debugging system
- **docs/TECHNICAL_DOCS.md**: UI patterns, easing systems, technical implementation
- **docs/KEYFRAME_SYSTEM_SUMMARY.md**: Deep dive into keyframe manipulation system
- **docs/PRODUCTION_BUILD.md**: Complete release process and ZXP building
- **docs/CHANGELOG.md**: Comprehensive version history
- **docs/SAFETY_GUIDE.md**: Backup systems and safety protocols
- **docs/CLAUDE_CONTEXT.md**: AI assistant guidelines and project patterns
- **README.md**: Main project overview (stays in root)

## 🎯 Recent Major Work Completed (v4.16.52)
- **Enhanced Folder Structure**: Added zArchive to 02 - Precomps, Desktop/Native subfolders
- **Missing Subfolder Restoration**: AE Folders now restores deleted subfolders automatically
- **Documentation Consolidation**: All .md files organized into docs/ folder for cleaner project structure
- **Keyframe System Mastery**: Comprehensive easing preservation, delay/duration nudging, stagger operations
- **Project Panel Integration**: Automatic folder expansion and composition selection
- **User Preferences**: Persistent resolution multiplier between AE sessions

## 🚧 Next Potential Tasks
- **Extended User Preferences**: Save/restore transition durations and other UI state
- **Additional Components**: Progress bars, buttons, icons
- **Advanced Gestures**: Pinch, swipe, multi-touch interactions
- **Performance Optimizations**: Enhanced template caching and faster operations

## 🔥 Critical Reminders
1. **NEVER modify the scaling percentages** - they are battle-tested (v2.0.5 breakthrough)
2. **ALWAYS use the index-1 targeting pattern** for new features
3. **FOLLOW the unified CSS classes** (.section, .control-row) for UI consistency
4. **USE the debug panel** (🐛 button) - it's the ONLY way to see ExtendScript debug output
5. **FOLLOW docs/PRODUCTION_BUILD.md** exactly for releases (learned from v4.16.49 mistakes)
6. **PRESERVE keyframe easing** - use the comprehensive pattern from docs/TECHNICAL_DOCS.md
7. **DOCUMENT LOCATION** - All docs are now in docs/ folder (v4.16.52 reorganization)

## 🛠️ Development Environment
- **Dev Extension**: "AirBoard Dev" (com.airboard.panel.dev) with [DEV MODE] markers
- **Production Extension**: "AirBoard" (com.airboard.panel) clean version
- **Debug System**: Custom debug panel (🐛 button) - essential for ExtendScript debugging
- **Symlink**: `~/Library/Application Support/Adobe/CEP/extensions/airboard-dev`

## 📊 Current Version Status
- **Latest Release**: v4.16.52 (Enhanced folder structure and subfolder restoration)
- **Build Process**: Automated with build-latest.sh (removes dev markers, signs ZXP)
- **Documentation**: Fully organized in docs/ folder with comprehensive guides

---
*This context preserves essential knowledge for AirBoard development v4.16.52*
*Updated: September 2024 - Reflects current project state and documentation structure*