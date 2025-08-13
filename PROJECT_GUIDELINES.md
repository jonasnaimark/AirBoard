# Project Guidelines - AirBoard Plugin

## Project Overview

**Name:** AirBoard  
**Type:** After Effects CEP Extension  
**Purpose:** Automate repetitive motion design tasks  
**Target:** After Effects CC 2020+  
**Distribution:** Internal team use via ZXP installer  

## Project Structure

### Directory Layout
```
airboard-plugin/
├── CSXS/                      # CEP Configuration
│   └── manifest.xml           # Extension manifest
├── jsx/                       # ExtendScript files
│   ├── main.jsx              # Core entry point
│   └── modules/              # Feature modules
│       ├── deviceArtboards.jsx
│       ├── gesturePresets.jsx
│       ├── effectPresets.jsx
│       └── templatePresets.jsx
├── client/                    # Panel UI
│   ├── index.html            # Panel HTML
│   ├── js/                   # JavaScript
│   │   ├── main.js          # UI controller
│   │   └── modules/         # UI modules
│   └── css/                 # Styles
│       └── styles.css       # Panel styling
├── assets/                   # Resources
│   ├── devices/             # Device specifications
│   ├── gestures/            # Gesture presets
│   ├── effects/             # Effect presets
│   ├── templates/           # Template comps
│   └── icons/               # UI icons
├── build/                    # Build scripts
│   ├── build.sh             # ZXP packaging
│   └── sign.sh              # Certificate signing
├── dist/                     # Distribution files
├── tests/                    # Test files
├── docs/                     # Documentation
├── .debug                    # Debug configuration
├── .gitignore
├── package.json
├── README.md
├── CHANGELOG.md
├── DEVELOPMENT_RULES.md
├── VERSION_GUIDE.md
└── PROJECT_GUIDELINES.md
```

## Coding Standards

### ExtendScript (JSX) Standards

#### Naming Conventions
```javascript
// Constants: UPPER_SNAKE_CASE
var MAX_DEVICE_WIDTH = 1920;
var DEFAULT_SCALE = "2x";

// Variables: camelCase
var deviceWidth = 393;
var currentScale = 2;

// Functions: camelCase, verb prefix
function createArtboard() {}
function applyEffect() {}
function validateInput() {}

// Prefixes for clarity
var NAMING = {
    devicePrefix: "Device_",
    gesturePrefix: "Gesture_",
    effectPrefix: "FX_",
    templatePrefix: "Template_"
};
```

#### Function Structure
```javascript
/**
 * Creates an iPhone artboard with device frame
 * @param {string} scale - Scale factor (2x, 3x, 4x)
 * @param {string} orientation - portrait or landscape
 * @returns {CompItem} The created composition
 */
function createiPhoneArtboard(scale, orientation) {
    // 1. Validate inputs
    if (!scale || !orientation) {
        throw new Error("Scale and orientation are required");
    }
    
    // 2. Begin undo group
    app.beginUndoGroup("Create iPhone Artboard");
    
    try {
        // 3. Main logic
        var comp = app.project.items.addComp(/*...*/);
        
        // 4. Return result
        return comp;
        
    } catch(e) {
        // 5. Error handling
        alert("Error: " + e.toString());
        return null;
        
    } finally {
        // 6. Cleanup
        app.endUndoGroup();
    }
}
```

#### Error Handling Pattern
```javascript
// Always wrap AE operations in try-catch
try {
    app.beginUndoGroup("Operation Name");
    // Perform operations
} catch(e) {
    alert("Error in Operation: " + e.toString());
    // Log for debugging
    $.writeln("ERROR: " + e.toString());
} finally {
    app.endUndoGroup();
}
```

### JavaScript (Panel UI) Standards

#### Module Pattern
```javascript
// js/modules/deviceModule.js
var DeviceModule = (function() {
    'use strict';
    
    // Private variables
    var _devices = [];
    
    // Private methods
    function _validateDevice(device) {
        return device && device.width && device.height;
    }
    
    // Public API
    return {
        init: function() {
            // Initialization
        },
        
        addDevice: function(device) {
            if (_validateDevice(device)) {
                _devices.push(device);
            }
        },
        
        getDevices: function() {
            return _devices.slice(); // Return copy
        }
    };
})();
```

