# Spring-Aware Mirror Keys Implementation Plan

## Overview

Enhance AirBoard's Mirror Keys feature to detect and properly mirror spring animations created by the Sproing plugin. When mirroring keyframes that are part of a spring animation, the feature will:

1. Detect spring markers at the first keyframe
2. Parse spring parameters (stiffness, damping ratio, mass)
3. Generate reversed spring curve (swap start/end values)
4. Bake keyframes using the EXACT same precision algorithm as Sproing
5. Create/update mirrored marker at the first baked keyframe (playhead), maintaining Sproing unbake compatibility

## Core Principle: Exact Code Reuse

**CRITICAL**: This implementation must copy Sproing's spring physics and baking code EXACTLY, byte-for-byte, to avoid code splintering between the two plugins.

### Why Exact Code Reuse Matters

1. **Maintenance**: Updates to Sproing's algorithms can be copied directly
2. **Compatibility**: Ensures mirrored springs work with Sproing's unbake feature
3. **Quality**: Sproing's code is battle-tested and proven
4. **Avoiding Bugs**: Custom implementations introduce subtle differences that break compatibility

### Code Reuse Strategy

```javascript
// ============================================================================
// SPRING PHYSICS & BAKING FUNCTIONS
// COPIED FROM: Sproing v0.94.2 (SpringBaker.jsx)
// SOURCE: /Users/jonas_naimark/Documents/Sproing/host/SpringBaker.jsx
// DATE COPIED: [date]
// LINES: 41-230, 560-700, 1221, 1288-1705 (core spring physics, segment + marker logic)
//
// DO NOT MODIFY THESE FUNCTIONS - Keep identical to Sproing source
// Marker handling (detection/merge/cleanup) is also copied verbatim to avoid splintering
// ============================================================================

function androidSpring(dampingRatio, stiffness, mass, fromValue, toValue, numFrames, frameRate) {
    // Exact copy from Sproing lines 581-641
    // ...
}

function isSettled(values, endValue, threshold, frameRate) {
    // Exact copy from Sproing lines 574-579
    // ...
}

function douglasPeucker(points, epsilon) {
    // Exact copy from Sproing lines 41-65
    // ...
}

function valueDeviation(point, lineStart, lineEnd) {
    // Exact copy from Sproing lines 68-88
    // ...
}

function getOriginalValueAtTime(keyTimes, keyValues, time) {
    // Exact copy from Sproing
    // ...
}

function generateFullSpringCurve(t1, t2, v1, v2, dampingRatio, stiffness, mass, frameRate, maxFrames) {
    // Exact copy from Sproing lines 99-172
    // IMPORTANT: Keep exact function signature including t2 parameter
    // ...
}

function simplifySpringKeyframes(fullCurveData, precisionSetting, frameRate) {
    // Exact copy from Sproing lines 175-230
    // ...
}

var PRECISION_SETTINGS = {
    'max': { precision: 0, maxGapFrames: 0 },
    'high': { precision: 10, maxGapFrames: 10 },
    'medium': { precision: 5, maxGapFrames: 15 },
    'low': { precision: 1, maxGapFrames: 20 }
};
```

### Version Tracking

Maintain a comment block tracking which Sproing version the code was copied from:

```javascript
// ============================================================================
// SYNC STATUS WITH SPROING
// ============================================================================
// Last synced with: Sproing v0.94.2
// Last sync date: [date]
// Files synced:
//   - SpringBaker.jsx (lines 41-230, 574-641)
//
// To update:
// 1. Compare Sproing version for changes
// 2. Copy changed functions exactly
// 3. Update this header with new version and date
// 4. Test with real Sproing springs to verify compatibility
// ============================================================================
```

## Baking Precision

### Default: Medium Precision

Use Sproing's Medium precision by default:
- Douglas-Peucker algorithm with epsilon = 5
- Maximum 15-frame gaps between keyframes
- Optimal balance between accuracy and keyframe count

```javascript
var defaultPrecision = 'medium';
var precisionSettings = PRECISION_SETTINGS[defaultPrecision];
```

**Medium precision rationale**:
- Most common Sproing default
- Good balance of file size and accuracy
- Typically produces 10-20 keyframes for standard spring
- Visually indistinguishable from Max precision

### Auto-Detect Max Precision

When mirroring springs that were baked with Max precision (keyframes on every frame), automatically use Max precision for the mirrored keys.

**Detection Algorithm**:

```javascript
/**
 * Detects if selected keyframes were baked with Max precision
 * Max precision = keyframes on every single frame
 *
 * @param {Property} prop - The property with selected keyframes
 * @param {Array} selectedKeyIndices - Array of selected keyframe indices
 * @param {Number} frameRate - Composition frame rate
 * @returns {String} - 'max' if every-frame detected, 'medium' otherwise
 */
function detectBakingPrecision(prop, selectedKeyIndices, frameRate) {
    if (selectedKeyIndices.length < 2) {
        return 'medium'; // Not enough keys to detect
    }

    var hasEveryFrame = true;
    var frameTolerance = 0.1; // 10% tolerance for frame alignment

    // Check if keyframes are exactly 1 frame apart
    for (var i = 1; i < selectedKeyIndices.length; i++) {
        var keyIdx1 = selectedKeyIndices[i - 1];
        var keyIdx2 = selectedKeyIndices[i];

        var time1 = prop.keyTime(keyIdx1);
        var time2 = prop.keyTime(keyIdx2);

        var timeDiff = time2 - time1;
        var frameDiff = timeDiff * frameRate;

        // If not exactly 1 frame apart (within tolerance), not Max precision
        if (Math.abs(frameDiff - 1.0) > frameTolerance) {
            hasEveryFrame = false;
            break;
        }
    }

    return hasEveryFrame ? 'max' : 'medium';
}
```

**Usage in mirrorKeysFromPanel()**:

```javascript
// Inside mirrorKeysFromPanel(), after detecting spring marker:
var detectedPrecision = detectBakingPrecision(prop, selectedKeyIndices, frameRate);
var precisionToUse = detectedPrecision; // 'max' or 'medium'

DEBUG_JSX.log("Detected precision: " + detectedPrecision);
if (detectedPrecision === 'max') {
    DEBUG_JSX.log("Max precision detected - will bake keyframes on every frame");
}

// Use detected precision for baking
var fullCurveData = generateFullSpringCurve(
    playheadTime,
    playheadTime + maxDuration,
    lastVal,
    firstVal,
    springParams.dampingRatio,
    springParams.stiffness,
    springParams.mass,
    frameRate,
    maxFrames
);

var simplifiedKeyframes = simplifySpringKeyframes(fullCurveData, precisionToUse, frameRate);

DEBUG_JSX.log("Baked " + simplifiedKeyframes.length + " keyframes with " + precisionToUse + " precision");
```

## Blue Label Requirements

Set blue labels (label value 8) on the first and last keyframes of the mirrored spring segment to match Sproing's behavior.

**Purpose**: Blue labels mark spring segment boundaries for Sproing's unbake feature.

```javascript
// After baking all mirrored keyframes:
var firstMirroredKeyIndex = 1; // Index of first mirrored keyframe (after deletion)
var lastMirroredKeyIndex = simplifiedKeyframes.length; // Index of last mirrored keyframe

// Set blue labels on boundary keyframes
try {
    prop.setLabelAtKey(firstMirroredKeyIndex, 8); // Blue label
    prop.setLabelAtKey(lastMirroredKeyIndex, 8);  // Blue label
    DEBUG_JSX.log("Set blue labels on keys " + firstMirroredKeyIndex + " and " + lastMirroredKeyIndex);
} catch (e) {
    DEBUG_JSX.error("Failed to set blue labels: " + e.toString());
}
```

**Label values reference** (After Effects):
- 0 = No label
- 1 = Red
- 2 = Yellow
- 3 = Aqua
- 4 = Pink
- 5 = Lavender
- 6 = Peach
- 7 = Sea Foam
- 8 = Blue (← used by Sproing)
- 9 = Green
- 10 = Purple
- 11 = Orange
- 12 = Brown
- 13 = Fuchsia
- 14 = Cyan
- 15 = Sandstone
- 16 = Dark Green

## Marker Handling Strategy

### Multi-Property Marker Format

Sproing markers can contain spring parameters for multiple properties:

```
Spring Name

Stiffness: 300, Damping: 0.70, Damping Ratio: 0.70, Mass: 1

| Property: Transform > Position

=======================================

Stiffness: 450, Damping: 0.80, Damping Ratio: 0.80, Mass: 1

| Property: Transform > Scale

=======================================
```

### Marker Creation/Update Logic

When creating mirrored marker:

1. Check if marker exists at target time (playhead + 30 frames)
2. If exists, parse blocks and merge
3. If not, create new marker
4. Preserve blocks for other properties
5. Add/update block for current property

