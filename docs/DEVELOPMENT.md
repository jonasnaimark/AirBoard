# AirBoard Plugin Development Guide

**Comprehensive technical documentation for developers working on the AirBoard After Effects plugin**

## Environment Setup

### Critical: Development Environment Check

**ALWAYS verify your dev environment before starting work after context loss!**

#### Quick Dev Environment Verification
```bash
# 1. Check if dev extension exists
ls -la "$HOME/Library/Application Support/Adobe/CEP/extensions/airboard-dev"

# 2. Should show: airboard-dev -> /Users/jonas_naimark/Documents/airboard-plugin

# 3. Check manifest is in DEV mode
grep "com.airboard.panel.dev" ~/Documents/airboard-plugin/CSXS/manifest.xml

# 4. Should show: ExtensionBundleId="com.airboard.panel.dev"
```

#### Setting Up Development Environment

**Step 1: Fix Manifest (CRITICAL)**
```bash
cd ~/Documents/airboard-plugin
```

Edit `CSXS/manifest.xml` - Change these lines:
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

**Step 2: Enable CEP Debugging**
```bash
defaults write com.adobe.CSXS.9.plist PlayerDebugMode 1
defaults write com.adobe.CSXS.10.plist PlayerDebugMode 1
defaults write com.adobe.CSXS.11.plist PlayerDebugMode 1
```

**Step 3: Create Development Symlink**
```bash
cd ~/Documents/airboard-plugin
./dev-sync.sh
```

**Step 4: Restart After Effects**
- Quit After Effects completely
- Wait 5 seconds
- Restart After Effects
- Look for "AirBoard Dev" in Window > Extensions

#### Verifying Dev Environment is Working

When you open "AirBoard Dev" you should see:
- ✅ **"Device Templates [DEV MODE]"** in the header
- ✅ **🐛 Debug button** next to Device Templates
- ✅ **Debug panel appears** when clicking shadow/blur buttons
- ✅ **File changes reflect immediately** (after AE restart)

#### Emergency Recovery Commands

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

#### Key Files to Monitor

- **`CSXS/manifest.xml`** - Should contain `.dev` extensions IDs
- **`client/index.html`** - Should contain `[DEV MODE]` and debug button
- **Symlink** - Should exist at `~/Library/Application Support/Adobe/CEP/extensions/airboard-dev`

## Development Workflow

### Daily Development Workflow

#### Starting Development:
1. **Verify dev environment**: `ls -la "$HOME/Library/Application Support/Adobe/CEP/extensions/airboard-dev"`
2. **Check manifest is dev mode**: `grep "\.dev" ~/Documents/airboard-plugin/CSXS/manifest.xml`
3. **Open After Effects** → Window > Extensions → **"AirBoard Dev"**

#### Making Changes:
1. **Edit files** in `~/Documents/airboard-plugin/`
2. **Save files**
3. **Restart After Effects** to see changes
4. **Use debug panel** to troubleshoot

#### Two Extension Versions
- **"AirBoard"** = Production version (from installed ZXP)
- **"AirBoard Dev"** = Development version (live files with [DEV MODE] indicator)

### Critical Technical Patterns

#### The Resolution Scaling System

**This is the most important technical achievement of the project.** Getting this right was extremely difficult and is crucial for all new features.

**The Problem We Solved:**
- Multiple layers would scale incorrectly when added to compositions
- After Effects' layer indexing would shift as new layers were added
- Name-based layer finding was unreliable due to AE internal behavior
- Previous attempts failed due to race conditions and index confusion

**The Solution: Index-1 Targeting with Layer Count Verification**

```javascript
// PROVEN PATTERN - Use this for ALL new features
function addLayerFromTemplate(templateCompName, layerName, multiplier) {
    // 1. Store layer count BEFORE copying
    var layerCountBefore = comp.numLayers;
    
    // 2. Clear selections (optional but harmless)
    try {
        for (var s = 1; s <= comp.numLayers; s++) {
            comp.layers[s].selected = false;
        }
    } catch(clearError) {
        // Non-critical if selection clearing fails
    }
    
    // 3. Copy the source layer
    sourceLayer.copyToComp(comp);
    
    // 4. Verify new layer was added
    if (comp.numLayers <= layerCountBefore) {
        alert("Error: Layer was not added to the composition.");
        return "error";
    }
    
    // 5. Target layer at index 1 (ALWAYS the newest layer)
    var newLayer = comp.layers[1];
    
    // 6. Apply resolution-based scaling
    var scalePercentage = getScalePercentage(multiplier);
    newLayer.transform.scale.setValue([scalePercentage, scalePercentage]);
    
    // 7. Set playhead positioning
    newLayer.startTime = comp.time;
}
```

