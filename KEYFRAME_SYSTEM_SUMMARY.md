# AirBoard Keyframe System - Complete Implementation Guide

## Overview
The AirBoard plugin features a comprehensive keyframe manipulation system that handles Duration, Position Distance, and **Delay nudging** with intelligent timeline vs baseline mode detection. This document captures all the hard-won knowledge from implementing these complex keyframe operations.

---

## 🎯 **DELAY NUDGING SYSTEM** - The Complete Implementation

### **Timeline Position Nudging vs Baseline Delay Nudging**

The delay system has **two intelligent modes** that automatically switch based on keyframe timing:

#### **🕐 Timeline Position Nudging Mode**
- **Trigger**: When ALL selected keyframes start at the **same baseline time**
- **Behavior**: Moves ALL keyframes together in the timeline by 50ms increments
- **Purpose**: Shift entire animation timeline while preserving timing relationships
- **Visual**: `success|50|3|TIMELINE` or `success|50|3|TIMELINE-FORCED`

#### **⏱️ Baseline Delay Mode** 
- **Trigger**: When keyframes have **different baseline times**
- **Behavior**: Only moves keyframes that have delays, baseline keyframes stay put
- **Purpose**: Adjust timing between different properties
- **Visual**: `success|50|3|BASELINE`

---

## 🧠 **CRITICAL TECHNICAL CHALLENGES SOLVED**

### **Challenge 1: Keyframe Selection Preservation - THE COMPLETE SOLUTION**
**Problem**: After Effects' keyframe selection APIs are extremely unreliable, especially when working with multiple properties. The selection state gets lost in several critical ways.

**THE COMPLETE MULTI-PROPERTY SELECTION SOLUTION** (December 2024)

This is the definitive solution to maintaining keyframe selection across multiple properties when manipulating keyframes:

#### **Critical Issues That Were Solved:**

1. **`selectedKeys` becomes unreliable after ANY manipulation** - Once you start modifying keyframes on one property, `prop.selectedKeys` returns 0 for other properties
2. **Property references become stale** - After keyframe manipulation, property object references can become invalid
3. **`prop.selected = true` auto-selects ALL keyframes** - Setting a property as selected causes After Effects to select ALL keyframes on that property
4. **Selection state is lost between properties** - After Effects loses track of selections on Property B when you manipulate Property A

#### **THE WORKING SOLUTION:**

```javascript
// STEP 1: CACHE ALL SELECTIONS BEFORE ANY MANIPULATION
var cachedSelections = [];
for (var i = 0; i < selectedLayers.length; i++) {
    var layer = selectedLayers[i];
    var selectedProps = layer.selectedProperties;
    
    for (var j = 0; j < selectedProps.length; j++) {
        var prop = selectedProps[j];
        
        // CRITICAL: Manually check EVERY keyframe for selection
        // DO NOT trust prop.selectedKeys after this point!
        var selKeys = [];
        for (var k = 1; k <= prop.numKeys; k++) {
            if (prop.keySelected(k)) {
                selKeys.push(k);
            }
        }
        
        if (selKeys.length >= 2) {
            cachedSelections.push({
                layer: layer,
                layerName: layer.name,
                property: prop,
                propertyName: prop.name,
                selectedIndices: selKeys.slice() // Make a copy!
            });
        }
    }
}

// STEP 2: PROCESS USING CACHED SELECTIONS
// Now you can manipulate keyframes using the cached data
// The original selectedKeys API is no longer reliable!
for (var i = 0; i < cachedSelections.length; i++) {
    var cached = cachedSelections[i];
    var prop = cached.property;
    var selKeys = cached.selectedIndices; // Use cached, not prop.selectedKeys!
    
    // Do your keyframe manipulation here...
}

// STEP 3: RESTORE SELECTION WITH FRESH REFERENCES
// Re-acquire fresh property references
function findPropertyByName(layer, targetName) {
    function searchGroup(group) {
        for (var i = 1; i <= group.numProperties; i++) {
            var prop = group.property(i);
            if (prop.name === targetName && prop.canVaryOverTime) {
                return prop;
            }
            if (prop.propertyType === PropertyType.INDEXED_GROUP || 
                prop.propertyType === PropertyType.NAMED_GROUP) {
                var found = searchGroup(prop);
                if (found) return found;
            }
        }
        return null;
    }
    return searchGroup(layer);
}

// STEP 4: DESELECT ALL, THEN SELECT ONLY WHAT WE WANT
for (var i = 0; i < cachedSelections.length; i++) {
    var cached = cachedSelections[i];
    
    // Get fresh property reference
    var freshProp = findPropertyByName(cached.layer, cached.propertyName);
    if (!freshProp) continue;
    
    // CRITICAL: First deselect ALL keyframes on this property
    for (var k = 1; k <= freshProp.numKeys; k++) {
        try {
            freshProp.setSelectedAtKey(k, false);
        } catch(e) {
            // Ignore deselection errors
        }
    }
    
    // Now select only the keyframes we want
    for (var j = 0; j < cached.selectedIndices.length; j++) {
        freshProp.setSelectedAtKey(cached.selectedIndices[j], true);
    }
}

// CRITICAL: DO NOT set prop.selected = true!
// This will auto-select ALL keyframes on the property!
```

#### **Why Each Step is Critical:**

1. **Cache Before Manipulation**: After Effects' `selectedKeys` API becomes unreliable the moment you start manipulating any keyframes
2. **Manual Selection Check**: Loop through ALL keyframes with `keySelected()` instead of trusting `selectedKeys`
3. **Fresh Property References**: Property objects can become stale after manipulation
4. **Deselect All First**: Ensures no extra keyframes remain selected
5. **Never Use `prop.selected = true`**: This triggers After Effects' auto-selection of ALL keyframes

#### **Common Pitfalls to Avoid:**
```javascript
// ❌ WRONG: Trusting selectedKeys after manipulation starts
var selKeys = prop.selectedKeys; // Returns 0 after other properties are touched!

// ❌ WRONG: Using stale property references
var prop = cachedProp; // May be invalid after keyframe manipulation

// ❌ WRONG: Setting property as selected
prop.selected = true; // Auto-selects ALL keyframes!

// ❌ WRONG: Not deselecting first
prop.setSelectedAtKey(index, true); // Other keyframes might stay selected!

// ✅ RIGHT: The complete solution above
```

### **Challenge 2: The setKeyTime() Method Doesn't Exist**
**Problem**: `prop.setKeyTime()` is undefined in After Effects ExtendScript.

**Solution**: Use keyframe recreation approach (delete old, create new)
```javascript
// WRONG: Try to move keyframes in place
prop.setKeyTime(keyIndex, newTime); // ReferenceError: Function undefined

// RIGHT: Delete and recreate keyframes
// 1. Collect all keyframe data
var keyframesToMove = [{
    oldIndex: keyIndex,
    value: prop.keyValue(keyIndex),
    inInterp: prop.keyInInterpolationType(keyIndex),
    outInterp: prop.keyOutInterpolationType(keyIndex),
    // ... all other properties
}];

// 2. Remove old keyframes (reverse order)
prop.removeKey(keyIndex);

// 3. Create new keyframes at new times
var newIdx = prop.addKey(newTime);
prop.setValueAtKey(newIdx, data.value);
// ... restore all properties
```

### **Challenge 3: Perfect Easing Preservation**
**Problem**: Timeline nudging was changing easing curves on Position keyframes.

