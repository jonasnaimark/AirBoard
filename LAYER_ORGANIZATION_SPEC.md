# 🎯 Layer Organization System - Specification

## 💡 **Based on Your Feedback:**
- **Style**: "Login Button" (clean, natural language)
- **Accuracy**: 95% simple over 80% magical
- **Problem**: Layer chaos in large comps - bad names, random colors
- **Asset**: PNG imports are well-named (build on this strength)

## 🚀 **The Solution: Simple, Reliable, Visual Organization**

### **🎯 Phase 1: Foundation (Ship This First)**

#### **Smart Naming Rules:**
```javascript
// Text Layers - Use actual content
"Sign In" → "Sign In"
"Welcome Back" → "Welcome Back" 
"Enter email" → "Enter Email"

// Text + Background Shape → Add "Button"
"Sign In" + Rectangle → "Sign In Button"
"Save" + Rounded Rectangle → "Save Button"

// Shapes - Simple purpose detection  
Rectangle + Shadow → "Button"
Rectangle + Large → "Background"
Rectangle + Thin → "Card"
Circle + Small → "Icon"
Circle + Tiny → "Dot"

// Images - Clean filename
"home-icon.png" → "Home Icon"
"profile-pic.jpg" → "Profile Photo"
"background-image.png" → "Background Image"
```

#### **Consistent Color System:**
```javascript
🔵 Blue: Interactive (Buttons, links, controls)
🟢 Green: Content (Text, headings) 
🟠 Orange: Media (Images, icons, graphics)
🟣 Purple: Effects (Adjustments, overlays)
🔘 Gray: Structure (Backgrounds, containers)
```

### **🎛️ The Tool: "Organize Layers" Button**

#### **What It Does:**
1. **Scans all selected layers** (or all layers if none selected)
2. **Applies smart naming** using the rules above
3. **Color codes by type** for instant visual organization
4. **Groups related elements** (optional)
5. **Sorts layers logically** (backgrounds bottom, interactive top)

#### **UI Design:**
```
┌─────────────────────────────────┐
│ Layer Organization              │
├─────────────────────────────────┤
│ [🎯 Organize Selected Layers]   │
│ [🌈 Organize All Layers]        │
│                                 │
│ ☑ Smart Rename                  │
│ ☑ Color Code                    │
│ ☑ Group Similar                 │
│ ☐ Sort by Type                  │
└─────────────────────────────────┘
```

## 📊 **Expected Results:**

### **Before Organization:**
```
❌ Rectangle 1               (default gray)
❌ Text 1                    (default gray)  
❌ home-icon.png             (default gray)
❌ Ellipse 1                 (default gray)
❌ Rectangle 2               (default gray)
```

### **After Organization:**
```
✅ 🔵 Sign In Button         (blue - interactive)
✅ 🟢 Welcome Back           (green - content)
✅ 🟠 Home Icon              (orange - media)  
✅ 🟣 Blur Effect            (purple - effects)
✅ 🔘 Screen Background      (gray - structure)
```

## 🎯 **Detection Logic (95% Accuracy Focus):**

### **High-Confidence Rules Only:**

#### **Button Detection:**
```javascript
✅ Text layer + Rectangle/Rounded Rectangle nearby
✅ Rectangle with text content in name
✅ Typical button size (50-300px wide, 20-60px tall)
✅ Has drop shadow or stroke
→ Result: "[Text Content] Button"
```

#### **Icon Detection:**  
```javascript
✅ Image file with "icon" in filename
✅ Small square/circular shape (under 50px)
✅ SVG or PNG with transparency
→ Result: "[Filename] Icon"
```

#### **Text Classification:**
```javascript
✅ Just use the actual text content
✅ If over 24px → keep as-is (likely title)
✅ If under 12px → keep as-is (likely caption)
→ Result: Actual text content
```

#### **Background Detection:**
```javascript
✅ Large rectangle (>200px in both dimensions)
✅ Low opacity or positioned behind other elements
✅ No effects or simple fill only
→ Result: "Background" or "Screen Background"
```

### **Fallback Rules:**
```javascript
// If we can't detect purpose confidently:
Rectangle → "Rectangle"
Ellipse → "Circle"  
Text → [actual text content]
Image → [cleaned filename]

// Simple but honest - better than wrong guesses
```

## 🌈 **Color Coding System:**

### **Layer Type Colors:**
```javascript
const LAYER_COLORS = {
    // Interactive elements
    button: [0.2, 0.6, 1.0],      // Blue
    interactive: [0.2, 0.6, 1.0], // Blue
    
    // Content
    text: [0.1, 0.7, 0.1],        // Green
    content: [0.1, 0.7, 0.1],     // Green
    
    // Media
    image: [1.0, 0.6, 0.2],       // Orange
    icon: [1.0, 0.6, 0.2],        // Orange
    media: [1.0, 0.6, 0.2],       // Orange
    
    // Effects
    adjustment: [0.8, 0.3, 0.8],  // Purple
    effect: [0.8, 0.3, 0.8],      // Purple
    
    // Structure  
    background: [0.5, 0.5, 0.5],  // Gray
    container: [0.5, 0.5, 0.5],   // Gray
    shape: [0.5, 0.5, 0.5],       // Gray (when uncertain)
}
```

## 🚀 **Implementation Priority:**

### **Phase 1: MVP (Ship First)**
1. **Smart rename** - text content + basic shape detection
2. **Color coding** - by layer type
3. **PNG filename cleanup** - build on your existing strength

### **Phase 2: Polish**  
1. **Grouping** - related elements together
2. **Layer sorting** - logical stacking order
3. **Batch operations** - undo support

### **Phase 3: Advanced**
1. **Custom naming rules** - user preferences
2. **Project templates** - save color schemes
3. **Smart suggestions** - learn from your naming patterns

## 💭 **Key Benefits for Your Workflow:**

✅ **Visual Clarity**: Color-coded layers make large comps manageable
✅ **Logical Names**: Actually helpful instead of "Rectangle 1"  
✅ **Build on Strength**: Leverages your well-named PNG imports
✅ **Simple & Reliable**: 95% accuracy with no confusing edge cases
✅ **Time Saving**: One click organizes entire composition
✅ **Professional Look**: Clean, consistent layer organization

## 🎯 **Success Metrics:**

- **Before**: Hunting through gray "Rectangle 1-50" layers
- **After**: Color-coded, clearly named layers you can find instantly
- **Goal**: Cut layer-finding time by 80% in large compositions

**This solves your exact pain point: large comp organization without over-engineering!**