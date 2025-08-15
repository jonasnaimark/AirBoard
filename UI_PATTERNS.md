# AirBoard UI Patterns Guide

**Consistent UI development patterns for the AirBoard After Effects plugin**

## 🎨 Design Philosophy

The AirBoard UI follows a **unified, maintainable design system** that ensures:
- **Consistency**: All sections look and behave identically
- **Maintainability**: Global changes can be made in one place
- **Scalability**: New sections can be added easily
- **Accessibility**: Dark theme matches After Effects interface

## 🏗 Core HTML Structure

### Section Layout Pattern

**Every interactive section follows this exact structure:**

```html
<section class="section">
    <h2 class="section-header">Section Name</h2>
    <div class="control-row">
        <select id="sectionType" class="dropdown">
            <option value="option1">Option 1</option>
            <option value="option2">Option 2</option>
        </select>
        <button id="addSection" class="main-button">Add Section</button>
    </div>
</section>
```

### Current Sections Structure

```html
<div class="container">
    <!-- Device Templates -->
    <section class="section">
        <h2 class="section-header">Device Templates</h2>
        <div class="control-row">...</div>
        <div class="control-row">...</div> <!-- Resolution input -->
    </section>
    
    <!-- Gesture Presets -->
    <section class="section">
        <h2 class="section-header">Gesture Presets</h2>
        <div class="control-row">...</div>
    </section>
    
    <!-- Components -->
    <section class="section">
        <h2 class="section-header">Components</h2>
        <div class="control-row">...</div>
    </section>
    
    <!-- Effect Presets -->
    <section class="section">
        <h2 class="section-header">Effect Presets</h2>
        <div class="control-row">...</div>
    </section>
    
    <!-- Elevation -->
    <section class="section">
        <h2 class="section-header">Elevation</h2>
        <div class="control-row">...</div>
    </section>
</div>
```

## 🎯 CSS Class System

### Unified Classes

**Use ONLY these classes for consistency:**

```css
/* Container */
.container {
    padding: 6px 16px 16px 16px; /* Top reduced for tight fit */
}

/* All sections */
.section {
    margin-bottom: 16px; 
    padding-bottom: 2px;
    border-bottom: 1px solid #3a3a3a;
}

/* All interactive rows */
.control-row {
    display: flex;
    gap: 10px;
    margin-bottom: 10px; /* CRITICAL: Change this to affect ALL rows */
    align-items: stretch;
}

/* All section headers */
.section-header {
    color: #ffffff;
    font-size: 12px;
    font-weight: 500;
    margin: 0 0 10px 0;
    letter-spacing: 0.5px;
}

/* All buttons */
.main-button {
    height: 40px;
    background-color: #2f2f2f;
    border: 1px solid rgba(255, 255, 255, 0.08);
    color: #cccccc;
    font-size: 12.5px;
    border-radius: 6px;
}

/* All dropdowns */
.dropdown {
    height: 40px;
    background-color: #222222;
    border: 1px solid rgba(255, 255, 255, 0.08);
    color: #cccccc;
    font-size: 12.5px;
    border-radius: 6px;
}
```

## ➕ Adding New Sections

### Step-by-Step Process

#### 1. Add HTML Section
```html
<!-- New Feature Section -->
<section class="section">
    <h2 class="section-header">New Feature</h2>
    <div class="control-row">
        <select id="newFeatureType" class="dropdown">
            <option value="feature1">Feature Option 1</option>
            <option value="feature2">Feature Option 2</option>
            <option value="feature3">Feature Option 3</option>
        </select>
        <button id="addNewFeature" class="main-button">Add New Feature</button>
    </div>
</section>
```

#### 2. Add JavaScript Event Handler
```javascript
// Add New Feature button handler
var addNewFeatureButton = document.getElementById('addNewFeature');
addNewFeatureButton.addEventListener('click', function() {
    console.log('Add New Feature clicked');
    
    // Get values
    var featureType = document.getElementById('newFeatureType').value;
    var resolutionMultiplier = parseInt(document.getElementById('resolutionMultiplier').value);
    
    // UI feedback
    addNewFeatureButton.disabled = true;
    addNewFeatureButton.textContent = 'Adding...';
    
    // Extension path
    var setPathScript = 'var extensionRoot = "' + extensionPath.replace(/\\/g, '\\\\') + '";';
    csInterface.evalScript(setPathScript);
    
    // Execute ExtendScript
    var script = 'addNewFeatureFromPanel("' + featureType + '", ' + resolutionMultiplier + ')';
    csInterface.evalScript(script, function(result) {
        // Reset button
        addNewFeatureButton.disabled = false;
        addNewFeatureButton.textContent = 'Add New Feature';
    });
});
```

#### 3. Implement ExtendScript Function
```javascript
function addNewFeatureFromPanel(featureType, multiplier) {
    // Follow the PROVEN PATTERN from DEVELOPMENT_GUIDE.md
    // Include: template management, scaling logic, playhead positioning
}
```

### Special Control Types

#### Two-Button Layout (like Effect Presets)
```html
<div class="control-row">
    <button id="action1" class="main-button">Action 1</button>
    <button id="action2" class="main-button">Action 2</button>
</div>
```