**Solution**: Preserve ALL temporal AND spatial properties
```javascript
// Collect temporal properties (all properties)
var keyData = {
    inInterp: prop.keyInInterpolationType(keyIndex),
    outInterp: prop.keyOutInterpolationType(keyIndex),
    temporalContinuous: prop.keyTemporalContinuous(keyIndex),
    temporalAutoBezier: prop.keyTemporalAutoBezier(keyIndex)
};

// Collect temporal ease if bezier
if (keyData.inInterp === KeyframeInterpolationType.BEZIER) {
    keyData.inEase = prop.keyInTemporalEase(keyIndex);
    keyData.outEase = prop.keyOutTemporalEase(keyIndex);
}

// CRITICAL: Collect spatial properties for Position keyframes
if (prop.isSpatial) {
    keyData.spatialContinuous = prop.keySpatialContinuous(keyIndex);
    keyData.spatialAutoBezier = prop.keySpatialAutoBezier(keyIndex);
    keyData.inTangent = prop.keyInSpatialTangent(keyIndex);
    keyData.outTangent = prop.keyOutSpatialTangent(keyIndex);
}

// Restore ALL properties when recreating
prop.setInterpolationTypeAtKey(newIdx, keyData.inInterp, keyData.outInterp);

if (keyData.inEase !== undefined) {
    prop.setTemporalEaseAtKey(newIdx, keyData.inEase, keyData.outEase);
}

prop.setTemporalContinuousAtKey(newIdx, keyData.temporalContinuous);
prop.setTemporalAutoBezierAtKey(newIdx, keyData.temporalAutoBezier);

// SPATIAL properties for Position
if (keyData.spatialContinuous !== undefined) {
    prop.setSpatialContinuousAtKey(newIdx, keyData.spatialContinuous);
    prop.setSpatialAutoBezierAtKey(newIdx, keyData.spatialAutoBezier);
    prop.setSpatialTangentsAtKey(newIdx, keyData.inTangent, keyData.outTangent);
}
```

### **Challenge 4: Timeline vs Baseline Detection Logic**
**Problem**: Determining when to use timeline nudging vs baseline nudging.

**Solution**: Check if ALL first keyframes are at same time
```javascript
// NEW TIMELINE DETECTION: Only check FIRST keyframes of each property
var allFirstKeyframesAtSameTime = true;
var firstKeyframeTime = null;

for (var propName in propertyMap) {
    var keyframes = propertyMap[propName].keyframes;
    
    if (keyframes.length > 0) {
        // Only check FIRST keyframe of each property
        var firstKeyTime = keyframes[0].time;
        
        if (firstKeyframeTime === null) {
            firstKeyframeTime = firstKeyTime;
        } else if (Math.abs(firstKeyTime - firstKeyframeTime) > 0.001) {
            allFirstKeyframesAtSameTime = false;
            break;
        }
    }
}

// FORCED TIMELINE for single properties OR multiple properties at same baseline
var shouldForceTimeline = (propertyDelays.length === 1 && Math.abs(propertyDelays[0].relativeDelay) < 1) ||
                         (propertyDelays.length >= 2 && allSameDelay && Math.abs(propertyDelays[0].relativeDelay) < 1);
```

### **Challenge 5: Timeline Offset vs Absolute Positioning**
**Problem**: Moving keyframes to same absolute time collapses them into single keyframes.

**Solution**: Calculate timeline offset, maintain relative spacing
```javascript
// WRONG: Move all keyframes to same time
var newTime = firstKeyframeTime + nudgeAmount;
for (all keyframes) {
    recreateAt(newTime); // All collapse to same time!
}

// RIGHT: Calculate offset, maintain spacing
var timelineOffset = newTimelineTime - firstKeyframeTime;

for (var k = 0; k < keyframes.length; k++) {
    var oldTime = keyframes[k].time;
    var newTime = oldTime + timelineOffset; // Preserve spacing!
    recreateAt(Math.max(0, newTime)); // Clamp to 0
}
```

### **Challenge 6: Single vs Multi-Property Mode Detection**
**Problem**: Single properties need different detection logic than multi-properties.

**Solution**: Separate logic paths for single vs multiple properties
```javascript
// For SINGLE properties: Force timeline if at 0ms delay regardless of keyframe timing
// For MULTIPLE properties: Require same delay AND same timing

var shouldForceTimeline = (propertyDelays.length === 1 && Math.abs(propertyDelays[0].relativeDelay) < 1) ||
                         (propertyDelays.length >= 2 && allSameDelay && Math.abs(propertyDelays[0].relativeDelay) < 1);

// Single property doesn't need allSameDelay check because timeline nudging
// is about moving the animation timeline, not synchronizing keyframes
```

---

## 🏗️ **KEYFRAME MANIPULATION ARCHITECTURE**

### **Core Functions Hierarchy**

#### **1. Reading System**
```
readKeyframesDuration() → readKeyframesSmart()
├── Cross-property delay detection
├── Duration calculation between keyframes  
├── Position distance calculation
└── Return format: "success|delay|duration|frames|xDist|yDist"
```

#### **2. Nudging System**
```
nudgeDelayFromPanel(direction) → Main delay nudging entry point
├── Property detection and mapping
├── Baseline cache initialization  
├── Timeline vs Baseline mode detection
│   ├── TIMELINE MODE: allFirstKeyframesAtSameTime = true
│   │   ├── Calculate timeline offset
│   │   ├── Move all keyframes with preserved spacing
│   │   └── Recreate with full property preservation
│   └── BASELINE MODE: Different baseline times
│       ├── Only move delayed keyframes
│       ├── Baseline keyframes stay fixed
│       └── Individual property offset calculations
└── Selection preservation system
```

#### **3. Duration & Position Nudging**
```
stretchKeyframesGrokApproach(frameAdjustment)
├── Smart 50ms snapping logic
├── Timeline position independent calculations
└── Keyframe recreation with easing preservation

nudgeXPosition() / nudgeYPosition()
├── 10px smart snapping for position values
├── In/Out direction control (first/last keyframe)
└── Axis-specific validation
```

---

## 💾 **BASELINE CACHE SYSTEM**

### **Purpose**: Maintain reference to original keyframe timing across multiple nudging operations.

```javascript
var BASELINE_CACHE = {
    originalEarliestTime: null,
    originalBaselineProperty: null,
    initialized: false,
    
    reset: function() {
        this.originalEarliestTime = null;
        this.originalBaselineProperty = null;
        this.initialized = false;
    },
    
    initialize: function(earliestTime, baselineProperty) {
        if (!this.initialized) {
            this.originalEarliestTime = earliestTime;
            this.originalBaselineProperty = baselineProperty;
            this.initialized = true;
        }
        return {
            earliestTime: this.originalEarliestTime,
            baselineProperty: this.originalBaselineProperty
        };
    }
};

// CRITICAL: Reset cache each nudge operation for fresh detection
BASELINE_CACHE.reset();
var baselineData = BASELINE_CACHE.initialize(scanEarliestTime, scanBaselineProperty);
```

---

## 📊 **RETURN FORMAT SPECIFICATIONS**

### **Delay Nudging Results**
```javascript
// Timeline Mode Success
"success|50|3|TIMELINE"        // Regular timeline detection
"success|50|3|TIMELINE-FORCED" // Forced timeline for single properties

// Baseline Mode Success  
"success|50|3|1|BASELINE"      // Cross-property mode (1 = cross-property)
"success|50|3|0|BASELINE"      // Single property mode (0 = single)

// Error Cases
"error|No selected keyframes found"
"error|Snapping error: [detailed error message]"
```

### **Reading Results**
```javascript
// Standard format
"success|delayMs|delayFrames|crossPropertyMode|durationMs|durationFrames|xDistance|yDistance|hasXDistance|hasYDistance|crossPropertyIndicator"

// Cross-property examples
"success|0|0|1|1|1|127|183|1|1|1"     // Multiple properties, same delay
"success|0|0|-1|-1|1|127|183|1|1|1"   // Multiple properties, different delays (-1 = Multiple)

// Single property examples  
"success|0|0|0|500|30|127|183|1|1|0"  // Single property with duration
```

