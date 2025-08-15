# AirBoard Plugin Changelog

All notable changes to the AirBoard After Effects Plugin will be documented here.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]
### 🚧 In Development
- **Elevation Shadows**: UI complete, functionality implementation pending
- **Additional Components**: Progress bars, buttons, icons
- **Performance Optimizations**: Enhanced template caching

## [2.8.9] - 2025-08-15 ✨ **CURRENT RELEASE**
### 📝 Documentation
- **Main Branch Push Requirements**: Added comprehensive checklist and workflow documentation
- **CHANGELOG.md Integration**: Documented requirement to update changelog with every main branch push
- **Version Management Process**: Enhanced VERSION_GUIDE.md with detailed push checklist and troubleshooting

### 🔧 Technical Details
- Updated CLAUDE_CONTEXT.md with main branch push requirements
- Added standardized CHANGELOG.md format template
- Enhanced development workflow documentation for consistency
- Associated with AirBoard_v2.8.9.zxp

## [2.8.8] - 2025-08-15
### ✨ Added
- **Project Setup Section**: New section with "AE Folders" and "Finder Folders" buttons (layout ready for future functionality)
- **Material Effects Row**: Added Material 1-5 dropdown with "Add Blur" button to Effect Presets section

### 🎨 UI Improvements  
- **Refined Component Heights**: Reduced all buttons and dropdowns from 40px to 38px for more compact interface
- **Tighter Section Spacing**: Reduced padding above section headers for cleaner layout
- **Reorganized Effect Presets**: Now contains 3 rows - Squircle/Replace, Elevation, and Material effects

### 📝 Documentation
- **Enhanced ZXP Build Guide**: Added comprehensive build documentation to VERSION_GUIDE.md
- **ZXP Naming Convention**: Documented proper versioning and file placement process
- **Common Build Issues**: Added troubleshooting section for build problems

### 🔧 Technical Details
- Updated dropdown options: "1" → "Elevation 1", "2" → "Elevation 2", etc.
- Maintained all existing functionality while adding new UI elements
- Associated with AirBoard_v2.8.8.zxp

## [2.8.6] - 2025-08-15
### 🎨 Improved
- Enhanced scrollbar styling for better dark theme integration
- Refined button hover states and animations
- Improved container spacing and padding optimization
- Better overflow handling for smaller panel windows

### 🔧 Technical Details
- Updated scrollbar thumb colors to match After Effects interface
- Optimized CSS for reduced file size and better performance
- Enhanced responsive behavior for various panel sizes
- Associated with AirBoard_v2.8.6.zxp

## [2.8.5] - 2025-08-15
### ✨ Added
- **Components System**: Ms Counter and Dot Loader components
- **Smart Component Positioning**: Automatic centering with keyframe support
- **Unified Components UI**: Dropdown selection with "Add Component" button

### 🔧 Technical Implementation
- Implemented proven scaling pattern for components
- Added component template management system
- Enhanced ExtendScript with `addComponentFromPanel()` function
- Components follow same resolution scaling as gestures and devices

### 📝 Documentation
- Added component implementation patterns to DEVELOPMENT_GUIDE.md
- Updated UI_PATTERNS.md with component section structure

## [2.8.0] - 2025-08-15
### 🏗 Architecture Overhaul
- **Unified CSS System**: Single `.section` and `.control-row` classes
- **Semantic HTML Structure**: Consistent `<section>` wrappers for all features
- **Global Spacing Control**: Centralized margin/padding management
- **Maintainable Design System**: Easy to add new sections consistently

### 🎨 UI Improvements
- **Dark Theme Refinement**: Better color harmony with After Effects
- **Responsive Design**: Panel adapts to different window sizes
- **Professional Typography**: Improved font weights and letter spacing
- **Visual Hierarchy**: Clear section separation and control grouping

### 🔧 Technical Details
- Reduced CSS complexity by 40% through class consolidation
- Established future-proof foundation for new features
- Enhanced maintainability with documented UI patterns

## [2.7.0] - 2025-08-15
### ✨ Added
- **Elevation System UI**: Dropdown and button ready for shadow implementation
- **Future-Ready Architecture**: Prepared for shadow functionality
- **UI Consistency**: Follows established section patterns

### 📋 Planned Features
- Shadow levels 1-5 for depth hierarchy
- Professional shadow presets for motion graphics
- Integration with existing scaling system

