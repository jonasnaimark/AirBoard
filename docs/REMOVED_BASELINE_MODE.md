# Baseline Mode for Delay Nudging (REMOVED)

**Status**: Removed from AirBoard v4.16.99 (December 2024)
**Reason**: User never used this feature, Timeline mode was preferred
**Restoration**: This document contains all implementation details needed to restore the feature

---

## What Was Baseline Mode?

Baseline mode was an alternative delay nudging behavior accessed by holding Shift when clicking the delay +/- buttons.

### Timeline Mode (Default - Kept)
- All selected keyframes move together by the same amount
- Maintains absolute timing relationships
- Example: If keyframes are at 0s, 1s, 2s and you nudge +3 frames, they move to 0.1s, 1.1s, 2.1s

### Baseline Mode (Shift - Removed)
- Earliest keyframe stays fixed in place (the "baseline")
- Other keyframes adjust their **relative delays** to the baseline
- Uses 50ms snapping logic
- Example: If keyframes are at 0s, 50ms, 100ms:
  - Nudge forward: 0s, 100ms, 150ms (delays increased by 50ms)
  - Nudge backward: 0s, 0ms, 50ms (delays decreased by 50ms)

---

## How Baseline Mode Worked

### Entry Points

#### UI Layer (`client/js/main.js`)
```javascript
// Lines 997-1026 (increment) and 1084-1113 (decrement)
delayIncrementBtn.addEventListener('click', function(event) {
    var isShiftHeld = event.shiftKey;
    var isAltHeld = event.altKey;

    var delayFrames = parseFloat(globalFrameInputField.value) || 3;
    if (isAltHeld) {
        delayFrames *= 10;  // Alt for 10x multiplier
    }

    // Choose function based on shift key
    var script = isShiftHeld
        ? 'nudgeDelayWithFrames(1, ' + delayFrames + ')'     // SHIFT: Baseline mode
        : 'nudgeDelayTimelineMode(1, ' + delayFrames + ')';  // NORMAL: Timeline mode

    csInterface.evalScript(script, function(result) {
        handleDelayResult(result, delayIncrementBtn);
    });
});
```

#### ExtendScript Layer (`jsx/main.jsx`)

**Function: `nudgeDelayWithFrames(direction, frames)`** (lines 8803-8835)
```javascript
function nudgeDelayWithFrames(direction, frames) {
    try {
        // Reset timeline mode cumulative offset when switching to baseline mode
        TIMELINE_MODE_CUMULATIVE_OFFSET = 0;

        var comp = app.project.activeItem;
        if (!(comp && comp instanceof CompItem)) {
            return "error|No composition selected";
        }

        // Check if nothing is selected - trigger global delay
        var selectedLayers = comp.selectedLayers;
        if (selectedLayers.length === 0) {
            // Shift+click baseline mode function -> Skip precomps when no selection
            return nudgeFromPlayhead(direction, frames, true);
        }

        // Convert frames to milliseconds
        var frameRate = comp.frameRate || 30;
        var framesToMs = (frames / frameRate) * 1000;

        // Use the existing nudgeDelay function with custom increment
        return nudgeDelayWithCustomIncrement(direction, framesToMs);

    } catch(e) {
        return "error|Failed to nudge delay with frames: " + e.toString();
    }
}
```

**Function: `nudgeDelayWithCustomIncrement(direction, incrementMs)`** (lines 9947-9980)
```javascript
function nudgeDelayWithCustomIncrement(direction, incrementMs) {
    try {
        // Store the original calculateDelaySnap function
        var originalCalculateDelaySnap = calculateDelaySnap;

        // Set global variable for forced timeline mode to use
        CUSTOM_INCREMENT_MS = incrementMs;

        // Temporarily replace the global calculateDelaySnap function
        calculateDelaySnap = function(currentDelayMs, dir) {
            return calculateDelaySnapWithIncrement(currentDelayMs, dir, incrementMs);
        };

        // Call the existing nudgeDelay function which has baseline selection restoration
        var result = nudgeDelay(direction);

        // Restore the original function and reset custom increment
        calculateDelaySnap = originalCalculateDelaySnap;
        CUSTOM_INCREMENT_MS = 0;

        return result;

    } catch(e) {
        // Make sure to restore even if there's an error
        if (originalCalculateDelaySnap) {
            calculateDelaySnap = originalCalculateDelaySnap;
        }
        CUSTOM_INCREMENT_MS = 0;
        return "error|Failed to nudge delay with custom increment: " + e.toString();
    }
}
```

**Function: `nudgeDelay(direction)`** (lines 5682-7370+)
This is the main baseline mode logic. It:
1. Analyzes all selected keyframes across all properties
2. Identifies the earliest keyframe as the "baseline" (stays at 0ms delay)
3. Calculates each property's delay relative to baseline
4. Applies 50ms snapping to delays
5. Moves keyframes to new positions
6. Handles marker syncing
7. Restores selection

