# Debugging and User Alerts Guide

**A comprehensive guide for adding debug messages and user alerts in the AirBoard plugin**

## Overview

AirBoard has a custom debug system because ExtendScript runs in isolation without access to browser dev tools or After Effects' console. This guide covers how to properly use debug messages and show user alerts.

---

## Debug System (DEBUG_JSX)

### The Three Debug Functions

The `DEBUG_JSX` object has three logging functions, each with specific requirements:

#### 1. `DEBUG_JSX.log(message, data)` - General Logging

**Use for:** General information, flow tracking, variable inspection

**Parameters:**
- `message` (required): String describing what you're logging
- `data` (optional): Additional data to log

**Examples:**
```javascript
DEBUG_JSX.log("Function started");
DEBUG_JSX.log("Processing layer", layer.name);
DEBUG_JSX.log("Selected " + selectedLayers.length + " layers");
DEBUG_JSX.log("shapeLayer is: " + (shapeLayer ? shapeLayer.name : "NULL"));
```

#### 2. `DEBUG_JSX.error(message, error)` - Error Logging

**Use for:** Logging caught exceptions/errors

**Parameters:**
- `message` (required): String describing the error context
- `error` (required): Error object or value that has `.toString()` method

**⚠️ CRITICAL:** Both parameters are REQUIRED! The second parameter MUST have a `.toString()` method or you'll get "TypeError: undefined is not an object"

**Correct Examples:**
```javascript
try {
    // Some operation
} catch(e) {
    DEBUG_JSX.error("Operation failed", e);  // ✅ e has .toString()
}

DEBUG_JSX.error("Layer not found", new Error("Missing layer"));  // ✅ Error object
DEBUG_JSX.error("Invalid type", "String error");  // ✅ Strings have .toString()
```

**Wrong Examples:**
```javascript
DEBUG_JSX.error("Something went wrong");  // ❌ Missing second parameter
DEBUG_JSX.error("Error occurred", undefined);  // ❌ undefined has no .toString()
DEBUG_JSX.error("Bad value", null);  // ❌ null has no .toString()
```

**If you don't have an error object, use `DEBUG_JSX.log()` instead:**
```javascript
// Instead of this:
DEBUG_JSX.error("Mask layer selected");  // ❌ Will crash!

// Do this:
DEBUG_JSX.log("Mask layer selected");  // ✅ Works perfectly
```

#### 3. `DEBUG_JSX.info(message, data)` - Info Logging

**Use for:** Status updates, informational messages

**Parameters:**
- `message` (required): String with information
- `data` (optional): Additional data to log

**Examples:**
```javascript
DEBUG_JSX.info("Operation completed successfully");
DEBUG_JSX.info("Layers processed", layerCount);
```

### Other DEBUG_JSX Functions

#### `DEBUG_JSX.clear()` - Clear Messages

Clears all stored debug messages. Call at the start of functions to get clean debug output.

```javascript
function myFunction() {
    DEBUG_JSX.clear();  // Start with clean slate
    DEBUG_JSX.log("Function started");
    // ... rest of function
}
```

#### `DEBUG_JSX.getMessages()` - Retrieve Messages

Returns array of all debug messages. Used to pass debug info back to the UI.

```javascript
function myFunction() {
    try {
        // Function logic
        var debugMessages = DEBUG_JSX.getMessages();
        return "success|result|" + debugMessages.join("|");
    } catch(e) {
        var debugMessages = DEBUG_JSX.getMessages();
        return "error|" + e.toString() + "|" + debugMessages.join("|");
    }
}
```

---

## User Alerts

### When to Show Alerts

Show alerts for:
- ✅ User errors (wrong selection, missing requirements)
- ✅ Critical failures that prevent operations
- ✅ Important confirmations or warnings
- ❌ **NOT** for debugging (use DEBUG_JSX instead)
- ❌ **NOT** for successful operations (users can see the result)

### Alert Best Practices

#### 1. Clear, Actionable Messages

**Bad:**
```javascript
alert("Error");
alert("Invalid selection");
alert("Can't do that");
```

