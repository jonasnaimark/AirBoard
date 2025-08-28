# AirBoard - Professional Animation Tools for After Effects

**Advanced keyframe nudging, device mockups, and gesture animation tools for Adobe After Effects**

[![GitHub release](https://img.shields.io/github/v/release/jonasnaimark/AirBoard?include_prereleases)](https://github.com/jonasnaimark/AirBoard/releases)
[![After Effects](https://img.shields.io/badge/After%20Effects-2020%2B-purple.svg)](https://www.adobe.com/products/aftereffects.html)
[![Version](https://img.shields.io/badge/version-4.11.2-blue.svg)](https://github.com/jonasnaimark/AirBoard/releases/tag/v4.11.2)

> Transform your After Effects workflow with precision keyframe control, automated device compositions, gesture animations, and professional effects.

## 🎯 What's New in v4.11.2 - Latest Build!

### 🎨 Enhanced Stagger Control
- **Stagger Direction Toggle**: Switch between bottom-to-top and top-to-bottom layer ordering
- **Layer Marker Syncing**: Labels/markers now move with keyframes during stagger operations
- **Visual Direction Indicator**: Icon flips to show active stagger direction
- **Improved Tooltips**: Clear hover hints for all control buttons

### 🔧 Precision Improvements  
- **Fixed Rounding Errors**: No more 1ms showing instead of 0ms
- **Better Float Precision**: Improved accuracy for small time values
- **Consistent Calculations**: All timing operations use enhanced rounding

## ✨ Core Features

### ⌨️ Keyframe Nudger (v4.10.0) 
**The most advanced keyframe manipulation system for After Effects**

#### Duration Control
- **Smart Snapping**: Automatically snaps to intervals based on frame input
  - Example: 3 frames = 50ms intervals at 60fps
  - 467ms + click → 500ms (snaps to next interval)
  - 500ms + click → 550ms (adds one interval)
- **Dynamic Frame Input**: Adjustable frame count for different snapping intervals
- **Precision Control**: Never lose precision with intelligent rounding

#### Position Nudging
- **X/Y Distance Control**: Separate controls for horizontal and vertical movement
- **Multi-Layer Support**: Shows "X: Multiple" / "Y: Multiple" for complex selections
- **Resolution Aware**: Respects your composition's resolution multiplier
- **Directional Display**: Shows "Left/Right" and "Up/Down" with pixel values

#### Delay & Stagger
- **Timeline Position Nudging**: Move keyframes forward/backward in time
- **Stagger Detection**: Automatically calculates stagger between layers
- **Layer Marker Sync**: Markers move with keyframes during delay operations
- **Cross-Property Mode**: Handles different property types simultaneously

#### Selection Intelligence
- **Perfect Selection Preservation**: Keyframes stay selected through all operations
- **Multi-Property Support**: Works with Position + Opacity + Scale simultaneously
- **Fresh Reference System**: Handles After Effects' complex property referencing
- **Deselect/Select Logic**: Ensures only intended keyframes remain selected

### 📱 Device Templates
- **Automated Composition Creation**: iPhone and Desktop with precise dimensions
- **Resolution Scaling**: 1x-6x multiplier support
- **Template Integration**: Automatic UI template import with smart scaling
- **Mathematical Precision**: Pixel-perfect scaling calculations

### 🎯 Gesture Presets
- **Complete Animation Library**: Tap, Long Press, Double Tap, Mouse Click
- **Smart Scaling**: Automatic resolution-based scaling
- **Playhead Positioning**: Layers start exactly at playhead position
- **Expression-Ready**: Maintains proper naming for expressions

### 🧩 Component Library
- **Ms Counter**: Millisecond timer for timing displays
- **Dot Loader**: Professional loading animations
- **Smart Positioning**: Automatic centering with keyframes
- **Scalable System**: Ready for additional components

### 🎨 Effect Presets
- **Squircle Creation**: Perfect rounded rectangles
- **Shadow System**: 5-level elevation with resolution scaling
- **Material Presets**: Light/Dark with thickness variations
- **Professional Quality**: Industry-standard effects

## 🚀 Quick Start

### Installation

1. **Download** the latest `AirBoard-v4.10.0.zxp` from [Releases](https://github.com/jonasnaimark/AirBoard/releases)
2. **Install** using [ZXP Installer](https://aescripts.com/learn/zxp-installer/) or Adobe Extension Manager
3. **Access** via `Window > Extensions > AirBoard` in After Effects

### Using the Keyframe Nudger

#### Reading Keyframe Values
1. Select keyframes on your timeline
2. Click "Read Keyframes" button
3. View Duration, Delay, X/Y distances, and Stagger values

#### Nudging Duration (with Smart Snapping)
1. Set frame count in the input field (e.g., 3 for 50ms intervals)
2. Click + to increase or - to decrease duration
3. Duration snaps to clean intervals automatically

#### Nudging Position
1. Select position keyframes
2. Use arrow buttons to nudge X or Y values
3. Multi-layer selections show "Multiple"

#### Adjusting Delay/Timeline Position
1. Select keyframes across layers
2. Use + / - buttons in Delay row
3. Layer markers sync automatically

### Creating Device Mockups

1. Select device type (iPhone/Desktop)
2. Set resolution multiplier (2x recommended)
3. Click "Make Comp"
4. Add gestures and components as needed

## 📋 Version History

### v4.10.0 (2024-12-28) - KEYFRAME NUDGER COMPLETE
- ✅ Multi-property selection preservation
- ✅ Smart duration snapping algorithm
- ✅ Multi-layer position display
- ✅ Complete UI display fixes
- ✅ Comprehensive documentation

### v4.9.5 - Layer Marker Syncing
- Layer markers move with delay nudging
- Multiple marker type support
- Universal delay mode integration

### v4.9.4 - Stagger Accuracy
- Fixed stagger sign detection
- Eliminated UI race conditions
- Consistent layer sorting

[See full CHANGELOG](CHANGELOG.md)

## 🛠️ Technical Details

### Architecture
- **Frontend**: HTML5/CSS3/JavaScript with Adobe CEP
- **Backend**: ExtendScript for After Effects automation
- **Debug System**: Comprehensive logging for troubleshooting
- **Build System**: Automated ZXP packaging with digital signing

### Key Technologies
- **Selection Caching**: Preserves keyframe selection across operations
- **Fresh References**: Handles After Effects' property reference system
- **Smart Snapping**: Mathematical interval calculation
- **Cross-Property Detection**: Automatic mode switching

## 📚 Documentation

### For Users
- **[Quick Start Guide](#quick-start)**: Get up and running quickly
- **[CHANGELOG.md](CHANGELOG.md)**: Detailed version history

### For Developers
- **[DEVELOPMENT.md](DEVELOPMENT.md)**: Development setup and workflow
- **[KEYFRAME_SYSTEM_SUMMARY.md](KEYFRAME_SYSTEM_SUMMARY.md)**: Complete keyframe system documentation
- **[UI_PATTERNS.md](UI_PATTERNS.md)**: UI consistency guidelines

## 🔧 Development

### Quick Setup
```bash
# One-time development setup
./dev-sync.sh

# Development workflow:
# 1. Edit code
# 2. Run ./dev-sync.sh
# 3. Restart After Effects
# 4. Test "AirBoard Dev" extension

# Production build
./build-latest.sh
```

### Project Structure
```
AirBoard/
├── CSXS/                   # Extension configuration
├── client/                 # Frontend UI
│   ├── css/               # Styling
│   ├── index.html         # Panel layout
│   └── js/main.js         # UI logic & keyframe nudger
├── jsx/                   # After Effects scripting
│   └── main.jsx          # Core automation & nudging logic
├── assets/               # Templates and presets
└── dist/                # Built releases
```

## 🎯 Roadmap

### Near Term
- [ ] Testing and bug fixes for v4.10.0
- [ ] Additional keyframe easing controls
- [ ] Batch keyframe operations

### Future Features
- [ ] Advanced bezier handle control
- [ ] Keyframe pattern templates
- [ ] Animation curve presets
- [ ] Extended component library

## 🧩 System Requirements

- **After Effects**: 2020 or later (tested through 2025)
- **Operating System**: macOS 10.14+ or Windows 10+
- **Memory**: 8GB RAM recommended
- **Display**: 1920x1080 or higher recommended

## 🤝 Contributing

We welcome contributions! Please:
1. Fork the repository
2. Create a feature branch
3. Follow existing code patterns
4. Update documentation
5. Submit a pull request

## 📄 License

Proprietary - All rights reserved

## 🙏 Credits

- **Developer**: Jonas Naimark
- **AI Assistant**: Claude (Anthropic)
- **Framework**: Adobe CEP
- **Community**: After Effects users worldwide

## 📞 Support

- **Issues**: [GitHub Issues](https://github.com/jonasnaimark/AirBoard/issues)
- **Discussions**: [GitHub Discussions](https://github.com/jonasnaimark/AirBoard/discussions)
- **Email**: [Contact Developer](mailto:your-email@example.com)

---

<div align="center">
  
**AirBoard v4.10.0** - Precision Keyframe Control for After Effects
  
Made with ❤️ for the motion design community
  
[Download](https://github.com/jonasnaimark/AirBoard/releases) • [Documentation](KEYFRAME_SYSTEM_SUMMARY.md) • [Changelog](CHANGELOG.md)

</div>