**Resolution Scaling Logic - NEVER change these values:**

```javascript
function getScalePercentage(multiplier) {
    switch(multiplier) {
        case 1: return 50;   // 1x = 50%
        case 2: return 100;  // 2x = 100% (baseline)
        case 3: return 150;  // 3x = 150%
        case 4: return 200;  // 4x = 200%
        case 5: return 250;  // 5x = 250%
        case 6: return 300;  // 6x = 300%
        default: return 100; // Fallback to baseline
    }
}
```

#### Playhead Positioning System

**Essential for timeline-aware layer placement:**

```javascript
// Set layer start time to current playhead position
try {
    var playheadTime = comp.time;
    newLayer.startTime = playheadTime;
} catch(timeError) {
    $.writeln("Playhead positioning failed: " + timeError.toString());
}
```

### Adding New Features

#### Pattern for New Interactive Sections

**1. HTML Structure**
```html
<section class="section">
    <h2 class="section-header">Feature Name</h2>
    <div class="control-row">
        <select id="featureType" class="dropdown">
            <option value="option1">Option 1</option>
            <option value="option2">Option 2</option>
        </select>
        <button id="addFeature" class="main-button">Add Feature</button>
    </div>
</section>
```

**2. JavaScript Event Handler**
```javascript
// Add Feature button handler
var addFeatureButton = document.getElementById('addFeature');
addFeatureButton.addEventListener('click', function() {
    console.log('Add Feature clicked');
    
    // Get selected feature type and resolution multiplier
    var featureType = document.getElementById('featureType').value;
    var resolutionMultiplier = parseInt(document.getElementById('resolutionMultiplier').value);
    
    // Disable button while working
    addFeatureButton.disabled = true;
    addFeatureButton.textContent = 'Adding...';
    
    // Pass the extension path to the JSX
    var setPathScript = 'var extensionRoot = "' + extensionPath.replace(/\\/g, '\\\\') + '";';
    csInterface.evalScript(setPathScript);
    
    // Call the After Effects script
    var script = 'addFeatureFromPanel("' + featureType + '", ' + resolutionMultiplier + ')';
    csInterface.evalScript(script, function(result) {
        // Re-enable button
        addFeatureButton.disabled = false;
        addFeatureButton.textContent = 'Add Feature';
    });
});
```

**3. ExtendScript Implementation**
```javascript
function addFeatureFromPanel(featureType, multiplier) {
    try {
        // Get active composition
        var comp = app.project.activeItem;
        if (!comp || !(comp instanceof CompItem)) {
            alert("Please select a composition first.");
            return "error";
        }
        
        // Feature data mapping
        var featureData = {
            "option1": {
                compName: "Template Comp Name 1",
                layerName: "Layer Name 1"
            },
            "option2": {
                compName: "Template Comp Name 2", 
                layerName: "Layer Name 2"
            }
        };
        
        var data = featureData[featureType];
        if (!data) {
            alert("Unknown feature type: " + featureType);
            return "error";
        }
        
        // Template file path
        var templatePath = extensionRoot + "/assets/templates/AirBoard Templates.aep";
        var templateFile = new File(templatePath);
        
        if (!templateFile.exists) {
            alert("Cannot find template file at: " + templatePath);
            return "error";
        }
        
        // FOLLOW THE PROVEN SCALING PATTERN HERE
        // (Use the complete pattern from above)
        
        return "success";
    } catch(e) {
        alert("Error adding feature: " + e.toString());
        return "error";
    }
}
```

### UI Development Guidelines

#### Unified CSS System

Use these classes for consistency:

```css
/* All sections use this */
.section {
    margin-bottom: 16px; 
    padding-bottom: 2px;
    border-bottom: 1px solid #3a3a3a;
}

/* All interactive rows use this */
.control-row {
    display: flex;
    gap: 10px;
    margin-bottom: 10px;
    align-items: stretch;
}
```

#### Adding New Sections
1. **HTML**: Use `<section class="section">` wrapper
2. **Header**: Use `<h2 class="section-header">` for titles
3. **Controls**: Use `<div class="control-row">` for dropdowns + buttons
4. **Buttons**: Use `class="main-button"` for primary actions
5. **Dropdowns**: Use `class="dropdown"` for select elements

### Performance Optimizations

#### Template Caching
- Always check if template compositions exist before importing
- Cache template references to avoid repeated project scanning
- Use efficient loop patterns with early break statements