Key features:
- **Baseline detection**: Earliest keyframe across all selected properties
- **50ms snapping**: Delays snap to 0, 50, 100, 150, 200ms, etc.
- **Multiple modes**:
  - Unified delay: All properties at same delay
  - Multiple delays: Each property has different delay from baseline
  - Timeline position nudging: All keyframes at exact same time
- **Forced timeline mode**: When all keyframes are at 0ms delay, switches to cumulative timeline nudging

---

## Global Variables Used

```javascript
// Baseline mode tracking
var BASELINE_CACHE = {
    earliestTime: null,
    baselineProperty: null,
    reset: function() { this.earliestTime = null; this.baselineProperty = null; },
    initialize: function(time, prop) {
        if (this.earliestTime === null) {
            this.earliestTime = time;
            this.baselineProperty = prop;
        }
        return { earliestTime: this.earliestTime, baselineProperty: this.baselineProperty };
    }
};

var TIMELINE_MODE_CUMULATIVE = 0;
var IS_IN_FORCED_TIMELINE_MODE = false;
var CUSTOM_INCREMENT_MS = 0;

// Selection tracking
var LAST_SELECTION_SIGNATURE = "";
var LAST_KEYFRAME_COUNT = 0;
var LAST_SELECTION_STRUCTURE = "";
```

---

## Key Concepts

### 1. Baseline Property
- The property containing the earliest selected keyframe
- Acts as the reference point (delay = 0ms)
- Never moves during baseline nudging

### 2. Relative Delays
- Each property's delay is calculated as: `(firstKeyTime - baselineTime) * 1000`
- Example:
  - Baseline: 0.000s → 0ms delay
  - Property A: 0.050s → 50ms delay
  - Property B: 0.150s → 150ms delay

### 3. Delay Snapping
- Delays snap to 50ms increments: 0, 50, 100, 150, 200...
- Forward nudge: 0→50, 50→100, 100→150
- Backward nudge: 150→100, 100→50, 50→0

### 4. Forced Timeline Mode
- Special case when all keyframes are at 0ms delay (no relative delays)
- Switches to cumulative timeline mode instead of baseline mode
- Tracks total offset to allow continuous nudging from 0ms

---

## What Was Actually Removed (v4.16.99)

### 1. UI Layer (`client/js/main.js`)

**Delay button handlers:**
- Removed shift key check from increment/decrement handlers
- Now always calls `nudgeDelayTimelineMode()` instead of choosing between modes
- Updated tooltips from "Shift: Ignore precomps" to "Alt: 10x multiplier"

### 2. ExtendScript Layer (`jsx/main.jsx`)

**Functions Removed:**
- `nudgeDelayWithFrames()` - the shift-key baseline mode entry point
- `nudgeDelayWithCustomIncrement()` - the helper for custom increments in baseline mode

**Functions KEPT (still used by Duration Stretch):**
- `nudgeDelay()` - still used by `stretchKeyframesForward()` and `stretchKeyframesBackward()` in cross-property mode
- `nudgeDelayForward()` and `nudgeDelayBackward()` - wrappers used by duration stretch
- `calculateDelaySnap()` - snapping logic used by duration stretch

**Note:** The baseline mode logic (`nudgeDelay()`) is still in the codebase because Duration Stretch uses it when in cross-property mode. To fully remove baseline mode, you would also need to update Duration Stretch to use timeline mode instead.

---

## Testing After Removal

1. Click delay +/- buttons normally → should move all keyframes together
2. Hold Alt and click → should apply 10x multiplier
3. With no selection → should trigger global delay from playhead
4. Selection should be maintained after nudging
5. Markers should move with keyframes

---

## Restoration Guide

To restore baseline mode in the future:

1. Copy the three removed functions back:
   - `nudgeDelayWithFrames()`
   - `nudgeDelayWithCustomIncrement()`
   - `nudgeDelay()`

2. Restore global variables for baseline tracking

3. Update UI handlers to check shift key again:
   ```javascript
   var script = event.shiftKey
       ? 'nudgeDelayWithFrames(direction, frames)'
       : 'nudgeDelayTimelineMode(direction, frames)';
   ```

4. Update tooltips to show shift modifier

5. Test both modes thoroughly

---

## Historical Context

### Why Was It Built?
Baseline mode was originally the only delay nudging mode. It allowed precise control over relative timing between properties using 50ms snapping.

### Why Was Timeline Mode Added?
Users wanted a simpler mode where all keyframes just move together without complex baseline logic. Timeline mode was added as the shift modifier initially, then became the default.

### Why Was It Removed?
- User never used baseline mode
- Timeline mode was more intuitive and sufficient
- Simplifies codebase by ~1700 lines
- Reduces maintenance burden
- Eliminates confusion about shift behavior

---

*Documented: December 2024*
*Removed in: v4.16.99*
*Original implementation: v4.16.0 (approximately)*