```javascript
/**
 * Creates or updates marker at target time with mirrored spring data
 * Handles multi-property markers by preserving other property blocks
 *
 * @param {Property} markerProp - The layer's marker property
 * @param {Number} targetTime - Time in seconds for marker
 * @param {String} springBlock - Spring data block for this property
 * @param {String} uniquePropId - Unique property identifier (e.g., "Transform > Position")
 * @param {Number} epsilon - Time tolerance for finding existing marker (0.01 sec)
 */
function createOrUpdateMirroredMarker(markerProp, targetTime, springBlock, uniquePropId, epsilon) {
    var existingMarkerData = findMarkerAtTime(markerProp, targetTime, epsilon);

    if (existingMarkerData) {
        // Marker exists - parse and merge blocks
        var markerIdx = existingMarkerData.index;
        var markerTime = markerProp.keyTime(markerIdx);
        var existingComment = markerProp.keyValue(markerIdx).comment;

        // Split by separator
        var separator = "=======================================";
        var rawBlocks = existingComment.split(separator);
        var newBlocks = [];

        // Keep blocks that aren't for this property
        for (var i = 0; i < rawBlocks.length; i++) {
            var block = rawBlocks[i].trim();
            if (block === "") continue;

            // Skip block if it's for our property (we'll add new version)
            if (block.indexOf("| Property: " + uniquePropId) === -1) {
                newBlocks.push(block);
            }
        }

        // Add new block for this property
        newBlocks.push(springBlock);

        // Rebuild marker comment
        var newComment = newBlocks.join("\n\n" + separator + "\n\n");

        // Update existing marker
        var markerValue = markerProp.keyValue(markerIdx);
        markerValue.comment = newComment;
        markerProp.setValueAtKey(markerIdx, markerValue);

        DEBUG_JSX.log("Updated existing marker at time " + markerTime.toFixed(3) + " with new spring block");

    } else {
        // No marker exists - create new one
        var newMarker = new MarkerValue(springBlock);
        markerProp.setValueAtTime(targetTime, newMarker);

        DEBUG_JSX.log("Created new marker at time " + targetTime.toFixed(3));
    }
}

### Marker Copy/Merge/Remove Workflow

**Goal**: Keep mirrored spring markers formatted exactly like original Sproing markers, and robustly add/remove property blocks over time.

**Property Identifier**: Use simple identifiers like `Transform > Position`, `Transform > Scale` (matches Sproing’s block format).

**Separator**: `=======================================` (must match Sproing’s exact separator string).

**Find Existing Marker**:
```javascript
function findMarkerAtTime(markerProp, targetTime, epsilon) {
    for (var i = 1; i <= markerProp.numKeys; i++) {
        var t = markerProp.keyTime(i);
        if (Math.abs(t - targetTime) < epsilon) {
            return { index: i, time: t };
        }
    }
    return null;
}
```

**Copy Original Block Text (Preferred)**:
- When mirroring, if an original spring marker exists at the selected segment’s first key, parse its comment and extract the block matching the current `uniquePropId`.
- Use that exact text as the mirrored block to preserve formatting and future unbake compatibility.
- If no original block is found, build a block via `createSpringBlock(...)` in the Sproing format.

**Add/Update Block**:
- At the first baked keyframe time (playhead), find existing marker within `epsilon` (0.01s).
- If found, split the comment by the separator, remove any block for `uniquePropId`, then append the new `springBlock` and rejoin using the separator.
- If not found, create a new marker with just `springBlock`.

**Remove Block**:
```javascript
function removePropertyBlockFromMarker(markerProp, targetTime, uniquePropId, epsilon) {
    var data = findMarkerAtTime(markerProp, targetTime, epsilon);
    if (!data) return false;
    var idx = data.index;
    var markerVal = markerProp.keyValue(idx);
    var separator = "=======================================";
    var raw = markerVal.comment.split(separator);
    var kept = [];
    for (var i = 0; i < raw.length; i++) {
        var block = raw[i].trim();
        if (!block) continue;
        if (block.indexOf("| Property: " + uniquePropId) !== -1) continue; // remove
        kept.push(block);
    }
    if (kept.length === 0) {
        // No blocks left; remove the marker entirely
        markerProp.removeKey(idx);
        return true;
    }
    // Update marker comment with remaining blocks
    markerVal.comment = kept.join("\n\n" + separator + "\n\n");
    markerProp.setValueAtKey(idx, markerVal);
    return true;
}
```

**Adding More Mirrored Params Later**:
- Mirror additional properties independently; each uses the same add/update logic at the same marker time (first baked keyframe).
- The marker accumulates multiple property blocks; merging preserves existing blocks.

**Unmirror/Replace Behavior**:
- To “re-mirror” a property, simply update the block (remove + re-add) at the same marker time.
- To remove a mirrored property, call `removePropertyBlockFromMarker(...)`. If no blocks remain, delete the marker key.

**Boundary Labels**:
- Always set blue labels (8) on first and last baked keys of the mirrored segment to match Sproing’s unbake boundary detection.

```