**Good:**
```javascript
alert("Please select a composition first.");
alert("Select at least 2 layers: one shape layer and one or more content layers.");
alert("Can't Fit to Squircle because you selected the track matte layer. Please select the original Squircle layer instead (not the one with '- Mask' in the name).");
```

#### 2. Return Error Status After Alerts

Always return an error status after showing an alert so the function exits gracefully.

```javascript
if (!comp || !(comp instanceof CompItem)) {
    alert("Please select a composition first.");
    var debugMessages = DEBUG_JSX.getMessages();
    return "error|No composition|" + debugMessages.join("|");
}
```

#### 3. Include Debug Messages in Returns

Always include debug messages in your return value for debugging purposes.

```javascript
// Pattern for validation errors
if (validationFails) {
    DEBUG_JSX.log("Validation failed: " + reason);
    alert("User-friendly error message");
    var debugMessages = DEBUG_JSX.getMessages();
    return "error|error_code|" + debugMessages.join("|");
}
```

---

## Complete Example: Validation with Debug and Alert

Here's a complete example showing proper use of debugging and alerts:

```javascript
function addFeatureFromPanel(featureType) {
    try {
        // Clear previous debug messages
        DEBUG_JSX.clear();

        DEBUG_JSX.log("addFeatureFromPanel called with: " + featureType);

        // Check if composition exists
        var comp = app.project.activeItem;
        if (!comp || !(comp instanceof CompItem)) {
            DEBUG_JSX.log("No composition selected");
            alert("Please select a composition first.");
            var debugMessages = DEBUG_JSX.getMessages();
            return "error|No composition|" + debugMessages.join("|");
        }

        // Check layer selection
        var selectedLayers = comp.selectedLayers;
        DEBUG_JSX.log("Found " + selectedLayers.length + " selected layers");

        if (selectedLayers.length === 0) {
            DEBUG_JSX.log("No layers selected");
            alert("Please select at least one layer.");
            var debugMessages = DEBUG_JSX.getMessages();
            return "error|No layers|" + debugMessages.join("|");
        }

        // Check for specific layer type
        var hasShapeLayer = false;
        for (var i = 0; i < selectedLayers.length; i++) {
            if (selectedLayers[i] instanceof ShapeLayer) {
                hasShapeLayer = true;
                DEBUG_JSX.log("Found shape layer: " + selectedLayers[i].name);
                break;
            }
        }

        if (!hasShapeLayer) {
            DEBUG_JSX.log("No shape layer found in selection");
            alert("Please select at least one shape layer.");
            var debugMessages = DEBUG_JSX.getMessages();
            return "error|No shape layer|" + debugMessages.join("|");
        }

        // Main operation
        DEBUG_JSX.log("Starting main operation");
        // ... perform operation ...

        DEBUG_JSX.log("Operation completed successfully");
        var debugMessages = DEBUG_JSX.getMessages();
        return "success|" + debugMessages.join("|");

    } catch(e) {
        // Use DEBUG_JSX.error with the caught exception
        DEBUG_JSX.error("Function failed", e);
        alert("Error: " + e.toString());
        var debugMessages = DEBUG_JSX.getMessages();
        return "error|" + e.toString() + "|" + debugMessages.join("|");
    }
}
```

---

## Common Patterns

### Pattern 1: Validation Chain

```javascript
// Check condition 1
if (!condition1) {
    DEBUG_JSX.log("Condition 1 failed");
    alert("User message about condition 1");
    return "error|condition1|" + DEBUG_JSX.getMessages().join("|");
}

// Check condition 2
if (!condition2) {
    DEBUG_JSX.log("Condition 2 failed");
    alert("User message about condition 2");
    return "error|condition2|" + DEBUG_JSX.getMessages().join("|");
}

// All validations passed
DEBUG_JSX.log("All validations passed, proceeding");
```

### Pattern 2: Conditional User-Friendly Errors