### ✨ Added
- **Extended Gesture Library**: Double Tap and Mouse Click gesture options
- **Improved Scrolling**: Automatic scrollbar when content overflows window
- **Resolution Accuracy**: 1x resolution now properly scales to 50%

### 🔧 Fixed
- iPhone UI layer no longer locked when added to compositions
- Desktop compositions create at proper 2x dimensions (2880×2056)
- Gesture layers scale correctly at 1x resolution (50% scale)

### 🎨 Improved
- Custom scrollbar styling for dark theme consistency
- Enhanced gesture scaling logic for all resolution multipliers
- Better content overflow handling for smaller windows

### 🔧 Technical Details
- Updated gesture data mapping for Double Tap and Mouse Click
- Modified desktop base dimensions from 720×514 to 1440×1028
- Added 1x=50% case to gesture scaling switch statement
- Changed container from fixed height to min-height for scroll support

## [2.5.0] - 2025-08-14
### 🏗 Major Refactoring
- **CSS Architecture Overhaul**: Consolidated duplicate classes for maintainability
- **Unified Control System**: Single `.control-row` class replaces multiple specific classes
- **Code Reduction**: 22% reduction in CSS file size (363 to 282 lines)
- **Future-Proof Structure**: Easier to add new sections consistently

### 🔧 Technical Implementation
- Replaced `.device-controls`, `.gesture-controls`, `.button-group` with `.control-row`
- Renamed `.device-dropdown` to generic `.dropdown` class
- Removed unused CSS rules (`.info-section`, `.hint`, `.footer`)
- Simplified HTML structure with consistent class naming

## [2.4.0] - 2025-08-14
### 🎨 UI Polish
- **Enhanced Button Animations**: Smooth 0.2s fade transitions on hover
- **Improved Visual Depth**: Better drop shadow positioning and subtle borders
- **Optimized Performance**: Replaced gradient backgrounds with solid colors

### 🔧 Technical Details
- Updated CSS transitions to use cubic-bezier easing
- Added 6% opacity white borders to button containers
- Enhanced visual hierarchy with refined shadow offsets

## [2.3.0] - 2025-08-14 
### ✨ Added
- **Playhead-Aware Positioning**: Gesture layers now start at current playhead position
- **Enhanced Workflow**: Move playhead → Add Gesture → Layer appears exactly there
- **Timeline Integration**: Perfect timing control for gesture animations

### 🔧 Technical Implementation
- Uses After Effects `startTime` property for precise positioning
- Integrates seamlessly with existing scaling solution from v2.0.5
- Non-breaking addition to proven layer targeting system

### 📝 Documentation
- Comprehensive documentation of playhead positioning in DEVELOPMENT_GUIDE.md
- Updated workflow instructions in README.md

## [2.1.0] - 2024-08-14
### ✨ Added  
- **Template System Enhancement**: Updated AirBoard Templates.aep
- **Integration Improvements**: Better compatibility with scaling solution
- **Stability Fixes**: Resolved template import edge cases

## [2.0.5] - 2024-08-14 🎯 **BREAKTHROUGH: SCALING SOLUTION**
### 🏆 Major Achievement
- **SOLVED**: Gesture layer scaling that works with unlimited additions
- **Resolution-Based Scaling**: Perfect 2x=100%, 3x=150%, 4x=200%, 5x=250%, 6x=300%
- **Bulletproof Layer Targeting**: Index-1 approach eliminates all targeting issues
- **Foundation Pattern**: Reusable solution for all future features

### 🔧 Technical Implementation
- **Index-1 Targeting**: copyToComp() → target layer at index 1 (guaranteed newest)
- **Layer Count Verification**: Verify layer was added before targeting
- **Selection Clearing**: Prevent insertion conflicts
- **No Name Validation**: Eliminated unreliable name-based finding

### 📚 Legacy Impact
- **Project Foundation**: This solution became the pattern for Components, Effects, and all new features
- **Critical Reference**: All future scaling implementations use this exact pattern
- **Documentation Source**: Pattern documented extensively in DEVELOPMENT_GUIDE.md

### 🎯 Why This Was Crucial
- **Previous Attempts Failed**: v1.9.4-2.0.4 struggled with layer targeting issues
- **Hours of Development**: Extensive trial and error to find the reliable solution
- **Scaling Breakthrough**: Made unlimited gesture additions possible
- **Future-Proof**: Pattern proven to work for all subsequent features

