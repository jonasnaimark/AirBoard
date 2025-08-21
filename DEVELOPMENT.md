# AirBoard Development Guide

## Quick Development Setup

### One-Time Setup
```bash
# Run the development sync script
./dev-sync.sh

# This creates a symlink in:
# ~/Library/Application Support/Adobe/CEP/extensions/airboard-dev
```

### Development Workflow
1. **Make code changes** in HTML/CSS/JS/JSX files
2. **Save files**
3. **Restart After Effects**
4. **Test using "AirBoard Dev"** in Window > Extensions
5. **Repeat steps 1-4** as needed

### Two Extension Versions
- **"AirBoard"** = Production version (from installed ZXP)
- **"AirBoard Dev"** = Development version (live files with [DEV MODE] indicator)

### Building for Distribution
```bash
# Only when ready to share with others
./build-latest.sh
```

**Production Build Process:**
- ✅ **Automatically removes** `[DEV MODE]` markers from HTML
- ✅ **Removes debug button** and debugging functionality  
- ✅ **Resets manifest** from development IDs to production IDs  
- ✅ **Creates clean ZXP** without any development artifacts
- ✅ **Preserves source files** - your development files remain unchanged

## Benefits
- ⚡ **10x faster iteration** - no ZXP building during development
- 🔄 **Quick testing** - just restart AE instead of install/uninstall
- 🐛 **Better debugging** - easier to test multiple changes rapidly

## Advanced Debugging with Chrome DevTools

### Setup Remote Debugging
```bash
# Enable remote debugging for CEP (one-time setup)
defaults write com.adobe.CSXS.11 PlayerDebugMode 1
defaults write com.adobe.CSXS.12 PlayerDebugMode 1

# Set debug port (optional, defaults to 8088)
defaults write com.adobe.CSXS.11 CEPEnableNodeDebugging 1
defaults write com.adobe.CSXS.12 CEPEnableNodeDebugging 1
```

### Access Chrome DevTools
1. **Open your CEP extension** in After Effects ("AirBoard Dev")
2. **Open Chrome browser** and navigate to: `chrome://inspect`
3. **Look for your extension** in the "Remote Target" list
4. **Click "inspect"** to open DevTools

### What You Get
- 🐛 **Full JavaScript debugging** with breakpoints
- 📝 **Console.log() output** visible in real-time
- 🔍 **Element inspector** for HTML/CSS debugging
- 📊 **Network monitoring** for any requests
- ⚡ **Live editing** of CSS/JS (temporary changes)

## 🐛 Debugging Like a Detective

### The Debug Panel Workflow

**1. Click 🐛 Debug button** in your extension to open the debug panel

**2. Add DEBUG messages strategically:**
```javascript
// At function start - "I'm here"
DEBUG.log('Button clicked - starting process');

// Before risky operations - "About to try something"
DEBUG.log('About to call After Effects script...');

// With important data - "Here's what I got"
DEBUG.log('Received data from AE:', result);

// When things go wrong - "Houston, we have a problem"
DEBUG.error('Failed to parse result:', error);
```

### Debugging Strategy: Follow the Breadcrumbs

**Step 1: Add breadcrumbs** to track where your code goes:
```javascript
function myFunction() {
    DEBUG.log('myFunction started');
    
    if (someCondition) {
        DEBUG.log('Taking the TRUE path');
        // do something
    } else {
        DEBUG.log('Taking the FALSE path');
        // do something else
    }
    
    DEBUG.log('myFunction finished');
}
```

**Step 2: Check variables** to see what they actually contain:
```javascript
DEBUG.log('Variable value:', myVariable);
DEBUG.log('Array contents:', JSON.stringify(myArray));
```

**Step 3: Track the problem** - if something breaks:
```javascript
// Add before the problem area
DEBUG.log('Everything working fine here');

// Add after the problem area  
DEBUG.log('Made it past the problem!');

// If second message doesn't appear, problem is between them!
```

### Real Example: Debugging the Read Keyframes Flow

1. **Click Read Keyframes button**
2. **Watch debug panel for this sequence:**
   ```
   🎬 AirBoard: Read Keyframes clicked
   🎬 AirBoard: About to call readKeyframesDuration() in After Effects...
   🎬 AirBoard: Got result from After Effects: success|500|15|1|3|2|40|30|1|1
   🎬 AirBoard: Successfully parsed duration: 500ms, 15 frames
   ```

3. **If something's wrong, you'll see:**
   ```
   🎬 AirBoard: Read Keyframes clicked
   🎬 AirBoard: About to call readKeyframesDuration() in After Effects...
   ❌ AirBoard Error: Keyframe reading failed: No layers selected
   ```

### Common Debugging Patterns

**Problem: "Button doesn't work"**
```javascript
buttonElement.addEventListener('click', function() {
    DEBUG.log('Button clicked!'); // Did this show up?
    
    if (!csInterface) {
        DEBUG.error('CSInterface not available!');
        return;
    }
    
    DEBUG.log('CSInterface OK, calling script...');
    // rest of code
});
```

**Problem: "Data looks wrong"**
```javascript
DEBUG.log('Raw data from AE:', result);
DEBUG.log('Split parts:', parts);
DEBUG.log('Parsed numbers:', {duration: durationMs, frames: durationFrames});
```

**Problem: "Code stops working somewhere"**
```javascript
DEBUG.log('Checkpoint 1 - made it here');
// some code
DEBUG.log('Checkpoint 2 - made it here too');
// more code  
DEBUG.log('Checkpoint 3 - if you see this, problem is after here');
```

## Debugging with Plugin Debug Panel

### Using the Built-in Debug Panel

**AirBoard Dev mode includes a built-in debug panel for debugging:**

1. **Open the debug panel**: Click the 🐛 Debug button in the "Device Templates [DEV MODE]" section header
2. **The debug panel will show**:
   - All console.log output from the plugin
   - Debug information from ExtendScript functions
   - Component search results and issues
3. **Debug panel features**:
   - **Clear**: Remove all debug messages
   - **Copy**: Copy debug log to clipboard
   - **Close**: Hide the debug panel

### No After Effects Info Panel Required

**Important**: There is no "After Effects Info panel" - all debugging should use the plugin's built-in debug panel. This ensures:
- All debug output is captured in one place
- Debug info is formatted and readable
- Easy to copy/paste debug information
- No need to search through AE's scattered debugging tools

### Example: Debugging iPhone UI Component Issues

When iPhone UI component adds wrong layer:

1. **Click 🐛 Debug button** to open debug panel
2. **Try adding iPhone UI component**
3. **Debug panel will show**:
   ```
   === iPhone UI COMPONENT DEBUG ===
   Looking for composition: iPhone 14 UI
   Found: 'Dynamic Island' (type: Other)
   Found: 'iPhone 14 UI' (type: CompItem)
   ✅ MATCH FOUND: iPhone 14 UI
   ```
4. **If it shows wrong matches**, you'll see exactly what's being found vs. what's expected

## Troubleshooting
- If extension doesn't appear: restart AE completely
- If changes don't show: verify you're using "AirBoard Dev" not "AirBoard"
- If issues persist: run `./dev-sync.sh` again
- **Chrome DevTools not showing extension**: Make sure debug mode is enabled and restart AE
- **Always use the plugin debug panel** instead of AE console for debugging