```javascript
if (!shapeLayer) {
    // Check WHY there's no shape layer
    var hasMaskLayer = checkForMaskLayers(selectedLayers);

    if (hasMaskLayer) {
        DEBUG_JSX.log("User selected mask layer instead of shape layer");
        alert("Can't process because you selected the mask layer. Please select the original shape layer.");
    } else {
        DEBUG_JSX.log("No shape layer in selection");
        alert("Please select at least one shape layer.");
    }

    return "error|No shape layer|" + DEBUG_JSX.getMessages().join("|");
}
```

### Pattern 3: Try-Catch with Debug

```javascript
try {
    DEBUG_JSX.log("Attempting operation");
    // Risky operation
    var result = riskyOperation();
    DEBUG_JSX.log("Operation succeeded: " + result);
} catch(e) {
    DEBUG_JSX.error("Operation failed", e);  // ✅ Correct: e is an error object
    alert("Operation failed: " + e.toString());
    return "error|" + e.toString() + "|" + DEBUG_JSX.getMessages().join("|");
}
```

---

## Debugging Workflow

### Step 1: Add Debug Messages

Add `DEBUG_JSX.log()` calls throughout your function:

```javascript
function myFunction(param) {
    DEBUG_JSX.clear();
    DEBUG_JSX.log("myFunction called with param: " + param);

    DEBUG_JSX.log("Step 1: Checking condition");
    if (condition) {
        DEBUG_JSX.log("Condition passed");
    } else {
        DEBUG_JSX.log("Condition failed");
        return "error";
    }

    DEBUG_JSX.log("Step 2: Processing data");
    // ... process ...

    DEBUG_JSX.log("Function complete");
}
```

### Step 2: Open Debug Panel

Click the **🐛 Debug button** in the AirBoard Dev panel (next to "Device Templates [DEV MODE]")

### Step 3: Test and Read Output

1. Run your function
2. Read debug messages in the debug panel
3. Identify where things go wrong
4. Add more DEBUG_JSX.log() calls if needed
5. Test again

### Step 4: Clean Up

Once everything works, you can:
- Keep critical debug messages for future troubleshooting
- Remove excessive debug messages that clutter output
- Leave validation messages for debugging user issues

---

## Troubleshooting

### "TypeError: undefined is not an object"

**Cause:** Called `DEBUG_JSX.error()` with only one parameter or with `undefined`/`null` as second parameter

**Fix:** Use `DEBUG_JSX.log()` instead, or pass a valid error object

```javascript
// Wrong:
DEBUG_JSX.error("Something failed");

// Right:
DEBUG_JSX.log("Something failed");
```

### Alert Not Showing

**Possible causes:**
1. Function returns before reaching alert
2. Function is wrapped in try-catch that swallows the error
3. Alert is in unreachable code

**Debug steps:**
```javascript
DEBUG_JSX.log("Before alert");
alert("Test message");
DEBUG_JSX.log("After alert");
```

### Debug Messages Not Appearing in Panel

**Possible causes:**
1. Not returning debug messages in function result
2. Debug panel not open
3. Using wrong debug function ($.writeln vs DEBUG_JSX)

**Fix:** Always return debug messages:
```javascript
var debugMessages = DEBUG_JSX.getMessages();
return "success|result|" + debugMessages.join("|");
```

---

## Quick Reference

| Function | Parameters | Use For | Second Param Required |
|----------|-----------|---------|----------------------|
| `DEBUG_JSX.log(msg, data)` | message, optional data | General logging | ❌ No |
| `DEBUG_JSX.error(msg, err)` | message, error object | Caught exceptions | ✅ **YES** |
| `DEBUG_JSX.info(msg, data)` | message, optional data | Status updates | ❌ No |
| `DEBUG_JSX.clear()` | none | Clear messages | N/A |
| `DEBUG_JSX.getMessages()` | none | Get all messages | N/A |

| Alert Use | Recommended? |
|-----------|-------------|
| User made wrong selection | ✅ Yes |
| Missing required data | ✅ Yes |
| Operation failed critically | ✅ Yes |
| Debugging/development | ❌ No - Use DEBUG_JSX |
| Operation succeeded | ❌ No - User can see result |

---

*Last updated: 2025-01-10*
