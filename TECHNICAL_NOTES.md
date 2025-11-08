# AirBoard Technical Notes

This document contains technical knowledge and implementation details learned during AirBoard development.

## After Effects Easing Preservation

### The Problem
When manipulating keyframe timing (duration changes, delays, nudges), After Effects would automatically recalculate bezier easing curves, causing handles to change position and affecting animation feel. Users expected easing to remain visually identical when only changing timing.

### Understanding KeyframeEase API

The After Effects `KeyframeEase` object has two critical properties:

```javascript
KeyframeEase {
    speed: Number,      // Value units per second (e.g., pixels/second, degrees/second)
    influence: Number   // Percentage 0-100, defines handle length relative to time distance
}
```

#### Key Insight: Speed vs. Influence

**Speed** represents the rate of change per unit time:
- Formula: `speed = valueChange / timeChange`
- Example: If a property changes 100 pixels over 0.5 seconds, speed = 200 px/s
- **Must scale inversely with duration** to maintain the same visual curve shape
- Formula: `newSpeed = oldSpeed × (oldDuration / newDuration)`

**Influence** is already a percentage (0-100%):
- Represents the handle length as a percentage of the time distance between keyframes
- **Should NOT be scaled** when duration changes
- Remains constant to maintain the same curve shape

### Duration Changes: The Math

When stretching keyframe duration from 450ms to 950ms:

```javascript
// Original ease
speed: 618.09 px/s
influence: 22.40%

// Calculate scale factor (INVERSE relationship)
scaleFactor = oldDuration / newDuration
scaleFactor = 450ms / 950ms = 0.4737

// Scale only the speed
newSpeed = 618.09 × 0.4737 = 292.78 px/s
newInfluence = 22.40%  // Unchanged!
```

This inverse scaling ensures that when duration increases, speed decreases proportionally, maintaining the same visual curve shape.

### Edge Case Handling

#### First Selected Keyframe
```
Previous Keyframe [====] First Selected Keyframe [====] ...
```

When stretching duration of selected keyframes:
- **IN ease** of first selected keyframe affects the curve FROM the previous (non-selected) keyframe
- This distance hasn't changed, so **preserve IN ease** unchanged
- **OUT ease** affects the curve TO the next selected keyframe - scale it normally

#### Last Selected Keyframe
```
... [====] Last Selected Keyframe [====] Next Keyframe
```

- **OUT ease** of last selected keyframe affects the curve TO the next (non-selected) keyframe
- This distance HAS changed, so **scale OUT ease** based on distance change to next keyframe
- **IN ease** affects the curve FROM the previous selected keyframe - scale it normally

### Adjacent Keyframe Protection

Critical discovery: After Effects recalculates adjacent keyframes when you:
1. Modify selected keyframes
2. Restore adjacent keyframes
3. Re-select modified keyframes

This causes a cascade effect where restored values get modified again. Solution requires multiple restoration passes.

#### Implementation Strategy

```javascript
// 1. Capture state BEFORE manipulation
var adjacentKeyframes = captureAllAdjacentKeyframes(prop, selectedIndices);
var selectedKeyframesEase = captureCorrectEaseValues(keyData); // From ORIGINAL data

// 2. Perform manipulation (add/remove/move keyframes)
manipulateKeyframes(prop, keyData);

// 3. First restoration pass - restores adjacent keyframes
restoreAdjacentKeyframes(prop, adjacentKeyframes);

// 4. Restore selected keyframes' ease (AE may have modified them)
restoreSelectedKeyframesEase(prop, selectedKeyframesEase);

// 5. Re-select keyframes (this can trigger AE recalculation)
restoreSelection(prop, newIndices);

// 6. Final restoration pass - fix anything AE modified during selection
restoreAdjacentKeyframes(prop, adjacentKeyframes);
restoreSelectedKeyframesEase(prop, selectedKeyframesEase);
```

### Delay Operations: Different Math

For delay/nudge operations, internal distances between selected keyframes DON'T change:

```
Before: [Prev]---200ms---[First Selected]---450ms---[Last Selected]---300ms---[Next]
After:  [Prev]---350ms---[First Selected]---450ms---[Last Selected]---150ms---[Next]
                  ^                                                    ^
                  Changed                                              Changed
```

Only edge connections change:
- **First selected IN ease**: Scale by `(oldDistFromPrev / newDistFromPrev)`
- **Last selected OUT ease**: Scale by `(oldDistToNext / newDistToNext)`
- **Previous keyframe OUT ease**: Scale by same factor as first selected IN ease
- **Next keyframe IN ease**: Scale by same factor as last selected OUT ease

