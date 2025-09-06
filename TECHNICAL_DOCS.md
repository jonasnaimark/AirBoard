# AirBoard Plugin Technical Documentation

*Consolidated technical guide for UI patterns, easing systems, and development patterns*

---

## Table of Contents

1. [UI Patterns and Components](#ui-patterns-and-components)
2. [Easing Systems](#easing-systems)
   - [CSS to After Effects Easing Conversion](#css-to-after-effects-easing-conversion)
   - [Keyframe Easing Preservation](#keyframe-easing-preservation)

---

# UI Patterns and Components

**Consistent UI development patterns for the AirBoard After Effects plugin**

## Design Philosophy

The AirBoard UI follows a **unified, maintainable design system** that ensures:
- **Consistency**: All sections look and behave identically
- **Maintainability**: Global changes can be made in one place
- **Scalability**: New sections can be added easily
- **Accessibility**: Dark theme matches After Effects interface

## Core HTML Structure

### Section Layout Pattern

**Every interactive section follows this exact structure:**

```html
<section class="section">
    <h2 class="section-header">Section Name</h2>
    <div class="control-row">
        <select id="sectionType" class="dropdown">
            <option value="option1">Option 1</option>
            <option value="option2">Option 2</option>
        </select>
        <button id="addSection" class="main-button">Add Section</button>
    </div>
</section>
```

### Current Sections Structure

```html
<div class="container">
    <!-- Device Templates -->
    <section class="section">
        <h2 class="section-header">Device Templates</h2>
        <div class="control-row">...</div>
        <div class="control-row">...</div> <!-- Resolution input -->
    </section>
    
    <!-- Gesture Presets -->
    <section class="section">
        <h2 class="section-header">Gesture Presets</h2>
        <div class="control-row">...</div>
    </section>
    
    <!-- Components -->
    <section class="section">
        <h2 class="section-header">Components</h2>
        <div class="control-row">...</div>
    </section>
    
    <!-- Effect Presets -->
    <section class="section">
        <h2 class="section-header">Effect Presets</h2>
        <div class="control-row">...</div>
    </section>
    
    <!-- Elevation -->
    <section class="section">
        <h2 class="section-header">Elevation</h2>
        <div class="control-row">...</div>
    </section>
</div>
```

## CSS Class System

### Unified Classes

**Use ONLY these classes for consistency:**

```css
/* Container */
.container {
    padding: 6px 16px 16px 16px; /* Top reduced for tight fit */
}

/* All sections */
.section {
    margin-bottom: 16px; 
    padding-bottom: 2px;
    border-bottom: 1px solid #3a3a3a;
}

/* All interactive rows */
.control-row {
    display: flex;
    gap: 10px;
    margin-bottom: 10px; /* CRITICAL: Change this to affect ALL rows */
    align-items: stretch;
}

/* All section headers */
.section-header {
    color: #ffffff;
    font-size: 12px;
    font-weight: 500;
    margin: 0 0 10px 0;
    letter-spacing: 0.5px;
}

/* All buttons */
.main-button {
    height: 40px;
    background-color: #2f2f2f;
    border: 1px solid rgba(255, 255, 255, 0.08);
    color: #cccccc;
    font-size: 12.5px;
    border-radius: 6px;
}

/* All dropdowns */
.dropdown {
    height: 40px;
    background-color: #222222;
    border: 1px solid rgba(255, 255, 255, 0.08);
    color: #cccccc;
    font-size: 12.5px;
    border-radius: 6px;
}
```

## Adding New Sections

### Step-by-Step Process

#### 1. Add HTML Section
```html
<!-- New Feature Section -->
<section class="section">
    <h2 class="section-header">New Feature</h2>
    <div class="control-row">
        <select id="newFeatureType" class="dropdown">
            <option value="feature1">Feature Option 1</option>
            <option value="feature2">Feature Option 2</option>
            <option value="feature3">Feature Option 3</option>
        </select>
        <button id="addNewFeature" class="main-button">Add New Feature</button>
    </div>
</section>
```

#### 2. Add JavaScript Event Handler
```javascript
// Add New Feature button handler
var addNewFeatureButton = document.getElementById('addNewFeature');
addNewFeatureButton.addEventListener('click', function() {
    console.log('Add New Feature clicked');
    
    // Get values
    var featureType = document.getElementById('newFeatureType').value;
    var resolutionMultiplier = parseInt(document.getElementById('resolutionMultiplier').value);
    
    // UI feedback
    addNewFeatureButton.disabled = true;
    addNewFeatureButton.textContent = 'Adding...';
    
    // Extension path
    var setPathScript = 'var extensionRoot = "' + extensionPath.replace(/\\/g, '\\\\') + '";';
    csInterface.evalScript(setPathScript);
    
    // Execute ExtendScript
    var script = 'addNewFeatureFromPanel("' + featureType + '", ' + resolutionMultiplier + ')';
    csInterface.evalScript(script, function(result) {
        // Reset button
        addNewFeatureButton.disabled = false;
        addNewFeatureButton.textContent = 'Add New Feature';
    });
});
```

### Special Control Types

#### Two-Button Layout (like Effect Presets)
```html
<div class="control-row">
    <button id="action1" class="main-button">Action 1</button>
    <button id="action2" class="main-button">Action 2</button>
</div>
```

#### Custom Input Layout (like Resolution Input)
```html
<div class="control-row">
    <label for="customInput" class="resolution-label">Custom Label</label>
    <div class="number-input-container">
        <!-- Custom input controls -->
    </div>
</div>
```

## Control Patterns

### Button Text Guidelines

**Use consistent, action-oriented text:**

```html
<!-- Pattern: Action + Object -->
<button class="main-button">Add Gesture</button>
<button class="main-button">Add Component</button>
<button class="main-button">Add Shadow</button>

<!-- Pattern: Action + Description -->
<button class="main-button">Make Comp</button>
<button class="main-button">Replace Rect</button>

<!-- Loading states -->
addButton.textContent = 'Adding...';   // During operation
addButton.textContent = 'Loading...';  // During template import
```

## Visual Consistency

### Spacing Hierarchy

```
Container padding: 6px (top) 16px (sides)
├── Section margin-bottom: 16px
├── Section padding-bottom: 2px
├── Section header margin-bottom: 10px  
└── Control row margin-bottom: 10px ← CRITICAL SPACING CONTROL
```

### Color Palette

```css
/* Backgrounds */
--body-bg: #262626
--button-bg: #2f2f2f
--input-bg: #222222
--container-bg: inherit

/* Borders */
--section-border: #3a3a3a
--button-border: rgba(255, 255, 255, 0.08)

/* Text */
--primary-text: #ffffff
--secondary-text: #cccccc

/* Scrollbar */
--scrollbar-thumb: #3a3a3a
--scrollbar-thumb-hover: #4a4a4a
```

## Responsive Behavior

### Button Text Adaptation

```css
/* Responsive text for space-constrained buttons */
.main-button .short-text {
    display: none;
}

@media (max-width: 237px) {
    .main-button .full-text {
        display: none;
    }
    
    .main-button .short-text {
        display: inline;
    }
}
```

```html
<!-- Implementation -->
<button id="createSquircle" class="main-button">
    <span class="full-text">Add Squircle</span>
    <span class="short-text">Squircle</span>
</button>
```

## Quality Checklist

Before adding a new section, verify:

- [ ] Uses `<section class="section">` wrapper
- [ ] Has `<h2 class="section-header">` title
- [ ] Uses `<div class="control-row">` for controls
- [ ] Buttons have `class="main-button"`
- [ ] Dropdowns have `class="dropdown"`
- [ ] Consistent spacing with other sections
- [ ] JavaScript follows established event handler pattern
- [ ] No custom CSS classes created for spacing
- [ ] Responsive behavior considered
- [ ] Loading states implemented
- [ ] Error handling included

---

# Easing Systems

## CSS to After Effects Easing Conversion

### Overview
Converting CSS `cubic-bezier(x1, y1, x2, y2)` values to After Effects `KeyframeEase(speed, influence)` parameters requires understanding the inverse relationship between these two systems.

### Key Relationships

#### Basic Pattern
- **Lower KeyframeEase speed** = **Higher cubic-bezier handle position**
- **Higher KeyframeEase influence** = **More pronounced curve effect**

#### Handle Mapping
For `cubic-bezier(x1, y1, x2, y2)`:
- **x1** (first handle) is controlled by `easeIn` parameters
- **x2** (second handle) is controlled by `easeOut` parameters
- **y1** and **y2** are always 0.00 and 1.00 respectively in After Effects

### Conversion Formula (Empirical)

Based on extensive testing with `cubic-bezier(0.40, 0.00, 0.20, 1.00)`:

#### For First Handle (x1)
```javascript
// Target: x1 = 0.40
var easeIn = new KeyframeEase(0.04, 75);
```

#### For Second Handle (x2)  
```javascript
// Target: x2 = 0.20
var easeOut = new KeyframeEase(0.94, 35);
```

### Conversion Process

#### Step 1: Start with Base Values
For any cubic-bezier conversion, start with middle-range values:
```javascript
var easeIn = new KeyframeEase(0.50, 50);   // Middle starting point
var easeOut = new KeyframeEase(0.50, 50);  // Middle starting point
```

#### Step 2: Adjust for First Handle (x1)
- **If target x1 > current result**: Decrease easeIn speed, increase influence
- **If target x1 < current result**: Increase easeIn speed, decrease influence

#### Step 3: Adjust for Second Handle (x2)
- **If target x2 > current result**: Decrease easeOut speed, increase influence
- **If target x2 < current result**: Increase easeOut speed, decrease influence

#### Step 4: Fine-tune Iteratively
Make small adjustments (±0.02 for speed, ±5 for influence) and test until you hit target values.

### Implementation in After Effects Script

```javascript
function setCustomBezierEasing(property, x1, x2) {
    // Start with estimated values based on target handles
    var easeInSpeed = 1 - (x1 * 2);        // Inverse relationship approximation
    var easeOutSpeed = 1 - (x2 * 2);       // Inverse relationship approximation
    var easeInInfluence = x1 * 100 + 30;   // Higher handles need higher influence
    var easeOutInfluence = x2 * 100 + 30;  // Higher handles need higher influence
    
    // Clamp values to valid ranges
    easeInSpeed = Math.max(0.01, Math.min(1, easeInSpeed));
    easeOutSpeed = Math.max(0.01, Math.min(1, easeOutSpeed));
    easeInInfluence = Math.max(5, Math.min(100, easeInInfluence));
    easeOutInfluence = Math.max(5, Math.min(100, easeOutInfluence));
    
    var easeIn = new KeyframeEase(easeInSpeed, easeInInfluence);
    var easeOut = new KeyframeEase(easeOutSpeed, easeOutInfluence);
    
    // Apply to all keyframes
    for (var i = 1; i <= property.numKeys; i++) {
        property.setInterpolationTypeAtKey(i, KeyframeInterpolationType.BEZIER);
        property.setTemporalEaseAtKey(i, [easeIn], [easeOut]);
    }
}

// Usage example
setCustomBezierEasing(myProperty, 0.40, 0.20);
```

### Quick Reference Table

| Target x1 | Approx easeIn Speed | Approx easeIn Influence |
|-----------|---------------------|-------------------------|
| 0.20      | 0.08-0.10          | 60-70                   |
| 0.30      | 0.06-0.08          | 65-75                   |
| 0.40      | 0.04-0.06          | 70-80                   |
| 0.50      | 0.02-0.04          | 75-85                   |

| Target x2 | Approx easeOut Speed | Approx easeOut Influence |
|-----------|---------------------|--------------------------|
| 0.20      | 0.90-0.95          | 30-40                    |
| 0.30      | 0.85-0.90          | 25-35                    |
| 0.40      | 0.80-0.85          | 20-30                    |
| 0.50      | 0.75-0.80          | 15-25                    |

### Notes & Limitations

1. **y1 and y2 are always 0.00 and 1.00** in After Effects temporal easing
2. **The relationship is non-linear** - small changes in KeyframeEase can cause large changes in cubic-bezier values
3. **Influence affects both handles** - changing one KeyframeEase can slightly affect the other handle
4. **Precision is limited** - After Effects may not achieve exact decimal precision
5. **Always test iteratively** - The conversion is empirical, not mathematical

---

## Keyframe Easing Preservation

### The Problem

When users performed delay nudging, duration stretching, or stagger operations in the AirBoard plugin, keyframe easing curves were being changed or lost. This was particularly frustrating because:

1. **Inconsistent Behavior**: Some operations preserved easing perfectly (shift+click delay), while others didn't
2. **Baseline vs Non-Baseline**: The first keyframe property (baseline) would lose easing, while subsequent properties preserved it
3. **Different Functions, Different Results**: Duration operations had different easing preservation than delay operations

### The Investigation Process

#### Identifying the Working Reference

The breakthrough came when the user pointed out: *"when I shift click delay it preserves easing properly"*

This gave us a **working reference implementation** to study. The shift+click delay used `nudgeDelayTimelineMode()` function, which had perfect easing preservation.

#### Key Discovery: Timeline Mode's Pattern
```javascript
// Timeline mode - the WORKING pattern
if (keyData.inInterp === KeyframeInterpolationType.BEZIER || 
    keyData.outInterp === KeyframeInterpolationType.BEZIER) {
    try {
        keyData.inEase = prop.keyInTemporalEase(keyIndex);
        keyData.outEase = prop.keyOutTemporalEase(keyIndex);
    } catch(e) {
        // Temporal ease might not be available
    }
}

// Later restoration:
if (data.inEase !== undefined && data.outEase !== undefined) {
    try {
        prop.setTemporalEaseAtKey(newIdx, data.inEase, data.outEase);
    } catch(e) {
        // Some properties might not support temporal ease
    }
}
```

### The Key Insights

#### Insight 1: The Restrictive Condition Problem

The broken implementations used this overly restrictive condition:
```javascript
// This was TOO restrictive!
if (keyData.inEase !== undefined && keyData.outEase !== undefined && 
    keyData.inInterp === KeyframeInterpolationType.BEZIER && 
    keyData.outInterp === KeyframeInterpolationType.BEZIER)
```

**Problem**: This only restored easing when BOTH in and out interpolation were bezier. But keyframes can have:
- **Ease In**: Bezier in, Linear out
- **Ease Out**: Linear in, Bezier out  
- **Mixed easing**: Different curves on each side

The working pattern was much simpler:
```javascript
// This works for ALL easing types!
if (keyData.inEase !== undefined && keyData.outEase !== undefined)
```

#### Insight 2: The Try-Catch Safety Net

After Effects' ExtendScript APIs are notoriously unreliable. What works on one property type might fail on another:

```javascript
// Without try-catch: Silent failures
keyData.inEase = prop.keyInTemporalEase(keyIndex); // Might fail

// With try-catch: Graceful handling
try {
    keyData.inEase = prop.keyInTemporalEase(keyIndex);
    keyData.outEase = prop.keyOutTemporalEase(keyIndex);
} catch(e) {
    // Some properties don't support temporal ease - that's OK
}
```

#### Insight 3: The Baseline Keyframe Challenge

The final puzzle piece was baseline keyframes losing easing. The solution:

```javascript
// The winning approach for baseline keyframes
if (propData.isOriginalBaseline && useIndividualDelays) {
    timeOffset = 0; // No movement, but still recreate for easing preservation
}
```

### The Universal Easing Preservation Pattern

Every keyframe manipulation function now follows this proven pattern:

```javascript
function anyKeyframeOperation() {
    try {
        app.beginUndoGroup("Keyframe Operation");
        
        // 1. COLLECT with error handling
        var keyData = {
            // ... basic properties
        };
        
        // Temporal ease collection (with try-catch)
        if (keyData.inInterp === KeyframeInterpolationType.BEZIER || 
            keyData.outInterp === KeyframeInterpolationType.BEZIER) {
            try {
                keyData.inEase = prop.keyInTemporalEase(keyIndex);
                keyData.outEase = prop.keyOutTemporalEase(keyIndex);
            } catch(e) {
                // Handle gracefully
            }
        }
        
        // Spatial properties for Position keyframes
        if (prop.isSpatial) {
            try {
                keyData.spatialContinuous = prop.keySpatialContinuous(keyIndex);
                keyData.spatialAutoBezier = prop.keySpatialAutoBezier(keyIndex);
                keyData.inTangent = prop.keyInSpatialTangent(keyIndex);
                keyData.outTangent = prop.keyOutSpatialTangent(keyIndex);
            } catch(e) {
                // Handle gracefully
            }
        }
        
        // 2. MANIPULATE (delete old, create new)
        prop.removeKey(oldIndex);
        var newIdx = prop.addKey(newTime);
        
        // 3. RESTORE with error handling
        prop.setValueAtKey(newIdx, keyData.value);
        prop.setInterpolationTypeAtKey(newIdx, keyData.inInterp, keyData.outInterp);
        
        // Restore temporal ease (simple condition)
        if (keyData.inEase !== undefined && keyData.outEase !== undefined) {
            try {
                prop.setTemporalEaseAtKey(newIdx, keyData.inEase, keyData.outEase);
            } catch(e) {
                // Handle gracefully
            }
        }
        
        // Restore all other properties...
        
        app.endUndoGroup();
        return "success";
        
    } catch(e) {
        app.endUndoGroup();
        return "error|" + e.toString();
    }
}
```

### Complete Easing Preservation Checklist

For every keyframe manipulation function, ensure:

#### Temporal Properties Collection:
```javascript
if (keyData.inInterp === KeyframeInterpolationType.BEZIER || 
    keyData.outInterp === KeyframeInterpolationType.BEZIER) {
    try {
        keyData.inEase = prop.keyInTemporalEase(keyIndex);
        keyData.outEase = prop.keyOutTemporalEase(keyIndex);
    } catch(e) {
        // Temporal ease might not be available
    }
}
```

#### Spatial Properties Collection (for Position keyframes):
```javascript
if (prop.isSpatial) {
    try {
        keyData.spatialContinuous = prop.keySpatialContinuous(keyIndex);
        keyData.spatialAutoBezier = prop.keySpatialAutoBezier(keyIndex);
        keyData.inTangent = prop.keyInSpatialTangent(keyIndex);
        keyData.outTangent = prop.keyOutSpatialTangent(keyIndex);
    } catch(e) {
        // Spatial properties might not be available
    }
}
```

#### Complete Restoration:
```javascript
// Restore temporal ease
if (keyData.inEase !== undefined && keyData.outEase !== undefined) {
    try {
        prop.setTemporalEaseAtKey(newIdx, keyData.inEase, keyData.outEase);
    } catch(e) {
        // Some properties might not support temporal ease
    }
}

// Restore temporal properties
prop.setTemporalContinuousAtKey(newIdx, keyData.temporalContinuous);
prop.setTemporalAutoBezierAtKey(newIdx, keyData.temporalAutoBezier);

// Restore spatial properties (Position keyframes)
if (keyData.spatialContinuous !== undefined) {
    try {
        prop.setSpatialContinuousAtKey(newIdx, keyData.spatialContinuous);
        prop.setSpatialAutoBezierAtKey(newIdx, keyData.spatialAutoBezier);
        prop.setSpatialTangentsAtKey(newIdx, keyData.inTangent, keyData.outTangent);
    } catch(e) {
        // Some properties might not support spatial settings
    }
}
```

### Common Pitfalls & Solutions

#### Pitfall 1: The "BEZIER && BEZIER" Trap
```javascript
// WRONG: Only works for fully bezier keyframes
if (inInterp === BEZIER && outInterp === BEZIER)

// RIGHT: Works for mixed easing types
if (inEase !== undefined && outEase !== undefined)
```

#### Pitfall 2: The Silent Failure Trap
```javascript
// WRONG: Fails silently on some properties
keyData.inEase = prop.keyInTemporalEase(keyIndex);

// RIGHT: Graceful error handling
try {
    keyData.inEase = prop.keyInTemporalEase(keyIndex);
} catch(e) {
    // Handle gracefully
}
```

#### Pitfall 3: The Baseline Selection Trap
```javascript
// WRONG: Skip baseline keyframes (loses selection)
if (isBaseline) continue;

// RIGHT: Process with zero offset (preserves selection)
if (isBaseline) timeOffset = 0;
```

### Lessons Learned

1. **Find the Working Reference First** - Always look for a working implementation as your north star
2. **After Effects APIs Are Fragile** - Never assume an API call will work; always wrap in try-catch
3. **Simplicity Beats Complexity** - The simpler condition worked better than restrictive ones
4. **User Experience Drives Technical Decisions** - Preserve selection to maintain UX
5. **Comprehensive Testing Reveals Edge Cases** - Test across different keyframe types

### The Impact

After implementing this comprehensive easing preservation system:

✅ **All keyframe operations preserve easing perfectly**  
✅ **Baseline and non-baseline keyframes behave identically**  
✅ **Mixed easing types (Ease In/Out) work correctly**  
✅ **Position keyframes preserve spatial curves**  
✅ **User experience is consistent across all operations**  

---

*This technical documentation consolidates UI patterns, easing conversion methods, and keyframe preservation strategies developed for the AirBoard After Effects plugin.*

*Last Updated: September 2025*