# AirBoard Keyframe System - Development Summary

## Overview
The AirBoard plugin features a comprehensive keyframe measurement and manipulation system in the "Keyframe Reader" section with three rows: Duration, X Distance, and Y Distance. Each row provides real-time feedback and control buttons for keyframe operations.

## Current Implementation Status

### ✅ Fully Implemented Features

#### **Duration Row (Fully Functional)**
- **Read Functionality**: Shows duration between selected keyframes as "500ms / 30f"
- **+/- Nudging Buttons**: Stretch keyframes forward/backward with smart 50ms snapping
- **Smart 50ms Snapping Logic**: 
  - First press: Snaps to nearest 50ms multiple
  - Subsequent presses: Increment by exactly ±50ms
  - Timeline position independent (works anywhere on timeline)
  - Frame rate independent (always uses milliseconds)

#### **X/Y Distance Rows (Fully Functional)**
- **Read Functionality**: Shows position distance as "X: 150.5px @1x" and "Y: 75px @1x"
- **Resolution Scaling**: Automatically divides by current resolution setting (2x, 3x, etc.)
- **Clean Decimal Formatting**: Removes trailing zeros (91.50px → 91.5px)
- **Multi-Keyframe Support**: Calculates total distance traveled through all selected keyframes
- **4 Control Buttons Per Row**: "In" | "Out" | "−" | "+" (fully implemented)
- **In/Out Direction Logic**: 
  - **"In" mode**: Nudges only the first keyframe in the selection
  - **"Out" mode**: Nudges only the last keyframe in the selection
- **+/− Nudging Buttons**: Move position keyframes by ±10px in selected axis and direction

## Technical Architecture

### **ExtendScript Functions (jsx/main.jsx)**

#### `readKeyframesDuration()` - Main Reading Function
- **Purpose**: Reads selected keyframes and calculates duration + X/Y distances
- **Return Format**: `"success|durationMs|durationFrames|firstKeyIndex|lastKeyIndex|propertyIndex|xDistance|yDistance|hasXDistance|hasYDistance"`
- **Position Detection**: Supports Position, X Position, Y Position properties (2D arrays and separated values)
- **Distance Calculation**: Uses chronological keyframe order for total distance traveled

#### `stretchKeyframesForward()` & `stretchKeyframesBackward()` - Duration Nudging
- **Purpose**: Stretch keyframes by ±3 frames with smart 50ms snapping
- **Implementation**: Calls `stretchKeyframesGrokApproach(frameAdjustment)`
- **Timeline Independent**: Fixed to work at any timeline position (not just frame 0)

#### `stretchKeyframesGrokApproach(frameAdjustment)` - Core Stretching Logic
```javascript
// Smart 50ms snapping logic
var durationMs = duration * 1000;
var remainder = durationMs % 50;
var isAlreadySnapped = (remainder < 1) || (remainder > 49);

if (isAlreadySnapped) {
    // Already snapped - increment by exactly 50ms
    newDurationMs = durationMs + (frameAdjustment > 0 ? 50 : -50);
} else {
    // Not snapped yet - snap to nearest 50ms multiple
    newDurationMs = frameAdjustment > 0 ? 
        Math.ceil(durationMs / 50) * 50 : 
        Math.floor(durationMs / 50) * 50;
}
```

### **JavaScript Functions (client/js/main.js)**

#### Duration Button Event Handlers
```javascript
// + button: Calls stretchKeyframesForward()
durationIncrementBtn.addEventListener('click', function() {
    csInterface.evalScript('stretchKeyframesForward()', function(result) {
        // Parse result and update UI
    });
});

// - button: Calls stretchKeyframesBackward()  
durationDecrementBtn.addEventListener('click', function() {
    csInterface.evalScript('stretchKeyframesBackward()', function(result) {
        // Parse result and update UI
    });
});
```

#### In/Out Toggle Functionality (Complete)
```javascript
function setupInOutToggle(inBtnId, outBtnId) {
    var inBtn = document.getElementById(inBtnId);
    var outBtn = document.getElementById(outBtnId);
    
    inBtn.addEventListener('click', function() {
        inBtn.classList.add('selected');
        outBtn.classList.remove('selected');
    });
    
    outBtn.addEventListener('click', function() {
        outBtn.classList.add('selected');
        inBtn.classList.remove('selected');
    });
}

// Setup for both rows
setupInOutToggle('xInBtn', 'xOutBtn');
setupInOutToggle('yInBtn', 'yOutBtn');
```

## HTML Structure

### Duration Row (Reference Implementation)
```html
<div class="control-row">
    <div class="resolution-display" id="durationDisplay">
        <span id="durationText" style="opacity: 0.5;">Duration</span>
        <div class="number-controls">
            <button class="number-btn decrement" type="button">−</button>
            <button class="number-btn increment" type="button">+</button>
        </div>
    </div>
    <input type="hidden" id="durationValue" value="500">
</div>
```