### Spring Block Format

Match Sproing's exact marker format:

```javascript
/**
 * Creates spring data block in Sproing format
 *
 * @param {Number} stiffness - Spring stiffness
 * @param {Number} dampingRatio - Damping ratio (0-1+)
 * @param {Number} mass - Mass (typically 1)
 * @param {String} uniquePropId - Property identifier
 * @param {String} presetName - Optional preset name or "Mirrored Spring"
 * @returns {String} - Formatted spring block
 */
function createSpringBlock(stiffness, dampingRatio, mass, uniquePropId, presetName) {
    var damping = dampingRatio; // Same value for compatibility
    var title = presetName || "Mirrored Spring";

    var springBlock = title + "\n\n" +
        "Stiffness: " + stiffness + ", Damping: " + damping.toFixed(2) +
        ", Damping Ratio: " + dampingRatio.toFixed(2) + ", Mass: " + mass + "\n\n" +
        "| Property: " + uniquePropId;

    return springBlock;
}
```

## Implementation Phases

### Phase 1: Copy Core Functions (No Modifications)

Copy these functions exactly from Sproing:

1. ✅ `androidSpring()` - Spring physics calculation
2. ✅ `isSettled()` - Settlement detection
3. ✅ `douglasPeucker()` - Recursive simplification
4. ✅ `valueDeviation()` - Deviation calculation
5. ✅ `getOriginalValueAtTime()` - Value interpolation
6. ✅ `generateFullSpringCurve()` - Full curve generation
7. ✅ `simplifySpringKeyframes()` - Keyframe simplification
8. ✅ `PRECISION_SETTINGS` - Precision configuration

**Critical**: Keep exact function signatures, variable names, and logic. Do not "improve" or "optimize".

**File**: `jsx/main.jsx`
**Location**: Add before `mirrorKeysFromPanel()` function
**Lines**: ~250 lines total

### Phase 2: Marker & Property Utilities

Implement helper functions for marker/property handling:

1. ✅ `findMarkerAtTime()` - Find marker at specific time
2. ✅ `parseSpringFromMarker()` - Extract spring params from marker
3. ✅ `getUniquePropertyId()` - Get hierarchical property path
4. ✅ `createOrUpdateMirroredMarker()` - Handle multi-property markers
5. ✅ `createSpringBlock()` - Format spring data block
6. ✅ `detectBakingPrecision()` - Auto-detect Max precision

**File**: `jsx/main.jsx`
**Lines**: ~150 lines total

### Phase 3: Enhance mirrorKeysFromPanel()

Add spring detection and baking logic to existing mirror keys function:

```javascript
// Inside mirrorKeysFromPanel(), for each property with 2+ selected keys:

// 1. Check for spring marker at first keyframe
var firstKeyTime = prop.keyTime(firstKeyIdx);
var markerProp = layer("ADBE Marker");
var springMarkerData = findMarkerAtTime(markerProp, firstKeyTime, 0.01);

if (springMarkerData) {
    // 2. Parse spring parameters
    var markerComment = markerProp.keyValue(springMarkerData.index).comment;
    var uniquePropId = getUniquePropertyId(prop);
    var springParams = parseSpringFromMarker(markerComment, uniquePropId);

    if (springParams) {
        DEBUG_JSX.log("Found spring marker for " + uniquePropId);

        // 3. Detect baking precision
        var detectedPrecision = detectBakingPrecision(prop, selectedKeyIndices, frameRate);
        DEBUG_JSX.log("Detected precision: " + detectedPrecision);

        // 4. Generate reversed spring curve
        var maxDuration = 3; // 3 seconds max
        var maxFrames = Math.ceil(maxDuration * frameRate);

        var fullCurveData = generateFullSpringCurve(
            playheadTime,                    // t1
            playheadTime + maxDuration,      // t2
            lastVal,                         // v1 (reversed)
            firstVal,                        // v2 (reversed)
            springParams.dampingRatio,
            springParams.stiffness,
            springParams.mass,
            frameRate,
            maxFrames
        );

        // 5. Simplify using detected precision
        var simplifiedKeyframes = simplifySpringKeyframes(
            fullCurveData,
            detectedPrecision,
            frameRate
        );

        // 6. Bake keyframes
        for (var i = 0; i < simplifiedKeyframes.length; i++) {
            var keyData = simplifiedKeyframes[i];
        prop.setValueAtTime(keyData.x, keyData.y);
        }

        // 7. Set blue labels on first and last keys
        var firstIdx = 1;
        var lastIdx = simplifiedKeyframes.length;
        prop.setLabelAtKey(firstIdx, 8); // Blue
        prop.setLabelAtKey(lastIdx, 8);  // Blue

        // 8. Apply velocity-based easing exactly like Sproing
        applyVelocityBasedEasing(prop, simplifiedKeyframes, fullCurveData);

        // 9. Create mirrored marker on first baked frame (playhead)
        var targetMarkerTime = playheadTime;
        // Prefer copying the exact spring block text for this property from the original marker
        var springBlock = originalSpringBlockTextForProperty || createSpringBlock(
            springParams.stiffness,
            springParams.dampingRatio,
            springParams.mass,
            uniquePropId,
            springParams.presetName
        );

        createOrUpdateMirroredMarker(
            markerProp,
            targetMarkerTime,
            springBlock,
            uniquePropId,
            0.01
        );

        DEBUG_JSX.log("Baked " + simplifiedKeyframes.length + " mirrored spring keyframes");
        continue; // Skip linear mirroring
    }
}

// If no spring found, fall back to existing linear mirroring logic
// ... (existing code)
```

**Lines**: ~100 lines additional to existing function

## Testing Strategy

### Test Case 1: Medium Precision Spring (Default)

1. Create spring with Sproing (Medium precision, default)
2. Bake spring
3. Select all baked keyframes
4. Use Mirror Keys feature
5. ✅ Verify mirrored spring uses Medium precision
6. ✅ Verify blue labels on first/last keys
7. ✅ Verify marker created at playhead + 30 frames
8. ✅ Verify Sproing can unbake mirrored spring
9. ✅ Verify keyframe count similar to original (~10-20 keys)

### Test Case 2: Max Precision Auto-Detection

1. Create spring with Sproing (Max precision - every frame)
2. Bake spring (should have ~60-180 keyframes depending on duration)
3. Select all baked keyframes
4. Use Mirror Keys feature
5. ✅ Verify mirrored spring also uses Max precision (every frame)
6. ✅ Verify keyframe count matches original
7. ✅ Verify blue labels on first/last keys
8. ✅ Verify marker created
9. ✅ Verify Sproing can unbake mirrored spring

**Detection check**: Console should show "Detected precision: max"

### Test Case 3: Multi-Property Spring

1. Create Position spring with Sproing
2. Bake Position spring
3. Create Scale spring with Sproing on same layer
4. Bake Scale spring
5. Select Position spring keyframes, Mirror Keys
6. ✅ Verify Position has mirrored spring
7. ✅ Verify marker contains Position block
8. Select Scale spring keyframes, Mirror Keys
9. ✅ Verify Scale has mirrored spring
10. ✅ Verify marker now contains both Position and Scale blocks
11. ✅ Verify Sproing can unbake both mirrored springs

### Test Case 4: Fallback to Linear

1. Select keyframes without spring marker (manual animation)
2. Use Mirror Keys feature
3. ✅ Verify falls back to linear mirroring (existing behavior)
4. ✅ Verify 2 linear keyframes created
5. ✅ Verify no errors in console

### Test Case 5: Different Spring Types

Test with various Sproing presets:
- Standard Spring (stiffness 175, damping 1.0)
- Bouncy Spring (stiffness 200, damping 0.6)
- Slow Spring (stiffness 100, damping 1.2)

✅ Verify each mirrors correctly with proper physics

### Test Case 6: Edge Cases

1. **Very short spring** (settles in < 10 frames)
2. **Very long spring** (high stiffness, low damping)
3. **Multi-dimensional properties** (Position [x,y])
4. **Re-mirror same property** (should replace existing block)
5. **Mirror when marker already exists** (should merge blocks)

## Code Maintenance Guidelines

