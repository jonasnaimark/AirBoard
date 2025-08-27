# AirBoard Plugin Debug System

## 🚨 QUICK REFERENCE - READ THIS FIRST

**After Effects has NO accessible ExtendScript console. You MUST use our plugin debug panel.**

## How to Debug (3 Simple Steps)

### 1. Open Debug Panel
- Click the **🐛 Debug** button in the "Device Templates [DEV MODE]" section
- Debug panel appears as floating overlay in top-right corner

### 2. Use Correct Debug Commands
```javascript
// ✅ CORRECT - In ExtendScript (jsx/main.jsx)
DEBUG_JSX.log("Your debug message");
DEBUG_JSX.error("Error occurred", error);
DEBUG_JSX.info("Status info", data);

// ❌ WRONG - These don't work in After Effects plugins
$.writeln("Message");      // Goes to inaccessible console
console.log("Message");    // JavaScript only, not ExtendScript
alert("Message");          // Blocks workflow
```

### 3. Clear Messages Between Tests
- Click **Clear** button in debug panel before testing
- Or call `DEBUG_JSX.clear()` in your ExtendScript functions

## Debug Panel Features

- **🎬 Color-coded messages** - Blue for functions, red for errors
- **📋 Copy button** - Copies all debug text to clipboard  
- **🗑️ Clear button** - Clears all messages
- **❌ Close button** - Closes the debug panel
- **📜 Auto-scroll** - Always shows latest messages
- **📝 Selectable text** - Click and drag to select specific messages

## Function Debug Pattern

### ExtendScript Pattern (jsx/main.jsx)
```javascript
function yourFunction(param1, param2) {
    try {
        // Clear previous messages
        DEBUG_JSX.clear();
        
        DEBUG_JSX.log("yourFunction called with: " + param1 + ", " + param2);
        DEBUG_JSX.log("Processing started");
        
        // Your function logic here
        var result = doSomething();
        DEBUG_JSX.log("Processing complete, result: " + result);
        
        // Return result with debug messages
        var debugMessages = DEBUG_JSX.getMessages();
        return "success|" + result + "|" + debugMessages.join("|");
        
    } catch(e) {
        DEBUG_JSX.error("Function failed", e);
        var debugMessages = DEBUG_JSX.getMessages();
        return "error|" + e.toString() + "|" + debugMessages.join("|");
    }
}
```

### JavaScript Handler Pattern (client/js/main.js)
```javascript
csInterface.evalScript('yourFunction(param1, param2)', function(result) {
    console.log('Function result:', result);
    
    if (result && result.indexOf('|') !== -1) {
        var parts = result.split('|');
        var status = parts[0];
        
        // Extract debug messages (adjust index based on your result format)
        var debugMessages = [];
        for (var i = 2; i < parts.length; i++) {
            if (parts[i] && parts[i].trim()) {
                debugMessages.push(parts[i]);
            }
        }
        
        // Display in debug panel
        if (debugMessages.length > 0) {
            var debugLog = document.getElementById('debug-log');
            if (debugLog) {
                debugLog.innerHTML += '<div style="margin: 4px 0; color: #4a9eff; font-weight: bold;">🎬 Your Function:</div>';
                for (var j = 0; j < debugMessages.length; j++) {
                    debugLog.innerHTML += '<div style="margin: 1px 0; font-size: 9px; color: #ccc;">' + debugMessages[j] + '</div>';
                }
                debugLog.scrollTop = debugLog.scrollHeight;
            }
        }
    }
});
```

## Common Debug Scenarios

### Debugging New Features
1. Open 🐛 Debug panel
2. Clear existing messages
3. Add `DEBUG_JSX.log()` calls in your ExtendScript function
4. Test the feature
5. Read debug messages to understand execution flow

### Investigating Bugs
1. Open 🐛 Debug panel  
2. Clear messages
3. Reproduce the bug
4. Read debug output to identify where it fails
5. Copy messages for documentation

### Testing Keyframe Operations
1. Open 🐛 Debug panel
2. Select keyframes in After Effects
3. Click operation button (stagger +/-, delay +/-, etc.)
4. Watch debug messages appear in real-time
5. Verify expected behavior from debug output

## Troubleshooting

### No Debug Messages Appearing?
- ✅ Is the 🐛 Debug panel open?
- ✅ Is your function calling `DEBUG_JSX.clear()` at the start?
- ✅ Is your function returning debug messages in the result?
- ✅ Is your JavaScript handler extracting messages correctly?

### Messages Look Wrong?
- ❌ Don't use pipe characters `|` in debug messages (breaks parsing)
- ❌ Don't use `console.log()` in ExtendScript (wrong context)
- ✅ Use `DEBUG_JSX.log()` for all ExtendScript debugging

### Panel Not Working?
- Close and reopen with 🐛 Debug button
- Check browser console (F12) for JavaScript errors
- Make sure you're not using After Effects' built-in debugging tools

## Why This System Exists

**After Effects ExtendScript runs in isolation** - there's no accessible console, no browser dev tools, no way to see debug output. Our debug panel is the ONLY way to see what's happening in ExtendScript functions.

**CEP panels bridge two contexts:**
- **ExtendScript** (After Effects) - where our main logic runs
- **JavaScript** (browser) - where our UI runs

Our debug system connects these contexts so you can see ExtendScript debug output in the browser-based debug panel.

## Examples in the Codebase

### Working Examples
- **Stagger functions** - `applyStagger()`, `applyStaggerToLayers()`
- **Keyframe nudging** - `nudgeDelayFromPanel()`
- **Smart snapping** - `snapStaggersToInputValue()`

### Debug Message Patterns
- `🎬 AirBoard: Function started`
- `🎬 AirBoard: Processing 5 layers`
- `🎬 AirBoard: Smart snapping analysis complete`
- `❌ AirBoard Error: Invalid parameters | ReferenceError: undefined`

## Remember
- **NEVER use `$.writeln()`** - it goes to an inaccessible console
- **ALWAYS use `DEBUG_JSX.log()`** - it goes to our debug panel
- **Open 🐛 Debug panel FIRST** - before testing any features
- **Clear messages between tests** - to avoid confusion

---

**The debug panel is essential for plugin development. Without it, ExtendScript debugging is impossible.**