### Distance Rows (Need Button Functionality)
```html
<div class="control-row">
    <div class="keyframe-display" id="xDistanceDisplay">
        <span id="xDistanceText" style="opacity: 0.5;">X Distance</span>
        <div class="distance-controls">
            <button class="distance-btn in-out-btn selected" id="xInBtn" type="button">In</button>
            <button class="distance-btn in-out-btn" id="xOutBtn" type="button">Out</button>
            <button class="distance-btn nudge-btn decrement" id="xDecrementBtn" type="button">−</button>
            <button class="distance-btn nudge-btn increment" id="xIncrementBtn" type="button">+</button>
        </div>
    </div>
</div>

<div class="control-row">
    <div class="keyframe-display" id="yDistanceDisplay">
        <span id="yDistanceText" style="opacity: 0.5;">Y Distance</span>
        <div class="distance-controls">
            <button class="distance-btn in-out-btn selected" id="yInBtn" type="button">In</button>
            <button class="distance-btn in-out-btn" id="yOutBtn" type="button">Out</button>
            <button class="distance-btn nudge-btn decrement" id="yDecrementBtn" type="button">−</button>
            <button class="distance-btn nudge-btn increment" id="yIncrementBtn" type="button">+</button>
        </div>
    </div>
</div>
```

## CSS Styling

### Button Styling
```css
/* Distance controls - 4 buttons */
.keyframe-display .distance-controls {
    position: absolute;
    right: 6px;
    top: 50%;
    transform: translateY(-50%);
    width: calc(50% - 18px);
    display: flex;
    gap: 4px;
    pointer-events: all;
    padding: 0;
}

.keyframe-display .distance-controls .distance-btn {
    flex: 1; /* Each button takes equal space (25%) */
    margin: 0;
    background-color: #2f2f2f;
    color: #cccccc;
    border: 1px solid rgba(255, 255, 255, 0.08);
    cursor: pointer;
    font-size: 11px;
    font-weight: 500;
    height: 26px;
    border-radius: 4px;
}

/* In/Out selection states */
.keyframe-display .distance-controls .in-out-btn.selected {
    background-color: rgba(58, 58, 58, 1);
    color: #ffffff;
    border-color: rgba(255, 255, 255, 0.25);
    opacity: 1;
}

.keyframe-display .distance-controls .in-out-btn:not(.selected) {
    background-color: #2f2f2f;
    border-color: rgba(255, 255, 255, 0.08);
    opacity: 1;
}
```

## UI States & Behavior

### Initial State
- **Duration**: "Duration" (50% opacity)
- **X Distance**: "X Distance" (50% opacity)  
- **Y Distance**: "Y Distance" (50% opacity)
- **In buttons**: Selected by default (both X and Y rows)

### Success State (After Reading Keyframes)
- **Duration**: "500ms / 30f" (100% opacity)
- **X Distance**: "X: 150.5px @1x" (100% opacity)
- **Y Distance**: "Y: 75px @1x" (100% opacity)

### Error State (Insufficient Keyframes)
- **All rows**: "Select > 1 Keyframe" (50% opacity)

## Key Technical Insights

### Critical Bug Fixes Applied
1. **Timeline Position Independence**: Fixed time calculation in `stretchKeyframesGrokApproach()` to use relative positioning instead of absolute scaling
2. **Smart 50ms Snapping**: Hybrid approach that snaps first, then increments cleanly
3. **Floating Point Tolerance**: 1ms tolerance for 50ms alignment detection

### Resolution Scaling Logic
```javascript
// Get current resolution multiplier
var resolutionMultiplier = parseInt(document.getElementById('resolutionMultiplier').value) || 2;

// Scale distance to @1x equivalent
var scaledXDistance = parseFloat((xDistance / resolutionMultiplier).toFixed(2));
var scaledYDistance = parseFloat((yDistance / resolutionMultiplier).toFixed(2));

// Display format
xDistanceText.textContent = 'X: ' + scaledXDistance + 'px @1x';
yDistanceText.textContent = 'Y: ' + scaledYDistance + 'px @1x';
```

## Implementation Priorities for Distance Row Buttons

### Next Development Tasks
1. **Add X/Y Position Nudging Functions**: Similar to duration stretching but for position keyframes
2. **Implement In/Out Direction Logic**: Determine what "In" vs "Out" means for position movement
3. **Add JavaScript Event Handlers**: Wire up the - and + buttons for distance rows
4. **Create ExtendScript Position Nudging**: Functions to move position keyframes in X/Y directions
5. **Handle Multi-Property Support**: Position can be 2D array or separated X/Y properties

### Design Questions to Address
- **What should "In" vs "Out" mean** for position keyframes?
- **Should nudging amount be based on resolution** or always use pixel values?
- **How should multi-keyframe nudging work** - move all keyframes or stretch between them?
- **Should there be snapping behavior** for position values (like 50ms snapping for duration)?

## File Locations
- **ExtendScript**: `/jsx/main.jsx` 
- **JavaScript**: `/client/js/main.js`
- **HTML**: `/client/index.html`
- **CSS**: `/client/css/styles.css`
- **Build Script**: `build-latest.sh`
- **Manifest**: `/CSXS/manifest.xml`

## Current Version
**v4.2.3** - Complete X/Y position distance measurement system with critical bug fixes

---
*Last Updated: August 18, 2025*
*Status: Duration fully functional, Distance buttons need implementation*