### Syncing with Sproing Updates

When Sproing releases new versions:

1. Compare spring physics functions for changes
2. If changed, copy new versions exactly
3. Update version tracking comment header
4. Run full test suite to verify compatibility
5. Update CHANGELOG.md with sync information

**Comparison checklist**:
- [ ] `androidSpring()` - Physics calculation
- [ ] `isSettled()` - Settlement detection
- [ ] `douglasPeucker()` - Simplification algorithm
- [ ] `generateFullSpringCurve()` - Curve generation
- [ ] `simplifySpringKeyframes()` - Keyframe reduction
- [ ] `PRECISION_SETTINGS` - Precision values

### Avoiding Code Splintering

**DO NOT**:
- "Improve" or "optimize" Sproing's algorithms
- Change variable names for "clarity"
- Modify function signatures
- Add "helpful" error handling that changes behavior
- Combine functions for "efficiency"
- Remove "unnecessary" parameters
- Change calculation precision
- Modify loop structures

**DO**:
- Copy byte-for-byte from Sproing
- Document source file and line numbers
- Track Sproing version in comments
- Keep separate section clearly marked
- Test unbake compatibility after changes
- Preserve all comments from Sproing source
- Maintain identical variable names
- Keep same code structure

### Error Handling Strategy

Only add error handling AROUND copied functions, not inside them:

```javascript
// GOOD - Error handling wrapper
try {
    var fullCurveData = generateFullSpringCurve(...); // Exact Sproing code
    var simplified = simplifySpringKeyframes(...);     // Exact Sproing code
} catch (e) {
    DEBUG_JSX.error("Spring baking failed: " + e.toString());
    // Fall back to linear mirroring
    return false;
}

// BAD - Modified Sproing function
function generateFullSpringCurve(...) {
    try {  // NEVER add this inside copied function
        // Sproing code...
    } catch (e) {
        // ...
    }
}
```

### Documentation Requirements

Each copied function should have this header:

```javascript
/**
 * [Function name]
 * COPIED FROM: Sproing v0.94.2
 * SOURCE FILE: SpringBaker.jsx
 * SOURCE LINES: [start]-[end]
 * DATE COPIED: [date]
 *
 * DO NOT MODIFY - Keep identical to Sproing source
 * Any changes here will break unbake compatibility
 */
function copiedFunction() {
    // Exact Sproing code...
}
```

## File Structure

```
jsx/
  main.jsx
    - [Line ~14500] Version tracking header
    - [Line ~14520] Spring physics functions (copied from Sproing)
    - [Line ~14770] Marker/property utilities (AirBoard-specific)
    - [Line ~14920] Enhanced mirrorKeysFromPanel() (integration)

docs/
  SPRING_MIRROR_IMPLEMENTATION_PLAN.md (this file)
  CHANGELOG.md (document feature when released)
```

## Success Criteria

✅ Mirrored springs use Medium precision by default
✅ Max precision auto-detected when original has keyframes on every frame
✅ Blue labels set on first and last keyframes
✅ Markers created/updated maintaining multi-property support
✅ Sproing can successfully unbake mirrored springs
✅ No code modifications to copied Sproing functions
✅ Version tracking maintained in comments
✅ Fallback to linear mirroring when no spring detected
✅ All copied functions documented with source location
✅ ExtendScript ES3 compatible (no modern JS features)

## Future Enhancements (Out of Scope)

- Custom precision selection in UI
- Preview mirrored spring before applying
- Batch mirror multiple springs at once
- Support for custom spring presets
- Visual indication of spring segments in timeline
- Spring duration trimming/extension

## Risk Mitigation

### Risk: Code Splintering

**Mitigation**:
- Document exact Sproing version used
- Regular sync checks with Sproing updates
- Automated tests for unbake compatibility

### Risk: Precision Detection False Positives

**Mitigation**:
- Conservative tolerance (0.1 frames)
- Default to Medium if uncertain
- Log detection results for debugging

### Risk: Marker Format Changes

**Mitigation**:
- Copy exact marker format from Sproing
- Test unbake compatibility in every test case
- Document marker format version

### Risk: Performance with Max Precision

**Mitigation**:
- Max precision only used when auto-detected
- Default to Medium for performance
- Large keyframe sets work fine in After Effects

---

**Version**: 2.0
**Last Updated**: 2025-10-08
**Author**: Implementation plan based on Sproing v0.94.2 architecture
**Status**: Ready for implementation