---

## 🎮 **USER EXPERIENCE FLOW**

### **Typical Workflow**
1. **Select keyframes** on one or more properties
2. **Click "Read Keyframes"** → Shows current delay/duration state
3. **Click Delay +/-** → System automatically detects mode:
   - **Same baseline** → Timeline nudging (move all keyframes)
   - **Different baselines** → Baseline nudging (move only delayed)
4. **Keyframes move** with perfect easing preservation and selection maintained
5. **Repeat operations** work seamlessly due to selection preservation

### **Mode Switching Examples**

#### **Timeline Mode Scenario**
- Position keyframes at 0ms, 500ms  
- Opacity keyframes at 0ms, 167ms
- **Both start at 0ms** → Timeline mode → Both properties move to 50ms, 550ms and 50ms, 217ms

#### **Baseline Mode Scenario**
- Position keyframes at 0ms, 500ms (baseline)
- Opacity keyframes at 100ms, 267ms (delayed)
- **Different start times** → Baseline mode → Position stays at 0ms, Opacity moves to 150ms

---

## 🔧 **DEVELOPMENT LESSONS LEARNED**

### **1. Property Collection Patterns**
```javascript
// ROBUST: Use selectedProperties API
var selectedLayers = [];
for (var i = 1; i <= app.project.activeItem.selectedLayers.length; i++) {
    var layer = app.project.activeItem.selectedLayers[i];
    selectedLayers.push(layer);
}

for (var layerIdx = 0; layerIdx < selectedLayers.length; layerIdx++) {
    var layer = selectedLayers[layerIdx];
    var selectedProps = layer.selectedProperties;
    
    for (var propIdx = 0; propIdx < selectedProps.length; propIdx++) {
        var prop = selectedProps[propIdx];
        if (prop.selectedKeys && prop.selectedKeys.length > 0) {
            // Process selected keyframes
        }
    }
}
```

### **2. Floating Point Precision Handling**
```javascript
// Always use tolerance for time comparisons
var TOLERANCE = 0.001; // 1ms tolerance
if (Math.abs(keyTime1 - keyTime2) < TOLERANCE) {
    // Times are considered equal
}

// Snap to clean values
var SNAP_TOLERANCE = 1; // 1ms tolerance for snapping detection
var remainder = timeMs % 50;
var isAlreadySnapped = (remainder < SNAP_TOLERANCE) || (remainder > (50 - SNAP_TOLERANCE));
```

### **3. Error Handling Patterns**
```javascript
try {
    app.beginUndoGroup("Nudge Delay");
    
    // Main operation logic here
    
    var result = "success|" + newValue;
    app.endUndoGroup();
    return result;
    
} catch(error) {
    app.endUndoGroup(); // Always end undo group
    return "error|" + error.toString();
}
```

### **4. Cross-Property vs Single-Property Detection**
```javascript
// Count UNIQUE property names, not total keyframes
var propertyNames = [];
for (var propName in propertyMap) {
    if (propertyNames.indexOf(propName) === -1) {
        propertyNames.push(propName);
    }
}

var isCrossProperty = propertyNames.length > 1;

// Timeline nudging: Different logic for single vs multiple properties
if (propertyNames.length === 1) {
    // Single property: Force timeline if at 0ms delay
    forceTimeline = (Math.abs(firstPropertyDelay) < 1);
} else {
    // Multiple properties: Require same delay AND same timing  
    forceTimeline = (allSameDelay && allSameStartTime);
}
```

---

## 📁 **FILE ORGANIZATION**

### **Core Implementation Files**
- **`jsx/main.jsx`** - All ExtendScript keyframe manipulation functions
- **`client/js/main.js`** - JavaScript UI event handlers and result parsing
- **`client/index.html`** - Keyframe Reader section HTML structure
- **`client/css/styles.css`** - Button styling and visual states
- **`CHANGELOG.md`** - Complete feature documentation and version history

### **Key Functions by File**

#### **jsx/main.jsx**
- `readKeyframesDuration()` - Main reading function
- `readKeyframesSmart()` - Cross-property delay detection  
- `nudgeDelayFromPanel(direction)` - Main delay nudging entry
- `stretchKeyframesGrokApproach()` - Duration nudging with smart snapping
- `nudgeXPosition()` / `nudgeYPosition()` - Position nudging with direction control

#### **client/js/main.js**  
- `handleReadKeyframes()` - Parse reading results, update UI
- `setupInOutToggle()` - In/Out button toggle functionality
- Delay increment/decrement event handlers
- Duration and position button event handlers

---

## 🎯 **CURRENT VERSION: v4.9.3**

### **✅ Fully Implemented Features**

#### **🕐 Delay Nudging System (Complete)**
- **Timeline Position Nudging**: Move all keyframes together when at same baseline
- **Baseline Delay Nudging**: Move only delayed keyframes, preserve baseline
- **Perfect Easing Preservation**: All temporal + spatial properties maintained
- **Smart Mode Detection**: Automatic switching between timeline/baseline modes
- **Universal Property Support**: Single properties + multiple properties
- **Full Selection Preservation**: All keyframes stay selected after operations
- **50ms Increments**: Consistent timeline positioning with 0ms clamping

#### **⏱️ Duration System (Complete)**
- **Duration Reading**: Shows time between keyframes as "500ms / 30f"
- **Duration Stretching**: +/- buttons with smart 50ms snapping
- **Timeline Independence**: Works at any timeline position
- **Keyframe Recreation**: Preserves all easing and interpolation properties

#### **📐 Position Distance System (Complete)**  
- **Distance Reading**: Shows position movement as "X: 150.5px @1x", "Y: 75px @1x"
- **Resolution Scaling**: Automatically converts to @1x equivalent display
- **Position Nudging**: +/- buttons move keyframes by 10px with smart snapping
- **In/Out Direction**: First keyframe (In) vs last keyframe (Out) targeting
- **Axis Validation**: X buttons work with X properties, Y buttons with Y properties

---

## 🔮 **FUTURE DEVELOPMENT GUIDANCE**

### **When Adding New Keyframe Operations**
1. **Always use keyframe recreation approach** (delete/recreate) instead of direct modification
2. **Preserve ALL properties**: temporal ease, spatial tangents, interpolation, continuity, auto-bezier
3. **Implement deferred selection**: Collect indices first, select all at end
4. **Handle floating-point precision**: Use tolerance for time comparisons
5. **Provide proper error handling**: Try-catch with undo group management
6. **Test across different property types**: Position (spatial), Opacity (temporal), Scale, Rotation
7. **ALWAYS implement debug logging**: Use our DEBUG_JSX system for development
8. **⚠️ DO NOT build ZXP automatically** - Only run `./build-latest.sh` when explicitly requested by user

### **Debugging Keyframe Operations**

#### **Essential Debug Pattern**
```javascript
function yourKeyframeFunction() {
    try {
        // Clear previous debug messages
        DEBUG_JSX.clear();
        
        DEBUG_JSX.log("Starting keyframe operation");
        DEBUG_JSX.log("Selected layers: " + selectedLayers.length);
        
        // Your keyframe logic with debug points
        for (var i = 0; i < keyframes.length; i++) {
            DEBUG_JSX.log("Processing keyframe " + i + " at time: " + keyframes[i].time);
        }
        
        // Include debug messages in result
        var debugMessages = DEBUG_JSX.getMessages();
        return "success|operation_data|" + debugMessages.join("|");
        
    } catch(e) {
        DEBUG_JSX.error("Keyframe operation failed", e);
        var debugMessages = DEBUG_JSX.getMessages();
        return "error|" + e.toString() + "|" + debugMessages.join("|");
    }
}
```

