# AirBoard Plugin Changelog

All notable changes to the AirBoard After Effects Plugin will be documented here.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [4.17.10] - 2025-01-29 🛠️ **Cross-Platform Path Fix**
### 🐛 Bug Fixes
- **Preset File Path Resolution**: Fixed mixed path separator bug causing "Cannot find preset file" errors on macOS
  - Root cause: Fallback paths used Windows backslashes (`\`) which mixed with macOS forward slashes (`/`), creating invalid paths like `/Library/.../AirBoard\assets\presets\...`
  - Now normalizes all paths using forward slashes (works on both macOS and Windows)
  - Fixed 11 instances across template, squircle, FitToShape, and material preset loading

### 🔧 Technical Improvements
- Improved error messages to show expected file location when presets can't be found
- Path normalization using `.replace(/\\/g, "/")` instead of hardcoded backslash fallbacks

### 🔗 Associated Build
- AirBoard-v4.17.10.zxp

## [4.17.9] - 2025-01-18 📋 **Copy/Paste Springs Multi-Property Fix**
### 🐛 Bug Fixes
- **Copy/Paste Springs**: Fixed copy/paste failing when non-spring properties (like Opacity) were included in the selection
  - Root cause: Was using `layer.selectedProperties` which only returns explicitly highlighted properties, not all properties with selected keyframes
  - Now recursively walks ALL layer properties to find selected keyframes
  - Added robust error handling to prevent single property errors from breaking entire copy operation
- Copy/Paste Springs now works with any combination of spring and non-spring properties (Position, Scale, Opacity, etc.)

### 🔗 Associated Build
- AirBoard-v4.17.9.zxp

## [4.17.8] - 2025-01-17 🔗 **Child Rig Nested Parenting Fix**
### 🐛 Bug Fixes
- **Child Rig Nested Parenting**: Fixed layer movement when applying Child Rig to layers parented to another parented layer (3+ level hierarchy)
  - Root cause: Was storing world scale instead of local scale, causing scale orbit to apply incorrect offset
  - Layers now stay in place when Child Rig is applied, regardless of parent chain depth

### 🔧 Technical Improvements
- Updated `getLayerWorldPosition()` to properly handle 3D layers (uses zRotation)
- Fixed expression generation to use parent's 3D status for rotation property access
- Improved debug message display in panel for Child Rig operations

### 🔗 Associated Build
- AirBoard-v4.17.8.zxp

## [4.17.4] - 2025-12-19 🪟 **Glass Polish & UI Fixes**
### 🪟 Glass Effect
- **Renamed Layer**: "Glass Sweep" → "Glass Highlight" for clarity
- **Top Edge Thickness**: Increased from 2.5 to 3 at 4x (scales with resolution)

### 🎨 UI Improvements
- **Centered Dropdowns**: All dropdown menus now center horizontally over their buttons

### 🔗 Associated Build
- AirBoard-v4.17.4.zxp

## [4.17.3] - 2025-12-19 🪟 **Glass Effect Improvements**
### 🪟 Glass Effect Enhancements
- **Auto Rectangle Conversion**: Glass effect now automatically converts rectangle paths to Squircle - no need to manually apply Squircle first
- **Path Linking**: Child layers (sweep, mask, shadow) now link directly to main layer's computed path instead of duplicating Squircle effect
  - Cleaner layer structure with fewer effects
  - All Squircle properties inherited automatically, including non-keyframable ones like Alignment
- **Alignment-Aware Sweeps**: CC Light Sweep centers now follow the shape when Alignment is changed (Center, Center Left, Top Right, etc.)
- **Refined Sweep Values**: Bottom sweep edge thickness fixed at 2, edge intensity increased to 200, width set to 40% of shape
- **Layer Opacity**: Light sweep layer opacity set to 90%

### 🔧 Technical Improvements
- Path expressions reference parent layer's computed path directly
- Alignment offset calculation mirrors Squircle effect's internal mapping
- Removed redundant Squircle effect parameter linking code

### 🔗 Associated Build
- AirBoard-v4.17.3.zxp

## [4.17.0] - 2025-12-15 🎨 **Dropdown System Unification**
### 🎨 UI/UX Improvements
- **Unified Dropdown System**: Merged Keyframe Nudger and gesture/device dropdowns into single consistent system
- **Improved Dropdown Interactions**: Clicking one dropdown now closes any other open dropdown
- **Rounded Hover States**: Keyframe Nudger dropdown options now have rounded hover backgrounds matching gesture dropdowns
- **Device Dropdown Enhancement**: Removed scrim overlay, added custom chevron icon for more visible text
- **Frame Slider Spacing**: Reduced left/right padding from 8px to 4px for tighter layout
- **Input/Button Balance**: Fine-tuned number input and +/- button widths for better proportions
- **Blur Dropdown Tightening**: Reduced vertical padding in Effects > Blur material type dropdown

### 🔧 Technical Improvements
- **CSS Consolidation**: Removed duplicate `.custom-dropdown` styles in favor of unified `.custom-select-menu`
- **Event Handling**: Added cross-closing logic between different dropdown instances
- **Specificity Fixes**: Updated selectors for frame multiplier input width override

### 🔗 Associated Build
- AirBoard-v4.17.0.zxp

## [4.16.98] - 2025-12-14 🔒 **Baked Spring Protection**
### 🔒 New Feature
- **Baked Spring Protection**: Keyframes inside baked spring segments are now protected from being moved when the playhead is within that spring
- Works with both **Global Delay Nudging** (moving all keyframes after playhead) and **Keyframe Nudger** (moving selected keyframes)
- Baked springs are detected by the **Blue → Sea Foam → Blue** keyframe label pattern (created by Sproing plugin)

### 🔬 Technical Details
- **Detection**: `detectBakedSpringSegments()` scans properties for the Blue-SeaFoam-Blue pattern
- **Protection**: `isKeyframeInProtectedSpring()` checks if playhead is within a spring segment
- **Coverage**: Protection integrated into all keyframe nudging modes:
  - Global delay nudging (`moveKeyframesAfterTime`)
  - Forced timeline mode
  - Regular timeline mode
  - Baseline mode
- Debug logging shows when springs are detected and keyframes protected

### 🎨 UI Improvements
- **Apply Button**: Darkened dialog Apply button colors for better visual balance

### 📚 Documentation
- Added "After Effects Layer Timing Model" section to TECHNICAL_DOCS.md explaining startTime, inPoint, outPoint relationships

### 🔗 Associated Build
- AirBoard-v4.16.98.zxp

## [4.16.97] - 2025-12-12 🎨 **Control Row Layout Refinements**
### 🎨 UI/UX Improvements
- **Compact row spacing**: Reduced gaps between control rows (Frame multiplier, Delay, Duration, Stagger, X/Y distance) to 4px
- **Wider controls**: Input and -/+ buttons are now 4px wider for easier targeting
- **Frame multiplier input**: Now fills full row height with 6px border radius
- **X/Y distance alignment**: 4-button controls now align properly with -/+ button rows above

### 🔧 Technical Improvements
- **CEP compatibility**: Replaced unsupported `:has()` selector with `compact-row` class
- **Unified button alignment**: Added `justify-content: flex-end` to distance controls

### 🔗 Associated Build
- AirBoard-v4.16.97.zxp

## [4.16.94] - 2025-12-11 ✨ **Tooltip UX Improvements**
### ✨ Improved
- **Delayed Tooltips**: Tooltips now wait 500ms before appearing (prevents tooltip spam on quick hovers)
- **Click Cancels Tooltip**: Clicking before tooltip appears cancels it completely (no flash)
- **Click Dismisses Tooltip**: Clicking after tooltip is visible fades it out smoothly

### 🎯 Impact
- UI feels more responsive and less intrusive when quickly clicking through buttons
- Power users won't see tooltips during normal workflow
- New users can still discover button functions by hovering longer

### 🔗 Associated Build
- AirBoard-v4.16.94.zxp

## [4.16.93] - 2025-12-07 🔧 **Fit to Shape: Rotation Reset Fix**
### 🔧 Fixed
- **Rotation Double-Up**: Fixed mask and content layers over-rotating when shape layer has animated rotation
- When shape layer rotates (e.g., -20° → 0°), mask and content now follow correctly instead of doubling

### 🔬 Technical Details
- **Root Cause**: After parenting, AE compensates local rotation to maintain visual position, causing double rotation when parent animates
- **The Fix**: Reset Rotation to 0 on both mask layer and content layer after parenting

### 🔗 Associated Build
- AirBoard-v4.16.93.zxp

## [4.16.92] - 2025-12-07 🔧 **Fit to Shape: Adjustment Layer Support**
### 🔧 Fixed
- **Adjustment Layer Shapes**: Fit to Shape now works when the shape layer is an adjustment layer
- **Track Matte Error**: Fixed "Invalid parameters passed to setTrackMatte()" error

### 🔬 Technical Details
- **Root Cause**: Adjustment layers cannot be used as track mattes in After Effects
- **The Fix**: When creating the mask layer (duplicate of shape), turn off `adjustmentLayer` property so it can be used as a track matte

### 🔗 Associated Build
- AirBoard-v4.16.92.zxp

## [4.16.91] - 2025-12-07 🔧 **Global Delay: Essential Properties Support**
### 🔧 Fixed
- **Essential Properties Keyframes**: Global delay now properly moves keyframes on Essential Properties (Master Properties exposed on precomp layers)
- **Duplicate Name Handling**: Fixed issue where multiple Essential Properties with the same name (e.g., multiple "Fill 1 Color") were incorrectly detected as duplicates

### 🔬 Technical Details
- **Root Cause**: The `moveKeyframesAfterTime` function wasn't processing Essential Properties (`ADBE Layer Overrides`) - it was missing from the list of property groups to check
- **Secondary Issue**: Even after adding Essential Properties support, properties with duplicate names were being skipped due to the duplicate detection system using property paths that didn't include indices
- **The Fix**:
  1. Added Essential Properties processing via `layer.property("ADBE Layer Overrides")` in section 7.7
  2. Modified `getFullPropertyPath()` to include `propertyIndex` for each property in the path, making `Fill 1 Color[2]` distinct from `Fill 1 Color[3]`

### 🎯 Impact
- Global delay now works with all Essential Properties keyframes
- Properties with identical names (common in Essential Properties) are now correctly identified as unique
- No more missing keyframes when using global delay on precomp layers with exposed master properties

### 🔗 Associated Build
- AirBoard-v4.16.91.zxp

## [4.16.90] - 2025-12-06 **Fit to Shape: Precomp Improvements**
### Improved
- **Color Label Inheritance**: Precomp now inherits the color label from the first (topmost) selected layer
- **Timeline Positioning**: Precomp is now placed at the same timeline position as the original layer(s)
- **Inner Layer Timing**: Layers inside the precomp start at frame 0, maintaining relative timing offsets

### Technical Details
- Captures `label` and `startTime` properties before precomposing
- Sets precomp's `startTime` to the earliest start time among all selected layers
- Offsets inner layers' start times so the earliest one begins at 0
- Other layers maintain their relative timing (e.g., if Layer B was 1 second after Layer A, it starts at 1 second in precomp)

### Associated Build
- AirBoard-v4.16.90.zxp

## [4.16.89] - 2025-01-14 🐛 **FIX: Delay Nudging Marker Double-Processing (Complete Fix)**
### 🐛 Fixed
- **Delay Nudging (+/-)**: Fixed spring markers moving 2x too far when using delay nudge buttons
- **Timeline Mode**: Spring markers now move correct distance when nudging keyframes in timeline mode
- **Directional Bug**: Fixed asymmetric behavior where `-` worked correctly but `+` moved markers twice as far

### 🔬 Technical Details
- **Root Cause**: The delay nudging function (STEP 2A marker processing) was missing the `processedMarkerTimes` tracking that was added to snap-to-playhead in v4.16.88
- **Same Bug, Different Location**: While v4.16.88 fixed snap-to-playhead, delay nudging had identical code without the fix
- **Example of Bug**:
  - Iteration 1: Keyframe at 5.100s → moved marker 5.100s → 5.150s ✓
  - Iteration 2: Keyframe at 5.150s → found marker we JUST moved, moved AGAIN 5.150s → 5.200s ❌
  - Result: Marker moved 100ms instead of 50ms
- **Why `-` Worked but `+` Failed**:
  - Moving backward: Marker moves to position BEFORE next keyframe's original time (no collision)
  - Moving forward: Marker lands exactly where next keyframe was originally (collision = double processing)
- **The Fix**: Added `processedMarkerTimes` array to STEP 2A marker processing (line 7881-7927)
  - Tracks both original position and new position of each moved marker
  - Subsequent keyframes skip processing if their time matches any tracked position
  - Identical logic to the v4.16.88 fix, now applied to delay nudging path

### 🎯 Impact
- Delay nudging now moves markers exactly 50ms per click in both directions
- Eliminates the confusing asymmetric behavior between + and -
- Completes the marker double-processing fix started in v4.16.88
- All marker movement operations (snap, delay, position) now use consistent tracking

### 🔗 Associated Build
- AirBoard-v4.16.89.zxp

## [4.16.88] - 2025-01-14 🐛 **FIX: Spring Marker Double-Processing**
### 🐛 Fixed
- **Snap to Playhead**: Fixed spring markers being processed multiple times and incorrectly splitting
- **Delay Nudging**: Fixed markers moving 2x too far when snapping springs to playhead
- **Marker Tracking**: Prevented double-processing by tracking both original and new marker positions

### 🔬 Technical Details
- **Root Cause**: Code was looping through all keyframes in a spring (e.g., 15 keyframes) and calling `smartSplitMergeMarker` for each one
  - First iteration: Moved marker from 4.367s → 4.583s ✓
  - Second iteration: Found marker at 4.578s (where we just moved it!) → moved AGAIN to 4.794s ✗
- **Marker Position Tracking**: Now tracks BOTH original and new marker times in `processedMarkerTimes` array
  - When a marker is moved from time A to time B, both times are tracked
  - Subsequent keyframes at either time A or time B skip marker processing
  - Prevents the same marker from being moved multiple times
- **Support for Mid-Selection Markers**: Still checks ALL keyframes for markers (supports markers in middle of selections)
  - Maintains functionality where markers between selected keyframes move with their spring segment
  - Example: Blue keyframe with marker in middle of selection correctly moves with its spring

### 🎯 Impact
- Spring markers now move exactly once to the correct position
- No more phantom/split markers created during snap operations
- Markers correctly follow their spring segments regardless of position in selection
- Fixes affect both snap to playhead and delay nudging operations

### 🔗 Associated Build
- AirBoard-v4.16.88.zxp

## [4.16.87] - 2025-01-14 🐛 **FIX: Time Remap Selection Preservation**
### 🐛 Fixed
- **Stagger Operations**: Time Remap keyframes now remain selected when applying stagger to irregular/uneven staggers
- **Duration Nudging**: Time Remap keys maintain selection during duration increase/decrease operations
- **Cross-Property Mode**: Fixed Time Remap selection when multiple properties are selected together
- **Single-Property Mode**: Fixed Time Remap selection when only Time Remap keys are selected

### 🔬 Technical Details
- **Add-Before-Delete Pattern**: Implemented special handling for Time Remap using `setValueAtTime()` before deleting old keyframes
  - Prevents "property is hidden" errors that occur when using standard `addKey()` approach
  - Works around After Effects hiding Time Remap property during keyframe operations
- **Duplicate Detection**: Fixed duplicate Time Remap entries in stagger using matchName-based comparison
  - Changed from object reference comparison to `matchName === "ADBE Time Remapping"` check
  - Prevents processing same Time Remap property multiple times
- **Old Keyframe Verification**: Added verification step to ensure old keyframes exist before deletion
  - Tracks keyframes as `{index, time}` objects instead of just indices
  - Prevents accidentally deleting newly created keyframes
- **Selection Restoration**: Multi-phase selection process with explicit clearing before final re-selection
  - Immediate selection after adding new keyframes
  - Clear all selections after deletions
  - Find final indices by time and select them
- **ExtendScript Compatibility**: Replaced modern JavaScript `.map()` with manual for loops for debug logging

### 🎯 Impact
- Time Remap keyframes now behave consistently with other property types
- Stagger snapping operations preserve all Time Remap selections
- Duration nudging (+ and -) maintains Time Remap selections in all scenarios
- Fixes affect both multi-property and single-property selection modes

### 🔗 Associated Build
- AirBoard-v4.16.87.zxp

## [4.16.86] - 2025-01-13 🎨 **UI: Enhanced Tooltip System**
### ✨ Enhanced
- **Snap to Playhead Tooltip**: Added two-line tooltip showing "Shift: Keep delays" modifier hint
- **Tooltip Styling**: Improved tooltip readability with centered text and optimized line spacing

### 🔬 Technical Details
- Updated snap to playhead button tooltip to display modifier functionality
- Added `text-align: center` to tooltip styling for better visual alignment
- Set `line-height: 1.3` for improved readability on multi-line tooltips
- Tooltip displays as two separate lines with proper vertical spacing

### 🎯 Impact
- Users can now discover the Shift modifier functionality through tooltip hover
- Better discoverability of advanced features without cluttering the UI
- Consistent tooltip styling across all buttons
- Improved user experience for new and existing users

### 🔗 Associated Build
- AirBoard-v4.16.86.zxp

## [4.16.85] - 2025-01-13 ✨ **ENHANCEMENT: Mirrored Springs Sync with Sproing v1.2.10**
### ✨ Enhanced
- **Inflection Point Preservation**: Bouncy mirrored springs now preserve smooth curves at bounce/rebound points
- **Time Remap Precision**: Time Remap mirrored springs auto-boost to high precision for smooth curves
- **Visual Quality Match**: Mirrored springs now perfectly match Sproing's baking quality

### 🔬 Technical Details
- **Inflection Point Detection (Sproing v1.2.6)**:
  - Added `findInflectionPoints()` function to detect velocity direction changes
  - Modified `simplifySpringKeyframes()` to split curve at inflection points before Douglas-Peucker simplification
  - Ensures bounce/rebound keyframes are never removed by simplification algorithm
  - Critical for bouncy springs (damping ratio < 1) to maintain smooth arced easing at turning points
- **Time Remap Precision Boost (Sproing v1.2.10)**:
  - Auto-upgrades Time Remap properties from low/medium → high precision during mirroring
  - Only affects Time Remap, other properties continue using detected precision level
  - Prevents visible stuttering on Time Remap mirrored springs
  - Ensures smooth curves that match dense baking quality
- **Implementation**: Updated mirror keys feature to match Sproing v1.2.10 spring baking algorithms

### 🎯 Impact
- Bouncy mirrored springs maintain perfect curves at all direction changes
- Time Remap mirrors are smoother and more accurate across all precision settings
- Mirrored springs now 100% match Sproing's visual baking quality
- No changes to existing non-bouncy spring behavior
- Fully compatible with Sproing unbake/rebake workflows

### 🔗 Associated Build
- AirBoard-v4.16.85.zxp

## [4.16.84] - 2025-01-13 🔧 **FIX: Spring Marker Movement with Leading Keyframes**
### 🔧 Fixed
- **Spring Markers Not Moving**: Fixed spring markers staying behind when selected keyframes include leading keyframes before the spring segment
- **Delay Operations**: All delay modes (individual and timeline) now check every selected keyframe for markers, not just the first
- **Snap to Playhead**: Checks all selected keyframes for spring markers during snap operations
- **Stagger**: Checks all selected keyframes for spring markers during stagger operations

### 🔬 Technical Details
- **Root Cause**: Delay, snap, and stagger operations only checked the first selected keyframe for spring markers
  - Scenario: User selects leading keyframe at frame 0 + spring segment starting at frame 50 with marker
  - Previous behavior: Only checked frame 0 → found no marker → marker stayed at frame 50 while keys moved
  - New behavior: Checks all selected keyframes → finds marker at frame 50 → moves marker with keys
- **Implementation Changes**:
  - **Delay (Individual)**: Loop through `propData.keyframes` array checking each keyframe time
  - **Delay (Timeline)**: Loop through `selKeys` indices checking each selected keyframe
  - **Stagger**: Loop through all `selectedKeys` instead of just `selectedKeys[0]`
  - **Snap**: Store `selectedKeyTimes` array in `layerMarkerOffsets` and loop through all times
- **Property Safety**: Uses `uniquePropId` to ensure only the correct property's spring block moves, won't affect unrelated markers

### 🎯 Impact
- Spring markers now stay synchronized with their spring segments when selections include leading keyframes
- Works across all four operations: delay (both modes), snap to playhead, and stagger
- No performance impact: Marker lookup is fast, only processes when markers actually exist

### 🔗 Associated Build
- AirBoard-v4.16.84.zxp

## [4.16.83] - 2025-01-13 ✨ **ENHANCEMENT: Global Delay Easing Preservation**
### 🔧 Fixed
- **Global Delay Easing Distortion**: Fixed easing curves changing shape when global delay extends duration between keyframes
- **Curve Preservation**: Bezier curves now maintain exact visual shape when playhead-based delay changes distance between stationary and moving keyframes

### 🔬 Technical Details
- **Root Cause**: When global delay moves keyframes after playhead, the distance between stationary (before playhead) and moving (after playhead) keyframes changes
  - Example: Key A at 1.0s, Key B at 2.0s (duration: 1.0s). Global delay at 1.5s moves B to 2.5s (duration: 1.5s)
  - Previous behavior: Easing speed values remained unchanged → visual curve distorted
  - **Solution**: Scale KeyframeEase speed values inversely with duration change (speed × oldDuration/newDuration)
- **Implementation**: Modified `moveKeyframesAfterTime()` function to:
  1. Detect when stationary keyframe exists before first moving keyframe
  2. Calculate old vs new duration between them
  3. Scale IN ease of first moving keyframe using `scaleEaseForDuration()`
  4. Scale OUT ease of stationary keyframe
  5. Keep influence values unchanged (they're already percentages)
- **Scope**: Applied to both regular properties and Time Remap keyframes
- **Mathematical Foundation**: Same inverse scaling used in duration stretch operations (speed = valueChange / time, so longer time requires proportionally slower speed to maintain same value change)

### 🎯 Impact
- Global delay now preserves easing perfectly when extending/contracting duration between keyframes
- Bezier values remain identical before and after global delay operations
- Works across all property types (Position, Opacity, Scale, Rotation, effects, etc.)
- Matches the sophisticated easing preservation already working in duration stretch and delay nudge operations

### 🔗 Associated Build
- AirBoard-v4.16.83.zxp

## [4.16.82] - 2025-01-12 🎯 **ENHANCEMENT: Smart Duration Snapping + Readout Fix**
### 🔧 Fixed
- **Duration Readout**: Fixed duration showing wrong value after stretch operations (e.g., showing 300ms when actual duration was 150ms)
- **Readout Required Re-read**: Previously clicking duration +/- would show incorrect value, requiring user to click "read" again to see correct value

### ✨ Enhanced
- **Smart Snapping for Multi-Property**: Added 50ms increment snapping to multi-property duration changes
- **Odd Duration Handling**: Multi-property duration now snaps odd durations (like 1183ms) to nearest 50ms increment when clicking +/-
- **Consistent Behavior**: Multi-property duration now matches single-property smart snapping behavior

### 🔬 Technical Details
- **Root Cause (Readout)**: `stretchKeyframesForCrossProperty` calculated total span across all keyframes instead of checking if properties had same duration
- **Solution**: Changed to collect each property's duration and check if all are the same (with 1ms tolerance)
  - Returns actual duration when all properties have same duration
  - Returns -1 flag for "Multiple" when properties have different durations
- **Smart Snapping Implementation**: Modified `stretchPropertyDurationWithCache` to:
  1. Apply frame delta to current duration
  2. Snap result to nearest 50ms increment
  3. Ensure minimum of 1 frame duration
  4. Return snapped duration in milliseconds

### 🎯 Impact
- Duration readout now shows correct value immediately after stretch operations
- No more need to click "read" again to see actual duration
- Multi-property duration changes now snap to clean 50ms increments
- Works for all selection scenarios (multiple properties on same/different layers)

### 🔗 Associated Build
- AirBoard-v4.16.82.zxp

## [4.16.81] - 2025-01-12 🐛 **CRITICAL FIX: Multi-Property Duration + Layer Snap**
### 🔧 Fixed
- **Multi-Layer Duration Freeze**: Fixed freeze and line 2675 error when changing duration with multiple properties on different layers
- **Multi-Property Easing**: Fixed easing changes when changing duration with multiple properties on same layer
- **Duration Mode Detection**: Fixed incorrect mode detection causing only one property to process when multiple properties selected

### 🔬 Technical Details - Duration Bugs
- **Root Cause #1 (Freeze)**: Duration mode detection was using timing difference check (meant for delay operations only)
  - When multiple properties had same start time, incorrectly used single-property mode
  - Single-property mode can't handle multiple properties → freeze and error at line 2675
  - **Solution**: Count properties with selected keyframes, use multi-property mode if >1
- **Root Cause #2 (Easing)**: `stretchPropertyDurationWithCache` function restored original ease without scaling
  - Single-property mode correctly scaled ease, but multi-property mode didn't
  - Ease speed values need to scale inversely with duration changes to maintain visual curves
  - **Solution**: Added sophisticated ease scaling to `stretchPropertyDurationWithCache`:
    - First keyframe: preserve IN ease (doesn't affect previous keyframe)
    - Last keyframe: scale OUT ease based on distance to next keyframe
    - Middle keyframes: scale both IN and OUT ease
    - Uses `scaleEaseForDuration()` to maintain visual curve shape

### ✨ New Feature - Layer Snap to Playhead
- **Snap Layers**: When no keyframes selected, snap to playhead now snaps selected layers
- **Normal Mode**: Each layer's visual start position snaps independently to playhead
- **Shift Mode**: Preserves relative delays between layers (earliest layer → playhead, others maintain spacing)
- **Trim Support**: Correctly accounts for trimmed layers (uses inPoint for trimmed, startTime for natural)

### 🎯 Impact
- Duration changes now work correctly for:
  - ✅ Multiple properties on same layer (Position + Opacity)
  - ✅ Multiple properties on different layers
  - ✅ Single property selection
  - ✅ All easing preserved perfectly in all scenarios
- Snap to playhead now works with both keyframes and layers
- No more freeze/error when adjusting duration with complex selections

### 🔗 Associated Build
- AirBoard-v4.16.81.zxp

## [4.16.80] - 2025-01-12 🐛 **FIX: Trimmed Layer Content Sampling**
### 🔧 Fixed
- **Fit to Squircle Timing**: Fixed critical timing bug where content layers animated at wrong frames when squircle layer was trimmed
- **Content Sampling Formula**: Implemented correct `sourceRectAtTime()` formula for trimmed layers: `sourceTime = compTime - startTime`
- **Animation Synchronization**: Content layer scaling now perfectly syncs with squircle keyframe animations regardless of trim offset

### 🔬 Technical Details
- **Root Cause**: When sampling layer content with `sourceRectAtTime()`, After Effects does NOT automatically compensate for layer trim offset
- **Symptom**: Layer trimmed by 146 frames caused content to animate 146 frames offset from squircle keyframes
- **Example Scenario**: Squircle layer trimmed at frame 146 and slid back to frame 0 (startTime = -146). Width keyframe at comp frame 3, but content was animating at frame 146
- **Solution**: Use formula `sourceTime = time - layer.startTime` for all sourceRectAtTime() calls
- **Mathematical Proof**: At comp frame 3 with startTime = -146: sourceTime = 3 - (-146) = 149 (correct source frame)

### 🎯 Impact
- Fit to Squircle now works correctly with trimmed layers
- Content animations perfectly synchronized to shape layer keyframes
- Applies to both fitWidth and fitNone (padding) modes
- Works for text layers, shape layers, and precomps

### 📚 Documentation
- **Challenge 17 Added**: Documented complete solution in `docs/KEYFRAME_SYSTEM_SUMMARY.md`
- **Key Insight**: Timeline positioning (complex inPoint checks) vs Content sampling (simple compTime - startTime formula)
- **Wrong Approaches**: Documented all failed attempts to help future debugging

### 🔗 Associated Build
- AirBoard-v4.16.80.zxp

## [4.16.79] - 2025-01-10 🐛 **CRITICAL BUG FIX: Multi-Property Delay**
### 🔧 Fixed
- **Multi-Property Delay Regression**: Fixed critical bug where only the first selected property was delayed instead of all selected properties
- **Variable Name Collision**: Resolved ExtendScript scoping issue where nested loop variables overwrote the main loop counter
- **Selection Restoration**: All selected properties (Position, Opacity, Sliders, etc.) now move together correctly during timeline delay operations

### 🔬 Technical Details
- **Root Cause**: Main loop used `var i` to iterate through 10 cached properties, but 6 nested loops inside also used `var i`
- **ExtendScript Scoping**: Function-level scoping (not block-level) meant all `i` variables were actually the same variable
- **Symptom**: When first nested loop completed with `prop.numKeys=10`, it set `i=10`, causing outer loop condition `(i < 10)` to fail immediately
- **Solution**: Renamed all 6 nested loop variables from `var i` to `var keyIdx` to prevent collision
- **Evidence**: Debug logs showed "COMPLETED property 11/10" instead of "1/10", proving loop counter corruption

### 🎯 Impact
- Timeline delay operations now process all selected properties correctly
- Multi-property animations maintain synchronization during delay adjustments
- Selection is properly maintained across all properties after delay operations

### 🔗 Associated Build
- AirBoard-v4.16.79.zxp

## [4.16.78] - 2025-01-08 🎯 **PERFECT EASING PRESERVATION**
### ✨ Major Enhancement
- **Perfect Easing Preservation for Duration Stretch**: Bezier easing curves now remain pixel-perfect when changing keyframe duration (forward/backward)
- **Perfect Easing Preservation for Delay/Nudge**: Bezier easing curves now remain pixel-perfect when delaying or nudging keyframes (forward/backward)
- **Adjacent Keyframe Protection**: Keyframes before and after the selection maintain their easing exactly during timing operations
- **Smart Easing Scaling**: KeyframeEase speed values now scale inversely with duration changes (speed × time = value change)
- **Single Layer Property Stagger**: Stagger now works with multiple properties selected on a single layer (e.g., Position + Opacity + Scale)

### 🔧 Technical Implementation
- **Mathematical Foundation**: Implemented correct inverse scaling formula: `newSpeed = oldSpeed × (oldDuration / newDuration)`
- **Influence Preservation**: KeyframeEase influence (percentage) now correctly preserved unchanged during timing operations
- **Edge Case Handling**: First selected keyframe preserves IN ease, last selected keyframe scales OUT ease based on distance to next keyframe
- **Multi-Pass Restoration**: Implemented multi-pass restoration strategy to prevent After Effects cascade modifications
- **Original Value Tracking**: Captures and restores from ORIGINAL keyData values, not AE-modified values
- **Undo Group Fix**: Moved `app.endUndoGroup()` to end of operations to fix Ctrl+Z undo functionality
- **Property Order Tracking**: Added property encounter counter and sort key system for consistent stagger ordering
- **Stagger Calculation**: New `calculateSameLayerPropertyStagger()` function sorts properties by earliest keyframe time and property order

### 🎨 Impact
- **Duration Stretch**: All easing preserved perfectly for keyframes before, during, and after the selection
- **Delay/Nudge**: All easing preserved perfectly for keyframes before, during, and after the selection
- **Property Dimensions**: Works with 1D (Opacity), 2D (Scale), and 3D (Position) properties
- **User Experience**: Easing curves stay visually identical when only changing timing - no more unexpected easing changes

### 📚 Documentation
- **Advanced Technical Docs**: Added comprehensive "Advanced Easing Preservation" section to `docs/TECHNICAL_DOCS.md`
- **Mathematical Proofs**: Documented why speed must scale inversely with duration
- **Implementation Guide**: Complete guide with code examples, pitfalls, debugging tips, and testing approach
- **Line References**: Includes exact line numbers for all implementations

### 🔗 Associated Build
- AirBoard-v4.16.78.zxp

## [4.16.77] - 2025-01-06 🔧 **REPLACE SHAPE & UI IMPROVEMENTS**
### 🔧 Fixed
- **Replace Shape Scale Preservation**: Replace Shape now properly copies Rectangle Path Transform > Scale to the new squircle (previously only copied position and anchor point, causing size mismatches when original scale was not 100%)

### 🎨 UI/UX
- **Fit to Squircle Dropdown Labels**: Renamed dropdown options for clarity:
  - "Layers" → "Selected Layers"
  - "Layers + Padding" → "Selected Layers + Padding"
  - "Vertex Nulls" → "Add Vertex Nulls"

### 🔗 Associated Build
- AirBoard-v4.16.77.zxp

## [4.16.76] - 2025-01-06 ✨ **MIRROR KEYS ENHANCEMENTS**
### ✨ Added
- **Mirror Keys with Easing Preservation**: Non-spring keyframes now preserve their original easing curves when mirrored (previously all easing was cleared to linear)
- **Shift+Click Mirror with Delay Preservation**: Hold Shift while clicking Mirror Keys to mirror all selected keyframes while preserving relative timing and delays
- **Cross-Property Delay Mirroring**: Shift+click mirror now correctly reverses stagger delays between different properties (e.g., if Opacity starts first and Scale is delayed, the mirror will have Scale start first with Opacity delayed)

### 🎨 UI/UX
- **Debug Panel Support**: Mirror keys operations now output detailed debug information to the debug panel, showing timing calculations and delay reversals
- **Tooltip System Update**: Changed tooltip `white-space` from `nowrap` to `pre-line` to support multi-line tooltips

### 🔧 Technical
- **Global Timing Calculation**: Mirror keys now finds earliest and latest first keyframes across all selected properties to calculate proper stagger ranges
- **Spring Mirror with Delays**: Spring-based animations now respect reversed delays when using shift+click mirror
- **Comprehensive Debug Logging**: Added detailed logging for property delays, reversed delays, and new keyframe placement times

### 🔗 Associated Build
- AirBoard-v4.16.76.zxp

## [4.16.75] - 2025-11-05 🔧 **FIT TO SQUIRCLE MASK SCALE FIX**
### 🔧 Fixed
- **Mask Layer Scale**: Fixed bug where mask layer was created at incorrect scale (60% instead of 100%) when using Fit to Squircle with Padding
- **Compound Transform Issue**: Mask layer now properly resets scale to [100, 100] after parenting to avoid compound transforms
- **Existing Mask Layers**: Also resets scale on existing mask layers to fix any previous compound transform issues
- **Impact**: Mask layer now matches shape layer size exactly in all scenarios

### 🔗 Associated Build
- AirBoard-v4.16.75.zxp

## [4.16.74] - 2025-11-05 🔧 **FIT TO SQUIRCLE & FOLDER STRUCTURE V2**
### 🔧 Fixed
- **Fit to Squircle with Parented Shape Layers**: Fixed bug where content layers were positioned incorrectly (bottom-right corner) when shape layer had a parent
- **Parent Transform Chain**: Implemented proper layer space to composition space conversion that handles entire parent transform chain (position, scale, rotation)
- **Impact**: Fit to Squircle now works correctly whether shape layer has a parent or not

### 🎨 UI/UX
- **AE Folder Structure V2**: Updated project folder structure to simplified two-folder system
- **Renamed Folders**: `01 - Compositions` → `01 - Comps`, `03 - Assets` → `02 - Assets`
- **Removed**: `02 - Precomps` folder (precomps now nested within Desktop/Native folders)
- **Added**: `03_Precomps` subfolder to Desktop and Native in `01 - Comps`
- **Updated Assets**: Changed `zImported_projects` → `Projects`, removed Vector folder

### 🔧 Technical
- **Placeholder Organization**: Placeholder comps now properly nested in `02 - Assets > Projects > AirBoard Templates.aep > Device Templates > _Pre-comps > Placeholder`
- **Template Import Location**: All imported AE templates now go to `02 - Assets > Projects`
- **Folder Detection**: Updated all folder lookup logic to use new folder names

### 📊 New Folder Structure
```
01 - Comps
  ├── Desktop (01_Specs, 02_Lottie, 03_Precomps)
  ├── Native (01_Specs, 02_Lottie, 03_Precomps)
  └── zArchive
02 - Assets
  ├── Images
  ├── Projects
  ├── Reference
  ├── Renders
  └── Video
```

### 🔗 Associated Build
- AirBoard-v4.16.74.zxp

## [4.16.73] - 2025-02-01 🔧 **DURATION STRETCH FIX**
### 🔧 Fixed
- **Duration Stretch Snapping**: Fixed bug where duration stretch was using frame input as snapping interval instead of applying it as a delta
- **Correct Behavior**: Now properly applies frame delta (e.g., ±40 frames) then snaps result to nearest 50ms increment
- **Previous Bug**: 40 frame input would snap to 40-frame intervals instead of moving duration by 40 frames
- **Impact**: Duration operations now move keyframes by the exact frame amount specified in the input field

### 🔗 Associated Build
- AirBoard-v4.16.73.zxp

## [4.16.72] - 2025-01-31 🔧 **LIGHT & CAMERA SUPPORT**
### 🔧 Fixed
- **Global Delay on Lights**: Fixed bug where global delay nudging wasn't processing light layer keyframes (Intensity, Color, Cone Angle, etc.)
- **Global Delay on Cameras**: Added support for camera layer keyframes (Zoom, Depth of Field, Focus Distance, etc.)
- **Property Group Coverage**: Extended `moveKeyframesAfterTime` function to process `lightOption` and `cameraOption` property groups

### 🔗 Associated Build
- AirBoard-v4.16.72.zxp

## [4.16.71] - 2025-01-24 🔧 **FIT TO SQUIRCLE FIX**
### 🔧 Fixed
- **Fit to Squircle Error**: Fixed "hidden property" error that occurred when using Fit to Squircle operation
- **Property Access**: Improved error handling for shape layer property access

### 🔗 Associated Build
- AirBoard-v4.16.71.zxp

## [4.16.70] - 2025-10-21 🗂️ **FOLDER STRUCTURE CLEANUP**
### 🎨 UI/UX
- **Streamlined Folder Structure**: Removed unused folders from Finder folder creation
- **Removed "Figma" folder** from 01 - Assets subfolder structure
- **Removed "06 - Decks"** from root folder structure
- **Cleaner Organization**: Simplified folder structure for better workflow

### 🔧 Technical
- Updated createFinderFolderStructure function to exclude Figma and Decks folders
- Maintains existing folder hierarchy for other folders

### 📊 Updated Structure
```
01 - Assets
    ├── Images (Desktop, Native)
    ├── Reference (Stills, Videos)
    ├── Vector
    └── Video
02 - Exports (Video, Lottie)
03 - AE
04 - C4D
05 - Prototypes
```

### 🔗 Associated Build
- AirBoard-v4.16.70.zxp

## [4.16.69] - 2025-10-21 ✨ **GESTURE POSITIONING & GLOBAL DELAY CONTROL**
### ✨ New Features
- **iPhone UI Positioning**: Gesture compositions now automatically position under "iPhone UI" layer when present (maintains top-of-stack behavior when not found)
- **Shift+Click Skip Precomps**: Shift+click on delay buttons with no selection now skips precomp processing (moves only main comp layers, doesn't touch nested content)

### 🎨 UI/UX
- Gestures intelligently integrate with device mockup workflows
- More precise control over global delay operations with shift modifier

### 🔧 Technical
- Added automatic "iPhone UI" layer detection in gesture placement
- Added skipPrecomps parameter to nudgeFromPlayhead() function
- Modified precomp processing logic to respect skipPrecomps flag
- Leverages existing shift+click routing for seamless integration

### 📊 Behavior Matrix
- Normal click (no selection): Moves main comp + processes all precomp contents (recursive)
- Shift+click (no selection): Moves main comp only, skips all precomp contents
- Normal click (with selection): Timeline mode - all keyframes move together (unchanged)
- Shift+click (with selection): Baseline mode - baseline stays fixed (unchanged)

### 🔗 Associated Build
- AirBoard-v4.16.69.zxp

## [4.16.68] - 2025-01-13 ✨ **PLACEHOLDER SYSTEM & SNAP ENHANCEMENTS**
### ✨ New Features
- **Smart Placeholders**: Device comps now include "Replace Me" placeholder layers always scaled to 100% (no manual rescaling when swapping content)
- **Auto-Reuse**: Placeholders automatically shared across same-resolution comps (e.g., all @3x iPhone comps share "Placeholder - 393 @3x")
- **Snap Preserve Delays**: Shift+click Snap to Playhead preserves relative delays between properties (normal click = per-property snapping)

### 🎨 UI/UX
- Changed dropdown "iPhone UI - 393" to "iPhone - 393"
- Magenta placeholder comps in `Placeholder` folder for easy identification

### 🔧 Technical
- Created `getOrCreatePlaceholderComp()` with reuse detection
- Skips "Web - 1440" layer during Web Chrome copying (replaced with placeholder)
- Shift+click calculates global offset from absolute earliest keyframe

### 🔗 Associated Build
- AirBoard-v4.16.68.zxp

## [4.16.67] - 2025-01-13 🔧 **MIRROR KEYS VELOCITY CLEANUP**
### 🔧 Fixed - INITIAL VELOCITY REMOVAL
- **Spring Mirroring Cleanup**: Mirror Keys now removes "Initial Velocity:" lines from mirrored spring markers
- **Cleaner Markers**: Mirrored springs no longer include velocity data (which doesn't apply to mirrored animations)
- **Format Preservation**: Maintains all other spring parameters (stiffness, damping ratio, mass, preset name)

### 🔧 Technical Implementation
- **Smart Line Filtering**: Strips any line starting with "Initial Velocity:" (handles both array and single value formats)
- **Whitespace Handling**: Correctly detects velocity lines regardless of leading whitespace
- **Non-Destructive**: Preserves all blank lines, spacing, and Sproing format compatibility
- **Location**: jsx/main.jsx lines 16107-16120 in mirrorKeysFromPanel function

### 🎯 User Impact
- **Before**: Mirrored spring markers included "Initial Velocity: [1000.0, 0.0]" from original
- **After**: Mirrored markers only contain relevant spring physics parameters
- **Compatibility**: Maintains full Sproing unbake compatibility for mirrored springs

### 🔗 Associated Build
- AirBoard-v4.16.67.zxp

## [4.16.66] - 2025-01-13 🎯 **SMART FOLDER ORGANIZATION**
### ✨ New Features - RESPECTS USER FOLDER DELETIONS
- **Smart Folder Logic**: Plugin now respects user's intentional folder deletions (Specs, Lottie, etc.)
- **Fresh Project Detection**: Creates complete folder structure with all subfolders only for brand new projects
- **Existing Project Respect**: If "01 - Compositions" already exists, won't recreate deleted subfolders
- **Intelligent Composition Placement**: Tries Native/Desktop subfolder → Falls back to main folder → Creates minimal structure only if needed

### 🔧 Technical Implementation
- **Root Cause**: Previous logic always recreated full folder hierarchy, undoing user's deletions
- **Solution**: Check if "01 - Compositions" exists before creating structure
- **Fresh Project Path**: No existing folder → Create Desktop/Native with Specs/Lottie subfolders
- **Existing Project Path**: Folder exists → Respect user's organization, don't recreate deleted folders
- **Composition Logic**: Smart 3-tier fallback system for composition placement

### 🎯 User Impact
- **Before**: Deleting Specs/Lottie folders → They get recreated every time you make a comp
- **After**: Deleted folders stay deleted, plugin respects your organizational choices
- **Fresh Projects**: Still get complete professional folder structure automatically
- **Flexibility**: Users can customize their folder structure without fighting the plugin

### 🔗 Associated Build
- AirBoard-v4.16.66.zxp

## [4.16.65] - 2025-01-13 🔧 **FIT TO SQUIRCLE MASK ALIGNMENT FIX**
### 🔧 Fixed - CRITICAL MASK LAYER POSITIONING
- **Fixed Mask Layer Position**: Mask layers now correctly positioned at [0, 0] relative to parent shape layer
- **Perfect Alignment**: Eliminated position offset that was causing mask misalignment with shape layers
- **Keyframe Cleanup**: All keyframes now removed from mask layer before setting position to prevent setValue() errors

### 🔧 Technical Implementation
- **Root Cause**: Duplicated mask layer retained original position values, causing offset when parented
- **Solution**: Remove all keyframes from transform properties BEFORE parenting, then set position to [0, 0]
- **Order of Operations**: Keyframe removal → Parenting → Position reset → Effect cleanup
- **Properties Cleaned**: Position, Scale, Rotation, Opacity, and Anchor Point keyframes all removed

### 🔗 Associated Build
- AirBoard-v4.16.65.zxp

## [4.16.62] - 2025-10-09 🚀 **UI CONSOLIDATION & TEMPLATE SYNC**
### 🎨 UI/UX Improvements
- Unified all +/- controls to use the same button style and sizing (resolution, delay, duration, stagger)

### 🔧 Technical
- Resolution row now reuses `.stagger-controls`/`.stagger-btn` classes for consistency
- Cleaned up old `.number-controls` CSS and JS selectors

### 📦 Packaging
- Prepared production build v4.16.62
- Associated with AirBoard-v4.16.62.zxp

## [4.16.60] - 2025-10-08 🛡️ **SHIFT-CLICK DELAY PROTECTION FIX**
### 🎯 Fixed - BASELINE DELAY MODE PROTECTION
- **Shift-Click Delay Protection**: Fixed adjacent keyframe corruption when using shift+click on delay buttons (baseline delay mode)
- **Missing Data Structure**: Added `selectedKeys` array to `propertyDelays` structure so protection code can identify which keyframes are selected

### 🔧 Technical Implementation
- **Root Cause**: The `propertyDelays` structure was missing the `selectedKeys` property, causing `captureNextKeyframe(prop, propData.selectedKeys)` to receive `undefined`
- **Solution**: Added `selectedKeys: propData.selectedKeys` to propertyDelays structure at line 3849
- **Code Location**: jsx/main.jsx line 3849 in the `nudgeDelay` function's property delays building section
- **Protection Already In Place**: The capture (line 3986) and restore (lines 4099-4102) code was already there, just needed the correct data

### 🎨 UI Improvements
- **Updated Icon Layout**: Reorganized keyframe nudger top row - Read | Snap | Mirror | Stagger | Input
- **Updated Snap Icon**: Refined snap to playhead icon positioning and alignment
- **Updated Mirror Icon**: Enhanced mirror icon diamond size and positioning

### 🔗 Associated Build
- AirBoard-v4.16.60.zxp

## [4.16.59] - 2025-01-10 🛡️ **KEYFRAME PROTECTION SYSTEM**
### 🎯 Fixed - CRITICAL ADJACENT KEYFRAME PROTECTION
- **Spring Animation Corruption Fix**: Keyframes immediately after delay/duration/stagger/snap operations no longer get modified
- **Universal Protection System**: All keyframe manipulation functions now protect adjacent keyframes from After Effects' automatic modifications
- **Precision Animation Preservation**: Spring animations, bezier curves, and precise timing sequences maintain perfect integrity

### 🔧 Technical Implementation - COMPREHENSIVE PROTECTION
- **Reusable Helper Functions**: Created `captureKeyframeState()`, `restoreKeyframeState()`, `captureNextKeyframe()`, and `restoreNextKeyframe()` helper functions
- **Protected Operations**:
  - Snap to Playhead (regular and Time Remap paths)
  - Delay Nudging (forced timeline, regular timeline, and baseline modes)
  - Duration Stretching (all 4 stretch functions)
  - Stagger (all 3 stagger code paths)
  - Global Delay (`moveKeyframesAfterTime` function for Time Remap and regular properties)
- **Smart Index Calculation**: Handles keyframe index shifts during remove/add operations
- **Time-Based Fallback**: Multiple strategies ensure protection works in all scenarios

### 🎨 How It Works
1. **Before Operation**: Captures complete state of the keyframe after your selection (value, interpolation, ease curves, spatial tangents, labels)
2. **During Operation**: Your keyframes are removed and recreated at new times/values
3. **After Operation**: Restores the adjacent keyframe to its exact original state, preventing AE's auto-adjustments

### 🔗 Associated Build
- AirBoard-v4.16.59.zxp

## [4.16.58] - 2025-01-10 ✨ **KEYFRAME NUDGER ENHANCEMENTS**
### ✨ New Features
- **Mirror Keys**: Duplicates and reverses first/last selected keyframes with 30-frame spacing at playhead
- **Snap to Playhead**: Moves all selected keyframes to current playhead position
- **Stagger Direction Toggle**: Moved to top row for quick access to reverse layer stagger order
- **Global Frame Input**: Single frame input now controls delay, duration, and stagger increments
- **Smart Position Rows**: X/Y position distance rows only appear when reading position keyframes

### 🎨 UI Improvements
- Custom icons for mirror (21×18px) and snap to playhead (18×18px)
- Top row now contains: Snap | Mirror | Stagger Direction | Frame Input
- Cleaner interface with position rows hidden until needed
- Frame input shows "f" suffix for clarity

### 🔧 Technical
- ExtendScript ES3 fix: replaced `.map()` with for loops
- Preserves keyframe labels (reversed to match mirrored values)
- Linear interpolation on mirrored keys

### 🔗 Associated Build
- AirBoard-v4.16.58.zxp

## [4.16.57] - 2025-01-10 🎯 **REVERSE STAGGER & MARKER SYNC FIX**
### ✨ New Features
- **Fixed Reverse Stagger Direction**: Reverse stagger mode for keyframes now works consistently with layer stagger - clicking + or - in reverse mode correctly increments/decrements the stagger without snapping back to 0
- **Improved Marker Synchronization**: Markers now move with stagger if they're anywhere within the selected keyframe range (not just at exact keyframe times)
- **Hidden Gesture Bar by Default**: New gesture comps now hide the gesture bar by default for cleaner presentations

### 🎨 UI/UX Improvements
- **Position Row Visibility**: X and Y position rows in Keyframe Nudger now hide when there's no data, automatically showing when position data is available
- **Smart Margin Control**: Stagger row margin dynamically adjusts based on position row visibility for cleaner spacing

### 🔧 Technical Improvements
- **Bi-directional Sort Matching**: `calculateStagger()` now sorts layers in the same direction as staggers are applied (top-to-bottom for reverse mode, bottom-to-top for normal mode)
- **Interval Calculation Fix**: Interval detection in `applyStaggerToKeyframes()` respects stagger direction for accurate current stagger reading
- **Range-based Marker Detection**: Changed from exact-time matching to range-based detection - markers anywhere between first and last selected keyframe will move with the stagger

### 🔗 Associated Build
- AirBoard-v4.16.57.zxp

## [4.16.56] - 2025-01-10 🔧 **TIME REMAP DELAY FIX**
### 🐛 Bug Fixes
- **Fixed Time Remap Label Loss**: Time Remap keyframes now preserve their color labels when delayed
- **Fixed Time Remap Easing**: Time Remap keyframes now preserve their easing curves when delayed
- **Fixed Time Remap Values**: Time Remap keyframes now preserve their exact values when moved

### 🔧 Technical Improvements
- **Proper Value Storage**: Time Remap now uses stored keyframe values instead of recalculating after index shifts
- **Add-Before-Delete Pattern**: Follows documented approach using `setValueAtTime()` with stored values
- **Immediate Property Restoration**: Easing, labels, and interpolation restored immediately after creating each new keyframe
- **Complete Data Collection**: Now collects interpolation type, temporal ease, continuity, and labels for Time Remap

### 🔗 Associated Build
- AirBoard-v4.16.56.zxp

## [4.16.55] - 2025-01-10 🔧 **FIX MASK LAYER REUSE**
### 🐛 Bug Fixes
- **Fixed Mask Layer Reuse**: Existing mask layers now properly reused when adding new content to same Squircle
- **Removed trackMatteType Check**: Mask detection no longer fails when mask is actively being used as track matte

### 🔧 Technical Improvements
- **Simplified Mask Detection**: Removed `trackMatteType === NO_TRACK_MATTE` requirement from existing mask detection
- **Key Insight**: Once a mask layer is used as a track matte, its trackMatteType value changes, making the old check unreliable
- **More Reliable Detection**: Now identifies masks purely by parenting + ShapeLayer type + " - Mask" in name

### 🔗 Associated Build
- AirBoard-v4.16.55.zxp

## [4.16.54] - 2025-01-10 🔧 **FIX PARENTED SQUIRCLE DETECTION**
### 🐛 Bug Fixes
- **Fixed False Mask Layer Detection**: Parented Squircles no longer incorrectly identified as mask layers
- **More Specific Mask Detection**: Mask layers now identified by name containing " - Mask" in addition to other properties

### 🔧 Technical Improvements
- **Name-Based Mask Detection**: Added `layer.name.indexOf(" - Mask") !== -1` check to all mask layer detection logic
- **Distinguishes User Parenting**: User-parented Squircles for organization now work correctly with Fit to Squircle

### 🔗 Associated Build
- AirBoard-v4.16.54.zxp

## [4.16.53] - 2025-01-10 🔧 **FIT TO SQUIRCLE BUG FIXES**
### 🐛 Bug Fixes
- **Fixed Track Matte Detection**: Corrected mask layer identification to prevent modifying unselected layers' track mattes
- **Fixed Mask Layer Selection**: Prevents mask layers (e.g., "Squircle - Mask") from being incorrectly used as primary shape layers
- **Improved Error Handling**: Added helpful error alert when user accidentally selects mask layer instead of original Squircle

### 🎨 UX Improvements
- **Clear Error Messages**: Shows actionable alert: "Can't Fit to Squircle because you selected the track matte layer. Please select the original Squircle layer instead"
- **Prevents Duplicate Masks**: No longer creates "Squircle - Mask - Mask" when mask layer is accidentally selected

### 🔧 Technical Improvements
- **Non-Destructive Detection**: Mask layer detection no longer calls `setTrackMatte()` during identification, preventing side effects
- **Smart Layer Classification**: Identifies mask layers by properties (parented to shape layer + no track matte set) rather than testing track matte relationships
- **Proper DEBUG_JSX Usage**: Fixed TypeError from incorrect `DEBUG_JSX.error()` calls

### 📚 Documentation
- **New Guide**: Added `DEBUGGING_AND_ALERTS.md` with comprehensive debugging patterns and alert best practices
- **DEBUG_JSX Reference**: Complete documentation of log(), error(), and info() functions with examples

### 🔗 Associated Build
- AirBoard-v4.16.53.zxp

## [4.16.52] - 2025-09-29 📁 **ENHANCED FOLDER STRUCTURE**
### ✨ New Features
- **Enhanced Precomps Folder**: Added Desktop, Native, and zArchive subfolders to "02 - Precomps" structure
- **Missing Subfolder Restoration**: AE Folders button now restores missing subfolders when main folders exist
- **Complete Folder Structure**: Subfolder deletion is now automatically detected and restored

### 🔧 Technical Improvements
- **Intelligent Folder Detection**: Enhanced folder creation logic to check and restore any missing subfolders
- **Consistent Structure Maintenance**: Ensures project folder hierarchy remains complete and organized
- **Improved User Experience**: No need to manually recreate accidentally deleted subfolders

## [4.16.51] - 2025-09-28 🎯 **PROJECT PANEL FOLDER EXPANSION**
### ✨ New Features
- **Automatic Folder Expansion**: Device compositions now automatically expand their parent folder hierarchy in Project panel
- **Smart Composition Selection**: Newly created compositions are automatically selected and highlighted for immediate visibility
- **Surgical Folder Management**: Only expands target folders (01 - Compositions > Native/Desktop) without affecting other project folders

### 🎨 UI/UX Improvements
- **Eliminated Manual Navigation**: No more hunting through collapsed folders to find newly created compositions
- **Clear Visual Feedback**: New compositions immediately visible and selected in Project panel after creation
- **Non-Intrusive Expansion**: Preserves existing folder states while revealing only the relevant hierarchy

### 🔧 Technical Improvements
- **Enhanced moveCompositionToFolder()**: Added automatic folder hierarchy expansion and composition selection
- **Folder State Management**: Precise control over folder expansion without affecting unrelated project organization
- **Selection Management**: Smart selection handling that highlights new compositions while preserving workflow

## [4.16.50] - 2025-09-20 🚀 **CROSS-PROPERTY ENHANCEMENTS & STAGGER OPTIMIZATION**
### ✨ Major Improvements
- **60% Faster Stagger Operations**: Applied same performance optimization that improved delay nudging
- **Fixed Cross-Property Duration Reading**: Now shows total time span across ALL selected keyframes instead of individual properties
- **Enhanced Position Distance Detection**: Works on Shape layer properties, not just Transform Position

### 🔧 Technical Improvements  
- **Robust Property Detection**: Universal selectedProperties API usage for future-proof keyframe detection
- **Improved Duration Calculation**: Total span calculation for frame-based stretch operations
- **Universal Coverage**: Position distance works for Transform, Shape Contents, Effects, and any position-type properties
- **Eliminated Extra Selection Steps**: Fixed select/deselect/reselect cycles that caused visual flicker
- **Marker Processing Reordered**: Markers now move BEFORE keyframe operations (same as delay nudging)
- **Single Selection Pass**: Only one selection operation at end instead of multiple cycles
- **Smoother Large Keyframe Sets**: Dramatic performance improvement when staggering many keyframes

### 🔧 Technical Implementation - CRITICAL ARCHITECTURE FIX
- **STEP 1**: Process all markers before any keyframe operations to prevent selection interference
- **STEP 2**: Perform keyframe operations without selection conflicts
- **Final**: Single clean selection restoration (matches optimized delay nudging pattern)
- **Code Reduction**: Removed 290+ lines of redundant marker syncing code (~2 full sections)
- **Root Cause Fix**: Eliminated the fundamental cause of stagger performance issues

### 🎯 User Impact - PERFORMANCE BREAKTHROUGH
- **Before**: Multiple selection cycles caused visual flicker and performance lag with large keyframe sets
- **After**: Single smooth operation with no visual interruption, same performance as delay nudging
- **Consistency**: Stagger operations now match the responsiveness of delay nudging
- **Future-Proof**: Established pattern for all future keyframe manipulation optimizations

## [4.16.49] - 2025-09-18 ✨ **SQUIRCLE RESOLUTION SCALING**
### ✨ New Features
- **Resolution-Aware Squircle Radius**: Squircle radius now scales automatically with resolution multiplier
- **Normal Click**: 400x400 squircle with radius = `32 × resolution multiplier` (64px at @2x, 128px at @4x, etc.)
- **Shift+Click**: Comp-sized squircle with radius = `54 × resolution multiplier` (108px at @2x, 216px at @4x, etc.)
- **Automatic Detection**: Reads current resolution setting from UI and applies appropriate scaling
- **Visual Consistency**: Ensures squircles look proportionally correct at all resolution scales

### 🎨 UI/UX Improvements
- **Enhanced Tooltip**: Updated squircle button tooltip to indicate resolution scaling behavior
- **Seamless Integration**: Feature automatically adapts to user's current resolution setting
- **Backward Compatible**: Existing behavior at @2x resolution remains identical

### 🔧 Technical Improvements
- **Parameter Passing**: Enhanced squircle functions to accept resolution multiplier parameter
- **Smart Calculation**: Base radius calculations (32px and 54px at @1x) with proper scaling
- **Consistent Pattern**: Follows same resolution scaling philosophy used throughout AirBoard plugin

## [4.16.48] - 2025-09-18 🎯 **SHAPE LAYER GLOBAL DELAY FIX**
### 🎯 Fixed - CRITICAL SHAPE LAYER PROCESSING
- **Fixed Size Keyframes**: Size keyframes on Shape layers now properly move with global delay operations
- **Universal Key ID System**: Replaced custom keyID generation with `getFullPropertyPath()` function for bulletproof uniqueness
- **Multiple Shape Groups**: All Size properties across different shape groups (Rectangle 1, Rectangle 2, Ellipse 1, etc.) now process correctly
- **Duplicate Detection Fix**: Eliminated false duplicate detection that was skipping keyframes after the first shape group
- **Enhanced Debug Logging**: Added comprehensive logging for Shape layer content processing and Size property detection

### 🔧 Technical Improvements - UNIVERSAL PROPERTY IDENTIFICATION
- **Root Cause Resolution**: Multiple Size properties were generating identical keyIDs causing duplicate detection system to skip processing
- **Universal Solution**: `getFullPropertyPath()` creates unique identifiers for ALL property types including Shape contents, Effects, Transform, etc.
- **Future-Proof Pattern**: Solution works for any scenario with multiple properties of same type in different groups
- **Enhanced Documentation**: Added Challenge 10 to KEYFRAME_SYSTEM_SUMMARY.md documenting Shape layer property unique identification

### 🎯 User Impact
- **Before**: Only first Size property processed → Remaining Size keyframes not moved by global delay
- **After**: All Size properties get unique identifiers → All Size keyframes moved correctly
- **Reliability**: Global delay now works consistently with complex Shape layers containing multiple animated shape groups

## [4.16.46] - 2025-09-17 🔧 **GLOBAL DELAY DURATION FIX**
### 🔧 Fixed - SMART COMPOSITION DURATION HANDLING
- **Never Shrink Compositions**: Global delay operations now never make compositions shorter when moving content backward
- **Predictable Extension**: When moving content forward, compositions extend by exactly the delay amount (not to furthest content position)
- **Precomp Intelligence**: All nested precomps (up to 5 levels) follow the same smart duration logic
- **User-Friendly Behavior**: Avoids "crazy long comp" issue when long background layers extend far beyond main animation content

### 🎯 Technical Improvements
- **Forward Movement**: Always extends comp by exactly `timeOffset` (e.g., +3 frames = comp gets 3 frames longer)
- **Backward Movement**: Never changes comp duration, preventing unwanted shrinking
- **Nested Precomps**: Applied consistent logic to all precomp levels for predictable behavior
- **Simple & Reliable**: More intuitive duration changes that match user expectations

## [4.16.42] - 2025-09-12 🔧 **TIME REMAP STAGGER FIX**
### 🔧 Fixed
- **Time Remap Stagger**: Fixed Time Remap keyframes getting deleted during stagger operations
- **Selection Preservation**: Time Remap keyframes now properly stagger and remain selected after operations
- **Add-Before-Delete Pattern**: Implemented complete "add-before-delete" pattern following KEYFRAME_SYSTEM_SUMMARY.md guidelines
- **Property Name Fix**: Corrected data.time vs data.oldTime mismatch in stagger system
- **Phase 2 Skip**: Time Remap properties now skip deletion phase and are handled entirely in Phase 3

### 🎯 Technical Improvements
- **Keyframe Verification**: Added verification that keyframes exist before moving them
- **Safe Removal**: Old keyframes are only removed after new ones are successfully created
- **Debug Logging**: Enhanced logging for Time Remap stagger operations
- **Pattern Compliance**: Follows documented Time Remap handling patterns from Challenge 13

## [4.16.39] - 2025-09-12 ✨ **FINDER AUTO-OPEN**
### ✨ New Features
- **Automatic Finder Opening**: Finder window now automatically opens after creating project folder structure
- **Seamless Workflow**: User selects location → folders created → Finder opens automatically showing the new structure
- **Silent Operation**: Removed success alert dialogs since Finder window provides visual confirmation

### 🎨 UI/UX Improvements
- **Cleaner Experience**: No more alert pop-ups interrupting the workflow
- **Visual Feedback**: Finder window serves as both confirmation and immediate access to created folders
- **One-Click Flow**: Complete project setup with minimal user interaction

## [4.16.33] - 2025-09-07 🎨 **UI REFINEMENT**
### 🎨 UI/UX Improvements
- **Section Corner Rounding**: Tested various border-radius values (6px, 8px, 10px) for optimal appearance
- **Visual Polish**: Refined section container corners, settled on 6px for best visual balance
- **CSS Styling**: Minor adjustments to section container border-radius property

## [4.16.32] - 2025-09-07 🎨 **UI ENHANCEMENTS**
### 🎨 UI/UX Improvements  
- **Section Backgrounds**: Lightened section containers from #272727 to #2a2a2a for better contrast
- **Button Styling**: Updated button backgrounds from #2f2f2f to #333333 for improved visibility
- **Drop Shadows**: Added subtle shadows to sections for depth (0 2px 8px rgba(0,0,0,0.15))
- **Divider Lines**: Added two-tone dividers between subsections for visual separation
- **Spacing Refinements**: Added 4px padding below subsection titles (SHAPE, EFFECTS, SHIMMER)
- **Title Brightness**: Increased subsection title color to #f5f5f5 for better readability
- **Visual Hierarchy**: Improved overall visual organization with dividers and spacing

## [4.16.31] - 2025-09-07 🔧 **STAGGER TIME REMAP SUPPORT**
### ✨ New Features
- **Time Remap Stagger Support**: Added full Time Remap keyframe support to stagger feature
- **Special Handling**: Implemented setValueAtTime() pattern for Time Remap to prevent keyframe deletion
- **Add-Before-Delete Pattern**: Time Remap keyframes now use safe movement pattern during stagger operations

### 🎨 UI/UX Improvements
- **Shape Control Consolidation**: Combined Add Squircle/Replace Rect into dropdown + button interface
- **Dropdown Options**: "New Shape" and "Replace Shape" in dropdown with single "Add Squircle" button
- **Button Renaming**: Changed "Fit To Rect" to "Fit to Squircle" throughout the interface
- **Cleaner Layout**: Reduced button clutter by consolidating related actions into dropdowns

### 📚 Documentation
- **README Reorganization**: Moved "Get the Plugin" section above "What It Does" for better visibility
- **Section Cleanup**: Removed redundant "Key Features" section from README

## [4.16.7] - 2025-09-05 🔧 **EFFECT NAME-BASED KEY IDS**
### 🔧 Fixed - TINT 2 EFFECT PROCESSING
- **Effect Name-Based KeyIDs**: Changed duplicate detection to use actual effect names (e.g., "Tint" vs "Tint 2") instead of effect indices
- **Reliable Effect Distinction**: KeyID generation now uses `parentEffect.name` directly for guaranteed uniqueness between effect instances
- **Enhanced Debug Output**: Added special debugging for Tint effects to show exact keyID generation for troubleshooting
- **Robust Effect Processing**: Eliminates false duplicate detection when multiple effects of same type have identical properties

### 🔧 Technical Implementation - EFFECT NAME IDENTIFICATION
- **KeyID Pattern**: Changed from effect index approach to `parentEffect.matchName + "_" + parentEffect.name + "_" + uniquePropertyId`
- **Expected KeyIDs**: "Tint" generates `ADBE Tint_Tint_ADBE Tint-0003`, "Tint 2" generates `ADBE Tint_Tint 2_ADBE Tint-0003`
- **Direct Name Usage**: Uses effect's display name which After Effects guarantees to be unique within layer
- **Debug Enhancement**: Special logging for Tint effects shows exact keyID for each effect instance
- **Associated with AirBoard-v4.16.7.zxp**

## [4.16.3] - 2025-09-05 🔧 **DUPLICATE KEY & DEBUG FIXES**
### 🔧 Fixed - DUPLICATE KEY DETECTION & CONCISE DEBUG
- **Fixed Effect Keyframe Processing**: Resolved issue where Tint 2 and Brightness & Contrast effect keyframes were incorrectly skipped as "duplicate keys"
- **Enhanced Unique Key IDs**: Updated duplicate detection to use full property path including parent effect matchName to avoid conflicts between effects
- **Concise Debug Messages**: Simplified verbose debug output by removing excessive emoji usage and making messages more focused
- **Improved Debug Clarity**: Shortened repetitive processing messages (e.g., "🎬 Processing cached property..." → "Process: PropertyName (5 keys)")
- **Cleaner Log Output**: Reduced debug noise while maintaining essential information for troubleshooting

### 🔧 Technical Implementation - ROBUST EFFECT IDENTIFICATION
- **Unique Property Identification**: Changed keyId generation from `propertyIndex` to `parentEffect.matchName + "_" + prop.matchName` pattern
- **Effect Conflict Prevention**: Prevents different effects with same property indices from being flagged as duplicates
- **Debug Message Optimization**: Replaced verbose emoji-heavy messages with concise, scannable format
- **Maintained Debug Functionality**: All essential debugging information preserved in more readable format
- **Associated with AirBoard-v4.16.3.zxp**

## [4.16.2] - 2025-09-05 🔧 **EFFECT PROCESSING ROBUSTNESS**
### 🔧 Fixed - ENHANCED GLOBAL DELAY EFFECT HANDLING
- **Hue/Saturation Exclusion**: Added proper exclusion logic for Hue/Saturation effects which can't be moved reliably by global delay
- **Enhanced Error Handling**: Added comprehensive validation and error handling for effect properties during global delay operations
- **Improved Effect Debugging**: Added detailed logging for effect property processing and recursion to help troubleshoot issues
- **Better Effect Recursion**: Enhanced recursive processing of effect groups with error recovery for complex nested effects
- **Property Access Validation**: Added keyframe accessibility testing before attempting to process effect properties

### 🔧 Technical Implementation - ROBUST EFFECT PROCESSING
- **Smart Effect Exclusion**: Skip problematic effects (Hue/Saturation) by name and matchName detection
- **Keyframe Access Testing**: Test keyframe accessibility with try/catch before processing effect properties
- **Parent Effect Detection**: Walk property hierarchy to identify and log parent effect names for debugging
- **Recursive Error Recovery**: Graceful error handling when recursing into complex effect property groups
- **Enhanced Debug Output**: Detailed logging shows which effects are processed vs skipped with reasons
- **Associated with AirBoard-v4.16.2.zxp**

## [4.16.1] - 2025-09-05 🎨 **UI IMPROVEMENTS**
### 🎨 Fixed - UI REFINEMENTS
- **Tooltip Font Weight**: Reduced tooltip font-weight from 600 to 400 for lighter, more readable text
- **iPhone Composition Names**: Fixed capitalization from "Iphone @2x" to "iPhone @2x" for all iPhone device types (iPhone, iPhone15, iPhone-simple)
- **iPhone UI Component Positioning**: iPhone UI component now always starts at frame 0 instead of playhead position, while all other components maintain playhead positioning
- **Consistent Branding**: Proper "iPhone" capitalization across all generated compositions
- **Associated with AirBoard-v4.16.1.zxp**

### 🔧 Technical Implementation - TARGETED IMPROVEMENTS
- **Tooltip Styling**: Updated JavaScript tooltip font-weight property in client/js/main.js
- **Composition Naming Logic**: Enhanced device composition naming with specific iPhone capitalization handling
- **Component Positioning Logic**: Added conditional startTime setting for iPhone UI vs other components
- **Backwards Compatibility**: All changes maintain existing functionality for non-iPhone elements

## [4.16.0] - 2025-09-05 🎯 **GLOBAL DELAY NUDGING - COMPLETE FIX**
### 🎯 Fixed - COMPREHENSIVE GLOBAL DELAY SYSTEM
- **Fixed Cascading Double Movement**: Resolved issue where nested precomps (two levels deep) were moving layers and keyframes 2x further than intended
- **Fixed Label Double Movement**: Layer labels in nested precomps no longer get moved twice when layers are moved entirely
- **Enhanced Timeline-Based Logic**: Updated main comp precomp processing to use consistent `layerTimelineInPoint < playheadTime` logic
- **Precomp Cache Refresh Fix**: Automatic cache invalidation for precomp layers to eliminate "empty frames at end" visual bug
- **Nested Precomp Prevention**: Added check to skip processing nested precomp contents when the precomp layer was moved entirely
- **Label Processing Fix**: Updated `moveLabelsAfterTime` to skip labels on layers that were moved entirely (preventing double movement)
- **Universal Double Movement Prevention**: Applied consistent prevention logic across all levels: main comp, precomp level 1, precomp level 2
- **Associated with AirBoard-v4.16.0.zxp**

### 🔧 Technical Implementation - ROBUST NESTED PROCESSING
- **Main Comp Logic**: Uses `layerTimelineInPoint < playheadTime` for precomp processing decisions
- **Nested Precomp Logic**: Added `layerTimelineInPoint < precompPlayheadTime` check before processing nested precomp contents
- **Label Movement Logic**: Enhanced to use timeline-based layer movement detection and skip moved layers
- **Cache Refresh System**: Automatic outPoint adjustment (shrink 1 frame, restore) to force AE cache invalidation
- **Debug Enhancement**: Comprehensive logging shows exactly which precomps are processed vs skipped at each depth level

## [4.15.0] - 2025-09-03 🎯 **ENHANCED ERROR MESSAGING**
### 🎯 Added - COMPREHENSIVE ERROR MESSAGING
- **Duration Error Clarity**: Added "Select > 1 Keyframe" error message throughout all duration controls
- **Smart Keyframe Detection**: Automatically detects insufficient keyframes for duration operations
- **Read Keyframes Integration**: Shows error in duration row when only 1 keyframe selected or no duration span
- **Cross-Property Awareness**: Handles multiple keyframes across different properties with no meaningful duration (0ms)
- **Zero Duration Detection**: Identifies when keyframes provide no duration span for stretch operations
- **Consistent UX**: Unified error messaging across duration buttons and keyframe reader
- **Special Flag System**: Uses -999 duration flag to communicate error states between ExtendScript and JavaScript
- **Selective Error Display**: Shows errors only in duration field while preserving other field values
- **Associated with AirBoard-v4.15.0.zxp**

## [4.14.0] - 2025-09-03 🎯 **EASING PRESERVATION FIX**
### 🎯 Fixed - COMPREHENSIVE EASING PRESERVATION
- **Baseline Keyframe Easing**: Fixed baseline keyframes losing easing curves during delay nudging operations
- **Duration Operation Easing**: Applied comprehensive easing preservation fix to all duration stretching functions
- **Universal Pattern**: Updated temporal ease restoration to match timeline mode pattern across all operations
- **Stagger Operations**: Enhanced stagger functions with proper temporal and spatial easing preservation
- **Mixed Easing Support**: Now handles Ease In, Ease Out, and mixed easing types correctly (not just full bezier)
- **Error Handling**: Added try-catch protection around all temporal ease collection and restoration
- **Spatial Properties**: Position keyframes now preserve spatial curves and tangents perfectly
- **Selection Maintenance**: Baseline keyframes maintain selection while preserving easing
- **Associated with AirBoard-v4.14.0.zxp**

## [4.12.5] - 2025-09-03 🔧 **DURATION FIXES**
### 🔧 Fixed - DURATION BUTTON IMPROVEMENTS
- **Duration Display Calculation**: Fixed cross-property duration readout showing incorrect values after stretching
- **Selection Preservation**: Duration buttons now maintain selections across all properties (no more deselection)
- **Total Span Logic**: Duration display now calculates total span from earliest to latest keyframe (matches reading function)
- **Cross-Property Support**: Proper handling of multiple properties with different duration spans
- **Associated with AirBoard-v4.12.5.zxp**

### 🔧 Technical Implementation - DURATION SYSTEM OVERHAUL
- **Selection System**: Implemented complete 4-step selection preservation from KEYFRAME_SYSTEM_SUMMARY.md
- **Cache Strategy**: Cache all selections before manipulation, use fresh property references after
- **Span Calculation**: Changed from Math.max(individual durations) to total earliestTime→latestTime span
- **Debug Logging**: Added comprehensive step-by-step debugging for selection preservation process
- **Pattern Consistency**: Duration now uses same selection preservation as working delay/stagger functions

## [4.12.4] - 2025-09-02 🔧 **STAGGER EASING FIX**
### 🔧 Fixed - STAGGER KEYFRAME EASING PRESERVATION
- **Fixed Stagger Easing Bug**: Stagger +/- buttons now preserve exact keyframe easing curves like delay/duration buttons
- **Scale Keyframes**: Scale (and all other properties) maintain their original bezier easing during stagger operations
- **Temporal Ease Logic**: Fixed collection and restoration of temporal ease data to match working delay/duration pattern
- **Associated with AirBoard-v4.12.4.zxp**

### 🔧 Technical Implementation - EASING PRESERVATION FIX
- **Collection Logic**: Changed from individual interpolation checks to OR logic (if EITHER inInterp OR outInterp is bezier, collect both eases)
- **Storage Format**: Changed from null to undefined to match working delay/duration pattern  
- **Restoration Check**: Changed from requiring both eases to checking only inEase !== undefined
- **Pattern Consistency**: Stagger easing now uses exact same logic as delay/duration buttons (jsx/main.jsx:5162-5163, 5188)

## [4.12.3] - 2025-09-02 📦 **VERSION INCREMENT**
### 📦 Updated
- **New build**: Latest production build with version increment
- **Associated with AirBoard-v4.12.3.zxp**

## [4.12.2] - 2025-08-30 🔧 **NUDGE FUNCTIONALITY FIX**
### 🔧 Fixed - MULTIPLE POSITION PROPERTY NUDGING
- **Fixed Multi-Layer Position Nudging**: Position nudge buttons now move ALL selected position properties across multiple layers, not just one
- **Corrected Display Values**: Fixed display showing incorrect values (49999999.5px) when nudging multiple properties with "Multiple" flag
- **Enhanced Error Handling**: Added proper error handling and logging for each position property during nudging operations
- **Improved Backend Logic**: Modified `nudgePositionAxis()` function to process all collected position properties individually
- **Frontend Display Fix**: Added check for -999999 "Multiple" flag to prevent math operations that caused display errors

### 🎮 User Experience - SEAMLESS MULTI-LAYER WORKFLOW
- **Consistent Nudging Behavior**: All selected position keyframes now move simultaneously when using X/Y nudge buttons
- **Accurate Value Display**: Position distances show actual values when same across layers, "Multiple" when different
- **No More Display Errors**: Eliminated 49999999.5px errors caused by calculations on flag values
- **Universal Multi-Layer Support**: Works with position properties across any number of selected layers

### 🔧 Technical Implementation - ROBUST POSITION PROCESSING
- **Enhanced Collection Logic**: Improved `allPropertiesToNudge` array to gather all position properties from all selected layers
- **Individual Property Processing**: Changed from single property processing to loop-based processing of all collected properties
- **Smart Flag Handling**: Frontend JavaScript now checks for special flag values before performing calculations
- **Comprehensive Logging**: Added detailed debug logging for each position property processing step

## [4.11.2] - 2024-12-28 📦 **PREVIOUS BUILD**
### 📦 Updated
- **New build**: Latest production build with all recent improvements

## [4.11.1] - 2024-12-28 🔧 **TEMPLATE FIX**
### 🔧 Fixed
- **AirBoard Templates.aep**: Updated template file with minor fixes

## [4.11.0] - 2024-12-28 🎯 **STAGGER DIRECTION & PRECISION IMPROVEMENTS**
### ✨ Added - Enhanced Stagger Control
- **Stagger Direction Toggle**: New button to switch between bottom-to-top (default) and top-to-bottom layer ordering
  - Visual indicator: Icon flips horizontally to show active direction
  - Works for both keyframe and layer staggering
  - Persistent state during session
- **Layer Marker Syncing with Stagger**: Layer markers now move with keyframes during stagger operations
  - Markers on the same frame as keyframes stay synchronized
  - Maintains frame-perfect alignment between markers and keyframes
  - Works with both stagger directions (top-to-bottom and bottom-to-top)
  - Preserves marker properties (comments, duration, etc.)
- **Enhanced Tooltips**: 
  - "Stagger direction" tooltip for direction toggle button
  - "First keyframe" tooltip for In buttons (X and Y distance)
  - "Last keyframe" tooltip for Out buttons (X and Y distance)

### 🔧 Fixed - Rounding Precision
- **Improved Millisecond Rounding**: Fixed issue where values would show 1ms instead of 0ms
  - Added `roundMs()` helper function for more accurate rounding
  - Values less than 0.5ms now correctly round to 0ms (prevents 0.4ms → 1ms)
  - Reduces floating point precision errors in stagger/delay/duration calculations
- **Affected Areas**: Stagger, delay, and duration calculations all use improved rounding

## [4.10.0] - 2024-12-28 🎉 **KEYFRAME NUDGER FEATURE COMPLETE**
### ✨ Added - COMPREHENSIVE KEYFRAME NUDGING SYSTEM
- **Multi-Property Selection Preservation**: Fixed complex issue where selecting keyframes across multiple properties (Position + Opacity) would lose selection during nudging operations
- **Smart Duration Snapping**: Duration nudging now intelligently snaps to intervals based on frame input (e.g., 3 frames = 50ms intervals at 60fps)
- **Multi-Layer Position Display**: Shows "X: Multiple" / "Y: Multiple" when position properties from different layers are selected
- **Complete UI Display Fix**: Read Keyframes button now properly displays all values (Duration, Delay, X distance, Y distance, Stagger)

### 🔧 Technical Implementation - SELECTION PRESERVATION SOLUTION
- **Selection Caching System**: Cache all keyframe selections before ANY manipulation begins
- **Fresh Property References**: Re-acquire property references after keyframe manipulation to avoid stale references
- **Explicit Deselection/Selection**: First deselect ALL keyframes, then select only desired ones
- **Avoided Auto-Selection Bug**: Never use `prop.selected = true` which causes After Effects to auto-select all keyframes

### 🎯 Fixed - CRITICAL BUGS RESOLVED
- **Fixed Missing Variable Declarations**: Added `durationText` and `durationValue` declarations in handleReadKeyframes
- **Removed Non-Existent Element References**: Cleaned up references to elements that don't exist in HTML
- **Fixed JavaScript Indentation**: Corrected code structure that was causing execution failures
- **Fixed Cross-Property Mode Detection**: Properly handles multiple properties with different durations

### 🚀 Smart Snapping Algorithm
- **Dynamic Interval Detection**: Snapping interval adjusts based on frame input value
- **Intelligent Snap Direction**: 
  - If not snapped: Snaps to nearest interval in direction of nudge
  - If already snapped: Moves by exactly one interval
- **Example (467ms with 3-frame/50ms intervals)**:
  - First + click: 467ms → 500ms (snap to next interval)
  - Second + click: 500ms → 550ms (add interval)
  - First - click: 467ms → 450ms (snap to previous interval)

### 📚 Documentation
- **Updated KEYFRAME_SYSTEM_SUMMARY.md**: Complete solution documentation for keyframe selection preservation
- **Comprehensive Debug Logging**: Added throughout for easier troubleshooting
- **Code Comments**: Detailed explanations of critical sections

### 🎮 User Experience
- **Consistent Selection Behavior**: Keyframes stay selected across all nudging operations
- **Clear Multiple Values Display**: No more confusing sums when multiple layers selected
- **Reliable Read Button**: All keyframe information displays correctly on first click
- **Predictable Snapping**: Duration changes snap intelligently to clean intervals

## [4.9.5] - 2025-08-28 ✨ **LATEST RELEASE**
### 🎯 Added - LABEL SYNCING FOR DELAY NUDGING
- **Layer Marker Syncing**: Layer markers at the same frame as first keyframes now move synchronously with delay nudging operations
- **Multiple Marker Type Support**: Works with both layer markers (added with `*` key) and composition markers
- **Universal Delay Mode Integration**: Functions in all delay nudging modes - timeline position, baseline adjustment, and forced timeline
- **Keyframe Selection Preservation**: Keyframes remain selected after marker operations, enabling repeated delay adjustments
- **Smart Frame Detection**: Detects markers within 0.5 frame tolerance of first keyframes for precise synchronization

### 🔧 Technical Implementation - MARKER SYNC SYSTEM
- **Post-Undo Marker Processing**: Marker operations execute after main undo group to prevent keyframe selection clearing
- **Separate Undo Groups**: Marker syncing uses dedicated undo groups for clean undo history ("Sync Layer Markers")
- **Explicit Selection Restoration**: Comprehensive keyframe selection restoration system maintains selection state
- **Multi-Layer Support**: Processes markers across all selected layers with keyframe operations
- **Robust Error Handling**: Graceful fallbacks ensure delay nudging works even if marker syncing fails

### 🎮 User Experience - SYNCHRONIZED ANIMATION WORKFLOW
- **Seamless Label Movement**: Labels/markers move automatically with keyframes - no manual repositioning needed
- **Consistent Multi-Click Behavior**: Repeated delay nudging works correctly without switching to unwanted layer nudging mode
- **Timeline Synchronization**: Markers maintain exact frame alignment with first keyframes through all operations
- **Non-Destructive Workflow**: Marker syncing never interferes with core keyframe delay functionality
- **Debug Visibility**: Comprehensive debug logging for troubleshooting marker sync operations

## [4.9.4] - 2025-08-28
### 🎯 Fixed - STAGGER READOUT ACCURACY & SIGN CALCULATION
- **Fixed Stagger Sign Detection**: Stagger calculation now correctly shows negative values when top layer keyframes are earlier than bottom layer keyframes (e.g., -50ms when top layers lead)
- **Fixed Stagger Readout Accuracy**: Stagger display now shows actual keyframe timing state instead of calculated operation results
- **Eliminated UI Race Conditions**: Removed immediate stagger display updates that overrode accurate readings
- **Consistent Layer Index Sorting**: Both keyframe and layer stagger calculations now use bottom-to-top layer index sorting for correct sign detection

### 🔧 Technical Implementation - STAGGER SYSTEM IMPROVEMENTS
- **ExtendScript Compatibility**: Replaced unsupported `indexOf()` method with manual array search for ExtendScript compatibility
- **Unified Stagger Calculation**: `calculateStagger()` function now uses consistent layer index sorting for both keyframes and layers
- **Automatic State Reading**: Stagger operations automatically trigger `handleReadKeyframes()` after completion to display true timeline state
- **Enhanced Debug Logging**: Comprehensive debug output for stagger calculation troubleshooting and development

### 🎮 User Experience - ACCURATE STAGGER FEEDBACK
- **True Timeline State Display**: Stagger readout always reflects actual keyframe positions (e.g., shows "0ms" when keyframes are aligned, not operation result like "-50ms")
- **Correct Positive/Negative Detection**: Negative staggers properly display when top layers animate before bottom layers
- **Reliable Stagger Nudging**: Both keyframe and layer stagger operations work consistently with accurate sign detection
- **Clean UI Updates**: Stagger display updates smoothly without conflicting calculated vs actual values

## [4.9.3] - 2025-08-23 ✨ **CURRENT RELEASE**
### 🎯 Added - TIMELINE POSITION NUDGING SYSTEM
- **Timeline Position Nudging**: When ALL selected keyframes have the same baseline time, Delay +/- buttons now move ALL keyframes together by 50ms increments in the timeline
- **Smart Mode Detection**: Automatically switches between Timeline Mode (all keyframes at same baseline) and Baseline Mode (different baseline times)
- **Perfect Easing Preservation**: Maintains all temporal and spatial curve properties (ease curves, bezier handles, continuity settings)
- **Full Keyframe Selection**: All originally selected keyframes remain selected after timeline nudging operations
- **Universal Property Support**: Works for single properties (multiple keyframes on one property) and multiple properties (keyframes across different properties)
- **Animation Timing Preserved**: Relative spacing between keyframes maintained during timeline shifts
- **50ms Timeline Increments**: Consistent timeline positioning with 0ms minimum clamping for backward nudging

### 🔧 Technical Implementation - ROBUST KEYFRAME SYSTEM
- **Intelligent Detection Logic**: Detects when first keyframes across all properties are at same baseline time
- **Keyframe Recreation Approach**: Uses After Effects-compatible addKey/removeKey system instead of problematic setKeyTime()  
- **Comprehensive Property Preservation**: Preserves temporal ease, spatial tangents, interpolation types, continuity, and auto-bezier settings
- **Deferred Selection System**: Uses proven baseline-mode selection approach for reliable keyframe selection preservation
- **Timeline Offset Calculation**: Maintains relative keyframe spacing while shifting entire animation timeline
- **Error Handling**: Graceful fallbacks with proper undo group management for reliable operation

### 🎮 User Experience - SEAMLESS INTEGRATION
- **Context-Aware Behavior**: Same Delay +/- buttons intelligently switch between timeline nudging and baseline delay adjustment
- **Visual Feedback**: Clear indication of timeline vs baseline modes through consistent UI patterns  
- **Non-Destructive Operation**: Original animation curves and timing relationships perfectly preserved
- **Workflow Integration**: Seamlessly integrates with existing keyframe reading and delay adjustment workflows
- **Cross-Property Timeline Control**: Move keyframes across Position, Opacity, Scale, Rotation and any animatable properties simultaneously
- **Associated with AirBoard-v4.9.3.zxp**

## [4.9.2] - 2025-08-22
### ✨ Added - Cross-Property Delay Reading & Frame Notation
- **Cross-Property Delay Detection**: Keyframe Reader now detects delays between keyframes on different properties (e.g., Position vs Opacity)
- **Smart Mode Detection**: Automatically switches between "Duration" mode (single property, multiple keyframes) and "Delay" mode (multiple properties)
- **Multiple Property Logic**: Shows "Delay: Multiple" when 3+ properties have different delays, or "Delay: 50ms / 3f" when all delays match
- **Frame Notation Enhancement**: All delay displays now show both milliseconds and frames (e.g., "Delay: 117ms / 7f")
- **Updated Placeholder Text**: Changed from "Duration" to "Duration or Delay" to reflect dual functionality
- **Generic Property Support**: Works with any layer properties through recursive property traversal, not hardcoded to specific properties

### 🔧 Technical Implementation
- **New `readKeyframesSmart()` Function**: Replaces complex rewrite attempt with clean, simple routing system
- **Cross-Property Priority Logic**: Uses earliest keyframe time as baseline (0ms delay), calculates others relative to it
- **Generic Property Traversal**: Recursive search through all layer properties (`PropertyType.INDEXED_GROUP`, `PropertyType.NAMED_GROUP`)
- **Enhanced Display Logic**: JavaScript handles both cross-property and single-property modes with proper frame notation
- **Robust Multiple-Property Detection**: Compares delays between different properties while ignoring baseline (0ms) keyframe

### 🎯 User Experience Improvements
- **Intuitive Mode Detection**: System automatically determines whether you're working with single property (duration) or multiple properties (delay)
- **Clear Visual Feedback**: "Delay: Multiple" vs "Delay: 50ms / 3f" provides immediate understanding of timing relationships
- **Consistent Frame Display**: All timing displays now include frame notation for easier timeline reference
- **Universal Property Support**: Works with Position, Opacity, Scale, Rotation, Effects, Masks - any animatable property
- **Associated with AirBoard_v4.9.2.zxp**

## [4.9.1] - 2025-08-21
### 🎨 UI Improvements
- **Enhanced Section Hover Effect**: Section stroke opacity increases from 10% to 16% on hover for better visual feedback
- **Smooth Animation**: Professional easing curve (cubic-bezier) matching other UI elements
- **Associated with AirBoard_v4.9.1.zxp**

## [4.9.0] - 2025-08-21
### ✨ Added - iPhone UI Component
- **iPhone UI Component**: Added new composition-based component to Components dropdown
- **Full Composition Support**: iPhone UI adds entire "iPhone UI - 393" composition as precomp layer, not individual layers
- **Smart Positioning**: iPhone UI components center automatically while maintaining internal layer relationships
- **Resolution Scaling**: Full scaling support (1x-6x) following established resolution multiplier system
- **Template Integration**: Seamlessly integrated with AirBoard Templates.aep file structure

### 🔧 Technical Improvements
- **Clean Component Architecture**: Established clear patterns for composition-based vs layer-based components
- **Enhanced Error Handling**: Improved component import and layer targeting reliability
- **Code Optimization**: Streamlined component addition logic with proper fallback handling

### 📝 Documentation Enhanced
- **Complete Component Guide**: Added comprehensive documentation for adding new components to dropdown
- **Component Types Explained**: Clear distinction between composition-based (iPhone UI) and layer-based (Dot Loader) components
- **Step-by-Step Instructions**: HTML dropdown → JSX mapping → Logic updates → Testing workflow
- **Real Examples**: Practical examples for both component types with code snippets
- **Associated with AirBoard_v4.9.0.zxp**

## [4.7.0] - 2025-08-20
### ✨ Added - COMPLETE SHIMMER ANIMATION SYSTEM
- **New Shimmer Section**: Added "Shimmer" subsection to Presets with two powerful shimmer tools
- **Add Overlay Button**: Creates new shimmer rectangle layers with customizable color, opacity, and stagger timing
- **Add Shimmer Button**: Applies shimmer animation directly to selected existing layers while preserving original opacity
- **Shimmer Controls Layer**: Automatic controls layer with sliders for stagger delay, fade percentages, and global opacity settings
- **Position-Based Staggering**: Intelligent diagonal-distance calculation for natural wave-like shimmer propagation
- **Custom Bezier Easing**: Professional animation curves (0.40, 0.00, 0.20, 1.00) with looping expressions

### 🎨 Enhanced - UI IMPROVEMENTS AND ORGANIZATION
- **Renamed Sections**: "Effect Presets" → "Presets", "Gesture Presets" → "Gestures" for cleaner navigation
- **Improved Section Order**: Device Templates → Gestures → Presets → Keyframe Reader → Components → Project Setup
- **Enhanced Device Dropdown**: Shows device widths ("iPhone - 393w", "Desktop - 1440w") for better clarity
- **Optimized Spacing**: Fine-tuned subsection title spacing with proper padding above Effects and Shimmer sections
- **Subsection Organization**: Added "Shape", "Effects", and "Shimmer" subsections for logical feature grouping

### 🔧 Fixed - PERFORMANCE AND STABILITY
- **User Preferences Reset**: Fixed section order preferences to match new default layout
- **Section Container Height**: Increased max-height from 200px to 300px to prevent content clipping
- **Preference System Restore**: Maintained full user preference functionality after order corrections

### 🔧 Technical Details
- Added `addShimmerFromPanel()` and `addShimmerEffectFromPanel()` ExtendScript functions
- Implemented dual shimmer control systems for overlay vs effect modes
- Enhanced JavaScript event handlers for new shimmer buttons
- Preserved existing functionality while adding comprehensive shimmer capabilities
- Associated with AirBoard_v4.7.0.zxp

## [4.6.1] - 2025-08-20
### 🔧 Fixed - STABILITY ROLLBACK
- **Rolled Back to Stable Version**: Reverted to working version before remote asset loading issues
- **Enhanced Device Dropdown**: Updated dropdown text to show device widths ("iPhone - 393w", "Desktop - 1440w")
- **Development Workflow Fix**: Restored clean asset structure without config file dependencies
- **Error Resolution**: Fixed "Cannot load AE folder structure configuration" and "Unknown device type" errors

### 🔧 Technical Details
- Reverted git history to commit bdf0311 (stable working version)
- Maintained simple assets/ folder structure without remote config dependencies
- Preserved all core functionality: keyframe system, device templates, gestures, components
- Associated with AirBoard_v4.6.1.zxp

## [4.2.6] - 2025-08-18
### ✨ Added - COMPLETE DISTANCE NUDGING FUNCTIONALITY
- **X/Y Position Nudging**: Move position keyframes by ±10px with smart snapping and precision control
- **Smart 10px Snapping Logic**: First nudge snaps to nearest 10px boundary, then continues in 10px increments
- **Direction-Based Control**: "In" mode nudges first keyframe, "Out" mode nudges last keyframe in selection
- **Axis-Specific Validation**: X buttons only work with Position/X Position, Y buttons only with Position/Y Position
- **Real-Time Display Updates**: Distance values refresh immediately showing new travel distances after nudging

### 🎮 Enhanced - INTELLIGENT BUTTON BEHAVIOR
- **Property Type Detection**: Automatically validates axis compatibility and shows specific error messages
- **Multi-Property Support**: Works seamlessly with Position (2D arrays), X Position, and Y Position properties
- **Live Error Feedback**: Displays "Select X position keyframes" or "Select Y position keyframes" for axis mismatches
- **Responsive Controls**: Buttons remain active during operations (no disabling) for smooth interaction
- **Precision Targeting**: Only moves the selected keyframe (first or last) without affecting others

### 🔧 Technical Implementation
- **JavaScript Integration**: Added comprehensive event handlers for X/Y increment/decrement buttons with direction detection
- **ExtendScript Functions**: `nudgeXPosition()`, `nudgeYPosition()`, and core `nudgePositionAxis()` with smart snapping
- **Smart Snapping Algorithm**: `calculateSmartNudge()` provides 10px boundary detection with 0.1px tolerance
- **Undo Group Handling**: Each nudge operation wrapped in "Nudge X Position" or "Nudge Y Position" for clean undo history
- **Distance Recalculation**: Integrates with existing `calculatePositionDistance()` for immediate display updates
- **Error Management**: Comprehensive axis validation and user-friendly error messaging in distance display
- **Associated with AirBoard-v4.2.6.zxp**

## [4.2.3] - 2025-08-18
### ✨ Added - COMPLETE X/Y POSITION DISTANCE MEASUREMENT SYSTEM
- **Resolution-Aware Scaling**: X/Y distances automatically scaled by resolution setting and displayed as "@1x" equivalents
- **Clean Decimal Formatting**: Trailing zeros removed (91.50px → 91.5px) for polished display
- **Comprehensive Position Support**: Works with Position, X Position, and Y Position properties (2D arrays and separated values)
- **Multi-Keyframe Calculation**: Calculates total distance traveled through all selected keyframes chronologically
- **Compact Display Format**: "X: 150.5px @1x" and "Y: 75px @1x" with bolded labels when active

### 🎮 Added - DISTANCE ROW CONTROL BUTTONS
- **4-Button System**: Each distance row features "In" | "Out" | "−" | "+" buttons for future nudging functionality
- **Radio-Style In/Out Toggle**: Click to switch between In/Out selection (only one active at a time)
- **Subtle Selection Styling**: Selected buttons show lighter background + brighter border without color changes
- **Optimized Layout**: Quarter-width buttons with 4px gaps, matching established design patterns

### 🔧 Fixed - CRITICAL KEYFRAME STRETCHING BUG
- **Timeline Position Independence**: Duration +/- buttons now work reliably for keyframes at ANY timeline position
- **Smart 50ms Snapping**: First press snaps to nearest 50ms multiple, subsequent presses increment by exactly 50ms
- **Frame Rate Independent**: Always uses millisecond-based calculations for consistent behavior across frame rates
- **Continuous Nudging**: Both + and - buttons work indefinitely without silent failures
- **Root Cause Resolution**: Fixed time calculation logic that previously only worked for keyframes starting at frame 0

### 🎨 UI Improvements - ENHANCED VISUAL CONSISTENCY
- **Unified Error Messaging**: All three rows now show consistent "Select > 1 Keyframe" error message at 50% opacity
- **Refined Button Spacing**: Duration row gap reduced to 6px to match container padding spacing
- **Improved Initial State**: Clean labels (Duration, X Distance, Y Distance) at 50% opacity before reading keyframes
- **Enhanced Button Styling**: Distance buttons match established styling with consistent border opacity

### 🔧 Technical Details
- Enhanced `readKeyframesDuration()` ExtendScript function with comprehensive position distance calculation
- Fixed `stretchKeyframesGrokApproach()` time calculation logic using proper relative positioning
- Replaced problematic 50ms snapping with smart hybrid approach (snap first, then increment)
- Added In/Out toggle JavaScript functionality with proper event handling
- Implemented resolution-based scaling with `parseFloat()` for clean decimal display
- Associated with AirBoard-v4.2.3.zxp

## [4.1.6] - 2025-08-18
### 🔧 Fixed - UI REFINEMENTS
- **Removed Bold Formatting**: X/Y Distance values now display as clean "X Distance: 150px" without bold labels
- **Added Missing Error Messages**: When insufficient position keyframes are selected after clicking "Read Keyframes":
  - X Distance shows "Select > 1 X Position Keyframe"
  - Y Distance shows "Select > 1 Y Position Keyframe"
- **Preserved Clean Initial State**: X/Y Distance displays still start as simple "X Distance" and "Y Distance" at 50% opacity

### 🔧 Technical Details
- Removed innerHTML with `<strong>` tags, reverted to textContent for clean formatting
- Enhanced error state handling to show specific position keyframe requirements
- Maintained proper initial state vs error state distinction
- Associated with AirBoard-v4.1.6.zxp

## [4.1.4] - 2025-08-18
### 🎨 UI Improvements - ENHANCED VISUAL HIERARCHY
- **Duration Display**: Now shows "Select > 1 Keyframe" at 50% opacity initially instead of "Duration"
- **Simplified Initial State**: X/Y Distance displays now show simple "X Distance" and "Y Distance" at 50% opacity
- **Bolded Active Labels**: When distance values are shown, labels are bolded: "**X Distance:** 150px"
- **Consistent Opacity Patterns**: All text elements start at 50% opacity and brighten to 100% when data is available
- **Cleaner UX Flow**: More intuitive progression from instruction → data display

### 🔧 Technical Details
- Updated HTML initial text content for all keyframe displays
- Enhanced JavaScript to use innerHTML with `<strong>` tags for bolded labels
- Consistent opacity handling across Duration, X Distance, and Y Distance displays
- Improved error state handling with proper opacity resets
- Associated with AirBoard-v4.1.4.zxp

## [4.1.3] - 2025-08-18
### ✨ Added - X/Y POSITION DISTANCE MEASUREMENT
- **X Distance Calculation**: Shows total X coordinate movement between selected position keyframes
- **Y Distance Calculation**: Shows total Y coordinate movement between selected position keyframes
- **Multi-Keyframe Support**: Calculates total distance traveled through all selected keyframes chronologically
- **Position Property Support**: Works with Position, X Position, and Y Position keyframes (both 2D and separated)
- **Smart Error Messaging**: Shows "Select > 1 X Position Keyframe" when insufficient keyframes selected
- **Pixel Units**: Always displays distance in pixels (px) with positive values regardless of movement direction

### 🔧 Technical Details
- Enhanced `readKeyframesDuration()` ExtendScript function with position distance calculation
- Added comprehensive position property detection (Position, X Position, Y Position)
- Handles both 2D position arrays [x,y] and separated 1D position values
- JavaScript parsing updated to handle extended result format
- Real-time opacity changes (50% instruction text → 100% when data available)
- Associated with AirBoard-v4.1.3.zxp

## [3.9.9] - 2025-08-18
### ✨ Added - KEYFRAME HELPER UI ENHANCEMENTS
- **X/Y Distance Display**: Added visual display elements for keyframe distance measurements
- **Enhanced Keyframe Reader**: Extended UI with X Distance and Y Distance display components
- **Consistent Styling**: Keyframe displays match resolution display styling without interactive buttons
- **Improved UX**: Clean visual feedback for distance measurements between keyframes

### 🔧 Technical Details
- Added `.keyframe-display` CSS class for consistent styling
- Added X Distance and Y Distance display elements to Keyframe Reader section
- Version updated to 3.9.9 in manifest.xml
- Build script updated for v4.1.2 ZXP generation
- Associated with AirBoard_v3.9.9.zxp

## [3.8.7] - 2025-08-17
### 🔧 Fixed - IDENTICAL APPROACH FOR TIME REMAPPING
- **Exact Same Logic**: Time remapping now uses identical delete/recreate/select approach as Position/Opacity
- **All Keyframes Selected**: All time remapping keyframes now stay selected like other properties
- **Same Loop Structure**: Uses same forward loop through keyData with immediate selection
- **Minimal Properties**: Only sets essential properties (value, interpolation) for time remapping

### 🔧 Technical Details
- Replaced setKeyTime() approach with proven delete/recreate pattern
- Uses same selKeys reverse deletion loop as other properties  
- Uses same keyData forward creation loop as other properties
- Calls prop.setSelectedAtKey(newIdx, true) for each new keyframe
- Simplified property setting to avoid time remapping specific issues
- Associated with AirBoard_v3.8.7.zxp

## [3.8.6] - 2025-08-17
### 🔧 Fixed - UNIFIED SELECTION APPROACH FOR TIME REMAPPING
- **Same Selection Method**: Time remapping now uses identical selection approach as Position/Opacity
- **Immediate Selection**: Selects keyframes immediately after moving (setSelectedAtKey) just like other properties
- **Simplified Logic**: Removed complex time-based reselection in favor of proven immediate selection
- **Consistent Behavior**: Time remapping selection now matches all other property types perfectly

### 🔧 Technical Details
- Uses prop.setSelectedAtKey(keyIndex, true) immediately after prop.setKeyTime() 
- Removed complex reselection logic that was causing deselection issues
- Maintains same clear-then-select pattern as working properties
- Unified code path ensures consistent selection behavior across all property types
- Associated with AirBoard_v3.8.6.zxp

## [3.8.5] - 2025-08-17
### 🔧 Fixed - TIME REMAPPING SELECTION PERSISTENCE
- **Enhanced Selection Logic**: Improved time remapping keyframe reselection with frame-based tolerance
- **Multiple Fallback Strategies**: Uses precise time matching, then range-based selection as backup
- **Frame-Rate Aware Tolerance**: Uses composition frame rate for accurate time matching
- **Robust Selection**: Multiple approaches ensure keyframes remain selected for repeated operations

### 🔧 Technical Details
- Primary: Frame-rate based tolerance (1/frameRate) for precise time matching
- Fallback: Range-based selection covering expected keyframe area
- Enhanced error handling for selection operations specific to time remapping
- Maintains in-place keyframe movement approach that prevents deletion
- Associated with AirBoard_v3.8.5.zxp

## [3.8.4] - 2025-08-17
### 🔧 Fixed - COMPLETELY DIFFERENT TIME REMAPPING APPROACH
- **In-Place Modification**: Uses setKeyTime() method for time remapping instead of delete/recreate
- **Fallback Strategy**: If setKeyTime() fails, falls back to minimal delete/recreate
- **Separate Code Paths**: Completely different handling for time remapping vs regular properties
- **Enhanced Selection**: Time-based reselection for time remapping keyframes

### 🔧 Technical Details
- Primary approach: Uses prop.setKeyTime() to move time remapping keyframes in place
- Fallback approach: Minimal delete/recreate if setKeyTime() fails
- Time-based reselection system for time remapping properties
- Maintains full record/delete/recreate for all other property types
- Associated with AirBoard_v3.8.4.zxp

## [3.8.3] - 2025-08-17
### 🔧 Fixed - TIME REMAPPING SPECIAL HANDLING
- **Time Remapping Detection**: Added automatic detection of time remapping properties
- **Minimal Time Remap Approach**: Uses simplified keyframe recreation for time remapping to prevent deletion
- **Enhanced Error Handling**: Separate error handling paths for time remapping vs regular properties
- **Robust Property Operations**: Graceful fallbacks for property-specific operations that might fail

### 🔧 Technical Details
- Added time remapping detection via property name and matchName
- Implemented minimal keyframe recreation approach specifically for time remapping
- Enhanced try-catch structure with separate handling for time remapping and regular properties
- Improved selection handling with graceful fallbacks for problematic property types
- Associated with AirBoard_v3.8.3.zxp

## [3.8.2] - 2025-08-17
### 🔧 Fixed - TIME REMAPPING & LINEAR KEYFRAMES
- **Time Remapping Fix**: Fixed time remapping keyframes being deleted instead of properly stretched
- **Linear Keyframe Preservation**: Linear keyframes now maintain their interpolation type and don't become eased
- **Robust Error Handling**: Added comprehensive try-catch blocks for property-specific operations
- **Interpolation Type Preservation**: Only applies temporal ease to bezier keyframes, preserving linear ones

### 🔧 Technical Details
- Added conditional temporal ease application based on interpolation type
- Wrapped temporal and spatial property operations in try-catch for time remapping compatibility
- Enhanced keyframe data collection to preserve original interpolation characteristics
- Fixed property-specific method calls that were causing keyframe deletion on time remapping
- Associated with AirBoard_v3.8.2.zxp

## [3.8.1] - 2025-08-17
### ✨ Updated - GROK'S SUPERIOR KEYFRAME STRETCHING
- **Grok's Approach**: Implemented Grok's proven selectedProperties/selectedKeys method for keyframe stretching
- **Perfect Selection**: Uses proper APIs (layer.selectedProperties, prop.selectedKeys) for bulletproof keyframe detection
- **Maintained Selection**: All keyframes remain selected after stretching with prop.setSelectedAtKey()
- **Multi-Property Support**: Works across multiple selected properties and layers simultaneously
- **Spatial Property Support**: Handles both temporal and spatial properties correctly with prop.isSpatial detection
- **Robust Error Handling**: Gracefully handles edge cases and prevents negative durations

### 🔧 Technical Details
- Replaced manual property search with After Effects' native selectedProperties API
- Used selectedKeys array for direct keyframe index access
- Implemented proper spatial property detection and handling
- Enhanced selection preservation using setSelectedAtKey() during keyframe recreation
- Associated with AirBoard_v3.8.1.zxp

## [3.8.0] - 2025-08-17
### ✨ Added - KEYFRAME STRETCHING (StackOverflow Record/Delete/Recreate Approach)
- **Keyframe Stretching**: +/- buttons now stretch/shrink selected keyframes by 3 frames using proven record→delete→recreate method
- **Complete Keyframe Preservation**: Records all keyframe properties (values, interpolation, easing, spatial tangents)
- **Bulletproof Property Detection**: Uses same logic as proven working adjustKeyframeDurationFromPanel function
- **Anchor Point Behavior**: First selected keyframe stays fixed, others are proportionally repositioned
- **Frame-Rate Aware**: Calculates 3 frames based on composition's actual frame rate
- **Perfect Reselection**: All stretched keyframes remain selected for repeated operations
- **Real-time Display**: Duration display updates immediately showing new ms/frames values

### 🔧 Technical Details
- Implemented StackOverflow's record→delete→recreate approach instead of problematic setKeyTime()
- Added comprehensive keyframe data recording (temporal/spatial properties, easing, interpolation)
- Enhanced property search using exact same pattern as working adjustKeyframeDurationFromPanel
- Full undo support and robust error handling with graceful fallbacks
- Associated with AirBoard_v3.8.0.zxp

## [3.7.9] - 2025-08-16
### 🔧 Keyframe Reader Simplification
- **Removed X/Y Distance Controls**: Simplified Keyframe Reader to focus on duration only
- **Disabled +/- Button Functionality**: Buttons kept for styling but functionality removed for future implementation
- **Clean Interface**: Streamlined section with just Read Keyframes button and Duration display

### 🔧 Technical Details
- Removed X Distance and Y Distance rows from HTML and JavaScript
- Kept Duration row styling with decorative +/- buttons (no functionality)
- Updated Read Keyframes button handler to only manage duration display
- Simplified error handling for single duration display
- Associated with AirBoard_v3.7.9.zxp

## [3.6.8] - 2025-08-16
### 🎯 Keyframe Reader Feature - Complete Implementation
- **New Keyframe Reader Section**: Read duration between selected keyframes on any property
- **Universal Property Support**: Works with Position, Rotation, Scale, Opacity, Time Remap, Effects, Masks
- **Smart Detection**: Automatically finds selected keyframes on any animatable property
- **Dynamic Duration Display**: Shows actual duration in "XXXms / XXf" format using composition frame rate
- **Clean Error Handling**: Inline "Select > 1 Keyframe" messages instead of popup alerts
- **Visual Feedback**: Labels start at 50% opacity, brighten to 100% after successful reading
- **Professional UX**: No interrupting dialogs, seamless workflow integration

### 🔧 Technical Implementation
- Added `readKeyframesDuration()` ExtendScript function with recursive property search
- Enhanced JavaScript with csInterface integration and error handling
- Added keyframe reader controls with +/- buttons for Duration, X Distance, Y Distance
- Implemented opacity transitions and inline messaging system
- Comprehensive property traversal: Transform → Time Remap → Effects → Masks → Audio
- Associated with AirBoard_v3.6.8.zxp

## [3.6.0] - 2025-08-16
### 🎨 UI Overhaul - Container-Based Layout
- **Section Containers**: Added rounded containers around each section instead of border dividers
- **Optimized Spacing**: Tighter margins and padding throughout interface
- **Refined Button Heights**: Main buttons 35px, dropdowns 36px for visual hierarchy
- **Compact Layout**: Removed padding below last row in each section
- **Consistent Margins**: 10px spacing throughout (sides, between sections)
- **Subtle Styling**: Containers with #272727 background, rounded corners, subtle shadows

### 🔧 Technical Details
- Added `.section-container` wrapper divs around each section in HTML
- Updated CSS with container styling and optimized spacing
- Removed bottom margin from `.control-row:last-child`
- Adjusted all element heights for better proportional balance
- Maintained all existing functionality with no JavaScript changes
- Associated with AirBoard_v3.6.0.zxp

## [3.5.9] - 2025-08-16
### 🎨 UI Cleanup
- **Removed Transition Presets Section**: Eliminated the entire Transition Presets section with Fade-out and Fade-in controls
- **Cleaner Interface**: Streamlined plugin interface with focused feature set
- **Code Cleanup**: Removed all associated JavaScript event handlers and initialization code

### 🔧 Technical Details
- Removed Transition Presets HTML section with duration controls
- Removed all transition-related JavaScript functions and event handlers
- Removed initialization calls for transition duration displays
- No CSS changes needed (unified classes still used by other sections)
- Associated with AirBoard_v3.5.9.zxp

## [3.5.7] - 2025-08-16
### 🎨 UI Refinement
- **Improved Separator**: Changed duration display separator from "-" to "/" for better readability
- **Cleaner Format**: Now displays "Fade-out 150ms / 9f" and "Fade-in 250ms / 15f"

### 🔧 Technical Details
- Updated both `updateTransitionDurationDisplay()` and `updateFadeInDurationDisplay()` functions
- Changed separator character from " - " to " / " for consistent formatting
- Associated with AirBoard_v3.5.7.zxp

## [3.5.6] - 2025-08-16
### 🔧 Fixed
- **Frame Count on Startup**: Duration text now shows frame counts immediately when plugin loads
- **Complete Frame Display**: Both "Fade-out 150ms - 9f" and "Fade-in 250ms - 15f" display correctly on startup

### 🔧 Technical Details
- Added `updateTransitionDurationDisplay()` and `updateFadeInDurationDisplay()` calls to plugin initialization
- Frame counts now appear immediately without requiring +/- button interaction
- Associated with AirBoard_v3.5.6.zxp

## [3.5.5] - 2025-08-16
### 🎨 UI Enhancement
- **Dynamic Frame Count Display**: Added frame count to transition duration text (e.g., "Fade-out 150ms - 9f")
- **Real-time Frame Updates**: Frame count automatically updates with +/- buttons (60fps calculation)
- **Better Timeline Context**: Shows both milliseconds and frame equivalents for easier timing reference

### 🔧 Technical Details
- Added frame calculation: `frames = Math.round(ms * 0.06)` for 60fps projects
- Updated `updateTransitionDurationDisplay()` and `updateFadeInDurationDisplay()` functions
- Frame count dynamically updates with all increment/decrement operations
- Associated with AirBoard_v3.5.5.zxp

## [3.5.4] - 2025-08-16
### ✨ Added
- **User Preferences System**: Resolution multiplier now persists between After Effects sessions
- **Automatic Preference Loading**: Plugin restores last used resolution setting on startup
- **Seamless Workflow**: No need to manually re-adjust resolution every session

### 🔧 Technical Details
- Added `saveResolutionPreference()` and `loadResolutionPreference()` ExtendScript functions using app.settings API
- Integrated preference saving into existing +/- button event handlers
- Preference loading happens automatically on plugin startup
- Validates saved values (1x-6x range) with fallback to 2x default
- Associated with AirBoard_v3.5.4.zxp

## [3.5.3] - 2025-08-16
### ✨ Added
- **Transition Presets Section**: New section with Fade-out and Fade-in timing controls
- **Dynamic Duration Controls**: −/+/Add buttons with 50ms increments (0-2000ms range)
- **Auto Project Structure**: Creating device compositions now automatically creates complete AE folder structure
- **Smart Folder Check**: AE Folders button shows "already created" message if structure exists

### 🎨 UI Improvements
- **Transition Controls**: "Fade-out 150ms" and "Fade-in 250ms" with real-time updates
- **Three-Button Layout**: Each transition row has −, +, and Add buttons (1/3 width each)
- **Consistent Styling**: Add buttons match main button text styling

### 🔧 Technical Details
- Added complete transition timing interface with event handlers
- Integrated full folder structure creation into device composition workflow
- Added existence checking for AE Folders to prevent duplicates
- Reuses existing `createFolderStructure()` function for consistency
- Associated with AirBoard_v3.5.3.zxp

## [3.5.0] - 2025-08-16
### 🎯 Fixed
- **Import Organization**: AirBoard Templates.aep now automatically goes to "03 - Assets > zImported_projects" instead of project root
- **Smart Folder Management**: Templates are properly organized when imported for Device Templates, Gesture Presets, and Components
- **Cleaner Project Structure**: No more template clutter in root folder

### 🔧 Technical Details
- Added import organization code after all `app.project.importFile()` calls
- Uses existing `getOrCreateImportedProjectsFolder()` helper function
- Handles both single items and arrays returned by importFile()
- Creates folder structure automatically if it doesn't exist
- Associated with AirBoard_v3.5.0.zxp

## [3.4.9] - 2025-08-16
### 🎨 UI Improvements
- **Minus Symbol Fix**: Changed minus button from hyphen-minus to proper minus symbol (−) for better vertical alignment
- **Faster Button Animations**: Reduced transition duration from 0.2s to 0.1s for snappier interactions
- **Removed Loading Text**: Eliminated "Creating..." and "Adding..." button text changes for cleaner UX

### 🔧 Technical Details
- Updated minus button in HTML from "–" to "−" for proper mathematical symbol
- Changed CSS transition duration from 0.2s to 0.1s across all button elements
- Removed all button text changes during loading states to prevent flickering
- Associated with AirBoard_v3.4.9.zxp

## [3.4.7] - 2025-08-15
### 🎨 UI Improvements
- **Minus Symbol Fix**: Changed minus button from hyphen-minus to proper minus symbol (−) for better vertical alignment
- **Faster Button Animations**: Reduced transition duration from 0.2s to 0.1s for snappier interactions
- **Removed Loading Text**: Eliminated "Creating..." and "Adding..." button text changes for cleaner UX

### 🔧 Technical Details
- Updated minus button in HTML from "–" to "−" for proper mathematical symbol
- Changed CSS transition duration from 0.2s to 0.1s across all button elements
- Removed all button text changes during loading states to prevent flickering
- Associated with AirBoard_v3.4.7.zxp

## [3.2.9] - 2025-08-15
### 🎨 UI Update
- **Project Setup Layout**: Buttons now quarter-width and right-aligned
- **Shorter Button Text**: "AE Folders" → "AE", "Finder Folders" → "Finder"
- **Improved Layout**: Cleaner, more compact Project Setup section

### 🔧 Technical Details
- Added `.quarter-width` and `.spacer` CSS classes for Project Setup buttons
- Modified HTML structure with spacer div to push buttons right
- Functionality unchanged - only visual layout improvements
- Associated with AirBoard_v3.2.9.zxp

## [3.2.8] - 2025-08-15 - ELEVATION SHADOWS IMPLEMENTED
### ✨ Added - MAJOR FEATURE MILESTONE
- **🎯 ELEVATION SHADOWS FEATURE COMPLETE**: Add Shadow button now fully functional with resolution-based elevation shadow presets
- **Smart Preset Selection**: Automatically selects correct .ffx file based on resolution multiplier and elevation level
- **Dynamic Path Building**: Creates paths like "assets/presets/Shadows/2x/2x - Elevation 1.ffx"
- **Layer Target Detection**: Applies shadow to currently selected layer in active composition
- **Complete Preset Library**: All 30 elevation shadow presets included (0-4 elevations × 1x-6x resolutions)

### 🔧 Technical Details
- Added `addShadowFromPanel()` ExtendScript function with resolution and elevation mapping
- Added JavaScript event handler for Add Shadow button with elevation and resolution detection
- Path format: `assets/presets/Shadows/{resolution}x/{resolution}x - Elevation {elevation}.ffx`
- Supports all elevation levels (0-4) and resolution multipliers (1x-6x)
- Full error handling for missing presets and layer selection
- Associated with AirBoard_v3.2.8.zxp

## [3.2.6] - 2025-08-15
### 🎨 UI Update
- **Elevation Dropdown**: Changed to "Elevation 1-4" (removed Elevation 0, kept 4 options)

### 🔧 Technical Details
- Updated elevation dropdown to show Elevation 1, 2, 3, 4 only
- Removed Elevation 0 option as requested
- Associated with AirBoard_v3.2.6.zxp

## [3.2.5] - 2025-08-15
### 🎨 UI Update
- **Elevation Dropdown**: Changed from "Elevation 1-5" to "Elevation 0-4" for better indexing

### 🔧 Technical Details
- Updated elevation dropdown options in index.html
- Values now range from 0-4 instead of 1-5
- Associated with AirBoard_v3.2.5.zxp

## [3.2.4] - 2025-08-15
### ✨ Added
- **Automatic Composition Organization**: New compositions now automatically move to organized folders
- **iPhone Compositions**: Go to "01 - Compositions > Native" folder
- **Desktop Compositions**: Go to "01 - Compositions > Desktop" folder  
- **Smart Folder Creation**: Creates folder hierarchy if it doesn't exist

### 🔧 Technical Details
- Added `moveCompositionToFolder()` function with device type mapping
- Handles hierarchical folder creation ("01 - Compositions" > "Native"/"Desktop")
- Automatic folder organization after composition creation and opening
- Graceful error handling for organization failures
- Associated with AirBoard_v3.2.4.zxp

## [3.2.3] - 2025-08-15
### 🎯 Fixed
- **Selective Component Positioning**: Only Ms Counter places in top-left corner, Dot Loader and other components return to center positioning
- **Better UX**: Timer in top-left, animations/loaders centered as expected

### 🔧 Technical Details
- Added component type check: `var isTimer = (componentType === "timer")`
- Ms Counter (timer): Top-left position [60, 60]
- All other components: Center position [comp.width/2, comp.height/2]
- Handles both keyframed and static positioning properly
- Associated with AirBoard_v3.2.3.zxp

## [3.2.1] - 2025-08-15
### 🔧 Updated
- **Additional User Changes**: Latest user modifications included
- **Updated Build**: Fresh build with recent improvements

### 🔧 Technical Details
- Associated with AirBoard_v3.2.1.zxp

## [3.2.0] - 2025-08-15
### 🔧 Updated
- **User Changes Incorporated**: Includes latest user modifications and improvements
- **Fresh Build**: Clean rebuild with all recent updates

### 🔧 Technical Details
- Associated with AirBoard_v3.2.0.zxp

## [3.1.9] - 2025-08-15
### 🎨 Improved
- **Component Positioning**: Ms Counter and components now place in top-left corner (60px padding) instead of center
- **Better Layout**: More intuitive positioning for timer displays and UI components

### 🔧 Technical Details
- Modified component positioning logic from center ([comp.width/2, comp.height/2]) to top-left ([60, 60])
- Handles both keyframed and static position properties
- 60px padding from edges for clean placement
- Associated with AirBoard_v3.1.9.zxp

## [3.1.8] - 2025-08-15
### 🔧 Fixed
- **Removed Finder Auto-Open**: Removed automatic Finder reveal that was causing unwanted dialog warnings
- **Fixed Double .aep Extension**: Save dialog now shows clean filename without duplicate .aep extensions

### 🔧 Technical Details
- Removed `rootFolder.execute()` calls to eliminate warning dialogs
- Changed default filename creation to exclude .aep extension (added by save dialog automatically)
- Cleaner save dialog experience with proper filename display
- Associated with AirBoard_v3.1.8.zxp

## [3.1.7] - 2025-08-15
### ✨ Added
- **Automatic Finder Reveal**: Finder Folders now automatically opens Finder window to show the newly created project structure
- **Enhanced UX**: No need to manually navigate to find your new folders - they open automatically

### 🔧 Technical Details
- Added `rootFolder.execute()` calls after successful folder creation and project saving
- Finder opens even if project save is cancelled (folders still created successfully)
- Graceful error handling for Finder opening failures
- Associated with AirBoard_v3.1.7.zxp

## [3.1.6] - 2025-08-15
### 🔧 Fixed
- **Correct Save Dialog Method**: Using `saveDlg()` method on File object instead of `File.saveDialog()`
- **Proper Folder Targeting**: File object approach should correctly open dialog in "03 - AE" subfolder
- **Grok's Solution**: Implemented recommended ExtendScript best practice for subfolder dialogs

### 🔧 Technical Details
- Changed from `File.saveDialog()` to `defaultFile.saveDlg()`
- Creates File object with full path to AE folder as starting location
- Includes file type filter for .aep files
- Should finally open dialog in correct subfolder location
- Associated with AirBoard_v3.1.6.zxp

## [3.1.5] - 2025-08-15
### 🔧 Fixed
- **Alternative Save Dialog Location Approach**: Using File object with full path instead of working directory change
- **Simplified Implementation**: Removed working directory management, using direct path approach

### 🔧 Technical Details
- Creates File object with complete path to AE folder as dialog default
- Removed `Folder.current` approach that wasn't working
- Should force dialog to navigate to specified folder location
- Associated with AirBoard_v3.1.5.zxp

## [3.1.4] - 2025-08-15
### 🔧 Fixed
- **Save Dialog Actually Opens in AE Folder**: Fixed save dialog to truly open inside "03 - AE" folder, not root folder
- **Working Directory Management**: Temporarily changes to AE folder for dialog, then restores original directory

### 🔧 Technical Details
- Uses `Folder.current` to change working directory before opening save dialog
- Properly restores original working directory after dialog completes
- Dialog now opens inside "03 - AE" folder showing contents, not parent folder structure
- Associated with AirBoard_v3.1.4.zxp

## [3.1.3] - 2025-08-15
### 🔧 Fixed
- **Save Dialog Defaults to AE Folder**: File save dialog now opens directly in "03 - AE" folder location
- **Automatic .aep Extension**: Ensures filename always includes .aep extension, even if user doesn't type it
- **Better UX**: No need to navigate to correct folder, extension automatically handled

### 🔧 Technical Details
- Modified `File.saveDialog()` to use full file path as default (includes folder location)
- Added regex check to ensure .aep extension is present in final filename
- Dialog starts in correct "03 - AE" folder but still saves there regardless of navigation
- Associated with AirBoard_v3.1.3.zxp

## [3.1.2] - 2025-08-15
### ✨ Added
- **Custom Filename Dialog**: Finder Folders now shows file save dialog to enter custom .aep filename
- **Smart Default**: Pre-fills current project name as default, fully editable
- **Save Location Lock**: Ensures file always saves to "03 - AE" folder regardless of dialog navigation

### 🔧 Technical Details
- Added `File.saveDialog()` for custom filename input after folder creation
- Extracts filename from dialog and saves to designated "03 - AE" folder
- Handles user cancellation gracefully with appropriate feedback
- Associated with AirBoard_v3.1.2.zxp

## [3.1.1] - 2025-08-15
### 🔧 Fixed
- **No Root Folder Created**: Finder Folders now creates the 6 folders directly in selected location (no "AirBoard Project" wrapper folder)
- **Cleaner Structure**: Folders created directly where user chooses, more intuitive workflow

### 🔧 Technical Details
- Removed automatic root folder creation in `createFinderFoldersFromPanel()`
- Uses selected folder directly as root location for folder structure
- Still saves AE project to "03 - AE" folder within selected location
- Associated with AirBoard_v3.1.1.zxp

## [3.1.0] - 2025-08-15
### ✨ Added
- **Finder Folders Functionality**: Clicking "Finder Folders" button creates complete project folder structure in file system
- **File System Integration**: Shows native folder selection dialog to choose where to create project structure
- **Automatic Project Saving**: Saves current After Effects project to "03 - AE" folder within created structure
- **Smart Project Naming**: Uses current project filename or defaults to "AirBoard Project"

### 📁 Finder Folder Structure Created
- **01 - Assets** (Figma, Images/Desktop/Native, Reference/Stills/Videos, Vector, Video)
- **02 - Exports** (Video, Lottie) 
- **03 - AE** (Where AE project gets saved)
- **04 - C4D**
- **05 - Prototypes**
- **06 - Decks**

### 🔧 Technical Details
- Implemented `createFinderFoldersFromPanel()` ExtendScript function
- Added `createFinderFolderStructure()` recursive helper for file system folders
- Uses `Folder.selectDialog()` for native folder selection
- Automatic project save to designated AE folder
- Full error handling and user feedback
- Associated with AirBoard_v3.1.0.zxp

## [3.0.0] - 2025-08-15
### 🔄 Rolled Back to Stable Version
- **Removed All Automatic Organization**: Removed all automatic .aep and composition organization code that wasn't working
- **Clean AE Folders Only**: Back to the stable version with working "AE Folders" button functionality
- **Simplified Codebase**: Removed complex folder detection and organization functions

### ✅ Working Features
- **AE Folders Button**: Creates complete project folder structure when clicked
- **Device Templates**: iPhone and Desktop composition creation with scaling
- **Gesture Presets**: All gesture animations with scaling and positioning
- **Components**: Ms Counter and Dot Loader with scaling and positioning  
- **Effect Presets**: Squircle creation and rectangle replacement

### 🔧 Technical Details
- Removed `organizeImportedFolder()` function and all calls
- Removed `getOrCreateCompositionFolder()` function
- Removed automatic composition organization
- Clean, stable codebase ready for future organization features
- Associated with AirBoard_v3.0.0.zxp

## [2.9.8] - 2025-08-15
### 🔧 Fixed
- **User-Modified Folder Organization**: Includes custom fixes to folder organization logic
- **Enhanced organizeImportedFolder() Calls**: Both conditional and unconditional calls for maximum coverage

### 🔧 Technical Details
- Incorporates user modifications to jsx/main.jsx for improved folder organization
- Maintains both conditional (inside import blocks) and unconditional (outside import blocks) calls to organizeImportedFolder()
- Associated with AirBoard_v2.9.8.zxp

## [2.9.7] - 2025-08-15
### 🔧 Fixed - UNCONDITIONAL ORGANIZATION
- **Made organizeImportedFolder() Unconditional**: Now calls folder organization AFTER import blocks, not inside them
- **Handles Pre-existing Templates**: Organizes folder even when templates already exist (no import needed)
- **Idempotent & Safe**: Function only moves folder if found in root, safe to call multiple times

### 🔧 Technical Details
- Moved `organizeImportedFolder()` outside the `if (!gestureComp)` and `if (!componentComp)` blocks
- Now runs regardless of whether import happened or templates already existed
- Covers cases where templates were imported previously but folder never got organized
- Function is idempotent - safe to call repeatedly
- Associated with AirBoard_v2.9.7.zxp

## [2.9.6] - 2025-08-15
### 🔧 Fixed - CRITICAL BUG FIX
- **Fixed Root Folder Detection**: Changed `item.parentFolder === app.project` to `item.parentFolder === null` (root-level items have null parent, not app.project)
- **Universal Import Organization**: Added folder organization to ALL import locations (Device, Gesture, Component)
- **Reusable Function**: Created `organizeImportedFolder()` function used consistently across all imports

### 🔧 Technical Details
- Root-level items in After Effects have `parentFolder === null`, not `app.project`
- This was preventing the "AirBoard Templates.aep" folder from being detected and moved
- Now calls `organizeImportedFolder()` after every `app.project.importFile()` call
- Should finally work correctly for folder organization
- Associated with AirBoard_v2.9.6.zxp

## [2.9.5] - 2025-08-15
### 🔧 Fixed  
- **Completely Simplified Folder Organization**: Removed complex detection system and used same simple approach as composition organization (which works)
- **Same Timing as Composition Move**: Folder organization now happens right after composition organization using identical pattern
- **Direct Folder Detection**: Simple search for exact "AirBoard Templates.aep" folder name in root
- **Removed Debugging Overhead**: Eliminated complex logging and detection functions

### 🔧 Technical Details
- Completely removed complex `moveImportedItemsToFolder()` function
- Added simple folder organization directly in device creation function using same timing as composition move
- Uses exact same pattern: find folder in root by name, move to target folder
- Removed all complex detection patterns and timing issues
- Associated with AirBoard_v2.9.5.zxp

## [2.9.4] - 2025-08-15
### 🔧 Fixed
- **Improved Import Timing**: Changed order of operations to ensure folder detection happens after import is fully complete
- **Enhanced Debugging**: Added comprehensive logging to track exactly what's happening during import organization
- **Better Folder Detection**: More specific matching for "AirBoard Templates.aep" folder name
- **Forced Project Refresh**: Added consolidateFootage() call to ensure AE has finished organizing imports

### 🔧 Technical Details
- Moved `moveImportedItemsToFolder()` call to after template composition finding
- Added detailed logging to track every item in the project during organization
- Enhanced folder detection with exact name matching and better type checking
- Added project consolidation step to ensure import is fully processed
- Associated with AirBoard_v2.9.4.zxp

## [2.9.3] - 2025-08-15
### 🔧 Fixed
- **AirBoard Templates.aep Folder Organization**: The entire "AirBoard Templates.aep" folder now properly moves to "03 - Assets > zImported_projects" instead of staying in root
- **Enhanced Folder Detection**: Improved detection to specifically target imported .aep folder structures
- **Better Debugging**: Added comprehensive logging to track folder movement process

### 🔧 Technical Details
- Updated `moveImportedItemsToFolder()` to specifically detect and move "AirBoard Templates.aep" folders
- Enhanced detection patterns to identify FolderItem instances containing "AirBoard" or "Templates"
- Added detailed logging for debugging import organization process
- Associated with AirBoard_v2.9.3.zxp

## [2.9.2] - 2025-08-15
### 🔧 Fixed
- **Import Organization Now Actually Works**: Fixed .aep files to properly go into "03 - Assets > zImported_projects" folder
- **Composition Organization**: Device compositions now automatically go into correct folders (iPhone → "01 - Compositions > Native", Desktop → "01 - Compositions > Desktop")
- **Improved Template Detection**: Enhanced detection patterns for imported template items
- **Better Error Handling**: More robust folder creation and item organization

### 🔧 Technical Details
- Rewrote `moveImportedItemsToFolder()` function to properly scan and move template items
- Added `getOrCreateCompositionFolder()` function for device-specific composition organization
- Enhanced template item detection patterns (AirBoard, Templates, iPhone, Gesture, Component, etc.)
- Added comprehensive logging for debugging organization process
- Associated with AirBoard_v2.9.2.zxp

## [2.9.1] - 2025-08-15
### ✨ Added
- **Automatic .aep Import Organization**: All imported .aep files (like AirBoard Templates.aep) now automatically go into "03 - Assets > zImported_projects" folder
- **Smart Folder Creation**: Creates the folder structure if it doesn't exist when importing templates
- **Universal Template Organization**: Works for Device Templates, Gesture Presets, Components, and any future .aep imports

### 🔧 Technical Details
- Implemented `getOrCreateImportedProjectsFolder()` helper function for folder management
- Added `moveImportedItemsToFolder()` function with fallback detection for imported items
- Modified all three template import locations (Device, Gesture, Component) to use automatic organization
- Robust error handling ensures imports work even if organization fails
- Associated with AirBoard_v2.9.1.zxp

## [2.9.0] - 2025-08-15
### ✨ Added
- **AE Folders Functionality**: Clicking "AE Folders" button now creates a complete project folder structure
- **Standard Project Organization**: Creates organized folders for Compositions (Desktop/Native with Specs/Lottie subfolders), Precomps, and Assets (Images, Reference, Renders, Vector, Video, zImported_projects)
- **Smart Folder Creation**: Only creates folders that don't already exist to avoid duplicates

### 🔧 Technical Details
- Implemented `createAEFoldersFromPanel()` ExtendScript function following proven patterns
- Added recursive `createFolderStructure()` helper function for nested folder creation
- Follows established button interaction patterns with proper UI feedback
- Associated with AirBoard_v2.9.0.zxp

## [2.8.9] - 2025-08-15
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