#### Layer Operations
- Clear layer selections before copying (prevents insertion issues)
- Verify operations succeeded with layer count checks
- Use try/catch blocks for non-critical operations
- Minimize After Effects API calls in loops

#### Error Handling
```javascript
// Always wrap AE operations in try/catch
try {
    // AE operation here
} catch(error) {
    $.writeln("Operation failed: " + error.toString());
    // Graceful fallback or user notification
}
```

### Git Protection for Dev Environment

When you push to GitHub, the build script temporarily changes the manifest to production mode, but this shouldn't affect your local dev files.

**Manual Protection Commands:**
```bash
# Before any git push, run:
cp CSXS/manifest.xml CSXS/manifest.xml.dev-backup

# After git push, restore dev mode:
cd ~/Documents/airboard-plugin
./dev-sync.sh
# Then fix manifest.xml if needed (see Step 1 above)
```

## Debugging

### CRITICAL: Plugin Debug System

**NEVER use After Effects' built-in debugging tools - they don't work with our plugin!**

#### What DOESN'T Work
```javascript
// WRONG - This goes to ExtendScript console which is not accessible
$.writeln("Debug message");
console.log("Debug message"); // JavaScript only, not ExtendScript
alert("Debug message"); // Intrusive and blocks workflow
```

#### What DOES Work - Our Plugin Debug System

**Step 1: Using the Plugin Debug Panel**
1. **Click the 🐛 Debug button** in the "Device Templates [DEV MODE]" section
2. **Debug panel opens** as floating overlay in top-right corner
3. **All debug messages appear here** - this is the ONLY place to see ExtendScript debug output

**Step 2: ExtendScript Debug Messages (jsx/main.jsx)**
```javascript
// CORRECT - Use our DEBUG_JSX system
DEBUG_JSX.log("Function called with params: " + param1);
DEBUG_JSX.error("Something failed", error);
DEBUG_JSX.info("Status update", data);
```

**Step 3: Making Functions Debug-Ready**
```javascript
// Pattern for new functions that need debugging
function yourNewFunction(param1, param2) {
    try {
        // Clear previous debug messages
        DEBUG_JSX.clear();
        
        DEBUG_JSX.log("yourNewFunction called with: " + param1 + ", " + param2);
        
        // Your function logic here
        // More DEBUG_JSX.log() calls as needed
        
        // Include debug messages in result
        var debugMessages = DEBUG_JSX.getMessages();
        return "success|result_data|" + debugMessages.join("|");
        
    } catch(e) {
        var debugMessages = DEBUG_JSX.getMessages();
        return "error|" + e.toString() + "|" + debugMessages.join("|");
    }
}
```

#### Debug Panel Features
- **🎬 Color-coded messages** - Blue for functions, red for errors
- **📋 Copy button** - Copies all debug text to clipboard
- **🗑️ Clear button** - Clears all messages
- **❌ Close button** - Closes the debug panel
- **📜 Auto-scroll** - Always shows latest messages
- **📝 Selectable text** - Click and drag to select specific messages

#### Common Debugging Workflows

**New Feature Development:**
1. Open 🐛 Debug panel
2. Clear existing messages
3. Add `DEBUG_JSX.log()` calls in your ExtendScript function
4. Test the feature
5. Read debug messages to understand execution flow

**Bug Investigation:**
1. Open 🐛 Debug panel
2. Clear messages
3. Reproduce the bug
4. Read debug output to identify where it fails
5. Copy messages for documentation

#### Why This System Exists

**After Effects ExtendScript runs in isolation** - there's no accessible console, no browser dev tools, no way to see debug output. Our debug panel is the ONLY way to see what's happening in ExtendScript functions.

## Version Management

### Version Number Format

We follow Semantic Versioning 2.0.0: **MAJOR.MINOR.PATCH**

```
1.0.0
│ │ └── PATCH: Bug fixes, minor improvements
│ └──── MINOR: New features, backward compatible
└────── MAJOR: Breaking changes, major features
```

### Version Increment Rules

**PATCH Version (x.x.X)** - Increment when:
- Fixing bugs
- Minor performance improvements
- Typo corrections
- Small UI adjustments
- Documentation fixes

**MINOR Version (x.X.x)** - Increment when:
- Adding new features
- Adding new device presets
- Adding new gesture types
- Adding new effects
- Non-breaking improvements

**MAJOR Version (X.x.x)** - Increment when:
- Breaking API changes
- Major UI overhaul
- Removing features
- Changing core functionality

### Files to Update

When updating versions, update these files:

1. **CSXS/manifest.xml**
```xml
ExtensionBundleVersion="1.0.0"
```

2. **jsx/main.jsx**
```javascript
var PLUGIN_VERSION = "1.0.0";
```

3. **CHANGELOG.md**
```markdown
## [1.0.0] - 2024-01-15
### Added
- Initial release
```

### ZXP Build Policy

**⚠️ IMPORTANT: NEVER build ZXP files automatically!**
- **ALWAYS ask the user first** before building any ZXP files
- ZXP builds should only happen when explicitly requested by the user
- Do not proactively create ZXP files during development or git operations

### Production vs Development ZXP

**Production ZXP** (`AirBoard-v4.9.0.zxp`) - For sharing:
```bash
# Use the production build script (RECOMMENDED for sharing)
./build-latest.sh

# This automatically:
# - Removes [DEV MODE] markers from HTML
# - Removes debug button from production build
# - Converts com.airboard.panel.dev → com.airboard.panel
# - Changes "AirBoard Dev" → "AirBoard"
```

**Development ZXP** (`AirBoard_v4.9.0.zxp`) - For testing:
```bash
# Manual dev build (for testing only)
rm -rf temp-package && mkdir temp-package
cp -r CSXS client jsx assets temp-package/
./ZXPSignCmd -sign temp-package dist/AirBoard_v4.9.0.zxp new-cert.p12 mypassword
rm -rf temp-package
```

| Feature | Development ZXP | Production ZXP |
|---------|-----------------|----------------|
| **Extension Name** | "AirBoard Dev" | "AirBoard" |
| **Extension ID** | com.airboard.panel.dev | com.airboard.panel |
| **Debug Button** | ✅ Visible | ❌ Removed |
| **[DEV MODE] Labels** | ✅ Shown | ❌ Removed |
| **Intended Use** | Testing/Development | Public Sharing |

### Git Workflow and Version Updates

**Required Main Branch Push Checklist:**

1. **Update manifest.xml version** (increment MAJOR.MINOR.PATCH)
2. **Update CHANGELOG.md** with new version entry and detailed changes
3. **Build new ZXP** with incremented version number (if requested)
4. **Test functionality** (if applicable)
5. **Commit with version number** in commit message
6. **Push to main branch**

**CHANGELOG.md Update Format:**
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

## Common Pitfalls to Avoid

### 1. Layer Indexing Confusion
- **DON'T** try to find layers by name immediately after copying
- **DON'T** assume layer indices remain constant
- **DO** use layer count verification and index-1 targeting

### 2. Scaling Implementation Errors
- **DON'T** modify the proven scaling percentages
- **DON'T** skip the resolution multiplier parameter
- **DO** use the exact switch statement pattern

### 3. UI Consistency Issues
- **DON'T** create custom CSS classes for spacing
- **DON'T** use different HTML structures for similar features
- **DO** follow the unified `.section` and `.control-row` pattern

### 4. Performance Problems
- **DON'T** import templates on every operation
- **DON'T** scan the entire project repeatedly
- **DO** implement caching and efficient lookup patterns

## Testing Guidelines

### Manual Testing Checklist
1. **Fresh AE Project**: Test with completely new projects
2. **Multiple Operations**: Add several gestures/components in sequence
3. **Different Resolutions**: Test all multipliers (1x-6x)
4. **Playhead Positions**: Test at various timeline positions
5. **Error Conditions**: Test with no composition selected
6. **Performance**: Check for UI freezes or delays

### Regression Testing
- **Template Import**: Verify templates import correctly
- **Scaling Accuracy**: Measure layer scales at different multipliers
- **Playhead Positioning**: Confirm layers start at correct times
- **UI Responsiveness**: Ensure buttons re-enable after operations

## Reference Materials

### ExtendScript Documentation
- [Adobe After Effects Scripting Guide](https://ae-scripting.docsforadobe.dev/)
- [ExtendScript API Reference](https://extendscript.docsforadobe.dev/)

### CEP Framework
- [Adobe CEP Documentation](https://github.com/Adobe-CEP/CEP-Resources)
- [CSInterface API](https://github.com/Adobe-CEP/CEP-Resources/tree/master/CEP_9.x)

### Project Patterns
- Study `addGestureFromPanel()` and `addComponentFromPanel()` functions
- Reference the v2.0.5 commit for scaling solution implementation
- Follow existing error handling and user feedback patterns

---

*Development guide last updated: September 2024*

**Remember: The scaling system took significant effort to perfect. When in doubt, follow the established patterns exactly. They have been battle-tested and proven to work reliably.**