#### **Critical Debug Points for Keyframe Operations**
1. **Selection validation**: Log how many layers/properties/keyframes are selected
2. **Time calculations**: Log original times, target times, and offsets
3. **Property preservation**: Log when temporal/spatial properties are restored
4. **Recreation process**: Log keyframe deletion and recreation steps
5. **Selection restoration**: Log deferred selection process

#### **Using the Debug Panel for Keyframes**
1. **Open debug panel** with 🐛 Debug button before testing
2. **Select keyframes** you want to manipulate
3. **Click operation button** (delay +/-, duration +/-, position +/-)
4. **Watch debug messages** appear in real-time
5. **Copy debug output** if you need to document issues

#### **Common Keyframe Debug Messages**
- `"Timeline vs Baseline mode detection: TIMELINE/BASELINE"`
- `"Moving keyframes with offset: +50ms"`
- `"Recreating keyframe at time: 1.5s with easing: BEZIER"`
- `"Selection restored: 5 keyframes selected"`

### **Property Preservation Checklist**
- ✅ `keyValue()` - The actual keyframe value
- ✅ `keyInInterpolationType()` / `keyOutInterpolationType()` - Linear, Bezier, Hold
- ✅ `keyInTemporalEase()` / `keyOutTemporalEase()` - Temporal easing curves
- ✅ `keyTemporalContinuous()` - Smooth vs broken temporal tangents  
- ✅ `keyTemporalAutoBezier()` - Auto vs manual temporal bezier
- ✅ `keySpatialContinuous()` - Smooth vs broken spatial tangents (Position properties)
- ✅ `keySpatialAutoBezier()` - Auto vs manual spatial bezier (Position properties)
- ✅ `keyInSpatialTangent()` / `keyOutSpatialTangent()` - Spatial curve handles (Position properties)

### **Mode Detection Patterns**
```javascript
// Timeline nudging: When all keyframes should move together
var shouldUseTimelineMode = allFirstKeyframesAtSameTime && 
                           ((singleProperty && atBaseline) || 
                            (multipleProperties && sameDelay && atBaseline));

// Baseline nudging: When only delayed keyframes should move  
var shouldUseBaselineMode = !shouldUseTimelineMode;
```

---

## 🛠️ **RECENT COMPLEX TECHNICAL SOLUTIONS** - Hard-Won Victories

*The following three solutions represent significant engineering challenges that required extensive debugging and iteration to solve properly. These patterns are essential for understanding how to work with After Effects' complex property systems.*

### **Challenge 7: Trimmed vs Naturally Positioned Layers - THE FINAL SOLUTION**
**Problem**: Global delay system needed to distinguish between layers that are naturally positioned (inPoint == startTime) vs layers that are trimmed/offset (inPoint != startTime) to correctly determine when visible content begins.

**Context**: When processing layers for global delay, we need to know when visible content actually starts. For naturally positioned layers, content starts at `startTime`. For trimmed layers, content starts at `startTime + inPoint`. Getting this wrong causes inPoints to move when they shouldn't, or fail to move when they should.

**THE COMPLETE SOLUTION** (September 2024)
```javascript
// CRITICAL: Distinguish between trimmed and naturally positioned layers
if (Math.abs(layer.inPoint - layer.startTime) < 0.001) {
    // Layer is naturally positioned (not trimmed) - visible content starts at startTime
    layerTimelineInPoint = layer.startTime;
} else {
    // Layer is trimmed - visible content starts at startTime + inPoint  
    layerTimelineInPoint = layer.startTime + layer.inPoint;
}

// Now use layerTimelineInPoint for accurate movement decisions
if (layerTimelineInPoint >= playheadTime) {
    // Move entire layer - visible content starts after playhead
    moveEntireLayer();
} else {
    // Layer spans playhead - check if we need to move inPoint
    if (layerTimelineInPoint < playheadTime && layer.outPoint > playheadTime) {
        // Layer spans playhead - extend outPoint, possibly move inPoint
        if (Math.abs(layer.inPoint - layer.startTime) < 0.001) {
            // Natural layer - check if content after playhead needs inPoint movement
            if (layer.startTime < playheadTime) {
                // Content starts before playhead - move inPoint to playhead
                layer.inPoint = playheadTime - layer.startTime + timeOffset;
            }
        } else {
            // Trimmed layer - use existing trimmed inPoint logic
            // Move inPoint if visible content starts after playhead
        }
        
        // Always extend outPoint
        layer.outPoint += timeOffset;
    }
}
```

**Why This Was Critical:**
1. **Natural vs Trimmed Detection**: `Math.abs(layer.inPoint - layer.startTime) < 0.001` is the key test
2. **Accurate Content Start**: Natural layers start content at `startTime`, trimmed layers at `startTime + inPoint`
3. **Prevents False Movement**: Stops inPoints from moving when content actually starts before playhead
4. **Enables Correct Movement**: Allows inPoints to move when content genuinely starts after playhead

**Edge Cases Handled:**
- Natural layers with inPoint == startTime (most common)
- Trimmed layers with inPoint != startTime (user manually trimmed)
- Layers that span playhead vs layers entirely after playhead
- Content that starts before vs after playhead position

### **Challenge 8: Layer Delay Reading for Trimmed vs Natural Layers**
**Problem**: When reading delays between layers (not keyframes), After Effects reports different `startTime` values depending on whether a layer has been trimmed, making accurate delay calculation impossible. Trimming a layer's in-point and then moving it changes the internal `startTime` to unexpected values.

**Context**: Users need to read the visual delay between layers in the timeline. But After Effects internally tracks layers differently based on their trimming state:
- **Natural layers**: Never trimmed, `inPoint == startTime` 
- **Trimmed layers**: Had their in-point adjusted, `inPoint != startTime`

**THE PROBLEM IN DETAIL** (Discovered December 2024):
When you trim a layer's in-point and move it:
1. Create two text layers at frame 0 and frame 30
2. Trim the first layer's in-point by 30 frames
3. Move the trimmed layer back so it visually starts at frame 0
4. After Effects now reports bizarre `startTime` values (like -2.133s) that don't match the visual position

**Failed Approaches**:
1. ❌ Using `layer.startTime` directly - gives wrong values for trimmed layers
2. ❌ Using `layer.startTime + layer.inPoint` - gives wrong values in different scenarios
3. ❌ Using `layer.startTime - layer.inPoint` - also incorrect
4. ❌ Complex conditionals based on negative startTime - inconsistent results

**THE SOLUTION** (December 2024):
```javascript
// The key insight: For delay reading, we need the VISUAL position of the layer bar
// Natural layers: visual position = startTime
// Trimmed layers: visual position = inPoint (surprisingly!)

var layerBarPosition;

if (Math.abs(layer.inPoint - layer.startTime) < 0.001) {
    // Natural layer (inPoint == startTime)
    // The layer bar appears at startTime
    layerBarPosition = layer.startTime;
} else {
    // Trimmed layer (inPoint != startTime)
    // For ALL trimmed layers, the visual bar position equals the inPoint value
    // This works whether startTime is negative (pulled back) or positive
    layerBarPosition = layer.inPoint;
}
```

**Why This Works**:
1. **Natural text layers have `inPoint == startTime`** - Unlike other layer types, text layers set both values equal when naturally positioned
2. **Trimmed layers always show bar at `inPoint` position** - Regardless of how they were moved after trimming
3. **Simple and consistent** - No complex calculations needed

**Test Cases Verified**:
- ✅ Two natural text layers at frame 0 and 30: Shows 30f delay correctly
- ✅ Trimmed layer pulled back to frame 0: Shows correct delay using inPoint
- ✅ Trimmed layer at positive position: Shows correct delay using inPoint
- ✅ Mixed natural and trimmed layers: All calculate correctly