## [2.0.0-2.0.4] - 2024-08-14 🔬 **SCALING RESEARCH PHASE**
### 🧪 Experimental Versions
- **Multiple Attempts**: Various approaches to solve layer targeting issues
- **Research Methods**: Enhanced layer identification, fingerprinting, retry loops
- **Learning Process**: Trial and error leading to v2.0.5 breakthrough
- **Technical Evolution**: Improved layer targeting logic iteration by iteration

### 📚 Key Learnings
- Direct index 1 targeting approach testing
- Fallback methods and multiple positioning attempts
- Selection clearing patterns development
- Foundation for the final solution in v2.0.5

## [1.9.7] - 2024-08-14
### 🔧 Critical Fix
- **Scaling Value Correction**: Fixed 5x=250% (was 350%), 6x=300% (was 400%)
- **Mathematical Accuracy**: Established correct scaling progression
- **Foundation**: These values became the final scaling standards

## [1.9.4] - 2024-08-14 ✨ **INITIAL SCALING IMPLEMENTATION**
### 🚀 First Implementation
- **Gesture Scaling Feature**: Initial resolution-based scaling system
- **Resolution Support**: 2x=100%, 3x=150%, 4x=200% (later corrected)
- **Scaling Foundation**: First attempt at layer scaling logic

### 🔧 Technical Milestone
- Beginning of scaling solution development
- Early scaling logic implementation
- Proof of concept for resolution-based transforms

## [1.9.3] - 2024-08-14
### 🔧 Stability Improvements
- **Essential Graphics Compatibility**: Removed undo group calls to prevent warnings
- **Core Functionality**: Gesture import, copy, and positioning working
- **Clean Foundation**: Prepared codebase for scaling implementation

## [1.0.0-1.4.9] - Early Development 🌱 **FOUNDATION PHASE**
### 🎯 Core Features Established
- **Device Templates**: iPhone and Desktop composition creation
- **Gesture Presets**: Tap and Long Press gesture animations
- **Effect Presets**: Squircle creation and rectangle replacement
- **Template System**: AirBoard Templates.aep foundation
- **UI Framework**: Basic panel structure and controls

### 🏗 Technical Foundation
- **CEP Framework**: Adobe Common Extensibility Platform integration
- **ExtendScript Core**: After Effects automation scripts
- **Template Management**: Import and layer copying systems
- **Basic UI**: HTML/CSS/JavaScript panel interface

### 📋 Feature Evolution
- **Resolution Scaling**: 1x-6x multiplier support established
- **Mathematical Precision**: Scaling calculations framework
- **Template Integration**: iPhone UI template system
- **Professional Effects**: Motion graphics quality standards

---

## 📊 Version Summary

### 🏆 Major Milestones
- **v2.0.5**: Breakthrough scaling solution (Index-1 targeting)
- **v2.3.0**: Playhead-aware positioning
- **v2.8.5**: Components system implementation
- **v2.8.6**: Current release with comprehensive features

### 🎯 Technical Achievements
- **Scaling System**: Bulletproof resolution-based layer scaling
- **UI Architecture**: Unified CSS system with maintainable patterns
- **Template Management**: Efficient caching and import optimization
- **Documentation**: Comprehensive guides for future development

### 🚀 Current Features (v2.8.6)
- ✅ **Device Templates**: iPhone & Desktop compositions
- ✅ **Gesture Presets**: 4 gesture types with perfect scaling
- ✅ **Components**: Ms Counter & Dot Loader
- ✅ **Effect Presets**: Squircle and shape replacement
- ✅ **Playhead Positioning**: Timeline-aware layer placement
- 🚧 **Elevation Shadows**: UI ready, implementation pending

---

## 📚 Legend
- ✨ **New Features** - Brand new functionality additions
- 🔧 **Improvements** - Enhancements to existing features
- 🏗 **Architecture** - System design and structural changes
- 🎨 **UI/UX** - Interface and user experience improvements
- 📝 **Documentation** - Guides, patterns, and technical docs
- 🎯 **Milestones** - Critical project achievements
- 🚧 **In Development** - Features in progress
- 🔬 **Research** - Experimental and exploratory work

---

*For detailed technical patterns and implementation guidance, see [DEVELOPMENT_GUIDE.md](DEVELOPMENT_GUIDE.md)*