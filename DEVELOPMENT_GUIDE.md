# AirBoard Development Guide

**Comprehensive technical documentation for developers working on the AirBoard After Effects plugin**

## 🎯 Critical Technical Patterns

### The Resolution Scaling System 🏆

**This is the most important technical achievement of the project.** Getting this right was extremely difficult and is crucial for all new features.

#### The Problem We Solved
- Multiple layers would scale incorrectly when added to compositions
- After Effects' layer indexing would shift as new layers were added
- Name-based layer finding was unreliable due to AE internal behavior
- Previous attempts failed due to race conditions and index confusion

#### The Solution: Index-1 Targeting with Layer Count Verification

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

#### Resolution Scaling Logic

**NEVER change these values - they are battle-tested and proven:**

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

#### Why This Works
- **copyToComp()** always places the new layer at index 1
- **Layer count verification** ensures the copy succeeded
- **Index 1 targeting** is guaranteed to find the newest layer
- **No name validation** avoids AE's unreliable internal naming
- **Simple and bulletproof** approach that scales to unlimited additions

### Playhead Positioning System

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

#### Why Playhead Positioning Matters
- Users expect layers to appear where they place the playhead
- Provides intuitive workflow for timing animations
- Essential for gesture animations and components
- Maintains timeline organization

### Template Management System

**Centralized template handling with performance optimization:**

```javascript
// Template caching to prevent redundant imports
var templateComp = null;
for (var i = 1; i <= app.project.items.length; i++) {
    var item = app.project.items[i];
    if (item instanceof CompItem && item.name === templateCompName) {
        templateComp = item;
        break;
    }
}

// Import only if not already present
if (!templateComp) {
    var importOptions = new ImportOptions(templateFile);
    app.project.importFile(importOptions);
    
    // Find after import
    for (var j = 1; j <= app.project.items.length; j++) {
        var item = app.project.items[j];
        if (item instanceof CompItem && item.name === templateCompName) {
            templateComp = item;
            break;
        }
    }
}
```

#### Template File Structure
- **Location**: `assets/templates/AirBoard Templates.aep`
- **Organization**: Each component/gesture has its own composition
- **Naming**: Use descriptive names that match the mapping in JavaScript
- **Consistency**: All templates should follow the same structure

## 🏗 Adding New Features

### Pattern for New Interactive Sections

**Follow this exact pattern for consistency:**

#### 1. HTML Structure
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

#### 2. JavaScript Event Handler
```javascript
// Add Feature button handler
var addFeatureButton = document.getElementById('addFeature');
addFeatureButton.addEventListener('click', function() {
    console.log('Add Feature clicked');
    
    // Get selected feature type and resolution multiplier
    var featureType = document.getElementById('featureType').value;
    var resolutionMultiplier = parseInt(document.getElementById('resolutionMultiplier').value);
    
    console.log('Feature Type:', featureType, 'Resolution Multiplier:', resolutionMultiplier);
    
    // Disable button while working
    addFeatureButton.disabled = true;
    addFeatureButton.textContent = 'Adding...';
    
    // Pass the extension path to the JSX
    var setPathScript = 'var extensionRoot = "' + extensionPath.replace(/\\/g, '\\\\') + '";';
    csInterface.evalScript(setPathScript);
    
    // Call the After Effects script
    var script = 'addFeatureFromPanel("' + featureType + '", ' + resolutionMultiplier + ')';
    console.log('Executing script:', script);
    
    csInterface.evalScript(script, function(result) {
        console.log('Feature result:', result);
        // Re-enable button
        addFeatureButton.disabled = false;
        addFeatureButton.textContent = 'Add Feature';
    });
});
```

#### 3. ExtendScript Implementation
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
        
        // Check alternate path separator
        if (!templateFile.exists) {
            templatePath = extensionRoot + "\\assets\\templates\\AirBoard Templates.aep";
            templateFile = new File(templatePath);
        }
        
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

## 🎨 UI Development Guidelines

### Unified CSS System

**Use these classes for consistency:**

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

### Adding New Sections
1. **HTML**: Use `<section class="section">` wrapper
2. **Header**: Use `<h2 class="section-header">` for titles
3. **Controls**: Use `<div class="control-row">` for dropdowns + buttons
4. **Buttons**: Use `class="main-button"` for primary actions
5. **Dropdowns**: Use `class="dropdown"` for select elements

### Global Spacing Control
To change spacing throughout the entire interface:
```css
.control-row {
    margin-bottom: 10px; /* Change this value affects ALL rows */
}
```

## 🔧 Performance Optimizations

### Template Caching
- Always check if template compositions exist before importing
- Cache template references to avoid repeated project scanning
- Use efficient loop patterns with early break statements

### Layer Operations
- Clear layer selections before copying (prevents insertion issues)
- Verify operations succeeded with layer count checks
- Use try/catch blocks for non-critical operations
- Minimize After Effects API calls in loops

### Error Handling
```javascript
// Always wrap AE operations in try/catch
try {
    // AE operation here
} catch(error) {
    $.writeln("Operation failed: " + error.toString());
    // Graceful fallback or user notification
}
```

## 📦 Build and Deployment

### Version Management
1. **Update manifest.xml**: Change `ExtensionBundleVersion`
2. **Follow semantic versioning**: MAJOR.MINOR.PATCH
3. **Document changes**: Update CHANGELOG.md
4. **Test thoroughly**: Multiple AE versions if possible

### ZXP Creation
```bash
# Standard ZXP build command
./ZXPSignCmd -sign temp-package dist/AirBoard_v[VERSION].zxp new-cert.p12 password

# Always verify the ZXP was created
ls -la dist/AirBoard_v[VERSION].zxp
```

### Git Workflow
1. **Feature branches**: Create from main for new features
2. **Descriptive commits**: Include technical details and ZXP associations
3. **Test before merging**: Ensure functionality works end-to-end
4. **Clean history**: Merge with descriptive commit messages

## 🚨 Common Pitfalls to Avoid

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

## 🧪 Testing Guidelines

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

## 📚 Reference Materials

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

**Remember: The scaling system took significant effort to perfect. When in doubt, follow the established patterns exactly. They have been battle-tested and proven to work reliably.**