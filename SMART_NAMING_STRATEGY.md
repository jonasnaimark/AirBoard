# 🎯 Smart Layer Naming Strategy

## 🤔 **The Real Question: What Do Motion Designers Actually Want?**

### **Current Reality:**
- Layers named: "Rectangle 1", "Text 2", "Ellipse 3" 
- Designer spends time manually renaming to: "Login Button", "App Icon", "Background"
- Color coding is manual and inconsistent

### **Ideal Reality:**
- Layers auto-named: "Login Button", "Profile Icon", "Screen Background"
- Consistent, human-readable names
- Logical color coding that helps visual organization

## 🎨 **Human-Friendly Naming Approach:**

### **Instead of Technical:**
```
❌ Technical: "btn-login-200x44"
❌ Technical: "rect-primary-shadow"  
❌ Technical: "txt-heading-32px"

✅ Natural: "Login Button"
✅ Natural: "App Icon" 
✅ Natural: "Welcome Title"
```

### **Smart Content Detection:**

#### **Text Layers - Use Actual Content:**
```javascript
Text: "Sign In" → "Sign In Button" (if has background shape)
Text: "Welcome Back" → "Welcome Title" (if large font)
Text: "john@email.com" → "Email Field" (if email pattern)
Text: "$29.99" → "Price Label" (if currency pattern)
Text: "..." → "Menu Button" (if ellipsis)
```

#### **Shapes - Describe Purpose, Not Specs:**
```javascript
Rectangle + small + rounded → "Button"
Rectangle + large + no effects → "Background"  
Rectangle + input-sized → "Text Field"
Circle + small → "Icon Background"
Circle + tiny → "Status Dot"
```

#### **Images - Clean & Contextual:**
```javascript
"home-icon.png" → "Home Icon"
"profile-pic.jpg" → "Profile Photo"  
"background.jpg" → "Background Image"
"logo.svg" → "App Logo"
```

## 📏 **How Granular Can We Get?**

### **Level 1: Basic Smart Naming (80% accuracy)**
- Text content extraction
- Basic shape purpose (button, background, field)
- Image filename cleanup

### **Level 2: Context-Aware (90% accuracy)**
- Button detection (shape + text + size)
- Icon identification (small, square elements)
- Input field recognition (text + background)
- Navigation element detection

### **Level 3: Semantic Understanding (95% accuracy)**
- Screen context analysis (login, profile, settings)
- Element relationship understanding (grouped items)
- Typography hierarchy (title, subtitle, body, caption)
- Interactive element identification

## 🎯 **Practical Detection Examples:**

### **Button Detection:**
```javascript
// High confidence indicators:
✅ Rectangle shape + text layer inside/nearby + typical button size (100-300px wide, 30-60px tall)
✅ Has drop shadow or stroke effects
✅ Text contains action words: "Sign In", "Continue", "Save", "Cancel"

// Result: "Sign In Button", "Save Button", "Cancel Button"
```

### **Icon Detection:**
```javascript  
// High confidence indicators:
✅ Small (under 50px), roughly square
✅ Simple shape or imported graphic
✅ Positioned in typical icon locations (corners, navigation)

// Result: "Menu Icon", "Search Icon", "Settings Icon" (based on shape/filename)
```

### **Input Field Detection:**
```javascript
// High confidence indicators:
✅ Rectangle + thin stroke/subtle fill + text layer
✅ Typical input dimensions (wide, short height)
✅ Placeholder text patterns: "Enter email", "Password", etc.

// Result: "Email Field", "Password Field", "Search Field"
```

### **Typography Hierarchy:**
```javascript
// Size + weight + position analysis:
Large (>24px) + Bold + Top → "Page Title"
Medium (18-24px) + Bold → "Section Header"  
Medium + Regular → "Body Text"
Small (<14px) → "Caption Text"

// Content-aware:
"Welcome Back" → "Welcome Title"
"Enter your email" → "Email Instructions"
```

## 🌈 **Smart Color Coding Strategy:**

### **Purpose-Based Colors:**
```javascript
🔵 Interactive Elements: Buttons, links, controls
🟢 Content: Text, headings, readable content
🟠 Media: Images, videos, graphics, icons
🟣 Effects: Adjustments, overlays, decorative
🔘 Structure: Backgrounds, containers, dividers
```

### **Context Sensitivity:**
```javascript
// Same rectangle, different contexts:
Rectangle + Text + Shadow → 🔵 "Login Button" (Interactive)
Rectangle + Large + No effects → 🔘 "Screen Background" (Structure)  
Rectangle + Stroke only → 🔘 "Text Field Border" (Structure)
```

## 💡 **Accuracy Expectations:**

### **Highly Accurate (95%+):**
- Text content extraction
- Basic shape identification  
- Image filename cleanup
- Size-based categorization

### **Pretty Good (80-90%):**
- Button detection
- Icon identification
- Input field recognition
- Typography hierarchy

### **Contextual Guessing (60-80%):**
- Screen purpose understanding
- Element relationship analysis
- Complex semantic meaning

## 🎯 **Implementation Strategy:**

### **Phase 1: Foundation (Ship First)**
- Clean text content extraction
- Basic shape purpose detection
- Simple color coding by type
- Image filename improvement

### **Phase 2: Intelligence**  
- Button/icon/field detection
- Typography hierarchy analysis
- Smart grouping suggestions

### **Phase 3: Context**
- Screen-level understanding
- Relationship analysis
- Advanced semantic naming

## 🤔 **Key Questions for You:**

1. **What naming style do you prefer?**
   - "Login Button" vs "Button - Login" vs "Btn Login"

2. **How important is brevity vs clarity?**
   - "Sign In Button" vs "Sign In" vs "Button"

3. **What's your current manual naming convention?**
   - This helps us match your existing workflow

4. **What layer organization pain points matter most?**
   - Finding specific elements? Understanding hierarchy? Color coding?

**The goal: Save you time while feeling natural, not robotic!**