#### Custom Input Layout (like Resolution Input)
```html
<div class="control-row">
    <label for="customInput" class="resolution-label">Custom Label</label>
    <div class="number-input-container">
        <!-- Custom input controls -->
    </div>
</div>
```

## 🎛 Control Patterns

### Dropdown Options

**Keep options concise and descriptive:**

```html
<!-- Good: Clear, descriptive options -->
<select id="componentType" class="dropdown">
    <option value="timer">Ms Counter</option>
    <option value="dot-loader">Dot Loader</option>
</select>

<!-- Good: Simple numeric options -->
<select id="elevationType" class="dropdown">
    <option value="1">1</option>
    <option value="2">2</option>
    <option value="3">3</option>
</select>
```

### Button Text Guidelines

**Use consistent, action-oriented text:**

```html
<!-- Pattern: Action + Object -->
<button class="main-button">Add Gesture</button>
<button class="main-button">Add Component</button>
<button class="main-button">Add Shadow</button>

<!-- Pattern: Action + Description -->
<button class="main-button">Make Comp</button>
<button class="main-button">Replace Rect</button>

<!-- Loading states -->
addButton.textContent = 'Adding...';   // During operation
addButton.textContent = 'Loading...';  // During template import
```

## 🎨 Visual Consistency

### Spacing Hierarchy

```
Container padding: 6px (top) 16px (sides)
├── Section margin-bottom: 16px
├── Section padding-bottom: 2px
├── Section header margin-bottom: 10px  
└── Control row margin-bottom: 10px ← CRITICAL SPACING CONTROL
```

### Color Palette

```css
/* Backgrounds */
--body-bg: #262626
--button-bg: #2f2f2f
--input-bg: #222222
--container-bg: inherit

/* Borders */
--section-border: #3a3a3a
--button-border: rgba(255, 255, 255, 0.08)

/* Text */
--primary-text: #ffffff
--secondary-text: #cccccc

/* Scrollbar */
--scrollbar-thumb: #3a3a3a
--scrollbar-thumb-hover: #4a4a4a
```

## 📱 Responsive Behavior

### Button Text Adaptation

```css
/* Responsive text for space-constrained buttons */
.main-button .short-text {
    display: none;
}

@media (max-width: 237px) {
    .main-button .full-text {
        display: none;
    }
    
    .main-button .short-text {
        display: inline;
    }
}
```

```html
<!-- Implementation -->
<button id="createSquircle" class="main-button">
    <span class="full-text">Add Squircle</span>
    <span class="short-text">Squircle</span>
</button>
```

## 🔧 Global Modifications

### Changing Spacing Throughout Interface

**To modify spacing globally:**

```css
/* Change this ONE value to affect ALL interactive rows */
.control-row {
    margin-bottom: 10px; /* Modify this */
}

/* Change this to affect space between sections */
.section {
    margin-bottom: 16px; /* Modify this */
}

/* Change this to affect container edges */
.container {
    padding: 6px 16px 16px 16px; /* Modify these */
}
```

### Adding New Color Themes

```css
/* To create a lighter theme variant */
.theme-light {
    --body-bg: #f0f0f0;
    --button-bg: #e0e0e0;
    --primary-text: #000000;
    /* Apply with class toggle in JavaScript */
}
```

## 🚫 Anti-Patterns (DON'T DO)

### Don't Create Section-Specific Classes
```css
/* BAD: Specific section classes */
.device-templates { margin-bottom: 20px; }
.gesture-presets { margin-bottom: 18px; }
.effect-presets { margin-bottom: 22px; }

/* GOOD: Unified approach */
.section { margin-bottom: 16px; }
```

### Don't Use Inconsistent HTML Structure
```html
<!-- BAD: Different wrapper elements -->
<div class="special-section">
<article class="another-section">

<!-- GOOD: Consistent semantic elements -->
<section class="section">
```

### Don't Skip the Control-Row Pattern
```html
<!-- BAD: Custom flex layouts -->
<div class="my-custom-row">

<!-- GOOD: Unified control pattern -->
<div class="control-row">
```

## ✅ Quality Checklist

Before adding a new section, verify:

- [ ] Uses `<section class="section">` wrapper
- [ ] Has `<h2 class="section-header">` title
- [ ] Uses `<div class="control-row">` for controls
- [ ] Buttons have `class="main-button"`
- [ ] Dropdowns have `class="dropdown"`
- [ ] Consistent spacing with other sections
- [ ] JavaScript follows established event handler pattern
- [ ] ExtendScript implements proven scaling/positioning logic
- [ ] No custom CSS classes created for spacing
- [ ] Responsive behavior considered
- [ ] Loading states implemented
- [ ] Error handling included

## 🎯 Future UI Considerations

### Planned Enhancements
- **Accessibility**: ARIA labels and keyboard navigation
- **Animations**: Micro-interactions for better feedback
- **Themes**: Additional color scheme options
- **Customization**: User-configurable spacing/sizing

### Maintainability Goals
- **Single source of truth**: All spacing controlled by core classes
- **Component system**: Reusable UI components for complex controls
- **Documentation**: Living style guide with visual examples
- **Testing**: Automated UI consistency verification

---

**Remember: The unified class system is the key to maintainability. When in doubt, use the existing patterns rather than creating new ones.**