### **Challenge 9: Split Dimension Keyframe Handling - NO DELETION SOLUTION**
**Problem**: When Position dimensions are separated (X Position/Y Position), the original "Position" property becomes hidden but still exists. Processing it causes keyframe deletion because After Effects can't handle operations on hidden properties.

**Context**: After Effects allows separating Position into X Position and Y Position for independent animation. When separated, `position.dimensionsSeparated = true`, and the original Position property becomes inaccessible but still shows up in property traversal.

**THE COMPLETE SOLUTION** (Discovered during global delay development)
```javascript
// CRITICAL: Skip Position property when dimensions are separated
if (prop.name === "Position") {
    try {
        // Get parent Transform group to check dimension separation
        var parentGroup = propGroup.property(i).parentProperty;
        if (parentGroup && parentGroup.name === "Transform") {
            // Check if dimensions are separated
            if (parentGroup.property("Position").dimensionsSeparated) {
                // Skip this hidden Position property - prevents keyframe deletion
                continue; 
            }
        }
    } catch(e) {
        // If we can't check, skip Position to be safe
        continue;
    }
}

// Process X Position and Y Position normally - they work fine
// The hidden Position property is completely skipped
```

**Why This Solution Works:**
1. **Hidden Property Detection**: Checks `dimensionsSeparated` on parent Position property
2. **Complete Avoidance**: Skips hidden Position entirely, preventing deletion attempts  
3. **Safe Processing**: X Position and Y Position work normally and are processed separately
4. **Error Prevention**: Try-catch ensures script continues if separation check fails

**Critical Implementation Details:**
- **Must check parent**: `parentGroup.property("Position").dimensionsSeparated`
- **Skip completely**: Use `continue` to avoid any operations on hidden property
- **Process dimensions separately**: X Position and Y Position are independent properties
- **Error safety**: Graceful fallback if separation detection fails

**Before/After Results:**
- **Before**: Processing Position with separated dimensions → keyframes deleted
- **After**: Skipping Position, processing X/Y Position → keyframes preserved perfectly

### **Challenge 9: Effect Parameter Processing - EFFECT NAME-BASED SOLUTION**  
**Problem**: Multiple effects of the same type (e.g., "Tint" and "Tint 2") were generating identical keyIDs, causing the duplicate detection system to incorrectly skip processing effect parameters during global delay operations.

**Context**: After Effects allows multiple instances of the same effect on a layer. When processing keyframes, we need unique identifiers to prevent processing the same keyframe twice. Using effect indices or matchNames fails because multiple Tint effects have identical matchNames.

**THE COMPLETE SOLUTION** (September 2024)
```javascript
// Create unique key ID for tracking - CRITICAL: Use effect NAME not index
var uniquePropertyId = prop.matchName || prop.name;
if (parentEffect) {
    // Use effect name directly to distinguish between different effect instances
    // This is more reliable than trying to find effect indices
    uniquePropertyId = parentEffect.matchName + "_" + parentEffect.name + "_" + uniquePropertyId;
}
var keyId = layer.index + "_" + uniquePropertyId + "_" + j + "_" + keyTime.toFixed(3);

// Expected KeyID examples:
// "Tint" effect:   "ADBE Tint_Tint_ADBE Tint-0003"  
// "Tint 2" effect: "ADBE Tint_Tint 2_ADBE Tint-0003"
// "Brightness & Contrast": "ADBE Brightness & Contrast_Brightness & Contrast_ADBE Brightness & Contrast-0001"

// Special debugging for Tint effects to diagnose duplicate issues
if (parentEffect && parentEffect.name.indexOf("Tint") !== -1) {
    DEBUG_JSX.log("    " + parentEffect.name + " KeyID: " + keyId);
}
```

**Parent Effect Detection Pattern:**
```javascript
// Walk up property hierarchy to find parent effect
var parentEffect = null;
try {
    var tempProp = prop.parentProperty;
    while (tempProp && tempProp.propertyType !== PropertyType.LAYER) {
        if (tempProp.propertyType === PropertyType.INDEXED_GROUP && 
            tempProp.name && tempProp.matchName && 
            tempProp.matchName.indexOf("ADBE") === 0) {
            // Found effect group
            parentEffect = tempProp;
            break;
        }
        tempProp = tempProp.parentProperty;
    }
} catch(parentError) {
    // Can't determine parent effect, continue anyway
}
```

**Why Effect Names Work:**
1. **Guaranteed Uniqueness**: After Effects ensures effect names are unique within a layer
2. **User-Visible Names**: "Tint", "Tint 2", "Brightness & Contrast" match UI exactly
3. **Reliable Detection**: Effect names don't change during processing
4. **Debug Clarity**: Easy to identify which effect is being processed in logs

**Failed Approaches That Don't Work:**
```javascript
// ❌ WRONG: Effect indices (unreliable)
uniquePropertyId = parentEffect.propertyIndex + "_" + uniquePropertyId;

// ❌ WRONG: MatchName only (identical for same effect type)  
uniquePropertyId = parentEffect.matchName + "_" + uniquePropertyId;

// ✅ RIGHT: Effect name direct usage
uniquePropertyId = parentEffect.matchName + "_" + parentEffect.name + "_" + uniquePropertyId;
```

**Results:**
- **Before**: "Tint" and "Tint 2" generated identical keyIDs → "Tint 2" skipped as duplicate
- **After**: Each effect generates unique keyIDs → All effects process correctly

### **Challenge 10: Precomp Processing Boundary Calculation for Natural Layers**
**Problem**: Precomps were being incorrectly processed when their content had already ended before the playhead, causing unwanted duration extensions and layer modifications in nested compositions.

**Context**: When determining whether to process a precomp's contents during global delay, the system needs to check if the playhead is within the precomp's active content area. The bug was using an incorrect calculation for natural layers.

**THE COMPLETE SOLUTION** (December 2024)
```javascript
// WRONG: Using old calculation that fails for natural layers
var precompActiveStart = layer.startTime + layer.inPoint;  // Wrong for natural layers!
var precompActiveEnd = layer.startTime + layer.outPoint;

// RIGHT: Use the same content boundaries already calculated for the layer
// contentStartTime and contentEndTime already account for trimmed vs natural layers
if (playheadTime >= contentStartTime && playheadTime < contentEndTime) {
    // Process precomp only if playhead is within active content
    processPrecompContents(...);
}
```

**Real Example - "Gesture - Tap 2" (Natural Layer):**
- **Layer Properties**: `inPoint == startTime == 0.583`, `outPoint = 1.700`
- **Playhead Position**: 2.133 seconds
- **Before Fix**: Active area calculated as `0.583 + 0.583 = 1.166` to `2.283`, incorrectly spanning the playhead
- **After Fix**: Active area uses `contentStartTime = 0.583` to `contentEndTime = 1.700`, correctly ending before playhead

**Why This Was Critical:**
1. **Prevented Unwanted Processing**: Precomps with content ending before the playhead are no longer processed
2. **Avoided Duration Extensions**: Nested compositions no longer get incorrectly extended
3. **Consistent Boundary Logic**: Uses the same content boundary calculation for all layer operations
4. **Fixed Circular Problem**: Solved the issue where fixing trimmed layers broke natural layer processing

### **Challenge 11: Timeline Mode Layer Movement with Trimmed Layers**
**Problem**: When using timeline mode to move multiple layers together (no keyframes selected), only one layer was moving when both should move. This occurred specifically when dealing with a mix of trimmed and natural layers at the same visual position.

**Context**: Timeline mode should move ALL selected layers together by the same amount. However, the `nudgeDelayTimelineMode` function was directly modifying layer `startTime` without accounting for the difference between trimmed and natural layers' visual positions.

