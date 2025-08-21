# AirBoard Plugin - Claude Code Context

## 🎯 Project Overview
**AirBoard After Effects Plugin v4.9.0** - Professional device mockup and gesture animation tools for Adobe After Effects

## 🚨 CRITICAL: ZXP Build Warning

**When user requests ZXP build - ALWAYS use production build script:**

**WRONG** ❌: `./ZXPSignCmd` (creates dev version with debug features - DON'T share this!)
**RIGHT** ✅: `./build-latest.sh` (creates production version for sharing)

**Differences:**
- **Dev ZXP**: "AirBoard Dev", debug features, [DEV MODE] labels  
- **Production ZXP**: "AirBoard", clean UI, no debug elements

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
├── jsx/main.jsx              # Core scaling/positioning logic
├── assets/templates/         # AirBoard Templates.aep
└── dist/                     # ZXP releases
```

## ✨ Current Features (v3.5.4)
- **Device Templates**: iPhone/Desktop with resolution scaling
- **Gesture Presets**: Tap, Long Press, Double Tap, Mouse Click
- **Components**: Ms Counter, Dot Loader  
- **Effect Presets**: Squircle creation, Rectangle replacement
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

### Version Management & Main Branch Push
```bash
# CRITICAL: Always do ALL steps before pushing to main
# 1. Update CSXS/manifest.xml: ExtensionBundleVersion="X.X.X"
# 2. Update CHANGELOG.md with new version entry and detailed changes
# 3. Build ZXP (ONLY when user explicitly requests it!)
./ZXPSignCmd -sign temp-package dist/AirBoard_vX.X.X.zxp new-cert.p12 mypassword
# 4. Commit with version number
git commit -m "vX.X.X: Description with ZXP association"
# 5. Push to main
git push origin main
```

### ⚠️ ZXP Build Policy
**NEVER build ZXP files automatically!**
- **ALWAYS ask the user first** before building any ZXP files
- ZXP builds should only happen when explicitly requested by the user
- Do not proactively create ZXP files during development or git operations

### 🚨 Main Branch Push Requirements
**NEVER push to main without:**
- Version increment in manifest.xml
- CHANGELOG.md entry for new version  
- Associated ZXP file build (but only when user requests it)
- Version number in commit message

## 📚 Essential Documentation Files
- **DEVELOPMENT_GUIDE.md**: Complete technical patterns, scaling logic, and **component addition guide**
- **UI_PATTERNS.md**: Adding sections and maintaining consistency  
- **VERSION_GUIDE.md**: Release process and semantic versioning
- **CHANGELOG.md**: Comprehensive version history
- **README.md**: Current project overview and features

## 🧩 Adding Components Quick Reference

**Two component types available:**
1. **Composition-Based** (iPhone UI): Adds entire composition as precomp layer
2. **Layer-Based** (Dot Loader, Ms Counter): Copies specific layer from composition

**Steps**: HTML dropdown → JSX mapping → Logic update (if comp-based) → Test
**Full guide**: See DEVELOPMENT_GUIDE.md "Adding New Components to Dropdown" section

## 🎯 Recent Major Work Completed
- **Documentation Overhaul**: All .md files updated to reflect current state
- **Scaling Logic Documentation**: Extensively documented the v2.0.5 breakthrough
- **UI Pattern Documentation**: Complete guide for adding new sections
- **Playhead Positioning**: Documented timeline-aware layer placement

## 🚧 Next Potential Tasks
- **Extended User Preferences**: Save/restore transition durations and other UI state between AE sessions
- **Additional Components**: Progress bars, buttons, icons
- **Advanced Gestures**: Pinch, swipe, multi-touch
- **Performance**: Enhanced template caching

## 🎯 PRIORITY: User Preferences Implementation Plan

### 📋 Feature Overview
Implement persistent settings that remember user preferences between After Effects sessions.

### 🛠️ Technical Approach (ExtendScript Settings - Recommended)
```javascript
// Save preference
app.settings.saveSetting("AirBoard", "resolutionMultiplier", "3");

// Load preference  
var savedResolution = app.settings.getSetting("AirBoard", "resolutionMultiplier");
if (savedResolution !== "") {
    resolutionInput.value = parseInt(savedResolution);
}
```

### 📦 Settings to Save
- **Resolution Multiplier**: Current @2x, @3x, etc. setting (main priority)
- **Transition Durations**: Fade-out/Fade-in timing values (150ms, 250ms)
- **Last Used Device**: iPhone vs Desktop preference (optional)
- **UI State**: Any dropdown selections (optional)

### ⏰ When to Save/Load
**Save Triggers:**
- Every time user clicks +/- buttons on resolution
- Every time user changes transition durations
- On plugin close/AE shutdown

**Load Triggers:**
- Plugin startup (when panel first loads)
- After Effects launch (restore previous session)

### 🎯 Implementation Steps
1. Add save calls in existing update functions (updateResolutionDisplay, updateTransitionDurationDisplay)
2. Add load calls in plugin initialization
3. Update display functions to show loaded values on startup
4. Test persistence across AE sessions

### 🔧 Files to Modify
- **jsx/main.jsx**: Add ExtendScript settings save/load functions
- **client/js/main.js**: Add preference loading on startup
- Integration with existing +/- button event handlers

### 🎁 User Benefits
- Seamless workflow continuation
- No need to re-adjust resolution every session  
- Professional plugin behavior
- Time-saving for frequent users

## 🔥 Critical Reminders
1. **NEVER modify the scaling percentages** - they are battle-tested
2. **ALWAYS use the index-1 targeting pattern** for new features
3. **FOLLOW the unified CSS classes** (.section, .control-row) for UI
4. **REFERENCE v2.0.5** for any scaling-related implementations
5. **UPDATE manifest.xml** version for any releases

---
*This context preserves the essential knowledge for continuing development*