#### Event Handling
```javascript
// Consistent event binding
document.addEventListener('DOMContentLoaded', function() {
    // Initialize modules
    DeviceModule.init();
    
    // Bind UI events
    document.getElementById('addDeviceBtn').addEventListener('click', handleAddDevice);
});

function handleAddDevice(event) {
    event.preventDefault();
    // Handle the event
}
```

### CSS Standards

#### Naming Convention (BEM)
```css
/* Block */
.panel {}

/* Element */
.panel__header {}
.panel__content {}
.panel__footer {}

/* Modifier */
.panel--dark {}
.panel__header--collapsed {}

/* Component example */
.device-selector {}
.device-selector__dropdown {}
.device-selector__button {}
.device-selector__button--active {}
```

#### Organization
```css
/* 1. Variables */
:root {
    --primary-color: #4A90E2;
    --text-color: #333;
    --border-radius: 4px;
}

/* 2. Base styles */
body {
    font-family: 'Adobe Clean', sans-serif;
    font-size: 12px;
}

/* 3. Components */
.panel {
    /* Component styles */
}

/* 4. Utilities */
.u-hidden {
    display: none;
}
```

## UI/UX Guidelines

### Panel Design Principles

1. **Consistency with After Effects**
   - Match AE's dark theme
   - Use similar spacing and sizing
   - Follow Adobe's design language

2. **Information Hierarchy**
   - Most used features at top
   - Group related functions
   - Progressive disclosure for advanced options

3. **Visual Feedback**
   - Hover states for interactive elements
   - Loading indicators for long operations
   - Success/error messages

### Component Specifications

```css
/* Button standards */
.button {
    height: 24px;
    padding: 0 12px;
    border-radius: 3px;
    font-size: 11px;
}

/* Dropdown standards */
.dropdown {
    height: 24px;
    min-width: 120px;
}

/* Section spacing */
.section {
    margin-bottom: 16px;
    padding: 12px;
}
```

## Feature Implementation Guidelines

### Adding New Device Presets

1. **Define device specs in JSON:**
```json
{
    "id": "iphone14",
    "name": "iPhone 14",
    "width": 393,
    "height": 852,
    "statusBarHeight": 59,
    "homeIndicatorHeight": 34,
    "cornerRadius": 47,
    "scales": ["2x", "3x", "4x"]
}
```

2. **Create device function:**
```javascript
function createiPhone14Artboard(scale, orientation) {
    // Implementation following standard pattern
}
```

3. **Register in UI:**
```javascript
DeviceModule.registerDevice('iphone14', createiPhone14Artboard);
```

### Adding New Gestures

1. **Define gesture parameters:**
```javascript
var tapGesture = {
    name: "Tap",
    duration: 0.3,
    easing: [0.25, 0.1, 0.25, 1.0],
    properties: ['scale', 'opacity']
};
```

2. **Implement animation:**
```javascript
function createTapAnimation(layer, params) {
    // Set keyframes
    // Apply easing
    // Return animated layer
}
```

### Adding New Effects

1. **Define effect preset:**
```javascript
var elevationPresets = {
    "elevation_1": {
        blur: 4,
        opacity: 15,
        distance: 2
    }
};
```

2. **Implement application:**
```javascript
function applyElevation(layer, level) {
    var preset = elevationPresets["elevation_" + level];
    // Apply effect with preset values
}
```

## Testing Guidelines

### Manual Testing Checklist

#### Before Each Commit
- [ ] Panel loads without errors
- [ ] All buttons respond to clicks
- [ ] Dropdowns populate correctly
- [ ] Functions execute without errors
- [ ] Undo works properly

#### Device Testing
- [ ] Creates composition with correct dimensions
- [ ] Applies proper scale factor
- [ ] Includes all device elements
- [ ] Handles orientation correctly

#### Gesture Testing
- [ ] Animation plays correctly
- [ ] Timing matches specification
- [ ] Easing applied properly
- [ ] Works with selected layers

#### Effect Testing
- [ ] Effects apply to selected layers
- [ ] Values match presets
- [ ] Multiple selections work
- [ ] Undo groups properly