**THE PROBLEM IN DETAIL** (Discovered December 2024):
When you have two layers at the same visual position:
1. Layer 1: Natural layer with `inPoint == startTime == 0`
2. Layer 2: Trimmed layer with `inPoint == 0` but `startTime == -2.133` (negative due to trimming)
3. User selects both and uses timeline mode (normal click) to move forward
4. Expected: Both layers move together maintaining their visual alignment
5. Actual: Only one layer moves, breaking the visual alignment

**Root Cause**:
The simplified layer movement code in `nudgeDelayTimelineMode` was using:
```javascript
// WRONG: Treats all layers the same
var newStartTime = layer.startTime + timeOffset;
layer.startTime = newStartTime;
```

This fails because:
- Natural layers: Visual position = startTime, so moving startTime moves the visual position correctly
- Trimmed layers: Visual position = inPoint, moving startTime doesn't correctly move the visual position

**THE SOLUTION** (December 2024):
```javascript
// Determine visual position for the layer
var layerVisualPosition;
var isTrimmed = Math.abs(layer.inPoint - layer.startTime) > 0.001;

if (isTrimmed) {
    // Trimmed layer - visual position is at inPoint
    layerVisualPosition = layer.inPoint;
} else {
    // Natural layer - visual position is startTime
    layerVisualPosition = layer.startTime;
}

// Calculate new visual position
var newVisualPosition = layerVisualPosition + timeOffset;

// Calculate the offset between visual position and startTime
var visualToStartOffset = layer.startTime - layerVisualPosition;

// Calculate new startTime maintaining the offset
var newStartTime = newVisualPosition + visualToStartOffset;

// Only clamp visual position to 0, allow negative startTime for trimmed layers
if (newVisualPosition < 0) {
    newVisualPosition = 0;
    newStartTime = visualToStartOffset; // Maintain trim offset
}

layer.startTime = newStartTime;
```

**Why This Solution Works**:
1. **Identifies Layer Type**: Checks if `inPoint != startTime` to detect trimmed layers
2. **Uses Correct Visual Position**: Natural layers use startTime, trimmed layers use inPoint
3. **Maintains Trim Offset**: Preserves the difference between visual position and startTime
4. **Moves Visual Position**: Both layer types move by the same visual amount
5. **Allows Negative startTime**: Trimmed layers can have negative startTime as long as visual position >= 0

**Key Insight for Future Development**:
When working with layer timing in After Effects, ALWAYS consider:
- **Visual Position**: Where the layer bar appears in the timeline (what users see)
- **startTime**: Internal timing property that can be negative for trimmed layers
- **inPoint**: For trimmed layers, this represents the visual position
- **Natural vs Trimmed**: Test your code with both layer types to ensure consistent behavior

**Test Cases That Now Work**:
- ✅ Two natural layers at same position: Both move together
- ✅ Two trimmed layers at same position: Both move together
- ✅ Mix of natural and trimmed at same position: Both move together maintaining alignment
- ✅ Trimmed layer with negative startTime: Moves correctly maintaining trim offset

### **Challenge 12: Time Remap Layers and Global Delay Keyframe Processing**
**Problem**: When a layer has Time Remap enabled and its content starts before the layer bar (due to negative time remapping), keyframes after the playhead were not being delayed during global delay operations, even though they should be.

**Context**: Time Remap allows a layer's content to play at different times than the layer bar suggests. A layer can appear to start at 0.583s in the timeline, but its actual content (due to Time Remap) can start at 0.350s. This creates a disconnect between the layer's position and its content position.

**THE PROBLEM IN DETAIL** (Discovered December 2024):
Scenario with Time Remap layer:
1. Layer bar starts at 0.583s (`layer.startTime`)
2. Time Remap makes content start at 0.350s (visible in timeline)
3. Playhead is at 0.433s
4. Time Remap keyframes are after the playhead (should be delayed)
5. Global delay was checking `if (layerStartTime < playheadTime)` 
6. Since 0.583 > 0.433, keyframes were skipped with "Skip keys (moved)"
7. Result: Visible keyframes after playhead were not being delayed

**Root Cause**:
The global delay system was using `layerStartTime` to decide whether to process keyframes:
```javascript
// WRONG: Only considers layer bar position
if (layerStartTime < playheadTime) {
    // Process keyframes
} else {
    // Skip - assumes layer was moved entirely
}
```

This fails for Time Remap layers where content position ≠ layer position.

**THE SOLUTION** (December 2024):
```javascript
// Use contentStartTime which accounts for Time Remap
// contentStartTime is the actual visible content start position
if (contentStartTime < playheadTime) {
    DEBUG_JSX.log("  Keys@" + layer.name.substring(0, 10));
    var keyframeResult = moveKeyframesAfterTime(layer, playheadTime, timeOffset, processedItems);
    // Process keyframes normally
} else {
    DEBUG_JSX.log("  Skip keys (moved)");
}
```

**Why This Solution Works**:
1. **`contentStartTime` represents actual visible content position** - For Time Remap layers, this is where the content actually appears
2. **Handles both Time Remap and regular layers** - For regular layers, `contentStartTime == layerStartTime`
3. **Correct keyframe processing decision** - Keyframes are processed based on where content is visible, not where the layer bar is
4. **Preserves the skip logic** - If content truly starts after playhead, keyframes are still skipped (layer was moved entirely)

**Key Insight - Time Remap Creates Two Timeline Positions**:
- **Layer Timeline Position**: Where the layer bar appears (`layer.startTime`)
- **Content Timeline Position**: Where the content actually plays (calculated from Time Remap)
- **Global Delay Must Use Content Position**: Decisions about keyframe processing must be based on visible content, not layer bar position

**How `contentStartTime` is Calculated**:
```javascript
// For Time Remap layers with first keyframe value != 0
if (layer.timeRemapEnabled && layer.timeRemap.numKeys > 0) {
    var firstKeyTime = layer.timeRemap.keyTime(1);
    var firstKeyValue = layer.timeRemap.keyValue(1);
    
    if (Math.abs(firstKeyValue) > 0.001) {
        // Time Remap shifts content
        contentStartTime = layer.startTime - firstKeyValue + layer.inPoint;
    }
}
```

**Test Cases That Now Work**:
- ✅ Time Remap layer with content before layer bar: Keyframes after playhead get delayed
- ✅ Regular layer: Behavior unchanged (contentStartTime == layerStartTime)
- ✅ Time Remap layer entirely after playhead: Still skipped correctly
- ✅ Complex Time Remap with multiple keyframes: Processes based on visible content position

**Debug Output Before/After**:
```
Before Fix:
L1: Gesture - Tap 3@0.58s
→Skip keys (moved)  // WRONG - keyframes after playhead not processed

After Fix:
L1: Gesture - Tap 3@0.58s
Keys@Gesture - Ta
  2k  // CORRECT - Time Remap keyframes processed
```

### **Challenge 13: Time Remap Keyframe Movement and Selection Preservation (CRITICAL)**
**Problem**: Time Remap keyframes require completely different handling than other keyframe properties. They cannot be manipulated using the standard "remove and re-add" approach, were being processed twice causing double-movement, and were losing selection after nudging operations.

**Context**: Time Remap is a special property in After Effects that controls the playback timing of a layer. Unlike Position, Opacity, etc., Time Remap keyframes have unique constraints:
1. Cannot use `prop.removeKey()` followed by `prop.addKey()` like other properties
2. Often not included in `layer.selectedProperties` array, requiring explicit checking
3. Can appear both in selectedProperties AND need explicit checking, causing duplicate processing
4. Selection preservation requires special handling after movement

**THE COMPLETE TIME REMAP SOLUTION** (December 2024)

This implementation took extensive debugging to get right. Here are the critical lessons learned:

#### **Issue 1: Time Remap Keyframes Being Deleted**
**Failed Approach**: Using standard remove-then-add pattern
```javascript
// ❌ WRONG: This causes Time Remap keyframes to be deleted
prop.removeKey(keyIndex);
var newIdx = prop.addKey(newTime);
// Error: Can not "addKey" with this property, because the property or a parent property is hidden
```

