# 🛡️ AirBoard v4.16.59 - KEYFRAME PROTECTION SYSTEM

## 🎯 Fixed - CRITICAL ADJACENT KEYFRAME PROTECTION

**Spring Animation Corruption Fix**: Keyframes immediately after delay/duration/stagger/snap operations no longer get modified

### The Problem
When performing keyframe operations (snap to playhead, delay, duration, stagger), After Effects automatically modifies adjacent keyframes, adding unwanted easing curves and changing values. This was corrupting spring animations and creating drift between animation segments.

### The Solution
Implemented comprehensive keyframe protection system:
- Captures complete state of the keyframe after your selection (value, interpolation, ease curves, spatial tangents, labels)
- Your keyframes are removed and recreated at new times/values
- Restores the adjacent keyframe to its exact original state, preventing AE's auto-adjustments

### Protected Operations
✅ Snap to Playhead (regular and Time Remap paths)
✅ Delay Nudging (forced timeline, regular timeline, and baseline modes)
✅ Duration Stretching (all 4 stretch functions)
✅ Stagger (all 3 stagger code paths)
✅ Global Delay (moveKeyframesAfterTime function for Time Remap and regular properties)

### Technical Implementation
Created 4 reusable helper functions:
- `captureKeyframeState()` - Captures complete keyframe state
- `restoreKeyframeState()` - Restores all keyframe properties
- `captureNextKeyframe()` - Finds and captures the next keyframe after selection
- `restoreNextKeyframe()` - Restores keyframe using smart index calculation with time-based fallback

Applied protection to all keyframe manipulation operations across the codebase.

### Installation
Download `AirBoard-v4.16.59.zxp` and install using Anastasiy's Extension Manager or ZXPInstaller.

### Full Changelog
See [CHANGELOG.md](https://github.com/jonasnaimark/AirBoard/blob/main/docs/CHANGELOG.md) for complete technical details.

---

## How to Create the GitHub Release

1. Go to https://github.com/jonasnaimark/AirBoard/releases/new
2. Select the tag: `v4.16.59`
3. Release title: `AirBoard v4.16.59 - Keyframe Protection System`
4. Copy the content above into the description
5. Upload the file: `dist/AirBoard-v4.16.59.zxp`
6. Click "Publish release"