### Test File Structure
```
tests/
├── test-comps/           # Test compositions
├── test-footage/         # Sample footage
└── test-scripts/         # Automated tests
    ├── device-tests.jsx
    ├── gesture-tests.jsx
    └── effect-tests.jsx
```

## Performance Guidelines

### ExtendScript Optimization

1. **Minimize comp updates:**
```javascript
// Bad: Updates comp multiple times
layer.position.setValue([100, 100]);
layer.scale.setValue([50, 50]);
layer.opacity.setValue(75);

// Good: Batch operations
app.beginSuppressDialogs();
layer.position.setValue([100, 100]);
layer.scale.setValue([50, 50]);
layer.opacity.setValue(75);
app.endSuppressDialogs();
```

2. **Cache property access:**
```javascript
// Bad: Accesses property multiple times
for (var i = 0; i < comp.numLayers; i++) {
    comp.layer(i + 1).enabled = true;
}

// Good: Cache reference
var layers = comp.layers;
for (var i = 1; i <= layers.length; i++) {
    layers[i].enabled = true;
}
```

3. **Use appropriate data structures:**
```javascript
// Use objects for lookups
var deviceMap = {
    "iphone14": deviceSpecs.iphone14,
    "ipad": deviceSpecs.ipad
};

// Instead of arrays for searching
var device = deviceMap[deviceId]; // O(1) vs O(n)
```

## Security & Validation

### Input Validation
```javascript
function validateScale(scale) {
    var validScales = ["2x", "3x", "4x"];
    if (validScales.indexOf(scale) === -1) {
        throw new Error("Invalid scale: " + scale);
    }
    return true;
}
```

### Path Safety
```javascript
// Always use forward slashes for paths
function normalizePath(path) {
    return path.replace(/\\/g, '/');
}

// Validate file extensions
function validateExtension(file, allowedExts) {
    var ext = file.name.split('.').pop().toLowerCase();
    return allowedExts.indexOf(ext) !== -1;
}
```

## Documentation Standards

### Code Comments

#### Function Documentation
```javascript
/**
 * Brief description of what the function does
 * 
 * @param {Type} paramName - Description
 * @returns {Type} Description of return value
 * @throws {Error} When this error occurs
 * 
 * @example
 * var result = functionName("value");
 */
```

#### Inline Comments
```javascript
// Use single-line comments for brief explanations
var scale = parseInt(scaleStr.replace('x', '')); // Extract numeric value

/*
 * Use multi-line comments for longer explanations
 * that need multiple lines to properly describe
 * the logic or approach being used.
 */
```

### User Documentation

Create clear documentation for:
1. Installation instructions
2. Feature descriptions
3. Keyboard shortcuts
4. Troubleshooting guide
5. FAQ section

## Debugging Guidelines

### Debug Mode Setup

1. **Enable debug mode in .debug file:**
```xml
<?xml version="1.0" encoding="UTF-8"?>
<ExtensionList>
    <Extension Id="com.yourteam.airboard.panel">
        <HostList>
            <Host Name="AEFT" Port="8088"/>
        </HostList>
    </Extension>
</ExtensionList>
```

2. **Use Chrome DevTools:**
   - Navigate to `http://localhost:8088`
   - Debug panel JavaScript
   - Inspect network requests

3. **ExtendScript debugging:**
```javascript
// Use $.writeln() for console output
$.writeln("Debug: " + variable);

// Use breakpoints in ExtendScript Debugger
$.bp(); // Adds breakpoint
```

## Build & Distribution

### Build Process

1. **Update version numbers** (see VERSION_GUIDE.md)

2. **Run build script:**
```bash
./build/build.sh v1.0.0
```

3. **Sign extension:**
```bash
./build/sign.sh dist/AirBoard_v1.0.0.zxp
```

4. **Test installation:**
   - Use ZXP installer
   - Verify in After Effects
   - Check all features

### Distribution Checklist
- [ ] Version numbers updated
- [ ] CHANGELOG.md updated
- [ ] Tests passing
- [ ] ZXP signed
- [ ] Installation tested
- [ ] Documentation current

---

*Last Updated: [Current Date]*
*Guidelines Version: 1.0.0*