**Solution**: Use `setValueAtTime` to create new keyframes, then carefully remove old ones
```javascript
// ✅ RIGHT: Add new keyframe first, then remove old
var value = prop.keyValue(data.index);
prop.setValueAtTime(data.newTime, value);
// Then find and remove the old keyframe
```

#### **Issue 2: Time Remap Being Processed Twice (Double Movement)**
**Root Cause**: Time Remap was being cached twice:
1. Once through `layer.selectedProperties` iteration
2. Again through explicit Time Remap checking

**Failed Detection**:
```javascript
// ❌ WRONG: Only checking property reference equality
var alreadyCached = false;
for (var c = 0; c < cachedSelections.length; c++) {
    if (cachedSelections[c].property === layer.timeRemap) {
        alreadyCached = true;
        break;
    }
}
```

**Working Solution**:
```javascript
// ✅ RIGHT: Check both layer AND property name
var timeRemapAlreadyCached = false;
for (var c = 0; c < cachedSelections.length; c++) {
    if (cachedSelections[c].layer === layer && 
        (cachedSelections[c].propertyName === "Time Remap" || 
         cachedSelections[c].propertyName === "ADBE Time Remapping")) {
        timeRemapAlreadyCached = true;
        break;
    }
}
```

#### **Issue 3: Selection Not Being Preserved**
**Problem**: After moving Time Remap keyframes, they would become deselected.

**Solution**: Track new indices after movement and restore selection
```javascript
// After moving keyframes, find their new indices
var newIndices = [];
for (var k = 0; k < actualKeyframesToMove.length; k++) {
    var targetTime = actualKeyframesToMove[k].newTime;
    for (var j = 1; j <= prop.numKeys; j++) {
        if (Math.abs(prop.keyTime(j) - targetTime) < 0.001) {
            newIndices.push(j);
            break;
        }
    }
}

// Later, during selection restoration
var freshProp = findPropertyByName(layer, "Time Remap");
if (freshProp) {
    // Deselect all first
    for (var k = 1; k <= freshProp.numKeys; k++) {
        freshProp.setSelectedAtKey(k, false);
    }
    // Then select only our moved keyframes
    for (var j = 0; j < newIndices.length; j++) {
        freshProp.setSelectedAtKey(newIndices[j], true);
    }
}
```

#### **THE COMPLETE TIME REMAP HANDLING PATTERN**

When implementing any feature that moves Time Remap keyframes:

```javascript
// 1. DETECTION: Check if property is Time Remap
var isTimeRemap = false;
try {
    isTimeRemap = (prop.name === "Time Remap" || prop.matchName === "ADBE Time Remapping");
} catch(e) {
    // Continue with normal handling
}

// 2. CACHING: Prevent duplicate caching
// Check BOTH in selectedProperties loop:
if (prop.name === "Time Remap") {
    DEBUG_JSX.log("Found Time Remap via selectedProperties");
    // Cache it
}

// AND in explicit Time Remap check:
var timeRemapAlreadyCached = false;
for (var c = 0; c < cachedSelections.length; c++) {
    if (cachedSelections[c].layer === layer && 
        cachedSelections[c].propertyName === "Time Remap") {
        timeRemapAlreadyCached = true;
        break;
    }
}

if (!timeRemapAlreadyCached && layer.timeRemapEnabled) {
    // Cache it
}

// 3. MOVEMENT: Special handling for Time Remap
if (isTimeRemap) {
    // Verify keyframes exist at expected times
    var actualKeyframesToMove = [];
    for (var k = 0; k < keyframesToMove.length; k++) {
        var foundAtOldTime = false;
        for (var j = 1; j <= prop.numKeys; j++) {
            if (Math.abs(prop.keyTime(j) - data.oldTime) < 0.001) {
                foundAtOldTime = true;
                break;
            }
        }
        if (foundAtOldTime) {
            actualKeyframesToMove.push(data);
        }
    }
    
    // Add new keyframes
    for (var k = 0; k < actualKeyframesToMove.length; k++) {
        var value = prop.keyValue(actualKeyframesToMove[k].index);
        prop.setValueAtTime(actualKeyframesToMove[k].newTime, value);
    }
    
    // Remove old keyframes (carefully!)
    var oldKeyIndicesToRemove = [];
    for (var k = 0; k < actualKeyframesToMove.length; k++) {
        var oldTime = actualKeyframesToMove[k].oldTime;
        for (var j = prop.numKeys; j >= 1; j--) {
            var keyTime = prop.keyTime(j);
            if (Math.abs(keyTime - oldTime) < 0.001) {
                // Make sure this isn't a new keyframe
                var isNewKey = false;
                for (var n = 0; n < actualKeyframesToMove.length; n++) {
                    if (Math.abs(keyTime - actualKeyframesToMove[n].newTime) < 0.001) {
                        isNewKey = true;
                        break;
                    }
                }
                if (!isNewKey) {
                    oldKeyIndicesToRemove.push(j);
                }
            }
        }
    }
    
    // Remove in descending order
    oldKeyIndicesToRemove.sort(function(a, b) { return b - a; });
    for (var k = 0; k < oldKeyIndicesToRemove.length; k++) {
        prop.removeKey(oldKeyIndicesToRemove[k]);
    }
}
```

#### **Key Insights for Time Remap**

1. **Never use the standard remove-then-add pattern** - Time Remap will throw errors
2. **Always check for duplicate processing** - Time Remap can appear in multiple places
3. **Use setValueAtTime for movement** - This is the safe way to move Time Remap keyframes
4. **Verify keyframes exist before moving** - Prevents double-processing errors
5. **Track new indices for selection** - Required for selection preservation
6. **Test with mixed selections** - Always test Time Remap with Position, Opacity, etc. selected together

#### **Common Pitfalls**
- ❌ Assuming Time Remap behaves like other properties
- ❌ Not checking for duplicate caching (causes 2x movement)
- ❌ Using removeKey before addKey (causes deletion)
- ❌ Not preserving selection after movement
- ❌ Not testing with multiple property types selected

#### **Testing Checklist**
- ✅ Time Remap keyframe alone moves correctly
- ✅ Time Remap with Position/Opacity moves together
- ✅ Selection is preserved after movement
- ✅ No double-movement when clicking multiple times
- ✅ No keyframes are deleted
- ✅ Works in both timeline and baseline modes

---

## 🔍 **COMPREHENSIVE KEYFRAME DETECTION SYSTEM**

### **Universal Keyframe Detection Pattern - THE DEFINITIVE APPROACH**

To avoid situations where features manually look for specific keyframe types and miss others, use this comprehensive recursive pattern that finds ALL keyframes across ALL properties:

```javascript
// COMPREHENSIVE KEYFRAME DETECTION - Works for ALL property types
function findAllSelectedKeyframes(layer) {
    var layerKeyframes = [];
    var hasSelectedKeyframes = false;
    
    // 1. RECURSIVE PROPERTY TRAVERSAL - Finds everything
    function searchAllProperties(propGroup) {
        for (var i = 1; i <= propGroup.numProperties; i++) {
            var prop = propGroup.property(i);
            
            // Check if this property has keyframes and selected keyframes
            if (prop && prop.canVaryOverTime && prop.numKeys > 0) {
                var selectedKeys = [];
                for (var j = 1; j <= prop.numKeys; j++) {
                    if (prop.keySelected(j)) {
                        selectedKeys.push(j);
                    }
                }
                
                if (selectedKeys.length > 0) {
                    layerKeyframes.push({
                        property: prop,
                        propertyName: prop.name,
                        selectedKeys: selectedKeys
                    });
                    hasSelectedKeyframes = true;
                }
            }
            
            // Recurse into property groups (CRITICAL for nested properties)
            if (prop && (prop.propertyType === PropertyType.INDEXED_GROUP || 
                       prop.propertyType === PropertyType.NAMED_GROUP)) {
                searchAllProperties(prop);
            }
        }
    }
    
    // 2. SEARCH MAIN LAYER PROPERTIES (Transform, Effects, Masks, etc.)
    searchAllProperties(layer);
    
    // 3. SPECIAL PROPERTIES - Check properties that might not be in main traversal
    
    // Time Remap (always check explicitly)
    try {
        if (layer.timeRemapEnabled && layer.timeRemap && layer.timeRemap.canVaryOverTime && layer.timeRemap.numKeys > 0) {
            var selectedTimeRemapKeys = [];
            for (var j = 1; j <= layer.timeRemap.numKeys; j++) {
                if (layer.timeRemap.keySelected(j)) {
                    selectedTimeRemapKeys.push(j);
                }
            }
            
            if (selectedTimeRemapKeys.length > 0) {
                layerKeyframes.push({
                    property: layer.timeRemap,
                    propertyName: "Time Remap",
                    selectedKeys: selectedTimeRemapKeys
                });
                hasSelectedKeyframes = true;
            }
        }
    } catch(e) {
        // Time remap might not be available
    }
    
    // Audio Levels (if audio layer)
    try {
        if (layer.hasAudio && layer.audioLevels && layer.audioLevels.canVaryOverTime && layer.audioLevels.numKeys > 0) {
            var selectedAudioKeys = [];
            for (var k = 1; k <= layer.audioLevels.numKeys; k++) {
                if (layer.audioLevels.keySelected(k)) {
                    selectedAudioKeys.push(k);
                }
            }
            
            if (selectedAudioKeys.length > 0) {
                layerKeyframes.push({
                    property: layer.audioLevels,
                    propertyName: "Audio Levels",
                    selectedKeys: selectedAudioKeys
                });
                hasSelectedKeyframes = true;
            }
        }
    } catch(e) {
        // Audio levels might not be available
    }
    
    return {
        keyframes: layerKeyframes,
        hasSelected: hasSelectedKeyframes
    };
}

// USAGE EXAMPLE
var allLayerKeyframes = [];
for (var layerIdx = 0; layerIdx < selectedLayers.length; layerIdx++) {
    var layer = selectedLayers[layerIdx];
    var layerResult = findAllSelectedKeyframes(layer);
    
    if (layerResult.hasSelected) {
        allLayerKeyframes = allLayerKeyframes.concat(layerResult.keyframes);
    }
}

// Now allLayerKeyframes contains EVERY selected keyframe across ALL properties
```

### **Property Types This Pattern Finds:**

#### **Core Transform Properties:**
- ✅ Position (2D and 3D)
- ✅ X Position / Y Position / Z Position (separated dimensions)
- ✅ Anchor Point
- ✅ Scale
- ✅ Rotation / X Rotation / Y Rotation / Z Rotation
- ✅ Opacity

#### **Effect Properties:**
- ✅ ALL effect parameters (Blur, Tint, Brightness & Contrast, etc.)
- ✅ Nested effect groups
- ✅ Multiple instances of same effect type

#### **Mask Properties:**
- ✅ Mask Path
- ✅ Mask Feather
- ✅ Mask Opacity
- ✅ Mask Expansion

#### **Special Properties:**
- ✅ Time Remap
- ✅ Audio Levels
- ✅ Layer Styles (if any)
- ✅ Text properties (if accessible through recursion)

#### **3D Layer Properties:**
- ✅ Material Options
- ✅ Light properties
- ✅ Camera properties

### **Why This Pattern Works:**

1. **Recursive Traversal**: `searchAllProperties()` finds nested properties automatically
2. **PropertyType Checking**: Uses `INDEXED_GROUP` and `NAMED_GROUP` to recurse properly
3. **Explicit Special Cases**: Time Remap and Audio Levels checked separately (they sometimes don't appear in main traversal)
4. **Comprehensive Coverage**: Gets everything that `canVaryOverTime` and has keyframes
5. **Error Safety**: Try-catch blocks ensure special properties don't break the process

### **How Different Systems Use This:**

#### **Delay/Duration Systems (Working Examples):**
```javascript
// delay/duration systems use this comprehensive approach
var result = findAllSelectedKeyframes(layer);
// Process ALL found keyframes regardless of type
```

#### **Stagger System (Now Fixed):**
```javascript
// stagger system now uses the same comprehensive approach
var result = findAllSelectedKeyframes(layer);
// No manual checking for specific property types needed
```

### **Common Mistakes to Avoid:**

#### **❌ WRONG: Manual Property Type Checking**
```javascript
// Don't do this - you'll miss properties
if (prop.name === "Position") { /* process */ }
else if (prop.name === "Opacity") { /* process */ }
else if (prop.name === "Scale") { /* process */ }
// What about masks? Effects? Time Remap? Audio Levels?
```

#### **❌ WRONG: Limited Property Lists**
```javascript
// Don't hardcode property lists
var supportedProperties = ["Transform", "Effects", "Time Remap"];
// This approach will miss new property types
```

#### **✅ RIGHT: Universal Pattern**
```javascript
// Do this - finds everything automatically
function searchAllProperties(propGroup) {
    // Recursive traversal finds ALL properties
    // No hardcoded lists needed
}
```

### **Property Hierarchy Understanding:**

After Effects properties are organized hierarchically:
```
Layer
├── Transform (INDEXED_GROUP)
│   ├── Position (can have keyframes)
│   ├── Scale (can have keyframes)
│   └── Rotation (can have keyframes)
├── Effects (INDEXED_GROUP)
│   ├── Blur (INDEXED_GROUP)
│   │   ├── Blurriness (can have keyframes)
│   │   └── Blur Dimensions (can have keyframes)
│   └── Tint (INDEXED_GROUP)
│       ├── Map White To (can have keyframes)
│       └── Amount to Tint (can have keyframes)
├── Masks (INDEXED_GROUP)
│   ├── Mask 1 (INDEXED_GROUP)
│   │   ├── Mask Path (can have keyframes)
│   │   └── Mask Feather (can have keyframes)
└── Special Properties (not always in main hierarchy)
    ├── Time Remap (check explicitly)
    └── Audio Levels (check explicitly)
```

The recursive pattern traverses this entire hierarchy automatically.

### **Testing Your Keyframe Detection:**

To ensure your keyframe detection is comprehensive:

1. **Create test layer with keyframes on:**
   - Position (2D)
   - Scale 
   - Rotation
   - Opacity
   - Blur effect
   - Mask path
   - Time Remap

2. **Select different combinations:**
   - All keyframes
   - Only Transform keyframes
   - Only Effect keyframes
   - Mix of Transform + Effects
   - Time Remap alone
   - Time Remap + other properties

3. **Verify detection:**
   - Run your detection function
   - Check that ALL selected keyframes are found
   - No keyframes should be missed
   - No properties should require special handling

### **Future-Proofing:**

This pattern will automatically work with:
- ✅ New After Effects property types
- ✅ Third-party effect properties  
- ✅ Expression-controlled properties
- ✅ Any property that implements `canVaryOverTime`
- ✅ Nested property groups of any depth

**Use this pattern for ALL keyframe operations to ensure comprehensive coverage.**

---

*Last Updated: December 2024*  
*Version: v4.16.43 - Comprehensive Keyframe Detection Documentation*  
*Status: All keyframe systems fully implemented and production-ready*  
*Critical Fixes: Trimmed vs naturally positioned layers, split dimension handling, effect name-based processing, precomp boundary calculation, timeline mode layer movement, global delay functionality restored, Time Remap keyframe processing, Time Remap selection preservation, and comprehensive keyframe detection system documentation*