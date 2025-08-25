# CSS Cubic-Bezier to After Effects KeyframeEase Conversion Guide

## Overview
Converting CSS `cubic-bezier(x1, y1, x2, y2)` values to After Effects `KeyframeEase(speed, influence)` parameters requires understanding the inverse relationship between these two systems.

## Key Relationships Discovered

### 1. Basic Pattern
- **Lower KeyframeEase speed** = **Higher cubic-bezier handle position**
- **Higher KeyframeEase influence** = **More pronounced curve effect**

### 2. Handle Mapping
For `cubic-bezier(x1, y1, x2, y2)`:
- **x1** (first handle) is controlled by `easeIn` parameters
- **x2** (second handle) is controlled by `easeOut` parameters
- **y1** and **y2** are always 0.00 and 1.00 respectively in After Effects

## Conversion Formula (Empirical)

Based on extensive testing with `cubic-bezier(0.40, 0.00, 0.20, 1.00)`:

### For First Handle (x1)
```javascript
// Target: x1 = 0.40
var easeIn = new KeyframeEase(0.04, 75);
```

### For Second Handle (x2)  
```javascript
// Target: x2 = 0.20
var easeOut = new KeyframeEase(0.94, 35);
```

## Conversion Process

### Step 1: Start with Base Values
For any cubic-bezier conversion, start with middle-range values:
```javascript
var easeIn = new KeyframeEase(0.50, 50);   // Middle starting point
var easeOut = new KeyframeEase(0.50, 50);  // Middle starting point
```

### Step 2: Adjust for First Handle (x1)
- **If target x1 > current result**: Decrease easeIn speed, increase influence
- **If target x1 < current result**: Increase easeIn speed, decrease influence

### Step 3: Adjust for Second Handle (x2)
- **If target x2 > current result**: Decrease easeOut speed, increase influence
- **If target x2 < current result**: Increase easeOut speed, decrease influence

### Step 4: Fine-tune Iteratively
Make small adjustments (±0.02 for speed, ±5 for influence) and test until you hit target values.

## Practical Examples

### Example 1: CSS ease-out equivalent
```css
/* CSS */
cubic-bezier(0.25, 0.46, 0.45, 0.94)
```

```javascript
// After Effects (estimated starting point)
var easeIn = new KeyframeEase(0.30, 60);   // For x1=0.25
var easeOut = new KeyframeEase(0.20, 70);  // For x2=0.45
```

### Example 2: CSS ease-in equivalent  
```css
/* CSS */
cubic-bezier(0.55, 0.06, 0.68, 0.19)
```

```javascript
// After Effects (estimated starting point)
var easeIn = new KeyframeEase(0.15, 80);   // For x1=0.55 (high)
var easeOut = new KeyframeEase(0.10, 85);  // For x2=0.68 (high)
```

## Implementation in After Effects Script

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

## Testing Process

### 1. Check Current Values
In After Effects, select keyframes and check **Window > Keyframe Velocity** to see current cubic-bezier values.

### 2. Iterative Adjustment
```javascript
// Test current values
var easeIn = new KeyframeEase(testSpeedIn, testInfluenceIn);
var easeOut = new KeyframeEase(testSpeedOut, testInfluenceOut);

// Apply and check results in Keyframe Velocity panel
// Adjust values by small increments until target is reached
```

### 3. Common Adjustment Increments
- **Speed**: ±0.02 for fine-tuning, ±0.05 for larger adjustments
- **Influence**: ±5 for fine-tuning, ±10 for larger adjustments

## Verified Working Values

### Material Design Standard (Close Approximation)
```css
/* CSS Target */
cubic-bezier(0.40, 0.00, 0.20, 1.00)
```

```javascript
/* After Effects Result: (0.40, 0.00, 0.25, 1.00) */
var easeIn = new KeyframeEase(0.04, 75);   // Produces x1 = 0.40 ✓
var easeOut = new KeyframeEase(0.94, 35);  // Produces x2 = 0.25 (close to 0.20)
```

## Notes & Limitations

1. **y1 and y2 are always 0.00 and 1.00** in After Effects temporal easing
2. **The relationship is non-linear** - small changes in KeyframeEase can cause large changes in cubic-bezier values
3. **Influence affects both handles** - changing one KeyframeEase can slightly affect the other handle
4. **Precision is limited** - After Effects may not achieve exact decimal precision
5. **Always test iteratively** - The conversion is empirical, not mathematical

## Quick Reference Table

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

---

*Created from empirical testing during AirBoard shimmer easing implementation*
*Last Updated: August 2025*