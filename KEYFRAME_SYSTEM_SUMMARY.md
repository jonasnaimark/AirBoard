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

### **Challenge 1: Keyframe Selection Preservation**
**Problem**: After moving keyframes, they would become deselected, breaking repeated operations.

**Solution**: Deferred selection system using keyframe recreation
```javascript
// WRONG: Select during creation (gets overwritten)
prop.setSelectedAtKey(newIdx, true);

// RIGHT: Collect indices, then select all at end
var newSelIndices = [];
for (var k = 0; k < keyframesToMove.length; k++) {
    var newIdx = prop.addKey(data.newTime);
    newSelIndices.push(newIdx);
}

// Select all at the very end
for (var i = 0; i < newSelIndices.length; i++) {
    prop.setSelectedAtKey(newSelIndices[i], true);
}
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

*Last Updated: August 23, 2025*  
*Version: v4.9.3 - Timeline Position Nudging System Complete*  
*Status: All keyframe systems fully implemented and production-ready*