### Undo Group Timing

**Critical**: `app.endUndoGroup()` must be called AFTER all operations complete:

```javascript
app.beginUndoGroup("Operation Name");

// 1. Manipulate keyframes
// 2. Restore adjacent keyframes
// 3. Restore selected keyframes
// 4. Restore selection
// 5. Final restoration pass

app.endUndoGroup(); // Must be at the very end!
```

If `endUndoGroup()` is called too early:
- Operations after it won't be part of the undo
- Ctrl+Z undo breaks
- After Effects may recalculate curves outside the undo group

### Property Dimensions

After Effects properties can be 1D, 2D, or 3D:
- **1D**: Opacity, Rotation - `easeArray.length === 1`
- **2D**: Scale - `easeArray.length === 2`
- **3D**: Position - `easeArray.length === 3`

Always check array length and handle all dimensions:

```javascript
function scaleEaseForDuration(easeArray, oldDuration, newDuration) {
    if (!easeArray || easeArray.length < 1 || easeArray.length > 3) {
        return easeArray;
    }

    var scaledEase = [];
    var durationRatio = oldDuration / newDuration; // Inverse!

    for (var i = 0; i < easeArray.length; i++) {
        var ease = easeArray[i];
        scaledEase.push(new KeyframeEase(
            ease.speed * durationRatio,  // Scale speed
            ease.influence               // Keep influence unchanged
        ));
    }

    return scaledEase;
}
```

### Order of Operations

The order of API calls matters critically:

```javascript
// ✅ CORRECT ORDER:
prop.setValueAtKey(idx, value);
prop.setTemporalEaseAtKey(idx, inEase, outEase);  // Set ease FIRST
prop.setInterpolationTypeAtKey(idx, inInterp, outInterp);  // Then interpolation type
prop.setTemporalContinuousAtKey(idx, continuous);
prop.setTemporalAutoBezierAtKey(idx, autoBezier);

// ❌ WRONG ORDER (will corrupt ease values):
prop.setInterpolationTypeAtKey(idx, inInterp, outInterp);  // Setting this first...
prop.setTemporalEaseAtKey(idx, inEase, outEase);  // ...can reset ease values
```

### Debugging Tips

Useful debug logging:

```javascript
DEBUG_JSX.log("🔧 Scaling ease for duration change:");
DEBUG_JSX.log("Duration: " + oldDuration + "ms → " + newDuration + "ms");
DEBUG_JSX.log("Speed scale factor: " + (oldDuration/newDuration).toFixed(4));
DEBUG_JSX.log("Dimension " + i + ": speed " + oldSpeed.toFixed(2) +
              " → " + newSpeed.toFixed(2) +
              ", influence " + influence.toFixed(2) + "% (unchanged)");
```

Key values to log:
- Original and new durations/distances
- Scale factors (should be inverse: oldDuration/newDuration)
- Before/after speed and influence values
- Verification of restored values

### Common Pitfalls

1. **Scaling influence**: Don't do it! Influence is already a percentage
2. **Wrong scale direction**: Must be `oldDuration / newDuration` (inverse)
3. **Capturing modified values**: Always use ORIGINAL keyData, not what AE gives back
4. **Single restoration pass**: Need multiple passes due to AE recalculation
5. **Early undo group end**: Must call `endUndoGroup()` after ALL operations
6. **Forgetting edge cases**: First/last keyframes need special handling

### Testing Approach

To verify easing preservation:

1. Check bezier values before operation (e.g., `0.45, 0.01, 0.20, 1.00`)
2. Perform operation (duration change, delay, etc.)
3. Check bezier values after - should be EXACTLY the same
4. Test with keyframes before selection (should be unchanged)
5. Test with keyframes after selection (should be unchanged)
6. Test undo (Ctrl+Z should work perfectly)
7. Test with 1D, 2D, and 3D properties

### Results

With this implementation:
- ✅ Duration stretch: All easing preserved perfectly
- ✅ Delay/nudge: All easing preserved perfectly
- ✅ Keyframes before selection: Unchanged
- ✅ Keyframes after selection: Unchanged
- ✅ Edge keyframes: Properly scaled
- ✅ Undo/redo: Works correctly
- ✅ All property dimensions: Supported

---

*Last updated: 2025-01-08*
*Implemented in: main.jsx lines 243-278 (scaleEaseForDuration), 2498-2548 (duration stretch), 7565-7773 (delay operations)*
