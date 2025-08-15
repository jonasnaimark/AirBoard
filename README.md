# AirBoard After Effects Plugin

**Professional device mockup and gesture animation tools for Adobe After Effects**

[![GitHub release](https://img.shields.io/github/v/release/jonasnaimark/AirBoard?include_prereleases)](https://github.com/jonasnaimark/AirBoard/releases)
[![After Effects](https://img.shields.io/badge/After%20Effects-2020%2B-purple.svg)](https://www.adobe.com/products/aftereffects.html)

> Streamline your motion design workflow with automated device compositions, gesture animations, components, and professional effects.

## ✨ Features

### 📱 Device Templates
- **Automated Composition Creation**: Generate iPhone and Desktop compositions with precise dimensions
- **Resolution Scaling**: 1x-6x multiplier support (1x=50%, 2x=100%, 3x=150%, 4x=200%, 5x=250%, 6x=300%)
- **Template Integration**: Automatic iPhone UI template import with smart scaling
- **Mathematical Precision**: Accurate scaling calculations for different resolution multipliers

### 🎯 Gesture Presets
- **Complete Animation Library**: Tap, Long Press, Double Tap, Mouse Click animations
- **Smart Scaling**: Automatic resolution-based scaling matching device templates
- **Playhead Positioning**: Layers start exactly where your playhead is positioned
- **Expression-Ready**: Maintains proper layer names for After Effects expressions

### 🧩 Component Library
- **Ms Counter**: Millisecond timer component for precise timing displays
- **Dot Loader**: Animated loading indicator component
- **Smart Positioning**: Automatic centering with keyframe support
- **Scalable System**: Ready for additional components

### 🎨 Effect Presets
- **Squircle Creation**: Generate perfect rounded-rectangle shapes
- **Rectangle Replacement**: Transform existing shapes into squircles
- **Professional Quality**: Industry-standard effects for motion graphics

### 🏔️ Elevation System (Ready for Implementation)
- **Shadow Levels**: 1-5 elevation options for depth hierarchy
- **UI Complete**: Dropdown and button ready for shadow functionality

## 🚀 Quick Start

### Installation

1. **Download** the latest `AirBoard_v2.8.6.zxp` from [Releases](https://github.com/jonasnaimark/AirBoard/releases)
2. **Install** using ZXP Installer or Adobe Extension Manager
3. **Access** via `Window > Extensions > AirBoard` in After Effects

### Basic Workflow

#### Creating Device Compositions
1. Select device type (iPhone/Desktop)
2. Set resolution multiplier (1x-6x, 2x recommended)
3. Click "Make Comp"
4. Composition created with proper dimensions and imported templates

#### Adding Gesture Animations
1. Open your device composition
2. Position playhead where you want the gesture to start
3. Select gesture type (Tap/Long Press/Double Tap/Mouse Click)
4. Set resolution multiplier to match your composition
5. Click "Add Gesture" - gesture appears with perfect scaling and timing

#### Using Components
1. Position playhead where you want the component
2. Select component (Ms Counter/Dot Loader)  
3. Set resolution multiplier to match your composition
4. Click "Add Component" - component appears centered and scaled

#### Applying Effects
1. Select layer in timeline
2. Choose effect from AirBoard panel (Add Squircle/Replace Rect)
3. Effect applied with professional results

## 📋 Current Version: v2.8.6

### Major Features ✅
- **Device Templates**: iPhone & Desktop with resolution scaling
- **Gesture Presets**: Complete animation library with playhead positioning
- **Components**: Ms Counter & Dot Loader with smart positioning
- **Effect Presets**: Squircle and Rectangle replacement tools
- **Unified UI**: Consistent spacing and dark theme
- **Performance Optimized**: Template caching and efficient layer targeting

### In Development 🚧
- **Elevation Shadows**: UI ready, functionality coming soon

## 🛠️ Technical Architecture

### Frontend (HTML/CSS/JavaScript)
- **Panel Interface**: Modern dark theme matching After Effects
- **Unified CSS System**: Single `.section` and `.control-row` classes for consistency
- **Event Handling**: Button clicks trigger ExtendScript functions via CSInterface

### Backend (ExtendScript .jsx)
- **Template Management**: Centralized AirBoard Templates.aep import system
- **Layer Targeting**: Proven index-1 approach for reliable layer placement
- **Scaling Engine**: Resolution-based transform calculations
- **Playhead Integration**: Timeline-aware layer positioning

### Build System
- **ZXP Packaging**: Digital signing with certificate authentication
- **Version Management**: Semantic versioning in manifest.xml
- **Git Workflow**: Feature branches merged to main with comprehensive commit messages

## 📚 Documentation

### For Developers
- **[DEVELOPMENT_GUIDE.md](DEVELOPMENT_GUIDE.md)**: Technical patterns, scaling logic, and implementation details
- **[UI_PATTERNS.md](UI_PATTERNS.md)**: Adding new sections and maintaining UI consistency
- **[VERSION_GUIDE.md](VERSION_GUIDE.md)**: Version management and release process

### For Users
- **[CHANGELOG.md](CHANGELOG.md)**: Detailed version history and feature updates

## 📊 Resolution Scaling Reference

| Multiplier | Scale % | Use Case |
|------------|---------|----------|
| 1x | 50% | Low-density screens, thumbnails |
| 2x | 100% | Standard density, baseline scaling |
| 3x | 150% | High-density mobile screens |
| 4x | 200% | Ultra-high density displays |
| 5x | 250% | Large format, presentation |
| 6x | 300% | Maximum density, detailed work |

## 🎯 Key Breakthrough: v2.0.5 Scaling Solution

The most critical technical achievement was solving the gesture layer scaling issue:

- **Problem**: Layers would scale incorrectly when multiple gestures were added
- **Solution**: Index-1 targeting with layer count verification
- **Result**: Bulletproof scaling that works with unlimited gesture additions
- **Pattern**: Now used for all new features (Components, future additions)

## 🧩 System Requirements

- **Adobe After Effects**: 2020 or later (2020-2025 supported)
- **Operating System**: macOS or Windows
- **Memory**: 4GB RAM minimum (8GB recommended)

## 🔧 Development

### Contributing Guidelines

1. **UI Changes**: Use unified `.section` and `.control-row` classes
2. **New Features**: Follow gesture/component implementation patterns
3. **Scaling Logic**: Always implement resolution-based transform scaling
4. **Version Management**: Update manifest.xml and follow semantic versioning
5. **Documentation**: Update relevant .md files with new patterns

### Project Structure
```
AirBoard/
├── CSXS/                   # Extension configuration
│   └── manifest.xml        # CEP manifest with version
├── client/                 # Frontend UI
│   ├── css/styles.css     # Unified dark theme styling
│   ├── index.html         # Semantic section-based layout
│   └── js/main.js         # UI interaction and event handling
├── jsx/                   # After Effects automation
│   └── main.jsx          # Core scaling and positioning logic
├── assets/               # Resources and templates
│   ├── templates/        # AirBoard Templates.aep
│   ├── presets/         # Effect presets
│   └── [devices/gestures/] # Organized asset folders
└── dist/                # Built ZXP releases
```

## 🗺️ Roadmap

### Planned Features
- **Elevation Shadows**: Complete shadow system implementation
- **Additional Components**: Progress bars, buttons, icons
- **Advanced Gestures**: Pinch, swipe, multi-touch animations
- **Custom Templates**: User-defined device templates

### Technical Improvements
- **Performance**: Further template caching optimizations
- **UI**: Additional accessibility features
- **Documentation**: Video tutorials and advanced guides

## 📄 License

Proprietary - All rights reserved

## 🙏 Acknowledgments

- Built with [Adobe CEP](https://github.com/Adobe-CEP) framework
- Developed collaboratively with [Claude Code](https://claude.ai/code)
- Thanks to the After Effects community for feedback and testing

---

**Made with ❤️ for the After Effects community | Current Version: v2.8.6**