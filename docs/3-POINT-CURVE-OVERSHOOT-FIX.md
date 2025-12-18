# 3-Point Curve Overshoot Prevention

## The Problem

The "Make 3 point curve" feature can potentially cause value overshoots if bezier handles extend too far in value-space.

After creating the 3-point curve:
- Key1 (original start)
- Key2 (middle key, auto-eased by AE)
- Key3 (original end, extended further out)

Key2's **outgoing handle** points toward Key3. If this handle's tip extends past Key3's value (in the Graph Editor's value view), the curve will overshoot before settling.

## Visual Explanation

```
Value
  ^
  |        handle tip (BAD - exceeds target)
  |           /
  |      ____/
  |     /    \_____ Key3 value
  |    /
  | Key2
  |
  +-------------------------> Time
```

The handle tip should never exceed Key3's value.

## The Fix

After creating the 3-point curve, check if Key2's outgoing handle overshoots:

### 1. Get Key2's Outgoing Ease
```javascript
var key2OutEase = prop.keyOutTemporalEase(key2Idx);
var speed = key2OutEase[0].speed;      // units per second
var influence = key2OutEase[0].influence; // percentage (0-100)
```

### 2. Calculate Handle Tip Position in Value-Space
```javascript
var segmentDuration = key3Time - key2Time;
var handleTimeExtent = (influence / 100) * segmentDuration;
var handleValueExtent = speed * handleTimeExtent;
var handleTipValue = key2Value + handleValueExtent;
```

### 3. Check for Overshoot
```javascript
var isIncreasing = key3Value > key2Value;
var overshoots = isIncreasing
    ? (handleTipValue > key3Value)
    : (handleTipValue < key3Value);
```

### 4. Clamp Influence if Needed
If overshooting, calculate the max safe influence:

```javascript
if (overshoots && speed !== 0) {
    // Solve: key2Value + speed * (maxInfluence/100) * segmentDuration = key3Value
    // maxInfluence = ((key3Value - key2Value) / speed / segmentDuration) * 100

    var maxHandleValueExtent = key3Value - key2Value;
    var maxHandleTimeExtent = maxHandleValueExtent / speed;
    var maxInfluence = (maxHandleTimeExtent / segmentDuration) * 100;

    // Apply clamped influence (keep same speed/angle)
    var clampedEase = new KeyframeEase(speed, Math.max(0, Math.min(maxInfluence, 100)));
    prop.setTemporalEaseAtKey(key2Idx, prop.keyInTemporalEase(key2Idx), [clampedEase]);
}
```

### 5. Handle Multi-Dimensional Properties
For Position, Scale, etc., check each dimension:

```javascript
for (var d = 0; d < key2OutEase.length; d++) {
    var speed = key2OutEase[d].speed;
    var influence = key2OutEase[d].influence;
    // ... same logic per dimension
}
```

## Notes

- Speed = 0 means horizontal handle (no value change), so no overshoot possible from that handle
- This only matters for Key2's outgoing handle, since Key3's incoming handle was explicitly set
- The fix preserves the handle's angle (speed), only reducing its length (influence)
- Consider adding a small margin (e.g., clamp to 95% of max) to avoid edge cases

## Where to Implement

In `jsx/main.jsx`, function `makeThreePointCurve()`, after the middle key is added and before returning success.

---

# Position Property Ease Fix (Combined 2D)

## The Problem

When applying 3-point curve to **combined Position** (not split X/Y Position), the middle key's outgoing handle gets the wrong ease values, resulting in a stiff/kinked curve instead of a smooth one.

**Observed behavior:**
- Y Position (1D): Creates smooth curve with bezier `(0.30, 1.00, 0.59, 1.00)` ✓
- Position (2D): Creates kinked curve with bezier `(0.04, 0.19, 0.59, 1.00)` ✗

The issue is specifically with the **middle key's outgoing handle** - it has very low influence (~4%) instead of ~30%.

## Root Cause

When AE adds a keyframe to a 2D Position property via `addKey()`, it calculates the temporal ease based on the **2D spatial motion path tangent**, not the individual value curves. This produces wrong ease values for the value graph.

**Key discovery:** For combined Position, `keyOutTemporalEase()` returns an array with **length=1** (not 2), because AE uses a single combined velocity along the motion path rather than separate X/Y velocities.

```javascript
// For Y Position (1D):
prop.keyOutTemporalEase(idx).length  // → 1

// For Position (combined 2D) - surprisingly also:
prop.keyOutTemporalEase(idx).length  // → 1 (combined path velocity!)

// For Scale (separate dimensions):
prop.keyOutTemporalEase(idx).length  // → 2
```

## The Fix

After creating the 3-point curve, detect Position and fix the middle key's outgoing ease using **path distance** instead of individual axis deltas:

```javascript
var isPosition = (prop.matchName === "ADBE Position");

if (isPosition && numDims === 1) {
    var midVal = prop.keyValue(finalMiddleIdx);   // [x, y]
    var key3Val = prop.keyValue(finalKey2Idx);    // [x, y]
    var dur2 = newKey2Time - middleKeyTime;

    // Calculate Euclidean path distance
    var deltaX = key3Val[0] - midVal[0];
    var deltaY = key3Val[1] - midVal[1];
    var pathDistance = Math.sqrt(deltaX * deltaX + deltaY * deltaY);

    // Target: bezier (0.30, 1.00) - handle reaches target value
    var targetInfluence = 30;
    var targetSpeed = pathDistance / (0.30 * dur2);

    var midInEase = prop.keyInTemporalEase(finalMiddleIdx);
    var newMidOutEase = [new KeyframeEase(targetSpeed, targetInfluence)];

    prop.setTemporalEaseAtKey(finalMiddleIdx, midInEase, newMidOutEase);
}
```

## The Math

For a cubic bezier control point `(t1, v1)`:
- `t1` = time position (0-1) = `influence / 100`
- `v1` = value position (0-1) = how far the handle reaches toward target

For `(0.30, 1.00)`:
- `influence = 30` → `t1 = 0.30`
- `v1 = 1.00` → handle tip reaches the target value exactly

The speed formula ensures the handle tip lands at the target:
```
handleTipValue = middleValue + speed × (influence/100) × duration = targetValue
speed = pathDistance / (0.30 × duration)
```

## Why Path Distance?

For combined Position, the temporal ease represents motion along the **2D path**, not separate X/Y movements. The "value change" in this context is the **Euclidean distance** traveled:

```javascript
pathDistance = √(deltaX² + deltaY²)
```

This matches how AE internally represents the combined velocity magnitude.

## Property Type Reference

| Property | `keyOutTemporalEase().length` | Value Type |
|----------|-------------------------------|------------|
| X Position (split) | 1 | Single number |
| Y Position (split) | 1 | Single number |
| Position (combined) | 1 | [x, y] array |
| Scale | 2 | [x, y] array |
| Rotation | 1 | Single number |
| Opacity | 1 | Single number |

**Key insight:** Position returns `length=1` despite being 2D because AE uses combined path velocity.

## Location in Code

In `jsx/main.jsx`, function `makeThreePointCurve()`, around line 22039, after finding the final key indices and before overshoot prevention.
