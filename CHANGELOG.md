# Changelog

All notable changes to AirBoard Plugin will be documented here.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [2.1.9] - 2025-08-14
### 🎨 Improved
- Enhanced button hover animations with smooth 0.2s fade transitions
- Replaced gradient backgrounds with solid colors for smoother animations
- Added subtle white border (6% opacity) to button containers
- Improved drop shadow positioning for better depth perception

### 🔧 Technical Details
- Updated all CSS transitions to use cubic-bezier easing
- Optimized button styling for consistent hover feedback
- Enhanced visual hierarchy with refined shadow offsets

## [2.1.2] - 2024-08-14
### ✨ Added
- ✨ **Playhead positioning**: Gesture layers now start at current playhead position
- 🔧 Enhanced workflow: Move playhead to desired frame, click "Add Gesture", layer appears exactly there
- 📝 Comprehensive documentation of playhead positioning implementation

### 🔧 Fixed
- 🔧 Template file updates in AirBoard Templates.aep
- 🔧 Integration with existing scaling solution from v2.0.5

### 🔧 Technical Details
- Uses After Effects `startTime` property for precise positioning
- Preserves all existing functionality (scaling, centering, layer targeting)
- Non-breaking addition to proven layer targeting system

## [2.1.0] - 2024-08-14
### ✨ Added
- ✨ Initial playhead positioning feature for gesture layers
- 📝 Layer start time matches current comp.time position

## [2.0.5] - 2024-08-14 🎯 **SCALING SOLUTION**
### 🔧 Fixed
- 🎯 **MAJOR**: Gesture layer scaling now works correctly regardless of quantity added
- 🔧 Resolution-based scaling: 2x=100%, 3x=150%, 4x=200%, 5x=250%, 6x=300%
- 🔧 Unlimited gesture additions in any order
- 🔧 Eliminated false "unexpected name" errors

### 🔧 Technical Details
- **KEY SOLUTION**: Clear selections → copyToComp() → target index 1 directly
- Removed problematic name validation that caused false errors
- Bulletproof layer targeting using After Effects guaranteed behavior
- **Reusable scaling logic** ready for future features

### 📝 Notes
- 📝 This version contains the definitive solution for gesture layer scaling
- 📝 Reference this version for any future scaling-related features

## [2.0.4] - 2024-08-14
### 🔧 Fixed
- 🔧 Simplified layer targeting approach
- 📝 Direct index 1 targeting after copyToComp()

## [2.0.3] - 2024-08-14
### ✨ Added
- 🔧 Enhanced layer identification using fingerprinting
- 🔧 Multiple fallback methods for layer targeting

## [2.0.2] - 2024-08-14
### ✨ Added
- 🔧 Bulletproof layer positioning pattern
- 🔧 Clear layer selections before copying

## [2.0.1] - 2024-08-14
### ✨ Added
- 🔧 Duplicate layer method for forced positioning
- 🔧 Improved layer targeting logic

## [2.0.0] - 2024-08-14
### ✨ Added
- 🔧 Aggressive layer positioning with retry loops
- 🔧 Multiple move attempts to ensure layers reach index 1

## [1.9.9] - 2024-08-14
### ✨ Added
- 🔧 Improved layer targeting with stored references
- 🔧 Better layer moving with fallback handling

## [1.9.8] - 2024-08-14
### ✨ Added
- 🔧 Forced layer positioning to index 1
- 🔧 Enhanced moveToBeginning() implementation

## [1.9.7] - 2024-08-14
### 🔧 Fixed
- 🔧 Corrected scaling values: 5x=250% (was 350%), 6x=300% (was 400%)

## [1.9.6] - 2024-08-14
### ✨ Added
- 🔧 Simplified layer targeting approach
- 📝 Basic verification for gesture layer identification

## [1.9.5] - 2024-08-14
### ✨ Added
- 🔧 Layer targeting improvements
- 🔧 Multiple move attempts for layer positioning

## [1.9.4] - 2024-08-14
### ✨ Added
- ✨ **Initial gesture scaling feature**
- 🔧 Resolution-based scaling: 2x=100%, 3x=150%, 4x=200%, 5x=350%, 6x=400%
- 📝 First implementation of gesture layer scaling logic

## [1.9.3] - 2024-08-14
### 🔧 Fixed
- 🔧 All undo group calls commented out to prevent Essential Graphics warnings
- 🔧 Gesture functionality working (import, copy, position)
- 📝 Scaling logic removed, ready for fresh implementation

### 🔧 Technical Details
- Version updated from previous development
- Undo group warnings resolved
- Stable base for scaling implementation

## [1.4.9] - Earlier
### ✨ Added
- ✨ **Gesture Presets feature**
- 📝 Dropdown for Tap/Long Press gesture types
- 🔧 "Add Gesture" button functionality
- 📝 Layer import from template compositions
- 🔧 Basic layer positioning and centering

### ✨ Added
- 📝 **Device Templates feature**
- 📝 iPhone and Desktop composition creation
- 📝 Resolution scaling (1x-6x multiplier support)
- 📝 iPhone UI template integration
- 🔧 Mathematical precision for scaling calculations

### ✨ Added
- ✨ **Effect Presets feature**
- 🎨 Squircle creation with customizable parameters
- 🔧 Rectangle to squircle replacement
- 🔧 Professional quality effects for motion graphics

---

## Legend
- ✨ New Features
- 🔧 Improvements
- 🔧 Fixes
- 📝 Device/Template Related
- 🎨 Effects Related
- 📝 Documentation
- 🎯 Major Milestone