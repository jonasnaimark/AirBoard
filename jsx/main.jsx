// Global variable to store extension path (set by the panel)
var extensionRoot = "";

// Debug utilities for ExtendScript
var DEBUG_JSX = {
    messages: [],
    log: function(message, data) {
        var logMsg = "AirBoard: " + message + (data ? " | " + data : "");
        $.writeln(logMsg);
        this.messages.push(logMsg);
    },
    error: function(message, error) {
        var logMsg = "❌ AirBoard Error: " + message + " | " + error.toString();
        $.writeln(logMsg);
        this.messages.push(logMsg);
    },
    info: function(message, data) {
        var logMsg = "ℹ️ AirBoard Info: " + message + (data ? " | " + data : "");
        $.writeln(logMsg);
        this.messages.push(logMsg);
    },
    clear: function() {
        this.messages = [];
    },
    getMessages: function() {
        return this.messages.slice(); // Return a copy
    }
};

function getPropertySortKey(prop) {
    var indices = [];
    try {
        var current = prop;
        var depthGuard = 0;
        while (current && current !== current.parentProperty && depthGuard < 50) {
            if (current.propertyIndex !== undefined && !isNaN(current.propertyIndex)) {
                indices.unshift(current.propertyIndex);
            } else {
                indices.unshift(0);
            }
            try {
                current = current.parentProperty;
            } catch(e) {
                break;
            }
            depthGuard++;
        }
    } catch(e) {
        indices.unshift(0);
    }
    return indices;
}

function compareSortKeys(a, b) {
    var len = Math.max(a.length, b.length);
    for (var i = 0; i < len; i++) {
        var aVal = i < a.length ? a[i] : 0;
        var bVal = i < b.length ? b[i] : 0;
        if (aVal !== bVal) {
            return aVal - bVal;
        }
    }
    return 0;
}

// Helper function for more accurate millisecond rounding
// Handles tiny values near zero and reduces floating point errors
function roundMs(seconds) {
    var ms = seconds * 1000;
    
    // If the value is very close to zero (within 0.5ms), treat it as zero
    // This prevents 0.4ms from rounding to 1ms
    if (Math.abs(ms) < 0.5) {
        return 0;
    }
    
    // For other values, use standard rounding
    return Math.round(ms);
}

// Universal Property Path Generator - Creates unique identifiers for ALL property types
// This prevents collisions between effect parameters with same names (e.g., multiple "Slider" effects)
function getFullPropertyPath(prop) {
    try {
        var pathParts = [];
        var currentProp = prop;

        // Walk up the property hierarchy to build full path
        while (currentProp && currentProp.name) {
            var partName = currentProp.name;

            // Include property index to handle duplicate names (e.g., multiple "Fill 1 Color" in Essential Properties)
            // Use propertyIndex if available (built-in ExtendScript property)
            try {
                if (currentProp.propertyIndex !== undefined) {
                    partName += "[" + currentProp.propertyIndex + "]";
                }
            } catch(e) {}

            pathParts.unshift(partName);

            // Stop if we reach the layer level
            if (currentProp.propertyType === PropertyType.LAYER) {
                break;
            }

            // Move to parent property
            try {
                currentProp = currentProp.parentProperty;
            } catch(e) {
                // No parent, we're done
                break;
            }
        }

        // Create unique path like "Effects > Blur & Sharpen > Blur > Blurriness"
        // or "Transform > Position" or "Effects > Slider Control > Slider"
        var fullPath = pathParts.join(" > ");

        // Add matchName for extra uniqueness in case of name collisions
        if (prop.matchName) {
            fullPath += " [" + prop.matchName + "]";
        }

        return fullPath;

    } catch(e) {
        // Fallback to basic name if path generation fails
        return prop.name || "Unknown Property";
    }
}

// Generate unique property identifier for Sproing marker compatibility
// Regular properties (Position, Scale, etc.) use simple matchName for backward compatibility
// Pseudo Effect properties use full path with indices to prevent collisions
function getUniquePropertyId(prop) {
    var matchName = prop.matchName;

    // Only use unique path for Pseudo Effect properties
    // Regular properties use simple matchName for backward compatibility with Sproing markers
    if (matchName && matchName.indexOf("Pseudo/") === 0) {
        // Pseudo Effect - build full unique path
        var id = matchName;

        try {
            id = prop.propertyIndex + "/" + id;

            // Walk up the property hierarchy to build full path
            var parent = prop.propertyGroup(1);
            var depth = 2;
            while (parent && depth <= prop.propertyDepth) {
                if (parent.propertyIndex !== undefined) {
                    id = parent.propertyIndex + "/" + id;
                }
                parent = prop.propertyGroup(depth);
                depth++;
            }
        } catch (e) {
            // Fallback to just matchName if property hierarchy fails
            id = matchName;
        }

        return id;
    } else {
        // Regular property - return simple matchName for backward compatibility
        return matchName;
    }
}

// ============================================================================
// KEYFRAME PROTECTION HELPERS
// ============================================================================
// These functions protect adjacent keyframes from unwanted modification during
// keyframe operations. After Effects automatically adjusts adjacent keyframes
// when timeline structure changes, which can corrupt spring animations and
// other precise timing work.

/**
 * Captures the complete state of a keyframe for later restoration
 * @param {Property} prop - The property containing the keyframe
 * @param {number} keyIndex - The 1-based index of the keyframe to capture
 * @returns {Object|null} - Keyframe data object or null if capture fails
 */
function captureKeyframeState(prop, keyIndex) {
    if (!prop || keyIndex < 1 || keyIndex > prop.numKeys) {
        return null;
    }

    try {
        var keyData = {
            index: keyIndex,
            time: prop.keyTime(keyIndex),
            value: prop.keyValue(keyIndex),
            inInterp: prop.keyInInterpolationType(keyIndex),
            outInterp: prop.keyOutInterpolationType(keyIndex),
            temporalContinuous: prop.keyTemporalContinuous(keyIndex),
            temporalAutoBezier: prop.keyTemporalAutoBezier(keyIndex),
            label: prop.keyLabel(keyIndex)
        };

        // Collect temporal ease (even for LINEAR - they have ease with speed=0)
        try {
            keyData.inEase = prop.keyInTemporalEase(keyIndex);
            keyData.outEase = prop.keyOutTemporalEase(keyIndex);
        } catch(e) {
            // Ease might not be available for some property types
        }

        // Collect spatial properties if applicable
        if (prop.isSpatial) {
            try {
                keyData.spatialContinuous = prop.keySpatialContinuous(keyIndex);
                keyData.spatialAutoBezier = prop.keySpatialAutoBezier(keyIndex);
                keyData.inTangent = prop.keyInSpatialTangent(keyIndex);
                keyData.outTangent = prop.keyOutSpatialTangent(keyIndex);
            } catch(e) {
                // Spatial properties might not be available
            }
        }

        return keyData;
    } catch(e) {
        return null;
    }
}

/**
 * Restores a keyframe to its captured state
 * @param {Property} prop - The property containing the keyframe
 * @param {number} currentIndex - The current 1-based index of the keyframe
 * @param {Object} keyData - The captured keyframe state
 * @returns {boolean} - True if restoration succeeded, false otherwise
 */
function restoreKeyframeState(prop, currentIndex, keyData) {
    if (!prop || !keyData || currentIndex < 1 || currentIndex > prop.numKeys) {
        return false;
    }

    try {
        // Restore value
        prop.setValueAtKey(currentIndex, keyData.value);

        // Apply temporal ease first to avoid flipping linear sides
        if (keyData.inEase !== undefined && keyData.outEase !== undefined) {
            try {
                prop.setTemporalEaseAtKey(currentIndex, keyData.inEase, keyData.outEase);
            } catch(e) {
                // Ease setting might fail in some cases
            }
        }

        // Re-assert original interpolation types to preserve one-sided linear/bezier
        prop.setInterpolationTypeAtKey(currentIndex, keyData.inInterp, keyData.outInterp);

        // Restore temporal continuity and auto-bezier
        prop.setTemporalContinuousAtKey(currentIndex, keyData.temporalContinuous);
        prop.setTemporalAutoBezierAtKey(currentIndex, keyData.temporalAutoBezier);

        // Restore spatial properties if applicable
        if (keyData.spatialContinuous !== undefined) {
            prop.setSpatialContinuousAtKey(currentIndex, keyData.spatialContinuous);
            prop.setSpatialAutoBezierAtKey(currentIndex, keyData.spatialAutoBezier);

            // Only restore tangents if NOT auto-bezier (manual tangent control)
            // Auto-bezier tangents are automatically recalculated by AE
            if (!keyData.spatialAutoBezier && keyData.inTangent !== undefined && keyData.outTangent !== undefined) {
                prop.setSpatialTangentsAtKey(currentIndex, keyData.inTangent, keyData.outTangent);
            }
        }

        // Restore keyframe color label
        if (keyData.label !== undefined) {
            prop.setLabelAtKey(currentIndex, keyData.label);
        }

        return true;
    } catch(e) {
        return false;
    }
}

/**
 * Scales KeyframeEase speed to maintain visual curve shape when duration changes
 * @param {Array} easeArray - Array of KeyframeEase objects
 * @param {number} oldDuration - Original duration between keyframes (seconds)
 * @param {number} newDuration - New duration between keyframes (seconds)
 * @returns {Array} - New array of scaled KeyframeEase objects
 */
function scaleEaseForDuration(easeArray, oldDuration, newDuration) {
    if (!easeArray || easeArray.length < 1 || easeArray.length > 3) {
        return easeArray;
    }

    if (oldDuration <= 0 || newDuration <= 0 || Math.abs(oldDuration - newDuration) < 0.001) {
        return easeArray;
    }

    var scaledEase = [];
    var durationRatio = oldDuration / newDuration;

    DEBUG_JSX.log("🔧 Scaling ease for duration change:");
    DEBUG_JSX.log("  Duration: " + (oldDuration * 1000).toFixed(1) + "ms → " + (newDuration * 1000).toFixed(1) + "ms");
    DEBUG_JSX.log("  Speed scale factor: " + durationRatio.toFixed(4));

    for (var i = 0; i < easeArray.length; i++) {
        var ease = easeArray[i];
        if (!ease) {
            scaledEase.push(ease);
            continue;
        }

        // CRITICAL: Scale speed inversely with duration
        // speed = value_change / time, so to maintain same value_change over longer time, reduce speed
        var oldSpeed = ease.speed;
        var newSpeed = oldSpeed * durationRatio;
        var influence = ease.influence; // Keep influence unchanged

        DEBUG_JSX.log("  Dimension " + i + ": speed " + oldSpeed.toFixed(2) + " → " + newSpeed.toFixed(2) + ", influence " + influence.toFixed(2) + "% (unchanged)");

        scaledEase.push(new KeyframeEase(newSpeed, influence));
    }

    return scaledEase;
}

/**
 * Captures the keyframe immediately before a set of selected keyframes
 * This is used to protect adjacent keyframes from AE's automatic modifications
 * @param {Property} prop - The property to check
 * @param {Array} selectedKeyIndices - Array of selected keyframe indices (1-based)
 * @returns {Object|null} - Captured keyframe state or null if no previous key exists
 */
function capturePreviousKeyframe(prop, selectedKeyIndices) {
    if (!prop || !selectedKeyIndices || selectedKeyIndices.length === 0) {
        return null;
    }

    // Find the lowest selected key index
    var minSelectedIndex = selectedKeyIndices[0];
    for (var i = 1; i < selectedKeyIndices.length; i++) {
        if (selectedKeyIndices[i] < minSelectedIndex) {
            minSelectedIndex = selectedKeyIndices[i];
        }
    }

    // Capture the keyframe before the first selected one
    var prevKeyIndex = minSelectedIndex - 1;
    DEBUG_JSX.log("🎯 CAPTURE PREV KEY: minSelected=" + minSelectedIndex + ", prevIndex=" + prevKeyIndex + ", totalKeys=" + prop.numKeys);

    if (prevKeyIndex < 1) {
        DEBUG_JSX.log("⚠️ No previous key to capture (first key selected)");
        return null;
    }

    try {
        var keyData = {
            index: prevKeyIndex,
            time: prop.keyTime(prevKeyIndex),
            value: prop.keyValue(prevKeyIndex),
            inInterp: prop.keyInInterpolationType(prevKeyIndex),
            outInterp: prop.keyOutInterpolationType(prevKeyIndex),
            temporalContinuous: prop.keyTemporalContinuous(prevKeyIndex),
            temporalAutoBezier: prop.keyTemporalAutoBezier(prevKeyIndex),
            label: prop.keyLabel(prevKeyIndex)
        };

        // Collect temporal ease (even for LINEAR - they have ease with speed=0)
        try {
            keyData.inEase = prop.keyInTemporalEase(prevKeyIndex);
            keyData.outEase = prop.keyOutTemporalEase(prevKeyIndex);
        } catch(e) {
            // Ease might not be available for some property types
        }

        // Collect spatial properties if applicable
        if (prop.isSpatial) {
            try {
                keyData.spatialContinuous = prop.keySpatialContinuous(prevKeyIndex);
                keyData.spatialAutoBezier = prop.keySpatialAutoBezier(prevKeyIndex);
                keyData.inTangent = prop.keyInSpatialTangent(prevKeyIndex);
                keyData.outTangent = prop.keyOutSpatialTangent(prevKeyIndex);
            } catch(e) {
                // Spatial properties might not be available
            }
        }

        DEBUG_JSX.log("✅ Captured previous key at index " + prevKeyIndex + ", time=" + keyData.time);
        return keyData;
    } catch(e) {
        DEBUG_JSX.log("❌ Failed to capture previous key: " + e.toString());
        return null;
    }
}

/**
 * Restores a previously captured previous keyframe with duration-aware ease scaling
 * @param {Property} prop - The property to restore on
 * @param {Object} prevKeyData - Captured keyframe state
 * @param {number} keysAdded - Number of keys added (can be negative if removed)
 * @param {number} oldDurationToNext - Original duration to next keyframe (seconds)
 * @param {number} newDurationToNext - New duration to next keyframe (seconds)
 * @returns {boolean} - True if successful
 */
function restorePreviousKeyframe(prop, prevKeyData, keysAdded, oldDurationToNext, newDurationToNext) {
    if (!prop || !prevKeyData) {
        return false;
    }

    try {
        // Calculate new index after keys were added/removed
        var newIndex = prevKeyData.index + keysAdded;

        DEBUG_JSX.log("🔧 RESTORE PREV KEY: Original index=" + prevKeyData.index + ", keysAdded=" + keysAdded + ", newIndex=" + newIndex);

        // Previous keyframe time shouldn't change, so check calculated index
        var targetIndex = -1;
        if (newIndex > 0 && newIndex <= prop.numKeys) {
            var currentTime = prop.keyTime(newIndex);
            if (Math.abs(currentTime - prevKeyData.time) < 0.001) {
                targetIndex = newIndex;
            }
        }

        // Fallback: try to find by time
        if (targetIndex === -1) {
            for (var i = 1; i <= prop.numKeys; i++) {
                if (Math.abs(prop.keyTime(i) - prevKeyData.time) < 0.001) {
                    targetIndex = i;
                    break;
                }
            }
        }

        if (targetIndex === -1) {
            DEBUG_JSX.log("❌ Failed to find previous keyframe");
            return false;
        }

        // CRITICAL: Scale OUT ease if duration to next keyframe changed
        var restoredData = prevKeyData;
        if (oldDurationToNext && newDurationToNext && Math.abs(oldDurationToNext - newDurationToNext) > 0.001) {
            DEBUG_JSX.log("🔧 Scaling previous keyframe OUT ease (duration to next: " + (oldDurationToNext * 1000).toFixed(1) + "ms → " + (newDurationToNext * 1000).toFixed(1) + "ms)");

            // Clone the data and scale only OUT ease
            restoredData = {};
            for (var key in prevKeyData) {
                restoredData[key] = prevKeyData[key];
            }

            if (prevKeyData.outEase) {
                restoredData.outEase = scaleEaseForDuration(prevKeyData.outEase, oldDurationToNext, newDurationToNext);
            }
        }

        DEBUG_JSX.log("✅ Restoring previous keyframe at index " + targetIndex);
        return restoreKeyframeState(prop, targetIndex, restoredData);
    } catch(e) {
        DEBUG_JSX.log("❌ Error restoring previous keyframe: " + e.toString());
        return false;
    }
}

/**
 * Captures the keyframe immediately after a set of selected keyframes
 * This is used to protect adjacent keyframes from AE's automatic modifications
 * @param {Property} prop - The property to check
 * @param {Array} selectedKeyIndices - Array of selected keyframe indices (1-based)
 * @returns {Object|null} - Captured keyframe state or null if no next key exists
 */
function captureNextKeyframe(prop, selectedKeyIndices) {
    if (!prop || !selectedKeyIndices || selectedKeyIndices.length === 0) {
        return null;
    }

    // Find the highest selected key index
    var maxSelectedIndex = selectedKeyIndices[0];
    for (var i = 1; i < selectedKeyIndices.length; i++) {
        if (selectedKeyIndices[i] > maxSelectedIndex) {
            maxSelectedIndex = selectedKeyIndices[i];
        }
    }

    // Capture the keyframe after the last selected one
    var nextKeyIndex = maxSelectedIndex + 1;
    DEBUG_JSX.log("🎯 CAPTURE NEXT KEY: maxSelected=" + maxSelectedIndex + ", nextIndex=" + nextKeyIndex + ", totalKeys=" + prop.numKeys);

    if (nextKeyIndex <= prop.numKeys) {
        var captured = captureKeyframeState(prop, nextKeyIndex);
        if (captured) {
            DEBUG_JSX.log("✅ Captured next key at index " + nextKeyIndex + ", time=" + captured.time);
        }
        return captured;
    }

    DEBUG_JSX.log("⚠️ No next key to capture (last key selected)");
    return null;
}

/**
 * Restores the next keyframe after a keyframe operation
 * Calculates the new index accounting for keys that were added/removed
 * @param {Property} prop - The property containing the keyframe
 * @param {Object} nextKeyData - The captured keyframe state
 * @param {number} keysAdded - Number of keyframes added (positive) or removed (negative)
 * @returns {boolean} - True if restoration succeeded
 */
function restoreNextKeyframe(prop, nextKeyData, keysAdded) {
    if (!prop || !nextKeyData) {
        return false;
    }

    try {
        // Calculate new index after keys were added/removed
        var newIndex = nextKeyData.index + keysAdded;

        DEBUG_JSX.log("🔧 RESTORE NEXT KEY: Original index=" + nextKeyData.index + ", keysAdded=" + keysAdded + ", newIndex=" + newIndex + ", expectedTime=" + nextKeyData.time);

        // First, try the calculated index (works when keys don't move in time)
        if (newIndex > 0 && newIndex <= prop.numKeys) {
            var currentTime = prop.keyTime(newIndex);
            DEBUG_JSX.log("🔧 Checking calculated index " + newIndex + ": time=" + currentTime + ", expected=" + nextKeyData.time);
            if (Math.abs(currentTime - nextKeyData.time) < 0.001) {
                DEBUG_JSX.log("✅ Time matched at calculated index, restoring");
                return restoreKeyframeState(prop, newIndex, nextKeyData);
            }
        }

        // If time doesn't match at calculated index, the keyframe is at the same
        // absolute position but the timeline structure around it changed.
        // The keyframe should still be at the same index position relative to
        // the newly added keys. Try the calculated index regardless of time:
        if (newIndex > 0 && newIndex <= prop.numKeys) {
            DEBUG_JSX.log("⚠️ Time didn't match, but restoring at calculated index anyway");
            return restoreKeyframeState(prop, newIndex, nextKeyData);
        }

        // Last resort: try to find by time (works for snap-to-playhead style operations)
        DEBUG_JSX.log("🔍 Searching for keyframe by time...");
        for (var i = 1; i <= prop.numKeys; i++) {
            if (Math.abs(prop.keyTime(i) - nextKeyData.time) < 0.001) {
                DEBUG_JSX.log("✅ Found by time at index " + i);
                return restoreKeyframeState(prop, i, nextKeyData);
            }
        }

        DEBUG_JSX.log("❌ Failed to restore next keyframe");
        return false;
    } catch(e) {
        DEBUG_JSX.log("❌ Error restoring next keyframe: " + e.toString());
        return false;
    }
}

// User Preferences - Save/Load resolution multiplier
function saveResolutionPreference(multiplier) {
    try {
        $.writeln("=== JSX DEBUG TEST in saveResolutionPreference ===");
        app.settings.saveSetting("AirBoard", "resolutionMultiplier", multiplier.toString());
        return "success";
    } catch(e) {
        $.writeln("Failed to save resolution preference: " + e.toString());
        return "error";
    }
}

function loadResolutionPreference() {
    try {
        var saved = app.settings.getSetting("AirBoard", "resolutionMultiplier");
        if (saved !== "") {
            var value = parseInt(saved);
            // Validate the saved value is within valid range
            if (value >= 1 && value <= 6) {
                return value;
            }
        }
        return 2; // Default to 2x if no valid preference found
    } catch(e) {
        $.writeln("Failed to load resolution preference: " + e.toString());
        return 2; // Default to 2x on error
    }
}

// Save section order preference
function saveSectionOrder(sectionOrder) {
    try {
        app.settings.saveSetting("AirBoard", "sectionOrder", sectionOrder);
        return "Section order saved";
    } catch(e) {
        $.writeln("Failed to save section order: " + e.toString());
        return "error";
    }
}

// Load section order preference
function loadSectionOrder() {
    try {
        var saved = app.settings.getSetting("AirBoard", "sectionOrder");
        if (saved !== "") {
            return saved;
        }
        return ""; // Default empty order
    } catch(e) {
        $.writeln("Failed to load section order: " + e.toString());
        return ""; // Default empty order on error
    }
}

// Clear section order preference (for one-time reset)
function clearSectionOrder() {
    try {
        app.settings.saveSetting("AirBoard", "sectionOrder", "");
        return "Section order cleared";
    } catch(e) {
        $.writeln("Failed to clear section order: " + e.toString());
        return "error";
    }
}

// Save accordion states preference
function saveAccordionStates(accordionStates) {
    try {
        app.settings.saveSetting("AirBoard", "accordionStates", accordionStates);
        return "Accordion states saved";
    } catch(e) {
        $.writeln("Failed to save accordion states: " + e.toString());
        return "error";
    }
}

// Load accordion states preference
function loadAccordionStates() {
    try {
        var saved = app.settings.getSetting("AirBoard", "accordionStates");
        if (saved !== "") {
            return saved;
        }
        return ""; // Default empty states
    } catch(e) {
        $.writeln("Failed to load accordion states: " + e.toString());
        return ""; // Default empty states on error
    }
}

// NEW: Smart keyframe reader (cross-property OR single-property)
function readKeyframesSmart() {
    try {
        // Reset baseline cache when reading keyframes fresh
        BASELINE_CACHE.reset();
        
        // Simple cumulative delay tracking for single layers
        if (typeof SINGLE_LAYER_CUMULATIVE === 'undefined') {
            $.writeln("Initializing SINGLE_LAYER_CUMULATIVE");
            SINGLE_LAYER_CUMULATIVE = 0;
        }
        // Reset cumulative on fresh read
        SINGLE_LAYER_CUMULATIVE = 0;
        
        // Reset timeline mode cumulative tracking
        if (typeof TIMELINE_MODE_CUMULATIVE === 'undefined') {
            TIMELINE_MODE_CUMULATIVE = 0;
        }
        TIMELINE_MODE_CUMULATIVE = 0;
        
        // Reset multi-layer cumulative tracking
        if (typeof MULTI_LAYER_CUMULATIVE === 'undefined') {
            MULTI_LAYER_CUMULATIVE = 0;
        }
        MULTI_LAYER_CUMULATIVE = 0;
        
        // Reset global delay cumulative tracking
        if (typeof GLOBAL_DELAY_CUMULATIVE === 'undefined') {
            GLOBAL_DELAY_CUMULATIVE = 0;
        }
        GLOBAL_DELAY_CUMULATIVE = 0;
        
        // Update last known selection and playhead
        LAST_SELECTION_HASH = getSelectionHash();
        var comp = app.project.activeItem;
        if (comp && comp instanceof CompItem) {
            LAST_PLAYHEAD_POSITION = comp.time;
        }
        
        var comp = app.project.activeItem;
        if (!comp || !(comp instanceof CompItem)) {
            return "error|No composition selected";
        }
        
        var selectedLayers = comp.selectedLayers;
        if (selectedLayers.length === 0) {
            return "error|No layers selected";
        }
        
        var propertyEncounterCounter = 0;
        var propertyTimes = [];
        
        // Generic function to recursively search for selected keyframes
        function searchAllProperties(propGroup, layerRef) {
            for (var i = 1; i <= propGroup.numProperties; i++) {
                var prop = propGroup.property(i);
                
                // Check if this property has keyframes and selected keyframes
                if (prop && prop.canVaryOverTime && prop.numKeys > 0) {
                    var hasSelection = false;
                    var earliestTime = null;
                    var earliestKeyIndex = -1;
                    for (var j = 1; j <= prop.numKeys; j++) {
                        if (prop.keySelected(j)) {
                            var selectedTime = prop.keyTime(j);
                            if (!hasSelection || selectedTime < earliestTime) {
                                earliestTime = selectedTime;
                                earliestKeyIndex = j;
                            }
                            hasSelection = true;
                        }
                    }
                    
                    if (hasSelection) {
                        var fullPath = getFullPropertyPath(prop);
                        propertyTimes.push({
                            name: prop.name,
                            property: prop,
                            layer: layerRef,
                            time: earliestTime,
                            keyIndex: earliestKeyIndex,
                            order: propertyEncounterCounter++,
                            fullPath: fullPath
                        });
                    }
                }
                
                // Recurse into property groups
                if (prop && (prop.propertyType === PropertyType.INDEXED_GROUP || 
                             prop.propertyType === PropertyType.NAMED_GROUP)) {
                    searchAllProperties(prop, layerRef);
                }
            }
        }
        
        // Search properties across ALL selected layers
        for (var layerIndex = 0; layerIndex < selectedLayers.length; layerIndex++) {
            var layer = selectedLayers[layerIndex];
            searchAllProperties(layer, layer);
        }
        
        // Also check special properties that might not be in the main layer group (across all layers)
        for (var layerIndex = 0; layerIndex < selectedLayers.length; layerIndex++) {
            var layer = selectedLayers[layerIndex];
            try {
                if (layer.timeRemapEnabled && layer.timeRemap && layer.timeRemap.numKeys > 0) {
                    var hasTimeRemapSelection = false;
                    var earliestTRTime = null;
                    var earliestTRIndex = -1;
                    for (var j = 1; j <= layer.timeRemap.numKeys; j++) {
                        if (layer.timeRemap.keySelected(j)) {
                            var trTime = layer.timeRemap.keyTime(j);
                            if (!hasTimeRemapSelection || trTime < earliestTRTime) {
                                earliestTRTime = trTime;
                                earliestTRIndex = j;
                            }
                            hasTimeRemapSelection = true;
                        }
                    }
                    
                    if (hasTimeRemapSelection) {
                        propertyTimes.push({
                            name: "Time Remap",
                            property: layer.timeRemap,
                            layer: layer,
                            time: earliestTRTime,
                            keyIndex: earliestTRIndex,
                            order: propertyEncounterCounter++,
                            fullPath: "Time Remap"
                        });
                    }
                }
            } catch(e) {
                // Time remap might not be accessible on this layer, continue to next
            }
        }
        
        // CHECK FOR INSUFFICIENT KEYFRAMES FOR DURATION OPERATIONS
        // Count total selected keyframes across all properties
        var totalSelectedKeyframes = 0;
        for (var layerIndex = 0; layerIndex < selectedLayers.length; layerIndex++) {
            var layer = selectedLayers[layerIndex];
            
            function countSelectedInPropertyGroup(propGroup) {
                var count = 0;
                for (var i = 1; i <= propGroup.numProperties; i++) {
                    var prop = propGroup.property(i);
                    
                    if (prop && prop.canVaryOverTime && prop.numKeys > 0) {
                        for (var j = 1; j <= prop.numKeys; j++) {
                            if (prop.keySelected(j)) {
                                count++;
                            }
                        }
                    }
                    
                    // Recurse into property groups
                    if (prop && (prop.propertyType === PropertyType.INDEXED_GROUP || 
                               prop.propertyType === PropertyType.NAMED_GROUP)) {
                        count += countSelectedInPropertyGroup(prop);
                    }
                }
                return count;
            }
            
            totalSelectedKeyframes += countSelectedInPropertyGroup(layer);
            
            // Also count Time Remap
            try {
                if (layer.timeRemapEnabled && layer.timeRemap && layer.timeRemap.numKeys > 0) {
                    for (var j = 1; j <= layer.timeRemap.numKeys; j++) {
                        if (layer.timeRemap.keySelected(j)) {
                            totalSelectedKeyframes++;
                        }
                    }
                }
            } catch(e) {
                // Time remap might not be accessible
            }
        }
        
        DEBUG_JSX.log("Total selected keyframes count: " + totalSelectedKeyframes);
        
        // If only 1 keyframe selected total, return special result with duration error but check for position
        if (totalSelectedKeyframes === 1) {
            DEBUG_JSX.log("Only 1 keyframe selected - showing duration error but checking position");
            
            // Return success but with -999 duration to signal error
            var frameRate = comp.frameRate || 30;
            var delayMs = 0, delayFrames = 0; // No delay for single keyframe
            var debugInfo = "Single keyframe selected - duration operations require 2+ keyframes";
            
            // Calculate position distances even for single keyframe case
            var xDistance = 0, yDistance = 0, hasXDistance = false, hasYDistance = false;
            
            // Check if the single keyframe is a position keyframe
            for (var k = 0; k < propertyTimes.length; k++) {
                var propInfo = propertyTimes[k];
                var prop = propInfo.property;
                
                if (isPositionProperty(prop)) {
                    // Get the selected keyframe(s) for this property
                    var selectedKeys = [];
                    for (var j = 1; j <= prop.numKeys; j++) {
                        if (prop.keySelected(j)) {
                            selectedKeys.push(j);
                        }
                    }
                    
                    if (selectedKeys.length >= 1) {
                        DEBUG_JSX.log("Found position property with " + selectedKeys.length + " selected keyframes");
                        var distance = calculatePositionDistance(prop, selectedKeys);
                        DEBUG_JSX.log("Single keyframe position distance: x=" + distance.x + ", y=" + distance.y + ", hasX=" + distance.hasX + ", hasY=" + distance.hasY);
                        
                        if (distance.hasX) {
                            hasXDistance = true;
                        }
                        if (distance.hasY) {
                            hasYDistance = true;
                        }
                    }
                }
            }
            
            // Use -999 as a special flag for "Select > 1 Key" in duration field
            return "success|" + delayMs + "|" + delayFrames + "|-999|-999|1|" + xDistance + "|" + yDistance + "|" + (hasXDistance ? "1" : "0") + "|" + (hasYDistance ? "1" : "0") + "|1|Stagger|" + debugInfo;
        }
        
        // CROSS-PROPERTY MODE: Multiple properties with selected keyframes
        if (propertyTimes.length >= 2) {
            // Sort by time and calculate delays from earliest
            propertyTimes.sort(function(a, b) { return a.time - b.time; });
            var earliestTime = propertyTimes[0].time;
            
            // Calculate all delays from earliest keyframe
            var delays = [];
            for (var k = 0; k < propertyTimes.length; k++) {
                var timeDiff = propertyTimes[k].time - earliestTime;
                var delayMs = roundMs(timeDiff);
                DEBUG_JSX.log("Delay calc " + k + ": " + (propertyTimes[k].time * 1000).toFixed(3) + "ms - " + (earliestTime * 1000).toFixed(3) + "ms = " + (timeDiff * 1000).toFixed(3) + "ms -> rounded: " + delayMs + "ms");
                delays.push(delayMs);
            }
            
            // Check if all delays are the same (find unique delays with tolerance)
            var uniqueDelays = [];
            for (var k = 0; k < delays.length; k++) {
                var found = false;
                for (var j = 0; j < uniqueDelays.length; j++) {
                    if (Math.abs(uniqueDelays[j] - delays[k]) < 1) { // 1ms tolerance
                        found = true;
                        break;
                    }
                }
                if (!found) {
                    uniqueDelays.push(delays[k]);
                }
            }
            
            var resultDelayMs, resultDelayFrames;
            var frameRate = comp.frameRate || 30;
            
            if (propertyTimes.length === 2) {
                // Only 2 properties - show the delay between them
                resultDelayMs = delays[1]; // Second property's delay from first
                resultDelayFrames = Math.round((resultDelayMs / 1000) * frameRate);
            } else {
                // 3+ properties - check if all non-zero delays are the same
                var nonZeroDelays = [];
                for (var k = 1; k < delays.length; k++) { // Skip first delay (always 0)
                    if (delays[k] > 0) {
                        nonZeroDelays.push(delays[k]);
                    }
                }
                
                // Find unique non-zero delays (with tolerance)
                var uniqueNonZeroDelays = [];
                for (var k = 0; k < nonZeroDelays.length; k++) {
                    var found = false;
                    for (var j = 0; j < uniqueNonZeroDelays.length; j++) {
                        if (Math.abs(uniqueNonZeroDelays[j] - nonZeroDelays[k]) < 1) { // 1ms tolerance
                            found = true;
                            break;
                        }
                    }
                    if (!found) {
                        uniqueNonZeroDelays.push(nonZeroDelays[k]);
                    }
                }
                
                if (uniqueNonZeroDelays.length === 0) {
                    // All keyframes at same time
                    resultDelayMs = 0;
                    resultDelayFrames = 0;
                } else if (uniqueNonZeroDelays.length === 1) {
                    // All non-zero delays are the same
                    resultDelayMs = uniqueNonZeroDelays[0];
                    resultDelayFrames = Math.round((resultDelayMs / 1000) * frameRate);
                } else {
                    // Different non-zero delays - show "Multiple"
                    resultDelayMs = -1; // Special flag for "Multiple"
                    resultDelayFrames = -1;
                }
            }
            
            // Calculate duration for each property and check if they're all the same
            var resultDurationMs = 0, resultDurationFrames = 0;
            var propertyDurations = [];

            DEBUG_JSX.log("Calculating duration for each property to check if they're the same");

            // Calculate duration for each property (first to last selected keyframe)
            for (var k = 0; k < propertyTimes.length; k++) {
                var propInfo = propertyTimes[k];
                var prop = propInfo.property;

                // Get all selected keyframe times for this property
                var selectedTimes = [];
                for (var j = 1; j <= prop.numKeys; j++) {
                    if (prop.keySelected(j)) {
                        selectedTimes.push(prop.keyTime(j));
                    }
                }

                if (selectedTimes.length >= 2) {
                    // Sort times to get first and last for this property
                    selectedTimes.sort(function(a, b) { return a - b; });
                    var propFirstTime = selectedTimes[0];
                    var propLastTime = selectedTimes[selectedTimes.length - 1];
                    var propDuration = propLastTime - propFirstTime;
                    var propDurationMs = roundMs(propDuration);

                    DEBUG_JSX.log("Property " + propInfo.name + ": first=" + (propFirstTime * 1000).toFixed(3) + "ms, last=" + (propLastTime * 1000).toFixed(3) + "ms, duration=" + propDurationMs + "ms");

                    propertyDurations.push(propDurationMs);
                }
            }

            // Check if all property durations are the same (with 1ms tolerance, same as delay logic)
            var uniqueDurations = [];
            for (var k = 0; k < propertyDurations.length; k++) {
                var found = false;
                for (var j = 0; j < uniqueDurations.length; j++) {
                    if (Math.abs(uniqueDurations[j] - propertyDurations[k]) < 1) { // 1ms tolerance
                        found = true;
                        break;
                    }
                }
                if (!found) {
                    uniqueDurations.push(propertyDurations[k]);
                }
            }

            DEBUG_JSX.log("Found " + uniqueDurations.length + " unique durations: " + uniqueDurations.join(", ") + "ms");

            if (uniqueDurations.length === 0) {
                // No durations found (all single keyframes)
                resultDurationMs = 0;
                resultDurationFrames = 0;
            } else if (uniqueDurations.length === 1) {
                // All properties have the same duration
                resultDurationMs = uniqueDurations[0];
                resultDurationFrames = Math.round((resultDurationMs / 1000) * frameRate);
                DEBUG_JSX.log("All properties have same duration: " + resultDurationMs + "ms");
            } else {
                // Different durations - show "Multiple"
                resultDurationMs = -1; // Special flag for "Multiple"
                resultDurationFrames = -1;
                DEBUG_JSX.log("Properties have different durations - showing Multiple");
            }
            
            // Calculate position distances from the propertyTimes array
            var xDistance = 0, yDistance = 0, hasXDistance = false, hasYDistance = false;
            var positionPropertiesCount = 0;
            var positionLayers = {}; // Track which layers have position properties
            var allXDistances = []; // Track all X distances to check if they're the same
            var allYDistances = []; // Track all Y distances to check if they're the same
            
            try {
                DEBUG_JSX.log("CROSS-PROPERTY DEBUG: Searching propertyTimes for position data");
                DEBUG_JSX.log("PropertyTimes length: " + propertyTimes.length);
                
                // Search through propertyTimes for position properties
                for (var k = 0; k < propertyTimes.length; k++) {
                    var propInfo = propertyTimes[k];
                    var prop = propInfo.property;
                    
                    DEBUG_JSX.log("Checking property: " + propInfo.name + " (isPosition: " + isPositionProperty(prop) + ")");
                    
                    if (isPositionProperty(prop)) {
                        // Collect ALL selected keyframes for this position property, not just the first one
                        var allSelectedKeys = [];
                        for (var j = 1; j <= prop.numKeys; j++) {
                            if (prop.keySelected(j)) {
                                allSelectedKeys.push(j);
                            }
                        }
                        
                        if (allSelectedKeys.length >= 2) {
                            DEBUG_JSX.log("Found position property " + propInfo.name + " with " + allSelectedKeys.length + " selected keyframes");
                            
                            // Track which layer this property belongs to
                            var layerName = propInfo.layer ? propInfo.layer.name : "Unknown";
                            positionLayers[layerName] = true;
                            positionPropertiesCount++;
                            
                            var distance = calculatePositionDistance(prop, allSelectedKeys);
                            DEBUG_JSX.log("Position distance calculated: x=" + distance.x + ", y=" + distance.y + ", hasX=" + distance.hasX + ", hasY=" + distance.hasY);
                            
                            if (distance.hasX) {
                                allXDistances.push(distance.x);
                                hasXDistance = true;
                            }
                            if (distance.hasY) {
                                allYDistances.push(distance.y);
                                hasYDistance = true;
                            }
                        }
                    }
                }
                
                // Check if we have multiple position properties from different layers
                var layerCount = 0;
                for (var layerName in positionLayers) {
                    layerCount++;
                }
                
                // If we have multiple position properties, check if they all have the same distance
                if (layerCount > 1 || positionPropertiesCount > 1) {
                    DEBUG_JSX.log("Multiple position properties detected across " + layerCount + " layers");
                    
                    // Check if all X distances are the same
                    if (hasXDistance && allXDistances.length > 1) {
                        var firstX = allXDistances[0];
                        var allXSame = true;
                        for (var i = 1; i < allXDistances.length; i++) {
                            if (Math.abs(allXDistances[i] - firstX) > 0.5) { // 0.5px tolerance
                                allXSame = false;
                                break;
                            }
                        }
                        xDistance = allXSame ? firstX : -999999; // Use actual value if all same, otherwise "Multiple"
                        DEBUG_JSX.log("X distances: [" + allXDistances.join(", ") + "], all same: " + allXSame + ", result: " + xDistance);
                    } else if (hasXDistance && allXDistances.length === 1) {
                        xDistance = allXDistances[0]; // Single distance
                    }
                    
                    // Check if all Y distances are the same
                    if (hasYDistance && allYDistances.length > 1) {
                        var firstY = allYDistances[0];
                        var allYSame = true;
                        for (var i = 1; i < allYDistances.length; i++) {
                            if (Math.abs(allYDistances[i] - firstY) > 0.5) { // 0.5px tolerance
                                allYSame = false;
                                break;
                            }
                        }
                        yDistance = allYSame ? firstY : -999999; // Use actual value if all same, otherwise "Multiple"
                        DEBUG_JSX.log("Y distances: [" + allYDistances.join(", ") + "], all same: " + allYSame + ", result: " + yDistance);
                    } else if (hasYDistance && allYDistances.length === 1) {
                        yDistance = allYDistances[0]; // Single distance
                    }
                } else {
                    // Single position property - use the distance directly
                    if (hasXDistance && allXDistances.length > 0) {
                        xDistance = allXDistances[0];
                    }
                    if (hasYDistance && allYDistances.length > 0) {
                        yDistance = allYDistances[0];
                    }
                }
                
                DEBUG_JSX.log("Final position results: x=" + xDistance + ", y=" + yDistance + ", hasX=" + hasXDistance + ", hasY=" + hasYDistance);
                
            } catch(posError) {
                // Position calculation failed, use defaults
                DEBUG_JSX.log("Position calculation failed: " + posError.toString());
            }
            
            // Build debug info for cross-layer support  
            var debugInfo = [];
            debugInfo.push("Found " + propertyTimes.length + " keyframes across " + selectedLayers.length + " layers");
            for (var debugIdx = 0; debugIdx < propertyTimes.length; debugIdx++) {
                var debugProp = propertyTimes[debugIdx];
                debugInfo.push(debugProp.layer.name + ":" + debugProp.name + " at " + Math.round(debugProp.time * 1000) + "ms");
            }
            
            // Calculate stagger for keyframes (cross-property mode)
            var staggerMs = 0, staggerFrames = 0, staggerText = "Stagger";
            try {
                DEBUG_JSX.log("About to call calculateStagger with " + propertyTimes.length + " property times");
                staggerText = calculateStagger(propertyTimes, frameRate, true, false); // true = keyframe mode, false = use auto-detection
                DEBUG_JSX.log("calculateStagger returned: " + staggerText);
                if (staggerText.indexOf("ms") > 0) {
                    // Extract numeric values for backward compatibility
                    var parts = staggerText.split(" / ");
                    if (parts.length === 2) {
                        staggerMs = parseInt(parts[0].replace("ms", "")) || 0;
                        staggerFrames = parseInt(parts[1].replace("f", "")) || 0;
                    }
                }
            } catch(e) {
                DEBUG_JSX.log("❌ STAGGER CALCULATION EXCEPTION: " + e.toString());
                DEBUG_JSX.log("❌ Exception occurred during calculateStagger call");
            }
            
            // Collect all debug messages including those from calculateStagger
            var allDebugMessages = DEBUG_JSX.getMessages();
            var finalDebugInfo = debugInfo.concat(allDebugMessages);
            
            return "success|" + resultDelayMs + "|" + resultDelayFrames + "|" + resultDurationMs + "|" + resultDurationFrames + "|1|" + xDistance + "|" + yDistance + "|" + (hasXDistance ? "1" : "0") + "|" + (hasYDistance ? "1" : "0") + "|1|" + staggerText + "|" + finalDebugInfo.join(" | ");
        }
        
        // SINGLE-PROPERTY MODE: Multiple keyframes on one property
        // Check if any property has multiple selected keyframes
        var singlePropertyData = null;
        
        // Generic function to recursively search for properties with multiple selected keyframes
        function searchForMultipleKeyframes(propGroup) {
            for (var i = 1; i <= propGroup.numProperties; i++) {
                var prop = propGroup.property(i);
                
                // Check if this property has multiple selected keyframes
                if (prop && prop.canVaryOverTime && prop.numKeys > 0) {
                    var selectedKeys = [];
                    for (var j = 1; j <= prop.numKeys; j++) {
                        if (prop.keySelected(j)) {
                            selectedKeys.push(j);
                        }
                    }
                    if (selectedKeys.length >= 2) {
                        return {
                            property: prop,
                            keys: selectedKeys
                        };
                    }
                }
                
                // Recurse into property groups
                if (prop && (prop.propertyType === PropertyType.INDEXED_GROUP || 
                           prop.propertyType === PropertyType.NAMED_GROUP)) {
                    var result = searchForMultipleKeyframes(prop);
                    if (result) return result;
                }
            }
            return null;
        }
        
        // Search all selected layers for properties with multiple selected keyframes
        for (var layerIndex = 0; layerIndex < selectedLayers.length && !singlePropertyData; layerIndex++) {
            var layer = selectedLayers[layerIndex];
            singlePropertyData = searchForMultipleKeyframes(layer);
            
            // Also check Time Remap for multiple keyframes on this layer
            if (!singlePropertyData) {
                try {
                    if (layer.timeRemapEnabled && layer.timeRemap && layer.timeRemap.numKeys > 0) {
                        var selectedKeys = [];
                        for (var j = 1; j <= layer.timeRemap.numKeys; j++) {
                            if (layer.timeRemap.keySelected(j)) {
                                selectedKeys.push(j);
                        }
                    }
                    if (selectedKeys.length >= 2) {
                        singlePropertyData = {
                            property: layer.timeRemap,
                            keys: selectedKeys
                        };
                    }
                }
            } catch(e) {
                // Time remap might not be available
            }
            }
        }
        
        if (singlePropertyData) {
            // For single-property mode, delegate to the original working function
            DEBUG_JSX.log("Single property mode detected - delegating to readKeyframesDuration()");
            var result = readKeyframesDuration();
            
            // Add cross-property mode flag and stagger (false for single-property mode)
            if (result && result.indexOf('success|') === 0) {
                return result + "|0|Stagger"; // Add |0 to indicate single-property mode, |Stagger for default stagger text
            }
            return result;
        }
        
        // No keyframes selected - try reading layer delays
        DEBUG_JSX.log("No keyframes found, attempting to read layer delays");
        return readLayerDelays(selectedLayers, comp);
        
    } catch(e) {
        return "error|" + e.toString();
    }
}

function calculateSameLayerPropertyStagger(timingData, frameRate) {
    try {
        DEBUG_JSX.log("calculateSameLayerPropertyStagger: analyzing " + timingData.length + " items");
        var propertyMap = {};
        var propertyList = [];
        
        for (var i = 0; i < timingData.length; i++) {
            var item = timingData[i];
            if (!item || !item.property) {
                continue;
            }
            
            var path = item.fullPath ? item.fullPath : getFullPropertyPath(item.property);
            var entry = propertyMap[path];
            if (!entry) {
                entry = {
                    path: path,
                    earliestTime: item.time,
                    times: [item.time],
                    order: item.order !== undefined ? item.order : propertyList.length
                };
                propertyMap[path] = entry;
                propertyList.push(entry);
            } else {
                entry.times.push(item.time);
                if (item.time < entry.earliestTime) {
                    entry.earliestTime = item.time;
                }
            }
        }
        
        if (propertyList.length <= 1) {
            DEBUG_JSX.log("calculateSameLayerPropertyStagger: only " + propertyList.length + " properties, returning default");
            return "Stagger";
        }
        
        propertyList.sort(function(a, b) {
            if (Math.abs(a.earliestTime - b.earliestTime) > 0.0005) {
                return a.earliestTime - b.earliestTime;
            }
            if (a.order !== undefined && b.order !== undefined && a.order !== b.order) {
                return a.order - b.order;
            }
            return 0;
        });
        
        for (var debugIdx = 0; debugIdx < propertyList.length; debugIdx++) {
            var entry = propertyList[debugIdx];
            DEBUG_JSX.log("Same-layer property order " + debugIdx + ": " + entry.path + " @ " + (entry.earliestTime * 1000).toFixed(3) + "ms (order=" + entry.order + ")");
        }
        
        var staggers = [];
        for (var s = 1; s < propertyList.length; s++) {
            var prev = propertyList[s - 1];
            var current = propertyList[s];
            var diff = current.earliestTime - prev.earliestTime;
            var staggerMs = roundMs(diff);
            DEBUG_JSX.log("Same-layer stagger " + s + ": " + (prev.earliestTime * 1000).toFixed(3) + "ms -> " + (current.earliestTime * 1000).toFixed(3) + "ms = " + (diff * 1000).toFixed(3) + "ms -> rounded: " + staggerMs + "ms");
            staggers.push(staggerMs);
        }
        
        if (staggers.length === 0) {
            return "Stagger";
        }
        
        var firstStagger = staggers[0];
        var allSame = true;
        for (var v = 1; v < staggers.length; v++) {
            if (Math.abs(staggers[v] - firstStagger) > 1) {
                allSame = false;
                break;
            }
        }
        
        if (!allSame) {
            return "Multiple";
        }
        
        if (firstStagger === 0) {
            return "0ms / 0f";
        }
        
        var staggerFrames = Math.round((Math.abs(firstStagger) / 1000) * frameRate);
        var sign = firstStagger < 0 ? "-" : "";
        return sign + Math.abs(firstStagger) + "ms / " + sign + staggerFrames + "f";
        
    } catch(e) {
        DEBUG_JSX.log("calculateSameLayerPropertyStagger error: " + e.toString());
        return "Stagger";
    }
}

// Calculate stagger from timing data (works for both keyframes and layers)
function calculateStagger(timingData, frameRate, isKeyframeMode, isReverseDirection) {
    try {
        DEBUG_JSX.log("calculateStagger called with " + timingData.length + " items, isKeyframeMode=" + isKeyframeMode);
        
        if (timingData.length <= 1) {
            DEBUG_JSX.log("calculateStagger: Only " + timingData.length + " items, returning default");
            return "Stagger"; // Default text for single item
        }
        
        if (isKeyframeMode && timingData.length > 1) {
            var baseLayerIndex = timingData[0].layer ? timingData[0].layer.index : null;
            var singleLayerMode = baseLayerIndex !== null;
            if (singleLayerMode) {
                for (var sameIdx = 1; sameIdx < timingData.length; sameIdx++) {
                    if (!timingData[sameIdx].layer || timingData[sameIdx].layer.index !== baseLayerIndex) {
                        singleLayerMode = false;
                        break;
                    }
                }
            }
            if (singleLayerMode) {
                DEBUG_JSX.log("calculateStagger: single-layer keyframe mode detected (layer index " + baseLayerIndex + ")");
                return calculateSameLayerPropertyStagger(timingData, frameRate);
            }
        }
        
        // Group by layer for keyframe mode, or use layer start times for layer mode
        var layerTimes = [];
        
        if (isKeyframeMode) {
            // Group all keyframe times by layer to analyze timing patterns
            var layerGroups = {};
            for (var i = 0; i < timingData.length; i++) {
                var item = timingData[i];
                var layerIndex = item.layer.index;
                
                if (!layerGroups[layerIndex]) {
                    layerGroups[layerIndex] = {
                        times: [],
                        index: layerIndex,
                        name: item.layer.name
                    };
                }
                
                // Collect all keyframe times for this layer in seconds (preserve precision)
                var timeSeconds = item.time;
                // ExtendScript doesn't have indexOf, so use manual search
                var timeExists = false;
                for (var t = 0; t < layerGroups[layerIndex].times.length; t++) {
                    if (Math.abs(layerGroups[layerIndex].times[t] - timeSeconds) < 0.001) { // 1ms tolerance in seconds
                        timeExists = true;
                        break;
                    }
                }
                if (!timeExists) {
                    layerGroups[layerIndex].times.push(timeSeconds);
                }
            }
            
            // Convert to array and use earliest time per layer for stagger calculation
            for (var layerIndex in layerGroups) {
                var group = layerGroups[layerIndex];
                group.times.sort(function(a, b) { return a - b; }); // Sort times
                // Build debug string manually since ExtendScript doesn't have map()
                var timesDebug = [];
                for (var t = 0; t < group.times.length; t++) {
                    timesDebug.push((group.times[t] * 1000).toFixed(3) + "ms");
                }
                DEBUG_JSX.log("Layer " + group.name + " (index " + group.index + ") has times: " + timesDebug.join(", ") + ", using earliest: " + (group.times[0] * 1000).toFixed(3) + "ms");
                layerTimes.push({
                    time: group.times[0], // Use earliest time in seconds (already precise)
                    index: group.index,
                    name: group.name,
                    allTimes: group.times // Keep all times for pattern analysis
                });
            }
            DEBUG_JSX.log("Created " + layerTimes.length + " layer groups for stagger calculation");
        } else {
            // Layer mode - use start times directly
            for (var i = 0; i < timingData.length; i++) {
                var layer = timingData[i];
                layerTimes.push({
                    time: layer.time,
                    index: layer.index, // Use actual layer index for proper ordering
                    name: layer.name
                });
            }
        }
        
        if (layerTimes.length <= 1) {
            return "Stagger"; // Default text for single layer
        }

        // Sort in the same direction that staggers were applied
        // This ensures the sign of the calculated stagger matches the direction used during application
        if (isReverseDirection) {
            // Reverse mode: staggers are applied top-to-bottom (ascending index)
            layerTimes.sort(function(a, b) { return a.index - b.index; });
            DEBUG_JSX.log("Sorting top-to-bottom (ascending index) for reverse mode stagger calculation");
        } else {
            // Normal mode: staggers are applied bottom-to-top (descending index)
            layerTimes.sort(function(a, b) { return b.index - a.index; });
            DEBUG_JSX.log("Sorting bottom-to-top (descending index) for normal mode stagger calculation");
        }
        
        if (isKeyframeMode) {
            DEBUG_JSX.log("After sorting:");
            for (var i = 0; i < layerTimes.length; i++) {
                DEBUG_JSX.log("  Layer " + layerTimes[i].index + " (" + layerTimes[i].name + ") at " + Math.round(layerTimes[i].time * 1000) + "ms");
            }
        }
        
        // Calculate time differences between consecutive items using same method as delay calculation
        var staggers = [];
        for (var i = 1; i < layerTimes.length; i++) {
            // Use the same direct calculation method as delay for consistency
            var timeDiff = layerTimes[i].time - layerTimes[i-1].time;
            var staggerMs = roundMs(timeDiff);
            DEBUG_JSX.log("Stagger " + i + ": " + (layerTimes[i-1].time * 1000).toFixed(3) + "ms -> " + (layerTimes[i].time * 1000).toFixed(3) + "ms = " + (timeDiff * 1000).toFixed(3) + "ms -> rounded: " + staggerMs + "ms");
            staggers.push(staggerMs);
        }
        
        DEBUG_JSX.log("All staggers: [" + staggers.join(", ") + "]");
        
        if (staggers.length === 0) {
            DEBUG_JSX.log("No staggers calculated, returning default");
            return "Stagger"; // No stagger to calculate
        }
        
        // Check if all staggers are the same (within 1ms tolerance)
        var firstStagger = staggers[0];
        var allSame = true;
        for (var i = 1; i < staggers.length; i++) {
            if (Math.abs(staggers[i] - firstStagger) > 1) {
                allSame = false;
                break;
            }
        }
        
        DEBUG_JSX.log("First stagger: " + firstStagger + "ms, allSame: " + allSame);
        
        if (!allSame) {
            return "Multiple"; // Different stagger values
        }
        
        // Additional check for keyframe mode: if layers have different timing patterns, show "Multiple"
        // This catches cases where some layers have keyframes at multiple times while others don't
        if (isKeyframeMode) {
            var hasInconsistentPatterns = false;
            
            // Check if layers have different numbers of unique keyframe times
            var timeCounts = [];
            for (var i = 0; i < layerTimes.length; i++) {
                timeCounts.push(layerTimes[i].allTimes.length);
            }
            
            // If layers have different numbers of keyframes times, it's inconsistent
            var firstCount = timeCounts[0];
            for (var i = 1; i < timeCounts.length; i++) {
                if (timeCounts[i] !== firstCount) {
                    return "Multiple"; // Layers have different timing complexity
                }
            }
        }
        
        if (firstStagger === 0) {
            DEBUG_JSX.log("All keyframes at same time, returning 0ms stagger");
            return "0ms / 0f"; // All keyframes at same time - show 0ms stagger
        }
        
        // Convert to frames and return formatted string
        var staggerFrames = Math.round((Math.abs(firstStagger) / 1000) * frameRate);
        
        // Keep the actual measured stagger value - don't invert based on direction
        // The stagger represents the actual time intervals between keyframes
        var finalStagger = firstStagger;
        
        var sign = finalStagger < 0 ? "-" : "";
        
        return sign + Math.abs(finalStagger) + "ms / " + sign + staggerFrames + "f";
        
    } catch(e) {
        DEBUG_JSX.log("calculateStagger error: " + e.toString());
        return "Stagger";
    }
}

// Read layer delays when no keyframes are selected - uses same logic as keyframe reading
function readLayerDelays(selectedLayers, comp) {
    try {
        DEBUG_JSX.log("readLayerDelays: processing " + selectedLayers.length + " layers");
        
        if (selectedLayers.length === 0) {
            return "error|No layers selected";
        }
        
        var frameRate = comp.frameRate || 30;
        
        // Collect layer startTimes and calculate duration info (same approach as keyframe reading)
        var layerTimes = [];
        var earliestInPoint = Infinity;
        var latestOutPoint = -Infinity;
        
        for (var i = 0; i < selectedLayers.length; i++) {
            var layer = selectedLayers[i];
            var inPoint = layer.inPoint;
            var outPoint = layer.outPoint;
            
            // Track earliest inPoint and latest outPoint for duration calculation
            if (inPoint < earliestInPoint) {
                earliestInPoint = inPoint;
            }
            if (outPoint > latestOutPoint) {
                latestOutPoint = outPoint;
            }
            
            // For delay reading, we need the visual position of the layer bar in the timeline
            // Text layers and other layers handle inPoint differently:
            // - Naturally positioned layers often have inPoint == startTime
            // - Trimmed layers have inPoint != startTime
            
            var layerBarPosition;
            
            // Check if this is a naturally positioned layer
            // For text layers and many other layer types, a naturally positioned layer has inPoint == startTime
            if (Math.abs(layer.inPoint - layer.startTime) < 0.001) {
                // Natural layer - bar position is simply startTime
                layerBarPosition = layer.startTime;
            } else {
                // Trimmed layer - the layer has been trimmed
                // For trimmed layers, the visual bar position seems to be at the inPoint value
                // This works for both negative startTime (pulled back) and positive startTime cases
                layerBarPosition = layer.inPoint;
            }
            
            layerTimes.push({
                name: layer.name,
                time: layerBarPosition,  // The visual position of the layer bar
                inPoint: inPoint,
                outPoint: outPoint,
                index: layer.index // Add layer index for proper stagger calculation
            });
        }
        
        // Calculate total duration from first inPoint to last outPoint
        var totalDurationSeconds = (earliestInPoint !== Infinity && latestOutPoint !== -Infinity) 
            ? latestOutPoint - earliestInPoint 
            : 0;
        var totalDurationMs = roundMs(totalDurationSeconds);
        var totalDurationFrames = Math.round(totalDurationSeconds * frameRate);
        
        DEBUG_JSX.log("Layer duration calculation: earliest inPoint=" + earliestInPoint + "s, latest outPoint=" + latestOutPoint + "s, total duration=" + totalDurationMs + "ms");
        
        DEBUG_JSX.log("Found " + layerTimes.length + " layers with startTimes");
        
        if (layerTimes.length === 1) {
            // Single layer - show its startTime as delay and calculate its duration
            var delayMs = roundMs(layerTimes[0].time);
            var delayFrames = Math.round(layerTimes[0].time * frameRate);
            
            // Calculate duration for single layer (outPoint - inPoint)
            var singleLayerDuration = layerTimes[0].outPoint - layerTimes[0].inPoint;
            var singleDurationMs = roundMs(singleLayerDuration);
            var singleDurationFrames = Math.round(singleLayerDuration * frameRate);
            
            // Single layer mode - show 0ms on first read (cumulative tracking)
            var displayDelayMs = 0;  // Always show 0 on fresh read
            var displayDelayFrames = 0;
            
            // Store actual layer time for later nudging
            SINGLE_LAYER_ACTUAL_TIME = layerTimes[0].time;
            
            var result = "success|" + displayDelayMs + "|" + displayDelayFrames + "|" + singleDurationMs + "|" + singleDurationFrames + "|1|0|0|0|0|1|Stagger|Layer " + layerTimes[0].name + " at " + displayDelayMs + "ms (actual: " + delayMs + "ms), duration " + singleDurationMs + "ms";
            DEBUG_JSX.log("Single layer result with cumulative 0: " + result);
            return result;
        }
        
        // Multiple layers - use same logic as keyframe cross-property reading
        layerTimes.sort(function(a, b) { return a.time - b.time; });
        var earliestTime = layerTimes[0].time;
        
        // Calculate all delays from earliest layer
        var delays = [];
        for (var k = 0; k < layerTimes.length; k++) {
            var delayMs = roundMs(layerTimes[k].time - earliestTime);
            delays.push(delayMs);
        }
        
        // Find unique delays (with 1ms tolerance)
        var uniqueDelays = [];
        for (var k = 0; k < delays.length; k++) {
            var found = false;
            for (var j = 0; j < uniqueDelays.length; j++) {
                if (Math.abs(uniqueDelays[j] - delays[k]) < 1) {
                    found = true;
                    break;
                }
            }
            if (!found) {
                uniqueDelays.push(delays[k]);
            }
        }
        
        var resultDelayMs, resultDelayFrames;
        
        if (layerTimes.length === 2) {
            // Only 2 layers - show the delay between them
            resultDelayMs = delays[1]; // Second layer's delay from first
            resultDelayFrames = Math.round((resultDelayMs / 1000) * frameRate);
        } else {
            // 3+ layers - check if all non-zero delays are the same
            var nonZeroDelays = [];
            for (var k = 1; k < delays.length; k++) { // Skip first delay (always 0)
                if (delays[k] > 0) {
                    nonZeroDelays.push(delays[k]);
                }
            }
            
            var uniqueNonZeroDelays = [];
            for (var k = 0; k < nonZeroDelays.length; k++) {
                var found = false;
                for (var j = 0; j < uniqueNonZeroDelays.length; j++) {
                    if (Math.abs(uniqueNonZeroDelays[j] - nonZeroDelays[k]) < 1) {
                        found = true;
                        break;
                    }
                }
                if (!found) {
                    uniqueNonZeroDelays.push(nonZeroDelays[k]);
                }
            }
            
            if (uniqueNonZeroDelays.length === 0) {
                // All layers at same time
                resultDelayMs = 0;
                resultDelayFrames = 0;
            } else if (uniqueNonZeroDelays.length === 1) {
                // All non-zero delays are the same
                resultDelayMs = uniqueNonZeroDelays[0];
                resultDelayFrames = Math.round((resultDelayMs / 1000) * frameRate);
            } else {
                // Multiple different delays
                resultDelayMs = -1; // Flag for "Multiple" delays
                resultDelayFrames = -1;
            }
        }
        
        // Build debug string with more detail
        var debugStrings = [];
        for (var k = 0; k < layerTimes.length; k++) {
            var lt = layerTimes[k];
            debugStrings.push(lt.name + " at " + delays[k] + "ms (startTime=" + lt.time.toFixed(3) + "s, in=" + lt.inPoint.toFixed(3) + "s, out=" + lt.outPoint.toFixed(3) + "s)");
        }
        
        // Calculate stagger for layers (layer mode)
        var staggerText = "Stagger";
        try {
            staggerText = calculateStagger(layerTimes, frameRate, false, false); // false = layer mode, false = not reverse (N/A for layers)
        } catch(e) {
            DEBUG_JSX.log("Layer stagger calculation failed: " + e.toString());
        }
        
        // Use cumulative tracking for multiple layers at 0ms delay
        if (resultDelayMs === 0) {
            // Initialize if needed
            if (typeof MULTI_LAYER_CUMULATIVE === 'undefined') {
                MULTI_LAYER_CUMULATIVE = 0;
            }
            // For reading, show cumulative value
            var displayDelayMs = MULTI_LAYER_CUMULATIVE;
            var displayDelayFrames = Math.round((displayDelayMs / 1000) * frameRate);
            
            var result = "success|" + displayDelayMs + "|" + displayDelayFrames + "|" + totalDurationMs + "|" + totalDurationFrames + "|1|0|0|0|0|1|" + staggerText + "|Found " + layerTimes.length + " layers, total duration " + totalDurationMs + "ms (from " + Math.round(earliestInPoint * 1000) + "ms to " + Math.round(latestOutPoint * 1000) + "ms) | " + debugStrings.join(" | ");
        } else {
            // Non-zero delay - show actual delay
            var result = "success|" + resultDelayMs + "|" + resultDelayFrames + "|" + totalDurationMs + "|" + totalDurationFrames + "|1|0|0|0|0|1|" + staggerText + "|Found " + layerTimes.length + " layers, total duration " + totalDurationMs + "ms (from " + Math.round(earliestInPoint * 1000) + "ms to " + Math.round(latestOutPoint * 1000) + "ms) | " + debugStrings.join(" | ");
        }
        
        DEBUG_JSX.log("Layer delays result: " + result);
        return result;
        
    } catch(e) {
        return "error|Failed to read layer delays: " + e.toString();
    }
}

// Read Keyframes - Calculate duration between selected keyframes
function readKeyframesDuration() {
    DEBUG_JSX.log("=== ORIGINAL FUNCTION TEST ===");
    
    // Reset timeline mode tracking when reading keyframes
    TIMELINE_MODE_CUMULATIVE = 0;
    IS_IN_FORCED_TIMELINE_MODE = false;
    
    try {
        var comp = app.project.activeItem;
        if (!comp || !(comp instanceof CompItem)) {
            return "error|No composition selected";
        }
        
        // Get selected layers
        var selectedLayers = comp.selectedLayers;
        if (selectedLayers.length === 0) {
            return "error|No layers selected";
        }
        
        // Use the first selected layer
        var layer = selectedLayers[0];
        
        // Function to check a property for selected keyframes
        function findSelectedKeyframes(property) {
            if (!property || !property.canVaryOverTime || property.numKeys === 0) {
                return null;
            }
            
            var selectedKeys = [];
            for (var i = 1; i <= property.numKeys; i++) {
                if (property.keySelected(i)) {
                    selectedKeys.push(i);
                }
            }
            
            if (selectedKeys.length >= 2) {
                return {
                    property: property,
                    keys: selectedKeys
                };
            }
            return null;
        }
        
        // ROBUST APPROACH: Use selectedProperties API to find ANY selected property with keyframes
        // This automatically works for Transform, Effects, Contents, Masks, Text, Audio, or any future property types
        var keyframeData = null;
        var selectedProps = layer.selectedProperties;
        
        DEBUG_JSX.log("Checking " + selectedProps.length + " selected properties for keyframes");
        
        for (var j = 0; j < selectedProps.length; j++) {
            var prop = selectedProps[j];
            
            // Skip invalid properties
            if (!prop || prop.propertyValueType === PropertyValueType.NO_VALUE) continue;
            if (!prop.canVaryOverTime || prop.numKeys === 0) continue;
            
            // Check for selected keyframes
            var result = findSelectedKeyframes(prop);
            if (result) {
                keyframeData = result;
                DEBUG_JSX.log("Found selected keyframes on: " + prop.name);
                break; // Use first property with selected keyframes
            }
        }
        
        // Fallback: Also check Time Remap explicitly (sometimes not in selectedProperties)
        if (!keyframeData) {
            try {
                if (layer.timeRemapEnabled && layer.timeRemap && layer.timeRemap.numKeys > 0) {
                    keyframeData = findSelectedKeyframes(layer.timeRemap);
                    if (keyframeData) {
                        DEBUG_JSX.log("Found selected keyframes on Time Remap (fallback check)");
                    }
                }
            } catch(e) {
                // Time remap might not be available
            }
        }
        
        if (!keyframeData) {
            return "error|Select > 1 Key";
        }
        
        var selectedKeys = keyframeData.keys;
        var property = keyframeData.property;
        
        // Get times of the first and last selected keyframes
        var firstKeyIndex = selectedKeys[0];
        var lastKeyIndex = selectedKeys[selectedKeys.length - 1];
        var time1 = property.keyTime(firstKeyIndex);
        var time2 = property.keyTime(lastKeyIndex);
        
        // Calculate duration in seconds
        var durationSeconds = Math.abs(time2 - time1);
        
        // Convert to milliseconds
        var durationMs = roundMs(durationSeconds);
        
        // Convert to frames using composition frame rate
        var frameRate = comp.frameRate || 30;
        var durationFrames = Math.round(durationSeconds * frameRate);
        
        // Additionally calculate X and Y position distances if position keyframes are selected
        var xDistance = 0;
        var yDistance = 0;
        var hasXDistance = false;
        var hasYDistance = false;
        
        
        
        // Search for position keyframes specifically
        function searchForPositionKeyframes(propGroup) {
            var results = { x: 0, y: 0, hasX: false, hasY: false };
            
            DEBUG_JSX.log("searchForPositionKeyframes: Searching " + propGroup.numProperties + " properties in " + propGroup.name);
            
            for (var i = 1; i <= propGroup.numProperties; i++) {
                var prop = propGroup.property(i);
                
                DEBUG_JSX.log("Checking property " + i + ": " + prop.name + " (isPosition: " + isPositionProperty(prop) + ")");
                
                // Check if this is a position property with selected keyframes
                if (isPositionProperty(prop)) {
                    var selectedKeys = [];
                    for (var j = 1; j <= prop.numKeys; j++) {
                        if (prop.keySelected(j)) {
                            selectedKeys.push(j);
                        }
                    }
                    
                    DEBUG_JSX.log("Position property " + prop.name + " has " + selectedKeys.length + " selected keyframes");
                    
                    if (selectedKeys.length >= 2) {
                        var distance = calculatePositionDistance(prop, selectedKeys);
                        DEBUG_JSX.log("Calculated position distance: x=" + distance.x + ", y=" + distance.y + ", hasX=" + distance.hasX + ", hasY=" + distance.hasY);
                        if (distance.hasX) {
                            results.x += distance.x;
                            results.hasX = true;
                        }
                        if (distance.hasY) {
                            results.y += distance.y;
                            results.hasY = true;
                        }
                    }
                }
                
                // If it's a property group, search recursively
                if (prop.propertyType === PropertyType.INDEXED_GROUP || 
                    prop.propertyType === PropertyType.NAMED_GROUP) {
                    var groupResult = searchForPositionKeyframes(prop);
                    if (groupResult.hasX) {
                        results.x += groupResult.x;
                        results.hasX = true;
                    }
                    if (groupResult.hasY) {
                        results.y += groupResult.y;
                        results.hasY = true;
                    }
                }
            }
            return results;
        }
        
        // Calculate position distances using robust selectedProperties approach (same as cross-property mode)
        var xDistance = 0, yDistance = 0, hasXDistance = false, hasYDistance = false;
        
        // Check all selected properties for position keyframes (not just transform)
        var selectedProps = layer.selectedProperties;
        for (var j = 0; j < selectedProps.length; j++) {
            var prop = selectedProps[j];
            
            if (prop && isPositionProperty(prop)) {
                // Get selected keyframes for this position property
                var selectedKeys = [];
                for (var k = 1; k <= prop.numKeys; k++) {
                    if (prop.keySelected(k)) {
                        selectedKeys.push(k);
                    }
                }
                
                if (selectedKeys.length >= 2) {
                    DEBUG_JSX.log("Found position property " + prop.name + " with " + selectedKeys.length + " selected keyframes");
                    var distance = calculatePositionDistance(prop, selectedKeys);
                    DEBUG_JSX.log("Position distance calculated: x=" + distance.x + ", y=" + distance.y + ", hasX=" + distance.hasX + ", hasY=" + distance.hasY);
                    
                    if (distance.hasX) {
                        xDistance += distance.x;
                        hasXDistance = true;
                    }
                    if (distance.hasY) {
                        yDistance += distance.y;
                        hasYDistance = true;
                    }
                    break; // Use first position property found (same as cross-property mode)
                }
            }
        }
        
        return "success|" + durationMs + "|" + durationFrames + "|" + firstKeyIndex + "|" + lastKeyIndex + "|" + property.propertyIndex + "|" + xDistance + "|" + yDistance + "|" + (hasXDistance ? "1" : "0") + "|" + (hasYDistance ? "1" : "0");
        
    } catch(e) {
        return "error|Failed to read keyframes: " + e.toString();
    }
}

// ChatGPT's exact adjustKeyframeDuration function
function adjustKeyframeDuration(property, deltaMs) {
    if (!property || property.numKeys < 2) {
        return;
    }

    var comp = app.project.activeItem;
    if (!(comp instanceof CompItem)) {
        return;
    }

    // Collect selected keys with both index and time
    var selectedKeys = [];
    for (var i = 1; i <= property.numKeys; i++) {
        if (property.keySelected(i)) {
            selectedKeys.push({ index: i, time: property.keyTime(i) });
        }
    }

    if (selectedKeys.length < 2) {
        alert("Select at least two keyframes to adjust duration.");
        return;
    }

    // Sort keys by time (ascending)
    selectedKeys.sort(function (a, b) {
        return a.time - b.time;
    });

    var firstTime = selectedKeys[0].time;
    var lastTime = selectedKeys[selectedKeys.length - 1].time;
    var currentDuration = lastTime - firstTime;
    if (currentDuration <= 0) return;

    // New duration (deltaMs is in milliseconds)
    var newDuration = currentDuration + (deltaMs / 1000.0);
    if (newDuration <= 0) {
        alert("Duration too short.");
        return;
    }

    app.beginUndoGroup("Stretch Keyframes");

    // Stretch keys in descending order to avoid reindex issues
    for (var k = selectedKeys.length - 1; k >= 0; k--) {
        var oldTime = selectedKeys[k].time;
        var rel = (oldTime - firstTime) / currentDuration;
        var newTime = firstTime + rel * newDuration;
        property.setKeyTime(selectedKeys[k].index, newTime);
    }

    app.endUndoGroup();
}

// Wrapper function called from JavaScript - finds property and calls ChatGPT's function
function adjustKeyframeDurationFromPanel(adjustment) {
    try {
        var comp = app.project.activeItem;
        if (!comp || !(comp instanceof CompItem)) {
            return "error|No composition selected";
        }
        
        // Get selected layers
        var selectedLayers = comp.selectedLayers;
        if (selectedLayers.length === 0) {
            return "error|No layers selected";
        }
        
        // Use the first selected layer
        var layer = selectedLayers[0];
        
        // Function to check if property has selected keyframes
        function hasSelectedKeyframes(property) {
            if (!property || !property.canVaryOverTime || property.numKeys === 0) {
                return false;
            }
            
            var selectedCount = 0;
            for (var i = 1; i <= property.numKeys; i++) {
                if (property.keySelected(i)) {
                    selectedCount++;
                }
            }
            return selectedCount >= 2;
        }
        
        // Function to recursively search for property with selected keyframes
        function findPropertyWithSelectedKeyframes(propGroup) {
            for (var i = 1; i <= propGroup.numProperties; i++) {
                var prop = propGroup.property(i);
                
                // Check if this property has selected keyframes
                if (hasSelectedKeyframes(prop)) {
                    return prop;
                }
                
                // If it's a property group, search recursively
                if (prop.propertyType === PropertyType.INDEXED_GROUP || 
                    prop.propertyType === PropertyType.NAMED_GROUP) {
                    var foundProp = findPropertyWithSelectedKeyframes(prop);
                    if (foundProp) {
                        return foundProp;
                    }
                }
            }
            return null;
        }
        
        var targetProperty = null;
        
        // Check transform properties first
        targetProperty = findPropertyWithSelectedKeyframes(layer.transform);
        
        // If no selected keyframes in transform, check special layer properties
        if (!targetProperty) {
            try {
                if (layer.timeRemapEnabled && layer.timeRemap && hasSelectedKeyframes(layer.timeRemap)) {
                    targetProperty = layer.timeRemap;
                }
            } catch(e) {
                // Time remap might not be available
            }
        }
        
        // Check effects
        if (!targetProperty && layer.effect && layer.effect.numProperties > 0) {
            targetProperty = findPropertyWithSelectedKeyframes(layer.effect);
        }
        
        // Check mask properties
        if (!targetProperty) {
            if (layer.mask && layer.mask.numProperties > 0) {
                targetProperty = findPropertyWithSelectedKeyframes(layer.mask);
            }
        }
        
        // Check other layer properties like audio levels
        if (!targetProperty) {
            try {
                if (layer.hasAudio && layer.audioLevels && hasSelectedKeyframes(layer.audioLevels)) {
                    targetProperty = layer.audioLevels;
                }
            } catch(e) {
                // Audio levels might not be available
            }
        }
        
        if (!targetProperty) {
            return "error|No selected keyframes found";
        }
        
        // Call ChatGPT's function with the found property
        adjustKeyframeDuration(targetProperty, adjustment);
        
        // Calculate new duration for display
        var selectedKeys = [];
        for (var i = 1; i <= targetProperty.numKeys; i++) {
            if (targetProperty.keySelected(i)) {
                selectedKeys.push(i);
            }
        }
        
        if (selectedKeys.length < 2) {
            return "error|Selection lost";
        }
        
        var firstTime = targetProperty.keyTime(selectedKeys[0]);
        var lastTime = targetProperty.keyTime(selectedKeys[selectedKeys.length - 1]);
        var newDuration = lastTime - firstTime;
        var newDurationMs = roundMs(newDuration);
        var frameRate = comp.frameRate || 30;
        var newDurationFrames = Math.round(newDuration * frameRate);
        
        return "success|" + newDurationMs + "|" + newDurationFrames;
        
    } catch(e) {
        return "error|Failed to adjust keyframes: " + e.toString();
    }
}

// Grok's approach: Use selectedProperties and selectedKeys APIs
function stretchKeyframesGrokApproach(frameAdjustment) {
    try {
        app.beginUndoGroup("Stretch Keyframes");
        
        var comp = app.project.activeItem;
        if (!(comp && comp instanceof CompItem)) {
            app.endUndoGroup();
            return "error|Please select a composition";
        }
        
        var frameDuration = 1 / comp.frameRate;
        
        var selectedLayers = comp.selectedLayers;
        var totalDuration = 0;
        var processedAny = false;
        
        for (var i = 0; i < selectedLayers.length; i++) {
            var layer = selectedLayers[i];
            var selectedProps = layer.selectedProperties;
            
            for (var j = 0; j < selectedProps.length; j++) {
                var prop = selectedProps[j];
                if (prop.propertyValueType === PropertyValueType.NO_VALUE || prop.numKeys < 2) continue;
                
                var selKeys = prop.selectedKeys;
                if (selKeys.length < 2) continue;
                
                processedAny = true;
                
                // Check if this is time remapping for special handling
                var isTimeRemap = false;
                try {
                    isTimeRemap = (prop.name === "Time Remap" || prop.matchName === "ADBE Time Remapping");
                } catch(e) {
                    // Property name/matchName might not be accessible
                }
                
                // Sort selected key indices
                selKeys.sort(function(a, b) { return a - b; });

                // PROTECTION: Capture the next keyframe to prevent AE from modifying it
                var nextKeyData = captureNextKeyframe(prop, selKeys);

                // Collect keyframe data, sorted by time
                var keyData = [];
                for (var k = 0; k < selKeys.length; k++) {
                    var idx = selKeys[k];
                    var data = {
                        time: prop.keyTime(idx),
                        value: prop.keyValue(idx),
                        inInterp: prop.keyInInterpolationType(idx),
                        outInterp: prop.keyOutInterpolationType(idx),
                        temporalContinuous: prop.keyTemporalContinuous(idx),
                        temporalAutoBezier: prop.keyTemporalAutoBezier(idx),
                        // CRITICAL: Preserve keyframe color labels
                        label: prop.keyLabel(idx)
                    };
                    
                    // Only store temporal ease for bezier keyframes to preserve linear keyframes
                    if (data.inInterp === KeyframeInterpolationType.BEZIER || data.outInterp === KeyframeInterpolationType.BEZIER) {
                        try {
                            data.inEase = prop.keyInTemporalEase(idx);
                            data.outEase = prop.keyOutTemporalEase(idx);
                        } catch(e) {
                            // Temporal ease might not be available for some properties
                        }
                    }
                    
                    // Handle spatial properties if applicable
                    if (prop.isSpatial) {
                        try {
                            data.spatialContinuous = prop.keySpatialContinuous(idx);
                            data.spatialAutoBezier = prop.keySpatialAutoBezier(idx);
                            data.inTangent = prop.keyInSpatialTangent(idx);
                            data.outTangent = prop.keyOutSpatialTangent(idx);
                        } catch(e) {
                            // Spatial properties might not be available
                        }
                    }
                    
                    keyData.push(data);
                }
                
                keyData.sort(function(a, b) { return a.time - b.time; });
                
                var firstTime = keyData[0].time;
                var lastTime = keyData[keyData.length - 1].time;
                var duration = lastTime - firstTime;
                
                // Smart 50ms snapping: first press snaps to nearest 50ms, subsequent presses increment by 50ms
                var durationMs = duration * 1000;
                var newDurationMs;
                
                // Check if current duration is already a multiple of 50ms (within 1ms tolerance for floating point)
                var remainder = durationMs % 50;
                var isAlreadySnapped = (remainder < 1) || (remainder > 49);
                
                if (isAlreadySnapped) {
                    // Already snapped to 50ms boundary - increment by exactly 50ms
                    if (frameAdjustment > 0) {
                        newDurationMs = durationMs + 50;
                    } else {
                        newDurationMs = durationMs - 50;
                    }
                } else {
                    // Not snapped yet - snap to nearest 50ms multiple
                    if (frameAdjustment > 0) {
                        // + button: snap to next 50ms increment
                        newDurationMs = Math.ceil(durationMs / 50) * 50;
                    } else {
                        // - button: snap to previous 50ms increment
                        newDurationMs = Math.floor(durationMs / 50) * 50;
                    }
                }
                
                // Convert back to seconds
                var newDuration = newDurationMs / 1000;
                
                if (newDuration <= frameDuration) {
                    // Prevent negative or zero duration; skip this property
                    continue;
                }
                
                // Store the maximum duration across all properties
                if (newDuration > totalDuration) {
                    totalDuration = newDuration;
                    DEBUG_JSX.log("New maximum duration: " + (newDuration * 1000) + "ms from " + (prop.name || "unknown property"));
                }
                
                if (isTimeRemap) {
                    // TIME REMAPPING: Special handling to avoid deletion
                    try {
                        var scaleFactor = newDuration / duration;
                        
                        // Store current selection state
                        var selectionState = [];
                        for (var s = 0; s < selKeys.length; s++) {
                            selectionState.push(prop.keySelected(selKeys[s]));
                        }
                        
                        // Clear selection first (same as other properties)
                        for (var clearIdx = 1; clearIdx <= prop.numKeys; clearIdx++) {
                            try {
                                prop.keySelected(clearIdx, false);
                            } catch(e) {
                                // Continue
                            }
                        }
                        
                        // Try using setKeyTime method for time remapping, then select immediately
                        var processedIndices = [];
                        for (var k = keyData.length - 1; k >= 0; k--) { // Reverse order
                            var data = keyData[k];
                            // Calculate relative position (0 to 1) within the selected keyframe range
                            var relativePosition = (data.time - firstTime) / duration;
                            // Apply to new duration, maintaining start position
                            var newTime = firstTime + relativePosition * newDuration;
                            var keyIndex = selKeys[k];
                            
                            try {
                                // Try to move the keyframe time
                                prop.setKeyTime(keyIndex, newTime);
                                // Select immediately after moving (same as other properties)
                                prop.setSelectedAtKey(keyIndex, true);
                                processedIndices.push(keyIndex);
                            } catch(e) {
                                // If setKeyTime fails, fall back to record/delete/recreate but with minimal properties
                                console.log("setKeyTime failed for time remapping, trying fallback...");
                                prop.removeKey(keyIndex);
                                var newIdx = prop.addKey(newTime);
                                try {
                                    prop.setValueAtKey(newIdx, data.value);
                                    // Select immediately after creating (same as other properties)
                                    prop.setSelectedAtKey(newIdx, true);
                                    processedIndices.push(newIdx);
                                } catch(e2) {
                                    // Even this might fail
                                }
                            }
                        }
                        
                    } catch(timeRemapError) {
                        console.log("Time remapping failed: " + timeRemapError.toString());
                        // Don't break the entire operation
                    }
                    
                } else {
                    // NORMAL APPROACH FOR NON-TIME-REMAPPING PROPERTIES
                    var scaleFactor = newDuration / duration;
                    
                    // Remove old keys in reverse order to avoid index shifts
                    for (var k = selKeys.length - 1; k >= 0; k--) {
                        prop.removeKey(selKeys[k]);
                    }
                    
                    // Add new keys at scaled times and reapply attributes
                    var newSelIndices = [];
                    for (var k = 0; k < keyData.length; k++) {
                        var data = keyData[k];
                        // Calculate relative position (0 to 1) within the selected keyframe range
                        var relativePosition = (data.time - firstTime) / duration;
                        // Apply to new duration, maintaining start position
                        var newTime = firstTime + relativePosition * newDuration;
                        var newIdx = prop.addKey(newTime);
                        
                        try {
                            prop.setValueAtKey(newIdx, data.value);

                            // Apply temporal ease only for sides originally Bezier
                            restoreTemporalEaseSafely(prop, newIdx, data.inInterp, data.outInterp, data.inEase, data.outEase);

                            // Then re-assert original interpolation types
                            prop.setInterpolationTypeAtKey(newIdx, data.inInterp, data.outInterp);
                            
                            // Restore flags safely to keep fully-linear keys visually linear
                            restoreTemporalFlagsSafely(prop, newIdx, data.inInterp, data.outInterp, data.temporalContinuous, data.temporalAutoBezier);
                            
                            if (data.spatialContinuous !== undefined) {
                                prop.setSpatialContinuousAtKey(newIdx, data.spatialContinuous);
                                prop.setSpatialAutoBezierAtKey(newIdx, data.spatialAutoBezier);
                                // Only restore tangents if NOT auto-bezier (manual tangent control)
                                if (!data.spatialAutoBezier && data.inTangent !== undefined && data.outTangent !== undefined) {
                                    prop.setSpatialTangentsAtKey(newIdx, data.inTangent, data.outTangent);
                                }
                            }
                            
                            // CRITICAL: Restore keyframe color label
                            if (data.label !== undefined) {
                                try {
                                    prop.setLabelAtKey(newIdx, data.label);
                                } catch(e) {
                                    // Label setting might fail on some property types
                                }
                            }
                        } catch(e) {
                            console.log("Error setting keyframe properties: " + e.toString());
                        }
                        
                        // Select the new key
                        try {
                            prop.setSelectedAtKey(newIdx, true);
                        } catch(e) {
                            // Selection might fail but continue
                        }
                        
                        newSelIndices.push(newIdx);
                    }

                    // PROTECTION: Restore the next keyframe
                    if (nextKeyData !== null) {
                        var keysAdded = newSelIndices.length - selKeys.length;
                        restoreNextKeyframe(prop, nextKeyData, keysAdded);
                    }
                }
            }
        }
        
        app.endUndoGroup();
        
        if (!processedAny) {
            return "error|Select > 1 Key";
        }
        
        // Return success with new duration
        var newDurationMs = roundMs(totalDuration);
        var newDurationFrames = Math.round(totalDuration * comp.frameRate);
        
        return "success|" + newDurationMs + "|" + newDurationFrames;
        
    } catch(e) {
        app.endUndoGroup();
        return "error|Failed to stretch keyframes: " + e.toString();
    }
}

// Frame-based version of stretchKeyframesGrokApproach that maintains selection preservation
function stretchKeyframesGrokApproachWithFrames(direction, frames) {
    try {
        DEBUG_JSX.clear();
        DEBUG_JSX.log("🎬 stretchKeyframesGrokApproachWithFrames called with direction: " + direction + ", frames: " + frames);
        
        app.beginUndoGroup("Stretch Keyframes with Frames");
        
        var comp = app.project.activeItem;
        if (!(comp && comp instanceof CompItem)) {
            app.endUndoGroup();
            return "error|Please select a composition";
        }
        
        var frameRate = comp.frameRate || 30;
        var frameDuration = 1 / frameRate;
        var framesToMs = (frames / frameRate) * 1000; // Convert frames to milliseconds
        
        DEBUG_JSX.log("Converting " + frames + " frames to " + framesToMs + "ms at " + frameRate + "fps");
        
        var selectedLayers = comp.selectedLayers;
        var totalDuration = 0;
        var processedAny = false;
        var allProcessedSelections = []; // Collect ALL selections for final restoration
        var allProcessedKeyframeTimes = []; // Track all keyframe times for total span calculation
        
        DEBUG_JSX.log("🎬 Found " + selectedLayers.length + " selected layers");
        
        // CRITICAL FIX: First pass - cache ALL selected keyframes before ANY manipulation
        var cachedSelections = [];
        for (var i = 0; i < selectedLayers.length; i++) {
            var layer = selectedLayers[i];
            var selectedProps = layer.selectedProperties;
            
            DEBUG_JSX.log("Cache: " + layer.name + " (" + selectedProps.length + " props)");
            
            for (var j = 0; j < selectedProps.length; j++) {
                var prop = selectedProps[j];
                
                if (prop.propertyValueType === PropertyValueType.NO_VALUE || prop.numKeys < 2) {
                    continue;
                }
                
                // Cache the selected keyframes IMMEDIATELY
                var selKeys = [];
                for (var k = 1; k <= prop.numKeys; k++) {
                    if (prop.keySelected(k)) {
                        selKeys.push(k);
                    }
                }
                
                if (selKeys.length >= 2) {
                    cachedSelections.push({
                        layer: layer,
                        layerName: layer.name,
                        property: prop,
                        propertyName: prop.name,
                        selectedIndices: selKeys.slice() // Make a copy
                    });
                    DEBUG_JSX.log("  " + prop.name + ": " + selKeys.length + " keys");
                }
            }
        }
        
        DEBUG_JSX.log("🎬 Cached " + cachedSelections.length + " properties with selected keyframes");
        
        // Second pass - process using cached selections
        for (var i = 0; i < cachedSelections.length; i++) {
            var cached = cachedSelections[i];
            var prop = cached.property;
            var selKeys = cached.selectedIndices;
            
            DEBUG_JSX.log("Process: " + cached.propertyName + " (" + selKeys.length + " keys)");
            processedAny = true;
            
            // Check if this is time remapping for special handling
            var isTimeRemap = false;
            try {
                isTimeRemap = (prop.name === "Time Remap" || prop.matchName === "ADBE Time Remapping");
            } catch(e) {
                // Property name/matchName might not be accessible
            }

            // Sort selected key indices
            selKeys.sort(function(a, b) { return a - b; });

            // PROTECTION: Capture ALL adjacent keyframes to prevent AE from modifying them
            // We need to capture all keyframes before and after the selection to protect the entire curve
            var allPrevKeyData = [];
            var minSelectedIndex = selKeys[0];
            for (var k = minSelectedIndex - 1; k >= 1; k--) {
                try {
                    var capturedKey = captureKeyframeState(prop, k);
                    if (capturedKey) {
                        capturedKey.index = k; // Store original index for reference
                        allPrevKeyData.push(capturedKey);

                        // Log detailed ease values
                        var easeInfo = "";
                        if (capturedKey.outEase && capturedKey.outEase.length > 0) {
                            easeInfo = " OUT:[speed=" + capturedKey.outEase[0].speed.toFixed(2) +
                                      ", inf=" + capturedKey.outEase[0].influence.toFixed(2) + "%]";
                        }
                        DEBUG_JSX.log("🔒 Captured keyframe " + k + " @ " + capturedKey.time.toFixed(3) + "s" + easeInfo);
                    }
                } catch(e) {
                    break;
                }
            }

            var allNextKeyData = [];
            var maxSelectedIndex = selKeys[selKeys.length - 1];
            for (var k = maxSelectedIndex + 1; k <= prop.numKeys; k++) {
                try {
                    var capturedKey = captureKeyframeState(prop, k);
                    if (capturedKey) {
                        allNextKeyData.push(capturedKey);
                        DEBUG_JSX.log("🔒 Captured keyframe " + k + " after selection");
                    }
                } catch(e) {
                    break;
                }
            }

                // Collect keyframe data, sorted by time (same as original)
                var keyData = [];
                for (var k = 0; k < selKeys.length; k++) {
                    var idx = selKeys[k];
                    var data = {
                        time: prop.keyTime(idx),
                        value: prop.keyValue(idx),
                        inInterp: prop.keyInInterpolationType(idx),
                        outInterp: prop.keyOutInterpolationType(idx),
                        temporalContinuous: prop.keyTemporalContinuous(idx),
                        temporalAutoBezier: prop.keyTemporalAutoBezier(idx),
                        // CRITICAL: Preserve keyframe color labels
                        label: prop.keyLabel(idx)
                    };
                    
                    // Only store temporal ease for bezier keyframes to preserve linear keyframes
                    if (data.inInterp === KeyframeInterpolationType.BEZIER || data.outInterp === KeyframeInterpolationType.BEZIER) {
                        try {
                            data.inEase = prop.keyInTemporalEase(idx);
                            data.outEase = prop.keyOutTemporalEase(idx);
                        } catch(e) {
                            // Temporal ease might not be available for some properties
                        }
                    }
                    
                    // Handle spatial properties if applicable
                    if (prop.isSpatial) {
                        try {
                            data.spatialContinuous = prop.keySpatialContinuous(idx);
                            data.spatialAutoBezier = prop.keySpatialAutoBezier(idx);
                            data.inTangent = prop.keyInSpatialTangent(idx);
                            data.outTangent = prop.keyOutSpatialTangent(idx);
                        } catch(e) {
                            // Spatial properties might not be available
                        }
                    }
                    
                    keyData.push(data);
                }
                
                keyData.sort(function(a, b) { return a.time - b.time; });
                
                var firstTime = keyData[0].time;
                var lastTime = keyData[keyData.length - 1].time;
                var duration = lastTime - firstTime;

                // Capture next keyframe time if it exists (for OUT ease scaling)
                var nextKeyframeTime = null;
                if (allNextKeyData.length > 0) {
                    nextKeyframeTime = allNextKeyData[0].time;
                }

                // SMART SNAPPING: Apply frame delta then snap to nearest 50ms
                var durationMs = duration * 1000;

                // Step 1: Apply the frame delta (add or subtract)
                var targetDurationMs = durationMs + (direction * framesToMs);

                // Step 2: Snap to nearest 50ms increment
                var newDurationMs = Math.round(targetDurationMs / 50) * 50;

                // Step 3: Ensure we don't go below one frame duration
                var minDurationMs = frameDuration * 1000;
                if (newDurationMs < minDurationMs) {
                    newDurationMs = minDurationMs;
                }

                DEBUG_JSX.log("Smart snap: " + durationMs + "ms -> " + targetDurationMs + "ms (target) -> " + newDurationMs + "ms (snapped to 50ms)");
                
                // Convert back to seconds
                var newDuration = newDurationMs / 1000;
                
                // Store the maximum duration across all properties
                if (newDuration > totalDuration) {
                    totalDuration = newDuration;
                    DEBUG_JSX.log("New maximum duration: " + (newDuration * 1000) + "ms from " + (prop.name || "unknown property"));
                }
                
                if (isTimeRemap) {
                    // TIME REMAPPING: Use add-before-delete pattern (same as cross-property mode)
                    try {
                        DEBUG_JSX.log("🎬 TIME REMAP: Using add-before-delete pattern");

                        var newKeyTimes = []; // Track the new times
                        var keysToDelete = []; // Track which keys to delete

                        // Add new keyframes at new times BEFORE deleting old ones
                        for (var k = 0; k < keyData.length; k++) {
                            var data = keyData[k];
                            // Calculate relative position (0 to 1) within the selected keyframe range
                            var relativePosition = (data.time - firstTime) / duration;
                            // Apply to new duration, maintaining start position
                            var newTime = firstTime + relativePosition * newDuration;

                            // Check if keyframe needs to be moved
                            if (Math.abs(newTime - data.time) < 0.001) {
                                // No movement needed
                                newKeyTimes.push(data.time);
                                DEBUG_JSX.log("  Time Remap keyframe " + (k+1) + " already at target time " + (newTime * 1000).toFixed(1) + "ms");
                            } else {
                                // Add new keyframe at new time using setValueAtTime
                                prop.setValueAtTime(newTime, data.value);

                                // Find the new keyframe index and select it immediately
                                var newIdx = -1;
                                for (var j = 1; j <= prop.numKeys; j++) {
                                    if (Math.abs(prop.keyTime(j) - newTime) < 0.001) {
                                        newIdx = j;
                                        break;
                                    }
                                }

                                if (newIdx !== -1) {
                                    // Select immediately
                                    try {
                                        prop.setSelectedAtKey(newIdx, true);
                                        DEBUG_JSX.log("  Immediately selected Time Remap keyframe at index " + newIdx);
                                    } catch(e) {
                                        DEBUG_JSX.log("  Failed to select Time Remap keyframe: " + e.toString());
                                    }

                                    newKeyTimes.push(newTime);

                                    // Only mark for deletion if old keyframe still exists at OLD time
                                    var oldKeyStillExists = false;
                                    for (var j = 1; j <= prop.numKeys; j++) {
                                        if (Math.abs(prop.keyTime(j) - data.time) < 0.001) {
                                            oldKeyStillExists = true;
                                            keysToDelete.push({index: j, time: data.time});
                                            DEBUG_JSX.log("  Found old keyframe at index " + j + " (time " + (data.time * 1000).toFixed(1) + "ms) - will delete");
                                            break;
                                        }
                                    }

                                    if (!oldKeyStillExists) {
                                        DEBUG_JSX.log("  Old keyframe at " + (data.time * 1000).toFixed(1) + "ms no longer exists");
                                    }
                                }
                            }
                        }

                        // Now delete old keyframes in reverse order by index
                        keysToDelete.sort(function(a, b) { return b.index - a.index; });
                        for (var k = 0; k < keysToDelete.length; k++) {
                            DEBUG_JSX.log("  Removing old Time Remap keyframe at index " + keysToDelete[k].index);
                            prop.removeKey(keysToDelete[k].index);
                        }

                        // Clear ALL selections first
                        DEBUG_JSX.log("  Clearing all Time Remap selections before final re-selection");
                        for (var j = 1; j <= prop.numKeys; j++) {
                            try {
                                prop.setSelectedAtKey(j, false);
                            } catch(e) {
                                // Ignore
                            }
                        }

                        // Find the final indices by time and select them
                        var processedIndices = [];
                        for (var k = 0; k < newKeyTimes.length; k++) {
                            var targetTime = newKeyTimes[k];
                            for (var j = 1; j <= prop.numKeys; j++) {
                                if (Math.abs(prop.keyTime(j) - targetTime) < 0.001) {
                                    processedIndices.push(j);
                                    try {
                                        prop.setSelectedAtKey(j, true);
                                        DEBUG_JSX.log("  Final selection: Time Remap keyframe at index " + j);
                                    } catch(e) {
                                        DEBUG_JSX.log("  Failed to select: " + e.toString());
                                    }
                                    break;
                                }
                            }
                        }

                        // Track keyframe times for total span calculation
                        for (var t = 0; t < newKeyTimes.length; t++) {
                            allProcessedKeyframeTimes.push(newKeyTimes[t]);
                        }

                        // COLLECT selections for restoration
                        DEBUG_JSX.log("🎬 COLLECTING " + processedIndices.length + " Time Remap keyframe selections");
                        allProcessedSelections.push({
                            layer: cached.layer,
                            propertyName: "Time Remap",
                            propertyReference: prop,
                            indices: processedIndices
                        });

                    } catch(timeRemapError) {
                        DEBUG_JSX.log("Time remapping failed: " + timeRemapError.toString());
                    }

                } else {
                    // NORMAL APPROACH FOR NON-TIME-REMAPPING PROPERTIES (same as original)
                    var scaleFactor = newDuration / duration;
                    
                    // Remove old keys in reverse order to avoid index shifts
                    for (var k = selKeys.length - 1; k >= 0; k--) {
                        prop.removeKey(selKeys[k]);
                    }
                    
                    // Add new keys at scaled times and reapply attributes
                    var newSelIndices = [];
                    for (var k = 0; k < keyData.length; k++) {
                        var data = keyData[k];
                        // Calculate relative position (0 to 1) within the selected keyframe range
                        var relativePosition = (data.time - firstTime) / duration;
                        // Apply to new duration, maintaining start position
                        var newTime = firstTime + relativePosition * newDuration;
                        var newIdx = prop.addKey(newTime);
                        
                        // Track keyframe time for total span calculation
                        allProcessedKeyframeTimes.push(newTime);
                        
                        try {
                            prop.setValueAtKey(newIdx, data.value);

                            // CRITICAL: Scale ease speed to maintain visual curve shape
                            if (data.inEase !== undefined && data.outEase !== undefined) {
                                try {
                                    // Determine if we should scale IN or OUT ease:
                                    // - First keyframe: DON'T scale IN ease (affects curve from previous non-selected keyframe)
                                    // - Last keyframe: Check if there's a next keyframe
                                    //   - If NO next keyframe: DON'T scale OUT ease (no curve to affect)
                                    //   - If YES next keyframe: Scale OUT ease based on distance change to next keyframe
                                    // - Middle keyframes: scale both IN and OUT ease
                                    var isFirstKey = (k === 0);
                                    var isLastKey = (k === keyData.length - 1);

                                    var scaledInEase = isFirstKey ? data.inEase : scaleEaseForDuration(data.inEase, duration, newDuration);

                                    var scaledOutEase;
                                    if (isLastKey && nextKeyframeTime !== null) {
                                        // Calculate distance to next keyframe
                                        var originalDistanceToNext = nextKeyframeTime - data.time;
                                        var newDistanceToNext = nextKeyframeTime - newTime;

                                        // Scale OUT ease based on distance change to next keyframe
                                        scaledOutEase = scaleEaseForDuration(data.outEase, originalDistanceToNext, newDistanceToNext);
                                        DEBUG_JSX.log("  📊 Last keyframe OUT ease: scaled by distance to next keyframe (" + (originalDistanceToNext*1000).toFixed(1) + "ms → " + (newDistanceToNext*1000).toFixed(1) + "ms)");
                                    } else if (isLastKey) {
                                        // No next keyframe, preserve OUT ease
                                        scaledOutEase = data.outEase;
                                    } else {
                                        // Middle keyframe, scale based on internal duration
                                        scaledOutEase = scaleEaseForDuration(data.outEase, duration, newDuration);
                                    }

                                    prop.setTemporalEaseAtKey(newIdx, scaledInEase, scaledOutEase);

                                    if (isFirstKey) {
                                        DEBUG_JSX.log("  ✅ Applied scaled ease (preserved IN ease for first keyframe)");
                                    } else if (isLastKey && nextKeyframeTime === null) {
                                        DEBUG_JSX.log("  ✅ Applied scaled ease (preserved OUT ease for last keyframe - no next keyframe)");
                                    } else {
                                        DEBUG_JSX.log("  ✅ Applied scaled ease");
                                    }
                                } catch(e) {
                                    // Some properties might not support temporal ease
                                    DEBUG_JSX.log("  ❌ Failed to set ease: " + e.toString());
                                }
                            }

                            // Then re-assert original interpolation types
                            prop.setInterpolationTypeAtKey(newIdx, data.inInterp, data.outInterp);
                            
                            prop.setTemporalContinuousAtKey(newIdx, data.temporalContinuous);
                            prop.setTemporalAutoBezierAtKey(newIdx, data.temporalAutoBezier);
                            
                            if (data.spatialContinuous !== undefined) {
                                prop.setSpatialContinuousAtKey(newIdx, data.spatialContinuous);
                                prop.setSpatialAutoBezierAtKey(newIdx, data.spatialAutoBezier);
                                // Only restore tangents if NOT auto-bezier (manual tangent control)
                                if (!data.spatialAutoBezier && data.inTangent !== undefined && data.outTangent !== undefined) {
                                    prop.setSpatialTangentsAtKey(newIdx, data.inTangent, data.outTangent);
                                }
                            }
                            
                            // CRITICAL: Restore keyframe color label
                            if (data.label !== undefined) {
                                try {
                                    prop.setLabelAtKey(newIdx, data.label);
                                } catch(e) {
                                    // Label setting might fail on some property types
                                }
                            }
                        } catch(e) {
                            console.log("Error setting keyframe properties: " + e.toString());
                        }
                        
                        // COLLECT indices first, don't select yet
                        newSelIndices.push(newIdx);
                    }

                    // Capture the selected keyframes' ease values using ORIGINAL ease from keyData
                    // This ensures we restore the exact original values, not AE-modified versions
                    var selectedKeyframesEase = [];
                    for (var k = 0; k < newSelIndices.length; k++) {
                        var idx = newSelIndices[k];
                        var originalData = keyData[k]; // Corresponding original keyframe data

                        try {
                            var isFirstKey = (k === 0);
                            var isLastKey = (k === keyData.length - 1);

                            // Use the exact ease we INTENDED to set (scaled or preserved)
                            var correctInEase = isFirstKey ? originalData.inEase : scaleEaseForDuration(originalData.inEase, duration, newDuration);

                            var correctOutEase;
                            if (isLastKey && nextKeyframeTime !== null) {
                                var originalDistanceToNext = nextKeyframeTime - originalData.time;
                                var newDistanceToNext = nextKeyframeTime - (firstTime + (keyData[k].time - firstTime) * (newDuration / duration));
                                correctOutEase = scaleEaseForDuration(originalData.outEase, originalDistanceToNext, newDistanceToNext);
                            } else if (isLastKey) {
                                correctOutEase = originalData.outEase;
                            } else {
                                correctOutEase = scaleEaseForDuration(originalData.outEase, duration, newDuration);
                            }

                            selectedKeyframesEase.push({
                                index: idx,
                                time: prop.keyTime(idx),
                                inEase: correctInEase,
                                outEase: correctOutEase
                            });
                        } catch(e) {
                            // Ease might not be available
                        }
                    }

                    // PROTECTION: Restore ALL adjacent keyframes
                    var keysAdded = newSelIndices.length - selKeys.length;

                    DEBUG_JSX.log("🔓 Restoring " + allPrevKeyData.length + " keyframes before selection");
                    for (var k = 0; k < allPrevKeyData.length; k++) {
                        var keyState = allPrevKeyData[k];
                        var newIndex = keyState.index + keysAdded;

                        // Find keyframe by time since index may have shifted
                        for (var i = 1; i <= prop.numKeys; i++) {
                            if (Math.abs(prop.keyTime(i) - keyState.time) < 0.001) {
                                // Log what we're restoring
                                var restoreInfo = "";
                                if (keyState.outEase && keyState.outEase.length > 0) {
                                    restoreInfo = " OUT:[speed=" + keyState.outEase[0].speed.toFixed(2) +
                                                ", inf=" + keyState.outEase[0].influence.toFixed(2) + "%]";
                                }
                                DEBUG_JSX.log("🔓 Restoring keyframe #" + keyState.index + " @ " + keyState.time.toFixed(3) + "s" + restoreInfo);

                                restoreKeyframeState(prop, i, keyState);

                                // Verify it was restored correctly
                                try {
                                    var currentOutEase = prop.keyOutTemporalEase(i);
                                    if (currentOutEase && currentOutEase.length > 0) {
                                        var verifyInfo = " VERIFY OUT:[speed=" + currentOutEase[0].speed.toFixed(2) +
                                                       ", inf=" + currentOutEase[0].influence.toFixed(2) + "%]";
                                        DEBUG_JSX.log("   ✓ Verified" + verifyInfo);
                                    }
                                } catch(e) {}

                                break;
                            }
                        }
                    }

                    DEBUG_JSX.log("🔓 Restoring " + allNextKeyData.length + " keyframes after selection");

                    // Calculate where the last selected keyframe ended up (for IN ease scaling)
                    var newLastTime = firstTime + newDuration;

                    for (var k = 0; k < allNextKeyData.length; k++) {
                        var keyState = allNextKeyData[k];
                        var newIndex = keyState.index + keysAdded;

                        // Find keyframe by time since index may have shifted
                        for (var i = 1; i <= prop.numKeys; i++) {
                            if (Math.abs(prop.keyTime(i) - keyState.time) < 0.001) {
                                // Scale IN ease based on distance change from last selected keyframe
                                if (keyState.inEase && keyState.inEase.length > 0) {
                                    var originalDistanceFromLast = keyState.time - lastTime;
                                    var newDistanceFromLast = keyState.time - newLastTime;

                                    if (originalDistanceFromLast > 0 && newDistanceFromLast > 0) {
                                        // Scale IN ease
                                        var scaledInEase = scaleEaseForDuration(keyState.inEase, originalDistanceFromLast, newDistanceFromLast);

                                        // Create a modified keyState with scaled IN ease
                                        var modifiedKeyState = {};
                                        for (var propName in keyState) {
                                            modifiedKeyState[propName] = keyState[propName];
                                        }
                                        modifiedKeyState.inEase = scaledInEase;

                                        restoreKeyframeState(prop, i, modifiedKeyState);
                                        DEBUG_JSX.log("🔓 Restored keyframe @ " + keyState.time.toFixed(3) + "s (scaled IN ease: " + (originalDistanceFromLast*1000).toFixed(1) + "ms → " + (newDistanceFromLast*1000).toFixed(1) + "ms)");
                                    } else {
                                        restoreKeyframeState(prop, i, keyState);
                                        DEBUG_JSX.log("🔓 Restored keyframe at time " + keyState.time.toFixed(3) + "s");
                                    }
                                } else {
                                    restoreKeyframeState(prop, i, keyState);
                                    DEBUG_JSX.log("🔓 Restored keyframe at time " + keyState.time.toFixed(3) + "s");
                                }
                                break;
                            }
                        }
                    }

                    // RESTORE SELECTED KEYFRAMES' EASE: After Effects may have modified them when we restored adjacent keyframes
                    DEBUG_JSX.log("🔓 Restoring selected keyframes' ease after adjacent restoration");
                    for (var k = 0; k < selectedKeyframesEase.length; k++) {
                        var easeData = selectedKeyframesEase[k];

                        // Find keyframe by time
                        for (var i = 1; i <= prop.numKeys; i++) {
                            if (Math.abs(prop.keyTime(i) - easeData.time) < 0.001) {
                                try {
                                    prop.setTemporalEaseAtKey(i, easeData.inEase, easeData.outEase);
                                    DEBUG_JSX.log("  ✓ Restored selected keyframe ease @ " + easeData.time.toFixed(3) + "s");
                                } catch(e) {
                                    // Might fail for some properties
                                }
                                break;
                            }
                        }
                    }

                    // COLLECT selections for GLOBAL restoration at the very end (include layer reference)
                    DEBUG_JSX.log("🎬 COLLECTING " + newSelIndices.length + " keyframe selections for property " + prop.name + " on layer " + cached.layerName);
                    allProcessedSelections.push({
                        layer: cached.layer,
                        propertyName: prop.name,
                        propertyReference: prop,  // Store actual property reference to avoid name conflicts
                        indices: newSelIndices,
                        adjacentPrevKeyData: allPrevKeyData,  // Store for final restoration pass
                        adjacentNextKeyData: allNextKeyData,  // Store for final restoration pass
                        selectedKeyframesEase: selectedKeyframesEase,  // Store for final restoration pass
                        originalLastTime: lastTime,            // Store for IN ease scaling
                        newLastTime: newLastTime               // Store for IN ease scaling
                    });
                }
        }

        if (!processedAny) {
            app.endUndoGroup();
            return "error|Select > 1 Key";
        }
        
        // FRESH PROPERTY REFERENCE ACQUISITION: Re-acquire fresh references to prevent staleness
        DEBUG_JSX.log("🎬 FRESH REFERENCE ACQUISITION: Re-acquiring fresh property references for " + allProcessedSelections.length + " properties");
        
        // Helper function to find property by name in layer hierarchy
        function findPropertyByName(layer, propertyName) {
            function searchPropertyGroup(propGroup) {
                for (var i = 1; i <= propGroup.numProperties; i++) {
                    var prop = propGroup.property(i);
                    if (prop && prop.name === propertyName) {
                        return prop;
                    }
                    // Recurse into property groups
                    if (prop && (prop.propertyType === PropertyType.INDEXED_GROUP || 
                               prop.propertyType === PropertyType.NAMED_GROUP)) {
                        var found = searchPropertyGroup(prop);
                        if (found) return found;
                    }
                }
            }
            
            // Search layer properties
            var found = searchPropertyGroup(layer);
            if (found) return found;
            
            // Check special properties like Time Remap
            try {
                if (layer.timeRemapEnabled && layer.timeRemap && layer.timeRemap.name === propertyName) {
                    return layer.timeRemap;
                }
            } catch(e) {
                // Time remap might not be available
            }
            
            return null;
        }
        
        // Store processed selections for backup restoration
        var processedSelections = [];
        for (var i = 0; i < allProcessedSelections.length; i++) {
            var selData = allProcessedSelections[i];
            processedSelections.push({
                layer: selData.layer,
                propertyName: selData.propertyName,
                propertyReference: selData.propertyReference,  // Use stored reference directly
                indices: selData.indices,
                adjacentPrevKeyData: selData.adjacentPrevKeyData,  // Copy for final restoration
                adjacentNextKeyData: selData.adjacentNextKeyData,  // Copy for final restoration
                selectedKeyframesEase: selData.selectedKeyframesEase,  // Copy for final restoration
                originalLastTime: selData.originalLastTime,        // Copy for IN ease scaling
                newLastTime: selData.newLastTime                   // Copy for IN ease scaling
            });
        }
        
        // GLOBAL SELECTION RESTORATION using stored property references
        DEBUG_JSX.log("🎬 GLOBAL SELECTION RESTORATION: Processing " + processedSelections.length + " properties");
        for (var i = 0; i < processedSelections.length; i++) {
            var selData = processedSelections[i];
            DEBUG_JSX.log("Restoring selection " + (i+1) + "/" + processedSelections.length + ": " + selData.propertyName + " on " + selData.layer.name);
            
            // Use stored property reference directly (avoids name conflicts with multiple "Slider" properties)
            var freshProp = selData.propertyReference;
            if (!freshProp) {
                DEBUG_JSX.log("  ERROR: No property reference stored for " + selData.propertyName);
                continue;
            }
            
            DEBUG_JSX.log("  Using stored property reference with " + freshProp.numKeys + " keys, selecting indices: [" + selData.indices.join(", ") + "]");
            
            // CRITICAL: First deselect ALL keyframes on this property
            for (var k = 1; k <= freshProp.numKeys; k++) {
                try {
                    freshProp.setSelectedAtKey(k, false);
                } catch(e) {
                    // Ignore deselection errors
                }
            }
            
            // Now select only the keyframes we moved
            var successfulSelections = 0;
            for (var j = 0; j < selData.indices.length; j++) {
                try {
                    freshProp.setSelectedAtKey(selData.indices[j], true);
                    successfulSelections++;
                } catch(e) {
                    DEBUG_JSX.log("  ERROR: Failed to select key " + selData.indices[j] + ": " + e.toString());
                }
            }
            DEBUG_JSX.log("  Successfully selected " + successfulSelections + "/" + selData.indices.length + " keyframes");
        }

        // FINAL RESTORATION PASS: After selection restoration, AE may have modified adjacent keyframes again
        // Do one more restoration pass to ensure they stay correct
        DEBUG_JSX.log("🔓 FINAL RESTORATION PASS: Restoring all adjacent keyframes after selection");
        for (var i = 0; i < processedSelections.length; i++) {
            var selData = processedSelections[i];
            var prop = selData.propertyReference;

            if (!prop) continue;

            // Restore all previous keyframes
            if (selData.adjacentPrevKeyData && selData.adjacentPrevKeyData.length > 0) {
                DEBUG_JSX.log("  🔓 Final restore: " + selData.adjacentPrevKeyData.length + " keyframes before selection on " + selData.propertyName);
                for (var k = 0; k < selData.adjacentPrevKeyData.length; k++) {
                    var keyState = selData.adjacentPrevKeyData[k];

                    // Find keyframe by time
                    for (var j = 1; j <= prop.numKeys; j++) {
                        if (Math.abs(prop.keyTime(j) - keyState.time) < 0.001) {
                            restoreKeyframeState(prop, j, keyState);
                            DEBUG_JSX.log("     ✓ Final restored keyframe #" + keyState.index + " @ " + keyState.time.toFixed(3) + "s");
                            break;
                        }
                    }
                }
            }

            // Restore all next keyframes (with IN ease scaling)
            if (selData.adjacentNextKeyData && selData.adjacentNextKeyData.length > 0) {
                DEBUG_JSX.log("  🔓 Final restore: " + selData.adjacentNextKeyData.length + " keyframes after selection on " + selData.propertyName);
                for (var k = 0; k < selData.adjacentNextKeyData.length; k++) {
                    var keyState = selData.adjacentNextKeyData[k];

                    // Find keyframe by time
                    for (var j = 1; j <= prop.numKeys; j++) {
                        if (Math.abs(prop.keyTime(j) - keyState.time) < 0.001) {
                            // Scale IN ease based on distance change from last selected keyframe
                            if (keyState.inEase && keyState.inEase.length > 0 && selData.originalLastTime && selData.newLastTime) {
                                var originalDistanceFromLast = keyState.time - selData.originalLastTime;
                                var newDistanceFromLast = keyState.time - selData.newLastTime;

                                if (originalDistanceFromLast > 0 && newDistanceFromLast > 0) {
                                    // Scale IN ease
                                    var scaledInEase = scaleEaseForDuration(keyState.inEase, originalDistanceFromLast, newDistanceFromLast);

                                    // Create a modified keyState with scaled IN ease
                                    var modifiedKeyState = {};
                                    for (var propName in keyState) {
                                        modifiedKeyState[propName] = keyState[propName];
                                    }
                                    modifiedKeyState.inEase = scaledInEase;

                                    restoreKeyframeState(prop, j, modifiedKeyState);
                                    DEBUG_JSX.log("     ✓ Final restored keyframe #" + keyState.index + " @ " + keyState.time.toFixed(3) + "s (scaled IN ease)");
                                } else {
                                    restoreKeyframeState(prop, j, keyState);
                                    DEBUG_JSX.log("     ✓ Final restored keyframe #" + keyState.index + " @ " + keyState.time.toFixed(3) + "s");
                                }
                            } else {
                                restoreKeyframeState(prop, j, keyState);
                                DEBUG_JSX.log("     ✓ Final restored keyframe #" + keyState.index + " @ " + keyState.time.toFixed(3) + "s");
                            }
                            break;
                        }
                    }
                }
            }

            // FINAL RESTORATION: Restore selected keyframes' ease after restoring adjacent keyframes
            if (selData.selectedKeyframesEase && selData.selectedKeyframesEase.length > 0) {
                DEBUG_JSX.log("  🔓 Final restore: selected keyframes' ease on " + selData.propertyName);
                for (var k = 0; k < selData.selectedKeyframesEase.length; k++) {
                    var easeData = selData.selectedKeyframesEase[k];

                    // Find keyframe by time
                    for (var j = 1; j <= prop.numKeys; j++) {
                        if (Math.abs(prop.keyTime(j) - easeData.time) < 0.001) {
                            try {
                                prop.setTemporalEaseAtKey(j, easeData.inEase, easeData.outEase);
                                DEBUG_JSX.log("     ✓ Final restored selected keyframe ease @ " + easeData.time.toFixed(3) + "s");
                            } catch(e) {
                                // Might fail for some properties
                            }
                            break;
                        }
                    }
                }
            }
        }

        // NOTE: We intentionally do NOT set prop.selected = true here
        // because that can cause After Effects to auto-select ALL keyframes on the property
        // We've already selected the specific keyframes we want above
        
        // Calculate total span duration from all processed keyframes (like cross-property mode does)
        var finalDurationMs = 0;
        var finalDurationFrames = 0;
        
        if (allProcessedKeyframeTimes.length > 0) {
            // Find earliest and latest times across all processed keyframes
            var earliestTime = Math.min.apply(Math, allProcessedKeyframeTimes);
            var latestTime = Math.max.apply(Math, allProcessedKeyframeTimes);
            var totalSpanSeconds = latestTime - earliestTime;
            
            finalDurationMs = roundMs(totalSpanSeconds);
            finalDurationFrames = Math.round(totalSpanSeconds * frameRate);
            
            DEBUG_JSX.log("🎬 Total span calculation: " + allProcessedKeyframeTimes.length + " keyframes from " + (earliestTime * 1000).toFixed(1) + "ms to " + (latestTime * 1000).toFixed(1) + "ms = " + finalDurationMs + "ms span");
        } else {
            // Fallback to old approach if no keyframe times were tracked
            finalDurationMs = roundMs(totalDuration);
            finalDurationFrames = Math.round(totalDuration * frameRate);
        }
        
        DEBUG_JSX.log("🎬 Frame-based duration stretch completed: " + finalDurationMs + "ms / " + finalDurationFrames + "f");

        // End undo group AFTER all operations complete (including final restoration pass)
        app.endUndoGroup();

        // Include debug messages in result
        var debugMessages = DEBUG_JSX.getMessages();
        return "success|" + finalDurationMs + "|" + finalDurationFrames + "|" + debugMessages.join("|");
        
    } catch(e) {
        app.endUndoGroup();
        DEBUG_JSX.error("stretchKeyframesGrokApproachWithFrames failed", e);
        var debugMessages = DEBUG_JSX.getMessages();
        return "error|Failed to stretch keyframes with frames: " + e.toString() + "|" + debugMessages.join("|");
    }
}

// Wrapper functions for +/- buttons (using Grok's approach)
function stretchKeyframesForward() {
    try {
        // Check if we're in cross-property mode first
        var crossPropertyResult = checkCrossPropertyMode();
        
        if (crossPropertyResult.isCrossProperty) {
            return nudgeDelayForward();
        } else {
            return stretchKeyframesGrokApproach(3); // forward 3 frames (original working behavior)
        }
    } catch(e) {
        return "error|Failed to stretch keyframes forward: " + e.toString();
    }
}

function stretchKeyframesBackward() {
    try {
        // Check if we're in cross-property mode first
        var crossPropertyResult = checkCrossPropertyMode();
        
        if (crossPropertyResult.isCrossProperty) {
            return nudgeDelayBackward();
        } else {
            return stretchKeyframesGrokApproach(-3); // backward 3 frames (original working behavior)
        }
    } catch(e) {
        return "error|Failed to stretch keyframes backward: " + e.toString();
    }
}

// NEW: Frame-based duration stretching that uses the original working approach
function stretchKeyframesWithFrames(direction, frames) {
    try {
        DEBUG_JSX.clear();
        DEBUG_JSX.log("STRETCH: " + direction + " direction, " + frames + " frames");
        
        // CRITICAL FIX: This function should ONLY be used for duration stretching, never for delay nudging
        // If this is being called from delay nudging, redirect to proper delay handling
        DEBUG_JSX.log("WARNING: Function is for duration operations only");
        
        // SAFEGUARD: Detect if this is being called incorrectly from delay operations
        // Check the call stack to see if this is coming from delay functions
        try {
            var errorStack = (new Error()).stack || "";
            if (errorStack.indexOf("nudgeDelay") >= 0 || errorStack.indexOf("Nudge Delay") >= 0) {
                DEBUG_JSX.log("🎬 SAFEGUARD: Detected incorrect call from delay operation, blocking duration stretch");
                var debugMessages = DEBUG_JSX.getMessages();
                return "error|Duration stretch incorrectly called from delay operation - using delay nudging functions instead|" + debugMessages.join("|");
            }
        } catch(e) {
            // Stack trace detection failed, continue normally
            DEBUG_JSX.log("🎬 Stack trace detection failed: " + e.toString());
        }
        
        // Safety checks
        if (typeof direction === 'undefined' || typeof frames === 'undefined') {
            DEBUG_JSX.error("Invalid parameters", "direction: " + direction + ", frames: " + frames);
            var debugMessages = DEBUG_JSX.getMessages();
            return "error|Invalid parameters|" + debugMessages.join("|");
        }
        
        // CRITICAL FIX: For DURATION operations, we need to check if there are multiple properties
        // with selected keyframes, regardless of timing differences.
        // The timing difference check in checkCrossPropertyMode() is only relevant for DELAY operations.

        var comp = app.project.activeItem;
        var selectedLayers = comp.selectedLayers;

        // Count properties with selected keyframes
        var propertiesWithKeys = 0;
        DEBUG_JSX.log("🎬 MANUAL CHECK: " + selectedLayers.length + " selected layers");
        for (var layerIdx = 0; layerIdx < selectedLayers.length; layerIdx++) {
            var layer = selectedLayers[layerIdx];
            var selectedProps = layer.selectedProperties;
            DEBUG_JSX.log("🎬 MANUAL CHECK: Layer " + layer.name + " has " + selectedProps.length + " selected properties");
            for (var j = 0; j < selectedProps.length; j++) {
                var prop = selectedProps[j];
                try {
                    if (prop.propertyValueType !== PropertyValueType.NO_VALUE && prop.numKeys >= 2) {
                        var selKeys = prop.selectedKeys;
                        if (selKeys && selKeys.length >= 2) {
                            propertiesWithKeys++;
                            DEBUG_JSX.log("🎬 MANUAL CHECK: Property " + prop.name + " has " + selKeys.length + " selected keyframes");
                        }
                    }
                } catch(e) {
                    DEBUG_JSX.log("🎬 MANUAL CHECK: Property " + prop.name + " - ERROR accessing selectedKeys: " + e.toString());
                }
            }
        }

        // Use multi-property mode if more than one property has selected keyframes
        var isMultiProperty = (propertiesWithKeys > 1);
        DEBUG_JSX.log("Mode: " + (isMultiProperty ? "multi-property (" + propertiesWithKeys + " properties)" : "single-property"));

        if (isMultiProperty) {
            // For multi-property mode, stretch each property's duration individually
            DEBUG_JSX.log("🎬 Using MULTI-PROPERTY mode - calling stretchKeyframesForCrossProperty");
            var result;
            try {
                result = stretchKeyframesForCrossProperty(direction, frames);
                DEBUG_JSX.log("🎬 stretchKeyframesForCrossProperty returned: " + result);
                // Add our debug messages to the result
                var debugMessages = DEBUG_JSX.getMessages();
                return result + "|" + debugMessages.join("|");
            } catch(e) {
                DEBUG_JSX.error("stretchKeyframesForCrossProperty failed", e);
                var debugMessages = DEBUG_JSX.getMessages();
                return "error|stretchKeyframesForCrossProperty failed: " + e.toString() + "|" + debugMessages.join("|");
            }
        } else {
            // For single-property mode, modify the original approach
            // Instead of calling stretchKeyframesGrokApproach with hardcoded values,
            // we need to use our custom frame-based logic but with the SAME selection approach
            DEBUG_JSX.log("🎬 Using SINGLE-PROPERTY mode - calling stretchKeyframesGrokApproachWithFrames");
            try {
                var result = stretchKeyframesGrokApproachWithFrames(direction, frames);
                DEBUG_JSX.log("🎬 stretchKeyframesGrokApproachWithFrames returned: " + result);
                return result;
            } catch(e) {
                DEBUG_JSX.error("stretchKeyframesGrokApproachWithFrames failed", e);
                var debugMessages = DEBUG_JSX.getMessages();
                return "error|stretchKeyframesGrokApproachWithFrames failed: " + e.toString() + "|" + debugMessages.join("|");
            }
        }
    } catch(e) {
        DEBUG_JSX.error("stretchKeyframesWithFrames failed", e);
        var debugMessages = DEBUG_JSX.getMessages();
        return "error|Failed to stretch keyframes with frames: " + e.toString() + "|" + debugMessages.join("|");
    }
}

// Cross-property duration stretching function - WITH COMPLETE SELECTION PRESERVATION
function stretchKeyframesForCrossProperty(direction, frames) {
    try {
        DEBUG_JSX.log("🎬 stretchKeyframesForCrossProperty called with direction: " + direction + ", frames: " + frames);
        
        app.beginUndoGroup("Stretch Cross-Property Duration");
        
        var comp = app.project.activeItem;
        if (!(comp && comp instanceof CompItem)) {
            app.endUndoGroup();
            return "error|No composition selected";
        }
        
        var frameRate = comp.frameRate || 30;
        var framesToSeconds = frames / frameRate;
        
        DEBUG_JSX.log("🎬 Converting " + frames + " frames to " + (framesToSeconds * 1000) + "ms at " + frameRate + "fps");
        
        var selectedLayers = comp.selectedLayers;
        if (selectedLayers.length === 0) {
            app.endUndoGroup();
            return "error|No layers selected";
        }
        
        // STEP 1: CACHE ALL SELECTIONS BEFORE ANY MANIPULATION
        DEBUG_JSX.log("🎬 STEP 1: Caching all selected keyframes before manipulation");
        var cachedSelections = [];
        for (var i = 0; i < selectedLayers.length; i++) {
            var layer = selectedLayers[i];
            var selectedProps = layer.selectedProperties;
            
            DEBUG_JSX.log("Cache: " + layer.name + " (" + selectedProps.length + " props)");
            
            for (var j = 0; j < selectedProps.length; j++) {
                var prop = selectedProps[j];

                if (prop.propertyValueType === PropertyValueType.NO_VALUE || prop.numKeys < 2) {
                    continue;
                }

                // CRITICAL: Manually check EVERY keyframe for selection
                // DO NOT trust prop.selectedKeys after this point!
                var selKeys = [];
                for (var k = 1; k <= prop.numKeys; k++) {
                    if (prop.keySelected(k)) {
                        selKeys.push(k);
                    }
                }

                if (selKeys.length >= 2) {
                    cachedSelections.push({
                        layer: layer,
                        layerName: layer.name,
                        property: prop,
                        propertyName: prop.name,
                        selectedIndices: selKeys.slice() // Make a copy!
                    });
                    DEBUG_JSX.log("  " + prop.name + ": " + selKeys.length + " keys");
                }
            }
        }
        
        DEBUG_JSX.log("🎬 Cached " + cachedSelections.length + " properties with selected keyframes");
        
        if (cachedSelections.length === 0) {
            app.endUndoGroup();
            return "error|No properties were processed - need at least 2 keyframes per property";
        }
        
        // STEP 2: PROCESS USING CACHED SELECTIONS
        DEBUG_JSX.log("🎬 STEP 2: Processing keyframes using cached selections");
        var processedProperties = 0;
        var allProcessedSelections = []; // Collect ALL selections for final restoration
        var allProcessedKeyframeTimes = []; // Collect ALL new keyframe times for total span calculation
        var propertyDurations = []; // Collect each property's duration to check if they're all the same

        for (var i = 0; i < cachedSelections.length; i++) {
            var cached = cachedSelections[i];
            var prop = cached.property;
            var selKeys = cached.selectedIndices; // Use cached, not prop.selectedKeys!

            DEBUG_JSX.log("Process: " + cached.propertyName + " (" + selKeys.length + " keys)");

            // Use the duration stretching logic with cached selections (pass frameRate for smart snapping)
            var result = stretchPropertyDurationWithCache(prop, selKeys, direction * framesToSeconds, cached, frameRate);
            if (result.success) {
                processedProperties++;

                // COLLECT selections for GLOBAL restoration at the very end
                allProcessedSelections.push({
                    layer: cached.layer,
                    propertyName: cached.propertyName,
                    propertyReference: prop,  // Store actual property reference to avoid name conflicts
                    indices: result.newSelIndices
                });

                // COLLECT all new keyframe times for total span calculation (like readKeyframesSmart does)
                for (var t = 0; t < result.newKeyframeTimes.length; t++) {
                    allProcessedKeyframeTimes.push(result.newKeyframeTimes[t]);
                }

                // COLLECT each property's duration
                propertyDurations.push(result.durationMs);

                DEBUG_JSX.log("🎬 COLLECTED " + result.newSelIndices.length + " keyframe selections for property " + cached.propertyName + " with duration: " + result.durationMs + "ms");
            }
        }
        
        // STEP 3: RESTORE SELECTION WITH FRESH REFERENCES
        DEBUG_JSX.log("🎬 STEP 3: Restoring selections with fresh property references");
        
        // Helper function to find property by name in layer hierarchy
        function findPropertyByName(layer, propertyName) {
            function searchPropertyGroup(propGroup) {
                for (var i = 1; i <= propGroup.numProperties; i++) {
                    var prop = propGroup.property(i);
                    if (prop && prop.name === propertyName && prop.canVaryOverTime) {
                        return prop;
                    }
                    // Recurse into property groups
                    if (prop && (prop.propertyType === PropertyType.INDEXED_GROUP || 
                               prop.propertyType === PropertyType.NAMED_GROUP)) {
                        var found = searchPropertyGroup(prop);
                        if (found) return found;
                    }
                }
                return null;
            }
            
            // Search layer properties
            var found = searchPropertyGroup(layer);
            if (found) return found;
            
            // Check special properties like Time Remap
            try {
                if (layer.timeRemapEnabled && layer.timeRemap && layer.timeRemap.name === propertyName) {
                    return layer.timeRemap;
                }
            } catch(e) {
                // Time remap might not be available
            }
            
            return null;
        }
        
        // Store processed selections for backup restoration
        var processedSelections = [];
        for (var i = 0; i < allProcessedSelections.length; i++) {
            var selData = allProcessedSelections[i];
            processedSelections.push({
                layer: selData.layer,
                propertyName: selData.propertyName,
                propertyReference: selData.propertyReference,  // Use stored reference directly
                indices: selData.indices,
                adjacentPrevKeyData: selData.adjacentPrevKeyData,  // Copy for final restoration
                adjacentNextKeyData: selData.adjacentNextKeyData,  // Copy for final restoration
                selectedKeyframesEase: selData.selectedKeyframesEase,  // Copy for final restoration
                originalLastTime: selData.originalLastTime,        // Copy for IN ease scaling
                newLastTime: selData.newLastTime                   // Copy for IN ease scaling
            });
        }
        
        app.endUndoGroup();
        
        // Small delay to let After Effects process the undo group before restoring selections
        try {
            app.refresh();
        } catch(e) {
            // Refresh might not be available, continue anyway
        }
        
        // STEP 4: BACKUP SELECTION RESTORATION using stored property references
        DEBUG_JSX.log("🎬 BACKUP: Selection restoration for " + processedSelections.length + " properties (immediate selection should have already worked)");
        for (var i = 0; i < processedSelections.length; i++) {
            var selData = processedSelections[i];
            DEBUG_JSX.log("Restoring selection " + (i+1) + "/" + processedSelections.length + ": " + selData.propertyName + " on " + selData.layer.name);
            
            // Use stored property reference directly (avoids name conflicts with multiple "Slider" properties)
            var freshProp = selData.propertyReference;
            if (!freshProp) {
                DEBUG_JSX.log("  ERROR: No property reference stored for " + selData.propertyName);
                continue;
            }
            
            DEBUG_JSX.log("  Using stored property reference with " + freshProp.numKeys + " keys, selecting indices: [" + selData.indices.join(", ") + "]");
            
            // CRITICAL: First deselect ALL keyframes on this property
            for (var k = 1; k <= freshProp.numKeys; k++) {
                try {
                    freshProp.setSelectedAtKey(k, false);
                } catch(e) {
                    // Ignore deselection errors
                }
            }
            
            // Now select only the keyframes we moved
            var successfulSelections = 0;
            for (var j = 0; j < selData.indices.length; j++) {
                try {
                    freshProp.setSelectedAtKey(selData.indices[j], true);
                    successfulSelections++;
                } catch(e) {
                    DEBUG_JSX.log("  ERROR: Failed to select key " + selData.indices[j] + ": " + e.toString());
                }
            }
            DEBUG_JSX.log("  Successfully selected " + successfulSelections + "/" + selData.indices.length + " keyframes");
        }
        
        // Calculate duration: check if all properties have the same duration (like readKeyframesSmart does)
        var totalDurationMs = 0;
        var totalDurationFrames = 0;

        DEBUG_JSX.log("🎬 Checking if all " + propertyDurations.length + " properties have same duration");

        // Check if all property durations are the same (with 1ms tolerance)
        var uniqueDurations = [];
        for (var k = 0; k < propertyDurations.length; k++) {
            var found = false;
            for (var j = 0; j < uniqueDurations.length; j++) {
                if (Math.abs(uniqueDurations[j] - propertyDurations[k]) < 1) { // 1ms tolerance
                    found = true;
                    break;
                }
            }
            if (!found) {
                uniqueDurations.push(propertyDurations[k]);
            }
        }

        DEBUG_JSX.log("🎬 Found " + uniqueDurations.length + " unique durations: " + uniqueDurations.join(", ") + "ms");

        if (uniqueDurations.length === 0) {
            // No durations (shouldn't happen but handle it)
            totalDurationMs = 0;
            totalDurationFrames = 0;
        } else if (uniqueDurations.length === 1) {
            // All properties have the same duration
            totalDurationMs = uniqueDurations[0];
            totalDurationFrames = Math.round((totalDurationMs / 1000) * frameRate);
            DEBUG_JSX.log("🎬 All properties have same duration: " + totalDurationMs + "ms");
        } else {
            // Different durations - show "Multiple"
            totalDurationMs = -1; // Special flag for "Multiple"
            totalDurationFrames = -1;
            DEBUG_JSX.log("🎬 Properties have different durations - returning Multiple");
        }

        DEBUG_JSX.log("🎬 Cross-property duration stretch completed: " + processedProperties + " properties, " + totalDurationMs + "ms / " + totalDurationFrames + "f");

        // Return success with cross-property flag
        return "success|" + totalDurationMs + "|" + totalDurationFrames + "|1|CROSSDURATION";
        
    } catch(e) {
        app.endUndoGroup();
        DEBUG_JSX.log("🎬 stretchKeyframesForCrossProperty error: " + e.toString());
        return "error|Cross-property duration stretch failed: " + e.toString();
    }
}

// Helper function to stretch duration of a single property with cached selection support
function stretchPropertyDurationWithCache(prop, selectedKeys, deltaSeconds, cached, frameRate) {
    try {
        // PROTECTION: Capture the next keyframe to prevent AE from modifying it
        var nextKeyData = captureNextKeyframe(prop, selectedKeys);

        // Collect keyframe data
        var keyframeData = [];
        for (var k = 0; k < selectedKeys.length; k++) {
            var keyIndex = selectedKeys[k];
            var data = {
                oldIndex: keyIndex,
                time: prop.keyTime(keyIndex),
                value: prop.keyValue(keyIndex),
                inInterp: prop.keyInInterpolationType(keyIndex),
                outInterp: prop.keyOutInterpolationType(keyIndex),
                temporalContinuous: prop.keyTemporalContinuous(keyIndex),
                temporalAutoBezier: prop.keyTemporalAutoBezier(keyIndex),
                // CRITICAL: Preserve keyframe color labels
                label: prop.keyLabel(keyIndex)
            };

            // Only collect temporal ease if BOTH sides are bezier
            if (data.inInterp === KeyframeInterpolationType.BEZIER || data.outInterp === KeyframeInterpolationType.BEZIER) {
                try {
                    data.inEase = prop.keyInTemporalEase(keyIndex);
                    data.outEase = prop.keyOutTemporalEase(keyIndex);
                } catch(e) {
                    // Temporal ease might not be available for some properties
                }
            }

            // Handle spatial properties if applicable
            if (prop.isSpatial) {
                data.spatialContinuous = prop.keySpatialContinuous(keyIndex);
                data.spatialAutoBezier = prop.keySpatialAutoBezier(keyIndex);
                data.inTangent = prop.keyInSpatialTangent(keyIndex);
                data.outTangent = prop.keyOutSpatialTangent(keyIndex);
            }

            keyframeData.push(data);
        }

        // Sort by time to identify first and last keyframes
        keyframeData.sort(function(a, b) { return a.time - b.time; });
        var firstTime = keyframeData[0].time;
        var lastTime = keyframeData[keyframeData.length - 1].time;
        var currentDuration = lastTime - firstTime;

        // SMART SNAPPING: Apply delta then snap to nearest 50ms (same as single-property mode)
        var currentDurationMs = currentDuration * 1000;
        var deltaMs = deltaSeconds * 1000;

        // Step 1: Apply the delta (add or subtract)
        var targetDurationMs = currentDurationMs + deltaMs;

        // Step 2: Snap to nearest 50ms increment
        var newDurationMs = Math.round(targetDurationMs / 50) * 50;

        // Step 3: Ensure we don't go below one frame duration
        var minDurationMs = (1 / frameRate) * 1000;
        if (newDurationMs < minDurationMs) {
            newDurationMs = minDurationMs;
        }

        DEBUG_JSX.log("🎬 Smart snap: " + currentDurationMs.toFixed(1) + "ms -> " + targetDurationMs.toFixed(1) + "ms (target) -> " + newDurationMs.toFixed(1) + "ms (snapped to 50ms)");

        // Convert back to seconds
        var newDuration = newDurationMs / 1000;

        DEBUG_JSX.log("🎬 " + prop.name + " duration: " + currentDurationMs.toFixed(1) + "ms → " + newDurationMs.toFixed(1) + "ms");

        // Capture next keyframe time if it exists (for OUT ease scaling of last keyframe)
        var nextKeyframeTime = null;
        if (nextKeyData && nextKeyData.time) {
            nextKeyframeTime = nextKeyData.time;
        }

        // Calculate new times - stretch proportionally
        for (var k = 0; k < keyframeData.length; k++) {
            var data = keyframeData[k];
            if (k === 0) {
                // First keyframe stays at same time
                data.newTime = data.time;
            } else {
                // Other keyframes get stretched proportionally
                var progress = (data.time - firstTime) / currentDuration;
                data.newTime = firstTime + (progress * newDuration);
            }
        }

        // Check if this is Time Remap - needs special add-before-delete handling
        var isTimeRemap = (prop.matchName === "ADBE Time Remapping");

        if (isTimeRemap) {
            DEBUG_JSX.log("🎬 Using Time Remap special handling (add-before-delete pattern)");
        }

        // TIME REMAP: Add new keyframes BEFORE deleting old ones
        var newSelIndices = [];
        var newKeyframeTimes = [];
        var keysToDelete = []; // Track which keys to delete for Time Remap

        if (isTimeRemap) {
            for (var k = 0; k < keyframeData.length; k++) {
                var data = keyframeData[k];

                // Check if keyframe needs to be moved
                if (Math.abs(data.newTime - data.time) < 0.001) {
                    // No movement needed, just track the time for later selection
                    newKeyframeTimes.push(data.time);
                    DEBUG_JSX.log("  Time Remap keyframe " + (k+1) + " already at target time " + (data.newTime * 1000).toFixed(1) + "ms");
                } else {
                    // Add new keyframe at new time using setValueAtTime
                    prop.setValueAtTime(data.newTime, data.value);

                    // Find the new keyframe index and select it immediately
                    var newIdx = -1;
                    for (var j = 1; j <= prop.numKeys; j++) {
                        if (Math.abs(prop.keyTime(j) - data.newTime) < 0.001) {
                            newIdx = j;
                            break;
                        }
                    }

                    if (newIdx !== -1) {
                        // IMMEDIATE SELECTION before deletion
                        try {
                            prop.setSelectedAtKey(newIdx, true);
                            DEBUG_JSX.log("  Immediately selected Time Remap keyframe at index " + newIdx);
                        } catch(e) {
                            DEBUG_JSX.log("  Failed to select Time Remap keyframe: " + e.toString());
                        }

                        newKeyframeTimes.push(data.newTime);

                        // Only mark for deletion if old keyframe still exists at OLD time
                        // (setValueAtTime might have replaced it in place)
                        var oldKeyStillExists = false;
                        for (var j = 1; j <= prop.numKeys; j++) {
                            if (Math.abs(prop.keyTime(j) - data.time) < 0.001) {
                                oldKeyStillExists = true;
                                keysToDelete.push({index: j, time: data.time});
                                DEBUG_JSX.log("  Found old keyframe at index " + j + " (time " + (data.time * 1000).toFixed(1) + "ms) - will delete");
                                break;
                            }
                        }

                        if (!oldKeyStillExists) {
                            DEBUG_JSX.log("  Old keyframe at " + (data.time * 1000).toFixed(1) + "ms no longer exists (replaced in place by setValueAtTime)");
                        }
                    }
                }
            }

            // Now delete old keyframes in reverse order by index
            keysToDelete.sort(function(a, b) { return b.index - a.index; });
            for (var k = 0; k < keysToDelete.length; k++) {
                DEBUG_JSX.log("  Removing old Time Remap keyframe at index " + keysToDelete[k].index + " (time " + (keysToDelete[k].time * 1000).toFixed(1) + "ms)");
                prop.removeKey(keysToDelete[k].index);
            }

            // CRITICAL: Clear ALL selections on Time Remap property first
            DEBUG_JSX.log("  Clearing all Time Remap selections before final re-selection");
            for (var j = 1; j <= prop.numKeys; j++) {
                try {
                    prop.setSelectedAtKey(j, false);
                } catch(e) {
                    // Ignore deselection errors
                }
            }

            // Debug: Show all existing keyframes after deletion
            DEBUG_JSX.log("  Time Remap property now has " + prop.numKeys + " total keyframes:");
            for (var j = 1; j <= prop.numKeys; j++) {
                DEBUG_JSX.log("    Index " + j + " at time " + (prop.keyTime(j) * 1000).toFixed(1) + "ms");
            }

            // After deletion, find the final indices by time and select them
            var timesStr = "";
            for (var t = 0; t < newKeyframeTimes.length; t++) {
                if (t > 0) timesStr += ", ";
                timesStr += (newKeyframeTimes[t] * 1000).toFixed(1) + "ms";
            }
            DEBUG_JSX.log("  Searching for " + newKeyframeTimes.length + " target times: " + timesStr);
            for (var k = 0; k < newKeyframeTimes.length; k++) {
                var targetTime = newKeyframeTimes[k];
                var found = false;
                for (var j = 1; j <= prop.numKeys; j++) {
                    if (Math.abs(prop.keyTime(j) - targetTime) < 0.001) {
                        newSelIndices.push(j);
                        found = true;
                        // Select the keyframe
                        try {
                            prop.setSelectedAtKey(j, true);
                            DEBUG_JSX.log("  Final selection: Time Remap keyframe at index " + j + " (time " + (targetTime * 1000).toFixed(1) + "ms)");
                        } catch(e) {
                            DEBUG_JSX.log("  Failed to select Time Remap keyframe at index " + j + ": " + e.toString());
                        }
                        break;
                    }
                }
                if (!found) {
                    DEBUG_JSX.log("  WARNING: Could not find Time Remap keyframe at target time " + (targetTime * 1000).toFixed(1) + "ms");
                }
            }
            DEBUG_JSX.log("  Time Remap final selected indices after deletion: " + newSelIndices.join(", "));
        } else {
            // NORMAL PROPERTIES: Use standard delete-then-recreate pattern

            // Remove old keyframes in reverse order
            var indices = [];
            for (var k = 0; k < keyframeData.length; k++) {
                indices.push(keyframeData[k].oldIndex);
            }
            indices.sort(function(a, b) { return b - a; }); // Reverse order

            for (var k = 0; k < indices.length; k++) {
                prop.removeKey(indices[k]);
            }

            // Create new keyframes at new times
            for (var k = 0; k < keyframeData.length; k++) {
                var data = keyframeData[k];
                var newIdx = prop.addKey(data.newTime);

                // Restore all attributes
                prop.setValueAtKey(newIdx, data.value);

                // CRITICAL: Scale ease speed to maintain visual curve shape
                if (data.inEase !== undefined && data.outEase !== undefined) {
                    try {
                        // Determine if we should scale IN or OUT ease:
                        // - First keyframe: DON'T scale IN ease (affects curve from previous non-selected keyframe)
                        // - Last keyframe: Check if there's a next keyframe
                        //   - If NO next keyframe: DON'T scale OUT ease (no curve to affect)
                        //   - If YES next keyframe: Scale OUT ease based on distance change to next keyframe
                        // - Middle keyframes: scale both IN and OUT ease
                        var isFirstKey = (k === 0);
                        var isLastKey = (k === keyframeData.length - 1);

                        var scaledInEase = isFirstKey ? data.inEase : scaleEaseForDuration(data.inEase, currentDuration, newDuration);

                        var scaledOutEase;
                        if (isLastKey && nextKeyframeTime !== null) {
                            // Calculate distance to next keyframe
                            var originalDistanceToNext = nextKeyframeTime - data.time;
                            var newDistanceToNext = nextKeyframeTime - data.newTime;

                            // Scale OUT ease based on distance change to next keyframe
                            scaledOutEase = scaleEaseForDuration(data.outEase, originalDistanceToNext, newDistanceToNext);
                            DEBUG_JSX.log("  📊 Last keyframe OUT ease: scaled by distance to next keyframe (" + (originalDistanceToNext*1000).toFixed(1) + "ms → " + (newDistanceToNext*1000).toFixed(1) + "ms)");
                        } else if (isLastKey) {
                            // No next keyframe, preserve OUT ease
                            scaledOutEase = data.outEase;
                        } else {
                            // Middle keyframe, scale based on internal duration
                            scaledOutEase = scaleEaseForDuration(data.outEase, currentDuration, newDuration);
                        }

                        prop.setTemporalEaseAtKey(newIdx, scaledInEase, scaledOutEase);

                        if (isFirstKey) {
                            DEBUG_JSX.log("  ✅ Applied scaled ease (preserved IN ease for first keyframe)");
                        } else if (isLastKey && nextKeyframeTime === null) {
                            DEBUG_JSX.log("  ✅ Applied scaled ease (preserved OUT ease for last keyframe - no next keyframe)");
                        } else {
                            DEBUG_JSX.log("  ✅ Applied scaled ease");
                        }
                    } catch(e) {
                        // Some properties might not support temporal ease
                        DEBUG_JSX.log("  ❌ Failed to set ease: " + e.toString());
                    }
                } else {
                    // No ease data collected, use safe restore method
                    restoreTemporalEaseSafely(prop, newIdx, data.inInterp, data.outInterp, data.inEase, data.outEase);
                }

                // Then re-assert original interpolation types
                prop.setInterpolationTypeAtKey(newIdx, data.inInterp, data.outInterp);

                restoreTemporalFlagsSafely(prop, newIdx, data.inInterp, data.outInterp, data.temporalContinuous, data.temporalAutoBezier);

                if (data.spatialContinuous !== undefined) {
                    prop.setSpatialContinuousAtKey(newIdx, data.spatialContinuous);
                    prop.setSpatialAutoBezierAtKey(newIdx, data.spatialAutoBezier);
                    // Only restore tangents if NOT auto-bezier (manual tangent control)
                    if (!data.spatialAutoBezier && data.inTangent !== undefined && data.outTangent !== undefined) {
                        prop.setSpatialTangentsAtKey(newIdx, data.inTangent, data.outTangent);
                    }
                }

                // CRITICAL: Restore keyframe color label
                if (data.label !== undefined) {
                    try {
                        prop.setLabelAtKey(newIdx, data.label);
                    } catch(e) {
                        // Label setting might fail on some property types
                    }
                }

                // IMMEDIATE SELECTION: Select the keyframe right after creation (like stagger does)
                try {
                    prop.setSelectedAtKey(newIdx, true);
                    DEBUG_JSX.log("  Immediately selected duration keyframe " + newIdx);
                } catch(e) {
                    DEBUG_JSX.log("  Failed to immediately select duration keyframe " + newIdx + ": " + e.toString());
                }

                // COLLECT indices for return value
                newSelIndices.push(newIdx);
                // COLLECT times for total span calculation
                newKeyframeTimes.push(data.newTime);
            }
        }

        // PROTECTION: Restore the next keyframe
        if (nextKeyData !== null) {
            var keysAdded = newSelIndices.length - selectedKeys.length;
            restoreNextKeyframe(prop, nextKeyData, keysAdded);
        }

        return {
            success: true,
            durationMs: newDurationMs,  // Use the snapped duration in milliseconds
            newSelIndices: newSelIndices,  // Return for global selection restoration
            newKeyframeTimes: newKeyframeTimes  // Return for total span calculation
        };
        
    } catch(e) {
        DEBUG_JSX.log("🎬 stretchPropertyDurationWithCache error for " + prop.name + ": " + e.toString());
        return {
            success: false,
            durationMs: 0,
            newSelIndices: [],
            newKeyframeTimes: []
        };
    }
}

// Helper function to stretch duration of a single property
function stretchPropertyDuration(prop, selectedKeys, deltaSeconds) {
    try {
        // PROTECTION: Capture the next keyframe to prevent AE from modifying it
        var nextKeyData = captureNextKeyframe(prop, selectedKeys);

        // Collect keyframe data
        var keyframeData = [];
        for (var k = 0; k < selectedKeys.length; k++) {
            var keyIndex = selectedKeys[k];
            var data = {
                oldIndex: keyIndex,
                time: prop.keyTime(keyIndex),
                value: prop.keyValue(keyIndex),
                inInterp: prop.keyInInterpolationType(keyIndex),
                outInterp: prop.keyOutInterpolationType(keyIndex),
                temporalContinuous: prop.keyTemporalContinuous(keyIndex),
                temporalAutoBezier: prop.keyTemporalAutoBezier(keyIndex),
                // CRITICAL: Preserve keyframe color labels
                label: prop.keyLabel(keyIndex)
            };
            
            // Only collect temporal ease if BOTH sides are bezier
            if (data.inInterp === KeyframeInterpolationType.BEZIER || data.outInterp === KeyframeInterpolationType.BEZIER) {
                try {
                    data.inEase = prop.keyInTemporalEase(keyIndex);
                    data.outEase = prop.keyOutTemporalEase(keyIndex);
                } catch(e) {
                    // Temporal ease might not be available for some properties
                }
            }
            
            // Handle spatial properties if applicable
            if (prop.isSpatial) {
                data.spatialContinuous = prop.keySpatialContinuous(keyIndex);
                data.spatialAutoBezier = prop.keySpatialAutoBezier(keyIndex);
                data.inTangent = prop.keyInSpatialTangent(keyIndex);
                data.outTangent = prop.keyOutSpatialTangent(keyIndex);
            }
            
            keyframeData.push(data);
        }
        
        // Sort by time to identify first and last keyframes
        keyframeData.sort(function(a, b) { return a.time - b.time; });
        var firstTime = keyframeData[0].time;
        var lastTime = keyframeData[keyframeData.length - 1].time;
        var currentDuration = lastTime - firstTime;
        
        // Calculate new duration
        var newDuration = Math.max(0, currentDuration + deltaSeconds);
        DEBUG_JSX.log("🎬 " + prop.name + " duration: " + (currentDuration * 1000) + "ms → " + (newDuration * 1000) + "ms");
        
        // Calculate new times - stretch proportionally
        for (var k = 0; k < keyframeData.length; k++) {
            var data = keyframeData[k];
            if (k === 0) {
                // First keyframe stays at same time
                data.newTime = data.time;
            } else {
                // Other keyframes get stretched proportionally
                var progress = (data.time - firstTime) / currentDuration;
                data.newTime = firstTime + (progress * newDuration);
            }
        }
        
        // Remove old keyframes in reverse order
        var indices = [];
        for (var k = 0; k < keyframeData.length; k++) {
            indices.push(keyframeData[k].oldIndex);
        }
        indices.sort(function(a, b) { return b - a; }); // Reverse order
        
        for (var k = 0; k < indices.length; k++) {
            prop.removeKey(indices[k]);
        }
        
        // Create new keyframes at new times
        var newSelIndices = [];
        for (var k = 0; k < keyframeData.length; k++) {
            var data = keyframeData[k];
            var newIdx = prop.addKey(data.newTime);
            
            // Restore all attributes
            prop.setValueAtKey(newIdx, data.value);

            // Apply temporal ease first to avoid flipping linear sides
            if (data.inEase !== undefined && data.outEase !== undefined) {
                try {
                    prop.setTemporalEaseAtKey(newIdx, data.inEase, data.outEase);
                } catch(e) {
                    // Some properties might not support temporal ease
                }
            }

            // Then re-assert original interpolation types
            prop.setInterpolationTypeAtKey(newIdx, data.inInterp, data.outInterp);
            
            prop.setTemporalContinuousAtKey(newIdx, data.temporalContinuous);
            prop.setTemporalAutoBezierAtKey(newIdx, data.temporalAutoBezier);
            
            if (data.spatialContinuous !== undefined) {
                prop.setSpatialContinuousAtKey(newIdx, data.spatialContinuous);
                prop.setSpatialAutoBezierAtKey(newIdx, data.spatialAutoBezier);
                // Only restore tangents if NOT auto-bezier (manual tangent control)
                if (!data.spatialAutoBezier && data.inTangent !== undefined && data.outTangent !== undefined) {
                    prop.setSpatialTangentsAtKey(newIdx, data.inTangent, data.outTangent);
                }
            }
            
            // CRITICAL: Restore keyframe color label
            if (data.label !== undefined) {
                try {
                    prop.setLabelAtKey(newIdx, data.label);
                } catch(e) {
                    // Label setting might fail on some property types
                }
            }
            
            newSelIndices.push(newIdx);
        }

        // PROTECTION: Restore the next keyframe
        if (nextKeyData !== null) {
            var keysAdded = newSelIndices.length - selectedKeys.length;
            restoreNextKeyframe(prop, nextKeyData, keysAdded);
        }

        // Restore selection
        for (var i = 1; i <= prop.numKeys; i++) {
            prop.setSelectedAtKey(i, false);
        }
        for (var k = 0; k < newSelIndices.length; k++) {
            prop.setSelectedAtKey(newSelIndices[k], true);
        }
        
        return {
            success: true,
            durationMs: newDuration * 1000
        };
        
    } catch(e) {
        DEBUG_JSX.log("🎬 stretchPropertyDuration error for " + prop.name + ": " + e.toString());
        return {
            success: false,
            durationMs: 0
        };
    }
}

// Function for cross-property detection (first keyframe per property only - same as readKeyframesSmart)
function searchPropertiesForCrossPropertyDetection(layer, propertyTimes) {
    // Search main layer properties
    function searchPropertyGroup(propGroup) {
        for (var i = 1; i <= propGroup.numProperties; i++) {
            var prop = propGroup.property(i);
            
            // Check if this property has keyframes and selected keyframes
            if (prop && prop.canVaryOverTime && prop.numKeys > 0) {
                for (var j = 1; j <= prop.numKeys; j++) {
                    if (prop.keySelected(j)) {
                        propertyTimes.push({
                            name: prop.name,
                            property: prop,
                            time: prop.keyTime(j),
                            keyIndex: j
                        });
                        break; // Only need first selected keyframe for cross-property detection (same as readKeyframesSmart)
                    }
                }
            }
            
            // Recurse into property groups
            if (prop && (prop.propertyType === PropertyType.INDEXED_GROUP || 
                       prop.propertyType === PropertyType.NAMED_GROUP)) {
                searchPropertyGroup(prop);
            }
        }
    }
    
    // Search all layer properties
    searchPropertyGroup(layer);
    
    // Also check special properties that might not be in the main layer group
    try {
        if (layer.timeRemapEnabled && layer.timeRemap && layer.timeRemap.numKeys > 0) {
            for (var j = 1; j <= layer.timeRemap.numKeys; j++) {
                if (layer.timeRemap.keySelected(j)) {
                    propertyTimes.push({
                        name: "Time Remap",
                        property: layer.timeRemap,
                        time: layer.timeRemap.keyTime(j),
                        keyIndex: j
                    });
                    break; // Only first for detection
                }
            }
        }
    } catch(e) {
        // Time remap might not be available
    }
}

// Function to search ALL selected keyframes for delay nudging
function searchAllPropertiesForDelay(layer, propertyTimes) {
    // Search main layer properties
    function searchPropertyGroup(propGroup) {
        for (var i = 1; i <= propGroup.numProperties; i++) {
            var prop = propGroup.property(i);
            
            // Check if this property has keyframes and selected keyframes
            if (prop && prop.canVaryOverTime && prop.numKeys > 0) {
                for (var j = 1; j <= prop.numKeys; j++) {
                    if (prop.keySelected(j)) {
                        propertyTimes.push({
                            name: prop.name,
                            property: prop,
                            time: prop.keyTime(j),
                            keyIndex: j
                        });
                        // Get ALL selected keyframes for delay nudging
                    }
                }
            }
            
            // Recurse into property groups
            if (prop && (prop.propertyType === PropertyType.INDEXED_GROUP || 
                       prop.propertyType === PropertyType.NAMED_GROUP)) {
                searchPropertyGroup(prop);
            }
        }
    }
    
    // Search all layer properties
    searchPropertyGroup(layer);
    
    // Also check special properties that might not be in the main layer group
    try {
        if (layer.timeRemapEnabled && layer.timeRemap && layer.timeRemap.numKeys > 0) {
            for (var j = 1; j <= layer.timeRemap.numKeys; j++) {
                if (layer.timeRemap.keySelected(j)) {
                    propertyTimes.push({
                        name: "Time Remap",
                        property: layer.timeRemap,
                        time: layer.timeRemap.keyTime(j),
                        keyIndex: j
                    });
                    // Get all selected for delay nudging
                }
            }
        }
    } catch(e) {
        // Time remap might not be available
    }
}

// Cross-property mode detection function (using same logic as readKeyframesSmart)
function checkCrossPropertyMode() {
    var comp = app.project.activeItem;
    if (!(comp && comp instanceof CompItem)) {
        return { isCrossProperty: false };
    }
    
    var selectedLayers = comp.selectedLayers;
    if (selectedLayers.length === 0) {
        return { isCrossProperty: false };
    }
    
    var propertyTimes = [];
    
    for (var layerIdx = 0; layerIdx < selectedLayers.length; layerIdx++) {
        var layer = selectedLayers[layerIdx];
        
        // Use same property search as readKeyframesSmart for detection only (first keyframe per property)
        searchPropertiesForCrossPropertyDetection(layer, propertyTimes);
    }
    
    if (propertyTimes.length === 0) {
        return { isCrossProperty: false };
    }
    
    // Group by property (same grouping logic as readKeyframesSmart)
    var propertyGroups = {};
    for (var i = 0; i < propertyTimes.length; i++) {
        var item = propertyTimes[i];
        var propName = item.name;
        if (!propertyGroups[propName]) {
            propertyGroups[propName] = [];
        }
        propertyGroups[propName].push(item);
    }
    
    var propertyNames = [];
    for (var propName in propertyGroups) {
        propertyNames.push(propName);
    }
    
    DEBUG_JSX.log("checkCrossPropertyMode: Found " + propertyNames.length + " properties: " + propertyNames.join(", "));
    
    // Only use delay mode if there are multiple properties AND they have different timing
    var isCrossProperty = false;
    
    if (propertyNames.length > 1) {
        // Check if properties have keyframes at different times (indicating delay differences)
        var firstTimes = [];
        for (var propName in propertyGroups) {
            var keyframes = propertyGroups[propName];
            // Sort keyframes by time and get the first one
            keyframes.sort(function(a, b) { return a.time - b.time; });
            firstTimes.push(keyframes[0].time);
        }
        
        // Check if all first keyframes are at the same time (within 1ms tolerance)
        var earliestTime = Math.min.apply(Math, firstTimes);
        var hasDelayDifferences = false;
        for (var i = 0; i < firstTimes.length; i++) {
            if (Math.abs(firstTimes[i] - earliestTime) > 0.001) { // > 1ms difference
                hasDelayDifferences = true;
                break;
            }
        }
        
        isCrossProperty = hasDelayDifferences;
        DEBUG_JSX.log("First times: " + firstTimes.join(", ") + " seconds");
        DEBUG_JSX.log("Earliest time: " + earliestTime + ", hasDelayDifferences: " + hasDelayDifferences);
    }
    
    var result = { isCrossProperty: isCrossProperty };
    
    // Add debug info to help troubleshoot
    if (propertyNames.length === 0) {
        DEBUG_JSX.log("No properties found with selected keyframes!");
    } else if (propertyNames.length === 1) {
        DEBUG_JSX.log("Only one property found: " + propertyNames[0] + " - using duration mode");
    } else if (!isCrossProperty) {
        DEBUG_JSX.log("Multiple properties found but all start at same time - using duration mode");
    } else {
        DEBUG_JSX.log("Multiple properties found with different start times - using delay mode");
    }
    
    return result;
}

// Global cache for original baseline to persist across multiple nudge operations
var BASELINE_CACHE = {
    originalEarliestTime: null,
    originalBaselineProperty: null,
    isInitialized: false,
    
    reset: function() {
        this.originalEarliestTime = null;
        this.originalBaselineProperty = null;
        this.isInitialized = false;
    },
    
    initialize: function(earliestTime, baselineProperty) {
        if (!this.isInitialized) {
            this.originalEarliestTime = earliestTime;
            this.originalBaselineProperty = baselineProperty;
            this.isInitialized = true;
            DEBUG_JSX.log("BC_INIT:" + Math.round(earliestTime * 1000) + "ms");
        }
        return {
            earliestTime: this.originalEarliestTime,
            baselineProperty: this.originalBaselineProperty
        };
    }
};

// Duration stretching functions for multi-property mode (50ms increments)
function stretchMultiPropertyDurationForward() {
    return stretchMultiPropertyDuration(1); // +1 for forward direction (same as delay nudging)
}

function stretchMultiPropertyDurationBackward() {
    return stretchMultiPropertyDuration(-1); // -1 for backward direction (same as delay nudging)
}

function stretchMultiPropertyDuration(direction) {
    try {
        DEBUG_JSX.log("stretchMultiPropertyDuration called with direction: " + direction);
        app.beginUndoGroup("Stretch Multi-Property Duration");
        
        var comp = app.project.activeItem;
        if (!(comp && comp instanceof CompItem)) {
            app.endUndoGroup();
            return "error|No composition selected";
        }
        
        var selectedLayers = comp.selectedLayers;
        if (selectedLayers.length === 0) {
            app.endUndoGroup();
            return "error|No layers selected";
        }
        
        var frameRate = comp.frameRate || 30;
        var movedCount = 0;
        var allProcessedProperties = []; // Store all properties for global selection restoration
        
        // Build property map upfront (same approach as delay nudging to avoid selection issues)
        var propertyMap = {};
        for (var layerIdx = 0; layerIdx < selectedLayers.length; layerIdx++) {
            var layer = selectedLayers[layerIdx];
            var selectedProps = layer.selectedProperties;
            
            for (var j = 0; j < selectedProps.length; j++) {
                var prop = selectedProps[j];
                
                // More robust property validation
                if (!prop || prop.propertyValueType === PropertyValueType.NO_VALUE) continue;
                if (!prop.canVaryOverTime || prop.numKeys === 0) continue;
                
                var selKeys = prop.selectedKeys;
                if (!selKeys || selKeys.length < 2) continue; // Need at least 2 keyframes to stretch duration
                
                // Store property with its selected keyframes (same as delay nudging)
                var propName = prop.name + "_" + layerIdx + "_" + j; // Make unique key
                propertyMap[propName] = {
                    property: prop,
                    selectedKeys: selKeys
                };
            }
        }
        
        // Process all properties from the map using smart snapping for each property
        for (var propName in propertyMap) {
            var propData = propertyMap[propName];
            var prop = propData.property;
            var selKeys = propData.selectedKeys;
            
            // Calculate current duration for this property
            var times = [];
            for (var k = 0; k < selKeys.length; k++) {
                var keyIndex = selKeys[k];
                try {
                    // Validate keyIndex is within bounds
                    if (keyIndex > 0 && keyIndex <= prop.numKeys) {
                        times.push(prop.keyTime(keyIndex));
                    }
                } catch(keyError) {
                    DEBUG_JSX.log("Skipping invalid keyframe at index " + keyIndex + " for property " + prop.name + ": " + keyError.toString());
                }
            }
            
            // Skip this property if we don't have at least 2 valid keyframes
            if (times.length < 2) continue;
            times.sort(function(a, b) { return a - b; });
            var currentDurationMs = roundMs(times[times.length - 1] - times[0]);
            
            // Apply smart snapping to find target duration
            var targetDurationMs = calculateDelaySnap(currentDurationMs, direction);
            var deltaMs = targetDurationMs - currentDurationMs;
            var deltaSeconds = deltaMs / 1000;
            
            DEBUG_JSX.log("Property " + prop.name + ": current=" + currentDurationMs + "ms, target=" + targetDurationMs + "ms, delta=" + deltaMs + "ms");
            
            // Skip if no change needed
            if (Math.abs(deltaMs) < 1) {
                continue;
            }
            
            // Use same remove/recreate approach as delay nudging for consistency
            var keyframesToMove = [];
            
            // Collect keyframe data
            for (var k = 0; k < selKeys.length; k++) {
                    var keyIndex = selKeys[k];
                    var keyData = {
                        oldIndex: keyIndex,
                        time: prop.keyTime(keyIndex),
                        value: prop.keyValue(keyIndex),
                        inInterp: prop.keyInInterpolationType(keyIndex),
                        outInterp: prop.keyOutInterpolationType(keyIndex),
                        temporalContinuous: prop.keyTemporalContinuous(keyIndex),
                        temporalAutoBezier: prop.keyTemporalAutoBezier(keyIndex),
                        // CRITICAL: Preserve keyframe color labels
                        label: prop.keyLabel(keyIndex)
                    };
                    
                    // Only collect temporal ease if bezier interpolation
                    if (keyData.inInterp === KeyframeInterpolationType.BEZIER || keyData.outInterp === KeyframeInterpolationType.BEZIER) {
                        keyData.inEase = prop.keyInTemporalEase(keyIndex);
                        keyData.outEase = prop.keyOutTemporalEase(keyIndex);
                    }
                    
                    // Handle spatial properties if applicable
                    if (prop.isSpatial) {
                        keyData.spatialContinuous = prop.keySpatialContinuous(keyIndex);
                        keyData.spatialAutoBezier = prop.keySpatialAutoBezier(keyIndex);
                        keyData.inTangent = prop.keyInSpatialTangent(keyIndex);
                        keyData.outTangent = prop.keyOutSpatialTangent(keyIndex);
                    }
                    
                    keyframesToMove.push(keyData);
                }
                
                // Sort by time to identify first and last keyframes
                keyframesToMove.sort(function(a, b) { return a.time - b.time; });
                var firstTime = keyframesToMove[0].time;
                var lastTime = keyframesToMove[keyframesToMove.length - 1].time;
                
                // Calculate new times - stretch duration by deltaMs
                for (var k = 0; k < keyframesToMove.length; k++) {
                    var keyData = keyframesToMove[k];
                    if (k === 0) {
                        // First keyframe stays at same time
                        keyData.newTime = keyData.time;
                    } else {
                        // Other keyframes get stretched proportionally
                        var progress = (keyData.time - firstTime) / (lastTime - firstTime);
                        var newDuration = (lastTime - firstTime) + deltaSeconds;
                        if (newDuration < 0) newDuration = 0; // Don't allow negative duration
                        keyData.newTime = firstTime + (progress * newDuration);
                    }
                }
                
                // Remove old keyframes in reverse order
                var indices = [];
                for (var k = 0; k < keyframesToMove.length; k++) {
                    indices.push(keyframesToMove[k].oldIndex);
                }
                indices.sort(function(a, b) { return b - a; }); // Reverse order
                
                for (var k = 0; k < indices.length; k++) {
                    prop.removeKey(indices[k]);
                }
                
                // Create new keyframes at new times
                var newSelIndices = [];
                for (var k = 0; k < keyframesToMove.length; k++) {
                    var keyData = keyframesToMove[k];
                    var newIdx = prop.addKey(keyData.newTime);
                    
                    // Restore all attributes
                    prop.setValueAtKey(newIdx, keyData.value);

                    // Apply temporal ease only for sides originally Bezier
                    restoreTemporalEaseSafely(prop, newIdx, keyData.inInterp, keyData.outInterp, keyData.inEase, keyData.outEase);

                    // Then re-assert original interpolation types
                    prop.setInterpolationTypeAtKey(newIdx, keyData.inInterp, keyData.outInterp);
                    
                    restoreTemporalFlagsSafely(prop, newIdx, keyData.inInterp, keyData.outInterp, keyData.temporalContinuous, keyData.temporalAutoBezier);
                    
                    if (keyData.spatialContinuous !== undefined) {
                        prop.setSpatialContinuousAtKey(newIdx, keyData.spatialContinuous);
                        prop.setSpatialAutoBezierAtKey(newIdx, keyData.spatialAutoBezier);
                        // Only restore tangents if NOT auto-bezier (manual tangent control)
                        if (!keyData.spatialAutoBezier && keyData.inTangent !== undefined && keyData.outTangent !== undefined) {
                            prop.setSpatialTangentsAtKey(newIdx, keyData.inTangent, keyData.outTangent);
                        }
                    }
                    
                    // CRITICAL: Restore keyframe color label
                    if (keyData.label !== undefined) {
                        try {
                            prop.setLabelAtKey(newIdx, keyData.label);
                        } catch(e) {
                            // Label setting might fail on some property types
                        }
                    }
                    
                    // IMMEDIATE SELECTION: Select the keyframe right after creation (like stagger does)
                    try {
                        prop.setSelectedAtKey(newIdx, true);
                        DEBUG_JSX.log("  Immediately selected multi-property duration keyframe " + newIdx);
                    } catch(e) {
                        DEBUG_JSX.log("  Failed to immediately select multi-property duration keyframe " + newIdx + ": " + e.toString());
                    }
                    
                    newSelIndices.push(newIdx);
                    movedCount++;
                }
                
            // Store property data for global selection restoration (same as delay nudging)
            allProcessedProperties.push({
                propObject: prop,
                newSelIndices: newSelIndices
            });
        }
        
        // BACKUP: Global selection restoration phase (immediate selection should have already worked)
        // NOTE: We now do immediate selection during keyframe creation, so this is just a backup
        DEBUG_JSX.log("BACKUP: Global selection restoration (immediate selection should have already worked)");
        try {
            for (var i = 0; i < allProcessedProperties.length; i++) {
                var propData = allProcessedProperties[i];
                if (propData.newSelIndices) {
                    var prop = propData.propObject;
                    for (var k = 0; k < propData.newSelIndices.length; k++) {
                        prop.setSelectedAtKey(propData.newSelIndices[k], true);
                    }
                }
            }
        } catch(selectionError) {
            // Don't fail the entire operation if selection fails
            DEBUG_JSX.log("BACKUP Selection restoration error: " + selectionError.toString());
        }
        
        app.endUndoGroup();
        
        if (movedCount === 0) {
            return "error|No properties were processed";
        }
        
        // Return generic success for cross-property duration stretching
        return "success|50|1|1"; // Return |1 to indicate cross-property mode for client detection
        
    } catch(e) {
        app.endUndoGroup();
        return "error|Failed to stretch multi-property duration: " + e.toString();
    }
}

// Helper function to find properties by name in a layer
function findPropertyByName(layer, targetName) {
    function searchGroup(group) {
        for (var i = 1; i <= group.numProperties; i++) {
            var prop = group.property(i);
            if (prop.name === targetName && prop.canVaryOverTime) {
                return prop;
            }
            if (prop.propertyType === PropertyType.INDEXED_GROUP || 
                prop.propertyType === PropertyType.NAMED_GROUP) {
                var found = searchGroup(prop);
                if (found) return found;
            }
        }
        return null;
    }
    return searchGroup(layer);
}

// Delay nudging functions using same 50ms snapping logic as duration
function nudgeDelayForward() {
    return nudgeDelay(1); // +1 for forward direction
}

function nudgeDelayBackward() {
    return nudgeDelay(-1); // -1 for backward direction
}

function nudgeDelay(direction) {
    try {
        DEBUG_JSX.log("🔥 SHIFT-CLICK BASELINE DELAY NUDGE: direction " + direction);
        DEBUG_JSX.log("D" + (direction > 0 ? "+" : "-"));
        
        // Initialize cumulative tracking if undefined
        if (typeof TIMELINE_MODE_CUMULATIVE === 'undefined') {
            TIMELINE_MODE_CUMULATIVE = 0;
        }
        
        app.beginUndoGroup("Nudge Delay");
        
        var comp = app.project.activeItem;
        if (!(comp && comp instanceof CompItem)) {
            app.endUndoGroup();
            return "error|No composition selected";
        }
        
        // Build selection identifiers
        var currentSelectionStructure = "";
        var selectedLayers = comp.selectedLayers;
        
        // Count total selected keyframes
        var totalKeyframeCount = 0;
        var selectionSignature = "";
        
        for (var i = 0; i < selectedLayers.length; i++) {
            var layer = selectedLayers[i];
            currentSelectionStructure += "L" + layer.index + ":";
            selectionSignature += "L" + layer.index + ":";
            
            var selectedProps = layer.selectedProperties;
            for (var j = 0; j < selectedProps.length; j++) {
                var prop = selectedProps[j];
                if (prop && prop.canVaryOverTime && prop.selectedKeys && prop.selectedKeys.length > 0) {
                    // Structure ID (layer + property name)
                    currentSelectionStructure += prop.name + ",";
                    
                    // Count keyframes and track property
                    var selectedKeys = prop.selectedKeys;
                    totalKeyframeCount += selectedKeys.length;
                    selectionSignature += prop.name + "(" + selectedKeys.length + "),";
                }
            }
        }
        
        // Simple heuristic: if the keyframe count or selection signature changes, 
        // it's likely a new selection (not perfect but better than tracking indices)
        var selectionChanged = false;
        
        if (typeof LAST_SELECTION_SIGNATURE === 'undefined') {
            LAST_SELECTION_SIGNATURE = selectionSignature;
            LAST_KEYFRAME_COUNT = totalKeyframeCount;
        } else {
            // Check if selection meaningfully changed
            if (selectionSignature !== LAST_SELECTION_SIGNATURE || 
                totalKeyframeCount !== LAST_KEYFRAME_COUNT) {
                selectionChanged = true;
                DEBUG_JSX.log("SEL_RESET:SIG");
            }
        }
        
        // Reset if selection changed
        if (selectionChanged) {
            TIMELINE_MODE_CUMULATIVE = 0;
            IS_IN_FORCED_TIMELINE_MODE = false;
            BASELINE_CACHE.reset();
            LAST_SELECTION_SIGNATURE = selectionSignature;
            LAST_KEYFRAME_COUNT = totalKeyframeCount;
        }
        
        // Update tracking variables
        LAST_SELECTION_STRUCTURE = currentSelectionStructure;
        
        // Debug current state
        DEBUG_JSX.log("FTL_STATE:" + IS_IN_FORCED_TIMELINE_MODE);
        
        // Early safety check for frame rate
        var frameRate = comp.frameRate;
        if (!frameRate || frameRate <= 0 || isNaN(frameRate)) {
            app.endUndoGroup();
            return "error|Invalid frame rate: " + frameRate;
        }
        
        var selectedLayers = comp.selectedLayers;
        if (selectedLayers.length === 0) {
            // GLOBAL DELAY: When nothing is selected, nudge everything after playhead
            app.endUndoGroup();
            DEBUG_JSX.log("GLOBAL");
            return nudgeFromPlayhead(direction, 3); // Use 3 frames as default
        }
        
        var propertyTimes = [];
        
        // Collect all selected keyframes from all properties (using same approach as duration stretching)
        var propertyMap = {};
        try {
            for (var layerIdx = 0; layerIdx < selectedLayers.length; layerIdx++) {
                var layer = selectedLayers[layerIdx];
                var selectedProps = layer.selectedProperties;
                
                for (var j = 0; j < selectedProps.length; j++) {
                    var prop = selectedProps[j];
                    
                    // More robust property validation like duration functions
                    if (!prop || prop.propertyValueType === PropertyValueType.NO_VALUE) continue;
                    if (!prop.canVaryOverTime || prop.numKeys === 0) continue;
                    
                    var selKeys = prop.selectedKeys;
                    if (!selKeys || selKeys.length === 0) continue;
                    
                    // Store property with its selected keyframes (make property name unique per layer)
                    // Use full property path to avoid collisions between effect parameters
                    var propName = layer.name + ":" + getFullPropertyPath(prop);
                    if (!propertyMap[propName]) {
                        propertyMap[propName] = {
                            property: prop,
                            layer: layer,
                            keyframes: [],
                            selectedKeys: []
                        };
                    }
                    
                    // Add all selected keyframes for this property
                    // Enhanced validation for effect parameters and complex property types
                    for (var k = 0; k < selKeys.length; k++) {
                        var keyIndex = selKeys[k];
                        try {
                            // Validate keyIndex is within bounds
                            if (keyIndex > 0 && keyIndex <= prop.numKeys) {
                                // Additional validation for effect parameters
                                var keyTime = prop.keyTime(keyIndex);
                                var keyValue = prop.keyValue(keyIndex);
                                
                                // Ensure we can actually access the keyframe data
                                if (keyTime !== undefined && keyValue !== undefined) {
                                    propertyMap[propName].keyframes.push({
                                        index: keyIndex,
                                        time: keyTime
                                    });
                                    propertyMap[propName].selectedKeys.push(keyIndex);
                                    
                                    DEBUG_JSX.log("Collected keyframe " + keyIndex + " from " + getFullPropertyPath(prop) + " at " + keyTime + "s");
                                }
                            }
                        } catch(keyError) {
                            // Enhanced error logging for effect parameter issues
                            DEBUG_JSX.log("Failed to collect keyframe " + keyIndex + " from " + getFullPropertyPath(prop) + ": " + keyError.toString());
                        }
                    }
                }
            }
        } catch(searchError) {
            app.endUndoGroup();
            return "error|Error searching properties: " + searchError.toString();
        }
        
        var propertyNames = [];
        for (var propName in propertyMap) {
            propertyNames.push(propName);
        }
        
        DEBUG_JSX.log("P:" + propertyNames.length);
        
        if (propertyNames.length === 0) {
            // No keyframes selected - try layer startTime nudging
            DEBUG_JSX.log("LAYER_MODE");
            return nudgeLayerStartTimes(selectedLayers, direction, frameRate, comp);
        }
        
        // Allow single properties for timeline position nudging when all keyframes have same baseline
        if (propertyNames.length === 0) {
            app.endUndoGroup();
            return "error|No selected keyframes found";
        }
        
        // DEBUG: Return debug info to see what's being processed
        var debugInfo = [];
        
        var propertyDelays = [];
        var scanEarliestTime = Number.MAX_VALUE;
        var scanBaselineProperty = null;
        
        // Scan current timeline state to detect baseline (but may not use it if cache exists)
        for (var propName in propertyMap) {
            var propData = propertyMap[propName];
            var keyframes = propData.keyframes;
            keyframes.sort(function(a, b) { return a.time - b.time; });
            var firstTime = keyframes[0].time;
            
            if (firstTime < scanEarliestTime) {
                scanEarliestTime = firstTime;
                scanBaselineProperty = propName;
            }
        }
        
        // Only reset baseline cache if we're not in forced timeline mode
        // This preserves the original baseline for cumulative tracking
        if (!IS_IN_FORCED_TIMELINE_MODE) {
            BASELINE_CACHE.reset();
        }
        var baselineData = BASELINE_CACHE.initialize(scanEarliestTime, scanBaselineProperty);
        var originalEarliestTime = baselineData.earliestTime;
        var originalBaselineProperty = baselineData.baselineProperty;
        
        // Second pass: build property delays with original baseline tracking
        for (var propName in propertyMap) {
            var propData = propertyMap[propName];
            var keyframes = propData.keyframes;

            // Sort by time to get first keyframe
            keyframes.sort(function(a, b) { return a.time - b.time; });
            var firstTime = keyframes[0].time;

            // Track if this is a baseline property (ANY property at the earliest time)
            var isOriginalBaseline = (Math.abs(firstTime - originalEarliestTime) < 0.001); // Use small tolerance for time comparison

            propertyDelays.push({
                property: propName,
                propObject: propData.property,
                keyframes: keyframes,
                selectedKeys: propData.selectedKeys,
                currentDelay: firstTime,
                timeOffset: 0,
                isOriginalBaseline: isOriginalBaseline
            });
        }
        
        // Calculate delays relative to LOCKED ORIGINAL earliest time (baseline = 0ms)
        try {
            for (var i = 0; i < propertyDelays.length; i++) {
                var timeDiff = propertyDelays[i].currentDelay - originalEarliestTime;
                var delayMs = timeDiff * 1000;
                
                if (isNaN(delayMs) || !isFinite(delayMs)) {
                    throw new Error("Invalid delay calculation for " + propertyDelays[i].property + ": timeDiff=" + timeDiff + ", delayMs=" + delayMs);
                }
                
                propertyDelays[i].relativeDelay = delayMs;
            }
        } catch(calcError) {
            app.endUndoGroup();
            return "error|Delay calculation error: " + calcError.toString();
        }
        
        // Check if all delays are the same (unified) or different (multiple)
        var firstDelay = propertyDelays[0].relativeDelay;
        var allSameDelay = true;
        DEBUG_JSX.log("FD:" + firstDelay + "ms");
        
        // Special handling for single keyframe
        var isSingleKeyframe = false;
        if (propertyNames.length === 1) {
            var singlePropData = propertyDelays[0];
            var keyframes = singlePropData.keyframes;
            isSingleKeyframe = (keyframes.length === 1);
            
            if (keyframes.length > 1) {
                // Single property mode: check if ALL selected keyframes within the property have the same time
                var firstKeyTime = keyframes[0].time;
                for (var k = 1; k < keyframes.length; k++) {
                    if (Math.abs(keyframes[k].time - firstKeyTime) > 0.001) { // 1ms tolerance in seconds
                        allSameDelay = false;
                        break;
                    }
                }
                DEBUG_JSX.log("SP:" + keyframes.length + "k,same:" + allSameDelay);
            }
        } else {
            // Multi-property mode: check if all properties have the same delay
            for (var i = 1; i < propertyDelays.length; i++) {
                DEBUG_JSX.log("P" + i + ":" + propertyDelays[i].relativeDelay + "ms");
                if (Math.abs(propertyDelays[i].relativeDelay - firstDelay) > 1) { // 1ms tolerance
                    allSameDelay = false;
                    break;
                }
            }
        }
        
        DEBUG_JSX.log("ASD:" + allSameDelay);
        
        var targetDelayMs;
        
        try {
            // NEW SPECIAL CASE: Timeline position nudging when ALL **FIRST** keyframes are at the exact same time
            // This should only check the FIRST keyframe of each property (the baseline), not all keyframes
            var allFirstKeyframesAtSameTime = true;
            var firstKeyframeTime = null;
            var totalPropertiesCount = 0;
            
            for (var propName in propertyMap) {
                var keyframes = propertyMap[propName].keyframes;
                
                if (keyframes.length > 0) {
                    totalPropertiesCount++;
                    // Only check the FIRST keyframe of each property
                    var firstKeyTime = keyframes[0].time;
                    
                    if (firstKeyframeTime === null) {
                        firstKeyframeTime = firstKeyTime;
                    } else if (Math.abs(firstKeyTime - firstKeyframeTime) > 0.001) { // 1ms tolerance in seconds
                        allFirstKeyframesAtSameTime = false;
                        break;
                    }
                }
            }
            
            DEBUG_JSX.log("TL:" + allFirstKeyframesAtSameTime + ",P:" + totalPropertiesCount);
            
            // Force timeline mode when properties are at baseline (0ms delay) - works for single OR multiple properties
            // For single properties, force timeline mode regardless of allSameDelay if at baseline
            // For multiple properties, require allSameDelay
            // ALSO force timeline for single keyframe to use cumulative tracking
            // BUT if we have multiple properties with different delays, use baseline mode instead
            
            // Check if we should exit forced timeline mode due to different delays
            if (propertyDelays.length >= 2 && !allSameDelay) {
                // Multiple properties with different delays - use baseline mode
                IS_IN_FORCED_TIMELINE_MODE = false;
                DEBUG_JSX.log("EXIT_FTL:DIFF_DELAYS");
            }
            
            var shouldForceTimeline = IS_IN_FORCED_TIMELINE_MODE ||
                                    isSingleKeyframe || 
                                    (propertyDelays.length === 1 && Math.abs(propertyDelays[0].relativeDelay) < 1) ||
                                    (propertyDelays.length >= 2 && allSameDelay && Math.abs(propertyDelays[0].relativeDelay) < 1);
            if (shouldForceTimeline) {
                IS_IN_FORCED_TIMELINE_MODE = true;
                DEBUG_JSX.log("FORCE_TL");
                try {
                    // Initialize cumulative tracking for timeline mode
                    if (typeof TIMELINE_MODE_CUMULATIVE === 'undefined') {
                        TIMELINE_MODE_CUMULATIVE = 0;
                    }
                    
                    // Don't reset cumulative on selection change - it's causing issues
                    
                    // Use custom increment if set, otherwise default to 50ms
                    var incrementAmount = CUSTOM_INCREMENT_MS > 0 ? CUSTOM_INCREMENT_MS : 50;
                    
                    // Track cumulative offset
                    TIMELINE_MODE_CUMULATIVE += (direction > 0 ? incrementAmount : -incrementAmount);
                    DEBUG_JSX.log("CUM:" + TIMELINE_MODE_CUMULATIVE + "ms");
                    
                    // For display and movement: the cumulative value represents total offset from start
                    // But we need to calculate the actual movement from the current position
                    var nudgeMs = (direction > 0 ? incrementAmount : -incrementAmount);
                    var nudgeSeconds = nudgeMs / 1000.0;
                    var newTimelineTime = Math.max(0, scanEarliestTime + nudgeSeconds);
                    DEBUG_JSX.log("MOVE:" + Math.round(scanEarliestTime * 1000) + "→" + Math.round(newTimelineTime * 1000) + "ms");
                    
                    // Move all keyframes using the same approach as baseline mode
                    var timelinePropertyData = [];
                    for (var i = 0; i < propertyDelays.length; i++) {
                        var propData = propertyDelays[i];
                        var prop = propData.propObject;
                        var keyframesToMove = [];

                        // PROTECTION: Capture the next keyframe to prevent AE from modifying it
                        var nextKeyData = captureNextKeyframe(prop, propData.selectedKeys);

                        // Calculate the timeline offset to apply to all keyframes
                        var timelineOffset = newTimelineTime - scanEarliestTime;

                        // Collect keyframe data - maintain relative spacing
                        for (var k = 0; k < propData.keyframes.length; k++) {
                            var keyIndex = propData.keyframes[k].index;
                            var oldTime = propData.keyframes[k].time;
                            var newTime = oldTime + timelineOffset; // Maintain relative spacing
                            
                            var keyData = {
                                oldIndex: keyIndex,
                                time: oldTime,
                                newTime: Math.max(0, newTime), // Clamp to 0
                                value: prop.keyValue(keyIndex),
                                inInterp: prop.keyInInterpolationType(keyIndex),
                                outInterp: prop.keyOutInterpolationType(keyIndex),
                                temporalContinuous: prop.keyTemporalContinuous(keyIndex),
                                temporalAutoBezier: prop.keyTemporalAutoBezier(keyIndex),
                                // CRITICAL: Preserve keyframe color labels
                                label: prop.keyLabel(keyIndex)
                            };
                            
                            // CRITICAL FIX: Preserve temporal ease for bezier keyframes (same as timeline mode)
                            if (keyData.inInterp === KeyframeInterpolationType.BEZIER || 
                                keyData.outInterp === KeyframeInterpolationType.BEZIER) {
                                try {
                                    keyData.inEase = prop.keyInTemporalEase(keyIndex);
                                    keyData.outEase = prop.keyOutTemporalEase(keyIndex);
                                } catch(e) {
                                    // Temporal ease might not be available for some properties
                                }
                            }
                            
                            // CRITICAL FIX: Preserve spatial properties for position keyframes (same as timeline mode)
                            if (prop.isSpatial) {
                                try {
                                    keyData.spatialContinuous = prop.keySpatialContinuous(keyIndex);
                                    keyData.spatialAutoBezier = prop.keySpatialAutoBezier(keyIndex);
                                    keyData.inTangent = prop.keyInSpatialTangent(keyIndex);
                                    keyData.outTangent = prop.keyOutSpatialTangent(keyIndex);
                                } catch(e) {
                                    // Spatial properties might not be available
                                }
                            }
                            
                            // Handle spatial properties if applicable (Position, etc.)
                            if (prop.isSpatial) {
                                keyData.spatialContinuous = prop.keySpatialContinuous(keyIndex);
                                keyData.spatialAutoBezier = prop.keySpatialAutoBezier(keyIndex);
                                keyData.inTangent = prop.keyInSpatialTangent(keyIndex);
                                keyData.outTangent = prop.keyOutSpatialTangent(keyIndex);
                            }
                            
                            keyframesToMove.push(keyData);
                        }
                        
                        // Remove old keyframes (in reverse order to maintain indices)
                        keyframesToMove.sort(function(a, b) { return b.oldIndex - a.oldIndex; });
                        for (var k = 0; k < keyframesToMove.length; k++) {
                            prop.removeKey(keyframesToMove[k].oldIndex);
                        }
                        
                        // Add new keyframes at timeline position and collect new indices
                        var newSelIndices = [];
                        // Sort keyframes by time to ensure they're added in chronological order
                        keyframesToMove.sort(function(a, b) { return a.newTime - b.newTime; });
                        
                        for (var k = 0; k < keyframesToMove.length; k++) {
                            var data = keyframesToMove[k];
                            var newIdx = prop.addKey(data.newTime);
                            prop.setValueAtKey(newIdx, data.value);

                            // Apply temporal ease first to avoid flipping linear sides
                            if (data.inEase !== undefined && data.outEase !== undefined) {
                                try {
                                    prop.setTemporalEaseAtKey(newIdx, data.inEase, data.outEase);
                                } catch(e) {
                                    // Some properties might not support temporal ease
                                }
                            }

                            // Then re-assert original interpolation types
                            prop.setInterpolationTypeAtKey(newIdx, data.inInterp, data.outInterp);
                            
                            prop.setTemporalContinuousAtKey(newIdx, data.temporalContinuous);
                            prop.setTemporalAutoBezierAtKey(newIdx, data.temporalAutoBezier);
                            
                            // Apply spatial properties if they exist (Position, etc.)
                            if (data.spatialContinuous !== undefined) {
                                prop.setSpatialContinuousAtKey(newIdx, data.spatialContinuous);
                                prop.setSpatialAutoBezierAtKey(newIdx, data.spatialAutoBezier);
                                // Only restore tangents if NOT auto-bezier (manual tangent control)
                                if (!data.spatialAutoBezier && data.inTangent !== undefined && data.outTangent !== undefined) {
                                    prop.setSpatialTangentsAtKey(newIdx, data.inTangent, data.outTangent);
                                }
                            }
                            
                            // CRITICAL: Restore keyframe color label
                            if (data.label !== undefined) {
                                try {
                                    prop.setLabelAtKey(newIdx, data.label);
                                } catch(e) {
                                    // Label setting might fail on some property types
                                }
                            }
                            
                            newSelIndices.push(newIdx);
                            debugInfo.push("FORCED: Added keyframe at " + (data.newTime * 1000) + "ms, got index " + newIdx);
                        }

                        // PROTECTION: Restore the next keyframe
                        if (nextKeyData !== null) {
                            var keysAdded = newSelIndices.length - keyframesToMove.length;
                            restoreNextKeyframe(prop, nextKeyData, keysAdded);
                        }

                        // Store for later selection
                        timelinePropertyData.push({
                            property: prop,
                            newSelIndices: newSelIndices,
                            propName: propData.property
                        });
                    }
                    
                    // PERFORMANCE OPTIMIZATION: Skip redundant selection cycle here
                    // Selection will be handled once at the end after marker processing
                    // This eliminates double deselect/select operations that slow down large keyframe sets
                    DEBUG_JSX.log("PERF: Skipping first selection cycle - will restore after marker sync");
                    debugInfo.push("PERF: Optimized selection - skipping first cycle");
                    
                    var newTimelinePositionMs = newTimelineTime * 1000;
                    var newTimelinePositionFrames = Math.round(newTimelineTime * frameRate);
                    
                    // COMPOSITION MARKER SYNCING FOR FORCED TIMELINE MODE
                    try {
                        DEBUG_JSX.log("🎬 MARKER SYNC: Starting forced timeline marker sync");
                        debugInfo.push("MARKER SYNC: Starting forced timeline marker sync");
                        
                        // Safety check: ensure comp and markerProperty exist
                        if (!comp || !comp.markerProperty) {
                            DEBUG_JSX.log("No composition or marker property available");
                            debugInfo.push("MARKER SYNC: No comp or marker property");
                        } else {
                            DEBUG_JSX.log("Composition has " + comp.markerProperty.numKeys + " markers");
                            debugInfo.push("MARKER SYNC: Found " + comp.markerProperty.numKeys + " markers");
                            
                            // Additional diagnostic: check if there are layer markers instead
                            DEBUG_JSX.log("DIAGNOSTIC: Checking for layer markers on selected layers");
                            var selectedLayers = comp.selectedLayers;
                            for (var layerIdx = 0; layerIdx < selectedLayers.length; layerIdx++) {
                                var layer = selectedLayers[layerIdx];
                                if (layer.marker && layer.marker.numKeys > 0) {
                                    DEBUG_JSX.log("DIAGNOSTIC: Layer '" + layer.name + "' has " + layer.marker.numKeys + " markers");
                                    for (var m = 1; m <= layer.marker.numKeys; m++) {
                                        var markerTime = layer.marker.keyTime(m);
                                        var markerValue = layer.marker.keyValue(m);
                                        var markerComment = markerValue.comment || "";
                                        DEBUG_JSX.log("DIAGNOSTIC: Layer marker " + m + " at " + markerTime + "s: '" + markerComment + "'");
                                    }
                                }
                            }
                            
                            // Check composition properties for other marker types
                            DEBUG_JSX.log("DIAGNOSTIC: Composition properties count: " + comp.numProperties);
                            for (var i = 1; i <= comp.numProperties; i++) {
                                try {
                                    var prop = comp.property(i);
                                    DEBUG_JSX.log("DIAGNOSTIC: Comp property " + i + ": " + prop.name + " (numKeys: " + (prop.numKeys || 0) + ")");
                                } catch(e) {
                                    DEBUG_JSX.log("DIAGNOSTIC: Error checking comp property " + i + ": " + e.toString());
                                }
                            }
                            
                            var markersToMove = [];
                            
                            // Check for LAYER MARKERS instead of composition markers
                            // Since we're moving keyframes on specific layers, check those layers for markers
                            
                            // COLLECT ALL SELECTED KEYFRAME TIMES and find the range (first to last)
                            var allSelectedKeyframeTimes = [];
                            for (var propName in propertyMap) {
                                var propData = propertyMap[propName];
                                var keyframes = propData.keyframes;
                                for (var k = 0; k < keyframes.length; k++) {
                                    var keyTime = keyframes[k].time;
                                    // Check if this time is already in our array (avoid duplicates)
                                    var timeExists = false;
                                    for (var t = 0; t < allSelectedKeyframeTimes.length; t++) {
                                        if (Math.abs(allSelectedKeyframeTimes[t] - keyTime) < 0.001) {
                                            timeExists = true;
                                            break;
                                        }
                                    }
                                    if (!timeExists) {
                                        allSelectedKeyframeTimes.push(keyTime);
                                    }
                                }
                            }
                            
                            // Sort keyframe times and find the range
                            allSelectedKeyframeTimes.sort(function(a, b) { return a - b; });
                            var firstKeyframeTime = allSelectedKeyframeTimes[0];
                            var lastKeyframeTime = allSelectedKeyframeTimes[allSelectedKeyframeTimes.length - 1];
                            
                            DEBUG_JSX.log("Keyframe range for marker sync: " + firstKeyframeTime + "s to " + lastKeyframeTime + "s (" + allSelectedKeyframeTimes.length + " unique times)");
                            
                            var selectedLayers = comp.selectedLayers;
                            for (var layerIdx = 0; layerIdx < selectedLayers.length; layerIdx++) {
                                var layer = selectedLayers[layerIdx];
                                
                                if (layer.marker && layer.marker.numKeys > 0) {
                                    DEBUG_JSX.log("Checking layer '" + layer.name + "' with " + layer.marker.numKeys + " markers");
                                    
                                    for (var m = 1; m <= layer.marker.numKeys; m++) {
                                        try {
                                            var markerTime = layer.marker.keyTime(m);
                                            
                                            DEBUG_JSX.log("Checking layer marker " + m + " at time " + markerTime + "s");
                                            
                                            // Check if marker is within the keyframe range (between first and last keyframe)
                                            var markerInRange = (markerTime >= firstKeyframeTime && markerTime <= lastKeyframeTime);
                                            
                                            if (markerInRange) {
                                                var markerValue = layer.marker.keyValue(m);
                                                var markerComment = markerValue.comment || "";
                                                
                                                DEBUG_JSX.log("Found layer marker '" + markerComment + "' within keyframe range " + markerTime + "s (range: " + firstKeyframeTime + "s to " + lastKeyframeTime + "s) on layer " + layer.name);
                                                debugInfo.push("MARKER SYNC: Found layer marker '" + markerComment + "' in range " + markerTime + "s");
                                                
                                                // For timeline mode, all markers move by the same amount (timeline offset)
                                                var timelineOffset = newTimelineTime - originalEarliestTime;
                                                var newMarkerTime = Math.max(0, markerTime + timelineOffset);
                                                
                                                markersToMove.push({
                                                    markerIndex: m,
                                                    oldTime: markerTime,
                                                    newTime: newMarkerTime,
                                                    markerValue: markerValue,
                                                    comment: markerComment,
                                                    layer: layer, // Include layer reference for layer markers
                                                    timelineOffset: timelineOffset // For debugging
                                                });
                                            }
                                        } catch(markerCheckError) {
                                            DEBUG_JSX.log("Error checking layer marker " + m + ": " + markerCheckError.toString());
                                        }
                                    }
                                }
                            }
                            
                            // Move synchronized layer markers
                            if (markersToMove.length > 0) {
                                DEBUG_JSX.log("Moving " + markersToMove.length + " layer markers in forced timeline mode");
                                debugInfo.push("MARKER SYNC: Moving " + markersToMove.length + " layer markers");
                                
                                markersToMove.sort(function(a, b) { return b.markerIndex - a.markerIndex; });
                                
                                for (var m = 0; m < markersToMove.length; m++) {
                                    var markerInfo = markersToMove[m];
                                    
                                    try {
                                        // Use layer.marker instead of comp.markerProperty
                                        markerInfo.layer.marker.removeKey(markerInfo.markerIndex);
                                        var newMarkerIndex = markerInfo.layer.marker.addKey(markerInfo.newTime);
                                        markerInfo.layer.marker.setValueAtKey(newMarkerIndex, markerInfo.markerValue);
                                        
                                        DEBUG_JSX.log("Moved layer marker '" + markerInfo.comment + "' from " + Math.round(markerInfo.oldTime * 1000) + "ms to " + Math.round(markerInfo.newTime * 1000) + "ms on layer " + markerInfo.layer.name);
                                        debugInfo.push("Synced layer marker '" + markerInfo.comment + "' with timeline");
                                        
                                    } catch(markerMoveError) {
                                        DEBUG_JSX.log("Failed to move layer marker in forced timeline: " + markerMoveError.toString());
                                        debugInfo.push("MARKER SYNC: Failed to move layer marker " + markerInfo.comment + ": " + markerMoveError.toString());
                                    }
                                }
                            } else {
                                DEBUG_JSX.log("No layer markers found at original timeline position " + originalEarliestTime + "s");
                                debugInfo.push("MARKER SYNC: No layer markers at position " + originalEarliestTime + "s");
                            }
                        }
                        
                    } catch(markerSyncError) {
                        DEBUG_JSX.log("Marker sync error in forced timeline: " + markerSyncError.toString());
                        debugInfo.push("Marker sync error: " + markerSyncError.toString());
                    }
                    
                    // Store keyframe selection info before ending undo group
                    var keyframeSelectionInfo = [];
                    for (var i = 0; i < timelinePropertyData.length; i++) {
                        var propInfo = timelinePropertyData[i];
                        keyframeSelectionInfo.push({
                            property: propInfo.property,
                            newSelIndices: propInfo.newSelIndices
                        });
                    }
                    
                    app.endUndoGroup();
                    
                    // COMPOSITION MARKER SYNCING AFTER UNDO GROUP - this prevents selection clearing
                    try {
                        DEBUG_JSX.log("🎬 MARKER SYNC: Starting post-undo marker sync");
                        
                        var selectedLayers = comp.selectedLayers;
                        var markersToMove = [];
                        
                        // COLLECT ALL SELECTED KEYFRAME TIMES and find the range (first to last) - same as forced timeline mode
                        var allSelectedKeyframeTimes = [];
                        for (var propName in propertyMap) {
                            var propData = propertyMap[propName];
                            var keyframes = propData.keyframes;
                            for (var k = 0; k < keyframes.length; k++) {
                                var keyTime = keyframes[k].time;
                                // Check if this time is already in our array (avoid duplicates)
                                var timeExists = false;
                                for (var t = 0; t < allSelectedKeyframeTimes.length; t++) {
                                    if (Math.abs(allSelectedKeyframeTimes[t] - keyTime) < 0.001) {
                                        timeExists = true;
                                        break;
                                    }
                                }
                                if (!timeExists) {
                                    allSelectedKeyframeTimes.push(keyTime);
                                }
                            }
                        }
                        
                        // Sort keyframe times and find the range
                        allSelectedKeyframeTimes.sort(function(a, b) { return a - b; });
                        var firstKeyframeTime = allSelectedKeyframeTimes[0];
                        var lastKeyframeTime = allSelectedKeyframeTimes[allSelectedKeyframeTimes.length - 1];
                        
                        DEBUG_JSX.log("Post-undo: Keyframe range for marker sync: " + firstKeyframeTime + "s to " + lastKeyframeTime + "s (" + allSelectedKeyframeTimes.length + " unique times)");
                        
                        // Check for layer markers on selected layers
                        for (var layerIdx = 0; layerIdx < selectedLayers.length; layerIdx++) {
                            var layer = selectedLayers[layerIdx];
                            
                            if (layer.marker && layer.marker.numKeys > 0) {
                                DEBUG_JSX.log("Checking layer '" + layer.name + "' with " + layer.marker.numKeys + " markers");
                                
                                for (var m = 1; m <= layer.marker.numKeys; m++) {
                                    try {
                                        var markerTime = layer.marker.keyTime(m);
                                        
                                        // Check if marker is within the keyframe range (between first and last keyframe)
                                        var markerInRange = (markerTime >= firstKeyframeTime && markerTime <= lastKeyframeTime);
                                        
                                        if (markerInRange) {
                                            var markerValue = layer.marker.keyValue(m);
                                            var markerComment = markerValue.comment || "";
                                            
                                            DEBUG_JSX.log("Found layer marker '" + markerComment + "' within keyframe range " + markerTime + "s (range: " + firstKeyframeTime + "s to " + lastKeyframeTime + "s)");
                                            
                                            // For timeline mode, all markers move by the same amount (timeline offset)
                                            var timelineOffset = newTimelineTime - originalEarliestTime;
                                            var newMarkerTime = Math.max(0, markerTime + timelineOffset);
                                            
                                            markersToMove.push({
                                                markerIndex: m,
                                                oldTime: markerTime,
                                                newTime: newMarkerTime,
                                                markerValue: markerValue,
                                                comment: markerComment,
                                                layer: layer,
                                                timelineOffset: timelineOffset // For debugging
                                            });
                                        }
                                    } catch(markerCheckError) {
                                        DEBUG_JSX.log("Error checking layer marker: " + markerCheckError.toString());
                                    }
                                }
                            }
                        }
                        
                        // Move layer markers in separate undo group
                        if (markersToMove.length > 0) {
                            app.beginUndoGroup("Sync Layer Markers");
                            
                            markersToMove.sort(function(a, b) { return b.markerIndex - a.markerIndex; });
                            
                            for (var m = 0; m < markersToMove.length; m++) {
                                var markerInfo = markersToMove[m];
                                
                                try {
                                    markerInfo.layer.marker.removeKey(markerInfo.markerIndex);
                                    var newMarkerIndex = markerInfo.layer.marker.addKey(markerInfo.newTime);
                                    markerInfo.layer.marker.setValueAtKey(newMarkerIndex, markerInfo.markerValue);
                                    
                                    DEBUG_JSX.log("Moved layer marker '" + markerInfo.comment + "' from " + Math.round(markerInfo.oldTime * 1000) + "ms to " + Math.round(markerInfo.newTime * 1000) + "ms");
                                    debugInfo.push("Synced layer marker '" + markerInfo.comment + "'");
                                    
                                } catch(markerMoveError) {
                                    DEBUG_JSX.log("Failed to move layer marker: " + markerMoveError.toString());
                                }
                            }
                            
                            app.endUndoGroup();
                        }
                        
                    } catch(markerSyncError) {
                        DEBUG_JSX.log("Post-undo marker sync error: " + markerSyncError.toString());
                    }
                    
                    // CRITICAL: Restore keyframe selection after marker operations
                    // This is now the ONLY selection restoration point for performance optimization
                    try {
                        var markersWereProcessed = (markersToMove.length > 0);
                        DEBUG_JSX.log("PERF: Final selection restoration - properties: " + keyframeSelectionInfo.length + ", markers processed: " + markersWereProcessed);
                        
                        var totalKeyframesSelected = 0;
                        var totalKeyframesDeselected = 0;
                        
                        for (var i = 0; i < keyframeSelectionInfo.length; i++) {
                            var selInfo = keyframeSelectionInfo[i];
                            var prop = selInfo.property;
                            
                            // First deselect all keyframes (performance critical: only done once now)
                            for (var j = 1; j <= prop.numKeys; j++) {
                                prop.setSelectedAtKey(j, false);
                                totalKeyframesDeselected++;
                            }
                            
                            // Then select our target keyframes
                            for (var k = 0; k < selInfo.newSelIndices.length; k++) {
                                var idx = selInfo.newSelIndices[k];
                                prop.setSelectedAtKey(idx, true);
                                totalKeyframesSelected++;
                                DEBUG_JSX.log("Selected keyframe at index " + idx);
                            }
                        }
                        
                        DEBUG_JSX.log("PERF: Selection complete - deselected: " + totalKeyframesDeselected + ", selected: " + totalKeyframesSelected);
                        debugInfo.push("Selection optimized - single cycle: " + totalKeyframesSelected + " keyframes");
                        
                    } catch(selectionRestoreError) {
                        DEBUG_JSX.log("Selection restore error: " + selectionRestoreError.toString());
                        debugInfo.push("Selection restore failed: " + selectionRestoreError.toString());
                    }
                    
                    // Include all DEBUG_JSX messages in the result
                    var allDebugMessages = DEBUG_JSX.getMessages();
                    var finalDebugInfo = debugInfo.concat(allDebugMessages);
                    
                    // Return cumulative value for display when at 0ms delay
                    var displayDelayMs = Math.round(TIMELINE_MODE_CUMULATIVE);
                    var displayDelayFrames = Math.round((displayDelayMs / 1000) * frameRate);
                    
                    // Include debug messages in result for debug panel
                    var debugMessages = DEBUG_JSX.getMessages();
                    return "success|" + displayDelayMs + "|" + displayDelayFrames + "|TIMELINE-FORCED|" + debugMessages.join("|");
                } catch(forcedError) {
                    DEBUG_JSX.log("FTL_ERR:" + forcedError.toString());
                }
            }
            
            if (allFirstKeyframesAtSameTime && firstKeyframeTime !== null) {
                try {
                    DEBUG_JSX.log("TL_MODE:" + Math.round(firstKeyframeTime * 1000) + "ms");
                    
                    // Timeline position nudging: handle negative nudges properly for backward movement
                    var nudgeMs;
                    if (direction > 0) {
                        nudgeMs = calculateDelaySnap(0, direction);  // Use normal snapping for forward
                    } else {
                        // For backward movement, calculate the increment without clamping to 0
                        var forwardNudge = calculateDelaySnap(0, 1);
                        nudgeMs = -forwardNudge;  // Negative of the forward increment
                    }
                    var timelineNudgeSeconds = nudgeMs / 1000.0;
                    var newTimelineTime = firstKeyframeTime + timelineNudgeSeconds;
                    
                    // Handle negative times
                    if (newTimelineTime < 0) {
                        if (Math.abs(firstKeyframeTime) < 0.001 && direction < 0) {
                            app.endUndoGroup();
                            // Include debug messages in result for debug panel
                            var debugMessages = DEBUG_JSX.getMessages();
                            return "success|0|0|TIMELINE|" + debugMessages.join("|"); 
                        }
                        newTimelineTime = 0;
                    }
                    
                    // Move all keyframes using recreate approach
                    var timelinePropertyData = [];
                    for (var propName in propertyMap) {
                        var propData = propertyMap[propName];
                        var prop = propData.property;
                        var keyframesToMove = [];

                        // PROTECTION: Capture the next keyframe to prevent AE from modifying it
                        var nextKeyData = captureNextKeyframe(prop, propData.selectedKeys);

                        // Calculate timeline offset
                        var timelineOffset = newTimelineTime - firstKeyframeTime;

                        // Collect keyframe data - maintain relative spacing
                        for (var k = 0; k < propData.keyframes.length; k++) {
                            var keyIndex = propData.keyframes[k].index;
                            var oldTime = propData.keyframes[k].time;
                            var newTime = oldTime + timelineOffset; // Maintain relative spacing
                            
                            var keyData = {
                                oldIndex: keyIndex,
                                time: oldTime,
                                newTime: Math.max(0, newTime), // Clamp to 0
                                value: prop.keyValue(keyIndex),
                                inInterp: prop.keyInInterpolationType(keyIndex),
                                outInterp: prop.keyOutInterpolationType(keyIndex),
                                temporalContinuous: prop.keyTemporalContinuous(keyIndex),
                                temporalAutoBezier: prop.keyTemporalAutoBezier(keyIndex),
                                // CRITICAL: Preserve keyframe color labels
                                label: prop.keyLabel(keyIndex)
                            };
                            
                            // CRITICAL FIX: Preserve temporal ease for bezier keyframes (same as timeline mode)
                            if (keyData.inInterp === KeyframeInterpolationType.BEZIER || 
                                keyData.outInterp === KeyframeInterpolationType.BEZIER) {
                                try {
                                    keyData.inEase = prop.keyInTemporalEase(keyIndex);
                                    keyData.outEase = prop.keyOutTemporalEase(keyIndex);
                                } catch(e) {
                                    // Temporal ease might not be available for some properties
                                }
                            }
                            
                            // CRITICAL FIX: Preserve spatial properties for position keyframes (same as timeline mode)
                            if (prop.isSpatial) {
                                try {
                                    keyData.spatialContinuous = prop.keySpatialContinuous(keyIndex);
                                    keyData.spatialAutoBezier = prop.keySpatialAutoBezier(keyIndex);
                                    keyData.inTangent = prop.keyInSpatialTangent(keyIndex);
                                    keyData.outTangent = prop.keyOutSpatialTangent(keyIndex);
                                } catch(e) {
                                    // Spatial properties might not be available
                                }
                            }
                            
                            // Handle spatial properties if applicable (Position, etc.)
                            if (prop.isSpatial) {
                                keyData.spatialContinuous = prop.keySpatialContinuous(keyIndex);
                                keyData.spatialAutoBezier = prop.keySpatialAutoBezier(keyIndex);
                                keyData.inTangent = prop.keyInSpatialTangent(keyIndex);
                                keyData.outTangent = prop.keyOutSpatialTangent(keyIndex);
                            }
                            
                            keyframesToMove.push(keyData);
                        }
                        
                        // Remove old keyframes (reverse order)
                        keyframesToMove.sort(function(a, b) { return b.oldIndex - a.oldIndex; });
                        for (var k = 0; k < keyframesToMove.length; k++) {
                            prop.removeKey(keyframesToMove[k].oldIndex);
                        }
                        
                        // Add new keyframes at timeline position and collect indices
                        var newSelIndices = [];
                        for (var k = 0; k < keyframesToMove.length; k++) {
                            var data = keyframesToMove[k];
                            var newIdx = prop.addKey(data.newTime);
                            prop.setValueAtKey(newIdx, data.value);

                            // Apply temporal ease first to avoid flipping linear sides
                            if (data.inEase !== undefined && data.outEase !== undefined) {
                                try {
                                    prop.setTemporalEaseAtKey(newIdx, data.inEase, data.outEase);
                                } catch(e) {
                                    // Some properties might not support temporal ease
                                }
                            }

                            // Then re-assert original interpolation types
                            prop.setInterpolationTypeAtKey(newIdx, data.inInterp, data.outInterp);
                            
                            // CRITICAL FIX: Restore temporal properties
                            prop.setTemporalContinuousAtKey(newIdx, data.temporalContinuous);
                            prop.setTemporalAutoBezierAtKey(newIdx, data.temporalAutoBezier);
                            
                            // CRITICAL FIX: Restore spatial properties if they exist (Position, etc.)
                            if (data.spatialContinuous !== undefined) {
                                prop.setSpatialContinuousAtKey(newIdx, data.spatialContinuous);
                                prop.setSpatialAutoBezierAtKey(newIdx, data.spatialAutoBezier);
                                // Only restore tangents if NOT auto-bezier (manual tangent control)
                                if (!data.spatialAutoBezier && data.inTangent !== undefined && data.outTangent !== undefined) {
                                    prop.setSpatialTangentsAtKey(newIdx, data.inTangent, data.outTangent);
                                }
                            }
                            
                            // CRITICAL: Restore keyframe color label
                            if (data.label !== undefined) {
                                prop.setLabelAtKey(newIdx, data.label);
                            }
                            
                            newSelIndices.push(newIdx);
                        }

                        // PROTECTION: Restore the next keyframe
                        if (nextKeyData !== null) {
                            var keysAdded = newSelIndices.length - keyframesToMove.length;
                            restoreNextKeyframe(prop, nextKeyData, keysAdded);
                        }

                        // Store for later selection
                        timelinePropertyData.push({
                            property: prop,
                            newSelIndices: newSelIndices,
                            propName: propName
                        });
                    }
                    
                    // Select all new keyframes at the end
                    for (var i = 0; i < timelinePropertyData.length; i++) {
                        var propInfo = timelinePropertyData[i];
                        var prop = propInfo.property;
                        
                        // First deselect all keyframes on this property
                        for (var j = 1; j <= prop.numKeys; j++) {
                            prop.setSelectedAtKey(j, false);
                        }
                        
                        // Then select our new keyframes
                        for (var k = 0; k < propInfo.newSelIndices.length; k++) {
                            var idx = propInfo.newSelIndices[k];
                            prop.setSelectedAtKey(idx, true);
                            debugInfo.push("FORCED: Selecting keyframe at index " + idx + " on " + propInfo.propName);
                        }
                    }
                    
                    // COMPOSITION MARKER SYNCING FOR REGULAR TIMELINE MODE
                    try {
                        DEBUG_JSX.log("Starting marker sync for regular timeline mode");
                        var markersToMove = [];
                        
                        // Check if there are markers at the original timeline position that should move
                        for (var m = 1; m <= comp.markerProperty.numKeys; m++) {
                            var markerTime = comp.markerProperty.keyTime(m);
                            
                            // Check if marker is at same time as original first keyframes (with small tolerance)
                            if (Math.abs(markerTime - firstKeyframeTime) < (0.5 / frameRate)) {
                                var markerValue = comp.markerProperty.keyValue(m);
                                var markerComment = markerValue.comment || "";
                                
                                DEBUG_JSX.log("Found marker '" + markerComment + "' at original timeline position " + markerTime + "s");
                                
                                var newMarkerTime = Math.max(0, newTimelineTime);
                                
                                markersToMove.push({
                                    markerIndex: m,
                                    oldTime: markerTime,
                                    newTime: newMarkerTime,
                                    markerValue: markerValue,
                                    comment: markerComment
                                });
                            }
                        }
                        
                        // Move synchronized markers
                        if (markersToMove.length > 0) {
                            DEBUG_JSX.log("Moving " + markersToMove.length + " markers in regular timeline mode");
                            
                            markersToMove.sort(function(a, b) { return b.markerIndex - a.markerIndex; });
                            
                            for (var m = 0; m < markersToMove.length; m++) {
                                var markerInfo = markersToMove[m];
                                
                                try {
                                    comp.markerProperty.removeKey(markerInfo.markerIndex);
                                    var newMarkerIndex = comp.markerProperty.addKey(markerInfo.newTime);
                                    comp.markerProperty.setValueAtKey(newMarkerIndex, markerInfo.markerValue);
                                    
                                    DEBUG_JSX.log("Moved marker '" + markerInfo.comment + "' from " + Math.round(markerInfo.oldTime * 1000) + "ms to " + Math.round(markerInfo.newTime * 1000) + "ms");
                                    debugInfo.push("Synced marker '" + markerInfo.comment + "' with timeline");
                                    
                                } catch(markerMoveError) {
                                    DEBUG_JSX.log("Failed to move marker in regular timeline: " + markerMoveError.toString());
                                }
                            }
                        }
                        
                    } catch(markerSyncError) {
                        DEBUG_JSX.log("Marker sync error in regular timeline: " + markerSyncError.toString());
                        debugInfo.push("Marker sync error: " + markerSyncError.toString());
                    }
                    
                    var newTimelinePositionMs = Math.round(newTimelineTime * 1000);
                    var newTimelinePositionFrames = Math.round(newTimelineTime * frameRate);
                    
                    app.endUndoGroup();
                    // Include debug messages in result for debug panel
                    var debugMessages = DEBUG_JSX.getMessages();
                    return "success|" + newTimelinePositionMs + "|" + newTimelinePositionFrames + "|TIMELINE|" + debugMessages.join("|");
                } catch(timelineError) {
                    DEBUG_JSX.log("TL_ERR:" + timelineError.toString());
                    // Fall through to baseline mode
                }
            }
            
            // EXISTING LOGIC: Normal delay adjustment (restore original baseline behavior)
            if (allSameDelay) {
                // All delays are the same - apply 50ms snapping to the unified delay
                targetDelayMs = calculateDelaySnap(firstDelay, direction);
                DEBUG_JSX.log("UNI:" + firstDelay + "→" + targetDelayMs + "ms");
            } else {
                // Multiple different delays - nudge each property individually
                DEBUG_JSX.log("MULTI");
                
                // Calculate target delay for each property individually
                for (var i = 0; i < propertyDelays.length; i++) {
                    var propDelay = propertyDelays[i];
                    var currentDelay = propDelay.relativeDelay;
                    
                    if (propDelay.isOriginalBaseline) {
                        // Original baseline property - never moves
                        propDelay.targetDelay = 0;
                        DEBUG_JSX.log("BASELINE:" + propDelay.property);
                    } else {
                        // Apply individual 50ms snapping to this property (even if currently at 0ms)
                        var targetDelay = calculateDelaySnap(currentDelay, direction);
                        propDelay.targetDelay = targetDelay;
                    }
                }
                
                // Set a flag to indicate individual processing
                var useIndividualDelays = true;
            }
        } catch(snapError) {
            app.endUndoGroup();
            return "error|Snapping error: " + snapError.toString();
        }
        
        // Apply time offsets to move properties to their target delays
        try {
            var movedCount = 0;
            for (var i = 0; i < propertyDelays.length; i++) {
                var propData = propertyDelays[i];
                var currentTime = propData.currentDelay;
                
                var timeOffset;
                if (useIndividualDelays) {
                    // Multiple delays mode - each property has its own target
                    var targetDelaySeconds = propData.targetDelay / 1000;
                    var targetTime = originalEarliestTime + targetDelaySeconds; // Use LOCKED baseline time
                    timeOffset = targetTime - currentTime;
                } else {
                    // Unified delay mode - all properties move to same target
                    var targetDelaySeconds = targetDelayMs / 1000;
                    
                    // Safety check for divide by zero
                    if (isNaN(targetDelaySeconds) || !isFinite(targetDelaySeconds)) {
                        throw new Error("Invalid targetDelaySeconds: " + targetDelaySeconds + " from targetDelayMs: " + targetDelayMs);
                    }
                    
                    var targetTime = originalEarliestTime + targetDelaySeconds; // Use LOCKED baseline time
                    
                    // Handle original baseline property - recreate keyframes at same positions to maintain selection
                    if (propData.isOriginalBaseline) {
                        timeOffset = 0; // No time offset for original baseline property
                    } else {
                        timeOffset = targetTime - currentTime;
                    }
                }
                
                // Baseline keyframes: process them with timeOffset = 0 to preserve easing while maintaining selection
                if (propData.isOriginalBaseline && useIndividualDelays) {
                    timeOffset = 0; // No movement, but still recreate for easing preservation
                }
                
                // Move all selected keyframes of this property by the time offset using remove/recreate approach
                var prop = propData.propObject;
                var keyframesToMove = [];

                // PROTECTION: Capture the next keyframe to prevent AE from modifying it
                var nextKeyData = captureNextKeyframe(prop, propData.selectedKeys);

                // First, collect all keyframe data
                for (var k = 0; k < propData.keyframes.length; k++) {
                    var keyframe = propData.keyframes[k];
                    var keyIndex = keyframe.index;
                    
                    try {
                        var keyData = {
                            oldIndex: keyIndex,
                            time: keyframe.time,
                            newTime: keyframe.time + timeOffset,
                            value: prop.keyValue(keyIndex),
                            inInterp: prop.keyInInterpolationType(keyIndex),
                            outInterp: prop.keyOutInterpolationType(keyIndex),
                            temporalContinuous: prop.keyTemporalContinuous(keyIndex),
                            temporalAutoBezier: prop.keyTemporalAutoBezier(keyIndex),
                            // CRITICAL: Preserve keyframe color labels
                            label: prop.keyLabel(keyIndex)
                        };
                        
                        // Preserve temporal ease for bezier keyframes (same as timeline mode)
                        if (keyData.inInterp === KeyframeInterpolationType.BEZIER || 
                            keyData.outInterp === KeyframeInterpolationType.BEZIER) {
                            try {
                                keyData.inEase = prop.keyInTemporalEase(keyIndex);
                                keyData.outEase = prop.keyOutTemporalEase(keyIndex);
                            } catch(e) {
                                // Temporal ease might not be available
                            }
                        }
                        
                        // Handle spatial properties if applicable
                        if (prop.isSpatial) {
                            keyData.spatialContinuous = prop.keySpatialContinuous(keyIndex);
                            keyData.spatialAutoBezier = prop.keySpatialAutoBezier(keyIndex);
                            keyData.inTangent = prop.keyInSpatialTangent(keyIndex);
                            keyData.outTangent = prop.keyOutSpatialTangent(keyIndex);
                        }
                        
                        keyframesToMove.push(keyData);
                    } catch(collectError) {
                        throw new Error("Failed to collect keyframe data for index " + keyIndex + ": " + collectError.toString());
                    }
                }
                
                // Remove old keyframes in reverse order to avoid index shifts
                var indices = [];
                for (var k = 0; k < keyframesToMove.length; k++) {
                    indices.push(keyframesToMove[k].oldIndex);
                }
                indices.sort(function(a, b) { return b - a; }); // Reverse order
                
                for (var k = 0; k < indices.length; k++) {
                    prop.removeKey(indices[k]);
                }
                
                // Create new keyframes at new times (collect new indices for later selection)
                var newSelIndices = [];
                for (var k = 0; k < keyframesToMove.length; k++) {
                    var keyData = keyframesToMove[k];
                    var newIdx = prop.addKey(keyData.newTime);
                    
                    // Restore all attributes
                    prop.setValueAtKey(newIdx, keyData.value);

                    // Apply temporal ease first to avoid flipping linear sides
                    if (keyData.inEase !== undefined && keyData.outEase !== undefined) {
                        try {
                            prop.setTemporalEaseAtKey(newIdx, keyData.inEase, keyData.outEase);
                        } catch(e) {
                            // Some properties might not support temporal ease
                        }
                    }

                    // Then re-assert original interpolation types
                    prop.setInterpolationTypeAtKey(newIdx, keyData.inInterp, keyData.outInterp);
                    
                    prop.setTemporalContinuousAtKey(newIdx, keyData.temporalContinuous);
                    prop.setTemporalAutoBezierAtKey(newIdx, keyData.temporalAutoBezier);
                    
                    if (keyData.spatialContinuous !== undefined) {
                        prop.setSpatialContinuousAtKey(newIdx, keyData.spatialContinuous);
                        prop.setSpatialAutoBezierAtKey(newIdx, keyData.spatialAutoBezier);
                        // Only restore tangents if NOT auto-bezier (manual tangent control)
                        if (!keyData.spatialAutoBezier && keyData.inTangent !== undefined && keyData.outTangent !== undefined) {
                            prop.setSpatialTangentsAtKey(newIdx, keyData.inTangent, keyData.outTangent);
                        }
                    }
                    
                    // CRITICAL: Restore keyframe color label
                    if (keyData.label !== undefined) {
                        prop.setLabelAtKey(newIdx, keyData.label);
                    }
                    
                    // Store new index for later selection
                    newSelIndices.push(newIdx);
                    movedCount++;
                    debugInfo.push("Recreated " + propData.property + " keyframe: " + keyData.time + "s → " + keyData.newTime + "s");
                    
                    // Extra debug for 0ms→50ms case
                    if (Math.abs(keyData.time) < 0.001 && Math.abs(keyData.newTime - 0.05) < 0.001) {
                        debugInfo.push("DEBUG: Moving keyframe from 0s to 0.05s (0ms→50ms)");
                    }
                }

                // PROTECTION: Restore the next keyframe
                if (nextKeyData !== null) {
                    var keysAdded = newSelIndices.length - keyframesToMove.length;
                    restoreNextKeyframe(prop, nextKeyData, keysAdded);
                }

                // Store new indices for later selection
                propData.newSelIndices = newSelIndices;
            }
            
            debugInfo.push("Total keyframes moved: " + movedCount);
            
            // SMART MARKER SYNCING: Split/merge spring markers when properties move independently
            try {
                DEBUG_JSX.log("Starting smart marker sync (split/merge mode)");
                var comp = app.project.activeItem;
                var markerEpsilon = 0.01; // 10ms tolerance for finding markers at keyframe times

                // Process each property independently
                for (var i = 0; i < propertyDelays.length; i++) {
                    var propData = propertyDelays[i];
                    if (!propData.keyframes || propData.keyframes.length === 0) continue;

                    // Calculate time offset for this property
                    var timeOffset;
                    if (useIndividualDelays) {
                        var targetDelaySeconds = propData.targetDelay / 1000;
                        var newFirstKeyframeTime = originalEarliestTime + targetDelaySeconds;
                        var oldFirstKeyframeTime = propData.currentDelay;
                        timeOffset = newFirstKeyframeTime - oldFirstKeyframeTime;
                    } else {
                        if (propData.isOriginalBaseline) {
                            timeOffset = 0; // Baseline stays at original time
                        } else {
                            var targetDelaySeconds = targetDelayMs / 1000;
                            var newFirstKeyframeTime = originalEarliestTime + targetDelaySeconds;
                            var oldFirstKeyframeTime = propData.currentDelay;
                            timeOffset = newFirstKeyframeTime - oldFirstKeyframeTime;
                        }
                    }

                    // Skip if property didn't actually move
                    if (Math.abs(timeOffset) < markerEpsilon) {
                        DEBUG_JSX.log("SMART MARKER: Property " + propData.property + " didn't move, skipping marker check");
                        continue;
                    }

                    // Get the property's unique ID for marker block identification
                    // Need to get the actual property object from the layer
                    var uniquePropId = null;
                    var markerProp = null;
                    var selectedLayers = comp.selectedLayers;

                    // Find the actual property object to get its uniquePropId
                    for (var layerIdx = 0; layerIdx < selectedLayers.length; layerIdx++) {
                        var layer = selectedLayers[layerIdx];
                        var selectedProps = layer.selectedProperties;

                        for (var j = 0; j < selectedProps.length; j++) {
                            var prop = selectedProps[j];
                            if (!prop || !prop.canVaryOverTime) continue;

                            // Match property by name (stored as "LayerName:PropertyPath")
                            var propFullPath = layer.name + ":" + getFullPropertyPath(prop);
                            if (propFullPath === propData.property) {
                                uniquePropId = getUniquePropertyId(prop);

                                // Determine if we should use layer markers or comp markers
                                // Use layer markers if available, otherwise comp markers
                                if (layer.marker && layer.marker.numKeys > 0) {
                                    markerProp = layer.marker;
                                    DEBUG_JSX.log("SMART MARKER: Using layer markers for " + uniquePropId);
                                } else {
                                    markerProp = comp.markerProperty;
                                    DEBUG_JSX.log("SMART MARKER: Using comp markers for " + uniquePropId);
                                }

                                break;
                            }
                        }
                        if (uniquePropId) break;
                    }

                    if (!uniquePropId || !markerProp) {
                        DEBUG_JSX.log("SMART MARKER: Could not find property object for " + propData.property);
                        continue;
                    }

                    // FIXED: Check ALL keyframes for markers, but only process each unique marker ONCE
                    // Track BOTH original and new marker times to prevent double-processing
                    var processedMarkerTimes = []; // Stores both old and new times
                    var markersProcessed = 0;

                    // DEBUG: Show what keyframe times we're looping through
                    var keyframeTimes = [];
                    for (var debugIdx = 0; debugIdx < propData.keyframes.length; debugIdx++) {
                        keyframeTimes.push(propData.keyframes[debugIdx].time.toFixed(6));
                    }
                    DEBUG_JSX.log("MARKER LOOP: Will check " + propData.keyframes.length + " keyframes at times: [" + keyframeTimes.join(", ") + "]");

                    for (var kfIdx = 0; kfIdx < propData.keyframes.length; kfIdx++) {
                        var keyframeData = propData.keyframes[kfIdx];
                        var oldKeyTime = keyframeData.time;

                        // Check if we've already processed a marker at this time (original OR moved location)
                        var alreadyProcessed = false;
                        DEBUG_JSX.log("MARKER CHECK: Checking oldKeyTime " + oldKeyTime.toFixed(6) + "s against processedMarkerTimes: [" + processedMarkerTimes.join(", ") + "]");
                        for (var p = 0; p < processedMarkerTimes.length; p++) {
                            var diff = Math.abs(processedMarkerTimes[p] - oldKeyTime);
                            DEBUG_JSX.log("  - Comparing with processedMarkerTimes[" + p + "] = " + processedMarkerTimes[p].toFixed(6) + ", diff = " + diff.toFixed(6) + ", epsilon = " + markerEpsilon);
                            if (diff < markerEpsilon) {
                                alreadyProcessed = true;
                                DEBUG_JSX.log("  - MATCH! Skipping this keyframe");
                                break;
                            }
                        }

                        if (alreadyProcessed) {
                            DEBUG_JSX.log("MARKER CHECK: Skipped oldKeyTime " + oldKeyTime.toFixed(6) + "s (already processed)");
                            continue;
                        }

                        DEBUG_JSX.log("MARKER CHECK: Processing oldKeyTime " + oldKeyTime.toFixed(6) + "s (not in processed list)");

                        var newKeyTime = oldKeyTime + timeOffset;

                        // EXTRA CHECK: Verify there's actually a marker at this position before calling smartSplitMergeMarker
                        var markerExists = findMarkerAtTime(markerProp, oldKeyTime, markerEpsilon);
                        if (!markerExists) {
                            DEBUG_JSX.log("MARKER CHECK: No marker found at " + oldKeyTime.toFixed(6) + "s, skipping");
                            continue;
                        }
                        DEBUG_JSX.log("MARKER CHECK: Marker confirmed at " + oldKeyTime.toFixed(6) + "s, calling smartSplitMergeMarker");

                        // Call smartSplitMergeMarker for this keyframe
                        var result = smartSplitMergeMarker(
                            markerProp,
                            oldKeyTime,
                            newKeyTime,
                            uniquePropId,
                            markerEpsilon
                        );

                        if (result !== "no marker at old time" && result !== "no spring block for property") {
                            markersProcessed++;
                            // Track BOTH the original time AND the new time to prevent reprocessing
                            processedMarkerTimes.push(oldKeyTime);
                            processedMarkerTimes.push(newKeyTime);
                            DEBUG_JSX.log("SMART MARKER: " + propData.property + " @ " + oldKeyTime.toFixed(3) + "s - " + result);
                            DEBUG_JSX.log("MARKER CHECK: Added [" + oldKeyTime.toFixed(6) + ", " + newKeyTime.toFixed(6) + "] to processedMarkerTimes. Array now: [" + processedMarkerTimes.join(", ") + "]");
                        } else {
                            DEBUG_JSX.log("MARKER CHECK: Result was '" + result + "', NOT adding to processedMarkerTimes");
                        }
                    }

                    if (markersProcessed > 0) {
                        debugInfo.push("Markers: " + uniquePropId.split("|").pop() + " - " + markersProcessed + " moved");
                    }
                }

            } catch(markerSyncError) {
                // Don't fail the entire operation if marker syncing fails
                DEBUG_JSX.log("SMART_MARKER_ERR:" + markerSyncError.toString());
                debugInfo.push("Marker sync error: " + markerSyncError.toString());
            }
            
        } catch(moveError) {
            app.endUndoGroup();
            return "error|Keyframe moving error: " + moveError.toString();
        }
        
        // Final pass: Select all the new keyframes after all adjustments are complete
        try {
            // Re-acquire fresh property references before selecting
            for (var layerIdx = 0; layerIdx < selectedLayers.length; layerIdx++) {
                var layer = selectedLayers[layerIdx];
                
                // Match properties by name and re-select their keyframes
                for (var i = 0; i < propertyDelays.length; i++) {
                    var propData = propertyDelays[i];
                    if (!propData.newSelIndices || propData.newSelIndices.length === 0) continue;
                    
                    // Extract the actual property name from the stored format "LayerName:PropertyName"
                    var parts = propData.property.split(":");
                    var layerName = parts[0];
                    var propName = parts.slice(1).join(":"); // Handle property names with colons
                    
                    if (layer.name !== layerName) continue;
                    
                    // Find the property fresh from the layer
                    var freshProp = findPropertyByName(layer, propName);
                    if (freshProp && freshProp.numKeys > 0) {
                        for (var k = 0; k < propData.newSelIndices.length; k++) {
                            try {
                                freshProp.setSelectedAtKey(propData.newSelIndices[k], true);
                            } catch(e) {
                                // Individual keyframe selection might fail
                                debugInfo.push("Failed to select keyframe " + propData.newSelIndices[k] + " on " + propName + ": " + e.toString());
                            }
                        }
                        debugInfo.push("Selected " + propData.newSelIndices.length + " keyframes on " + propData.property);
                    } else {
                        debugInfo.push("Could not find fresh property reference for " + propData.property);
                    }
                }
            }
        } catch(selectionError) {
            // Don't fail the entire operation if selection fails
            debugInfo.push("Selection error: " + selectionError.toString());
        }
        
        app.endUndoGroup();
        
        // Return the result in the same format as readKeyframesSmart
        var frameRate = comp.frameRate || 29.97;
        var isCrossPropertyMode = 1;
        var returnDelayMs, returnFrames;
        
        if (useIndividualDelays) {
            // Multiple delays - check if they're all the same now
            var newDelays = [];
            for (var i = 0; i < propertyDelays.length; i++) {
                if (propertyDelays[i].targetDelay > 0) { // Skip baseline (0ms)
                    newDelays.push(propertyDelays[i].targetDelay);
                }
            }
            
            if (newDelays.length === 0) {
                returnDelayMs = 0;
            } else {
                var firstNewDelay = newDelays[0];
                var allSameNewDelay = true;
                for (var i = 1; i < newDelays.length; i++) {
                    if (Math.abs(newDelays[i] - firstNewDelay) > 1) {
                        allSameNewDelay = false;
                        break;
                    }
                }
                
                if (allSameNewDelay) {
                    returnDelayMs = firstNewDelay;
                } else {
                    returnDelayMs = -1; // Still multiple different delays
                }
            }
        } else {
            // Unified delay mode
            returnDelayMs = targetDelayMs;
        }
        
        // Round to avoid floating point precision issues (49.9999999 -> 50)
        returnDelayMs = Math.round(returnDelayMs);
        returnFrames = Math.round(returnDelayMs * frameRate / 1000);
        
        var result = "success|" + returnDelayMs + "|" + returnFrames + "|" + isCrossPropertyMode;
        DEBUG_JSX.log("RES:" + returnDelayMs + "ms/" + returnFrames + "f");
        
        app.endUndoGroup();
        
        // CRITICAL: Selection restoration for baseline mode (same pattern as timeline mode)
        DEBUG_JSX.log("BASELINE: Starting selection restoration for " + propertyDelays.length + " properties");
        try {
            for (var i = 0; i < propertyDelays.length; i++) {
                var propData = propertyDelays[i];
                DEBUG_JSX.log("BASELINE: Checking property " + i + ": " + (propData.property || "unknown") + 
                            ", has newSelIndices: " + (propData.newSelIndices ? propData.newSelIndices.length : "none"));
                
                if (propData.newSelIndices && propData.newSelIndices.length > 0) {
                    var prop = propData.propObject;
                    DEBUG_JSX.log("BASELINE: Processing property with " + propData.newSelIndices.length + " indices: [" + propData.newSelIndices.join(", ") + "]");
                    
                    // First deselect all keyframes on this property
                    for (var j = 1; j <= prop.numKeys; j++) {
                        prop.setSelectedAtKey(j, false);
                    }
                    
                    // Then select our new keyframes
                    for (var k = 0; k < propData.newSelIndices.length; k++) {
                        var idx = propData.newSelIndices[k];
                        if (idx > 0 && idx <= prop.numKeys) {
                            prop.setSelectedAtKey(idx, true);
                            DEBUG_JSX.log("BASELINE: ✅ Restored selection for keyframe " + idx + " on " + getFullPropertyPath(prop));
                        } else {
                            DEBUG_JSX.log("BASELINE: ❌ Invalid keyframe index " + idx + " (prop has " + prop.numKeys + " keys)");
                        }
                    }
                } else {
                    DEBUG_JSX.log("BASELINE: ⚠️ Property " + (propData.property || "unknown") + " has no newSelIndices to restore");
                }
            }
            DEBUG_JSX.log("BASELINE: Selection restoration completed successfully");
        } catch(selectionError) {
            DEBUG_JSX.log("BASELINE: Selection restoration error: " + selectionError.toString());
        }
        
        // Include debug messages in result for debug panel
        var debugMessages = DEBUG_JSX.getMessages();
        return result + "|BASELINE|" + debugMessages.join("|");
        
    } catch(e) {
        app.endUndoGroup();
        var errorMsg = e.toString();
        // Include debug messages in error result for debug panel
        var debugMessages = DEBUG_JSX.getMessages();
        if (errorMsg.indexOf("divide by zero") !== -1) {
            return "error|Divide by zero in delay nudging. Debug: propertyTimes=" + (typeof propertyTimes !== 'undefined' ? propertyTimes.length : 'undefined') + ", direction=" + direction + ". Error: " + errorMsg + "|" + debugMessages.join("|");
        } else {
            return "error|Failed to nudge delay: " + errorMsg + "|" + debugMessages.join("|");
        }
    }
}

// Helper function to move layer markers after specific time
function moveLabelsAfterTime(comp, cutoffTime, timeOffset) {
    var movedCount = 0;
    try {
        // Process all layers in the composition
        for (var i = 1; i <= comp.numLayers; i++) {
            try {
                var layer = comp.layer(i);
                
                // Calculate content start time the same way as in the main function
                // to correctly handle Time Remap layers
                var contentStartTime;
                
                if (Math.abs(layer.inPoint - layer.startTime) < 0.001) {
                    // Natural layer (not trimmed) - content starts at startTime
                    contentStartTime = layer.startTime;
                } else {
                    // Trimmed layer - content starts at inPoint
                    contentStartTime = layer.inPoint;
                }
                
                // Check for Time Remap which can shift content start time
                try {
                    if (layer.timeRemapEnabled && layer.timeRemap && layer.timeRemap.numKeys > 0) {
                        var firstKeyTime = layer.timeRemap.keyTime(1);
                        var firstKeyValue = layer.timeRemap.keyValue(1);
                        
                        if (Math.abs(firstKeyValue) > 0.001) {
                            // Time Remap shifts content
                            contentStartTime = layer.startTime - firstKeyValue + layer.inPoint;
                        }
                    }
                } catch(e) {
                    // Time Remap not accessible, use normal content start
                }
                
                // Determine if this layer was moved entirely using content start time
                // (not layer.startTime which doesn't account for Time Remap)
                var layerWasMovedEntirely = (contentStartTime >= cutoffTime);
                
                // Try to access the Marker property group
                var markerProp = null;
                try {
                    markerProp = layer.property("ADBE Marker");
                } catch(e) {
                    // Some layers might not have markers
                    continue;
                }
                
                if (markerProp && markerProp.numKeys > 0) {
                    // Skip processing labels on layers that were moved entirely
                    // (their labels already moved with the layer)
                    if (layerWasMovedEntirely) {
                        continue; // Skip this layer's labels - they moved with the layer
                    }
                    
                    // Collect markers that need to be moved
                    var markersToMove = [];
                    
                    for (var j = 1; j <= markerProp.numKeys; j++) {
                        var markerTime = markerProp.keyTime(j);
                        
                        if (markerTime >= cutoffTime) {
                            // Store marker info for later processing
                            var markerData = {
                                oldIndex: j,
                                oldTime: markerTime,
                                newTime: markerTime + timeOffset
                            };
                            
                            // Try to get marker value (comment, duration, etc.)
                            try {
                                markerData.value = markerProp.keyValue(j);
                            } catch(e) {
                                // Some markers might not have values
                                markerData.value = new MarkerValue("");
                            }
                            
                            markersToMove.push(markerData);
                        }
                    }
                    
                    // Process markers in reverse order to avoid index issues
                    for (var k = markersToMove.length - 1; k >= 0; k--) {
                        try {
                            var marker = markersToMove[k];
                            
                            // Remove old marker
                            markerProp.removeKey(marker.oldIndex);
                            
                            // Add new marker at new time
                            var newIndex = markerProp.addKey(marker.newTime);
                            
                            // Try to set the marker value
                            try {
                                markerProp.setValueAtKey(newIndex, marker.value);
                            } catch(e) {
                                // If setting value fails, continue
                            }
                            
                            // Deselect the marker immediately
                            try {
                                markerProp.setSelectedAtKey(newIndex, false);
                            } catch(e) {
                                // Continue if deselection fails
                            }
                            
                            movedCount++;
                        } catch(e) {
                            // Continue if individual marker fails
                        }
                    }
                }
            } catch(layerError) {
                // Continue processing other layers
            }
        }
        
        return movedCount;
    } catch(e) {
        return 0;
    }
}

// Global operation ID to prevent duplicate processing
var GLOBAL_OPERATION_ID = 0;

// GLOBAL DELAY FUNCTIONS - Move everything after playhead when nothing is selected
// skipPrecomps: if true (shift+click), don't process precomp contents (main comp layers only)
function nudgeFromPlayhead(direction, frames, skipPrecomps) {
    try {
        DEBUG_JSX.clear(); // Clear previous debug messages
        GLOBAL_OPERATION_ID++; // Increment operation ID for this run
        DEBUG_JSX.log("GD#" + GLOBAL_OPERATION_ID + ": " + (direction > 0 ? "+" : "-") + frames + "f" + (skipPrecomps ? " [SKIP PCs]" : ""));
        
        var comp = app.project.activeItem;
        if (comp && comp instanceof CompItem) {
            // Check if playhead position changed
            var currentPlayheadPosition = comp.time;
            if (Math.abs(currentPlayheadPosition - LAST_PLAYHEAD_POSITION) > 0.001) {
                DEBUG_JSX.log("PH_MOVE→RST");
                GLOBAL_DELAY_CUMULATIVE = 0;
                LAST_PLAYHEAD_POSITION = currentPlayheadPosition;
            }
        }
        
        // Initialize global delay cumulative tracking
        if (typeof GLOBAL_DELAY_CUMULATIVE === 'undefined') {
            GLOBAL_DELAY_CUMULATIVE = 0;
        }
        
        // Track processed items to prevent double-processing
        var processedItems = {};
        
        app.beginUndoGroup("Global Delay From Playhead");
        
        var comp = app.project.activeItem;
        if (!(comp && comp instanceof CompItem)) {
            app.endUndoGroup();
            return "error|No composition selected";
        }
        
        var frameRate = comp.frameRate;
        if (!frameRate || frameRate <= 0) {
            frameRate = 30; // Default fallback
            DEBUG_JSX.log("WARN: fps=30");
        }
        
        DEBUG_JSX.log(comp.name + "@" + frameRate + "fps");
        
        var timeOffset = (frames * direction) / frameRate; // Time offset in seconds
        
        // Update cumulative with the actual time offset in milliseconds
        GLOBAL_DELAY_CUMULATIVE += (timeOffset * 1000);
        var playheadTime = comp.time; // Current playhead position
        
        DEBUG_JSX.log("Δ=" + (timeOffset * 1000).toFixed(0) + "ms, PH=" + playheadTime.toFixed(3) + "s");
        
        var movedKeyframes = 0;
        var movedLayers = 0;
        var furthestTime = 0;
        var lockedLayers = [];
        var errorCount = 0; // Track errors for concise reporting
        var movedLayerIndices = []; // Track which layers were moved entirely
        var originalDuration = comp.duration; // Store original duration for extension/shrinking logic
        
        // Process all layers in main comp
        DEBUG_JSX.log("Layers: " + comp.numLayers);
        for (var i = 1; i <= comp.numLayers; i++) {
            try {
                var layer = comp.layer(i);
                DEBUG_JSX.log("L" + i + ": " + layer.name.substring(0, 15) + "@" + layer.startTime.toFixed(2) + "s");
                // Add detailed debug for X of X layers to understand their timing
                if (layer.name.indexOf("X of X") !== -1) {
                    DEBUG_JSX.log("  DEBUG " + layer.name + ": start=" + layer.startTime.toFixed(3) + " in=" + layer.inPoint.toFixed(3) + " out=" + layer.outPoint.toFixed(3));
                }
            
            // Handle locked layers
            var wasLocked = layer.locked;
            if (wasLocked) {
                layer.locked = false;
                lockedLayers.push(layer);
            }
            
            // Move layer in/out points if they're at or after playhead
            var layerMoved = false;
            var moveDetails = [];
            
            // Calculate layer timeline positions
            var layerStartTime = layer.startTime;
            
            // CRITICAL FIX: For trimmed layers (like X of X), the visible content
            // starts at the inPoint value in the timeline, not startTime + inPoint
            // This is because trimmed layers show their content at the inPoint position
            var contentStartTime, contentEndTime;
            
            if (Math.abs(layer.inPoint - layer.startTime) < 0.001) {
                // Natural layer (not trimmed) - content starts at startTime
                contentStartTime = layer.startTime;
                contentEndTime = layer.outPoint;
            } else {
                // Trimmed layer - the visual bar and content start at the inPoint value
                // For X of X layers: inPoint=5.733 means content starts at 5.733s in timeline
                contentStartTime = layer.inPoint;
                contentEndTime = layer.outPoint;
            }
            
            // CRITICAL: Check for Time Remap which can shift content start time
            // Time Remap can make content appear before the layer bar position
            try {
                if (layer.timeRemapEnabled && layer.timeRemap && layer.timeRemap.numKeys > 0) {
                    var firstKeyTime = layer.timeRemap.keyTime(1);
                    var firstKeyValue = layer.timeRemap.keyValue(1);
                    
                    // If first Time Remap key has non-zero value, content shifts
                    if (Math.abs(firstKeyValue) > 0.001) {
                        // Time Remap shifts content by -firstKeyValue
                        // Example: if firstKeyValue = 0.233, content starts 0.233s earlier
                        contentStartTime = layer.startTime - firstKeyValue + layer.inPoint;
                        DEBUG_JSX.log("  Time Remap shifts content by " + (-firstKeyValue).toFixed(3) + "s");
                    }
                }
            } catch(e) {
                // Time Remap not accessible, use normal content start
            }
            
            // Debug for X of X layers
            if (layer.name.indexOf("X of X") !== -1) {
                DEBUG_JSX.log("  CALC: contentStart=" + contentStartTime.toFixed(3) + " contentEnd=" + contentEndTime.toFixed(3) + " vs PH=" + playheadTime.toFixed(3));
                DEBUG_JSX.log("  RAW: start=" + layer.startTime.toFixed(3) + " in=" + layer.inPoint.toFixed(3) + " out=" + layer.outPoint.toFixed(3));
            }
            
            // Debug for Gesture - Tap layers
            if (layer.name.indexOf("Gesture - Tap") !== -1) {
                DEBUG_JSX.log("  GESTURE: contentStart=" + contentStartTime.toFixed(3) + " contentEnd=" + contentEndTime.toFixed(3) + " vs PH=" + playheadTime.toFixed(3));
                DEBUG_JSX.log("  RAW: start=" + layer.startTime.toFixed(3) + " in=" + layer.inPoint.toFixed(3) + " out=" + layer.outPoint.toFixed(3));
            }
            
            if (contentStartTime >= playheadTime) {
                // Content starts at or after playhead - move entire layer
                layer.startTime += timeOffset;
                layerMoved = true;
                DEBUG_JSX.log("  →MOVE");
                
                // Track furthest time based on the layer's new end time
                var newLayerEndTime = layer.startTime + (layer.outPoint - layer.inPoint);
                if (newLayerEndTime > furthestTime) {
                    furthestTime = newLayerEndTime;
                }
                
                // Track that this layer was moved entirely
                movedLayerIndices.push(i);
                
            } else if (contentStartTime < playheadTime && contentEndTime > playheadTime) {
                // Content actually spans the playhead - extend outPoint
                layer.outPoint += timeOffset;
                layerMoved = true;
                DEBUG_JSX.log("  →OUT+");
                
                var newLayerEndTime = layer.startTime + (layer.outPoint - layer.inPoint);
                if (newLayerEndTime > furthestTime) {
                    furthestTime = newLayerEndTime;
                }
                
            } else {
                // Content ends before playhead - skip
                DEBUG_JSX.log("  →SKIP");
            }
            
            if (layerMoved) {
                movedLayers++;
            }
            
            // Move keyframes on this layer
            // CRITICAL: Use contentStartTime (not layerStartTime) to handle Time Remap correctly
            // For Time Remap layers, content can start before the layer's startTime
            // Only skip keyframes if the entire content starts at/after playhead (layer was moved entirely)
            if (contentStartTime < playheadTime) {
                DEBUG_JSX.log("  Keys@" + layer.name.substring(0, 10));
                var keyframeResult = moveKeyframesAfterTime(layer, playheadTime, timeOffset, processedItems);
                DEBUG_JSX.log("    " + keyframeResult.moved + "k");
                movedKeyframes += keyframeResult.moved;
                if (keyframeResult.furthestTime > furthestTime) {
                    furthestTime = keyframeResult.furthestTime;
                }
            } else {
                DEBUG_JSX.log("  Skip keys (moved)");
            }
            
            // Process precomps (5 levels deep)
            // Only process precomp contents if the playhead is over the ACTIVE content area
            // SKIP if shift+click (skipPrecomps = true)
            if (layer.source && layer.source instanceof CompItem && !skipPrecomps) {
                DEBUG_JSX.log("  PC: " + layer.source.name.substring(0, 15));

                // CRITICAL: Use the same content boundaries we calculated above!
                // contentStartTime and contentEndTime already account for trimmed vs natural layers
                DEBUG_JSX.log("    PC@" + contentStartTime.toFixed(2) + "-" + contentEndTime.toFixed(2) + "s");

                // Only process if playhead is within the active content area
                if (playheadTime >= contentStartTime && playheadTime < contentEndTime) {
                    DEBUG_JSX.log("    →Process PC (playhead in active area)");
                    var precompResult = processPrecompContents(layer.source, layer, playheadTime, timeOffset, frameRate, 1);
                    movedKeyframes += precompResult.movedKeyframes;
                    movedLayers += precompResult.movedLayers;
                    movedLabels += precompResult.movedLabels || 0;
                    if (precompResult.furthestTime > furthestTime) {
                        furthestTime = precompResult.furthestTime;
                    }
                    DEBUG_JSX.log("    PC: " + precompResult.movedKeyframes + "k/" + precompResult.movedLayers + "L");
                } else {
                    DEBUG_JSX.log("    Skip PC (playhead not in active area)");
                }
            } else if (layer.source && layer.source instanceof CompItem && skipPrecomps) {
                DEBUG_JSX.log("  PC: " + layer.source.name.substring(0, 15) + " [SKIPPED - Shift+click]");
            }
            
            // Re-lock layer if it was locked
            if (wasLocked) {
                layer.locked = true;
            }
            } catch(layerError) {
                errorCount++;
            }
        }
        
        // Move composition labels after processing all layers
        var movedLabels = moveLabelsAfterTime(comp, playheadTime, timeOffset);
        
        // Summary for debug output
        var totalItems = movedKeyframes + movedLayers + movedLabels;
        DEBUG_JSX.log("RESULT: " + movedKeyframes + "k/" + movedLayers + "L/" + movedLabels + "m @" + (timeOffset * 1000).toFixed(0) + "ms");
        
        // Adjust composition duration: never shrink, always extend by delay amount when moving forward
        if (timeOffset > 0) {
            // Extending forward: always extend comp by exactly the delay amount
            var newDuration = originalDuration + timeOffset;
            comp.duration = newDuration;
            DEBUG_JSX.log("Extended comp by delay amount: " + originalDuration.toFixed(2) + "s→" + newDuration.toFixed(2) + "s");
        }
        // For backward movement (timeOffset < 0): Never change comp duration - never shrink
        
        // CACHE REFRESH FIX: Force AE to refresh precomp layers when their source durations were extended
        // This fixes the "empty frames at end" visual bug by forcing cache invalidation
        try {
            DEBUG_JSX.log("Cache refresh...");
            var refreshedPrecomps = 0;
            
            // Go through all layers in the main comp to find precomp layers
            for (var i = 1; i <= comp.numLayers; i++) {
                try {
                    var layer = comp.layer(i);
                    
                    // Check if this is a precomp layer
                    if (layer.source && layer.source instanceof CompItem) {
                        // Force cache refresh by briefly adjusting outPoint
                        var frameRate = comp.frameRate || 30;
                        var oneFrame = 1 / frameRate;
                        var originalOutPoint = layer.outPoint;
                        
                        // Shrink outPoint by 1 frame, then restore it
                        layer.outPoint = originalOutPoint - oneFrame;
                        layer.outPoint = originalOutPoint;
                        
                        // IMPORTANT: Deselect the layer after refresh to prevent unwanted selection
                        layer.selected = false;
                        
                        refreshedPrecomps++;
                        // More concise debug message
                        DEBUG_JSX.log("  Refresh: " + layer.name);
                    }
                } catch(layerError) {
                    // Continue with next layer if this one fails
                    DEBUG_JSX.log("  Failed to refresh layer " + i + ": " + layerError.toString());
                }
            }
            
            if (refreshedPrecomps > 0) {
                DEBUG_JSX.log("Refreshed " + refreshedPrecomps + " PCs");
            }
        } catch(refreshError) {
            // Don't fail the entire operation if cache refresh fails
            DEBUG_JSX.log("Cache refresh error: " + refreshError.toString());
        }
        
        // FINAL FIX: Ensure NO layers are selected after global delay operation
        // This deselects all layers in the active composition to ensure clean state
        try {
            for (var d = 1; d <= comp.numLayers; d++) {
                try {
                    comp.layer(d).selected = false;
                } catch(e) {
                    // Continue if layer can't be deselected
                }
            }
        } catch(e) {
            // Non-critical if final deselection fails
        }
        
        app.endUndoGroup();
        
        var message = "Moved " + movedKeyframes + " keyframes, " + movedLayers + " layers" + (movedLabels > 0 ? ", " + movedLabels + " labels" : "") + (errorCount > 0 ? " (" + errorCount + " errors)" : "");
        
        // Get all debug messages to return
        var debugMessages = DEBUG_JSX.getMessages();
        
        // Use cumulative value for display
        var displayMs = GLOBAL_DELAY_CUMULATIVE;
        var displayFrames = Math.round((displayMs / 1000) * frameRate);
        
        return "success|" + displayMs + "|" + displayFrames + "|" + message + "|" + debugMessages.join("|");
        
    } catch(e) {
        app.endUndoGroup();
        DEBUG_JSX.error("Global delay failed", e);
        var debugMessages = DEBUG_JSX.getMessages();
        return "error|Global delay failed: " + e.toString() + "|" + debugMessages.join("|");
    }
}

// Helper function to move keyframes after specific time on a single layer
function moveKeyframesAfterTime(layer, cutoffTime, timeOffset, processedKeys) {
    var movedCount = 0;
    var furthestTime = 0;
    var errorCount = 0; // Track errors for concise reporting
    
    // DEBUG_JSX.log("  → moveKeyframesAfterTime for layer: " + layer.name + ", cutoff: " + cutoffTime.toFixed(3) + "s, offset: " + timeOffset.toFixed(3) + "s");
    
    // Initialize tracking if not provided
    if (!processedKeys) {
        processedKeys = {};
    }
    
    
    try {
        // Process all properties recursively
        function processPropertyGroup(propGroup) {
            for (var i = 1; i <= propGroup.numProperties; i++) {
                var prop = propGroup.property(i);
                
                // Time Remap requires special handling - process it separately
                if (prop && prop.name === "Time Remap") {
                    // Handle Time Remap keyframes with special approach
                    try {
                        var timeRemapKeys = [];
                        for (var j = 1; j <= prop.numKeys; j++) {
                            var keyTime = prop.keyTime(j);
                            if (keyTime >= cutoffTime) {
                                // Create unique key ID for tracking
                                var keyId = layer.index + "_TimeRemap_" + j + "_" + keyTime.toFixed(3);

                                // Skip if already processed
                                if (processedKeys[keyId]) {
                                    continue;
                                }

                                var newTime = keyTime + timeOffset;
                                var keyData = {
                                    index: j,
                                    oldTime: keyTime,
                                    newTime: newTime,
                                    value: prop.keyValue(j),
                                    keyId: keyId,
                                    inInterp: prop.keyInInterpolationType(j),
                                    outInterp: prop.keyOutInterpolationType(j),
                                    temporalContinuous: prop.keyTemporalContinuous(j),
                                    temporalAutoBezier: prop.keyTemporalAutoBezier(j),
                                    label: prop.keyLabel(j)
                                };

                                // Collect temporal ease if bezier
                                if (keyData.inInterp === KeyframeInterpolationType.BEZIER ||
                                    keyData.outInterp === KeyframeInterpolationType.BEZIER) {
                                    try {
                                        keyData.inEase = prop.keyInTemporalEase(j);
                                        keyData.outEase = prop.keyOutTemporalEase(j);
                                    } catch(e) {}
                                }

                                timeRemapKeys.push(keyData);

                                // Mark as processed
                                processedKeys[keyId] = true;
                            }
                        }

                        // PROTECTION: Capture the FIRST keyframe that is NOT being moved (right before cutoffTime)
                        var protectKeyIndex = null;
                        for (var j = 1; j <= prop.numKeys; j++) {
                            if (prop.keyTime(j) < cutoffTime) {
                                protectKeyIndex = j;
                            } else {
                                break;
                            }
                        }
                        var nextKeyData = protectKeyIndex ? captureKeyframeState(prop, protectKeyIndex) : null;

                        if (timeRemapKeys.length > 0) {
                            DEBUG_JSX.log("    Time Remap: Moving " + timeRemapKeys.length + " keyframes");

                            // EASING PRESERVATION: Scale easing when duration changes due to global delay
                            if (protectKeyIndex !== null && nextKeyData !== null) {
                                try {
                                    var stationaryKeyTime = prop.keyTime(protectKeyIndex);
                                    var firstMovingOldTime = timeRemapKeys[0].oldTime;
                                    var firstMovingNewTime = timeRemapKeys[0].newTime;

                                    var oldDuration = firstMovingOldTime - stationaryKeyTime;
                                    var newDuration = firstMovingNewTime - stationaryKeyTime;

                                    if (Math.abs(oldDuration - newDuration) > 0.001 && oldDuration > 0 && newDuration > 0) {
                                        DEBUG_JSX.log("    🔧 Time Remap duration change: " + (oldDuration * 1000).toFixed(0) + "ms → " + (newDuration * 1000).toFixed(0) + "ms");

                                        // Scale the IN ease of the first moving keyframe
                                        if (timeRemapKeys[0].inEase !== undefined) {
                                            var scaledInEase = scaleEaseForDuration(timeRemapKeys[0].inEase, oldDuration, newDuration);
                                            if (scaledInEase) {
                                                timeRemapKeys[0].inEase = scaledInEase;
                                                DEBUG_JSX.log("    ✓ Scaled Time Remap IN ease");
                                            }
                                        }

                                        // Scale the OUT ease of the stationary keyframe
                                        if (nextKeyData.outEase !== undefined) {
                                            var scaledOutEase = scaleEaseForDuration(nextKeyData.outEase, oldDuration, newDuration);
                                            if (scaledOutEase) {
                                                nextKeyData.outEase = scaledOutEase;
                                                DEBUG_JSX.log("    ✓ Scaled Time Remap OUT ease of stationary key");
                                            }
                                        }
                                    }
                                } catch(easingScaleError) {
                                    DEBUG_JSX.log("    Warning: Could not scale Time Remap easing: " + easingScaleError.toString());
                                }
                            }

                            // FIRST: Add new keyframes using setValueAtTime with stored values
                            for (var k = 0; k < timeRemapKeys.length; k++) {
                                var keyData = timeRemapKeys[k];
                                prop.setValueAtTime(keyData.newTime, keyData.value);
                                DEBUG_JSX.log("    Added Time Remap key at " + keyData.newTime.toFixed(3) + "s with value " + keyData.value);

                                // Immediately restore properties on this keyframe
                                for (var j = 1; j <= prop.numKeys; j++) {
                                    if (Math.abs(prop.keyTime(j) - keyData.newTime) < 0.001) {
                                        try {
                                            // Restore EXACTLY as collected (same as normal properties)
                                            prop.setInterpolationTypeAtKey(j, keyData.inInterp, keyData.outInterp);
                                            if (keyData.inEase !== undefined && keyData.outEase !== undefined) {
                                                prop.setTemporalEaseAtKey(j, keyData.inEase, keyData.outEase);
                                            }
                                            prop.setTemporalContinuousAtKey(j, keyData.temporalContinuous);
                                            prop.setTemporalAutoBezierAtKey(j, keyData.temporalAutoBezier);
                                            if (keyData.label !== undefined && keyData.label !== 0) {
                                                prop.setLabelAtKey(j, keyData.label);
                                            }
                                        } catch(e) {}
                                        break;
                                    }
                                }
                            }

                            // SECOND: Remove old keyframes (only those not at new positions)
                            var indicesToRemove = [];
                            for (var k = 0; k < timeRemapKeys.length; k++) {
                                var oldTime = timeRemapKeys[k].oldTime;
                                for (var j = prop.numKeys; j >= 1; j--) {
                                    var keyTime = prop.keyTime(j);
                                    if (Math.abs(keyTime - oldTime) < 0.001) {
                                        // Check if this is a new keyframe position
                                        var isNewPosition = false;
                                        for (var n = 0; n < timeRemapKeys.length; n++) {
                                            if (Math.abs(keyTime - timeRemapKeys[n].newTime) < 0.001) {
                                                isNewPosition = true;
                                                break;
                                            }
                                        }
                                        if (!isNewPosition) {
                                            indicesToRemove.push(j);
                                        }
                                        break;
                                    }
                                }
                            }

                            // Remove old keys in descending order
                            indicesToRemove.sort(function(a, b) { return b - a; });
                            for (var k = 0; k < indicesToRemove.length; k++) {
                                try {
                                    prop.removeKey(indicesToRemove[k]);
                                    DEBUG_JSX.log("    Removed old Time Remap key at index " + indicesToRemove[k]);
                                } catch(e) {
                                    DEBUG_JSX.log("    Could not remove Time Remap key: " + e.toString());
                                }
                            }

                            // Update moved count and furthest time
                            movedCount += timeRemapKeys.length;
                            for (var k = 0; k < timeRemapKeys.length; k++) {
                                if (timeRemapKeys[k].newTime > furthestTime) {
                                    furthestTime = timeRemapKeys[k].newTime;
                                }
                            }

                            DEBUG_JSX.log("    Time Remap: Moved " + timeRemapKeys.length + " keyframes successfully");

                            // PROTECTION: Restore the protected keyframe
                            if (nextKeyData !== null && protectKeyIndex) {
                                restoreKeyframeState(prop, protectKeyIndex, nextKeyData);
                            }
                        }
                    } catch(timeRemapError) {
                        DEBUG_JSX.log("    Time Remap error: " + timeRemapError.toString());
                        // Continue processing other properties
                    }
                    continue; // Skip to next property
                }
                
                // Skip Hue/Saturation effects - they can't be moved reliably
                if (prop && (prop.name === "Hue/Saturation" || prop.matchName === "ADBE HUE SATURATION")) {
                    DEBUG_JSX.log("  SKIPPING Hue/Saturation effect (not supported for global delay)");
                    continue;
                }
                
                // Enhanced property validation with better error handling for effects
                if (prop && prop.canVaryOverTime && prop.numKeys > 0) {
                    
                    // Additional validation for effect properties
                    try {
                        // Test if we can access the property's keyframes
                        var testTime = prop.keyTime(1);
                        var testValue = prop.keyValue(1);
                        
                        // Check if this is an effect property that might not work well with global delay
                        var parentEffect = null;
                        try {
                            // Walk up the property hierarchy to find the parent effect
                            var tempProp = prop;
                            while (tempProp && tempProp.parentProperty) {
                                tempProp = tempProp.parentProperty;
                                if (tempProp && (tempProp.name === "Effects" || tempProp.matchName === "ADBE Effect Parade")) {
                                    break;
                                }
                                if (tempProp.matchName && tempProp.matchName.indexOf("ADBE") === 0 && tempProp.matchName !== "ADBE Effect Parade") {
                                    parentEffect = tempProp;
                                    break;
                                }
                            }
                        } catch(parentError) {
                            // Can't determine parent effect, continue anyway
                        }
                        
                        // Add debugging info for effect properties (concise) - only show key effects with keyframes
                        if (parentEffect && prop.numKeys > 0 && 
                            (parentEffect.name.indexOf("Tint") !== -1 || 
                             parentEffect.name.indexOf("Brightness") !== -1 || 
                             parentEffect.name.indexOf("Blur") !== -1)) {
                            DEBUG_JSX.log("  Effect: " + parentEffect.name + " → " + prop.name + " (" + prop.numKeys + " keys)");
                        }
                        
                        // Add specific logging for Size properties
                        if (prop.name === "Size" && prop.numKeys > 0) {
                            var fullPath = getFullPropertyPath(prop);
                            DEBUG_JSX.log("  🎯 FOUND Size property: " + fullPath + " (" + prop.numKeys + " keys)");
                        }
                        
                    } catch(accessError) {
                        DEBUG_JSX.log("  SKIPPING property (access error): " + prop.name + " - " + accessError.toString());
                        continue;
                    }
                    
                    // Skip Position property when dimensions are separated (it becomes hidden)
                    // When dimensions are separated, use X Position and Y Position instead
                    if (prop.name === "Position") {
                        // Check if this is the transform Position property with separated dimensions
                        try {
                            // Try to get parent group to check if it's Transform
                            var parentGroup = propGroup.property(i).parentProperty;
                            if (parentGroup && parentGroup.name === "Transform") {
                                // Check if dimensions are separated
                                if (parentGroup.property("Position").dimensionsSeparated) {
                                    // Skip this hidden Position property
                                    continue;
                                }
                            }
                        } catch(e) {
                            // If we can't check, try to access keyframe value to detect if hidden
                            try {
                                var testValue = prop.keyValue(1);
                            } catch(accessError) {
                                if (accessError.toString().indexOf("hidden") !== -1 || 
                                    accessError.toString().indexOf("Hidden") !== -1) {
                                    // Property is hidden, skip it
                                    continue;
                                }
                            }
                        }
                    }
                    
                    // PROTECTION: Capture the last keyframe BEFORE cutoffTime (the one that's NOT being moved)
                    var protectKeyIndex = null;
                    for (var j = prop.numKeys; j >= 1; j--) {
                        if (prop.keyTime(j) < cutoffTime) {
                            protectKeyIndex = j;
                            break;
                        }
                    }
                    var nextKeyData = protectKeyIndex ? captureKeyframeState(prop, protectKeyIndex) : null;

                    // Move keyframes that are at or after cutoff time
                    var keyframesToMove = [];
                    for (var j = 1; j <= prop.numKeys; j++) {
                        var keyTime = prop.keyTime(j);
                        if (keyTime >= cutoffTime) {
                            // Create unique key ID for tracking
                            var uniquePropertyId = getFullPropertyPath(prop);
                            var keyId = layer.index + "_" + uniquePropertyId + "_" + j + "_" + keyTime.toFixed(3);
                            
                            // Special debugging for Tint effects to diagnose duplicate issue
                            if (parentEffect && parentEffect.name.indexOf("Tint") !== -1) {
                                DEBUG_JSX.log("    " + parentEffect.name + " KeyID: " + keyId);
                            }
                            
                            // Check if this key was already processed
                            if (processedKeys[keyId]) {
                                DEBUG_JSX.log("  Skip: " + prop.name + "[" + j + "] (duplicate)");
                                continue;
                            }
                            
                            var newTime = keyTime + timeOffset;
                            keyframesToMove.push({
                                index: j,
                                time: keyTime,
                                newTime: newTime,
                                keyId: keyId
                            });
                            
                            // Mark as processed
                            processedKeys[keyId] = true;
                            // Log the actual movement for first few keyframes only
                            if (keyframesToMove.length <= 2) {
                                var actualMovementMs = (newTime - keyTime) * 1000;
                                var expectedMs = timeOffset * 1000;
                                if (Math.abs(actualMovementMs - expectedMs) > 1) {
                                    DEBUG_JSX.log("  WARNING: Key " + j + " moved " + actualMovementMs.toFixed(0) + "ms but expected " + expectedMs.toFixed(0) + "ms!");
                                }
                            }
                        }
                    }
                    
                    if (keyframesToMove.length === 0) {
                        continue; // No keyframes to move
                    }
                    
                    // Special debugging for Tint effects (commented out to reduce verbosity)
                    // if (parentEffect && parentEffect.name.indexOf("Tint") !== -1) {
                    //     DEBUG_JSX.log("    Moving " + keyframesToMove.length + " keyframes for " + parentEffect.name + " → " + prop.name);
                    // }
                    
                    // Collect all keyframe data first
                    var keyframeData = [];
                    for (var k = 0; k < keyframesToMove.length; k++) {
                        var keyInfo = keyframesToMove[k];
                        try {
                            var data = {
                                oldIndex: keyInfo.index,
                                newTime: keyInfo.newTime,
                                value: prop.keyValue(keyInfo.index),
                                inInterp: prop.keyInInterpolationType(keyInfo.index),
                                outInterp: prop.keyOutInterpolationType(keyInfo.index),
                                temporalContinuous: prop.keyTemporalContinuous(keyInfo.index),
                                temporalAutoBezier: prop.keyTemporalAutoBezier(keyInfo.index),
                                // CRITICAL: Preserve keyframe color labels
                                label: prop.keyLabel(keyInfo.index)
                            };
                            
                            // Debug logging for ALL keyframe label collection (not just Slider)
                            if (data.label !== undefined && data.label !== 0) {
                                var propDescription = prop.name;
                                if (parentEffect) {
                                    propDescription = parentEffect.name + "→" + prop.name;
                                }
                                DEBUG_JSX.log("    → Collected LABEL " + data.label + " from " + propDescription + "[" + keyInfo.index + "]");
                            }
                            
                            // Only collect temporal ease if it's a bezier keyframe
                            if (data.inInterp === KeyframeInterpolationType.BEZIER || 
                                data.outInterp === KeyframeInterpolationType.BEZIER) {
                                try {
                                    data.inEase = prop.keyInTemporalEase(keyInfo.index);
                                    data.outEase = prop.keyOutTemporalEase(keyInfo.index);
                                } catch(e) {
                                    // Temporal ease might not be available
                                }
                            }
                            
                            // Handle spatial properties if applicable
                            if (prop.isSpatial) {
                                try {
                                    data.spatialContinuous = prop.keySpatialContinuous(keyInfo.index);
                                    data.spatialAutoBezier = prop.keySpatialAutoBezier(keyInfo.index);
                                    data.inTangent = prop.keyInSpatialTangent(keyInfo.index);
                                    data.outTangent = prop.keyOutSpatialTangent(keyInfo.index);
                                } catch(e) {
                                    // Spatial properties might not be available
                                }
                            }
                            
                            keyframeData.push(data);
                        } catch(e) {
                            // Silently increment error count
                            errorCount++;
                        }
                    }
                    
                    // Only proceed if we successfully read keyframe data
                    if (keyframeData.length > 0) {
                        // EASING PRESERVATION: Scale easing when duration changes due to global delay
                        // If there's a stationary keyframe before the first moving keyframe,
                        // the duration between them changes and we need to scale the easing
                        if (protectKeyIndex !== null && keyframesToMove.length > 0 && nextKeyData !== null) {
                            try {
                                var stationaryKeyTime = prop.keyTime(protectKeyIndex);
                                var firstMovingOldTime = keyframesToMove[0].time;
                                var firstMovingNewTime = keyframesToMove[0].newTime;

                                var oldDuration = firstMovingOldTime - stationaryKeyTime;
                                var newDuration = firstMovingNewTime - stationaryKeyTime;

                                if (Math.abs(oldDuration - newDuration) > 0.001 && oldDuration > 0 && newDuration > 0) {
                                    DEBUG_JSX.log("  🔧 Global Delay duration change detected:");
                                    DEBUG_JSX.log("    " + prop.name + ": " + (oldDuration * 1000).toFixed(0) + "ms → " + (newDuration * 1000).toFixed(0) + "ms");

                                    // Scale the IN ease of the first moving keyframe
                                    // (affects curve FROM stationary keyframe TO this one)
                                    if (keyframeData.length > 0 && keyframeData[0].inEase !== undefined) {
                                        var scaledInEase = scaleEaseForDuration(keyframeData[0].inEase, oldDuration, newDuration);
                                        if (scaledInEase) {
                                            keyframeData[0].inEase = scaledInEase;
                                            DEBUG_JSX.log("    ✓ Scaled IN ease of first moving keyframe");
                                        }
                                    }

                                    // Scale the OUT ease of the stationary keyframe
                                    // (affects curve FROM stationary TO first moving keyframe)
                                    if (nextKeyData.outEase !== undefined) {
                                        var scaledOutEase = scaleEaseForDuration(nextKeyData.outEase, oldDuration, newDuration);
                                        if (scaledOutEase) {
                                            nextKeyData.outEase = scaledOutEase;
                                            DEBUG_JSX.log("    ✓ Scaled OUT ease of stationary keyframe");
                                        }
                                    }
                                }
                            } catch(easingScaleError) {
                                DEBUG_JSX.log("  Warning: Could not scale easing for global delay: " + easingScaleError.toString());
                            }
                        }

                        // Special logging for Size properties
                        if (prop.name === "Size") {
                            DEBUG_JSX.log("  🎯 MOVING " + keyframeData.length + " Size keyframes on " + layer.name);
                        }
                        // Remove old keyframes in reverse order to avoid index shifts
                        var indices = [];
                        for (var k = 0; k < keyframeData.length; k++) {
                            indices.push(keyframeData[k].oldIndex);
                        }
                        indices.sort(function(a, b) { return b - a; }); // Sort in reverse order
                        
                        for (var k = 0; k < indices.length; k++) {
                            try {
                                prop.removeKey(indices[k]);
                            } catch(e) {
                                // Silently increment error count
                                errorCount++;
                            }
                        }
                        
                        // Add new keyframes at new times
                        for (var k = 0; k < keyframeData.length; k++) {
                            try {
                                var data = keyframeData[k];
                                var newIndex = prop.addKey(data.newTime);
                                
                                // Restore all attributes
                                prop.setValueAtKey(newIndex, data.value);

                                // Apply temporal ease first to avoid flipping linear sides
                                if (data.inEase !== undefined && data.outEase !== undefined) {
                                    try {
                                        prop.setTemporalEaseAtKey(newIndex, data.inEase, data.outEase);
                                    } catch(e) {
                                        // Some properties might not support temporal ease
                                    }
                                }

                                // Then re-assert original interpolation types
                                prop.setInterpolationTypeAtKey(newIndex, data.inInterp, data.outInterp);

                                // Restore temporal attributes
                                prop.setTemporalContinuousAtKey(newIndex, data.temporalContinuous);
                                prop.setTemporalAutoBezierAtKey(newIndex, data.temporalAutoBezier);
                                
                                // Restore spatial attributes if applicable
                                if (data.spatialContinuous !== undefined) {
                                    try {
                                        prop.setSpatialContinuousAtKey(newIndex, data.spatialContinuous);
                                        prop.setSpatialAutoBezierAtKey(newIndex, data.spatialAutoBezier);
                                        // Only restore tangents if NOT auto-bezier (manual tangent control)
                                        if (!data.spatialAutoBezier && data.inTangent !== undefined && data.outTangent !== undefined) {
                                            prop.setSpatialTangentsAtKey(newIndex, data.inTangent, data.outTangent);
                                        }
                                    } catch(e) {
                                        // Spatial properties might not be available
                                    }
                                }
                                
                                // CRITICAL: Restore keyframe color label
                                if (data.label !== undefined && data.label !== 0) {
                                    try {
                                        // Correct method name is setLabelAtKey (not setKeyLabel)
                                        prop.setLabelAtKey(newIndex, data.label);
                                        var propDescription = prop.name;
                                        if (parentEffect) {
                                            propDescription = parentEffect.name + "→" + prop.name;
                                        }
                                        DEBUG_JSX.log("    ✓ Restored LABEL " + data.label + " to " + propDescription + "[" + newIndex + "]");
                                    } catch(e) {
                                        // Label setting might fail on some property types
                                        var propDescription = prop.name;
                                        if (parentEffect) {
                                            propDescription = parentEffect.name + "→" + prop.name;
                                        }
                                        DEBUG_JSX.log("    ✗ Failed to restore LABEL to " + propDescription + ": " + e.toString());
                                    }
                                }
                                
                                // IMMEDIATELY deselect the keyframe to prevent selection flicker
                                try {
                                    prop.setSelectedAtKey(newIndex, false);
                                } catch(e) {
                                    // Continue even if deselection fails
                                }
                                
                                movedCount++;
                                if (data.newTime > furthestTime) {
                                    furthestTime = data.newTime;
                                }
                            } catch(e) {
                                // Silently increment error count
                                errorCount++;
                            }
                        }

                        // PROTECTION: Restore the protected keyframe
                        if (nextKeyData !== null && protectKeyIndex) {
                            restoreKeyframeState(prop, protectKeyIndex, nextKeyData);
                        }
                    }
                }
                
                // Recurse into property groups with enhanced error handling for effects
                if (prop && (prop.propertyType === PropertyType.INDEXED_GROUP || 
                           prop.propertyType === PropertyType.NAMED_GROUP)) {
                    try {
                        // Add debug info for effect groups
                        if (prop.matchName && prop.matchName.indexOf("ADBE") === 0 && prop.matchName !== "ADBE Effect Parade") {
                            // DEBUG_JSX.log("  Recursing into effect: " + prop.name + " (" + prop.matchName + ")");
                        }
                        processPropertyGroup(prop);
                    } catch(recursionError) {
                        DEBUG_JSX.log("  Error recursing into property group " + prop.name + ": " + recursionError.toString());
                        // Continue processing other properties
                    }
                }
            }
        }
        
        // Process ALL property groups on the layer
        // 1. Transform properties
        if (layer.transform) {
            DEBUG_JSX.log("🔍 LABEL DEBUG: Processing transform properties for " + layer.name);
            processPropertyGroup(layer.transform);
        }
        
        // 2. Effects
        if (layer.effect && layer.effect.numProperties > 0) {
            DEBUG_JSX.log("🔍 LABEL DEBUG: Processing effects for " + layer.name);
            processPropertyGroup(layer.effect);
        }
        
        // 2.5. Shape layer Contents (CRITICAL for shape layers!)
        try {
            if (layer.content && layer.content.numProperties > 0) {
                DEBUG_JSX.log("🔍 Processing Shape layer contents for " + layer.name + " (" + layer.content.numProperties + " groups)");
                processPropertyGroup(layer.content);
            }
        } catch(e) {
            // Not a shape layer or contents not accessible
            DEBUG_JSX.log("Not a shape layer or contents not accessible for " + layer.name + ": " + e.toString());
        }
        
        // 3. Masks
        if (layer.mask && layer.mask.numProperties > 0) {
            processPropertyGroup(layer.mask);
        }
        
        // 4. Layer Styles
        if (layer.layerStyle && layer.layerStyle.numProperties > 0) {
            processPropertyGroup(layer.layerStyle);
        }
        
        // 5. Text properties
        if (layer.text && layer.text.numProperties > 0) {
            processPropertyGroup(layer.text);
        }
        
        // 6. Material Options for 3D layers
        if (layer.materialOption && layer.materialOption.numProperties > 0) {
            processPropertyGroup(layer.materialOption);
        }
        
        // 7. Audio properties
        if (layer.audio && layer.audio.numProperties > 0) {
            processPropertyGroup(layer.audio);
        }

        // 7.5. Light Options (for light layers)
        try {
            if (layer.lightOption && layer.lightOption.numProperties > 0) {
                DEBUG_JSX.log("🔍 Processing Light properties for " + layer.name);
                processPropertyGroup(layer.lightOption);
            }
        } catch(e) {
            // Not a light layer or light options not accessible
        }

        // 7.6. Camera Options (for camera layers)
        try {
            if (layer.cameraOption && layer.cameraOption.numProperties > 0) {
                DEBUG_JSX.log("🔍 Processing Camera properties for " + layer.name);
                processPropertyGroup(layer.cameraOption);
            }
        } catch(e) {
            // Not a camera layer or camera options not accessible
        }

        // 7.7. Essential Properties (Master Properties exposed on precomps)
        try {
            var essentialProps = layer.property("ADBE Layer Overrides");
            if (essentialProps && essentialProps.numProperties > 0) {
                DEBUG_JSX.log("🔍 Processing Essential Properties for " + layer.name + " (" + essentialProps.numProperties + " props)");
                // Log each essential property for debugging
                for (var ep = 1; ep <= essentialProps.numProperties; ep++) {
                    var epProp = essentialProps.property(ep);
                    if (epProp) {
                        var epInfo = "  EP[" + ep + "]: " + epProp.name;
                        epInfo += " | type=" + epProp.propertyType;
                        epInfo += " | canVary=" + epProp.canVaryOverTime;
                        epInfo += " | numKeys=" + (epProp.numKeys || 0);
                        if (epProp.numProperties) {
                            epInfo += " | numProps=" + epProp.numProperties;
                        }
                        DEBUG_JSX.log(epInfo);
                    }
                }
                processPropertyGroup(essentialProps);
            }
        } catch(e) {
            DEBUG_JSX.log("Essential Properties error: " + e.toString());
        }

        // 8. Time Remap - special layer property (not in any property group)
        // Must be handled separately at the layer level
        try {
            if (layer.timeRemapEnabled && layer.timeRemap && layer.timeRemap.numKeys > 0) {
                var prop = layer.timeRemap;
                var timeRemapKeys = [];
                
                for (var j = 1; j <= prop.numKeys; j++) {
                    var keyTime = prop.keyTime(j);
                    if (keyTime >= cutoffTime) {
                        // Create unique key ID for tracking
                        var keyId = layer.index + "_TimeRemap_" + j + "_" + keyTime.toFixed(3);

                        // Skip if already processed
                        if (processedKeys[keyId]) {
                            continue;
                        }

                        var newTime = keyTime + timeOffset;
                        var keyData = {
                            index: j,
                            oldTime: keyTime,
                            newTime: newTime,
                            value: prop.keyValue(j),
                            keyId: keyId,
                            inInterp: prop.keyInInterpolationType(j),
                            outInterp: prop.keyOutInterpolationType(j),
                            temporalContinuous: prop.keyTemporalContinuous(j),
                            temporalAutoBezier: prop.keyTemporalAutoBezier(j),
                            label: prop.keyLabel(j)
                        };

                        // Collect temporal ease if bezier
                        if (keyData.inInterp === KeyframeInterpolationType.BEZIER ||
                            keyData.outInterp === KeyframeInterpolationType.BEZIER) {
                            try {
                                keyData.inEase = prop.keyInTemporalEase(j);
                                keyData.outEase = prop.keyOutTemporalEase(j);
                            } catch(e) {}
                        }

                        timeRemapKeys.push(keyData);

                        // Mark as processed
                        processedKeys[keyId] = true;
                    }
                }
                
                if (timeRemapKeys.length > 0) {
                    DEBUG_JSX.log("    Time Remap: Moving " + timeRemapKeys.length + " keyframes on " + layer.name);

                    // FIRST: Add new keyframes using setValueAtTime with stored values
                    for (var k = 0; k < timeRemapKeys.length; k++) {
                        var keyData = timeRemapKeys[k];
                        prop.setValueAtTime(keyData.newTime, keyData.value);
                        DEBUG_JSX.log("    Added Time Remap key at " + keyData.newTime.toFixed(3) + "s with value " + keyData.value);

                        // Immediately restore properties on this keyframe
                        for (var j = 1; j <= prop.numKeys; j++) {
                            if (Math.abs(prop.keyTime(j) - keyData.newTime) < 0.001) {
                                try {
                                    // Restore EXACTLY as collected (same as normal properties)
                                    prop.setInterpolationTypeAtKey(j, keyData.inInterp, keyData.outInterp);
                                    if (keyData.inEase !== undefined && keyData.outEase !== undefined) {
                                        prop.setTemporalEaseAtKey(j, keyData.inEase, keyData.outEase);
                                    }
                                    prop.setTemporalContinuousAtKey(j, keyData.temporalContinuous);
                                    prop.setTemporalAutoBezierAtKey(j, keyData.temporalAutoBezier);
                                    if (keyData.label !== undefined && keyData.label !== 0) {
                                        prop.setLabelAtKey(j, keyData.label);
                                    }
                                } catch(e) {}
                                break;
                            }
                        }
                    }

                    // SECOND: Remove old keyframes (only those not at new positions)
                    var indicesToRemove = [];
                    for (var k = 0; k < timeRemapKeys.length; k++) {
                        var oldTime = timeRemapKeys[k].oldTime;
                        for (var j = prop.numKeys; j >= 1; j--) {
                            var keyTime = prop.keyTime(j);
                            if (Math.abs(keyTime - oldTime) < 0.001) {
                                // Check if this is a new keyframe position
                                var isNewPosition = false;
                                for (var n = 0; n < timeRemapKeys.length; n++) {
                                    if (Math.abs(keyTime - timeRemapKeys[n].newTime) < 0.001) {
                                        isNewPosition = true;
                                        break;
                                    }
                                }
                                if (!isNewPosition) {
                                    indicesToRemove.push(j);
                                }
                                break;
                            }
                        }
                    }

                    // Remove old keys in descending order
                    indicesToRemove.sort(function(a, b) { return b - a; });
                    for (var k = 0; k < indicesToRemove.length; k++) {
                        try {
                            prop.removeKey(indicesToRemove[k]);
                            DEBUG_JSX.log("    Removed old Time Remap key at index " + indicesToRemove[k]);
                        } catch(e) {
                            DEBUG_JSX.log("    Could not remove Time Remap key: " + e.toString());
                        }
                    }

                    // Update moved count and furthest time
                    movedCount += timeRemapKeys.length;
                    for (var k = 0; k < timeRemapKeys.length; k++) {
                        if (timeRemapKeys[k].newTime > furthestTime) {
                            furthestTime = timeRemapKeys[k].newTime;
                        }
                    }

                    DEBUG_JSX.log("    Time Remap: Moved " + timeRemapKeys.length + " keyframes successfully");
                }
            }
        } catch(timeRemapError) {
            DEBUG_JSX.log("    Time Remap error: " + timeRemapError.toString());
            // Continue processing
        }
        
    } catch(e) {
        // Only log if it's a significant error
        if (e.toString().indexOf("hidden") === -1) {
            DEBUG_JSX.log("Error: " + layer.name + " - " + e.toString());
        }
    }
    
    return {
        moved: movedCount,
        furthestTime: furthestTime
    };
}

// Helper function to process precomp contents recursively (up to 5 levels deep)
function processPrecompContents(precomp, precompLayer, mainPlayheadTime, timeOffset, frameRate, depth) {
    var movedKeyframes = 0;
    var movedLayers = 0;
    var movedLabels = 0;
    var furthestTime = 0;
    
    if (depth > 5) {
        DEBUG_JSX.log("Max depth reached, skipping deeper precomps");
        return { movedKeyframes: 0, movedLayers: 0, movedLabels: 0, furthestTime: 0 };
    }
    
    try {
        // Convert main comp playhead time to precomp's internal time
        var precompPlayheadTime = mainPlayheadTime - precompLayer.startTime;
        if (precompPlayheadTime < 0) precompPlayheadTime = 0;
        if (precompPlayheadTime > precomp.duration) precompPlayheadTime = precomp.duration;
        
        // Only log if we're actually going to move something
        var logPrecomp = false;
        
        for (var i = 1; i <= precomp.numLayers; i++) {
            var layer = precomp.layer(i);
            
            // Handle locked layers
            var wasLocked = layer.locked;
            if (wasLocked) {
                layer.locked = false;
            }
            
            // Calculate actual timeline positions of layer's in and out points (same logic as main comp)
            // For visible content position: distinguish between trimmed and naturally positioned layers
            // Apply the same fix as layer delay reading (Challenge 8 in KEYFRAME_SYSTEM_SUMMARY.md)
            // Natural layers: visual position = startTime
            // Trimmed layers: visual position = inPoint value directly
            var layerTimelineInPoint;
            if (Math.abs(layer.inPoint - layer.startTime) < 0.001) {
                // Layer is naturally positioned (not trimmed) - visible content starts at startTime
                layerTimelineInPoint = layer.startTime;
            } else {
                // Layer is trimmed - the visual bar position is at the inPoint value
                // This is the key fix: use inPoint directly, not startTime + inPoint
                layerTimelineInPoint = layer.inPoint;
            }
            var layerTimelineOutPoint = layer.startTime + layer.outPoint;
            
            // Move layer timing if it's at or after playhead in precomp time
            var layerMoved = false;
            if (layerTimelineInPoint >= precompPlayheadTime) {
                // Both in and out points are at/after playhead - move entire layer
                layer.startTime += timeOffset;
                layerMoved = true;
                
                // Track furthest time
                var layerEndTime = layer.startTime + (layer.outPoint - layer.inPoint);
                if (layerEndTime > furthestTime) {
                    furthestTime = layerEndTime;
                }
            } else if (layerTimelineOutPoint > precompPlayheadTime) {
                // Layer starts before playhead but extends past it - extend outPoint only
                layer.outPoint += timeOffset;
                layerMoved = true;
                
                var newLayerEndTime = layer.startTime + (layer.outPoint - layer.inPoint);
                if (newLayerEndTime > furthestTime) {
                    furthestTime = newLayerEndTime;
                }
            }
            if (layerMoved) {
                movedLayers++;
            }
            
            // Move keyframes on this layer
            // Only move keyframes if the layer's inPoint is before playhead  
            // (If layer's inPoint is at/after playhead, it was moved entirely and keyframes move with it)
            if (layerTimelineInPoint < precompPlayheadTime) {
                var keyframeResult = moveKeyframesAfterTime(layer, precompPlayheadTime, timeOffset, null);
                movedKeyframes += keyframeResult.moved;
                if (keyframeResult.furthestTime > furthestTime) {
                    furthestTime = keyframeResult.furthestTime;
                }
            }
            
            // Process nested precomps  
            // CRITICAL FIX: Only process nested precomp contents if the nested precomp layer was NOT moved entirely
            // This prevents cascading double movement in deeply nested precomps
            if (layer.source && layer.source instanceof CompItem) {
                // Use same timeline-based logic to determine if we should process the nested precomp's contents
                if (layerTimelineInPoint < precompPlayheadTime) {
                    // Nested precomp layer spans the playhead - process its contents
                    DEBUG_JSX.log("    Nested[" + (depth + 1) + "]: " + layer.source.name);
                    var nestedPlayheadTime = precompPlayheadTime;
                    var nestedResult = processPrecompContents(layer.source, layer, nestedPlayheadTime, timeOffset, frameRate, depth + 1);
                    movedKeyframes += nestedResult.movedKeyframes;
                    movedLayers += nestedResult.movedLayers;
                    movedLabels += nestedResult.movedLabels || 0;
                    if (nestedResult.furthestTime > furthestTime) {
                        furthestTime = nestedResult.furthestTime;
                    }
                } else {
                    // Nested precomp layer was moved entirely at this level - skip processing its contents
                    DEBUG_JSX.log("    Skipping nested precomp contents: " + layer.source.name + " (layer moved entirely at depth " + depth + ")");
                }
            }
            
            // Re-lock layer if it was locked
            if (wasLocked) {
                layer.locked = true;
            }
        }
        
        // Move precomp labels (markers)
        var labelsResult = moveLabelsAfterTime(precomp, precompPlayheadTime, timeOffset);
        movedLabels += labelsResult;
        
        // Adjust precomp duration: never shrink, always extend by delay amount when moving forward
        var originalPrecompDuration = precomp.duration;
        if (timeOffset > 0) {
            // Extending forward: always extend precomp by exactly the delay amount
            var newPrecompDuration = originalPrecompDuration + timeOffset;
            precomp.duration = newPrecompDuration;
            DEBUG_JSX.log("    Extended precomp " + precomp.name + " by delay: " + originalPrecompDuration.toFixed(2) + "s→" + newPrecompDuration.toFixed(2) + "s");
        }
        // For backward movement (timeOffset < 0): Never change precomp duration - never shrink
        
        // Log summary if anything was moved
        if (movedKeyframes > 0 || movedLayers > 0 || movedLabels > 0) {
            DEBUG_JSX.log("    L" + depth + " " + precomp.name + ": " + movedKeyframes + "k " + movedLayers + "L " + movedLabels + "m");
        }
        
    } catch(e) {
        DEBUG_JSX.log("    Error in " + precomp.name + ": " + e.toString());
    }
    
    return {
        movedKeyframes: movedKeyframes,
        movedLayers: movedLayers,
        movedLabels: movedLabels,
        furthestTime: furthestTime
    };
}

// Dynamic frame-based delay nudging functions
function nudgeDelayWithFrames(direction, frames) {
    try {
        DEBUG_JSX.log("nudgeDelayWithFrames called with direction: " + direction + ", frames: " + frames);
        
        // Reset timeline mode cumulative offset when switching to normal mode
        TIMELINE_MODE_CUMULATIVE_OFFSET = 0;
        
        var comp = app.project.activeItem;
        if (!(comp && comp instanceof CompItem)) {
            return "error|No composition selected";
        }
        
        // Check if nothing is selected - trigger global delay
        var selectedLayers = comp.selectedLayers;
        if (selectedLayers.length === 0) {
            DEBUG_JSX.log("No layers selected - triggering global delay with " + frames + " frames, direction " + direction);
            // Shift+click baseline mode function -> Skip precomps when no selection
            return nudgeFromPlayhead(direction, frames, true);
        }
        
        var frameRate = comp.frameRate || 30;
        var framesToMs = (frames / frameRate) * 1000;
        
        DEBUG_JSX.log("Converting " + frames + " frames to " + framesToMs + "ms at " + frameRate + "fps");
        
        // Use the existing nudgeDelay function but modify the snapping logic
        return nudgeDelayWithCustomIncrement(direction, framesToMs);
        
    } catch(e) {
        var debugMessages = DEBUG_JSX.getMessages();
        return "error|Failed to nudge delay with frames: " + e.toString() + "|" + debugMessages.join("|");
    }
}

// Timeline mode - moves ALL selected keyframes by the same amount (no baseline logic)
// Uses the complete 4-step selection preservation pattern from KEYFRAME_SYSTEM_SUMMARY.md
// Global variable to track cumulative timeline mode offset
var TIMELINE_MODE_CUMULATIVE = 0;
var TIMELINE_MODE_CUMULATIVE_OFFSET = 0;
var LAST_TIMELINE_SELECTION_HASH = ""; // Separate hash for timeline mode that ignores keyframe times
var IS_IN_FORCED_TIMELINE_MODE = false;
var CUSTOM_INCREMENT_MS = 0; // For passing custom increment to forced timeline mode

// Track selection and playhead for auto-reset
var LAST_SELECTION_HASH = "";
var LAST_SELECTION_STRUCTURE = "";
var LAST_SELECTION_ID = "";
var INITIAL_SELECTION_TIME = "";
var LAST_KEYFRAME_SELECTION = "";
var LAST_SELECTION_SIGNATURE = "";
var LAST_KEYFRAME_COUNT = 0;
var LAST_PLAYHEAD_POSITION = -1;

// Helper function to generate a hash of current selection
// Get selection structure without keyframe times (for detecting actual selection changes)
function getSelectionStructure() {
    try {
        var comp = app.project.activeItem;
        if (!comp || !(comp instanceof CompItem)) {
            return "no_comp";
        }
        
        var selectedLayers = comp.selectedLayers;
        if (selectedLayers.length === 0) {
            return "no_selection";
        }
        
        // Build a string representing the selection structure (not including times)
        var structure = "";
        for (var i = 0; i < selectedLayers.length; i++) {
            var layer = selectedLayers[i];
            structure += layer.index + "_";
            
            // Add property and keyframe indices (but not times)
            var selectedProps = layer.selectedProperties;
            for (var j = 0; j < selectedProps.length; j++) {
                var prop = selectedProps[j];
                if (prop && prop.canVaryOverTime && prop.numKeys > 0) {
                    structure += prop.name + ":";
                    var selectedCount = 0;
                    for (var k = 1; k <= prop.numKeys; k++) {
                        if (prop.keySelected(k)) {
                            structure += k + ",";
                            selectedCount++;
                        }
                    }
                    structure += "(" + selectedCount + ");";
                }
            }
        }
        
        return structure;
    } catch(e) {
        return "error";
    }
}


function getSelectionHash() {
    try {
        var comp = app.project.activeItem;
        if (!comp || !(comp instanceof CompItem)) {
            return "no_comp";
        }
        
        var selectedLayers = comp.selectedLayers;
        if (selectedLayers.length === 0) {
            return "no_selection";
        }
        
        // Build a string representing the current selection
        var hash = "";
        for (var i = 0; i < selectedLayers.length; i++) {
            var layer = selectedLayers[i];
            hash += layer.index + "_" + layer.name + ";";
            
            // Add detailed selected keyframe info including which specific keyframes
            var selectedProps = layer.selectedProperties;
            for (var j = 0; j < selectedProps.length; j++) {
                var prop = selectedProps[j];
                if (prop && prop.canVaryOverTime && prop.numKeys > 0) {
                    // Include property name and which specific keyframes are selected
                    var keyInfo = prop.name + ":";
                    var selectedIndices = [];
                    for (var k = 1; k <= prop.numKeys; k++) {
                        if (prop.keySelected(k)) {
                            selectedIndices.push(k);
                            // Also include keyframe time to detect if selecting different keyframe
                            var keyTime = prop.keyTime(k);
                            keyInfo += k + "@" + keyTime.toFixed(3) + ",";
                        }
                    }
                    if (selectedIndices.length > 0) {
                        hash += keyInfo + ";";
                    }
                }
            }
        }
        
        return hash;
    } catch(e) {
        return "error";
    }
}

// Selection hash without keyframe times - for timeline mode cumulative tracking
function getSelectionHashWithoutTimes() {
    try {
        var comp = app.project.activeItem;
        if (!comp || !(comp instanceof CompItem)) {
            return "no_comp";
        }
        
        var selectedLayers = comp.selectedLayers;
        if (selectedLayers.length === 0) {
            return "no_selection";
        }
        
        // Build a string representing the current selection WITHOUT keyframe times
        var hash = "";
        for (var i = 0; i < selectedLayers.length; i++) {
            var layer = selectedLayers[i];
            hash += layer.index + "_" + layer.name + ";";
            
            // Add selected keyframe info but WITHOUT the times
            var selectedProps = layer.selectedProperties;
            for (var j = 0; j < selectedProps.length; j++) {
                var prop = selectedProps[j];
                if (prop && prop.canVaryOverTime && prop.numKeys > 0) {
                    // Include property name and which keyframe indices are selected
                    var keyInfo = prop.name + ":";
                    var selectedIndices = [];
                    for (var k = 1; k <= prop.numKeys; k++) {
                        if (prop.keySelected(k)) {
                            selectedIndices.push(k);
                            // Only include the index, NOT the time
                            keyInfo += k + ",";
                        }
                    }
                    if (selectedIndices.length > 0) {
                        hash += keyInfo + ";";
                    }
                }
            }
        }
        
        return hash;
    } catch(e) {
        return "error";
    }
}

function nudgeDelayTimelineMode(direction, frames) {
    try {
        DEBUG_JSX.log("Timeline mode: Moving ALL keyframes together by " + frames + " frames");
        
        app.beginUndoGroup("Timeline Mode Nudge");
        
        var comp = app.project.activeItem;
        if (!(comp && comp instanceof CompItem)) {
            app.endUndoGroup();
            return "error|No composition selected";
        }
        
        var frameRate = comp.frameRate || 30;
        var timeOffset = (frames * direction) / frameRate; // Time offset in seconds
        
        // Check if selection changed and reset cumulative if needed
        // For timeline mode, use a special hash that doesn't include keyframe times
        var currentSelectionHash = getSelectionHashWithoutTimes();
        if (typeof LAST_TIMELINE_SELECTION_HASH === 'undefined') {
            LAST_TIMELINE_SELECTION_HASH = currentSelectionHash;
        } else if (currentSelectionHash !== LAST_TIMELINE_SELECTION_HASH) {
            DEBUG_JSX.log("Selection changed - resetting timeline mode cumulative offset");
            TIMELINE_MODE_CUMULATIVE_OFFSET = 0;
            LAST_TIMELINE_SELECTION_HASH = currentSelectionHash;
        }
        
        // Update cumulative offset
        TIMELINE_MODE_CUMULATIVE_OFFSET += timeOffset;
        
        var selectedLayers = comp.selectedLayers;
        if (selectedLayers.length === 0) {
            // GLOBAL DELAY: When nothing is selected, nudge everything after playhead
            // Pass false for skipPrecomps (normal behavior - process precomps)
            app.endUndoGroup();
            DEBUG_JSX.log("GLOBAL DELAY: No selection, nudging from playhead with " + frames + " frames");
            return nudgeFromPlayhead(direction, frames, false);
        }
        
        // STEP 1: CACHE ALL SELECTIONS BEFORE ANY MANIPULATION
        var cachedSelections = [];
        var hasSelectedKeyframes = false;
        
        // First check if there are any selected keyframes
        DEBUG_JSX.log("Checking " + selectedLayers.length + " selected layers for keyframes");
        for (var i = 0; i < selectedLayers.length; i++) {
            var layer = selectedLayers[i];
            var selectedProps = layer.selectedProperties;
            DEBUG_JSX.log("Layer " + layer.name + " has " + selectedProps.length + " selected properties");
            
            for (var j = 0; j < selectedProps.length; j++) {
                var prop = selectedProps[j];
                
                // Skip invalid properties
                if (!prop || prop.propertyValueType === PropertyValueType.NO_VALUE) {
                    DEBUG_JSX.log("  Skipping invalid property");
                    continue;
                }
                if (!prop.canVaryOverTime || prop.numKeys === 0) {
                    DEBUG_JSX.log("  Skipping property " + (prop.name || "unnamed") + " (no keys or can't vary)");
                    continue;
                }
                
                DEBUG_JSX.log("  Checking property: " + prop.name);
                
                // Note: Time Remap will now be handled with special logic below
                
                // CRITICAL: Manually check EVERY keyframe for selection
                var selKeys = [];
                for (var k = 1; k <= prop.numKeys; k++) {
                    if (prop.keySelected(k)) {
                        selKeys.push(k);
                    }
                }
                
                if (selKeys.length > 0) {
                    hasSelectedKeyframes = true;
                    
                    // Check if this is Time Remap being added through selectedProperties
                    var isTimeRemapViaSelectedProps = false;
                    try {
                        isTimeRemapViaSelectedProps = (prop.name === "Time Remap" || prop.matchName === "ADBE Time Remapping");
                    } catch(e) {
                        // Continue normally
                    }
                    
                    cachedSelections.push({
                        layer: layer,
                        layerName: layer.name,
                        property: prop,
                        propertyName: prop.name,
                        selectedIndices: selKeys.slice() // Make a copy!
                    });
                    DEBUG_JSX.log("  Cached " + prop.name + " with " + selKeys.length + " selected keyframes" + 
                                  (isTimeRemapViaSelectedProps ? " (Time Remap via selectedProperties)" : ""));
                }
            }
            
            // Also explicitly check for Time Remap (in case it's not in selectedProperties)
            // CRITICAL: Only add Time Remap if it wasn't already found in selectedProperties
            DEBUG_JSX.log("Checking if Time Remap needs explicit handling for layer " + layer.name);
            
            // First check if Time Remap was already cached
            var timeRemapAlreadyCached = false;
            for (var c = 0; c < cachedSelections.length; c++) {
                if (cachedSelections[c].layer === layer && 
                    (cachedSelections[c].propertyName === "Time Remap" || 
                     cachedSelections[c].propertyName === "ADBE Time Remapping")) {
                    timeRemapAlreadyCached = true;
                    DEBUG_JSX.log("  Time Remap already cached for this layer via selectedProperties");
                    break;
                }
            }
            
            if (!timeRemapAlreadyCached) {
                try {
                    if (layer.timeRemapEnabled && layer.timeRemap && layer.timeRemap.numKeys > 0) {
                        DEBUG_JSX.log("  Time Remap enabled with " + layer.timeRemap.numKeys + " keys");
                        var timeRemapSelKeys = [];
                        for (var k = 1; k <= layer.timeRemap.numKeys; k++) {
                            if (layer.timeRemap.keySelected(k)) {
                                timeRemapSelKeys.push(k);
                            }
                        }
                        
                        DEBUG_JSX.log("  Found " + timeRemapSelKeys.length + " selected Time Remap keys");
                        
                        if (timeRemapSelKeys.length > 0) {
                            hasSelectedKeyframes = true;
                            
                            cachedSelections.push({
                                layer: layer,
                                layerName: layer.name,
                                property: layer.timeRemap,
                                propertyName: "Time Remap",
                                selectedIndices: timeRemapSelKeys.slice()
                            });
                            DEBUG_JSX.log("Added Time Remap to cache with " + timeRemapSelKeys.length + " selected keyframes");
                        }
                    }
                } catch(e) {
                    DEBUG_JSX.log("Time Remap check error: " + e.toString());
                }
            }
        }
        
        // If no keyframes are selected, nudge the layers themselves (adjust start/end times)
        if (!hasSelectedKeyframes) {
            DEBUG_JSX.log("No keyframes selected - will nudge layer start times");
            
            // Move layers by adjusting their start times
            // CRITICAL: Account for trimmed vs natural layers when moving
            var movedLayers = 0;
            for (var i = 0; i < selectedLayers.length; i++) {
                var layer = selectedLayers[i];
                var oldStartTime = layer.startTime;
                
                // Determine visual position for the layer (same logic as nudgeLayerStartTimes)
                var layerVisualPosition;
                var isTrimmed = Math.abs(layer.inPoint - layer.startTime) > 0.001;
                
                if (isTrimmed) {
                    // Trimmed layer - visual position is at inPoint
                    layerVisualPosition = layer.inPoint;
                    DEBUG_JSX.log("Layer " + layer.name + " is trimmed: visualPos=" + layerVisualPosition + ", startTime=" + oldStartTime);
                } else {
                    // Natural layer - visual position is startTime
                    layerVisualPosition = layer.startTime;
                    DEBUG_JSX.log("Layer " + layer.name + " is natural: visualPos=" + layerVisualPosition);
                }
                
                // Calculate new visual position
                var newVisualPosition = layerVisualPosition + timeOffset;
                
                // Calculate the offset between visual position and startTime
                var visualToStartOffset = oldStartTime - layerVisualPosition;
                
                // Calculate new startTime maintaining the offset
                var newStartTime = newVisualPosition + visualToStartOffset;
                
                // Only clamp visual position to 0, allow negative startTime for trimmed layers
                if (newVisualPosition < 0) {
                    newVisualPosition = 0;
                    newStartTime = visualToStartOffset; // Maintain trim offset
                }
                
                // Clamp to composition bounds
                newStartTime = Math.min(newStartTime, comp.duration);
                
                layer.startTime = newStartTime;
                movedLayers++;
                DEBUG_JSX.log("Moved layer " + layer.name + " from " + oldStartTime + "s to " + newStartTime + "s (visual: " + layerVisualPosition + " -> " + newVisualPosition + ")");
            }
            
            app.endUndoGroup();
            
            if (movedLayers === 0) {
                return "error|No layers were moved (would result in negative times)";
            }
            
            // Return success with the CUMULATIVE amount moved (with sign preserved)
            var cumulativeMs = Math.round(TIMELINE_MODE_CUMULATIVE_OFFSET * 1000);
            var cumulativeFrames = Math.round(TIMELINE_MODE_CUMULATIVE_OFFSET * frameRate);
            return "success|" + cumulativeMs + "|" + cumulativeFrames + "|Moved " + movedLayers + " layers";
        }
        
        if (cachedSelections.length === 0) {
            app.endUndoGroup();
            return "error|No keyframes selected";
        }
        
        var movedCount = 0;
        var processedSelections = [];
        
        // MOVE MARKERS FIRST (before keyframe operations to avoid selection interference)
        DEBUG_JSX.log("STEP 2A: SMART marker split/merge BEFORE keyframe operations");

        // Process each property individually for smart marker split/merge
        var markerEpsilon = 0.01;
        var markersSplitMerged = 0;

        for (var i = 0; i < cachedSelections.length; i++) {
            var cached = cachedSelections[i];
            var prop = cached.property;
            var selKeys = cached.selectedIndices;
            var layer = cached.layer;

            if (selKeys.length === 0) continue;

            // Skip if no actual movement
            if (Math.abs(timeOffset) < markerEpsilon) continue;

            // Get unique property ID for marker block identification
            var uniquePropId = getUniquePropertyId(prop);

            // Determine marker property to use (layer or comp)
            var markerProp = null;
            if (layer.marker && layer.marker.numKeys > 0) {
                markerProp = layer.marker;
                DEBUG_JSX.log("SMART MARKER: Using layer markers for " + cached.propertyName + " (" + uniquePropId + ")");
            } else if (comp.markerProperty && comp.markerProperty.numKeys > 0) {
                markerProp = comp.markerProperty;
                DEBUG_JSX.log("SMART MARKER: Using comp markers for " + cached.propertyName + " (" + uniquePropId + ")");
            }

            if (!markerProp) continue;

            // NEW: Loop through ALL selected keyframes, not just first
            // FIXED: Track processed marker times to prevent double-processing
            var processedMarkerTimes = []; // Stores both old and new times
            var markersProcessed = 0;

            for (var kIdx = 0; kIdx < selKeys.length; kIdx++) {
                var keyIndex = selKeys[kIdx];

                // Get the OLD keyframe time (before movement)
                var oldKeyTime = prop.keyTime(keyIndex);

                // Check if we've already processed a marker at this time (original OR moved location)
                var alreadyProcessed = false;
                for (var p = 0; p < processedMarkerTimes.length; p++) {
                    if (Math.abs(processedMarkerTimes[p] - oldKeyTime) < markerEpsilon) {
                        alreadyProcessed = true;
                        DEBUG_JSX.log("SMART MARKER: Skipping " + cached.propertyName + " @ " + oldKeyTime.toFixed(3) + "s (already processed)");
                        break;
                    }
                }

                if (alreadyProcessed) continue;

                // Calculate NEW keyframe time (after movement)
                var newKeyTime = oldKeyTime + timeOffset;
                if (newKeyTime < 0) newKeyTime = 0;

                // Call smart split/merge for each selected keyframe
                try {
                    var result = smartSplitMergeMarker(
                        markerProp,
                        oldKeyTime,
                        newKeyTime,
                        uniquePropId,
                        markerEpsilon
                    );

                    if (result !== "no marker at old time" && result !== "no spring block for property") {
                        markersProcessed++;
                        markersSplitMerged++;
                        // Track BOTH the original time AND the new time to prevent reprocessing
                        processedMarkerTimes.push(oldKeyTime);
                        processedMarkerTimes.push(newKeyTime);
                        DEBUG_JSX.log("SMART MARKER: " + cached.propertyName + " @ " + oldKeyTime.toFixed(3) + "s - " + result);
                    }
                } catch(smartMarkerError) {
                    DEBUG_JSX.log("SMART MARKER ERROR: " + cached.propertyName + " @ " + oldKeyTime.toFixed(3) + "s - " + smartMarkerError.toString());
                }
            }
        }

        if (markersSplitMerged > 0) {
            DEBUG_JSX.log("SMART MARKER: Processed " + markersSplitMerged + " markers with split/merge logic");
        }
        
        // STEP 2: PROCESS USING CACHED SELECTIONS
        DEBUG_JSX.log("Processing " + cachedSelections.length + " cached properties");
        for (var i = 0; i < cachedSelections.length; i++) {
            var cached = cachedSelections[i];
            var prop = cached.property;
            var selKeys = cached.selectedIndices; // Use cached, not prop.selectedKeys!
            DEBUG_JSX.log("Processing property " + (i+1) + "/" + cachedSelections.length + ": " + cached.propertyName + " on " + cached.layerName + " with " + selKeys.length + " keys");

            // PROTECTION: Capture ALL adjacent keyframes to prevent AE from modifying them
            var allPrevKeyData = [];
            var minSelectedIndex = Math.min.apply(Math, selKeys);
            for (var k = minSelectedIndex - 1; k >= 1; k--) {
                try {
                    var capturedKey = captureKeyframeState(prop, k);
                    if (capturedKey) {
                        capturedKey.index = k;
                        allPrevKeyData.push(capturedKey);
                        DEBUG_JSX.log("🔒 Captured keyframe " + k + " @ " + capturedKey.time.toFixed(3) + "s before selection");
                    }
                } catch(e) {
                    break;
                }
            }

            var allNextKeyData = [];
            var maxSelectedIndex = Math.max.apply(Math, selKeys);
            for (var k = maxSelectedIndex + 1; k <= prop.numKeys; k++) {
                try {
                    var capturedKey = captureKeyframeState(prop, k);
                    if (capturedKey) {
                        capturedKey.index = k;
                        allNextKeyData.push(capturedKey);
                        DEBUG_JSX.log("🔒 Captured keyframe " + k + " @ " + capturedKey.time.toFixed(3) + "s after selection");
                    }
                } catch(e) {
                    break;
                }
            }

            // Collect complete keyframe data including easing
            var keyframesToMove = [];
            for (var k = 0; k < selKeys.length; k++) {
                var keyIndex = selKeys[k];
                var oldTime = prop.keyTime(keyIndex);
                var newTime = oldTime + timeOffset;
                
                // Only add if new time is valid
                if (newTime >= 0) {
                    var keyData = {
                        index: keyIndex,
                        oldTime: oldTime,
                        newTime: newTime,
                        value: prop.keyValue(keyIndex),
                        inInterp: prop.keyInInterpolationType(keyIndex),
                        outInterp: prop.keyOutInterpolationType(keyIndex),
                        temporalContinuous: prop.keyTemporalContinuous(keyIndex),
                        temporalAutoBezier: prop.keyTemporalAutoBezier(keyIndex),
                        // CRITICAL: Preserve keyframe color labels
                        label: prop.keyLabel(keyIndex)
                    };
                    
                    // Preserve temporal ease for bezier keyframes
                    if (keyData.inInterp === KeyframeInterpolationType.BEZIER || 
                        keyData.outInterp === KeyframeInterpolationType.BEZIER) {
                        try {
                            keyData.inEase = prop.keyInTemporalEase(keyIndex);
                            keyData.outEase = prop.keyOutTemporalEase(keyIndex);
                        } catch(e) {
                            // Temporal ease might not be available
                        }
                    }
                    
                    // Preserve spatial properties for position keyframes
                    if (prop.isSpatial) {
                        try {
                            keyData.spatialContinuous = prop.keySpatialContinuous(keyIndex);
                            keyData.spatialAutoBezier = prop.keySpatialAutoBezier(keyIndex);
                            keyData.inTangent = prop.keyInSpatialTangent(keyIndex);
                            keyData.outTangent = prop.keyOutSpatialTangent(keyIndex);
                        } catch(e) {
                            // Spatial properties might not be available
                        }
                    }
                    
                    keyframesToMove.push(keyData);
                } else {
                    DEBUG_JSX.log("Skipped keyframe at " + oldTime + "s (would be negative)");
                }
            }
            
            // Special handling for Time Remap vs other properties
            var newIndices = [];
            var isTimeRemap = false;
            try {
                isTimeRemap = (prop.name === "Time Remap" || prop.matchName === "ADBE Time Remapping");
            } catch(e) {
                // Continue with normal handling if we can't check
            }
            
            if (isTimeRemap) {
                DEBUG_JSX.log("Special Time Remap handling - add before delete");
                DEBUG_JSX.log("Time Remap: Processing " + keyframesToMove.length + " keyframes");

                // FIRST: Add new keyframes using setValueAtTime with STORED values
                // Then immediately restore easing before anything else happens
                for (var k = 0; k < keyframesToMove.length; k++) {
                    var data = keyframesToMove[k];

                    // Use setValueAtTime with the STORED value from collection time
                    prop.setValueAtTime(data.newTime, data.value);
                    DEBUG_JSX.log("Added Time Remap key at " + data.newTime + "s with stored value " + data.value);

                    // CRITICAL: Immediately find and restore properties on this keyframe
                    for (var j = 1; j <= prop.numKeys; j++) {
                        if (Math.abs(prop.keyTime(j) - data.newTime) < 0.001) {
                            try {
                                // CRITICAL: Restore temporal ease FIRST before setting interpolation type
                                // Setting interpolation type can reset/modify ease curves
                                if (data.inEase !== undefined && data.outEase !== undefined) {
                                    try {
                                        prop.setTemporalEaseAtKey(j, data.inEase, data.outEase);
                                    } catch(e) {
                                        DEBUG_JSX.log("Failed to restore temporal ease: " + e.toString());
                                    }
                                }

                                // THEN restore interpolation type (after ease is set)
                                prop.setInterpolationTypeAtKey(j, data.inInterp, data.outInterp);

                                // Restore temporal continuity
                                prop.setTemporalContinuousAtKey(j, data.temporalContinuous);
                                prop.setTemporalAutoBezierAtKey(j, data.temporalAutoBezier);

                                // Restore keyframe label
                                // (Same as normal properties - line 6970)
                                if (data.label !== undefined && data.label !== 0) {
                                    try {
                                        prop.setLabelAtKey(j, data.label);
                                    } catch(e) {
                                        DEBUG_JSX.log("Failed to restore label: " + e.toString());
                                    }
                                }
                            } catch(e) {
                                DEBUG_JSX.log("Failed to restore properties: " + e.toString());
                            }
                            break;
                        }
                    }
                }

                // SECOND: Remove old keyframes (only those not at new positions)
                var oldKeyIndicesToRemove = [];
                for (var k = 0; k < keyframesToMove.length; k++) {
                    var oldTime = keyframesToMove[k].oldTime;
                    for (var j = prop.numKeys; j >= 1; j--) {
                        var keyTime = prop.keyTime(j);
                        if (Math.abs(keyTime - oldTime) < 0.001) {
                            // Make sure this isn't one of our new keyframes
                            var isNewKey = false;
                            for (var n = 0; n < keyframesToMove.length; n++) {
                                if (Math.abs(keyTime - keyframesToMove[n].newTime) < 0.001) {
                                    isNewKey = true;
                                    break;
                                }
                            }
                            if (!isNewKey) {
                                oldKeyIndicesToRemove.push(j);
                                DEBUG_JSX.log("Will remove old Time Remap key at index " + j);
                            }
                        }
                    }
                }

                // Remove old keys in descending order
                oldKeyIndicesToRemove.sort(function(a, b) { return b - a; });
                for (var k = 0; k < oldKeyIndicesToRemove.length; k++) {
                    try {
                        prop.removeKey(oldKeyIndicesToRemove[k]);
                        DEBUG_JSX.log("Removed old Time Remap key at index " + oldKeyIndicesToRemove[k]);
                    } catch(e) {
                        DEBUG_JSX.log("Failed to remove Time Remap key: " + e.toString());
                    }
                }

                // THIRD: Find new indices for selection restoration
                for (var k = 0; k < keyframesToMove.length; k++) {
                    var targetTime = keyframesToMove[k].newTime;
                    for (var j = 1; j <= prop.numKeys; j++) {
                        if (Math.abs(prop.keyTime(j) - targetTime) < 0.001) {
                            newIndices.push(j);
                            DEBUG_JSX.log("Time Remap key at " + targetTime + "s is now at index " + j);
                            break;
                        }
                    }
                }

                movedCount += keyframesToMove.length;
                DEBUG_JSX.log("Successfully moved " + keyframesToMove.length + " Time Remap keyframes");

                // PROTECTION: Restore the next keyframe (use allNextKeyData array)
                if (allNextKeyData.length > 0) {
                    DEBUG_JSX.log("Time Remap: Attempting to restore " + allNextKeyData.length + " next keyframes");
                    // Time Remap doesn't use the same restoration pattern as normal properties
                    // The next keyframes are already protected by being outside the moved range
                    DEBUG_JSX.log("Time Remap: Next keyframes preserved automatically");
                } else {
                    DEBUG_JSX.log("Time Remap: No next keyframes to protect");
                }

                DEBUG_JSX.log("Time Remap block completed, continuing to selection storage");

            } else {
                // Normal handling for non-Time Remap properties
                // Calculate distance changes for ease scaling
                var firstOldTime = keyframesToMove[0].oldTime;
                var firstNewTime = keyframesToMove[0].newTime;
                var lastOldTime = keyframesToMove[keyframesToMove.length - 1].oldTime;
                var lastNewTime = keyframesToMove[keyframesToMove.length - 1].newTime;

                var prevKeyframeTime = allPrevKeyData.length > 0 ? allPrevKeyData[0].time : null;
                var nextKeyframeTime = allNextKeyData.length > 0 ? allNextKeyData[0].time : null;

                // Remove old keyframes (in reverse order to avoid index issues)
                for (var k = keyframesToMove.length - 1; k >= 0; k--) {
                    prop.removeKey(keyframesToMove[k].index);
                }

                // Add new keyframes at new times with all properties preserved
                for (var k = 0; k < keyframesToMove.length; k++) {
                    var data = keyframesToMove[k];
                    var newIdx = prop.addKey(data.newTime);

                    // Restore all keyframe properties in CORRECT order
                    prop.setValueAtKey(newIdx, data.value);

                    // CRITICAL: Apply temporal ease FIRST before setting interpolation type
                    // For delay operations, we need to scale IN/OUT ease based on distance changes
                    if (data.inEase !== undefined && data.outEase !== undefined) {
                        try {
                            var isFirstKey = (k === 0);
                            var isLastKey = (k === keyframesToMove.length - 1);

                            // Scale IN ease of first keyframe based on distance change from previous keyframe
                            var scaledInEase = data.inEase;
                            if (isFirstKey && prevKeyframeTime !== null) {
                                var originalDistanceFromPrev = data.oldTime - prevKeyframeTime;
                                var newDistanceFromPrev = data.newTime - prevKeyframeTime;
                                if (originalDistanceFromPrev > 0 && newDistanceFromPrev > 0) {
                                    scaledInEase = scaleEaseForDuration(data.inEase, originalDistanceFromPrev, newDistanceFromPrev);
                                    DEBUG_JSX.log("  📊 First keyframe IN ease: scaled by distance from prev (" + (originalDistanceFromPrev*1000).toFixed(1) + "ms → " + (newDistanceFromPrev*1000).toFixed(1) + "ms)");
                                }
                            }

                            // Scale OUT ease of last keyframe based on distance change to next keyframe
                            var scaledOutEase = data.outEase;
                            if (isLastKey && nextKeyframeTime !== null) {
                                var originalDistanceToNext = nextKeyframeTime - data.oldTime;
                                var newDistanceToNext = nextKeyframeTime - data.newTime;
                                if (originalDistanceToNext > 0 && newDistanceToNext > 0) {
                                    scaledOutEase = scaleEaseForDuration(data.outEase, originalDistanceToNext, newDistanceToNext);
                                    DEBUG_JSX.log("  📊 Last keyframe OUT ease: scaled by distance to next (" + (originalDistanceToNext*1000).toFixed(1) + "ms → " + (newDistanceToNext*1000).toFixed(1) + "ms)");
                                }
                            }

                            prop.setTemporalEaseAtKey(newIdx, scaledInEase, scaledOutEase);
                        } catch(e) {
                            // Some properties might not support temporal ease
                        }
                    }

                    // THEN set interpolation type (only once, after ease is set)
                    prop.setInterpolationTypeAtKey(newIdx, data.inInterp, data.outInterp);

                    // Safe flags restoration to keep linear icons for fully-linear keys
                    restoreTemporalFlagsSafely(prop, newIdx, data.inInterp, data.outInterp, data.temporalContinuous, data.temporalAutoBezier);
                    
                    // Restore spatial properties if they exist
                    if (data.spatialContinuous !== undefined) {
                        try {
                            prop.setSpatialContinuousAtKey(newIdx, data.spatialContinuous);
                            prop.setSpatialAutoBezierAtKey(newIdx, data.spatialAutoBezier);
                            // Only restore tangents if NOT auto-bezier (manual tangent control)
                            if (!data.spatialAutoBezier && data.inTangent !== undefined && data.outTangent !== undefined) {
                                prop.setSpatialTangentsAtKey(newIdx, data.inTangent, data.outTangent);
                            }
                        } catch(e) {
                            // Some properties might not support spatial settings
                        }
                    }
                    
                    // CRITICAL: Restore keyframe color label
                    if (data.label !== undefined && data.label !== 0) {
                        try {
                            prop.setLabelAtKey(newIdx, data.label);
                        } catch(e) {
                            // Label setting might fail on some property types
                        }
                    }
                    
                    // PERFORMANCE OPTIMIZATION: Skip immediate selection - will be handled in final restoration
                    // This eliminates redundant selection operations for large keyframe sets
                    DEBUG_JSX.log("  PERF: Skipping immediate selection for keyframe " + newIdx + " - will select at end");
                    
                    newIndices.push(newIdx);
                    movedCount++;
                    DEBUG_JSX.log("Moved keyframe from " + data.oldTime + "s to " + data.newTime + "s");
                }

                // PROTECTION: Restore ALL adjacent keyframes with ease scaling
                var keysAdded = newIndices.length - keyframesToMove.length;

                // Restore previous keyframes with OUT ease scaled
                DEBUG_JSX.log("🔓 Restoring " + allPrevKeyData.length + " keyframes before selection");
                for (var k = 0; k < allPrevKeyData.length; k++) {
                    var keyState = allPrevKeyData[k];

                    // Scale OUT ease if this is the immediately previous keyframe
                    if (k === 0 && prevKeyframeTime !== null) {
                        var originalDistanceToFirst = firstOldTime - keyState.time;
                        var newDistanceToFirst = firstNewTime - keyState.time;

                        if (originalDistanceToFirst > 0 && newDistanceToFirst > 0 && keyState.outEase) {
                            var scaledOutEase = scaleEaseForDuration(keyState.outEase, originalDistanceToFirst, newDistanceToFirst);

                            // Create modified keyState with scaled OUT ease
                            var modifiedKeyState = {};
                            for (var propName in keyState) {
                                modifiedKeyState[propName] = keyState[propName];
                            }
                            modifiedKeyState.outEase = scaledOutEase;

                            // Find and restore keyframe
                            for (var keyIdx = 1; keyIdx <= prop.numKeys; keyIdx++) {
                                if (Math.abs(prop.keyTime(keyIdx) - keyState.time) < 0.001) {
                                    restoreKeyframeState(prop, keyIdx, modifiedKeyState);
                                    DEBUG_JSX.log("🔓 Restored prev keyframe @ " + keyState.time.toFixed(3) + "s (scaled OUT ease: " + (originalDistanceToFirst*1000).toFixed(1) + "ms → " + (newDistanceToFirst*1000).toFixed(1) + "ms)");
                                    break;
                                }
                            }
                        } else {
                            // No scaling needed, restore as-is
                            for (var keyIdx = 1; keyIdx <= prop.numKeys; keyIdx++) {
                                if (Math.abs(prop.keyTime(keyIdx) - keyState.time) < 0.001) {
                                    restoreKeyframeState(prop, keyIdx, keyState);
                                    DEBUG_JSX.log("🔓 Restored prev keyframe @ " + keyState.time.toFixed(3) + "s");
                                    break;
                                }
                            }
                        }
                    } else {
                        // Not immediately previous, restore as-is
                        for (var keyIdx = 1; keyIdx <= prop.numKeys; keyIdx++) {
                            if (Math.abs(prop.keyTime(keyIdx) - keyState.time) < 0.001) {
                                restoreKeyframeState(prop, keyIdx, keyState);
                                DEBUG_JSX.log("🔓 Restored prev keyframe @ " + keyState.time.toFixed(3) + "s");
                                break;
                            }
                        }
                    }
                }

                // Restore next keyframes with IN ease scaled
                DEBUG_JSX.log("🔓 Restoring " + allNextKeyData.length + " keyframes after selection");
                for (var k = 0; k < allNextKeyData.length; k++) {
                    var keyState = allNextKeyData[k];

                    // Scale IN ease if this is the immediately next keyframe
                    if (k === 0 && nextKeyframeTime !== null) {
                        var originalDistanceFromLast = keyState.time - lastOldTime;
                        var newDistanceFromLast = keyState.time - lastNewTime;

                        if (originalDistanceFromLast > 0 && newDistanceFromLast > 0 && keyState.inEase) {
                            var scaledInEase = scaleEaseForDuration(keyState.inEase, originalDistanceFromLast, newDistanceFromLast);

                            // Create modified keyState with scaled IN ease
                            var modifiedKeyState = {};
                            for (var propName in keyState) {
                                modifiedKeyState[propName] = keyState[propName];
                            }
                            modifiedKeyState.inEase = scaledInEase;

                            // Find and restore keyframe
                            for (var keyIdx = 1; keyIdx <= prop.numKeys; keyIdx++) {
                                if (Math.abs(prop.keyTime(keyIdx) - keyState.time) < 0.001) {
                                    restoreKeyframeState(prop, keyIdx, modifiedKeyState);
                                    DEBUG_JSX.log("🔓 Restored next keyframe @ " + keyState.time.toFixed(3) + "s (scaled IN ease: " + (originalDistanceFromLast*1000).toFixed(1) + "ms → " + (newDistanceFromLast*1000).toFixed(1) + "ms)");
                                    break;
                                }
                            }
                        } else {
                            // No scaling needed, restore as-is
                            for (var keyIdx = 1; keyIdx <= prop.numKeys; keyIdx++) {
                                if (Math.abs(prop.keyTime(keyIdx) - keyState.time) < 0.001) {
                                    restoreKeyframeState(prop, keyIdx, keyState);
                                    DEBUG_JSX.log("🔓 Restored next keyframe @ " + keyState.time.toFixed(3) + "s");
                                    break;
                                }
                            }
                        }
                    } else {
                        // Not immediately next, restore as-is
                        for (var keyIdx = 1; keyIdx <= prop.numKeys; keyIdx++) {
                            if (Math.abs(prop.keyTime(keyIdx) - keyState.time) < 0.001) {
                                restoreKeyframeState(prop, keyIdx, keyState);
                                DEBUG_JSX.log("🔓 Restored next keyframe @ " + keyState.time.toFixed(3) + "s");
                                break;
                            }
                        }
                    }
                }

                // Restore selected keyframes' ease to ensure they stay correct
                DEBUG_JSX.log("🔓 Restoring selected keyframes' ease after adjacent restoration");
                for (var k = 0; k < newIndices.length; k++) {
                    var idx = newIndices[k];
                    var originalData = keyframesToMove[k];

                    // Recalculate the correct ease values
                    var isFirstKey = (k === 0);
                    var isLastKey = (k === keyframesToMove.length - 1);

                    var correctInEase = originalData.inEase;
                    if (isFirstKey && prevKeyframeTime !== null) {
                        var originalDistanceFromPrev = originalData.oldTime - prevKeyframeTime;
                        var newDistanceFromPrev = originalData.newTime - prevKeyframeTime;
                        if (originalDistanceFromPrev > 0 && newDistanceFromPrev > 0) {
                            correctInEase = scaleEaseForDuration(originalData.inEase, originalDistanceFromPrev, newDistanceFromPrev);
                        }
                    }

                    var correctOutEase = originalData.outEase;
                    if (isLastKey && nextKeyframeTime !== null) {
                        var originalDistanceToNext = nextKeyframeTime - originalData.oldTime;
                        var newDistanceToNext = nextKeyframeTime - originalData.newTime;
                        if (originalDistanceToNext > 0 && newDistanceToNext > 0) {
                            correctOutEase = scaleEaseForDuration(originalData.outEase, originalDistanceToNext, newDistanceToNext);
                        }
                    }

                    try {
                        prop.setTemporalEaseAtKey(idx, correctInEase, correctOutEase);
                        DEBUG_JSX.log("  ✓ Restored selected keyframe ease @ " + originalData.newTime.toFixed(3) + "s");
                    } catch(e) {
                        // Might fail for some properties
                    }
                }
            }

            // Store selections for restoration with CORRECT new indices AND property reference
            // CRITICAL: Store the actual property reference to avoid name conflicts
            // This runs for BOTH Time Remap and normal properties
            DEBUG_JSX.log("About to store selection data for " + cached.propertyName);
            try {
                processedSelections.push({
                    layer: cached.layer,
                    propertyName: cached.propertyName,
                    propertyReference: prop,  // Store actual property reference
                    indices: newIndices  // These should be the NEW indices after recreation
                });
                DEBUG_JSX.log("Stored selection data for " + cached.propertyName + " with NEW indices: [" + newIndices.join(", ") + "] and property reference");
            } catch(selError) {
                DEBUG_JSX.log("ERROR storing selection for " + cached.propertyName + ": " + selError.toString());
            }

            DEBUG_JSX.log("Completed processing property " + (i+1) + "/" + cachedSelections.length);
        }
        
        // Markers were already moved before keyframe operations to avoid selection interference
        
        app.endUndoGroup();
        
        // Small delay to let After Effects process the undo group before restoring selections
        // This prevents timing issues with selection restoration
        try {
            // Use app.refresh() to ensure UI updates are processed
            app.refresh();
        } catch(e) {
            // Refresh might not be available, continue anyway
        }
        
        // STEP 3 & 4: RESTORE SELECTION WITH FRESH REFERENCES (only if we had selected keyframes originally)
        // NOTE: We now do immediate selection during keyframe creation, so this is a backup
        if (hasSelectedKeyframes) {
            DEBUG_JSX.log("BACKUP: Starting selection restoration for " + processedSelections.length + " properties (immediate selection should have already worked)");
            // Helper function to find property by name (including Time Remap)
            function findPropertyByName(layer, targetName) {
                // Check for Time Remap first (it's at the layer level)
                if (targetName === "Time Remap" || targetName === "ADBE Time Remapping") {
                    try {
                        if (layer.timeRemapEnabled && layer.timeRemap) {
                            return layer.timeRemap;
                        }
                    } catch(e) {
                        // Time Remap not available on this layer
                    }
                }
                
                function searchGroup(group) {
                    for (var i = 1; i <= group.numProperties; i++) {
                        var prop = group.property(i);
                        if (prop && prop.name === targetName && prop.canVaryOverTime) {
                            return prop;
                        }
                        if (prop && (prop.propertyType === PropertyType.INDEXED_GROUP || 
                                   prop.propertyType === PropertyType.NAMED_GROUP)) {
                            var found = searchGroup(prop);
                            if (found) return found;
                        }
                    }
                    return null;
                }
                return searchGroup(layer);
            }
            
            // Restore selections using stored property references (avoid name conflicts)
            for (var i = 0; i < processedSelections.length; i++) {
                var selData = processedSelections[i];
                DEBUG_JSX.log("Restoring selection " + (i+1) + "/" + processedSelections.length + ": " + selData.propertyName + " on " + selData.layer.name);
                
                // Use stored property reference directly (avoids name conflicts with multiple "Slider" properties)
                var freshProp = selData.propertyReference;
                if (!freshProp) {
                    DEBUG_JSX.log("  ERROR: No property reference stored for " + selData.propertyName);
                    continue;
                }
                
                DEBUG_JSX.log("  Using stored property reference with " + freshProp.numKeys + " keys, selecting indices: [" + selData.indices.join(", ") + "]");
                
                // CRITICAL: First deselect ALL keyframes on this property
                for (var k = 1; k <= freshProp.numKeys; k++) {
                    try {
                        freshProp.setSelectedAtKey(k, false);
                    } catch(e) {
                        // Ignore deselection errors
                    }
                }
                
                // Now select only the keyframes we moved
                var successfulSelections = 0;
                for (var j = 0; j < selData.indices.length; j++) {
                    try {
                        freshProp.setSelectedAtKey(selData.indices[j], true);
                        successfulSelections++;
                    } catch(e) {
                        DEBUG_JSX.log("  ERROR: Failed to select key " + selData.indices[j] + ": " + e.toString());
                    }
                }
                DEBUG_JSX.log("  Successfully selected " + successfulSelections + "/" + selData.indices.length + " keyframes");
            }
            DEBUG_JSX.log("Selection restoration completed");
        }
        // If we moved all keyframes (no selection), don't restore any selection
        
        if (movedCount === 0) {
            return "error|No keyframes were moved";
        }
        
        // Return success with the CUMULATIVE amount moved (with sign preserved)
        var cumulativeMs = Math.round(TIMELINE_MODE_CUMULATIVE_OFFSET * 1000);
        var cumulativeFrames = Math.round(TIMELINE_MODE_CUMULATIVE_OFFSET * frameRate);
        
        // Include debug messages in result for debug panel
        var debugMessages = DEBUG_JSX.getMessages();
        return "success|" + cumulativeMs + "|" + cumulativeFrames + "|Moved " + movedCount + " keyframes|" + debugMessages.join("|");
        
    } catch(e) {
        app.endUndoGroup();
        
        // Include debug messages in error result for debug panel
        var debugMessages = DEBUG_JSX.getMessages();
        return "error|Timeline mode failed: " + e.toString() + "|" + debugMessages.join("|");
    }
}


// Simple test function to verify ExtendScript loading
function testTimelineModeFunction() {
    DEBUG_JSX.clear();
    DEBUG_JSX.log("✅ testTimelineModeFunction called successfully!");
    var debugMessages = DEBUG_JSX.getMessages();
    return "success|Timeline mode function exists and is callable|" + debugMessages.join("|");
}


// Helper function for delay nudging with custom increment values
function nudgeDelayWithCustomIncrement(direction, incrementMs) {
    // Use the existing nudgeDelay logic but replace calculateDelaySnap calls with dynamic version
    try {
        DEBUG_JSX.log("nudgeDelayWithCustomIncrement called with direction: " + direction + ", incrementMs: " + incrementMs);
        
        // Store the original calculateDelaySnap function
        var originalCalculateDelaySnap = calculateDelaySnap;
        
        // Set global variable for forced timeline mode to use
        CUSTOM_INCREMENT_MS = incrementMs;
        
        // Temporarily replace the global calculateDelaySnap function
        calculateDelaySnap = function(currentDelayMs, dir) {
            return calculateDelaySnapWithIncrement(currentDelayMs, dir, incrementMs);
        };
        
        // Call the existing nudgeDelay function which has baseline selection restoration
        var result = nudgeDelay(direction);
        
        // Restore the original function and reset custom increment
        calculateDelaySnap = originalCalculateDelaySnap;
        CUSTOM_INCREMENT_MS = 0;
        
        return result;
        
    } catch(e) {
        // Make sure to restore the original function and reset custom increment even if there's an error
        if (originalCalculateDelaySnap) {
            calculateDelaySnap = originalCalculateDelaySnap;
        }
        CUSTOM_INCREMENT_MS = 0;
        return "error|Failed to nudge delay with custom increment: " + e.toString();
    }
}

// Helper function for duration stretching with custom increment values
function stretchKeyframesWithCustomIncrement(direction, incrementMs) {
    try {
        // Clear previous debug messages  
        DEBUG_JSX.clear();
        
        DEBUG_JSX.log("stretchKeyframesWithCustomIncrement called with direction: " + direction + ", incrementMs: " + incrementMs);
        DEBUG_JSX.log("TESTING: Using existing stretchKeyframesGrokApproach to test selection preservation");
        
        // Test: Just call the existing function that we know works with 50ms increments
        // This will help us isolate whether the issue is with our custom logic or something else
        var result = stretchKeyframesGrokApproach(direction);
        
        DEBUG_JSX.log("Existing function returned: " + result);
        DEBUG_JSX.log("This should maintain keyframe selection if it's working properly");
        
        // Return with debug messages
        var debugMessages = DEBUG_JSX.getMessages();
        if (result && result.indexOf("success|") === 0) {
            return result + "|" + debugMessages.join("|");
        } else {
            return result + "|" + debugMessages.join("|");
        }
        
    } catch(e) {
        DEBUG_JSX.error("Duration stretch failed", e);
        var debugMessages = DEBUG_JSX.getMessages();
        return "error|Failed to stretch keyframes with custom increment: " + e.toString() + "|" + debugMessages.join("|");
    }
}

// Layer startTime nudging - uses same logic as keyframe delay nudging
function nudgeLayerStartTimes(selectedLayers, direction, frameRate, comp) {
    try {
        DEBUG_JSX.log("nudgeLayerStartTimes: processing " + selectedLayers.length + " layers");
        
        // Get frames from the custom increment if available, otherwise use default
        var frames = 3; // Default
        if (CUSTOM_INCREMENT_MS > 0) {
            // Convert custom increment back to frames
            frames = Math.round((CUSTOM_INCREMENT_MS / 1000) * frameRate);
            DEBUG_JSX.log("Using custom increment: " + CUSTOM_INCREMENT_MS + "ms = " + frames + " frames");
        }
        
        // Debug selected layers
        for (var d = 0; d < selectedLayers.length; d++) {
            var debugLayer = selectedLayers[d];
            DEBUG_JSX.log("  Layer " + d + ": " + debugLayer.name + " start=" + debugLayer.startTime.toFixed(3) + " in=" + debugLayer.inPoint.toFixed(3) + " out=" + debugLayer.outPoint.toFixed(3));
        }
        
        // Initialize cumulative tracking if needed
        if (typeof SINGLE_LAYER_CUMULATIVE === 'undefined') {
            SINGLE_LAYER_CUMULATIVE = 0;
        }
        
        // Single layer cumulative mode
        if (selectedLayers.length === 1) {
            var layer = selectedLayers[0];
            
            // Check if selection changed and reset if needed
            var currentSelectionHash = getSelectionHash();
            if (currentSelectionHash !== LAST_SELECTION_HASH) {
                DEBUG_JSX.log("Selection changed - resetting single layer cumulative");
                SINGLE_LAYER_CUMULATIVE = 0;
                LAST_SELECTION_HASH = currentSelectionHash;
            }
            
            // Track cumulative nudges
            SINGLE_LAYER_CUMULATIVE += (direction > 0 ? 50 : -50);
            
            // Actually move the layer by 50ms increments
            var nudgeSeconds = (direction > 0 ? 0.05 : -0.05);
            var newStartTime = Math.max(0, layer.startTime + nudgeSeconds);
            newStartTime = Math.min(newStartTime, comp.duration);
            layer.startTime = newStartTime;
            
            app.endUndoGroup();
            
            // Return cumulative value for display
            var displayDelayMs = SINGLE_LAYER_CUMULATIVE;
            var displayDelayFrames = Math.round((displayDelayMs / 1000) * frameRate);
            
            // Calculate layer duration
            var layerDuration = layer.outPoint - layer.inPoint;
            var durationMs = roundMs(layerDuration);
            var durationFrames = Math.round(layerDuration * frameRate);
            
            return "success|" + displayDelayMs + "|" + displayDelayFrames + "|" + durationMs + "|" + durationFrames + "|1|0|0|0|0|1|Stagger|Single layer cumulative: " + displayDelayMs + "ms";
        }
        
        // Multiple layers - original logic
        // Collect layer startTimes (same approach as keyframe delay detection)
        var layerDelays = [];
        var debugInfo = [];
        
        // Find baseline (earliest visual position) - account for trimmed vs natural layers
        var scanEarliestTime = Number.MAX_VALUE;
        var scanBaselineLayer = null;
        
        for (var i = 0; i < selectedLayers.length; i++) {
            var layer = selectedLayers[i];
            
            // CRITICAL: Use same detection as layer delay reading
            // For trimmed layers, the visual position is at inPoint, not startTime
            var layerVisualPosition;
            if (Math.abs(layer.inPoint - layer.startTime) < 0.001) {
                // Natural layer - visual position is startTime
                layerVisualPosition = layer.startTime;
            } else {
                // Trimmed layer - visual position is inPoint
                layerVisualPosition = layer.inPoint;
            }
            
            if (layerVisualPosition < scanEarliestTime) {
                scanEarliestTime = layerVisualPosition;
                scanBaselineLayer = layer.name;
            }
        }
        
        DEBUG_JSX.log("Layer baseline detection: earliest=" + scanEarliestTime.toFixed(3) + "s, baseline=" + scanBaselineLayer);
        
        // Use same baseline cache approach as keyframes
        BASELINE_CACHE.reset();
        var baselineData = BASELINE_CACHE.initialize(scanEarliestTime, scanBaselineLayer);
        var originalEarliestTime = baselineData.earliestTime;
        
        // Build layer delays with baseline tracking
        for (var i = 0; i < selectedLayers.length; i++) {
            var layer = selectedLayers[i];
            
            // CRITICAL: Use visual position for baseline comparison
            var layerVisualPosition;
            if (Math.abs(layer.inPoint - layer.startTime) < 0.001) {
                // Natural layer - visual position is startTime
                layerVisualPosition = layer.startTime;
            } else {
                // Trimmed layer - visual position is inPoint
                layerVisualPosition = layer.inPoint;
            }
            
            // Track if this is a baseline layer (compare visual position to baseline)
            var isOriginalBaseline = (Math.abs(layerVisualPosition - originalEarliestTime) < 0.001);
            
            layerDelays.push({
                layer: layer,
                currentDelay: layer.startTime,  // Keep using startTime for actual movement
                visualPosition: layerVisualPosition,  // Store visual position for reference
                isOriginalBaseline: isOriginalBaseline
            });
            
            debugInfo.push("Layer " + layer.name + ": visualPos=" + layerVisualPosition.toFixed(3) + "s, startTime=" + layer.startTime.toFixed(3) + "s, isBaseline=" + isOriginalBaseline);
        }
        
        // Apply same snapping logic as keyframes
        // CRITICAL: Use visual position to check if layers have same delay
        var allSameDelay = true;
        var firstDelay = (layerDelays[0].visualPosition - originalEarliestTime) * 1000; // Convert to ms
        
        DEBUG_JSX.log("Checking delays - baseline at " + originalEarliestTime.toFixed(3) + "s:");
        DEBUG_JSX.log("  Layer 0 (" + layerDelays[0].layer.name + "): visualPos=" + layerDelays[0].visualPosition.toFixed(3) + ", delay=" + firstDelay.toFixed(1) + "ms");
        
        for (var i = 1; i < layerDelays.length; i++) {
            var delayMs = (layerDelays[i].visualPosition - originalEarliestTime) * 1000;
            DEBUG_JSX.log("  Layer " + i + " (" + layerDelays[i].layer.name + "): visualPos=" + layerDelays[i].visualPosition.toFixed(3) + ", delay=" + delayMs.toFixed(1) + "ms");
            if (Math.abs(delayMs - firstDelay) > 1) { // 1ms tolerance
                allSameDelay = false;
                DEBUG_JSX.log("    → Different delay detected (diff=" + Math.abs(delayMs - firstDelay).toFixed(1) + "ms)");
                break;
            }
        }
        
        DEBUG_JSX.log("All layers have same delay: " + allSameDelay + ", firstDelay=" + firstDelay + "ms");
        
        // Move layers using same logic as keyframes
        var movedCount = 0;
        if (allSameDelay) {
            // Timeline mode - all layers have same delay (whether at baseline or not), move together
            // Check if selection changed and reset if needed
            var currentSelectionHash = getSelectionHash();
            if (currentSelectionHash !== LAST_SELECTION_HASH) {
                DEBUG_JSX.log("Selection changed - resetting multi-layer cumulative");
                MULTI_LAYER_CUMULATIVE = 0;
                LAST_SELECTION_HASH = currentSelectionHash;
            }
            
            // Calculate frame-based nudge amount
            var frameRate = comp.frameRate || 30;
            var timelineNudgeSeconds = (frames * direction) / frameRate;
            var nudgeMs = timelineNudgeSeconds * 1000;
            
            // Track cumulative for timeline mode
            if (typeof MULTI_LAYER_CUMULATIVE === 'undefined') {
                MULTI_LAYER_CUMULATIVE = 0;
            }
            MULTI_LAYER_CUMULATIVE += nudgeMs;
            
            DEBUG_JSX.log("Timeline mode: nudging " + layerDelays.length + " layers by " + nudgeMs + "ms (" + (frames * direction) + " frames)");
            
            for (var i = 0; i < layerDelays.length; i++) {
                var layerData = layerDelays[i];
                
                // Move the visual position, then calculate startTime
                var newVisualPosition = layerData.visualPosition + timelineNudgeSeconds;
                var visualToStartOffset = layerData.currentDelay - layerData.visualPosition;
                var newStartTime = newVisualPosition + visualToStartOffset;
                
                // Only clamp visual position to 0, allow negative startTime for trimmed layers
                if (newVisualPosition < 0) {
                    newVisualPosition = 0;
                    newStartTime = visualToStartOffset;
                }
                
                // Clamp to composition bounds
                newStartTime = Math.min(newStartTime, comp.duration);
                
                layerData.layer.startTime = newStartTime;
                movedCount++;
                debugInfo.push("Timeline mode: Moved " + layerData.layer.name + " from " + layerData.currentDelay.toFixed(3) + "s to " + newStartTime.toFixed(3) + "s (visual: " + newVisualPosition.toFixed(3) + "s)");
            }
        } else {
            // Multiple delays - snap each delayed layer individually (like keyframes)
            for (var i = 0; i < layerDelays.length; i++) {
                var layerData = layerDelays[i];
                
                if (layerData.isOriginalBaseline) {
                    // Baseline layer never moves (same as keyframes)
                    debugInfo.push(layerData.layer.name + ": baseline layer, never moves");
                    continue;
                }
                
                // Apply snapping to each non-baseline layer individually
                // CRITICAL: Use visual position for delay calculation, not startTime
                var currentDelayMs = (layerData.visualPosition - originalEarliestTime) * 1000;
                var targetDelayMs = calculateDelaySnap(currentDelayMs, direction);
                
                // Calculate where we want the visual position to be
                var targetVisualPosition = originalEarliestTime + (targetDelayMs / 1000);
                
                // For trimmed layers, maintain the offset between visual position and startTime
                var visualToStartOffset = layerData.currentDelay - layerData.visualPosition;
                var targetTime = targetVisualPosition + visualToStartOffset;
                
                // Only clamp if it would make the layer completely disappear
                // Allow negative startTime for trimmed layers as long as visual position is >= 0
                if (targetVisualPosition >= 0) {
                    // Visual position is valid, use calculated targetTime even if negative
                    targetTime = Math.min(targetTime, comp.duration);
                } else {
                    // Visual position would be negative, clamp the visual position to 0
                    targetVisualPosition = 0;
                    targetTime = visualToStartOffset; // This maintains the trim offset
                }
                
                layerData.layer.startTime = targetTime;
                movedCount++;
                debugInfo.push("Snapped " + layerData.layer.name + ": " + currentDelayMs + "ms → " + targetDelayMs + "ms, startTime=" + targetTime + "s");
            }
        }
        
        app.endUndoGroup();
        
        // After nudging, read the new layer delays to return proper format
        DEBUG_JSX.log("Moved " + movedCount + " layers, reading new delays");
        var readResult = readLayerDelays(selectedLayers, comp);
        
        if (readResult && readResult.indexOf('success|') === 0) {
            return readResult;
        } else {
            // Fallback if reading fails
            return "success|nudged " + movedCount + " layers|" + debugInfo.join(" | ");
        }
        
    } catch(e) {
        app.endUndoGroup();
        return "error|Failed to nudge layer startTimes: " + e.toString();
    }
}

// 50ms delay snapping logic (same as duration snapping)
function calculateDelaySnap(currentDelayMs, direction) {
    // Safety check for divide by zero
    if (typeof currentDelayMs !== 'number' || isNaN(currentDelayMs) || !isFinite(currentDelayMs)) {
        throw new Error("calculateDelaySnap: currentDelayMs is not a valid number: " + currentDelayMs);
    }
    
    if (typeof direction !== 'number' || isNaN(direction)) {
        throw new Error("calculateDelaySnap: direction is not a valid number: " + direction);
    }
    
    // Handle edge cases
    if (currentDelayMs < 0) {
        currentDelayMs = 0;
    }
    
    // Check if current delay is already a multiple of 50ms (within 1ms tolerance)
    var remainder = Math.abs(currentDelayMs) % 50;
    var isAlreadySnapped = (remainder < 1) || (remainder > 49);
    
    DEBUG_JSX.log("Remainder: " + remainder + ", isAlreadySnapped: " + isAlreadySnapped);
    
    if (isAlreadySnapped) {
        // Already snapped to 50ms boundary - increment by exactly 50ms
        if (direction > 0) {
            var result = currentDelayMs + 50;
            DEBUG_JSX.log("Already snapped, direction +, result: " + result);
            return result;
        } else {
            var result = Math.max(0, currentDelayMs - 50); // Don't go below 0
            // Handle floating-point precision: round very small values to exactly 0
            if (result < 1) {
                result = 0;
            }
            DEBUG_JSX.log("Already snapped, direction -, result: " + result);
            return result;
        }
    } else {
        // Not snapped yet - snap to nearest 50ms multiple
        if (direction > 0) {
            // + button: snap to next 50ms increment
            var result = Math.ceil(currentDelayMs / 50) * 50;
            DEBUG_JSX.log("Not snapped, direction +, result: " + result);
            return result;
        } else {
            // - button: snap to previous 50ms increment
            var result = Math.max(0, Math.floor(currentDelayMs / 50) * 50);
            // Handle floating-point precision: round very small values to exactly 0
            if (result < 1) {
                result = 0;
            }
            DEBUG_JSX.log("Not snapped, direction -, result: " + result);
            return result;
        }
    }
}

// Dynamic delay snapping logic with custom increments
function calculateDelaySnapWithIncrement(currentDelayMs, direction, incrementMs) {
    // Safety check for divide by zero
    if (typeof currentDelayMs !== 'number' || isNaN(currentDelayMs) || !isFinite(currentDelayMs)) {
        throw new Error("calculateDelaySnapWithIncrement: currentDelayMs is not a valid number: " + currentDelayMs);
    }
    
    if (typeof direction !== 'number' || isNaN(direction)) {
        throw new Error("calculateDelaySnapWithIncrement: direction is not a valid number: " + direction);
    }
    
    if (typeof incrementMs !== 'number' || isNaN(incrementMs) || incrementMs <= 0) {
        throw new Error("calculateDelaySnapWithIncrement: incrementMs is not a valid positive number: " + incrementMs);
    }
    
    // Handle edge cases
    if (currentDelayMs < 0) {
        currentDelayMs = 0;
    }
    
    // Check if current delay is already a multiple of incrementMs (within 1ms tolerance)
    var remainder = Math.abs(currentDelayMs) % incrementMs;
    var isAlreadySnapped = (remainder < 1) || (remainder > (incrementMs - 1));
    
    DEBUG_JSX.log("Increment: " + incrementMs + "ms, Remainder: " + remainder + ", isAlreadySnapped: " + isAlreadySnapped);
    
    if (isAlreadySnapped) {
        // Already snapped to increment boundary - increment by exactly incrementMs
        if (direction > 0) {
            var result = currentDelayMs + incrementMs;
            DEBUG_JSX.log("Already snapped, direction +, result: " + result);
            return result;
        } else {
            var result = Math.max(0, currentDelayMs - incrementMs); // Don't go below 0
            // Handle floating-point precision: round very small values to exactly 0
            if (result < 1) {
                result = 0;
            }
            DEBUG_JSX.log("Already snapped, direction -, result: " + result);
            return result;
        }
    } else {
        // Not snapped yet - snap to nearest increment multiple
        if (direction > 0) {
            // + button: snap to next increment multiple
            var result = Math.ceil(currentDelayMs / incrementMs) * incrementMs;
            DEBUG_JSX.log("Not snapped, direction +, result: " + result);
            return result;
        } else {
            // - button: snap to previous increment multiple
            var result = Math.max(0, Math.floor(currentDelayMs / incrementMs) * incrementMs);
            // Handle floating-point precision: round very small values to exactly 0
            if (result < 1) {
                result = 0;
            }
            DEBUG_JSX.log("Not snapped, direction -, result: " + result);
            return result;
        }
    }
}

// X Position nudging functions
function nudgeXPosition(pixelAmount, direction, multiplier) {
    try {
        return nudgePositionAxis('x', pixelAmount, direction, multiplier);
    } catch(e) {
        return "error|Failed to nudge X position: " + e.toString();
    }
}

// Y Position nudging functions
function nudgeYPosition(pixelAmount, direction, multiplier) {
    try {
        return nudgePositionAxis('y', pixelAmount, direction, multiplier);
    } catch(e) {
        return "error|Failed to nudge Y position: " + e.toString();
    }
}

// Core position nudging function with direct keyframe movement (5px increments)
function nudgePositionAxis(axis, nudgeDirection, direction, multiplier) {
    try {
        // Clear previous debug messages
        DEBUG_JSX.clear();
        
        var directionName = '';
        if (axis === 'x') {
            directionName = nudgeDirection > 0 ? 'Right' : 'Left';
        } else {
            directionName = nudgeDirection > 0 ? 'Down' : 'Up';
        }
        
        DEBUG_JSX.log("nudgePositionAxis called: " + axis + " " + directionName + " (direction=" + direction + ")");
        
        app.beginUndoGroup("Nudge " + axis.toUpperCase() + " " + directionName);
        
        var comp = app.project.activeItem;
        if (!(comp && comp instanceof CompItem)) {
            app.endUndoGroup();
            return "error|Please select a composition";
        }
        
        var selectedLayers = comp.selectedLayers;
        var processedAny = false;
        var allPropertiesToNudge = []; // Collect all position properties from all layers
        
        // Function to recursively search for selected keyframes with matching axis
        function findAxisProperty(propGroup, targetAxis) {
            for (var i = 1; i <= propGroup.numProperties; i++) {
                var prop = propGroup.property(i);
                
                // Check if this property has keyframes and selected keyframes
                if (prop && prop.canVaryOverTime && prop.numKeys > 0) {
                    // Count selected keyframes
                    var selectedKeys = [];
                    for (var j = 1; j <= prop.numKeys; j++) {
                        if (prop.keySelected(j)) {
                            selectedKeys.push(j);
                        }
                    }
                    
                    if (selectedKeys.length >= 2 && isPositionProperty(prop)) {
                        // Check axis compatibility
                        var propName = prop.name.toLowerCase();
                        var isValidAxis = false;
                        
                        if (targetAxis === 'x') {
                            // X axis: works with Position or X Position
                            isValidAxis = (propName === "position" || propName === "x position");
                        } else {
                            // Y axis: works with Position or Y Position  
                            isValidAxis = (propName === "position" || propName === "y position");
                        }
                        
                        if (isValidAxis) {
                            return { property: prop, keys: selectedKeys };
                        }
                    }
                }
                
                // Recurse into property groups
                if (prop && (prop.propertyType === PropertyType.INDEXED_GROUP || 
                           prop.propertyType === PropertyType.NAMED_GROUP)) {
                    var result = findAxisProperty(prop, targetAxis);
                    if (result) return result;
                }
            }
            return null;
        }
        
        // Collect all position properties from all selected layers
        for (var layerIndex = 0; layerIndex < selectedLayers.length; layerIndex++) {
            var layer = selectedLayers[layerIndex];
            var axisPropertyData = findAxisProperty(layer, axis);
            if (axisPropertyData && axisPropertyData.keys.length >= 2) {
                allPropertiesToNudge.push({
                    layer: layer,
                    property: axisPropertyData.property,
                    keys: axisPropertyData.keys
                });
            }
        }
        
        if (allPropertiesToNudge.length === 0) {
            app.endUndoGroup();
            return "error|Select " + axis.toUpperCase() + " position keyframes";
        }
        
        processedAny = true;
        
        // Get the current resolution multiplier
        var resolutionMultiplier = 2; // Default to 2x
        try {
            var saved = app.settings.getSetting("AirBoard", "resolutionMultiplier");
            if (saved !== "") {
                var value = parseInt(saved);
                if (value >= 1 && value <= 6) {
                    resolutionMultiplier = value;
                }
            }
        } catch(e) {
            // Use default 2x if we can't read the setting
        }
        
        // Calculate movement amount: 5px base * resolution multiplier * Alt modifier (if held)
        var baseMovement = 5 * (multiplier || 1);
        var scaledIncrement = baseMovement * resolutionMultiplier;
        
        DEBUG_JSX.log("Processing " + allPropertiesToNudge.length + " position properties");
        
        // Process each position property
        for (var propIndex = 0; propIndex < allPropertiesToNudge.length; propIndex++) {
            var propData = allPropertiesToNudge[propIndex];
            var prop = propData.property;
            var selKeys = propData.keys;
            var layer = propData.layer;
            
            DEBUG_JSX.log("Processing property " + prop.name + " on layer " + layer.name + " with " + selKeys.length + " selected keyframes");
            
            // Sort selected key indices
            selKeys.sort(function(a, b) { return a - b; });
            
            // Determine which keyframe to move
            var keyIndexToMove;
            if (direction === 'in') {
                // "In" mode: move first keyframe
                keyIndexToMove = selKeys[0];
            } else {
                // "Out" mode: move last keyframe  
                keyIndexToMove = selKeys[selKeys.length - 1];
            }
            
            // Get current keyframe value and extract coordinate for this axis
            var currentValue = prop.keyValue(keyIndexToMove);
            var currentCoord;
            
            if (currentValue instanceof Array && currentValue.length >= 2) {
                // 2D Position case [x, y]
                currentCoord = axis === 'x' ? currentValue[0] : currentValue[1];
            } else if (typeof currentValue === "number") {
                // 1D Position case
                currentCoord = currentValue;
            } else {
                DEBUG_JSX.log("Skipping property " + prop.name + " - invalid position value type");
                continue;
            }
            
            // Get the other keyframe to calculate current distance
            var otherKeyIndex = (keyIndexToMove === selKeys[0]) ? selKeys[selKeys.length - 1] : selKeys[0];
            var otherValue = prop.keyValue(otherKeyIndex);
            var otherCoord;
            
            if (otherValue instanceof Array && otherValue.length >= 2) {
                // 2D Position case [x, y]
                otherCoord = axis === 'x' ? otherValue[0] : otherValue[1];
            } else if (typeof otherValue === "number") {
                // 1D Position case
                otherCoord = otherValue;
            } else {
                DEBUG_JSX.log("Skipping property " + prop.name + " - invalid other keyframe position value type");
                continue;
            }
            
            // Calculate current distance between keyframes
            var currentDistance = Math.abs(currentCoord - otherCoord);
            
            // Smart snapping: check if current DISTANCE is aligned to scaledIncrement boundary
            var distanceRemainder = Math.abs(currentDistance % scaledIncrement);
            var tolerance = 0.1;
            var isDistanceAlreadySnapped = (distanceRemainder < tolerance) || (distanceRemainder > (scaledIncrement - tolerance));
            
            DEBUG_JSX.log("Position snapping debug for " + prop.name + ":");
            DEBUG_JSX.log("  currentCoord: " + currentCoord + "px");
            DEBUG_JSX.log("  otherCoord: " + otherCoord + "px");  
            DEBUG_JSX.log("  currentDistance: " + currentDistance + "px");
            DEBUG_JSX.log("  scaledIncrement: " + scaledIncrement + "px");
            DEBUG_JSX.log("  distanceRemainder: " + distanceRemainder);
            DEBUG_JSX.log("  isDistanceAlreadySnapped: " + isDistanceAlreadySnapped);
            DEBUG_JSX.log("  nudgeDirection: " + nudgeDirection);
            
            var newCoord;
            if (isDistanceAlreadySnapped) {
                // Distance already snapped - move by exact increment to maintain snapping
                newCoord = currentCoord + (nudgeDirection * scaledIncrement);
                DEBUG_JSX.log("  INCREMENTAL: " + currentCoord + " + " + (nudgeDirection * scaledIncrement) + " = " + newCoord);
            } else {
                // Distance not snapped - snap the distance to nearest multiple in the nudge direction
                var targetDistance;
                if (nudgeDirection > 0) {
                    // Positive direction: snap to next higher distance multiple
                    targetDistance = Math.ceil(currentDistance / scaledIncrement) * scaledIncrement;
                    DEBUG_JSX.log("  SNAP DISTANCE UP: ceil(" + currentDistance + " / " + scaledIncrement + ") * " + scaledIncrement + " = " + targetDistance);
                } else {
                    // Negative direction: snap to next lower distance multiple  
                    targetDistance = Math.floor(currentDistance / scaledIncrement) * scaledIncrement;
                    DEBUG_JSX.log("  SNAP DISTANCE DOWN: floor(" + currentDistance + " / " + scaledIncrement + ") * " + scaledIncrement + " = " + targetDistance);
                }
                
                // Calculate new coordinate to achieve target distance
                if (currentCoord > otherCoord) {
                    // Moving keyframe is on the positive side
                    newCoord = otherCoord + targetDistance;
                } else {
                    // Moving keyframe is on the negative side
                    newCoord = otherCoord - targetDistance;
                }
                DEBUG_JSX.log("  NEW COORD FOR DISTANCE: " + newCoord);
            }
            
            // Apply the new coordinate to the keyframe value
            var newValue;
            if (currentValue instanceof Array && currentValue.length >= 2) {
                // 2D Position case [x, y]
                newValue = [currentValue[0], currentValue[1]];
                if (axis === 'x') {
                    newValue[0] = newCoord;
                } else {
                    newValue[1] = newCoord;
                }
            } else if (typeof currentValue === "number") {
                // 1D Position case
                newValue = newCoord;
            } else {
                DEBUG_JSX.log("Skipping property " + prop.name + " - invalid position value type for new value");
                continue;
            }
            
            // Apply the new keyframe value
            try {
                prop.setValueAtKey(keyIndexToMove, newValue);
                DEBUG_JSX.log("Successfully updated " + prop.name + " keyframe " + keyIndexToMove + " to " + newCoord);
            } catch(e) {
                DEBUG_JSX.log("Failed to set keyframe value for " + prop.name + ": " + e.toString());
                continue;
            }
        }
        
        app.endUndoGroup();
        
        if (!processedAny) {
            return "error|Select " + axis.toUpperCase() + " position keyframes";
        }
        
        // Re-read to get updated distance for display
        var readResult = readKeyframesSmart();
        var debugMessages = DEBUG_JSX.getMessages();
        
        if (readResult && readResult.indexOf('success|') === 0) {
            var parts = readResult.split('|');
            var xDistance = parseFloat(parts[6]) || 0;
            var yDistance = parseFloat(parts[7]) || 0;
            var hasXDistance = parts[8] === '1';
            var hasYDistance = parts[9] === '1';
            
            if (axis === 'x' && hasXDistance) {
                return "success|" + xDistance + "|1|" + debugMessages.join("|");
            } else if (axis === 'y' && hasYDistance) {
                return "success|" + yDistance + "|1|" + debugMessages.join("|");
            }
        }
        
        return "success|0|1|" + debugMessages.join("|");
        
    } catch(e) {
        app.endUndoGroup();
        return "error|Failed to nudge position: " + e.toString();
    }
}

// Helper function to check if property is position-related
function isPositionProperty(prop) {
    if (!prop) return false;
    var name = prop.name.toLowerCase();
    var matchName = prop.matchName || "";
    
    return (name === "position" || name === "x position" || name === "y position" ||
           matchName === "ADBE Position" || matchName === "ADBE Position_0" || matchName === "ADBE Position_1");
}

// Helper function to calculate distance for position properties
function calculatePositionDistance(posProperty, keyIndices) {
    if (!posProperty || keyIndices.length < 1) return { x: 0, y: 0, hasX: false, hasY: false };
    
    // If only 1 keyframe selected, return 0 distance but flag as having position data
    if (keyIndices.length < 2) {
        // Check if it's a position property to determine which axes to flag
        var value = posProperty.keyValue(keyIndices[0]);
        if (value instanceof Array && value.length >= 2) {
            // 2D Position - has both X and Y
            return { x: 0, y: 0, hasX: true, hasY: true };
        } else if (typeof value === "number") {
            // 1D Position - determine if X Position or Y Position
            var propName = posProperty.name.toLowerCase();
            if (propName.indexOf('x') >= 0) {
                return { x: 0, y: 0, hasX: true, hasY: false };
            } else if (propName.indexOf('y') >= 0) {
                return { x: 0, y: 0, hasX: false, hasY: true };
            }
        }
        return { x: 0, y: 0, hasX: false, hasY: false };
    }
    
    var totalXDist = 0;
    var totalYDist = 0;
    var hasXData = false;
    var hasYData = false;
    
    // Sort key indices to process in chronological order
    var sortedKeys = keyIndices.slice().sort(function(a, b) {
        return posProperty.keyTime(a) - posProperty.keyTime(b);
    });
    
    // Calculate distance between first and last keyframes only
    var firstKey = sortedKeys[0];
    var lastKey = sortedKeys[sortedKeys.length - 1];
    
    var value1 = posProperty.keyValue(firstKey);
    var value2 = posProperty.keyValue(lastKey);
    
    // Handle both 2D position [x,y] and separated 1D position values
    if (value1 instanceof Array && value2 instanceof Array) {
        // 2D Position case - signed distances
        if (value1.length >= 2 && value2.length >= 2) {
            totalXDist = value2[0] - value1[0]; // Signed: positive = right, negative = left
            totalYDist = value2[1] - value1[1]; // Signed: positive = down, negative = up
            hasXData = true;
            hasYData = true;
        }
    } else if (typeof value1 === "number" && typeof value2 === "number") {
        // 1D Position case (X Position or Y Position) - signed distances
        var propName = posProperty.name.toLowerCase();
        if (propName === "x position") {
            totalXDist = value2 - value1; // Signed distance
            hasXData = true;
        } else if (propName === "y position") {
            totalYDist = value2 - value1; // Signed distance
            hasYData = true;
        }
    }
    
    return { x: Math.round(totalXDist), y: Math.round(totalYDist), hasX: hasXData, hasY: hasYData };
}

// Smart 5px distance snapping logic (resolution-aware, distance-based)
function calculateSmartDistanceNudge(currentDistance, nudgeDirection, resolutionMultiplier) {
    // Base increment is 5px at @1x, scaled by resolution multiplier
    var baseIncrement = 5;
    var scaledIncrement = baseIncrement * resolutionMultiplier;
    
    // Check if current distance is already aligned to scaledIncrement boundary (use absolute value for remainder)
    var remainder = Math.abs(currentDistance % scaledIncrement);
    var tolerance = 0.1;
    var isAlreadySnapped = (remainder < tolerance) || (remainder > (scaledIncrement - tolerance));
    
    if (isAlreadySnapped) {
        // Already snapped to boundary - apply scaled increment/decrement
        if (nudgeDirection > 0) {
            // + button: increase distance by scaledIncrement (more positive/right/down)
            return currentDistance + scaledIncrement;
        } else {
            // - button: decrease distance by scaledIncrement (more negative/left/up)
            return currentDistance - scaledIncrement;
        }
    } else {
        // Not snapped yet - snap to nearest scaledIncrement multiple, preserving sign
        if (nudgeDirection > 0) {
            // + button: snap toward more positive direction
            if (currentDistance >= 0) {
                return Math.ceil(currentDistance / scaledIncrement) * scaledIncrement;
            } else {
                return Math.floor(currentDistance / scaledIncrement) * scaledIncrement;
            }
        } else {
            // - button: snap toward more negative direction  
            if (currentDistance > 0) {
                return Math.floor(currentDistance / scaledIncrement) * scaledIncrement;
            } else {
                return Math.ceil(currentDistance / scaledIncrement) * scaledIncrement;
            }
        }
    }
}

// ================================
// STAGGER FUNCTIONALITY
// ================================

// Helper function to snap inconsistent staggers to clean multiples of the input value (for keyframes)
function snapKeyframeStaggersToInputValue(layerGroups, staggerFrames, frameRate, direction, isTopToBottom) {
    try {
        DEBUG_JSX.log("Smart keyframe snapping: checking if staggers need snapping to " + staggerFrames + " frame increments (isTopToBottom: " + isTopToBottom + ")");
        
        var staggerSeconds = staggerFrames / frameRate; // Convert to seconds
        var tolerance = Math.min(0.005, staggerSeconds * 0.15); // 5ms max or 15% of target stagger, whichever is smaller
        
        if (layerGroups.length < 2) {
            DEBUG_JSX.log("Not enough layer groups for keyframe stagger analysis");
            return false;
        }
        
        // For keyframes, we don't skip based on 0ms detection since first layer naturally starts at 0ms
        // Instead, we proceed to interval analysis to detect inconsistent patterns
        
        // Find representative keyframe time for each layer group (earliest time in each group)
        var layerGroupTimes = [];
        for (var layerIdx = 0; layerIdx < layerGroups.length; layerIdx++) {
            var layerGroup = layerGroups[layerIdx];
            var earliestTime = null;
            var allKeyframeTimesForDebug = [];
            
            // Find earliest keyframe time in this layer group
            for (var propIdx = 0; propIdx < layerGroup.keyframes.length; propIdx++) {
                var propData = layerGroup.keyframes[propIdx];
                var prop = propData.property;
                var selectedKeys = propData.selectedKeys;
                
                for (var k = 0; k < selectedKeys.length; k++) {
                    var keyTime = prop.keyTime(selectedKeys[k]);
                    allKeyframeTimesForDebug.push((keyTime * 1000).toFixed(1) + "ms");
                    if (earliestTime === null || keyTime < earliestTime) {
                        earliestTime = keyTime;
                    }
                }
            }
            
            // DEBUG: Log all keyframe times for this layer
            DEBUG_JSX.log("Layer " + layerGroup.layer.index + " keyframes: [" + allKeyframeTimesForDebug.join(", ") + "], earliest: " + (earliestTime * 1000).toFixed(1) + "ms");
            
            if (earliestTime !== null) {
                layerGroupTimes.push({
                    layerGroup: layerGroup,
                    time: earliestTime,
                    layerIndex: layerGroup.layer.index
                });
            }
        }
        
        if (layerGroupTimes.length < 2) {
            DEBUG_JSX.log("Not enough representative times for keyframe analysis");
            return false;
        }

        // Sort in the same direction that staggers are being applied
        // This ensures interval calculations match the stagger direction
        if (isTopToBottom) {
            // Reverse mode: sort top-to-bottom (ascending index)
            layerGroupTimes.sort(function(a, b) { return a.layerIndex - b.layerIndex; });
            DEBUG_JSX.log("Sorted layer times top-to-bottom (ascending) for interval calculation");
        } else {
            // Normal mode: sort bottom-to-top (descending index)
            layerGroupTimes.sort(function(a, b) { return b.layerIndex - a.layerIndex; });
            DEBUG_JSX.log("Sorted layer times bottom-to-top (descending) for interval calculation");
        }
        
        // Calculate actual intervals between layer groups
        var actualIntervals = [];
        for (var i = 1; i < layerGroupTimes.length; i++) {
            var interval = layerGroupTimes[i].time - layerGroupTimes[i-1].time;
            actualIntervals.push(interval);
        }
        
        // DEBUG: Add detailed logging to understand interval calculation
        for (var i = 0; i < layerGroupTimes.length; i++) {
            var layerGroup = layerGroupTimes[i];
            DEBUG_JSX.log("Layer " + layerGroup.layerIndex + " representative time: " + (layerGroup.time * 1000).toFixed(1) + "ms");
        }
        
        // Build debug string manually (ExtendScript doesn't support Array.map)
        var intervalsStr = "";
        for (var i = 0; i < actualIntervals.length; i++) {
            if (i > 0) intervalsStr += ", ";
            intervalsStr += (actualIntervals[i] * 1000).toFixed(1) + "ms";
        }
        DEBUG_JSX.log("Keyframe intervals (seconds): " + intervalsStr);
        
        // Detect the current stagger direction from existing intervals
        var hasPositiveIntervals = 0;
        var hasNegativeIntervals = 0;
        for (var i = 0; i < actualIntervals.length; i++) {
            if (actualIntervals[i] > 0.001) hasPositiveIntervals++;
            else if (actualIntervals[i] < -0.001) hasNegativeIntervals++;
        }
        
        // DIRECTION LOGIC FOR REVERSE STAGGER MODE:
        // Default direction (bottomToTop): + button = +50ms, - button = -50ms
        // Reverse direction (topToBottom): + button creates LARGER negative staggers, - button creates SMALLER negative staggers
        // In reverse mode, + should make staggers MORE negative, - should make them LESS negative
        var currentDirection = direction; // Don't invert - handle reverse logic in uniform increment instead
        
        DEBUG_JSX.log("Simple snapping: direction=" + direction + ", isTopToBottom=" + isTopToBottom + ", final direction=" + currentDirection);
        
        // Check if intervals are already uniform (at any consistent value)
        var isCleanPattern = true;
        var hasOppositeDirection = false;
        if (actualIntervals.length > 0) {
            // Use the first interval as the reference for uniformity check
            var referenceInterval = actualIntervals[0];
            
            for (var i = 0; i < actualIntervals.length; i++) {
                var interval = actualIntervals[i];
                var difference = Math.abs(interval - referenceInterval);
                
                DEBUG_JSX.log("Keyframe interval " + i + ": " + (interval * 1000).toFixed(1) + "ms, reference: " + (referenceInterval * 1000).toFixed(1) + "ms, diff: " + (difference * 1000).toFixed(1) + "ms");
                
                if (difference > tolerance) {
                    isCleanPattern = false;
                    DEBUG_JSX.log("Keyframe interval " + i + " is not uniform (" + (difference * 1000).toFixed(1) + "ms off) - needs snapping");
                }
            }
            
            if (isCleanPattern) {
                DEBUG_JSX.log("Keyframe pattern is already uniform at " + (referenceInterval * 1000).toFixed(1) + "ms intervals");
                
                // UNIFORM STAGGER INCREMENTAL LOGIC
                // For uniform patterns: current stagger +/- increment = new stagger (same as duration stretching)
                var currentIntervalSigned = referenceInterval; // Use actual current interval (preserve sign)
                var currentStaggerMs = currentIntervalSigned * 1000; // Convert to milliseconds
                var incrementMs = staggerSeconds * 1000; // Target increment in milliseconds
                
                DEBUG_JSX.log("UNIFORM INCREMENT: Current=" + currentStaggerMs.toFixed(1) + "ms, increment=" + incrementMs.toFixed(1) + "ms");
                
                // Apply directional increment/decrement logic
                // Both modes use same math: + adds, - subtracts
                // The reversal is handled by layer sorting, not by inverting the math
                var newStaggerMs;

                if (direction > 0) {
                    // + button: increase stagger
                    newStaggerMs = currentStaggerMs + incrementMs;
                    DEBUG_JSX.log("+ button: " + currentStaggerMs.toFixed(1) + "ms + " + incrementMs.toFixed(1) + "ms = " + newStaggerMs.toFixed(1) + "ms");
                } else {
                    // - button: decrease stagger
                    newStaggerMs = currentStaggerMs - incrementMs;
                    DEBUG_JSX.log("- button: " + currentStaggerMs.toFixed(1) + "ms - " + incrementMs.toFixed(1) + "ms = " + newStaggerMs.toFixed(1) + "ms");
                }
                
                DEBUG_JSX.log("🎯 UNIFORM INCREMENT (reverse-aware): isTopToBottom=" + isTopToBottom + ", direction=" + direction + ", newStagger=" + newStaggerMs.toFixed(1) + "ms");
                
                // Convert back to seconds for target interval
                var targetInterval = newStaggerMs / 1000;
                
                DEBUG_JSX.log("🎯 UNIFORM INCREMENT: Moving from " + currentStaggerMs.toFixed(1) + "ms to " + newStaggerMs.toFixed(1) + "ms");
                
                // CRITICAL FIX: For uniform increments, use simplified positioning logic
                // Instead of recalculating from baselines, maintain existing timeline positions and adjust intervals
                var useSimplifiedPositioning = true;
            } else {
                // Pattern is inconsistent - use snapping logic for irregular patterns
                DEBUG_JSX.log("Keyframe pattern is inconsistent - snapping to clean uniform staggers");
                
                var targetInterval;
                
                // For irregular patterns: Snap to clean increments in the requested direction  
                if (direction > 0) {
                    // + button: snap to positive increment
                    targetInterval = staggerSeconds; // +50ms (at 60fps, 3 frames)
                } else {
                    // - button: snap to negative increment  
                    targetInterval = -staggerSeconds; // -50ms (at 60fps, 3 frames)
                }
                
                // For reverse direction (topToBottom), invert the target
                // SKIP for uniform increments - they already handle the sign correctly
                if (isTopToBottom && typeof useSimplifiedPositioning === 'undefined') {
                    targetInterval = -targetInterval;
                }
                
                DEBUG_JSX.log("🎯 IRREGULAR SNAP: Snapping to " + (targetInterval * 1000).toFixed(1) + "ms intervals");
            }
        }
        
        // Now both uniform and irregular patterns have calculated their targetInterval
        var baselineTime = layerGroupTimes[0].time; // Baseline layer group time
        
        DEBUG_JSX.log("🎯 KEYFRAME STAGGER: Applying " + (targetInterval * 1000).toFixed(1) + "ms intervals");
        
        // CRITICAL FIX: Use simplified positioning for uniform increments
        if (typeof useSimplifiedPositioning !== 'undefined' && useSimplifiedPositioning) {
            DEBUG_JSX.log("🎯 SIMPLIFIED POSITIONING: Using simplified logic for uniform increments");
            
            // For uniform increments, maintain existing timeline positions and just adjust intervals
            // Calculate current representative time for each layer
            var currentRepresentativeTimes = [];
            for (var layerIdx = 0; layerIdx < layerGroups.length; layerIdx++) {
                var layerGroup = layerGroups[layerIdx];
                var layerEarliestTime = null;
                
                for (var propIdx = 0; propIdx < layerGroup.keyframes.length; propIdx++) {
                    var propData = layerGroup.keyframes[propIdx];
                    var prop = propData.property;
                    var selectedKeys = propData.selectedKeys;
                    
                    for (var k = 0; k < selectedKeys.length; k++) {
                        var keyTime = prop.keyTime(selectedKeys[k]);
                        if (layerEarliestTime === null || keyTime < layerEarliestTime) {
                            layerEarliestTime = keyTime;
                        }
                    }
                }
                currentRepresentativeTimes.push(layerEarliestTime);
            }
            
            // Find the baseline anchor point
            // The first layer in the sorted array (layerIdx=0) is always the anchor
            // Sorting handles reverse vs normal mode automatically
            var simplifiedBaseline = currentRepresentativeTimes[0];
            DEBUG_JSX.log("🎯 ANCHOR: First layer in sorted order at " + (simplifiedBaseline * 1000).toFixed(1) + "ms will stay anchored");
            
            DEBUG_JSX.log("🎯 SIMPLIFIED: Current baseline time: " + (simplifiedBaseline * 1000).toFixed(1) + "ms");
            
            // Calculate offsets for each layer and execute keyframe movements immediately
            var propertyDataForSelection = [];
            
            // Calculate new target times using same formula as layer stagger
            // staggerOffset = layerIdx * targetInterval
            // First layer (layerIdx=0) always stays at baseline (anchor)
            // targetInterval already includes direction (positive or negative)
            var layerOffsets = []; // Track actual offsets for marker syncing
            for (var layerIdx = 0; layerIdx < layerGroups.length; layerIdx++) {
                var layerGroup = layerGroups[layerIdx];

                // Simple cumulative offset formula (same as layer stagger at line 10095)
                var staggerOffset = layerIdx * targetInterval;
                var newTargetTime = simplifiedBaseline + staggerOffset;

                if (layerIdx === 0) {
                    DEBUG_JSX.log("🎯 ANCHOR: Layer " + layerIdx + " anchored at " + (newTargetTime * 1000).toFixed(1) + "ms");
                } else {
                    DEBUG_JSX.log("🎯 STAGGER: Layer " + layerIdx + " at " + (newTargetTime * 1000).toFixed(1) + "ms (offset: " + (staggerOffset * 1000).toFixed(1) + "ms)");
                }

                // Calculate offset needed to move from current representative time to target time
                var currentRepTime = currentRepresentativeTimes[layerIdx];
                var offset = newTargetTime - currentRepTime;
                
                // Store the actual offset for marker syncing
                layerOffsets.push({
                    layerIndex: layerGroup.layer.index,
                    offsetSeconds: offset
                });
                
                // Apply the offset to all keyframes in this layer
                for (var propIdx = 0; propIdx < layerGroup.keyframes.length; propIdx++) {
                    var propData = layerGroup.keyframes[propIdx];
                    var prop = propData.property;
                    var selectedKeys = propData.selectedKeys;

                    // PROTECTION: Capture the next keyframe to prevent AE from modifying it
                    var nextKeyData = captureNextKeyframe(prop, selectedKeys);

                    // Collect keyframe data for this property
                    var keyframesToMove = [];
                    for (var k = 0; k < selectedKeys.length; k++) {
                        var keyIndex = selectedKeys[k];
                        var currentTime = prop.keyTime(keyIndex);
                        var newTime = Math.max(0, currentTime + offset); // Clamp to 0
                        
                        
                        var keyData = {
                            property: prop,
                            oldIndex: keyIndex,
                            time: currentTime,
                            newTime: newTime,
                            value: prop.keyValue(keyIndex),
                            inInterp: prop.keyInInterpolationType(keyIndex),
                            outInterp: prop.keyOutInterpolationType(keyIndex),
                            temporalContinuous: prop.keyTemporalContinuous(keyIndex),
                            temporalAutoBezier: prop.keyTemporalAutoBezier(keyIndex),
                            // CRITICAL: Preserve keyframe color labels
                            label: prop.keyLabel(keyIndex)
                        };
                        
                        // Debug keyframe color collection
                        DEBUG_JSX.log("  Collecting keyframe " + keyIndex + " with color label: " + keyData.label);
                        
                        // Only collect temporal ease if bezier interpolation
                        if (keyData.inInterp === KeyframeInterpolationType.BEZIER || keyData.outInterp === KeyframeInterpolationType.BEZIER) {
                            try {
                                keyData.inEase = prop.keyInTemporalEase(keyIndex);
                                keyData.outEase = prop.keyOutTemporalEase(keyIndex);
                            } catch(e) {
                                // Temporal ease might not be available for some properties
                            }
                        }
                        
                        // Handle spatial properties if applicable (Position, etc.)
                        if (prop.isSpatial) {
                            keyData.spatialContinuous = prop.keySpatialContinuous(keyIndex);
                            keyData.spatialAutoBezier = prop.keySpatialAutoBezier(keyIndex);
                            keyData.inTangent = prop.keyInSpatialTangent(keyIndex);
                            keyData.outTangent = prop.keyOutSpatialTangent(keyIndex);
                        }
                        
                        keyframesToMove.push(keyData);
                    }
                    
                    // Store property info for batch recreation
                    propertyDataForSelection.push({
                        property: prop,
                        propName: propData.propertyName || prop.name,
                        keyframesToMove: keyframesToMove,
                        layer: layerGroup.layer,
                        nextKeyData: nextKeyData // Store for protection restoration
                    });
                }
            }
            
            
            // EXECUTE THE KEYFRAME MOVEMENTS using the same pattern as regular stagger
            
            // PHASE 1: Remove old keyframes (SKIP Time Remap properties)
            for (var i = 0; i < propertyDataForSelection.length; i++) {
                var propInfo = propertyDataForSelection[i];
                var prop = propInfo.property;
                var keyframesToMove = propInfo.keyframesToMove;
                
                // Check if this is Time Remap property - SKIP deletion for Time Remap
                var isTimeRemap = false;
                try {
                    isTimeRemap = (prop.name === "Time Remap" || prop.matchName === "ADBE Time Remapping");
                } catch(e) {
                    // Property name/matchName might not be accessible
                }
                
                if (isTimeRemap) {
                    continue; // Skip deletion phase for Time Remap
                }
                
                // Remove old keyframes in reverse order to avoid index shifts
                var indicesToRemove = [];
                for (var k = 0; k < keyframesToMove.length; k++) {
                    indicesToRemove.push(keyframesToMove[k].oldIndex);
                }
                indicesToRemove.sort(function(a, b) { return b - a; }); // Sort descending
                
                for (var k = 0; k < indicesToRemove.length; k++) {
                    prop.removeKey(indicesToRemove[k]);
                }
            }
            
            // PHASE 2: Create new keyframes with full property preservation
            for (var i = 0; i < propertyDataForSelection.length; i++) {
                var propInfo = propertyDataForSelection[i];
                var prop = propInfo.property;
                var keyframesToMove = propInfo.keyframesToMove;
                
                // Check if this is Time Remap property - use special handling
                var isTimeRemap = false;
                try {
                    isTimeRemap = (prop.name === "Time Remap" || prop.matchName === "ADBE Time Remapping");
                } catch(e) {
                    // Property name/matchName might not be accessible
                }
                
                if (isTimeRemap) {
                    // For Time Remap, use setValueAtTime method (add new keyframes first)
                    for (var k = 0; k < keyframesToMove.length; k++) {
                        var keyData = keyframesToMove[k];
                        prop.setValueAtTime(keyData.newTime, keyData.value);
                    }
                    
                    // Now carefully remove old keyframes (only those that aren't at new positions)
                    var oldKeyIndicesToRemove = [];
                    for (var k = 0; k < keyframesToMove.length; k++) {
                        var oldTime = keyframesToMove[k].time;
                        // Find keyframes at old time and check they're not also at new time
                        for (var j = prop.numKeys; j >= 1; j--) {
                            var keyTime = prop.keyTime(j);
                            if (Math.abs(keyTime - oldTime) < 0.001) {
                                // Make sure this isn't a new keyframe
                                var isNewKey = false;
                                for (var n = 0; n < keyframesToMove.length; n++) {
                                    if (Math.abs(keyTime - keyframesToMove[n].newTime) < 0.001) {
                                        isNewKey = true;
                                        break;
                                    }
                                }
                                if (!isNewKey) {
                                    oldKeyIndicesToRemove.push(j);
                                }
                            }
                        }
                    }
                    
                    // Remove old keyframes in descending order
                    oldKeyIndicesToRemove.sort(function(a, b) { return b - a; });
                    for (var k = 0; k < oldKeyIndicesToRemove.length; k++) {
                        prop.removeKey(oldKeyIndicesToRemove[k]);
                    }
                } else {
                    
                    // For regular properties, create new keyframes with full property preservation
                    for (var k = 0; k < keyframesToMove.length; k++) {
                        var keyData = keyframesToMove[k];
                        var newIdx = prop.addKey(keyData.newTime);
                        
                        try {
                            prop.setValueAtKey(newIdx, keyData.value);

                            // Apply temporal ease first to avoid flipping linear sides
                            if (keyData.inEase !== undefined && keyData.outEase !== undefined) {
                                try {
                                    prop.setTemporalEaseAtKey(newIdx, keyData.inEase, keyData.outEase);
                                } catch(e) {
                                    // Some properties might not support temporal ease
                                }
                            }

                            // Then re-assert original interpolation types
                            prop.setInterpolationTypeAtKey(newIdx, keyData.inInterp, keyData.outInterp);
                            
                            prop.setTemporalContinuousAtKey(newIdx, keyData.temporalContinuous);
                            prop.setTemporalAutoBezierAtKey(newIdx, keyData.temporalAutoBezier);
                            
                            // Spatial properties for Position keyframes
                            if (keyData.spatialContinuous !== undefined) {
                                prop.setSpatialContinuousAtKey(newIdx, keyData.spatialContinuous);
                                prop.setSpatialAutoBezierAtKey(newIdx, keyData.spatialAutoBezier);
                                prop.setSpatialTangentsAtKey(newIdx, keyData.inTangent, keyData.outTangent);
                            }
                            
                            // CRITICAL: Restore keyframe color label (0 = no color, >0 = colored)
                            if (keyData.label !== undefined) {
                                try {
                                    prop.setLabelAtKey(newIdx, keyData.label);
                                    if (keyData.label === 0) {
                                        DEBUG_JSX.log("    Restored no color label (0) on keyframe " + newIdx);
                                    } else {
                                        DEBUG_JSX.log("    Restored color label " + keyData.label + " on keyframe " + newIdx);
                                    }
                                } catch(e) {
                                    DEBUG_JSX.log("    WARNING: Failed to restore color label " + keyData.label + " on keyframe " + newIdx + ": " + e.toString());
                                }
                            } else {
                                DEBUG_JSX.log("    No color label to restore (keyData.label is undefined)");
                            }
                        } catch(e) {
                            // Continue if keyframe property setting fails
                        }
                    }
                }
            }

            // PROTECTION: Restore the next keyframe for each property after keyframe creation
            for (var i = 0; i < propertyDataForSelection.length; i++) {
                var propInfo = propertyDataForSelection[i];
                var prop = propInfo.property;
                var nextKeyData = propInfo.nextKeyData;
                var keyframesToMove = propInfo.keyframesToMove;

                if (nextKeyData !== null) {
                    var keysAdded = keyframesToMove.length - keyframesToMove.length; // In this case, 0 since we remove then add the same count
                    restoreNextKeyframe(prop, nextKeyData, keysAdded);
                }
            }

            // PHASE 3: Restore selection
            
            for (var i = 0; i < propertyDataForSelection.length; i++) {
                var propInfo = propertyDataForSelection[i];
                var prop = propInfo.property;
                var keyframesToMove = propInfo.keyframesToMove;
                var layer = propInfo.layer;
                
                // Clear all selections on this property first
                for (var k = 1; k <= prop.numKeys; k++) {
                    try {
                        prop.setSelectedAtKey(k, false);
                    } catch(e) {
                        // Continue if deselection fails
                    }
                }
                
                // Select keyframes at the new times
                for (var k = 0; k < keyframesToMove.length; k++) {
                    var keyData = keyframesToMove[k];
                    var targetTime = keyData.newTime;
                    
                    // Find keyframe at this time and select it
                    for (var j = 1; j <= prop.numKeys; j++) {
                        if (Math.abs(prop.keyTime(j) - targetTime) < 0.001) {
                            try {
                                prop.setSelectedAtKey(j, true);
                            } catch(e) {
                                // Continue if selection fails
                            }
                            break;
                        }
                    }
                }
            }
            
            
            // Return success with actual stagger result and layer offsets for marker syncing
            return {
                success: true,
                staggerMs: targetInterval * 1000,
                keyframesToMove: [], // Not used in simplified mode
                layerOffsets: layerOffsets // Actual offsets applied to each layer for marker syncing
            };
        }
        
        // CRITICAL ISSUE: We're calculating offsets based on representative times,
        // but keyframes have different actual times within each layer
        // Need to find the actual earliest keyframe across ALL layers as baseline
        
        var actualEarliestTime = null;
        var actualLatestTime = null;
        
        // Find the true earliest AND latest keyframe times across all layers
        for (var layerIdx = 0; layerIdx < layerGroups.length; layerIdx++) {
            var layerGroup = layerGroups[layerIdx];
            for (var propIdx = 0; propIdx < layerGroup.keyframes.length; propIdx++) {
                var propData = layerGroup.keyframes[propIdx];
                var prop = propData.property;
                var selectedKeys = propData.selectedKeys;
                
                for (var k = 0; k < selectedKeys.length; k++) {
                    var keyTime = prop.keyTime(selectedKeys[k]);
                    if (actualEarliestTime === null || keyTime < actualEarliestTime) {
                        actualEarliestTime = keyTime;
                    }
                    if (actualLatestTime === null || keyTime > actualLatestTime) {
                        actualLatestTime = keyTime;
                    }
                }
            }
        }
        
        DEBUG_JSX.log("🎯 Actual keyframe range: " + (actualEarliestTime * 1000).toFixed(1) + "ms to " + (actualLatestTime * 1000).toFixed(1) + "ms");
        
        // Calculate what each layer's representative keyframe should be
        // to create uniform intervals from the earliest keyframe
        for (var layerIdx = 0; layerIdx < layerGroups.length; layerIdx++) {
            var layerGroup = layerGroups[layerIdx];
            
            var targetTime;
            
            if (targetInterval < 0) {
                // NEGATIVE STAGGERS: Check if starting from 0ms (representative keyframes at same time)
                // Calculate representative keyframe times per layer first
                var representativeKeyframeTimes = [];
                for (var tempLayerIdx = 0; tempLayerIdx < layerGroups.length; tempLayerIdx++) {
                    var tempLayerGroup = layerGroups[tempLayerIdx];
                    var layerEarliestTime = null;
                    
                    for (var propIdx = 0; propIdx < tempLayerGroup.keyframes.length; propIdx++) {
                        var propData = tempLayerGroup.keyframes[propIdx];
                        var prop = propData.property;
                        var selectedKeys = propData.selectedKeys;
                        
                        for (var k = 0; k < selectedKeys.length; k++) {
                            var keyTime = prop.keyTime(selectedKeys[k]);
                            if (layerEarliestTime === null || keyTime < layerEarliestTime) {
                                layerEarliestTime = keyTime;
                            }
                        }
                    }
                    representativeKeyframeTimes.push(layerEarliestTime);
                }
                
                // Check if all representative keyframes are at the same time (zero stagger)
                var allRepresentativeKeyframesAtSameTime = true;
                var firstRepresentativeTime = representativeKeyframeTimes[0];
                for (var i = 1; i < representativeKeyframeTimes.length; i++) {
                    if (Math.abs(representativeKeyframeTimes[i] - firstRepresentativeTime) > 0.001) {
                        allRepresentativeKeyframesAtSameTime = false;
                        break;
                    }
                }
                
                // Build debug string manually since ExtendScript doesn't have map()
                var representativeTimesDebug = [];
                for (var i = 0; i < representativeKeyframeTimes.length; i++) {
                    representativeTimesDebug.push((representativeKeyframeTimes[i] * 1000).toFixed(1) + "ms");
                }
                DEBUG_JSX.log("🎯 Representative keyframe times: [" + representativeTimesDebug.join(", ") + "], all same: " + allRepresentativeKeyframesAtSameTime);
                
                if (allRepresentativeKeyframesAtSameTime) {
                    // SPECIAL CASE: Starting from 0ms staggers (representative keyframes at same time)
                    // Use the shared representative time as baseline and apply negative staggers from there
                    // layerIdx=0 (bottom) → current time (no change)
                    // layerIdx=1 → current time + targetInterval (negative, so earlier)
                    // layerIdx=2 → current time + (2 * targetInterval) (even earlier)
                    targetTime = firstRepresentativeTime + (layerIdx * targetInterval);
                    
                    DEBUG_JSX.log("🎯 Zero-stagger start: layer " + layerGroup.layer.index + " position " + layerIdx + " gets time " + (targetTime * 1000).toFixed(1) + "ms (baseline=" + (firstRepresentativeTime * 1000).toFixed(1) + "ms)");
                } else {
                    // REGULAR CASE: Already have existing staggers  
                    // For negative staggers with existing staggers, maintain timeline position of latest representative keyframe
                    // while adjusting stagger intervals
                    
                    // SPECIAL HANDLING FOR REVERSE DIRECTION WITH INVERTED POSITIVE INTERVALS
                    // When user clicks + in reverse mode, direction gets inverted to -1, creating negative intervals
                    // But we want positive progression starting from earliest keyframe
                    var isReverseModePositiveClick = isTopToBottom && direction > 0; // Original + click in reverse mode
                    
                    var baselineTime, baselineLabel;
                    if (isReverseModePositiveClick) {
                        // Reverse mode + button: Start from earliest, progress positively with inverted layer indices
                        baselineTime = representativeKeyframeTimes[0];
                        for (var i = 1; i < representativeKeyframeTimes.length; i++) {
                            if (representativeKeyframeTimes[i] < baselineTime) {
                                baselineTime = representativeKeyframeTimes[i];
                            }
                        }
                        baselineLabel = "earliest_rep";
                        
                        // For reverse mode + button: invert the layer progression to go forward in time
                        // Top layer (layerIdx=0) at baseline, next layer at baseline + positive interval, etc.
                        var reversedLayerIdx = layerIdx; // Keep same order but make intervals positive
                        targetTime = baselineTime + (reversedLayerIdx * Math.abs(targetInterval));
                        
                        DEBUG_JSX.log("🎯 REVERSE MODE + BUTTON: layer " + layerGroup.layer.index + " position " + layerIdx + " gets time " + (targetTime * 1000).toFixed(1) + "ms (earliest + " + (reversedLayerIdx * Math.abs(targetInterval) * 1000).toFixed(1) + "ms)");
                    } else if (isTopToBottom) {
                        // Reverse direction - button: start from earliest representative time
                        baselineTime = representativeKeyframeTimes[0];
                        for (var i = 1; i < representativeKeyframeTimes.length; i++) {
                            if (representativeKeyframeTimes[i] < baselineTime) {
                                baselineTime = representativeKeyframeTimes[i];
                            }
                        }
                        baselineLabel = "earliest_rep";
                        DEBUG_JSX.log("🎯 REVERSE DIRECTION: Using earliest representative time as baseline");
                        
                        // Standard negative stagger logic
                        targetTime = baselineTime + (layerIdx * targetInterval);
                    } else {
                        // Default direction: use latest representative time  
                        baselineTime = representativeKeyframeTimes[0];
                        for (var i = 1; i < representativeKeyframeTimes.length; i++) {
                            if (representativeKeyframeTimes[i] > baselineTime) {
                                baselineTime = representativeKeyframeTimes[i];
                            }
                        }
                        baselineLabel = "latest_rep";
                        
                        // Standard logic for default direction
                        targetTime = baselineTime + (layerIdx * targetInterval);
                    }
                    
                    DEBUG_JSX.log("🎯 Existing stagger: layer " + layerGroup.layer.index + " position " + layerIdx + " gets time " + (targetTime * 1000).toFixed(1) + "ms (" + baselineLabel + "=" + (baselineTime * 1000).toFixed(1) + "ms)");
                }
            } else {
                // POSITIVE STAGGERS: Use earliest keyframe as baseline (existing logic)
                targetTime = actualEarliestTime + (layerIdx * targetInterval);
                
                // For reverse direction, we want top-to-bottom activation
                // So the top layer (layer 1, layerIdx=0) should get the earliest time
                if (isTopToBottom && targetInterval > 0) {
                    // This case shouldn't occur with current logic but keep for safety
                    targetTime = actualEarliestTime + (layerIdx * Math.abs(targetInterval));
                    DEBUG_JSX.log("🎯 Reverse direction (top-to-bottom): layer " + layerGroup.layer.index + " position " + layerIdx + " gets time " + (targetTime * 1000).toFixed(1) + "ms");
                }
            }
            
            // Find this layer's actual representative keyframe time (earliest keyframe in this layer)
            var layerEarliestTime = null;
            for (var propIdx = 0; propIdx < layerGroup.keyframes.length; propIdx++) {
                var propData = layerGroup.keyframes[propIdx];
                var prop = propData.property;
                var selectedKeys = propData.selectedKeys;
                
                for (var k = 0; k < selectedKeys.length; k++) {
                    var keyTime = prop.keyTime(selectedKeys[k]);
                    if (layerEarliestTime === null || keyTime < layerEarliestTime) {
                        layerEarliestTime = keyTime;
                    }
                }
            }
            
            // Calculate offset needed to move this layer's earliest keyframe to target position
            var snapOffset = targetTime - layerEarliestTime;
            
            DEBUG_JSX.log("🎯 Layer " + layerGroup.layer.index + ": earliest=" + (layerEarliestTime * 1000).toFixed(1) + "ms → target=" + (targetTime * 1000).toFixed(1) + "ms, offset=" + (snapOffset * 1000).toFixed(1) + "ms");
            
            // Store the offset for this layer group
            layerGroup.snapOffset = snapOffset;
        }
        
        // NEGATIVE TIME PROTECTION: Check if any keyframes would go negative and shift everything forward
        if (targetInterval < 0) {
            var earliestTargetTime = null;
            
            // Find the earliest time any keyframe would end up at
            for (var layerIdx = 0; layerIdx < layerGroups.length; layerIdx++) {
                var layerGroup = layerGroups[layerIdx];
                var snapOffset = layerGroup.snapOffset;
                
                for (var propIdx = 0; propIdx < layerGroup.keyframes.length; propIdx++) {
                    var propData = layerGroup.keyframes[propIdx];
                    var prop = propData.property;
                    var selectedKeys = propData.selectedKeys;
                    
                    for (var k = 0; k < selectedKeys.length; k++) {
                        var keyTime = prop.keyTime(selectedKeys[k]);
                        var newKeyTime = keyTime + snapOffset;
                        
                        if (earliestTargetTime === null || newKeyTime < earliestTargetTime) {
                            earliestTargetTime = newKeyTime;
                        }
                    }
                }
            }
            
            // If any keyframe would go negative, shift all offsets forward
            if (earliestTargetTime < 0) {
                var forwardShift = -earliestTargetTime; // Make it positive to shift forward
                DEBUG_JSX.log("🎯 Preventing negative times: shifting all keyframes forward by " + (forwardShift * 1000).toFixed(1) + "ms");
                
                for (var layerIdx = 0; layerIdx < layerGroups.length; layerIdx++) {
                    layerGroups[layerIdx].snapOffset += forwardShift;
                    DEBUG_JSX.log("🎯 Updated Layer " + layerGroups[layerIdx].layer.index + " offset to " + (layerGroups[layerIdx].snapOffset * 1000).toFixed(1) + "ms");
                }
            }
        }
        
        // Apply snapping using keyframe recreation (same pattern as uniform staggers)
        var totalKeyframesToSnap = 0;
        for (var layerIdx = 0; layerIdx < layerGroups.length; layerIdx++) {
            var layerGroup = layerGroups[layerIdx];
            for (var propIdx = 0; propIdx < layerGroup.keyframes.length; propIdx++) {
                totalKeyframesToSnap += layerGroup.keyframes[propIdx].selectedKeys.length;
            }
        }
        
        DEBUG_JSX.log("🎯 Processing " + totalKeyframesToSnap + " keyframes");
        
        // Process each layer group and apply its calculated snap offset (same as uniform staggers)
        var propertyDataForSelection = [];
        
        for (var layerIdx = 0; layerIdx < layerGroups.length; layerIdx++) {
            var layerGroup = layerGroups[layerIdx];
            var snapOffset = layerGroup.snapOffset;
            
            DEBUG_JSX.log("Processing layer " + layerGroup.layer.index + " with snap offset: " + (snapOffset * 1000).toFixed(1) + "ms");
            
            // Process all properties in this layer
            for (var propIdx = 0; propIdx < layerGroup.keyframes.length; propIdx++) {
                var propData = layerGroup.keyframes[propIdx];
                var prop = propData.property;
                var selectedKeys = propData.selectedKeys;

                // PROTECTION: Capture the next keyframe to prevent AE from modifying it
                var nextKeyData = captureNextKeyframe(prop, selectedKeys);

                DEBUG_JSX.log("Processing " + selectedKeys.length + " keyframes on property " + prop.name);

                var keyframesToMove = [];

                // Collect keyframe data for this property (same pattern as uniform staggers)
                for (var k = 0; k < selectedKeys.length; k++) {
                    var keyIndex = selectedKeys[k];
                    var oldTime = prop.keyTime(keyIndex);
                    var newTime = oldTime + snapOffset; // ADD offset to current time (same as uniform staggers)
                    var finalTime = Math.max(0, newTime); // Clamp negatives to zero
                    
                    DEBUG_JSX.log("Keyframe " + keyIndex + ": " + (oldTime * 1000).toFixed(1) + "ms + " + (snapOffset * 1000).toFixed(1) + "ms = " + (finalTime * 1000).toFixed(1) + "ms");
                    
                    var keyData = {
                        property: prop,
                        oldIndex: keyIndex,
                        time: oldTime,
                        newTime: finalTime,
                        value: prop.keyValue(keyIndex),
                        inInterp: prop.keyInInterpolationType(keyIndex),
                        outInterp: prop.keyOutInterpolationType(keyIndex),
                        temporalContinuous: prop.keyTemporalContinuous(keyIndex),
                        temporalAutoBezier: prop.keyTemporalAutoBezier(keyIndex),
                        // CRITICAL: Preserve keyframe color labels
                        label: prop.keyLabel(keyIndex)
                    };
                    
                    // Only collect temporal ease if bezier interpolation (same as uniform staggers)
                    if (keyData.inInterp === KeyframeInterpolationType.BEZIER || keyData.outInterp === KeyframeInterpolationType.BEZIER) {
                        try {
                            keyData.inEase = prop.keyInTemporalEase(keyIndex);
                            keyData.outEase = prop.keyOutTemporalEase(keyIndex);
                        } catch(e) {
                            // Temporal ease might not be available for some properties
                        }
                    }
                    
                    // Handle spatial properties if applicable (Position, etc.) - same as uniform staggers
                    if (prop.isSpatial) {
                        keyData.spatialContinuous = prop.keySpatialContinuous(keyIndex);
                        keyData.spatialAutoBezier = prop.keySpatialAutoBezier(keyIndex);
                        keyData.inTangent = prop.keyInSpatialTangent(keyIndex);
                        keyData.outTangent = prop.keyOutSpatialTangent(keyIndex);
                    }
                    
                    keyframesToMove.push(keyData);
                }
                
                // Store property info for batch recreation (same as delay nudging)
                propertyDataForSelection.push({
                    property: prop,
                    propName: propData.propertyName || prop.name,
                    keyframesToMove: keyframesToMove,
                    nextKeyData: nextKeyData // Store for protection restoration
                });
            }
        }
        
        DEBUG_JSX.log("Data collection complete: Prepared " + propertyDataForSelection.length + " properties for snapping");
        
        // PHASE 2: Remove all old keyframes (SKIP Time Remap properties)
        for (var i = 0; i < propertyDataForSelection.length; i++) {
            var propInfo = propertyDataForSelection[i];
            var prop = propInfo.property;
            var keyframesToMove = propInfo.keyframesToMove;
            
            // Check if this is Time Remap property - SKIP deletion for Time Remap
            var isTimeRemap = false;
            try {
                isTimeRemap = (prop.name === "Time Remap" || prop.matchName === "ADBE Time Remapping");
            } catch(e) {
                // Property name/matchName might not be accessible
            }
            
            if (isTimeRemap) {
                DEBUG_JSX.log("Phase 2: SKIPPING deletion for Time Remap property (will handle in Phase 3)");
                continue; // Skip deletion phase for Time Remap
            }
            
            DEBUG_JSX.log("Phase 2: Removing " + keyframesToMove.length + " old keyframes from " + propInfo.propName);
            
            // Remove old keyframes (in reverse order to maintain indices - same as delay nudging)
            keyframesToMove.sort(function(a, b) { return b.oldIndex - a.oldIndex; });
            for (var k = 0; k < keyframesToMove.length; k++) {
                prop.removeKey(keyframesToMove[k].oldIndex);
            }
        }
        
        // PHASE 3: Recreate all keyframes at snapped times and collect new indices
        for (var i = 0; i < propertyDataForSelection.length; i++) {
            var propInfo = propertyDataForSelection[i];
            var prop = propInfo.property;
            var keyframesToMove = propInfo.keyframesToMove;
            
            DEBUG_JSX.log("Phase 3: Recreating " + keyframesToMove.length + " keyframes on " + propInfo.propName);
            
            // Add new keyframes at snapped times and collect new indices
            var newSelIndices = [];
            // Sort keyframes by time to ensure they're added in chronological order (same as delay nudging)
            keyframesToMove.sort(function(a, b) { return a.newTime - b.newTime; });
            
            // Check if this is Time Remap property for special handling
            var isTimeRemap = false;
            try {
                isTimeRemap = (prop.name === "Time Remap" || prop.matchName === "ADBE Time Remapping");
            } catch(e) {
                // Property name/matchName might not be accessible
            }
            
            if (isTimeRemap) {
                // TIME REMAP SPECIAL HANDLING: Complete "add-before-delete" pattern
                DEBUG_JSX.log("Using Time Remap special handling with complete add-before-delete pattern");
                
                // First, verify old keyframes still exist at expected times
                var actualKeyframesToMove = [];
                for (var k = 0; k < keyframesToMove.length; k++) {
                    var data = keyframesToMove[k];
                    var foundAtOldTime = false;
                    for (var j = 1; j <= prop.numKeys; j++) {
                        if (Math.abs(prop.keyTime(j) - data.time) < 0.001) {
                            foundAtOldTime = true;
                            break;
                        }
                    }
                    if (foundAtOldTime) {
                        actualKeyframesToMove.push(data);
                        DEBUG_JSX.log("Verified Time Remap keyframe exists at " + (data.time * 1000).toFixed(1) + "ms, will move to " + (data.newTime * 1000).toFixed(1) + "ms");
                    } else {
                        DEBUG_JSX.log("WARNING: Time Remap keyframe missing at " + (data.time * 1000).toFixed(1) + "ms - skipping");
                    }
                }
                
                // Add new keyframes using setValueAtTime() first
                for (var k = 0; k < actualKeyframesToMove.length; k++) {
                    var data = actualKeyframesToMove[k];
                    prop.setValueAtTime(data.newTime, data.value);
                    DEBUG_JSX.log("Added Time Remap keyframe at " + (data.newTime * 1000).toFixed(1) + "ms using setValueAtTime");
                }
                
                // Now carefully remove old keyframes (only those that aren't at new positions)
                var oldKeyIndicesToRemove = [];
                for (var k = 0; k < actualKeyframesToMove.length; k++) {
                    var oldTime = actualKeyframesToMove[k].time; // Use 'time' instead of 'oldTime'
                    // Find keyframes at old time and check they're not also at new time
                    for (var j = prop.numKeys; j >= 1; j--) {
                        var keyTime = prop.keyTime(j);
                        if (Math.abs(keyTime - oldTime) < 0.001) {
                            // Make sure this isn't a new keyframe
                            var isNewKey = false;
                            for (var n = 0; n < actualKeyframesToMove.length; n++) {
                                if (Math.abs(keyTime - actualKeyframesToMove[n].newTime) < 0.001) {
                                    isNewKey = true;
                                    break;
                                }
                            }
                            if (!isNewKey) {
                                oldKeyIndicesToRemove.push(j);
                                DEBUG_JSX.log("Marked old Time Remap keyframe at " + (oldTime * 1000).toFixed(1) + "ms for removal (index " + j + ")");
                            }
                        }
                    }
                }
                
                // Remove old keyframes in descending order to avoid index shifts
                oldKeyIndicesToRemove.sort(function(a, b) { return b - a; });
                for (var k = 0; k < oldKeyIndicesToRemove.length; k++) {
                    DEBUG_JSX.log("Removing old Time Remap keyframe at index " + oldKeyIndicesToRemove[k]);
                    prop.removeKey(oldKeyIndicesToRemove[k]);
                }
                
                // Find the new indices for selection
                for (var k = 0; k < actualKeyframesToMove.length; k++) {
                    var data = actualKeyframesToMove[k];
                    // Find the keyframe at the new time
                    for (var j = 1; j <= prop.numKeys; j++) {
                        var keyTime = prop.keyTime(j);
                        if (Math.abs(keyTime - data.newTime) < 0.001) {
                            newSelIndices.push(j);
                            break;
                        }
                    }
                }
            } else {
                // NORMAL HANDLING: Use addKey() approach for all other properties
                for (var k = 0; k < keyframesToMove.length; k++) {
                    var data = keyframesToMove[k];
                    var newIdx = prop.addKey(data.newTime);
                    prop.setValueAtKey(newIdx, data.value);

                    // Apply temporal ease first to avoid flipping linear sides
                    if (data.inEase !== undefined && data.outEase !== undefined) {
                        try {
                            prop.setTemporalEaseAtKey(newIdx, data.inEase, data.outEase);
                        } catch(e) {
                            // Some properties might not support temporal ease
                        }
                    }

                    // Then re-assert original interpolation types
                    prop.setInterpolationTypeAtKey(newIdx, data.inInterp, data.outInterp);
                    
                    prop.setTemporalContinuousAtKey(newIdx, data.temporalContinuous);
                    prop.setTemporalAutoBezierAtKey(newIdx, data.temporalAutoBezier);
                    
                    // Apply spatial properties if they exist (Position, etc.) - same as delay nudging
                    if (data.spatialContinuous !== undefined) {
                        prop.setSpatialContinuousAtKey(newIdx, data.spatialContinuous);
                        prop.setSpatialAutoBezierAtKey(newIdx, data.spatialAutoBezier);
                        prop.setSpatialTangentsAtKey(newIdx, data.inTangent, data.outTangent);
                    }
                    
                    // CRITICAL: Restore keyframe color label
                    if (data.label !== undefined) {
                        try {
                            prop.setLabelAtKey(newIdx, data.label);
                            if (data.label === 0) {
                                DEBUG_JSX.log("    Restored no color label (0) on keyframe " + newIdx);
                            } else {
                                DEBUG_JSX.log("    Restored color label " + data.label + " on keyframe " + newIdx);
                            }
                        } catch(e) {
                            DEBUG_JSX.log("    WARNING: Failed to restore color label " + data.label + " on keyframe " + newIdx + ": " + e.toString());
                        }
                    }
                    
                    newSelIndices.push(newIdx);
                    DEBUG_JSX.log("Added keyframe at " + (data.newTime * 1000).toFixed(1) + "ms, got index " + newIdx);
                }
            }
            
            // Store new indices for deferred selection (same as delay nudging)
            propInfo.newSelIndices = newSelIndices;
        }

        // PROTECTION: Restore the next keyframe for each property after keyframe creation
        for (var i = 0; i < propertyDataForSelection.length; i++) {
            var propInfo = propertyDataForSelection[i];
            var prop = propInfo.property;
            var nextKeyData = propInfo.nextKeyData;
            var keyframesToMove = propInfo.keyframesToMove;

            if (nextKeyData !== null) {
                var keysAdded = keyframesToMove.length - keyframesToMove.length; // In this case, 0 since we remove then add the same count
                restoreNextKeyframe(prop, nextKeyData, keysAdded);
            }
        }

        // PHASE 4: DEFERRED SELECTION - Deselect all, then select new indices at the very end (same as delay nudging)
        DEBUG_JSX.log("Phase 4: Applying deferred selection to all properties");
        for (var i = 0; i < propertyDataForSelection.length; i++) {
            var propInfo = propertyDataForSelection[i];
            var prop = propInfo.property;
            
            // First deselect all keyframes on this property (same as delay nudging)
            for (var j = 1; j <= prop.numKeys; j++) {
                prop.setSelectedAtKey(j, false);
            }
            
            // Then select our new keyframes (same as delay nudging)
            for (var k = 0; k < propInfo.newSelIndices.length; k++) {
                var idx = propInfo.newSelIndices[k];
                prop.setSelectedAtKey(idx, true);
                DEBUG_JSX.log("Selected keyframe at index " + idx + " on " + propInfo.propName);
            }
        }
        
        // CRITICAL: Update layerGroups with new keyframe indices for subsequent stagger application
        DEBUG_JSX.log("Updating layerGroups data structure with new keyframe indices");
        
        for (var i = 0; i < propertyDataForSelection.length; i++) {
            var propInfo = propertyDataForSelection[i];
            var prop = propInfo.property;
            var newSelIndices = propInfo.newSelIndices;
            
            // Find and update the corresponding propData in layerGroups
            for (var layerIdx = 0; layerIdx < layerGroups.length; layerIdx++) {
                var layerGroup = layerGroups[layerIdx];
                for (var propIdx = 0; propIdx < layerGroup.keyframes.length; propIdx++) {
                    var propData = layerGroup.keyframes[propIdx];
                    if (propData.property === prop) {
                        // Update selectedKeys with new indices
                        propData.selectedKeys = newSelIndices.slice(); // Copy array
                        DEBUG_JSX.log("Updated layerGroups: " + prop.name + " selectedKeys = [" + newSelIndices.join(", ") + "]");
                        break;
                    }
                }
            }
        }
        
        // Collect the actual offsets that were applied to each layer
        var layerOffsets = [];
        for (var layerIdx = 0; layerIdx < layerGroups.length; layerIdx++) {
            var layerGroup = layerGroups[layerIdx];
            layerOffsets.push({
                layerIndex: layerGroup.layer.index,
                offsetSeconds: layerGroup.snapOffset || 0
            });
        }
        
        // Return both success status and the actual applied stagger interval in milliseconds
        // Use targetInterval which already has the correct sign from our increment logic
        var actualStaggerMs = targetInterval * 1000;
        DEBUG_JSX.log("Smart snapping applied uniform stagger of " + actualStaggerMs.toFixed(1) + "ms");
        DEBUG_JSX.log("🎯 SNAP RESULT DEBUG: returning staggerMs = " + actualStaggerMs);
        return {success: true, staggerMs: actualStaggerMs, layerOffsets: layerOffsets};
        
    } catch(e) {
        DEBUG_JSX.log("Smart keyframe stagger snapping failed: " + e.toString());
        return {success: false, staggerMs: 0};
    }
}

// Helper function to snap inconsistent staggers to clean multiples of the input value (for layers)
function snapStaggersToInputValue(layerArray, staggerFrames, frameRate, direction, isTopToBottom) {
    try {
        DEBUG_JSX.log("=== SMART SNAPPING ANALYSIS ===");
        DEBUG_JSX.log("Checking if staggers need snapping to " + staggerFrames + " frame increments");
        
        var staggerSeconds = staggerFrames / frameRate; // Convert to seconds
        
        // Adjust target interval based on stagger direction
        var targetStaggerSeconds = staggerSeconds;
        if (isTopToBottom) {
            // For top-to-bottom stagger, we might expect negative intervals
            // Don't force positive - let the direction logic handle it
        }
        
        var tolerance = 0.005; // 5ms tolerance (more forgiving)
        
        if (layerArray.length < 2) {
            DEBUG_JSX.log("Not enough layers for stagger analysis");
            return false;
        }
        
        // For layers, we don't skip based on 0ms detection since first layer naturally starts at 0ms with cumulative stagger
        // Instead, we proceed to interval analysis to detect inconsistent patterns
        
        // Analyze current stagger pattern
        var layerTimes = [];
        for (var i = 0; i < layerArray.length; i++) {
            layerTimes.push({
                layer: layerArray[i],
                time: layerArray[i].startTime,
                index: layerArray[i].index
            });
        }
        
        // Sort by layer index based on stagger direction
        if (isTopToBottom) {
            // Top to bottom: lowest index to highest (Layer 1, Layer 2, Layer 3...)
            layerTimes.sort(function(a, b) { return a.index - b.index; });
            DEBUG_JSX.log("Smart snapping: Sorting layers top to bottom (index ascending)");
        } else {
            // Bottom to top: highest index to lowest (Layer 3, Layer 2, Layer 1...)
            layerTimes.sort(function(a, b) { return b.index - a.index; });
            DEBUG_JSX.log("Smart snapping: Sorting layers bottom to top (index descending)");
        }
        
        // Calculate actual intervals between layers
        var actualIntervals = [];
        for (var i = 1; i < layerTimes.length; i++) {
            var interval = layerTimes[i].time - layerTimes[i-1].time;
            actualIntervals.push(interval);
        }
        
        // Build debug strings manually (ExtendScript doesn't support Array.map)
        var layerTimesStr = "";
        for (var i = 0; i < layerTimes.length; i++) {
            if (i > 0) layerTimesStr += ", ";
            layerTimesStr += "Layer" + layerTimes[i].index + "@" + (layerTimes[i].time * 1000).toFixed(1) + "ms";
        }
        DEBUG_JSX.log("Layer times: " + layerTimesStr);
        
        var intervalsStr = "";
        for (var i = 0; i < actualIntervals.length; i++) {
            if (i > 0) intervalsStr += ", ";
            intervalsStr += (actualIntervals[i] * 1000).toFixed(1) + "ms";
        }
        DEBUG_JSX.log("Actual intervals (seconds): " + intervalsStr);
        DEBUG_JSX.log("Target interval: " + (staggerSeconds * 1000).toFixed(1) + "ms");
        
        // Check if all intervals are uniform (same as each other)
        // If intervals are different, snap them to consistent target intervals
        var isCleanPattern = true;
        
        if (actualIntervals.length > 1) {
            var firstInterval = actualIntervals[0];
            
            for (var i = 1; i < actualIntervals.length; i++) {
                var interval = actualIntervals[i];
                var difference = Math.abs(interval - firstInterval);
                
                DEBUG_JSX.log("Interval " + i + ": " + (interval * 1000).toFixed(1) + "ms vs first interval: " + (firstInterval * 1000).toFixed(1) + "ms, diff: " + (difference * 1000).toFixed(1) + "ms");
                
                if (difference > tolerance) {
                    isCleanPattern = false;
                    DEBUG_JSX.log("Interval " + i + " is different from first interval - needs snapping");
                }
            }
        } else if (actualIntervals.length === 1) {
            var singleInterval = actualIntervals[0];
            DEBUG_JSX.log("Single interval: " + (singleInterval * 1000).toFixed(1) + "ms (uniform by definition)");
            
            // Check if this single interval needs to snap to the target increment
            var difference = Math.abs(singleInterval - staggerSeconds);
            var negDifference = Math.abs(singleInterval - (-staggerSeconds)); // Also check negative target
            DEBUG_JSX.log("Target interval: " + (staggerSeconds * 1000).toFixed(1) + "ms, difference: " + (difference * 1000).toFixed(1) + "ms");
            DEBUG_JSX.log("Negative target: " + (-staggerSeconds * 1000).toFixed(1) + "ms, difference: " + (negDifference * 1000).toFixed(1) + "ms");
            
            // If the interval matches either positive or negative target, it's clean
            if (difference > tolerance && negDifference > tolerance) {
                DEBUG_JSX.log("Single interval needs snapping to target increment");
                isCleanPattern = false;
            } else {
                // Pattern matches either positive or negative target - it's clean
                if (negDifference <= tolerance) {
                    DEBUG_JSX.log("Single interval already matches negative target - no snapping needed");
                } else {
                    DEBUG_JSX.log("Single interval already matches positive target - no snapping needed");
                }
                isCleanPattern = true;
            }
        }
        
        if (isCleanPattern) {
            DEBUG_JSX.log("Pattern is already clean - no snapping needed");
            return false;
        }
        
        // Pattern is inconsistent - calculate snap targets that preserve the baseline
        DEBUG_JSX.log("Pattern is inconsistent - snapping to clean multiples");
        
        var baselineTime = layerTimes[0].time;
        var snapTargets = [baselineTime]; // Baseline stays the same
        
        // For simple 2-layer cases, snap to closest multiple of target increment instead of resetting to base
        var useMultipleSnapping = (layerTimes.length === 2 && actualIntervals.length === 1);
        var targetInterval = staggerSeconds;
        
        if (useMultipleSnapping) {
            // For 2 layers, snap the current interval to the closest multiple of the target increment
            var currentIntervalSigned = actualIntervals[0]; // Preserve sign for negative staggers
            var currentInterval = Math.abs(currentIntervalSigned);
            var currentMultiple = Math.round(currentInterval / staggerSeconds);
            
            // Determine if we currently have a negative stagger
            var isCurrentlyNegative = currentIntervalSigned < 0;
            
            // For irregular staggers, use the user's requested direction, not existing stagger direction
            // This fixes the issue where irregular negative staggers create negative results for + button
            var targetMultiple;
            if (direction > 0) {
                // + direction: Always create positive stagger for irregular patterns
                targetMultiple = 1; // Always start with 1x positive increment
                DEBUG_JSX.log("🎯 IRREGULAR LAYER FIX: + button → forcing positive stagger (targetMultiple = 1)");
            } else {
                // - direction: Always create negative stagger for irregular patterns  
                targetMultiple = -1; // Always start with 1x negative increment
                DEBUG_JSX.log("🎯 IRREGULAR LAYER FIX: - button → forcing negative stagger (targetMultiple = -1)");
            }
            
            targetInterval = targetMultiple * staggerSeconds;
            DEBUG_JSX.log("2-layer snapping: current=" + (currentIntervalSigned * 1000).toFixed(1) + "ms (signed), direction=" + direction + ", snapping to " + targetMultiple + "x increment = " + (targetInterval * 1000).toFixed(1) + "ms");
        }
        
        // Calculate clean stagger targets
        for (var i = 1; i < layerTimes.length; i++) {
            var targetTime = baselineTime + (i * targetInterval);
            snapTargets.push(targetTime);
        }
        
        // Apply snapping
        DEBUG_JSX.log("Snapping " + layerTimes.length + " layers to clean pattern:");
        for (var i = 0; i < layerTimes.length; i++) {
            var currentTime = layerTimes[i].time;
            var targetTime = snapTargets[i];
            DEBUG_JSX.log("  Layer " + layerTimes[i].index + ": " + (currentTime * 1000).toFixed(1) + "ms → " + (targetTime * 1000).toFixed(1) + "ms");
            layerTimes[i].layer.startTime = targetTime;
        }
        
        // Return both success status and the actual applied stagger interval in milliseconds
        var actualStaggerMs = targetInterval * 1000; // Use the calculated target interval
        DEBUG_JSX.log("Smart snapping applied uniform stagger of " + actualStaggerMs.toFixed(1) + "ms");
        return {success: true, staggerMs: actualStaggerMs};
        
    } catch(e) {
        DEBUG_JSX.log("Smart stagger snapping failed: " + e.toString());
        DEBUG_JSX.log("Error details: " + e.message + " at line " + (e.line || "unknown"));
        return {success: false, staggerMs: 0};
    }
}

function snapSameLayerStaggersToInputValue(propertyEntries, orderIndices, staggerFrames, frameRate, direction) {
    try {
        DEBUG_JSX.log("Same-layer snap: checking " + propertyEntries.length + " properties for irregular pattern");
        
        if (!propertyEntries || propertyEntries.length < 2) {
            DEBUG_JSX.log("Same-layer snap: not enough properties to analyze");
            return { success: false };
        }
        
        var staggerSeconds = staggerFrames / frameRate;
        if (!isFinite(staggerSeconds) || Math.abs(staggerSeconds) < 1e-5) {
            DEBUG_JSX.log("Same-layer snap: invalid stagger seconds (" + staggerSeconds + ")");
            return { success: false };
        }
        
        var tolerance = Math.min(0.005, Math.abs(staggerSeconds) * 0.15);
        var absStaggerSeconds = Math.abs(staggerSeconds);
        var targetInterval = direction * absStaggerSeconds;
        var isCleanPattern = true;

        var sequence = [];
        for (var idx = 0; idx < propertyEntries.length; idx++) {
            sequence.push({
                entry: propertyEntries[idx],
                order: orderIndices[idx],
                originalIndex: idx
            });
        }
        sequence.sort(function(a, b) { return a.order - b.order; });

        var actualIntervals = [];
        for (var seqIdx = 1; seqIdx < sequence.length; seqIdx++) {
            var diff = sequence[seqIdx].entry.earliestTime - sequence[seqIdx - 1].entry.earliestTime;
            actualIntervals.push(diff);
            DEBUG_JSX.log("Same-layer snap: interval " + seqIdx + " = " + (diff * 1000).toFixed(3) + "ms");
        }
        
        if (actualIntervals.length === 0) {
            DEBUG_JSX.log("Same-layer snap: no intervals found");
            return { success: false };
        }
        
        for (var intIdx = 0; intIdx < actualIntervals.length; intIdx++) {
            var interval = actualIntervals[intIdx];
            var intervalAbs = Math.abs(interval);
            var nearestMultiple = absStaggerSeconds > 0 ? Math.round(intervalAbs / absStaggerSeconds) * absStaggerSeconds : 0;
            var diffFromMultiple = Math.abs(intervalAbs - nearestMultiple);
            
            if (diffFromMultiple > tolerance) {
                DEBUG_JSX.log("Same-layer snap: interval " + (intIdx + 1) + " deviates by " + (diffFromMultiple * 1000).toFixed(3) + "ms (threshold " + (tolerance * 1000).toFixed(3) + "ms)");
                isCleanPattern = false;
                break;
            }
            
            if (Math.abs(interval) > tolerance && Math.abs(targetInterval) > tolerance) {
                if (interval * targetInterval < -tolerance) {
                    hasOppositeDirection = true;
                }
            }
        }

        if (isCleanPattern) {
            if (hasOppositeDirection) {
                DEBUG_JSX.log("Same-layer snap: pattern already clean but stagger direction differs - skipping snap");
                return { success: false };
            }
            DEBUG_JSX.log("Same-layer snap: pattern already clean, no snapping required");
            return { success: false };
        }
        
        DEBUG_JSX.log("Same-layer snap: irregular pattern detected, snapping to clean increments");
        
        var offsets = new Array(propertyEntries.length);
        for (var initIdx = 0; initIdx < offsets.length; initIdx++) {
            offsets[initIdx] = 0;
        }
        
        var anchorIndex = direction >= 0 ? 0 : (sequence.length - 1);
        var anchorOrder = sequence[anchorIndex].order;
        var baselineTime = sequence[anchorIndex].entry.earliestTime;
        offsets[sequence[anchorIndex].originalIndex] = 0;
        DEBUG_JSX.log("Same-layer snap: anchor order=" + anchorOrder + " time=" + (baselineTime * 1000).toFixed(3) + "ms");
        
        for (var seqIdx = 0; seqIdx < sequence.length; seqIdx++) {
            var seqEntry = sequence[seqIdx];
            if (seqIdx === anchorIndex) continue;
            var relativeOrder = seqEntry.order - anchorOrder;
            var targetTime = baselineTime + (relativeOrder * targetInterval);
            var offset = targetTime - seqEntry.entry.earliestTime;
            offsets[seqEntry.originalIndex] = offset;
            DEBUG_JSX.log("Same-layer snap: property order " + seqEntry.order + " relative=" + relativeOrder + " target=" + (targetTime * 1000).toFixed(3) + "ms, offset=" + (offset * 1000).toFixed(3) + "ms");
        }

        // Verify offsets won't create negative times (beyond tolerance)
        var negativeTolerance = 1 / 1000; // 1ms in seconds
        for (var checkIdx = 0; checkIdx < propertyEntries.length; checkIdx++) {
            var checkEntry = propertyEntries[checkIdx];
            var proposedTime = checkEntry.earliestTime + offsets[checkIdx];
            if (proposedTime < -negativeTolerance) {
                DEBUG_JSX.log("Same-layer snap: offset would push property " + checkEntry.propertyName + " to negative time " + (proposedTime * 1000).toFixed(3) + "ms - aborting snap");
                return { success: false };
            }
        }

        return {
            success: true,
            staggerMs: roundMs(absStaggerSeconds),
            offsets: offsets
        };
        
    } catch(e) {
        DEBUG_JSX.log("Same-layer snap error: " + e.toString());
        return { success: false };
    }
}

// Main stagger function called from panel +/- buttons
function applyStagger(direction, staggerFrames, isTopToBottom) {
    try {
        // Clear debug messages from previous operations
        DEBUG_JSX.clear();
        
        // Default to bottom-to-top (false) if not specified
        if (isTopToBottom === undefined) {
            isTopToBottom = false;
        }
        
        DEBUG_JSX.log("🚀 MAIN applyStagger called - direction: " + direction + ", frames: " + staggerFrames + ", topToBottom: " + isTopToBottom);
        
        // Force show this debug immediately
        $.writeln("🚀 AIRBOARD DEBUG: applyStagger function called with direction=" + direction + ", frames=" + staggerFrames);
        app.beginUndoGroup("Apply Stagger " + (direction > 0 ? "Forward" : "Backward"));
        
        var comp = app.project.activeItem;
        if (!(comp && comp instanceof CompItem)) {
            app.endUndoGroup();
            var debugMessages = DEBUG_JSX.getMessages();
            return "error|No composition selected|" + debugMessages.join("|");
        }
        
        var frameRate = comp.frameRate;
        if (!frameRate || frameRate <= 0) {
            app.endUndoGroup();
            var debugMessages = DEBUG_JSX.getMessages();
            return "error|Invalid frame rate: " + frameRate + "|" + debugMessages.join("|");
        }
        
        // Convert stagger frames to milliseconds
        var staggerMs = roundMs(staggerFrames / frameRate);
        DEBUG_JSX.log("Stagger: " + staggerFrames + " frames = " + staggerMs + "ms at " + frameRate + "fps");
        
        // Check for selected keyframes first (keyframes take precedence)
        var keyframeResult = applyStaggerToKeyframes(direction, staggerMs, frameRate, staggerFrames, isTopToBottom);
        if (keyframeResult.indexOf("error|No selected keyframes") !== 0) {
            app.endUndoGroup();
            var debugMessages = DEBUG_JSX.getMessages();
            return keyframeResult + "|" + debugMessages.join("|");
        }
        
        // If no keyframes selected, try layers
        var layerResult = applyStaggerToLayers(direction, staggerMs, frameRate, staggerFrames, isTopToBottom);
        
        app.endUndoGroup();
        var debugMessages = DEBUG_JSX.getMessages();
        return layerResult + "|" + debugMessages.join("|");
        
    } catch(e) {
        app.endUndoGroup();
        var debugMessages = DEBUG_JSX.getMessages();
        return "error|Stagger failed: " + e.toString() + "|" + debugMessages.join("|");
    }
}

// UNIVERSAL PROPERTY SORTING SYSTEM
// Works on any property type without manual targeting - no more brittle hardcoded patterns!
function sortPropertiesUniversally(propA, propB, isTopToBottom, allKeyframes) {
    try {
        DEBUG_JSX.log("Universal sort: comparing '" + propA + "' vs '" + propB + "'");
        
        // PHASE 1: Extract property hierarchy information dynamically
        var propAInfo = analyzePropertyHierarchy(propA, allKeyframes);
        var propBInfo = analyzePropertyHierarchy(propB, allKeyframes);
        
        DEBUG_JSX.log("  A: " + JSON.stringify(propAInfo));
        DEBUG_JSX.log("  B: " + JSON.stringify(propBInfo));
        
        // PHASE 2: Sort by property group hierarchy first
        if (propAInfo.group !== propBInfo.group) {
            var groupOrder = getPropertyGroupOrder();
            var aGroupIndex = -1;
            var bGroupIndex = -1;
            
            // Manual indexOf since ExtendScript doesn't have Array.indexOf
            for (var i = 0; i < groupOrder.length; i++) {
                if (groupOrder[i] === propAInfo.group) aGroupIndex = i;
                if (groupOrder[i] === propBInfo.group) bGroupIndex = i;
            }
            
            // If one group is not in our known list, put it after known groups
            if (aGroupIndex === -1) aGroupIndex = groupOrder.length;
            if (bGroupIndex === -1) bGroupIndex = groupOrder.length;
            
            DEBUG_JSX.log("  Group sort: " + propAInfo.group + " (idx=" + aGroupIndex + ") vs " + propBInfo.group + " (idx=" + bGroupIndex + ")");
            return isTopToBottom ? (bGroupIndex - aGroupIndex) : (aGroupIndex - bGroupIndex);
        }
        
        // PHASE 3: If same group, sort by numerical sequences
        if (propAInfo.hasNumber && propBInfo.hasNumber) {
            DEBUG_JSX.log("  Number sort: " + propAInfo.number + " vs " + propBInfo.number);
            return isTopToBottom ? (propBInfo.number - propAInfo.number) : (propAInfo.number - propBInfo.number);
        }
        
        // PHASE 4: If same group but no numbers, sort by property indices within their actual property groups
        if (propAInfo.group === propBInfo.group) {
            var aIndex = getPropertyIndexInGroup(propA, allKeyframes);
            var bIndex = getPropertyIndexInGroup(propB, allKeyframes);
            
            if (aIndex !== -1 && bIndex !== -1) {
                DEBUG_JSX.log("  Index sort: " + propA + " (idx=" + aIndex + ") vs " + propB + " (idx=" + bIndex + ")");
                return isTopToBottom ? (bIndex - aIndex) : (aIndex - bIndex);
            }
        }
        
        // PHASE 5: Fallback to alphabetical sorting
        DEBUG_JSX.log("  Alphabetical sort: " + propA + " vs " + propB);
        return isTopToBottom ? propB.localeCompare(propA) : propA.localeCompare(propB);
        
    } catch(e) {
        DEBUG_JSX.log("Universal sort error: " + e.toString() + ", falling back to alphabetical");
        return isTopToBottom ? propB.localeCompare(propA) : propA.localeCompare(propB);
    }
}

// Analyze a property name to extract hierarchy and structural information
function analyzePropertyHierarchy(propertyName, allKeyframes) {
    var info = {
        group: "Unknown",
        hasNumber: false,
        number: 0,
        originalName: propertyName
    };
    
    // Extract numerical sequences - prioritize Rectangle numbers over Path numbers
    // Look for "Rectangle X" pattern first, then fall back to any number
    var rectangleMatch = propertyName.match(/Rectangle (\d+)/);
    if (rectangleMatch) {
        info.hasNumber = true;
        info.number = parseInt(rectangleMatch[1]);
    } else {
        // Fall back to any number in the property name
        var numberMatch = propertyName.match(/(\d+)/);
        if (numberMatch) {
            info.hasNumber = true;
            info.number = parseInt(numberMatch[1]);
        }
    }
    
    // Determine property group by analyzing the full property path
    if (propertyName.indexOf("Transform >") !== -1) {
        info.group = "Transform";
    } else if (propertyName.indexOf("Effects >") !== -1) {
        info.group = "Effects";
    } else if (propertyName.indexOf("Masks >") !== -1) {
        info.group = "Masks";  
    } else if (propertyName === "Time Remap" || propertyName.indexOf("Time Remap") !== -1) {
        info.group = "Special";
    } else if (propertyName.indexOf("Contents >") !== -1 || propertyName.indexOf("Rectangle") !== -1 || 
               propertyName.indexOf("Ellipse") !== -1 || propertyName.indexOf("Star") !== -1 ||
               propertyName.indexOf("Polystar") !== -1 || propertyName.indexOf("Path") !== -1) {
        info.group = "Shape";
    } else if (propertyName.indexOf("Text >") !== -1) {
        info.group = "Text";
    } else if (propertyName.indexOf("Audio Levels") !== -1) {
        info.group = "Special";
    } else {
        // For unknown properties, try to infer from the property structure
        info.group = "Other";
    }
    
    return info;
}

// Define the standard After Effects property group hierarchy
function getPropertyGroupOrder() {
    // This represents the typical top-to-bottom order in After Effects timeline
    return [
        "Transform",    // Transform properties (Position, Scale, etc.)
        "Shape",        // Shape layer contents (Rectangle 1, Rectangle 2, etc.)
        "Text",         // Text layer properties
        "Effects",      // Effects and their parameters
        "Masks",        // Mask properties
        "Special",      // Time Remap, Audio Levels, etc.
        "Other"         // Unknown property types
    ];
}

// Get the actual property index within its group by examining the keyframe data
function getPropertyIndexInGroup(propertyName, allKeyframes) {
    try {
        // Find a keyframe with this property name to get the actual property reference
        for (var i = 0; i < allKeyframes.length; i++) {
            var keyframe = allKeyframes[i];
            if (keyframe.propertyName === propertyName && keyframe.property) {
                // Try to get the property index within its parent group
                try {
                    var prop = keyframe.property;
                    var parent = prop.parentProperty;
                    
                    if (parent) {
                        // Find this property's index within its parent
                        for (var j = 1; j <= parent.numProperties; j++) {
                            var siblingProp = parent.property(j);
                            if (siblingProp === prop) {
                                return j; // Return 1-based index
                            }
                        }
                    }
                    
                    // If no parent, try to use propertyIndex directly
                    if (prop.propertyIndex !== undefined) {
                        return prop.propertyIndex;
                    }
                } catch(e) {
                    // Property reference might be stale
                }
                break;
            }
        }
    } catch(e) {
        // Fallback gracefully
    }
    
    return -1; // Could not determine index
}



// Apply stagger to selected keyframes (grouped by layer)
function applyStaggerToKeyframes(direction, staggerMs, frameRate, staggerFrames, isTopToBottom) {
    try {
        DEBUG_JSX.log("🎬 applyStaggerToKeyframes called with direction: " + direction + ", stagger: " + staggerFrames + " frames");
        
        var comp = app.project.activeItem;
        var selectedLayers = comp.selectedLayers;
        
        DEBUG_JSX.log("Found " + selectedLayers.length + " selected layers");
        
        if (selectedLayers.length === 0) {
            return "error|No layers selected";
        }
        
        // Collect all selected keyframes grouped by layer
        var layerGroups = [];
        var hasSelectedKeyframes = false;
        
        for (var layerIdx = 0; layerIdx < selectedLayers.length; layerIdx++) {
            var layer = selectedLayers[layerIdx];
            var layerKeyframes = [];
            
            DEBUG_JSX.log("Checking layer " + layer.index + ": " + layer.name);
            
            // Use the same robust keyframe collection as delay nudging system
            var selectedProps = layer.selectedProperties;
            DEBUG_JSX.log("Layer has " + selectedProps.length + " selected properties");
            
            for (var j = 0; j < selectedProps.length; j++) {
                var prop = selectedProps[j];
                
                // Same validation as delay nudging
                if (!prop || prop.propertyValueType === PropertyValueType.NO_VALUE) continue;
                if (!prop.canVaryOverTime || prop.numKeys === 0) continue;
                
                var selKeys = prop.selectedKeys;
                if (!selKeys || selKeys.length === 0) continue;
                
                DEBUG_JSX.log("Found " + selKeys.length + " selected keyframes on " + getFullPropertyPath(prop));
                
                var encounterOrder = layerKeyframes.length;
                var sortKey = getPropertySortKey(prop);
                layerKeyframes.push({
                    property: prop,
                    propertyName: getFullPropertyPath(prop),
                    selectedKeys: selKeys.slice(),
                    encounterOrder: encounterOrder,
                    sortKey: sortKey
                });
                hasSelectedKeyframes = true;
            }
            
            // IMPORTANT: Check Time Remap separately (same as delay nudging)
            // Only add if it wasn't already found in selectedProperties
            try {
                if (layer.timeRemapEnabled && layer.timeRemap && layer.timeRemap.numKeys > 0) {
                    // Check if Time Remap was already added via selectedProperties
                    // Compare by matchName since property references might differ
                    var timeRemapAlreadyAdded = false;
                    for (var check = 0; check < layerKeyframes.length; check++) {
                        var checkProp = layerKeyframes[check].property;
                        if (checkProp && checkProp.matchName === "ADBE Time Remapping") {
                            timeRemapAlreadyAdded = true;
                            DEBUG_JSX.log("Time Remap already found in selectedProperties - skipping duplicate check");
                            break;
                        }
                    }

                    if (!timeRemapAlreadyAdded) {
                        var selectedTimeRemapKeys = [];
                        for (var k = 1; k <= layer.timeRemap.numKeys; k++) {
                            if (layer.timeRemap.keySelected(k)) {
                                selectedTimeRemapKeys.push(k);
                            }
                        }

                        if (selectedTimeRemapKeys.length > 0) {
                            DEBUG_JSX.log("Found " + selectedTimeRemapKeys.length + " selected Time Remap keyframes on layer " + layer.index + " (via separate check)");
                            var trEncounterOrder = layerKeyframes.length;
                            var trSortKey = getPropertySortKey(layer.timeRemap);
                            layerKeyframes.push({
                                property: layer.timeRemap,
                                propertyName: "Time Remap",
                                selectedKeys: selectedTimeRemapKeys,
                                isTimeRemap: true, // Flag for special handling
                                encounterOrder: trEncounterOrder,
                                sortKey: trSortKey
                            });
                            hasSelectedKeyframes = true;
                        }
                    }
                }
            } catch(e) {
                DEBUG_JSX.log("Time Remap check failed: " + e.toString());
            }
            
            // Search audio levels (if audio layer)
            try {
                if (layer.hasAudio && layer.audioLevels && layer.audioLevels.canVaryOverTime && layer.audioLevels.numKeys > 0) {
                    var selectedAudioKeys = [];
                    for (var k = 1; k <= layer.audioLevels.numKeys; k++) {
                        if (layer.audioLevels.keySelected(k)) {
                            selectedAudioKeys.push(k);
                        }
                    }
                    
                    if (selectedAudioKeys.length > 0) {
                        var audioEncounterOrder = layerKeyframes.length;
                        var audioSortKey = getPropertySortKey(layer.audioLevels);
                        layerKeyframes.push({
                            property: layer.audioLevels,
                            propertyName: "Audio Levels",
                            selectedKeys: selectedAudioKeys,
                            encounterOrder: audioEncounterOrder,
                            sortKey: audioSortKey
                        });
                        hasSelectedKeyframes = true;
                    }
                }
            } catch(e) {
                // Audio levels might not be available
            }

            if (layerKeyframes.length > 0) {
                layerGroups.push({
                    layer: layer,
                    layerIndex: layer.index,
                    keyframes: layerKeyframes
                });
            }
        }
        
        DEBUG_JSX.log("hasSelectedKeyframes: " + hasSelectedKeyframes);
        
        if (!hasSelectedKeyframes) {
            DEBUG_JSX.log("No selected keyframes found - returning error");
            var debugMessages = DEBUG_JSX.getMessages();
            return "error|No selected keyframes found|" + debugMessages.join("|");
        }
        
        // Sort layers by index
        // If isTopToBottom is true: top to bottom (lowest index to highest)
        // If isTopToBottom is false: bottom to top (highest index to lowest)
        if (isTopToBottom) {
            layerGroups.sort(function(a, b) { return a.layerIndex - b.layerIndex; });
            DEBUG_JSX.log("Sorting keyframe layers top to bottom (index ascending)");
        } else {
            layerGroups.sort(function(a, b) { return b.layerIndex - a.layerIndex; });
            DEBUG_JSX.log("Sorting keyframe layers bottom to top (index descending)");
        }
        
        DEBUG_JSX.log("Found " + layerGroups.length + " layer groups with selected keyframes");
        
        if (layerGroups.length === 1) {
            DEBUG_JSX.log("Single layer detected - attempting property-level stagger");
            return applySameLayerStagger(layerGroups[0], direction, staggerMs, frameRate, staggerFrames, isTopToBottom);
        }
        
        // Skip cross-property staggering - only stagger between different layers
        
        // PERFORMANCE OPTIMIZATION: Move markers BEFORE keyframe operations (same as delay nudging)
        // This prevents selection interference and eliminates extra selection steps
        DEBUG_JSX.log("STEP 1: Moving markers BEFORE keyframe operations to avoid selection interference");
        
        // SMART marker split/merge for each property being staggered
        var markerEpsilon = 0.01;
        var staggerMarkersSplitMerged = 0;

        for (var layerIdx = 0; layerIdx < layerGroups.length; layerIdx++) {
            var layerGroup = layerGroups[layerIdx];
            var layer = layerGroup.layer;

            // Calculate the stagger offset this layer will receive
            var layerStaggerOffset = layerIdx * direction * staggerMs / 1000; // Convert to seconds

            if (Math.abs(layerStaggerOffset) < 0.001) {
                continue; // Skip layers with no offset
            }

            // Check if layer has markers
            if (!layer.marker || layer.marker.numKeys === 0) continue;

            DEBUG_JSX.log("SMART STAGGER: Processing layer " + layer.name + " with offset " + (layerStaggerOffset * 1000).toFixed(1) + "ms");

            // Process each property on this layer individually for smart split/merge
            for (var propIdx = 0; propIdx < layerGroup.keyframes.length; propIdx++) {
                var propData = layerGroup.keyframes[propIdx];
                var prop = propData.property;
                var selectedKeys = propData.selectedKeys;

                if (selectedKeys.length === 0) continue;

                // Skip if no actual movement
                if (Math.abs(layerStaggerOffset) < markerEpsilon) continue;

                // Get unique property ID for marker block identification
                var uniquePropId = getUniquePropertyId(prop);

                // NEW: Loop through ALL selected keyframes, not just first
                var markersProcessed = 0;
                for (var kIdx = 0; kIdx < selectedKeys.length; kIdx++) {
                    var keyIndex = selectedKeys[kIdx];

                    // Get the OLD keyframe time (before stagger)
                    var oldKeyTime = prop.keyTime(keyIndex);

                    // Calculate NEW keyframe time (after stagger)
                    var newKeyTime = Math.max(0, oldKeyTime + layerStaggerOffset);

                    // Call smart split/merge for this keyframe
                    try {
                        var result = smartSplitMergeMarker(
                            layer.marker,
                            oldKeyTime,
                            newKeyTime,
                            uniquePropId,
                            markerEpsilon
                        );

                        if (result !== "no marker at old time" && result !== "no spring block for property") {
                            markersProcessed++;
                            staggerMarkersSplitMerged++;
                            DEBUG_JSX.log("SMART STAGGER: " + propData.propertyName + " @ " + oldKeyTime.toFixed(3) + "s - " + result);
                        }
                    } catch(smartMarkerError) {
                        DEBUG_JSX.log("SMART STAGGER ERROR: " + propData.propertyName + " @ " + oldKeyTime.toFixed(3) + "s - " + smartMarkerError.toString());
                    }
                }
            }
        }

        if (staggerMarkersSplitMerged > 0) {
            DEBUG_JSX.log("STEP 1: Processed " + staggerMarkersSplitMerged + " markers with smart split/merge");
        } else {
            DEBUG_JSX.log("STEP 1: No markers to process");
        }
        
        // STEP 2: Now perform keyframe operations after markers are positioned
        DEBUG_JSX.log("STEP 2: Performing keyframe operations after marker positioning");
        
        // First: Snap inconsistent staggers to clean multiples of input value
        // Use original direction (like layers do) - isTopToBottom handled by sorting only
        DEBUG_JSX.log("Smart snapping direction: " + direction + " (topToBottom handled by layer sorting)");
        var snapResult = snapKeyframeStaggersToInputValue(layerGroups, staggerFrames, frameRate, direction, isTopToBottom);
        
        if (snapResult.success) {
            DEBUG_JSX.log("Snapped keyframes to clean " + staggerFrames + " frame increments");
            
            // Markers are now handled in STEP 1 (before keyframe operations) to avoid extra selection steps
            
            // Smart snapping already created the correct uniform pattern - no additional stagger needed
            DEBUG_JSX.log("🎯 FINAL RESULT DEBUG: snapResult.staggerMs = " + snapResult.staggerMs);
            var successMessage = "Applied stagger to " + layerGroups.length + " layers|" + snapResult.staggerMs + "ms per layer";
            return "success|" + successMessage;
        }
        
        DEBUG_JSX.log("Keyframe stagger - applying cumulative stagger: " + (direction * staggerMs) + "ms per layer position");
        
        // Pre-check: if ANY keyframe would go negative, abort entire operation
        for (var preCheckIdx = 0; preCheckIdx < layerGroups.length; preCheckIdx++) {
            var layerGroup = layerGroups[preCheckIdx];
            var staggerOffset = preCheckIdx * direction * staggerMs / 1000; // in seconds
            
            for (var propIdx = 0; propIdx < layerGroup.keyframes.length; propIdx++) {
                var propData = layerGroup.keyframes[propIdx];
                var prop = propData.property;
                var selectedKeys = propData.selectedKeys;
                
                for (var k = 0; k < selectedKeys.length; k++) {
                    var keyIndex = selectedKeys[k];
                    var oldTime = prop.keyTime(keyIndex);
                    var newTime = oldTime + staggerOffset;
                    
                    // Allow small negative values (floating point errors) that are essentially zero
                    var newTimeMs = newTime * 1000;
                    if (newTimeMs < -1) { // 1ms tolerance for floating point errors
                        DEBUG_JSX.log("Keyframe stagger operation aborted - " + propData.propertyName + " keyframe would go to " + newTimeMs + "ms (significantly negative)");
                        return "success|Stagger stopped to prevent negative times|0ms per layer";
                    }
                }
            }
        }
        
        // Apply CUMULATIVE stagger to each layer group (no clamping needed since pre-checked)
        var processedLayers = 0;
        var layersWithActualMovement = 0;
        
        for (var layerIdx = 0; layerIdx < layerGroups.length; layerIdx++) {
            var layerGroup = layerGroups[layerIdx];
            var layer = layerGroup.layer;
            
            // Calculate cumulative stagger offset for this layer position
            var staggerOffset = layerIdx * direction * staggerMs / 1000; // in seconds
            
            DEBUG_JSX.log("Layer " + layerGroup.layer.index + ": applying cumulative offset " + (staggerOffset * 1000) + "ms");
            
            // NOTE: Marker split/merge is now handled in STEP 1 (before keyframe operations)
            // This prevents selection interference and uses smart split/merge logic
            // No additional marker processing needed here
            
            // Move all keyframes in this layer by the cumulative offset (no clamping needed since pre-checked)
            var layerHadMovement = false; // Track if any keyframes in this layer actually moved
            for (var propIdx = 0; propIdx < layerGroup.keyframes.length; propIdx++) {
                var propData = layerGroup.keyframes[propIdx];
                var prop = propData.property;
                var selectedKeys = propData.selectedKeys;
                
                // Check if this is Time Remap property for special handling
                if (propData.isTimeRemap) {
                    DEBUG_JSX.log("Using special Time Remap handling for stagger");
                    
                    // TIME REMAP: Special handling - add new keyframes first, then remove old
                    var timeRemapMoves = [];
                    for (var k = 0; k < selectedKeys.length; k++) {
                        var keyIndex = selectedKeys[k];
                        var oldTime = prop.keyTime(keyIndex);
                        var newTime = oldTime + staggerOffset;
                        var finalTime = Math.max(0, newTime);
                        
                        // Track if this keyframe actually moved
                        if (Math.abs(finalTime - oldTime) > 0.001) {
                            layerHadMovement = true;
                        }
                        
                        DEBUG_JSX.log("Time Remap: Moving keyframe from " + (oldTime * 1000) + "ms to " + (finalTime * 1000) + "ms");
                        
                        timeRemapMoves.push({
                            oldIndex: keyIndex,
                            oldTime: oldTime,
                            newTime: finalTime,
                            value: prop.keyValue(keyIndex)
                        });
                    }
                    
                    // Add new keyframes first
                    for (var k = 0; k < timeRemapMoves.length; k++) {
                        var move = timeRemapMoves[k];
                        prop.setValueAtTime(move.newTime, move.value);
                    }
                    
                    // Remove old keyframes (carefully check they exist and aren't at new positions)
                    var oldKeyIndicesToRemove = [];
                    for (var k = 0; k < timeRemapMoves.length; k++) {
                        var oldTime = timeRemapMoves[k].oldTime;
                        
                        // Find the keyframe at the old time
                        for (var j = prop.numKeys; j >= 1; j--) {
                            var keyTime = prop.keyTime(j);
                            if (Math.abs(keyTime - oldTime) < 0.001) {
                                // Make sure this isn't a new keyframe
                                var isNewKey = false;
                                for (var n = 0; n < timeRemapMoves.length; n++) {
                                    if (Math.abs(keyTime - timeRemapMoves[n].newTime) < 0.001) {
                                        isNewKey = true;
                                        break;
                                    }
                                }
                                if (!isNewKey) {
                                    oldKeyIndicesToRemove.push(j);
                                }
                            }
                        }
                    }
                    
                    // Remove in descending order
                    oldKeyIndicesToRemove.sort(function(a, b) { return b - a; });
                    for (var k = 0; k < oldKeyIndicesToRemove.length; k++) {
                        try {
                            prop.removeKey(oldKeyIndicesToRemove[k]);
                        } catch(e) {
                            DEBUG_JSX.log("Failed to remove old Time Remap key: " + e.toString());
                        }
                    }
                    
                    // Find new indices for selection
                    var newSelIndices = [];
                    for (var k = 0; k < timeRemapMoves.length; k++) {
                        var targetTime = timeRemapMoves[k].newTime;
                        for (var j = 1; j <= prop.numKeys; j++) {
                            if (Math.abs(prop.keyTime(j) - targetTime) < 0.001) {
                                newSelIndices.push(j);
                                break;
                            }
                        }
                    }
                    
                    // Store the new indices for final selection
                    propData.newSelIndices = newSelIndices;
                    
                } else {
                    // NORMAL PROPERTIES: Standard remove/recreate approach
                    // Process all keyframes in this property (none would clamp)

                    // PROTECTION: Capture the next keyframe to prevent AE from modifying it
                    var nextKeyData = captureNextKeyframe(prop, selectedKeys);

                    var keyframeData = [];
                    for (var k = 0; k < selectedKeys.length; k++) {
                        var keyIndex = selectedKeys[k];
                        var oldTime = prop.keyTime(keyIndex);
                        var newTime = oldTime + staggerOffset; // Use cumulative offset
                        var finalTime = Math.max(0, newTime); // Clamp small negatives to zero
                        
                        // Track if this keyframe actually moved
                        if (Math.abs(finalTime - oldTime) > 0.001) {
                            layerHadMovement = true;
                        }
                        
                        DEBUG_JSX.log("Moving keyframe from " + (oldTime * 1000) + "ms to " + (finalTime * 1000) + "ms");
                        
                        var keyData = {
                            oldIndex: keyIndex,
                            newTime: finalTime,
                            value: prop.keyValue(keyIndex),
                            inInterp: prop.keyInInterpolationType(keyIndex),
                            outInterp: prop.keyOutInterpolationType(keyIndex),
                            temporalContinuous: prop.keyTemporalContinuous(keyIndex),
                            temporalAutoBezier: prop.keyTemporalAutoBezier(keyIndex),
                            // CRITICAL: Preserve keyframe color labels
                            label: prop.keyLabel(keyIndex)
                        };
                        
                        // CRITICAL FIX: Preserve temporal ease for bezier keyframes (same as timeline mode)
                        if (keyData.inInterp === KeyframeInterpolationType.BEZIER || 
                            keyData.outInterp === KeyframeInterpolationType.BEZIER) {
                            try {
                                keyData.inEase = prop.keyInTemporalEase(keyIndex);
                                keyData.outEase = prop.keyOutTemporalEase(keyIndex);
                            } catch(e) {
                                // Temporal ease might not be available for some properties
                            }
                        }
                        
                        // CRITICAL FIX: Preserve spatial properties for position keyframes (same as timeline mode)
                        if (prop.isSpatial) {
                            try {
                                keyData.spatialContinuous = prop.keySpatialContinuous(keyIndex);
                                keyData.spatialAutoBezier = prop.keySpatialAutoBezier(keyIndex);
                                keyData.inTangent = prop.keyInSpatialTangent(keyIndex);
                                keyData.outTangent = prop.keyOutSpatialTangent(keyIndex);
                            } catch(e) {
                                // Spatial properties might not be available
                            }
                        }
                        
                        keyframeData.push(keyData);
                    }
                    
                    // Remove old keyframes (in reverse order to maintain indices)
                    for (var k = keyframeData.length - 1; k >= 0; k--) {
                        prop.removeKey(keyframeData[k].oldIndex);
                    }
                    
                    // Create new keyframes with preserved properties and collect new indices
                    var newSelIndices = [];
                    for (var k = 0; k < keyframeData.length; k++) {
                        var data = keyframeData[k];
                        var newIdx = prop.addKey(data.newTime);
                        
                        // Restore value and interpolation
                        prop.setValueAtKey(newIdx, data.value);

                        // Apply temporal ease first to avoid flipping linear sides
                        if (data.inEase !== undefined && data.outEase !== undefined) {
                            try {
                                prop.setTemporalEaseAtKey(newIdx, data.inEase, data.outEase);
                            } catch(e) {
                                // Some properties might not support temporal ease
                            }
                        }

                        // Then re-assert original interpolation types
                        prop.setInterpolationTypeAtKey(newIdx, data.inInterp, data.outInterp);
                        prop.setTemporalContinuousAtKey(newIdx, data.temporalContinuous);
                        prop.setTemporalAutoBezierAtKey(newIdx, data.temporalAutoBezier);
                        
                        // CRITICAL FIX: Restore spatial properties if they exist (same as timeline mode)
                        if (data.spatialContinuous !== undefined) {
                            try {
                                prop.setSpatialContinuousAtKey(newIdx, data.spatialContinuous);
                                prop.setSpatialAutoBezierAtKey(newIdx, data.spatialAutoBezier);
                                prop.setSpatialTangentsAtKey(newIdx, data.inTangent, data.outTangent);
                            } catch(e) {
                                // Some properties might not support spatial settings
                            }
                        }
                        
                        newSelIndices.push(newIdx);
                    }

                    // PROTECTION: Restore the next keyframe
                    if (nextKeyData !== null) {
                        var keysAdded = newSelIndices.length - keyframeData.length;
                        restoreNextKeyframe(prop, nextKeyData, keysAdded);
                    }

                    // Store the new indices for final selection
                    propData.newSelIndices = newSelIndices;
                }
            }
            
            // NOTE: Marker processing removed - already handled by smart split/merge in STEP 1
            
            // Track layers with actual movement
            if (layerHadMovement) {
                layersWithActualMovement++;
            }
            
            processedLayers++;
        }
        
        // Final pass: Select all the new keyframes after all adjustments are complete (same as delay nudging)
        try {
            DEBUG_JSX.log("Final keyframe selection pass for " + layerGroups.length + " layer groups");
            for (var layerIdx = 0; layerIdx < layerGroups.length; layerIdx++) {
                var layerGroup = layerGroups[layerIdx];
                
                for (var propIdx = 0; propIdx < layerGroup.keyframes.length; propIdx++) {
                    var propData = layerGroup.keyframes[propIdx];
                    
                    if (propData.newSelIndices) {
                        var prop = propData.property;
                        for (var k = 0; k < propData.newSelIndices.length; k++) {
                            try {
                                prop.setSelectedAtKey(propData.newSelIndices[k], true);
                            } catch(finalSelError) {
                                DEBUG_JSX.log("Final selection failed for keyframe " + propData.newSelIndices[k] + ": " + finalSelError.toString());
                            }
                        }
                        DEBUG_JSX.log("Selected " + propData.newSelIndices.length + " keyframes on " + propData.propertyName);
                    }
                }
            }
            DEBUG_JSX.log("Completed final keyframe selection pass");
        } catch(finalPassError) {
            DEBUG_JSX.log("Final keyframe selection pass failed: " + finalPassError.toString());
        }
        
        // NOTE: Marker syncing is already handled in STEP 1 before keyframe operations.
        // This eliminates the need for post-operation marker sync and keyframe reselection.
        
        // If no layers had actual movement, show 0ms stagger since nothing actually moved
        var effectiveStagger = layersWithActualMovement > 0 ? (direction * staggerMs) : 0;
        
        return "success|Applied stagger to " + processedLayers + " layers|" + effectiveStagger + "ms per layer";
        
    } catch(e) {
        return "error|Keyframe stagger failed: " + e.toString();
    }
}

// Apply stagger to selected properties within a single layer
function applySameLayerStagger(layerGroup, direction, staggerMs, frameRate, staggerFrames, isTopToBottom) {
    try {
        var layer = layerGroup.layer;
        var secondsPerStep = staggerMs / 1000;
        var propertyMap = {};
        var propertyEntries = [];
        
        for (var propIdx = 0; propIdx < layerGroup.keyframes.length; propIdx++) {
            var propData = layerGroup.keyframes[propIdx];
            var prop = propData.property;
            var uniquePath = propData.propertyName || getFullPropertyPath(prop);
            
            if (!propertyMap[uniquePath]) {
                propertyMap[uniquePath] = {
                    property: prop,
                    propertyName: uniquePath,
                    selectedKeys: propData.selectedKeys.slice(),
                    encounterOrder: propData.encounterOrder !== undefined ? propData.encounterOrder : propIdx,
                    isTimeRemap: propData.isTimeRemap === true,
                    sortKey: propData.sortKey || getPropertySortKey(prop)
                };
                propertyEntries.push(propertyMap[uniquePath]);
            } else {
                var existing = propertyMap[uniquePath];
                for (var s = 0; s < propData.selectedKeys.length; s++) {
                    var keyIndex = propData.selectedKeys[s];
                    var exists = false;
                    for (var e = 0; e < existing.selectedKeys.length; e++) {
                        if (existing.selectedKeys[e] === keyIndex) {
                            exists = true;
                            break;
                        }
                    }
                    if (!exists) {
                        existing.selectedKeys.push(keyIndex);
                    }
                }
            }
        }
        
        if (propertyEntries.length <= 1) {
            DEBUG_JSX.log("Same-layer stagger requires multiple properties - found " + propertyEntries.length);
            return "error|Select > 1 property on the layer";
        }
        
        DEBUG_JSX.log("Same-layer stagger: " + propertyEntries.length + " properties, direction=" + direction + ", stagger=" + staggerMs + "ms, topToBottom=" + isTopToBottom);
        
        for (var i = 0; i < propertyEntries.length; i++) {
            var entry = propertyEntries[i];
            entry.selectedKeys.sort(function(a, b) { return a - b; });
            
            var earliest = null;
            for (var k = 0; k < entry.selectedKeys.length; k++) {
                var keyTime = entry.property.keyTime(entry.selectedKeys[k]);
                if (earliest === null || keyTime < earliest) {
                    earliest = keyTime;
                }
            }
            entry.earliestTime = earliest;
        }
        
        propertyEntries.sort(function(a, b) {
            var sortResult = compareSortKeys(a.sortKey || [], b.sortKey || []);
            if (sortResult !== 0) {
                return sortResult;
            }
            var aOrder = a.encounterOrder !== undefined ? a.encounterOrder : 0;
            var bOrder = b.encounterOrder !== undefined ? b.encounterOrder : 0;
            if (aOrder !== bOrder) {
                return aOrder - bOrder;
            }
            if (a.earliestTime < b.earliestTime) return -1;
            if (a.earliestTime > b.earliestTime) return 1;
            return 0;
        });

        var orderIndices = [];
        for (var idx = 0; idx < propertyEntries.length; idx++) {
            var orderIndex = isTopToBottom ? idx : (propertyEntries.length - 1 - idx);
            orderIndices[idx] = orderIndex;
        }
        for (var orderLogIdx = 0; orderLogIdx < propertyEntries.length; orderLogIdx++) {
            DEBUG_JSX.log("Same-layer order: idx=" + orderLogIdx + ", orderIndex=" + orderIndices[orderLogIdx] + ", prop=" + propertyEntries[orderLogIdx].propertyName);
        }
        
        var snapResult = snapSameLayerStaggersToInputValue(propertyEntries, orderIndices, staggerFrames, frameRate, direction);
        var usingSnapOffsets = false;
        var offsets = [];
        
        if (snapResult.success && snapResult.offsets && snapResult.offsets.length === propertyEntries.length) {
            DEBUG_JSX.log("Same-layer stagger: smart snapping applied, using precomputed offsets");
            for (var snapIdx = 0; snapIdx < snapResult.offsets.length; snapIdx++) {
                offsets[snapIdx] = snapResult.offsets[snapIdx];
            }
            usingSnapOffsets = true;
        } else {
            for (var idx = 0; idx < propertyEntries.length; idx++) {
                offsets[idx] = orderIndices[idx] * direction * secondsPerStep;
            }
        }
        
        var negativeToleranceMs = 1;
        for (var checkIdx = 0; checkIdx < propertyEntries.length; checkIdx++) {
            var checkEntry = propertyEntries[checkIdx];
            var offsetSeconds = offsets[checkIdx];
            for (var ck = 0; ck < checkEntry.selectedKeys.length; ck++) {
                var ckIndex = checkEntry.selectedKeys[ck];
                var oldTime = checkEntry.property.keyTime(ckIndex);
                var newTime = oldTime + offsetSeconds;
                if ((newTime * 1000) < -negativeToleranceMs) {
                    DEBUG_JSX.log("Same-layer stagger aborted - property " + checkEntry.propertyName + " key would become negative (" + (newTime * 1000).toFixed(3) + "ms)");
                    return "success|Stagger stopped to prevent negative times|0ms per property";
                }
            }
        }
        
        var markerProp = null;
        try {
            markerProp = layer.property("Marker") || layer.property("ADBE Marker");
        } catch(markerError) {}
        
        if (markerProp && markerProp.numKeys > 0) {
            var markerEpsilon = 0.01;
            var markersAdjusted = 0;
            for (var m = 0; m < propertyEntries.length; m++) {
                var markerEntry = propertyEntries[m];
                var offsetSeconds = offsets[m];
                if (Math.abs(offsetSeconds) < markerEpsilon) {
                    continue;
                }
                var oldFirstTime = markerEntry.earliestTime;
                var newFirstTime = Math.max(0, oldFirstTime + offsetSeconds);
                var uniquePropId = getUniquePropertyId(markerEntry.property);
                try {
                    var markerResult = smartSplitMergeMarker(
                        markerProp,
                        oldFirstTime,
                        newFirstTime,
                        uniquePropId,
                        markerEpsilon
                    );
                    if (markerResult !== "no marker at old time" && markerResult !== "no spring block for property") {
                        markersAdjusted++;
                        DEBUG_JSX.log("Same-layer SMART STAGGER: " + markerEntry.propertyName + " - " + markerResult);
                    }
                } catch(markerProcessError) {
                    DEBUG_JSX.log("Same-layer SMART STAGGER ERROR: " + markerEntry.propertyName + " - " + markerProcessError.toString());
                }
            }
            if (markersAdjusted > 0) {
                DEBUG_JSX.log("Same-layer marker processing adjusted " + markersAdjusted + " markers");
            }
        }
        
        var processedProperties = 0;
        var propertiesWithMovement = 0;
        
        for (var p = 0; p < propertyEntries.length; p++) {
            var propEntry = propertyEntries[p];
            var prop = propEntry.property;
            var selectedKeys = propEntry.selectedKeys;
            var offsetSeconds = offsets[p];
            var offsetMs = offsetSeconds * 1000;
            var hadMovement = false;
            var newSelIndices = [];
            
            if (!selectedKeys || selectedKeys.length === 0) {
                DEBUG_JSX.log("Same-layer stagger: skipping property with no selected keys (" + propEntry.propertyName + ")");
                continue;
            }
            
            DEBUG_JSX.log("Same-layer stagger: processing " + propEntry.propertyName + " with offset " + offsetMs.toFixed(3) + "ms");
            
            if (propEntry.isTimeRemap) {
                DEBUG_JSX.log("Using Time Remap handling for same-layer stagger");
                var timeRemapMoves = [];
                for (var tr = 0; tr < selectedKeys.length; tr++) {
                    var trIndex = selectedKeys[tr];
                    var trOldTime = prop.keyTime(trIndex);
                    var trNewTime = trOldTime + offsetSeconds;
                    var trFinalTime = Math.max(0, trNewTime);
                    
                    if (Math.abs(trFinalTime - trOldTime) > 0.001) {
                        hadMovement = true;
                    }
                    
                    timeRemapMoves.push({
                        oldIndex: trIndex,
                        oldTime: trOldTime,
                        newTime: trFinalTime,
                        value: prop.keyValue(trIndex)
                    });
                }
                
                for (var addIdx = 0; addIdx < timeRemapMoves.length; addIdx++) {
                    var move = timeRemapMoves[addIdx];
                    prop.setValueAtTime(move.newTime, move.value);
                }
                
                var oldKeyIndicesToRemove = [];
                for (var rm = 0; rm < timeRemapMoves.length; rm++) {
                    var oldTime = timeRemapMoves[rm].oldTime;
                    for (var keyIdx = prop.numKeys; keyIdx >= 1; keyIdx--) {
                        var keyTime = prop.keyTime(keyIdx);
                        if (Math.abs(keyTime - oldTime) < 0.001) {
                            var isNewKey = false;
                            for (var chk = 0; chk < timeRemapMoves.length; chk++) {
                                if (Math.abs(keyTime - timeRemapMoves[chk].newTime) < 0.001) {
                                    isNewKey = true;
                                    break;
                                }
                            }
                            if (!isNewKey) {
                                oldKeyIndicesToRemove.push(keyIdx);
                            }
                        }
                    }
                }
                
                oldKeyIndicesToRemove.sort(function(a, b) { return b - a; });
                for (var rmIdx = 0; rmIdx < oldKeyIndicesToRemove.length; rmIdx++) {
                    try {
                        prop.removeKey(oldKeyIndicesToRemove[rmIdx]);
                    } catch(removeError) {
                        DEBUG_JSX.log("Same-layer Time Remap: failed to remove key " + oldKeyIndicesToRemove[rmIdx] + ": " + removeError.toString());
                    }
                }
                
                for (var findIdx = 0; findIdx < timeRemapMoves.length; findIdx++) {
                    var targetTime = timeRemapMoves[findIdx].newTime;
                    for (var searchIdx = prop.numKeys; searchIdx >= 1; searchIdx--) {
                        if (Math.abs(prop.keyTime(searchIdx) - targetTime) < 0.001) {
                            newSelIndices.push(searchIdx);
                            break;
                        }
                    }
                }
                
                propEntry.newSelIndices = newSelIndices;
            } else {
                var keyframeData = [];
                var nextKeyData = captureNextKeyframe(prop, selectedKeys);
                
                for (var dk = 0; dk < selectedKeys.length; dk++) {
                    var keyIndex = selectedKeys[dk];
                    var oldTime = prop.keyTime(keyIndex);
                    var newTime = oldTime + offsetSeconds;
                    var finalTime = Math.max(0, newTime);
                    
                    if (Math.abs(finalTime - oldTime) > 0.001) {
                        hadMovement = true;
                    }
                    
                    var keyData = {
                        oldIndex: keyIndex,
                        newTime: finalTime,
                        value: prop.keyValue(keyIndex),
                        inInterp: prop.keyInInterpolationType(keyIndex),
                        outInterp: prop.keyOutInterpolationType(keyIndex),
                        temporalContinuous: prop.keyTemporalContinuous(keyIndex),
                        temporalAutoBezier: prop.keyTemporalAutoBezier(keyIndex),
                        label: prop.keyLabel(keyIndex)
                    };
                    
                    if (keyData.inInterp === KeyframeInterpolationType.BEZIER ||
                        keyData.outInterp === KeyframeInterpolationType.BEZIER) {
                        try {
                            keyData.inEase = prop.keyInTemporalEase(keyIndex);
                            keyData.outEase = prop.keyOutTemporalEase(keyIndex);
                        } catch(easeError) {}
                    }
                    
                    if (prop.isSpatial) {
                        try {
                            keyData.spatialContinuous = prop.keySpatialContinuous(keyIndex);
                            keyData.spatialAutoBezier = prop.keySpatialAutoBezier(keyIndex);
                            keyData.inTangent = prop.keyInSpatialTangent(keyIndex);
                            keyData.outTangent = prop.keyOutSpatialTangent(keyIndex);
                        } catch(spatialError) {}
                    }
                    
                    keyframeData.push(keyData);
                }
                
                for (var removeIdx = keyframeData.length - 1; removeIdx >= 0; removeIdx--) {
                    try {
                        prop.removeKey(keyframeData[removeIdx].oldIndex);
                    } catch(removeKeyError) {
                        DEBUG_JSX.log("Same-layer stagger: failed to remove key " + keyframeData[removeIdx].oldIndex + ": " + removeKeyError.toString());
                    }
                }
                
                for (var addKeyIdx = 0; addKeyIdx < keyframeData.length; addKeyIdx++) {
                    var data = keyframeData[addKeyIdx];
                    var newIdx = prop.addKey(data.newTime);
                    
                    try {
                        prop.setValueAtKey(newIdx, data.value);
                        
                        if (data.inEase !== undefined && data.outEase !== undefined) {
                            try {
                                prop.setTemporalEaseAtKey(newIdx, data.inEase, data.outEase);
                            } catch(easeSetError) {}
                        }
                        
                        prop.setInterpolationTypeAtKey(newIdx, data.inInterp, data.outInterp);
                        prop.setTemporalContinuousAtKey(newIdx, data.temporalContinuous);
                        prop.setTemporalAutoBezierAtKey(newIdx, data.temporalAutoBezier);
                        
                        if (data.spatialContinuous !== undefined) {
                            try {
                                prop.setSpatialContinuousAtKey(newIdx, data.spatialContinuous);
                                prop.setSpatialAutoBezierAtKey(newIdx, data.spatialAutoBezier);
                                prop.setSpatialTangentsAtKey(newIdx, data.inTangent, data.outTangent);
                            } catch(spatialSetError) {}
                        }
                        
                        if (data.label !== undefined) {
                            try {
                                prop.setLabelAtKey(newIdx, data.label);
                            } catch(labelError) {}
                        }
                    } catch(setError) {}
                    
                    newSelIndices.push(newIdx);
                }
                
                if (nextKeyData !== null) {
                    var keysAdded = newSelIndices.length - keyframeData.length;
                    restoreNextKeyframe(prop, nextKeyData, keysAdded);
                }
                
                propEntry.newSelIndices = newSelIndices;
            }
            
            processedProperties++;
            if (hadMovement) {
                propertiesWithMovement++;
            }
        }
        
        try {
            for (var selIdx = 0; selIdx < propertyEntries.length; selIdx++) {
                var selEntry = propertyEntries[selIdx];
                if (!selEntry.newSelIndices) continue;
                
                var selProp = selEntry.property;
                for (var clearIdx = 1; clearIdx <= selProp.numKeys; clearIdx++) {
                    try {
                        selProp.setSelectedAtKey(clearIdx, false);
                    } catch(clearError) {}
                }
                
                for (var ns = 0; ns < selEntry.newSelIndices.length; ns++) {
                    try {
                        selProp.setSelectedAtKey(selEntry.newSelIndices[ns], true);
                    } catch(selectError) {
                        DEBUG_JSX.log("Same-layer stagger: final selection failed for key " + selEntry.newSelIndices[ns] + ": " + selectError.toString());
                    }
                }
            }
        } catch(finalSelectionError) {
            DEBUG_JSX.log("Same-layer stagger: final selection pass failed - " + finalSelectionError.toString());
        }
        
        var effectiveStagger;
        if (usingSnapOffsets) {
            var signedSnapMs = snapResult.staggerMs !== undefined ? (snapResult.staggerMs * (direction >= 0 ? 1 : -1)) : 0;
            effectiveStagger = propertiesWithMovement > 0 ? signedSnapMs : 0;
        } else {
            effectiveStagger = propertiesWithMovement > 0 ? (direction * staggerMs) : 0;
        }
        DEBUG_JSX.log("Same-layer stagger complete. Processed " + processedProperties + " properties. Effective stagger: " + effectiveStagger + "ms");
        
        return "success|Applied stagger to " + processedProperties + " properties|" + effectiveStagger + "ms per property";
        
    } catch(e) {
        return "error|Same-layer stagger failed: " + e.toString();
    }
}

// Apply stagger to selected layers (layer start times)
function applyStaggerToLayers(direction, staggerMs, frameRate, staggerFrames, isTopToBottom) {
    try {
        var comp = app.project.activeItem;
        var selectedLayers = comp.selectedLayers;
        
        if (selectedLayers.length === 0) {
            return "error|No layers selected";
        }
        
        // Store layer references for re-selection
        var layerArray = [];
        var layerIndices = [];
        for (var i = 0; i < selectedLayers.length; i++) {
            layerArray.push(selectedLayers[i]);
            layerIndices.push(selectedLayers[i].index);
        }
        
        // Sort layers by index
        // If isTopToBottom is true: top to bottom (lowest index to highest)  
        // If isTopToBottom is false: bottom to top (highest index to lowest)
        if (isTopToBottom) {
            layerArray.sort(function(a, b) { return a.index - b.index; });
            DEBUG_JSX.log("Sorting layers top to bottom (index ascending)");
        } else {
            layerArray.sort(function(a, b) { return b.index - a.index; });
            DEBUG_JSX.log("Sorting layers bottom to top (index descending)");
        }
        
        // First: Snap inconsistent staggers to clean multiples of input value
        DEBUG_JSX.log("About to call snapStaggersToInputValue with " + layerArray.length + " layers and " + staggerFrames + " frames");
        var snapResult = snapStaggersToInputValue(layerArray, staggerFrames, frameRate, direction, isTopToBottom);
        DEBUG_JSX.log("snapStaggersToInputValue returned: " + JSON.stringify(snapResult));
        if (snapResult.success) {
            DEBUG_JSX.log("Snapped layers to clean " + staggerFrames + " frame increments");
            
            // Smart snapping already created the correct uniform pattern - no additional stagger needed
            var actualStagger = direction * snapResult.staggerMs; // Apply direction to final display
            var successMessage = "Applied stagger to " + layerArray.length + " layers|" + actualStagger + "ms per layer";
            return "success|" + successMessage;
        }
        
        DEBUG_JSX.log("Layer stagger - applying cumulative stagger: " + (direction * staggerMs) + "ms per layer position");
        
        // Pre-check: if ANY layer would go significantly negative, abort entire operation
        // Allow small negative values (floating point errors) that are essentially zero
        var negativeToleranceMs = 1; // Allow up to 1ms tolerance for floating point errors
        for (var preCheckIdx = 0; preCheckIdx < layerArray.length; preCheckIdx++) {
            var layer = layerArray[preCheckIdx];
            var staggerOffset = preCheckIdx * direction * staggerMs / 1000; // in seconds
            var newStartTime = layer.startTime + staggerOffset;
            var newStartTimeMs = newStartTime * 1000;
            
            if (newStartTimeMs < -negativeToleranceMs) {
                DEBUG_JSX.log("Stagger operation aborted - Layer " + layer.index + " would go to " + newStartTimeMs + "ms (significantly negative)");
                return "success|Stagger stopped to prevent negative times|0ms per layer";
            }
        }
        
        // Apply CUMULATIVE stagger to each layer (no clamping needed since pre-checked)
        var processedLayers = 0;
        var layersWithActualMovement = 0;
        
        for (var layerIdx = 0; layerIdx < layerArray.length; layerIdx++) {
            var layer = layerArray[layerIdx];
            var originalStartTime = layer.startTime;
            
            // Calculate cumulative stagger offset for this layer position
            var staggerOffset = layerIdx * direction * staggerMs / 1000; // in seconds
            var newStartTime = originalStartTime + staggerOffset;
            var actuallyMoved = (Math.abs(newStartTime - originalStartTime) > 0.001); // 1ms tolerance
            
            DEBUG_JSX.log("Layer " + layer.index + " (" + layer.name + "): from " + (originalStartTime * 1000) + "ms to " + (newStartTime * 1000) + "ms");
            
            if (actuallyMoved) {
                layersWithActualMovement++;
            }
            
            // Set final start time, clamping small negatives to zero
            layer.startTime = Math.max(0, newStartTime);
            processedLayers++;
        }
        
        // Re-select the same layers to allow repeated staggering
        try {
            // Clear all selections first
            for (var i = 1; i <= comp.numLayers; i++) {
                comp.layer(i).selected = false;
            }
            
            // Re-select the layers we just staggered
            for (var i = 0; i < layerIndices.length; i++) {
                var layerIndex = layerIndices[i];
                try {
                    comp.layer(layerIndex).selected = true;
                } catch(layerError) {
                    DEBUG_JSX.log("Could not re-select layer " + layerIndex + ": " + layerError.toString());
                }
            }
            DEBUG_JSX.log("Re-selected " + layerIndices.length + " layers for continued staggering");
        } catch(selectionError) {
            DEBUG_JSX.log("Layer re-selection failed: " + selectionError.toString());
        }
        
        // Check if the final result is actually a stagger pattern or all layers at same time
        var finalStaggerExists = false;
        if (layerArray.length > 1) {
            var firstLayerTime = layerArray[0].startTime;
            for (var checkIdx = 1; checkIdx < layerArray.length; checkIdx++) {
                if (Math.abs(layerArray[checkIdx].startTime - firstLayerTime) > 0.001) { // 1ms tolerance
                    finalStaggerExists = true;
                    break;
                }
            }
        }
        
        // If final result has no stagger (all layers at same time), show 0ms stagger
        var effectiveStagger = finalStaggerExists ? (direction * staggerMs) : 0;

        return "success|Applied stagger to " + processedLayers + " layers|" + effectiveStagger + "ms per layer";

    } catch(e) {
        return "error|Layer stagger failed: " + e.toString();
    }
}

// Snap selected keyframes to playhead - per-property snapping with marker movement
// preserveDelays: if true (shift+click), maintains relative delays between properties
function snapToPlayheadFromPanel(preserveDelays) {
    try {
        DEBUG_JSX.clear();
        DEBUG_JSX.log("snapToPlayheadFromPanel called, preserveDelays=" + preserveDelays);
        app.beginUndoGroup("Snap to Playhead");

        var comp = app.project.activeItem;
        if (!comp || !(comp instanceof CompItem)) {
            app.endUndoGroup();
            alert("Please open a composition to snap keyframes to playhead.");
            return "error|No active composition";
        }

        var selectedLayers = [];
        for (var i = 0; i < comp.selectedLayers.length; i++) {
            selectedLayers.push(comp.selectedLayers[i]);
        }

        if (selectedLayers.length === 0) {
            app.endUndoGroup();
            alert("Please select at least one layer to snap to playhead.");
            return "error|No layers selected";
        }

        var playheadTime = comp.time;
        var frameRate = comp.frameRate;
        var propertiesProcessed = 0;
        var keyframesProcessed = 0;
        var markersProcessed = 0;
        // Backup selection restoration store
        var processedSelections = [];

        // Store marker offsets and time ranges for each layer
        var layerMarkerOffsets = {}; // layerIndex -> {propertyId -> {offset, minTime, maxTime}}

        // PHASE 0: Check if there are any selected keyframes - if not, snap layers instead
        var hasSelectedKeyframes = false;
        for (var layerIdx = 0; layerIdx < selectedLayers.length; layerIdx++) {
            var layer = selectedLayers[layerIdx];
            var selectedProps = layer.selectedProperties;

            for (var propIdx = 0; propIdx < selectedProps.length; propIdx++) {
                var prop = selectedProps[propIdx];
                if (!prop || prop.propertyValueType === PropertyValueType.NO_VALUE) continue;
                if (!prop.canVaryOverTime || prop.numKeys === 0) continue;

                for (var k = 1; k <= prop.numKeys; k++) {
                    if (prop.keySelected(k)) {
                        hasSelectedKeyframes = true;
                        break;
                    }
                }
                if (hasSelectedKeyframes) break;
            }
            if (hasSelectedKeyframes) break;

            // Also check Time Remap
            if (layer.timeRemapEnabled && layer.timeRemap && layer.timeRemap.numKeys > 0) {
                for (var k = 1; k <= layer.timeRemap.numKeys; k++) {
                    if (layer.timeRemap.keySelected(k)) {
                        hasSelectedKeyframes = true;
                        break;
                    }
                }
            }
            if (hasSelectedKeyframes) break;
        }

        // If no keyframes selected, snap layers instead
        if (!hasSelectedKeyframes) {
            DEBUG_JSX.log("No keyframes selected - snapping layers to playhead instead");

            // Collect layer visual positions (accounting for trim)
            var layerPositions = [];
            for (var i = 0; i < selectedLayers.length; i++) {
                var layer = selectedLayers[i];
                var isTrimmed = Math.abs(layer.inPoint - layer.startTime) > 0.001;
                var visualPosition = isTrimmed ? layer.inPoint : layer.startTime;
                layerPositions.push({
                    layer: layer,
                    visualPosition: visualPosition,
                    isTrimmed: isTrimmed
                });
            }

            if (preserveDelays) {
                // Find earliest layer
                var earliestPos = layerPositions[0].visualPosition;
                for (var i = 1; i < layerPositions.length; i++) {
                    if (layerPositions[i].visualPosition < earliestPos) {
                        earliestPos = layerPositions[i].visualPosition;
                    }
                }

                // Calculate offset to move earliest to playhead
                var offset = playheadTime - earliestPos;

                // Apply offset to all layers
                for (var i = 0; i < layerPositions.length; i++) {
                    var layerData = layerPositions[i];
                    var newStartTime = layerData.layer.startTime + offset;
                    layerData.layer.startTime = Math.max(0, newStartTime);
                }

                app.endUndoGroup();
                return "success|Snapped " + selectedLayers.length + " layers to playhead (preserved delays)";
            } else {
                // Snap each layer independently to playhead
                for (var i = 0; i < layerPositions.length; i++) {
                    var layerData = layerPositions[i];
                    var offset = playheadTime - layerData.visualPosition;
                    var newStartTime = layerData.layer.startTime + offset;
                    layerData.layer.startTime = Math.max(0, newStartTime);
                }

                app.endUndoGroup();
                return "success|Snapped " + selectedLayers.length + " layers to playhead";
            }
        }

        // PHASE 1: Collect all selected keyframes grouped by property
        var allPropertyData = []; // Array of {layer, property, uniqueId, keyframes}

        for (var layerIdx = 0; layerIdx < selectedLayers.length; layerIdx++) {
            var layer = selectedLayers[layerIdx];
            var selectedProps = layer.selectedProperties;

            for (var propIdx = 0; propIdx < selectedProps.length; propIdx++) {
                var prop = selectedProps[propIdx];

                // Skip invalid properties
                if (!prop || prop.propertyValueType === PropertyValueType.NO_VALUE) continue;
                if (!prop.canVaryOverTime || prop.numKeys === 0) continue;

                // Collect selected keyframe indices
                var selectedKeyIndices = [];
                for (var k = 1; k <= prop.numKeys; k++) {
                    if (prop.keySelected(k)) {
                        selectedKeyIndices.push(k);
                    }
                }

                if (selectedKeyIndices.length === 0) continue;

                // Get unique property ID for marker identification
                var uniquePropId = getUniquePropertyId(prop);

                allPropertyData.push({
                    layer: layer,
                    property: prop,
                    propertyName: prop.name,
                    uniqueId: uniquePropId,
                    selectedKeyIndices: selectedKeyIndices.slice()
                });
            }

            // SPECIAL: Check for Time Remap (might not be in selectedProperties)
            if (layer.timeRemapEnabled && layer.timeRemap && layer.timeRemap.numKeys > 0) {
                var timeRemapSelected = [];
                for (var k = 1; k <= layer.timeRemap.numKeys; k++) {
                    if (layer.timeRemap.keySelected(k)) {
                        timeRemapSelected.push(k);
                    }
                }

                if (timeRemapSelected.length > 0) {
                    // Check if already added via selectedProperties
                    var alreadyAdded = false;
                    for (var check = 0; check < allPropertyData.length; check++) {
                        if (allPropertyData[check].layer === layer &&
                            allPropertyData[check].propertyName === "Time Remap") {
                            alreadyAdded = true;
                            break;
                        }
                    }

                    if (!alreadyAdded) {
                        allPropertyData.push({
                            layer: layer,
                            property: layer.timeRemap,
                            propertyName: "Time Remap",
                            uniqueId: getUniquePropertyId(layer.timeRemap),
                            selectedKeyIndices: timeRemapSelected.slice()
                        });
                    }
                }
            }
        }

        if (allPropertyData.length === 0) {
            app.endUndoGroup();
            alert("Please select at least one keyframe to snap to playhead.");
            return "error|No selected keyframes found";
        }

        // PHASE 1.5: If preserveDelays is true, calculate global offset from absolute earliest keyframe
        var globalTimeOffset = null;
        if (preserveDelays) {
            var globalEarliestTime = null;

            // Find the absolute earliest keyframe across ALL properties
            for (var propDataIdx = 0; propDataIdx < allPropertyData.length; propDataIdx++) {
                var propData = allPropertyData[propDataIdx];
                var prop = propData.property;
                var selectedKeys = propData.selectedKeyIndices;

                for (var k = 0; k < selectedKeys.length; k++) {
                    var keyTime = prop.keyTime(selectedKeys[k]);
                    if (globalEarliestTime === null || keyTime < globalEarliestTime) {
                        globalEarliestTime = keyTime;
                    }
                }
            }

            if (globalEarliestTime !== null) {
                // Calculate single offset to snap the absolute earliest keyframe to playhead
                globalTimeOffset = playheadTime - globalEarliestTime;
            }
        }

        // PHASE 2: Process each property independently
        DEBUG_JSX.log("PHASE 2: Processing " + allPropertyData.length + " properties");
        for (var propDataIdx = 0; propDataIdx < allPropertyData.length; propDataIdx++) {
            var propData = allPropertyData[propDataIdx];
            var layer = propData.layer;
            var prop = propData.property;
            var uniquePropId = propData.uniqueId;
            var selectedKeys = propData.selectedKeyIndices;

            DEBUG_JSX.log("PHASE 2: Processing property " + (propDataIdx+1) + "/" + allPropertyData.length + ": " + prop.name + " on layer " + layer.name + " with " + selectedKeys.length + " selected keys");

            // Find earliest and latest selected keyframe times for this property
            var earliestKeyTime = null;
            var latestKeyTime = null;
            var earliestKeyIndex = -1;
            var latestKeyIndex = -1;
            for (var k = 0; k < selectedKeys.length; k++) {
                var keyTime = prop.keyTime(selectedKeys[k]);
                if (earliestKeyTime === null || keyTime < earliestKeyTime) {
                    earliestKeyTime = keyTime;
                    earliestKeyIndex = selectedKeys[k];
                }
                if (latestKeyTime === null || keyTime > latestKeyTime) {
                    latestKeyTime = keyTime;
                    latestKeyIndex = selectedKeys[k];
                }
            }

            if (earliestKeyTime === null) continue;

            // Calculate offset to snap keyframes
            var timeOffset;
            if (preserveDelays && globalTimeOffset !== null) {
                // Shift+click: Use global offset (preserves relative delays)
                timeOffset = globalTimeOffset;
            } else {
                // Normal click: Use per-property offset (each property's earliest → playhead)
                timeOffset = playheadTime - earliestKeyTime;
            }

            // Skip if already at playhead, but still store selections for restoration
            if (Math.abs(timeOffset) < 0.001) {
                DEBUG_JSX.log("PHASE 2: Property " + prop.name + " already at playhead, storing current selection without moving");
                // Store current selection indices for restoration
                processedSelections.push({
                    layer: layer,
                    propertyName: prop.name,
                    propertyReference: prop,
                    newSelIndices: selectedKeys.slice() // Use current indices since we're not moving
                });
                continue;
            }

            // Store offset and time range for marker processing
            // NEW: Also store all selected keyframe times for marker checking
            var selectedKeyTimes = [];
            for (var sk = 0; sk < selectedKeys.length; sk++) {
                selectedKeyTimes.push(prop.keyTime(selectedKeys[sk]));
            }

            if (!layerMarkerOffsets[layer.index]) {
                layerMarkerOffsets[layer.index] = {};
            }
            layerMarkerOffsets[layer.index][uniquePropId] = {
                offset: timeOffset,
                minTime: earliestKeyTime,
                maxTime: latestKeyTime,
                selectedKeyTimes: selectedKeyTimes // NEW: Store all selected keyframe times
            };

            // CRITICAL: Preserve the keyframe AFTER the selected ones to prevent AE from modifying it
            var nextKeyIndex = latestKeyIndex + 1;
            var nextKeyData = null;
            if (nextKeyIndex <= prop.numKeys) {
                try {
                    nextKeyData = {
                        index: nextKeyIndex,
                        time: prop.keyTime(nextKeyIndex),
                        value: prop.keyValue(nextKeyIndex),
                        inInterp: prop.keyInInterpolationType(nextKeyIndex),
                        outInterp: prop.keyOutInterpolationType(nextKeyIndex),
                        temporalContinuous: prop.keyTemporalContinuous(nextKeyIndex),
                        temporalAutoBezier: prop.keyTemporalAutoBezier(nextKeyIndex),
                        label: prop.keyLabel(nextKeyIndex)
                    };

                    // Collect temporal ease
                    try {
                        nextKeyData.inEase = prop.keyInTemporalEase(nextKeyIndex);
                        nextKeyData.outEase = prop.keyOutTemporalEase(nextKeyIndex);
                    } catch(e) {}

                    // Collect spatial properties if applicable
                    if (prop.isSpatial) {
                        try {
                            nextKeyData.spatialContinuous = prop.keySpatialContinuous(nextKeyIndex);
                            nextKeyData.spatialAutoBezier = prop.keySpatialAutoBezier(nextKeyIndex);
                            nextKeyData.inTangent = prop.keyInSpatialTangent(nextKeyIndex);
                            nextKeyData.outTangent = prop.keyOutSpatialTangent(nextKeyIndex);
                        } catch(e) {}
                    }
                } catch(e) {
                    // Next key might not exist or be accessible
                    nextKeyData = null;
                }
            }

            // Collect all keyframe data for recreation
            var keyframesToMove = [];
            var isTimeRemap = (prop.name === "Time Remap" ||
                              (prop.matchName && prop.matchName === "ADBE Time Remapping"));

            for (var k = 0; k < selectedKeys.length; k++) {
                var keyIndex = selectedKeys[k];
                var keyTime = prop.keyTime(keyIndex);
                var newTime = Math.max(0, keyTime + timeOffset);

                // Collect full keyframe data
                var keyData = {
                    oldIndex: keyIndex,
                    oldTime: keyTime,
                    newTime: newTime,
                    value: prop.keyValue(keyIndex),
                    inInterp: prop.keyInInterpolationType(keyIndex),
                    outInterp: prop.keyOutInterpolationType(keyIndex),
                    temporalContinuous: prop.keyTemporalContinuous(keyIndex),
                    temporalAutoBezier: prop.keyTemporalAutoBezier(keyIndex),
                    label: prop.keyLabel(keyIndex)
                };

                // Always collect temporal ease data (even for LINEAR sides)
                // LINEAR keyframes have ease with speed=0
                try {
                    keyData.inEase = prop.keyInTemporalEase(keyIndex);
                    keyData.outEase = prop.keyOutTemporalEase(keyIndex);
                } catch(e) {
                    // Ease might not be available for some property types
                }

                // Collect spatial properties if spatial property
                if (prop.isSpatial) {
                    try {
                        keyData.spatialContinuous = prop.keySpatialContinuous(keyIndex);
                        keyData.spatialAutoBezier = prop.keySpatialAutoBezier(keyIndex);
                        keyData.inTangent = prop.keyInSpatialTangent(keyIndex);
                        keyData.outTangent = prop.keyOutSpatialTangent(keyIndex);
                    } catch(e) {
                        // Spatial properties might not be available
                    }
                }

                keyframesToMove.push(keyData);
            }

            // RECREATE KEYFRAMES with Time Remap special handling
            if (isTimeRemap) {
                // Time Remap: Use setValueAtTime approach
                // First, add new keyframes
                for (var k = 0; k < keyframesToMove.length; k++) {
                    var data = keyframesToMove[k];
                    prop.setValueAtTime(data.newTime, data.value);
                }

                // Then remove old keyframes (carefully)
                var oldKeyIndicesToRemove = [];
                for (var k = 0; k < keyframesToMove.length; k++) {
                    var oldTime = keyframesToMove[k].oldTime;
                    for (var j = prop.numKeys; j >= 1; j--) {
                        var keyTime = prop.keyTime(j);
                        if (Math.abs(keyTime - oldTime) < 0.001) {
                            // Make sure this isn't a new keyframe
                            var isNewKey = false;
                            for (var n = 0; n < keyframesToMove.length; n++) {
                                if (Math.abs(keyTime - keyframesToMove[n].newTime) < 0.001) {
                                    isNewKey = true;
                                    break;
                                }
                            }
                            if (!isNewKey) {
                                oldKeyIndicesToRemove.push(j);
                            }
                        }
                    }
                }

                // Remove in descending order
                oldKeyIndicesToRemove.sort(function(a, b) { return b - a; });
                for (var k = 0; k < oldKeyIndicesToRemove.length; k++) {
                    prop.removeKey(oldKeyIndicesToRemove[k]);
                }

                // Track new indices for selection
                var newSelIndices = [];
                for (var k = 0; k < keyframesToMove.length; k++) {
                    var targetTime = keyframesToMove[k].newTime;
                    for (var j = 1; j <= prop.numKeys; j++) {
                        if (Math.abs(prop.keyTime(j) - targetTime) < 0.001) {
                            newSelIndices.push(j);
                            break;
                        }
                    }
                }

                // Restore selection for Time Remap
                for (var k = 1; k <= prop.numKeys; k++) {
                    prop.setSelectedAtKey(k, false);
                }
                for (var k = 0; k < newSelIndices.length; k++) {
                    prop.setSelectedAtKey(newSelIndices[k], true);
                }

                // Store for backup restoration pass (use direct property reference to avoid name collisions)
                processedSelections.push({
                    layer: layer,
                    propertyName: prop.name,
                    propertyReference: prop,
                    newSelIndices: newSelIndices.slice()
                });

                // CRITICAL: Restore the next keyframe to prevent AE from modifying it
                if (nextKeyData !== null) {
                    try {
                        // For Time Remap, find next keyframe by time since indices may have shifted
                        var foundNextKey = false;
                        for (var j = 1; j <= prop.numKeys; j++) {
                            if (Math.abs(prop.keyTime(j) - nextKeyData.time) < 0.001) {
                                // Restore all properties of the next keyframe
                                prop.setValueAtTime(nextKeyData.time, nextKeyData.value);
                                foundNextKey = true;
                                break;
                            }
                        }
                    } catch(e) {
                        // If restoration fails, continue (not critical to main operation)
                    }
                }

            } else {
                // Regular properties: Standard remove-then-add approach
                // Remove old keyframes in reverse order
                var indicesToRemove = [];
                for (var k = 0; k < keyframesToMove.length; k++) {
                    indicesToRemove.push(keyframesToMove[k].oldIndex);
                }
                indicesToRemove.sort(function(a, b) { return b - a; });
                for (var k = 0; k < indicesToRemove.length; k++) {
                    prop.removeKey(indicesToRemove[k]);
                }

                // Add new keyframes with all properties preserved
                var newSelIndices = [];
                for (var k = 0; k < keyframesToMove.length; k++) {
                    var data = keyframesToMove[k];
                    var newIdx = prop.addKey(data.newTime);
                    prop.setValueAtKey(newIdx, data.value);

                    // Apply temporal ease first to avoid flipping linear sides
                    if (data.inEase !== undefined && data.outEase !== undefined) {
                        try {
                            prop.setTemporalEaseAtKey(newIdx, data.inEase, data.outEase);
                        } catch(e) {
                            // Ease setting might fail in some cases
                        }
                    }

                    // Re-assert original interpolation types to preserve one-sided linear/bezier
                    prop.setInterpolationTypeAtKey(newIdx, data.inInterp, data.outInterp);

                    // Restore temporal continuity and auto-bezier
                    prop.setTemporalContinuousAtKey(newIdx, data.temporalContinuous);
                    prop.setTemporalAutoBezierAtKey(newIdx, data.temporalAutoBezier);

                    // Restore spatial properties if applicable
                    if (data.spatialContinuous !== undefined) {
                        prop.setSpatialContinuousAtKey(newIdx, data.spatialContinuous);
                        prop.setSpatialAutoBezierAtKey(newIdx, data.spatialAutoBezier);

                        // Only restore tangents if NOT auto-bezier (manual tangent control)
                        // Auto-bezier tangents are automatically recalculated by AE
                        if (!data.spatialAutoBezier && data.inTangent !== undefined && data.outTangent !== undefined) {
                            prop.setSpatialTangentsAtKey(newIdx, data.inTangent, data.outTangent);
                        }
                    }

                    // Restore keyframe color label
                    if (data.label !== undefined) {
                        prop.setLabelAtKey(newIdx, data.label);
                    }

                    newSelIndices.push(newIdx);
                }

                // Restore selection
                for (var k = 1; k <= prop.numKeys; k++) {
                    prop.setSelectedAtKey(k, false);
                }
                for (var k = 0; k < newSelIndices.length; k++) {
                    prop.setSelectedAtKey(newSelIndices[k], true);
                }

                // Store for backup restoration pass (use direct property reference to avoid name collisions)
                processedSelections.push({
                    layer: layer,
                    propertyName: prop.name,
                    propertyReference: prop,
                    newSelIndices: newSelIndices.slice()
                });

                // CRITICAL: Restore the next keyframe to prevent AE from modifying it
                if (nextKeyData !== null) {
                    try {
                        // Find the new index of the next keyframe (it may have shifted)
                        var currentNextKeyIndex = nextKeyData.index - selectedKeys.length + newSelIndices.length;
                        if (currentNextKeyIndex > 0 && currentNextKeyIndex <= prop.numKeys) {
                            // Restore all properties of the next keyframe
                            prop.setValueAtKey(currentNextKeyIndex, nextKeyData.value);

                            // Apply temporal ease first
                            if (nextKeyData.inEase !== undefined && nextKeyData.outEase !== undefined) {
                                try {
                                    prop.setTemporalEaseAtKey(currentNextKeyIndex, nextKeyData.inEase, nextKeyData.outEase);
                                } catch(e) {}
                            }

                            // Re-assert original interpolation types
                            prop.setInterpolationTypeAtKey(currentNextKeyIndex, nextKeyData.inInterp, nextKeyData.outInterp);

                            // Restore temporal continuity and auto-bezier
                            prop.setTemporalContinuousAtKey(currentNextKeyIndex, nextKeyData.temporalContinuous);
                            prop.setTemporalAutoBezierAtKey(currentNextKeyIndex, nextKeyData.temporalAutoBezier);

                            // Restore spatial properties if applicable
                            if (nextKeyData.spatialContinuous !== undefined) {
                                prop.setSpatialContinuousAtKey(currentNextKeyIndex, nextKeyData.spatialContinuous);
                                prop.setSpatialAutoBezierAtKey(currentNextKeyIndex, nextKeyData.spatialAutoBezier);

                                if (!nextKeyData.spatialAutoBezier && nextKeyData.inTangent !== undefined && nextKeyData.outTangent !== undefined) {
                                    prop.setSpatialTangentsAtKey(currentNextKeyIndex, nextKeyData.inTangent, nextKeyData.outTangent);
                                }
                            }

                            // Restore keyframe color label
                            if (nextKeyData.label !== undefined) {
                                prop.setLabelAtKey(currentNextKeyIndex, nextKeyData.label);
                            }
                        }
                    } catch(e) {
                        // If restoration fails, continue (not critical to main operation)
                    }
                }
            }

            propertiesProcessed++;
            keyframesProcessed += keyframesToMove.length;
        }

        // PHASE 3: Smart marker split/merge for processed properties
        for (var layerIdx = 0; layerIdx < selectedLayers.length; layerIdx++) {
            var layer = selectedLayers[layerIdx];
            var markerProp = layer.property("Marker");

            if (!markerProp || markerProp.numKeys === 0) continue;
            if (!layerMarkerOffsets[layer.index]) continue;

            var propertyOffsets = layerMarkerOffsets[layer.index];
            var epsilon = 0.01; // Ultra-precise for 1-frame accuracy at 60fps (matches Sproing)

            // Process each property that moved on this layer
            for (var propId in propertyOffsets) {
                var propData = propertyOffsets[propId];
                var timeOffset = propData.offset;
                var selectedKeyTimes = propData.selectedKeyTimes || [propData.minTime]; // Fallback to minTime if not available

                // Skip if no actual movement
                if (Math.abs(timeOffset) < 0.001) continue;

                // FIXED: Check ALL keyframes for markers, but only process each unique marker ONCE
                // Track BOTH original and new marker times to prevent double-processing
                var processedMarkerTimes = []; // Stores both old and new times

                for (var kIdx = 0; kIdx < selectedKeyTimes.length; kIdx++) {
                    var oldKeyTime = selectedKeyTimes[kIdx];

                    // Check if we've already processed a marker at this time (original OR moved location)
                    var alreadyProcessed = false;
                    $.writeln("SNAP MARKER CHECK: Checking oldKeyTime " + oldKeyTime.toFixed(6) + "s against processedMarkerTimes: [" + processedMarkerTimes.join(", ") + "]");
                    for (var p = 0; p < processedMarkerTimes.length; p++) {
                        var diff = Math.abs(processedMarkerTimes[p] - oldKeyTime);
                        $.writeln("  - Comparing with processedMarkerTimes[" + p + "] = " + processedMarkerTimes[p].toFixed(6) + ", diff = " + diff.toFixed(6) + ", epsilon = " + epsilon);
                        if (diff < epsilon) {
                            alreadyProcessed = true;
                            $.writeln("  - MATCH! Skipping this keyframe");
                            break;
                        }
                    }

                    if (alreadyProcessed) {
                        $.writeln("SNAP MARKER CHECK: Skipped oldKeyTime " + oldKeyTime.toFixed(6) + "s (already processed)");
                        continue;
                    }

                    $.writeln("SNAP MARKER CHECK: Processing oldKeyTime " + oldKeyTime.toFixed(6) + "s (not in processed list)");

                    var newKeyTime = Math.max(0, oldKeyTime + timeOffset);

                    // EXTRA CHECK: Verify there's actually a marker at this position before calling smartSplitMergeMarker
                    var markerExists = findMarkerAtTime(markerProp, oldKeyTime, epsilon);
                    if (!markerExists) {
                        $.writeln("SNAP MARKER CHECK: No marker found at " + oldKeyTime.toFixed(6) + "s, skipping");
                        continue;
                    }
                    $.writeln("SNAP MARKER CHECK: Marker confirmed at " + oldKeyTime.toFixed(6) + "s, calling smartSplitMergeMarker");

                    // Call smart split/merge for this keyframe
                    try {
                        var result = smartSplitMergeMarker(
                            markerProp,
                            oldKeyTime,
                            newKeyTime,
                            propId,
                            epsilon
                        );

                        if (result !== "no marker at old time" && result !== "no spring block for property") {
                            markersProcessed++;
                            // Track BOTH the original time AND the new time to prevent reprocessing
                            processedMarkerTimes.push(oldKeyTime);
                            processedMarkerTimes.push(newKeyTime);
                            $.writeln("SNAP: Smart marker " + propId + " @ " + oldKeyTime.toFixed(3) + "s - " + result);
                            $.writeln("SNAP MARKER CHECK: Added [" + oldKeyTime.toFixed(6) + ", " + newKeyTime.toFixed(6) + "] to processedMarkerTimes. Array now: [" + processedMarkerTimes.join(", ") + "]");
                        } else {
                            $.writeln("SNAP MARKER CHECK: Result was '" + result + "', NOT adding to processedMarkerTimes");
                        }
                    } catch(smartMarkerError) {
                        $.writeln("SNAP: Smart marker error for " + propId + " @ " + oldKeyTime.toFixed(3) + "s: " + smartMarkerError.toString());
                    }
                }
            }
        }

        // PHASE 4: Backup selection restoration using fresh property references
        DEBUG_JSX.log("PHASE 4: Starting backup selection restoration for " + processedSelections.length + " properties");
        try {
            // Helper: find property by name within a layer (supports groups)
            function findPropertyByName(layer, targetName) {
                if (targetName === "Time Remap" || targetName === "ADBE Time Remapping") {
                    try {
                        if (layer.timeRemapEnabled && layer.timeRemap) {
                            return layer.timeRemap;
                        }
                    } catch(e) {}
                }
                function searchGroup(group) {
                    for (var i = 1; i <= group.numProperties; i++) {
                        var p = group.property(i);
                        if (p && p.name === targetName && p.canVaryOverTime) {
                            return p;
                        }
                        if (p && (p.propertyType === PropertyType.INDEXED_GROUP || p.propertyType === PropertyType.NAMED_GROUP)) {
                            var found = searchGroup(p);
                            if (found) return found;
                        }
                    }
                    return null;
                }
                return searchGroup(layer);
            }

            for (var s = 0; s < processedSelections.length; s++) {
                var sel = processedSelections[s];
                DEBUG_JSX.log("PHASE 4: Restoring selection " + (s+1) + "/" + processedSelections.length + ": " + sel.propertyName + " on layer " + sel.layer.name + " with " + (sel.newSelIndices ? sel.newSelIndices.length : 0) + " indices");

                // Prefer stored property reference; fall back to name search if needed
                var fresh = sel.propertyReference || findPropertyByName(sel.layer, sel.propertyName);
                if (fresh && sel.newSelIndices && sel.newSelIndices.length > 0) {
                    DEBUG_JSX.log("  Deselecting all " + fresh.numKeys + " keys, then selecting indices: [" + sel.newSelIndices.join(", ") + "]");
                    // Deselect all, then select our indices
                    for (var k = 1; k <= fresh.numKeys; k++) {
                        try { fresh.setSelectedAtKey(k, false); } catch(e) {}
                    }
                    for (var j = 0; j < sel.newSelIndices.length; j++) {
                        try { fresh.setSelectedAtKey(sel.newSelIndices[j], true); } catch(e) {}
                    }
                    DEBUG_JSX.log("  Selection restoration completed for " + sel.propertyName);
                } else {
                    DEBUG_JSX.log("  SKIPPED: fresh=" + (fresh ? "OK" : "NULL") + ", newSelIndices=" + (sel.newSelIndices ? sel.newSelIndices.length : "NULL"));
                }
            }
            DEBUG_JSX.log("PHASE 4: Backup selection restoration completed");
        } catch(selectionBackupError) {
            // Non-fatal selection restoration error
            $.writeln("Selection backup restoration failed: " + selectionBackupError.toString());
        }

        app.endUndoGroup();

        var result = "success|Snapped " + keyframesProcessed + " keyframes across " + propertiesProcessed + " properties to playhead";
        if (markersProcessed > 0) {
            result += " (moved " + markersProcessed + " markers)";
        }

        // Include debug messages in result
        var debugMessages = DEBUG_JSX.getMessages();
        return result + "|" + debugMessages.join("|");

    } catch(e) {
        app.endUndoGroup();
        var debugMessages = DEBUG_JSX.getMessages();
        return "error|Snap to playhead failed: " + e.toString() + "|" + debugMessages.join("|");
    }
}

// Helper function to move composition to appropriate folder based on device type
function moveCompositionToFolder(comp, deviceType) {
    try {
        // Define subfolder names for each device type
        var subfolderMapping = {
            "iphone": "Native",
            "desktop": "Desktop",
            "iphone15": "Native",
            "iphone-simple": "Native",
            "web-chrome": "Desktop"
        };

        var subfolderName = subfolderMapping[deviceType];
        if (!subfolderName) {
            $.writeln("Unknown device type for folder organization: " + deviceType);
            return;
        }

        // SMART LOGIC: Try to find existing folders first, only create minimal structure if needed

        // Step 1: Look for "01 - Comps" folder in root
        var compositionsFolder = null;
        for (var i = 1; i <= app.project.items.length; i++) {
            var item = app.project.items[i];
            if (item instanceof FolderItem && item.name === "01 - Comps") {
                compositionsFolder = item;
                break;
            }
        }

        // Step 2: If "01 - Comps" exists, look for Native/Desktop subfolder
        var targetFolder = null;
        if (compositionsFolder) {
            for (var j = 1; j <= compositionsFolder.items.length; j++) {
                var subItem = compositionsFolder.items[j];
                if (subItem instanceof FolderItem && subItem.name === subfolderName) {
                    targetFolder = subItem;
                    $.writeln("Found existing folder: 01 - Comps > " + subfolderName);
                    break;
                }
            }

            // If subfolder doesn't exist but main folder does, use main folder
            if (!targetFolder) {
                targetFolder = compositionsFolder;
                $.writeln("Using existing folder: 01 - Comps (subfolder " + subfolderName + " doesn't exist)");
            }
        }

        // Step 3: If no "01 - Comps" folder exists, create minimal structure
        if (!targetFolder) {
            $.writeln("No existing Comps folder found, creating minimal structure: 01 - Comps > " + subfolderName);
            compositionsFolder = app.project.items.addFolder("01 - Comps");
            targetFolder = compositionsFolder.items.addFolder(subfolderName);
        }

        // Move the composition to the target folder
        if (targetFolder) {
            comp.parentFolder = targetFolder;

            // Expand all folders in the hierarchy to show the composition
            var foldersToExpand = [];
            var tempFolder = targetFolder;

            // Collect all parent folders
            while (tempFolder) {
                foldersToExpand.unshift(tempFolder); // Add to beginning to expand from root down
                tempFolder = tempFolder.parentFolder;
            }

            // Expand only the specific folders in our hierarchy, then select the composition
            for (var e = 0; e < foldersToExpand.length; e++) {
                try {
                    foldersToExpand[e].selected = true; // This expands the folder
                    foldersToExpand[e].selected = false; // This deselects it but keeps it expanded
                } catch(expandError) {
                    $.writeln("Could not expand folder " + foldersToExpand[e].name + ": " + expandError.toString());
                }
            }

            // Finally, select the composition itself to highlight it in the Project panel
            try {
                comp.selected = true;
                $.writeln("Composition '" + comp.name + "' moved to " + targetFolder.name + " and selected in Project panel");
            } catch(selectError) {
                $.writeln("Could not select composition: " + selectError.toString());
            }
        }

    } catch(e) {
        $.writeln("Error in moveCompositionToFolder: " + e.toString());
    }
}

// Helper function to find or create the Projects folder
function getOrCreateImportedProjectsFolder() {
    try {
        // Look for 02 - Assets folder first
        var assetsFolder = null;
        for (var i = 1; i <= app.project.items.length; i++) {
            var item = app.project.items[i];
            if (item instanceof FolderItem && item.name === "02 - Assets") {
                assetsFolder = item;
                break;
            }
        }

        // If no Assets folder exists, create it
        if (!assetsFolder) {
            assetsFolder = app.project.items.addFolder("02 - Assets");
        }

        // Look for Projects folder inside Assets
        var importedFolder = null;
        for (var j = 1; j <= assetsFolder.items.length; j++) {
            var item = assetsFolder.items[j];
            if (item instanceof FolderItem && item.name === "Projects") {
                importedFolder = item;
                break;
            }
        }

        // If no Projects folder exists, create it
        if (!importedFolder) {
            importedFolder = assetsFolder.items.addFolder("Projects");
        }

        return importedFolder;
    } catch(e) {
        // If we can't create the folder structure, return null (import will go to root)
        $.writeln("Could not create Projects folder: " + e.toString());
        return null;
    }
}

// Helper function to get or create Placeholder folder
function getOrCreatePlaceholderFolder() {
    try {
        // First, get or create the Projects folder
        var importedFolder = getOrCreateImportedProjectsFolder();
        if (!importedFolder) return null;

        // Look for AirBoard Templates.aep folder inside Projects
        var templatesFolder = null;
        for (var i = 1; i <= importedFolder.items.length; i++) {
            var item = importedFolder.items[i];
            if (item instanceof FolderItem && item.name === "AirBoard Templates.aep") {
                templatesFolder = item;
                break;
            }
        }

        // If AirBoard Templates.aep doesn't exist, we can't create placeholders yet
        if (!templatesFolder) {
            $.writeln("AirBoard Templates.aep not found in Projects folder");
            return null;
        }

        // Look for Device Templates folder inside AirBoard Templates.aep
        var deviceTemplatesFolder = null;
        for (var j = 1; j <= templatesFolder.items.length; j++) {
            var subItem = templatesFolder.items[j];
            if (subItem instanceof FolderItem && subItem.name === "Device Templates") {
                deviceTemplatesFolder = subItem;
                break;
            }
        }

        // If Device Templates doesn't exist, create it
        if (!deviceTemplatesFolder) {
            deviceTemplatesFolder = templatesFolder.items.addFolder("Device Templates");
        }

        // Look for _Pre-comps folder inside Device Templates
        var precompsFolder = null;
        for (var k = 1; k <= deviceTemplatesFolder.items.length; k++) {
            var preItem = deviceTemplatesFolder.items[k];
            if (preItem instanceof FolderItem && preItem.name === "_Pre-comps") {
                precompsFolder = preItem;
                break;
            }
        }

        // If _Pre-comps doesn't exist, create it
        if (!precompsFolder) {
            precompsFolder = deviceTemplatesFolder.items.addFolder("_Pre-comps");
        }

        // Look for Placeholder folder inside _Pre-comps
        var placeholderFolder = null;
        for (var m = 1; m <= precompsFolder.items.length; m++) {
            var placeItem = precompsFolder.items[m];
            if (placeItem instanceof FolderItem && placeItem.name === "Placeholder") {
                placeholderFolder = placeItem;
                break;
            }
        }

        // Create Placeholder folder if it doesn't exist
        if (!placeholderFolder) {
            placeholderFolder = precompsFolder.items.addFolder("Placeholder");
        }

        return placeholderFolder;
    } catch(e) {
        $.writeln("Could not create Placeholder folder: " + e.toString());
        return null;
    }
}

// Helper function to get or create placeholder composition
function getOrCreatePlaceholderComp(baseWidth, baseHeight, multiplier) {
    // Generate placeholder name based on dimensions and resolution
    var placeholderName = "Placeholder - " + baseWidth + " @" + multiplier + "x";

    // Check if placeholder already exists
    for (var i = 1; i <= app.project.items.length; i++) {
        var item = app.project.items[i];
        if (item instanceof CompItem && item.name === placeholderName) {
            // Found existing placeholder, return it
            return item;
        }
    }

    // Placeholder doesn't exist, create it
    var actualWidth = baseWidth * multiplier;
    var actualHeight = baseHeight * multiplier;
    var duration = 10; // 10 seconds
    var frameRate = 60;

    // Create the placeholder composition
    var placeholderComp = app.project.items.addComp(placeholderName, actualWidth, actualHeight, 1, duration, frameRate);

    // Add a bright magenta shape layer as visual indicator
    var shapeLayer = placeholderComp.layers.addShape();
    shapeLayer.name = "Replace Me";

    // Create rectangle shape
    var shapeGroup = shapeLayer.property("Contents").addProperty("ADBE Vector Group");
    shapeGroup.name = "Rectangle";
    var rect = shapeGroup.property("Contents").addProperty("ADBE Vector Shape - Rect");
    rect.property("Size").setValue([actualWidth, actualHeight]);

    // Add magenta fill
    var fill = shapeGroup.property("Contents").addProperty("ADBE Vector Graphic - Fill");
    fill.property("Color").setValue([1, 0, 1, 1]); // Magenta

    // Center the shape
    shapeLayer.transform.position.setValue([actualWidth/2, actualHeight/2]);

    // Move placeholder to Placeholder folder
    var placeholderFolder = getOrCreatePlaceholderFolder();
    if (placeholderFolder) {
        placeholderComp.parentFolder = placeholderFolder;
    }

    return placeholderComp;
}


// Device Templates functionality
function createDeviceComposition(deviceType, multiplier) {
    var debugInfo = [];
    // app.beginUndoGroup("Create Device Composition");
    
    try {
        debugInfo.push("=== DEVICE CREATION START ===");
        debugInfo.push("Device type: " + deviceType);
        debugInfo.push("Multiplier: " + multiplier);
        
        // Base device specifications (1x scale)
        var baseSpecs = {
            iphone: { width: 393, height: 852 },
            desktop: { width: 1440, height: 1028 },
            iphone15: { width: 475, height: 934 },
            "iphone-simple": { width: 475, height: 934 },
            "web-chrome": { width: 1728, height: 1391.5 }
        };
        
        // Get base dimensions for selected device
        var baseDimensions = baseSpecs[deviceType];
        if (!baseDimensions) {
            debugInfo.push("❌ Invalid device type: " + deviceType);
            return "error|Invalid device type|" + debugInfo.join("|");
        }
        
        debugInfo.push("Base dimensions: " + baseDimensions.width + "x" + baseDimensions.height);
        
        // Calculate dimensions based on multiplier (rounded to integers for AE compatibility)
        var dimensions = {
            width: Math.round(baseDimensions.width * multiplier),
            height: Math.round(baseDimensions.height * multiplier)
        };
        
        debugInfo.push("Calculated dimensions: " + dimensions.width + "x" + dimensions.height + " (rounded from " + (baseDimensions.width * multiplier) + "x" + (baseDimensions.height * multiplier) + ")");
        
        // Create composition name with proper iPhone capitalization
        var compName;
        if (deviceType === "iphone") {
            compName = "iPhone @" + multiplier + "x";
        } else if (deviceType === "iphone15") {
            compName = "iPhone15 @" + multiplier + "x";
        } else if (deviceType === "iphone-simple") {
            compName = "iPhone-simple @" + multiplier + "x";
        } else {
            // For other device types (desktop, web-chrome, etc.), use standard capitalization
            compName = deviceType.charAt(0).toUpperCase() + deviceType.slice(1) + " @" + multiplier + "x";
        }
        debugInfo.push("Creating composition: " + compName);
        
        try {
            // Create new composition
            var comp = app.project.items.addComp(
                compName,                    // name
                dimensions.width,            // width
                dimensions.height,           // height
                1.0,                        // pixel aspect ratio
                10.0,                       // duration (10 seconds)
                60                          // frame rate (60fps)
            );
            debugInfo.push("Composition created successfully");
        } catch(compError) {
            debugInfo.push("❌ Error creating composition: " + compError.toString());
            return "error|Composition creation failed|" + debugInfo.join("|");
        }
        
        // Set background color to white
        comp.bgColor = [1, 1, 1];
        
        // If it's an iPhone type or Web Chrome, import and add the template
        if (deviceType === "iphone" || deviceType === "iphone15" || deviceType === "iphone-simple" || deviceType === "web-chrome") {
            debugInfo.push("=== TEMPLATE IMPORT START ===");
            debugInfo.push("Extension root: " + extensionRoot);
            
            try {
                // Build path to the template file
                var templatePath = extensionRoot + "/assets/templates/AirBoard Templates.aep";
                debugInfo.push("Template path: " + templatePath);
                var templateFile = new File(templatePath);
                
                // Check alternate path separator
                if (!templateFile.exists) {
                    debugInfo.push("Template file not found at first path, trying alternate...");
                    templatePath = extensionRoot + "\\assets\\templates\\AirBoard Templates.aep";
                    debugInfo.push("Alternate template path: " + templatePath);
                    templateFile = new File(templatePath);
                }
                
                debugInfo.push("Template file exists: " + templateFile.exists);
                
                if (templateFile.exists) {
                    debugInfo.push("Template file found: " + templateFile.fsName);
                    
                    // First check if the template composition already exists in the project
                    var templateComp = null;
                    var templateName;
                    if (deviceType === "iphone15") {
                        templateName = "iPhone 15 - 393";
                    } else if (deviceType === "iphone-simple") {
                        templateName = "iPhone Simple - 393";
                    } else if (deviceType === "web-chrome") {
                        templateName = "Web Chrome - 1440";
                    } else {
                        templateName = "iPhone UI - 393";
                    }
                    debugInfo.push("Looking for template composition: '" + templateName + "'");
                    
                    // Look for exact match first, then partial match for iPhone 15
                    for (var i = 1; i <= app.project.items.length; i++) {
                        var item = app.project.items[i];
                        if (item instanceof CompItem) {
                            debugInfo.push("Found comp: '" + item.name + "'");
                            // Exact match
                            if (item.name === templateName) {
                                templateComp = item;
                                debugInfo.push("✓ Exact match found!");
                                break;
                            }
                            // For iPhone 15, look for the template comp specifically
                            // Must have layers to be the template (not the newly created comp)
                            if (deviceType === "iphone15" && 
                                item.name === "iPhone 15 - 393" &&
                                item.layers && item.layers.length > 0) {
                                templateComp = item;
                                debugInfo.push("✓ Found iPhone 15 template with " + item.layers.length + " layers");
                                break;
                            }
                        }
                    }
                    
                    // Only import if not already present
                    if (!templateComp) {
                        debugInfo.push("Template comp not found, importing .aep file...");
                        var importOptions = new ImportOptions(templateFile);
                        var importedItems = app.project.importFile(importOptions);
                        debugInfo.push("Import complete, organizing items...");
                        
                        // Move imported items to the Projects folder
                        var importedFolder = getOrCreateImportedProjectsFolder();
                        if (importedFolder && importedItems) {
                            // Handle both single item and array of items
                            if (importedItems instanceof Array) {
                                for (var k = 0; k < importedItems.length; k++) {
                                    importedItems[k].parentFolder = importedFolder;
                                }
                            } else {
                                importedItems.parentFolder = importedFolder;
                            }
                        }
                        
                        // Find the imported composition
                        debugInfo.push("Searching for template comp after import...");
                        for (var j = 1; j <= app.project.items.length; j++) {
                            var item = app.project.items[j];
                            if (item instanceof CompItem) {
                                debugInfo.push("Found comp after import: '" + item.name + "'");
                                // Try exact match
                                if (item.name === templateName) {
                                    templateComp = item;
                                    debugInfo.push("✓ Exact match found after import!");
                                    break;
                                }
                                // For iPhone 15, look for the exact template comp
                                // Must have layers to be the template
                                if (deviceType === "iphone15" && 
                                    item.name === "iPhone 15 - 393" &&
                                    item.layers && item.layers.length > 0) {
                                    templateComp = item;
                                    debugInfo.push("✓ Found iPhone 15 template after import with " + item.layers.length + " layers");
                                    break;
                                }
                            }
                        }
                    }
                    
                    if (!templateComp) {
                        debugInfo.push("❌ Template composition not found even after import!");
                    }
                    
                    if (templateComp) {
                        debugInfo.push("Template comp found: " + templateComp.name + " with " + templateComp.layers.length + " layers");
                        
                        if (deviceType === "iphone15" || deviceType === "iphone-simple" || deviceType === "web-chrome") {
                            // For iPhone 15, iPhone Simple, and Web Chrome, copy all layers from the template comp
                            var deviceName = deviceType === "iphone15" ? "iPhone 15" : 
                                           deviceType === "iphone-simple" ? "iPhone Simple" : 
                                           "Web Chrome";
                            debugInfo.push("=== " + deviceName + " Layer Copying Process ===");
                            debugInfo.push("Total layers to copy: " + templateComp.layers.length);
                            
                            for (var layerIndex = templateComp.layers.length; layerIndex >= 1; layerIndex--) {
                                try {
                                    debugInfo.push("--- Processing layer " + layerIndex + " ---");
                                    var sourceLayer = templateComp.layers[layerIndex];
                                    debugInfo.push("Copying layer " + layerIndex + ": '" + sourceLayer.name + "'");

                                    // Skip "Web - 1440" layer for web-chrome (we'll add placeholder instead)
                                    if (deviceType === "web-chrome" && sourceLayer.name.indexOf("Web - 1440") !== -1) {
                                        debugInfo.push("Skipping Web - 1440 layer (will be replaced with placeholder)");
                                        continue;
                                    }

                                    // Copy layer to the new composition
                                    sourceLayer.copyToComp(comp);
                                    debugInfo.push("Layer copied, comp now has " + comp.layers.length + " layers");
                                    
                                    // Get the newly copied layer (always at index 1)
                                    var newLayer = comp.layers[1];
                                    debugInfo.push("New layer name: '" + newLayer.name + "'");
                                    
                                    // Calculate scale factor based on layer type
                                    var scaleFactor;
                                    if (newLayer.name.indexOf("iPhone 15 Pro Frame") !== -1) {
                                        // Special scaling for iPhone 15 Pro Frame.png: 50.5% at 2x
                                        scaleFactor = (multiplier / 2) * 50.5;
                                        debugInfo.push("iPhone 15 Pro Frame detected, using special scale: " + scaleFactor + "%");
                                    } else {
                                        // Regular scaling for other layers (iPhone UI, Shadow, Screen Matte)
                                        scaleFactor = (multiplier / 2) * 100;
                                        if (newLayer.name === "Screen Matte") {
                                            debugInfo.push("Screen Matte layer detected, using standard scale: " + scaleFactor + "%");
                                        } else {
                                            debugInfo.push("Regular layer, using standard scale: " + scaleFactor + "%");
                                        }
                                    }
                                    
                                    // Apply scaling
                                    try {
                                        newLayer.transform.scale.setValue([scaleFactor, scaleFactor]);
                                        debugInfo.push("Scale applied successfully");
                                    } catch(scaleError) {
                                        debugInfo.push("❌ Error applying scale: " + scaleError.toString());
                                    }
                                    
                                    // Center the layer using dot loader approach
                                    try {
                                        if (newLayer.transform.position.numKeys > 0) {
                                            debugInfo.push("Layer has " + newLayer.transform.position.numKeys + " position keyframes - offsetting all keyframes");
                                            // If there are keyframes, offset all keyframe values
                                            var currentPos = newLayer.transform.position.value;
                                            var targetX = comp.width / 2;
                                            var targetY = comp.height / 2;
                                            
                                            // Add Y offset for Web Chrome layers (40px at 1x, 80px at 2x, etc.)
                                            if (deviceType === "web-chrome") {
                                                var yOffset = multiplier * 40;
                                                targetY += yOffset;
                                                debugInfo.push("Web Chrome Y offset applied: +" + yOffset + "px");
                                            }
                                            
                                            var offsetX = targetX - currentPos[0];
                                            var offsetY = targetY - currentPos[1];
                                            
                                            debugInfo.push("Current: [" + currentPos[0] + ", " + currentPos[1] + "], Target: [" + targetX + ", " + targetY + "], Offset: [" + offsetX + ", " + offsetY + "]");
                                            
                                            for (var p = 1; p <= newLayer.transform.position.numKeys; p++) {
                                                var keyTime = newLayer.transform.position.keyTime(p);
                                                var keyValue = newLayer.transform.position.keyValue(p);
                                                var newValue = [keyValue[0] + offsetX, keyValue[1] + offsetY];
                                                newLayer.transform.position.setValueAtTime(keyTime, newValue);
                                            }
                                            debugInfo.push("✓ All position keyframes offset successfully");
                                        } else {
                                            debugInfo.push("Layer has no position keyframes - setting static position");
                                            // No keyframes, set static position
                                            var targetX = comp.width/2;
                                            var targetY = comp.height/2;
                                            
                                            // Add Y offset for Web Chrome layers (40px at 1x, 80px at 2x, etc.)
                                            if (deviceType === "web-chrome") {
                                                var yOffset = multiplier * 40;
                                                targetY += yOffset;
                                                debugInfo.push("Web Chrome Y offset applied: +" + yOffset + "px");
                                            }
                                            
                                            newLayer.transform.position.setValue([targetX, targetY]);
                                            debugInfo.push("✓ Static position set successfully at [" + targetX + ", " + targetY + "]");
                                        }
                                    } catch(posError) {
                                        debugInfo.push("❌ Position placement failed: " + posError.toString());
                                        var currentPos = newLayer.transform.position.value;
                                        debugInfo.push("Layer current position: [" + currentPos[0] + ", " + currentPos[1] + "]");
                                        debugInfo.push("Target position: [" + (comp.width/2) + ", " + (comp.height/2) + "]");
                                    }
                                    
                                    // Layer positioning based on device type and layer name
                                    if (deviceType === "iphone15") {
                                        // iPhone 15: iPhone 15 Pro Frame goes to top, others to bottom
                                        if (newLayer.name.indexOf("iPhone 15 Pro Frame") !== -1) {
                                            // Keep iPhone 15 Pro Frame at the top (index 1)
                                            debugInfo.push("Keeping iPhone 15 Pro Frame at top");
                                        } else {
                                            // Move other layers to bottom to preserve order
                                            try {
                                                newLayer.moveToEnd();
                                                debugInfo.push("Moving " + newLayer.name + " to bottom");
                                            } catch(moveError) {
                                                debugInfo.push("❌ Error moving layer: " + moveError.toString());
                                            }
                                        }
                                    } else if (deviceType === "iphone-simple") {
                                        // iPhone Simple: iPhone UI - 393 goes to top, Shadow goes to bottom
                                        if (newLayer.name.indexOf("iPhone UI - 393") !== -1) {
                                            // Keep iPhone UI at the top (index 1)
                                            debugInfo.push("Keeping iPhone UI - 393 at top");
                                        } else if (newLayer.name.indexOf("Shadow") !== -1) {
                                            // Move Shadow layer to bottom
                                            try {
                                                newLayer.moveToEnd();
                                                debugInfo.push("Moving " + newLayer.name + " to bottom");
                                            } catch(moveError) {
                                                debugInfo.push("❌ Error moving layer: " + moveError.toString());
                                            }
                                        } else {
                                            // Move other layers to bottom by default
                                            try {
                                                newLayer.moveToEnd();
                                                debugInfo.push("Moving " + newLayer.name + " to bottom");
                                            } catch(moveError) {
                                                debugInfo.push("❌ Error moving layer: " + moveError.toString());
                                            }
                                        }
                                    } else if (deviceType === "web-chrome") {
                                        // Web Chrome: Web - 1440 goes to top, Browser Chrome goes to bottom
                                        if (newLayer.name.indexOf("Web - 1440") !== -1) {
                                            // Keep Web - 1440 at the top (index 1)
                                            debugInfo.push("Keeping Web - 1440 at top");
                                        } else if (newLayer.name.indexOf("Browser Chrome") !== -1) {
                                            // Move Browser Chrome layer to bottom
                                            try {
                                                newLayer.moveToEnd();
                                                debugInfo.push("Moving " + newLayer.name + " to bottom");
                                            } catch(moveError) {
                                                debugInfo.push("❌ Error moving layer: " + moveError.toString());
                                            }
                                        } else {
                                            // Move other layers to bottom by default
                                            try {
                                                newLayer.moveToEnd();
                                                debugInfo.push("Moving " + newLayer.name + " to bottom");
                                            } catch(moveError) {
                                                debugInfo.push("❌ Error moving layer: " + moveError.toString());
                                            }
                                        }
                                    }
                                    
                                    debugInfo.push("Layer processing complete for: " + newLayer.name);
                                    debugInfo.push("--- Layer " + layerIndex + " done ---");
                                } catch(layerError) {
                                    debugInfo.push("❌ Error processing layer " + layerIndex + ": " + layerError.toString());
                                    // Continue with next layer instead of breaking
                                }
                            }
                            debugInfo.push("=== " + deviceName + " Layer Copying Complete ===");
                            
                            // Step 2: Add Placeholder comp as base layer for iPhone 15 and iPhone Simple
                            if (deviceType === "iphone15" || deviceType === "iphone-simple") {
                                debugInfo.push("=== Adding Placeholder Base Layer ===");

                                // Get or create placeholder comp (393px base width for iPhone, 852px base height)
                                var placeholderComp = getOrCreatePlaceholderComp(393, 852, multiplier);

                                if (placeholderComp) {
                                    // Add placeholder as precomp layer
                                    var placeholderLayer = comp.layers.add(placeholderComp);
                                    placeholderLayer.name = "Replace Me";

                                    // Always scale to 100% (this is the key difference!)
                                    placeholderLayer.transform.scale.setValue([100, 100]);
                                    debugInfo.push("Placeholder scaled to 100%");

                                    // Center the layer
                                    placeholderLayer.transform.position.setValue([comp.width/2, comp.height/2]);

                                    // Set start time to playhead position
                                    placeholderLayer.startTime = comp.time;

                                    // Enable collapse transformations for crisp rendering
                                    placeholderLayer.collapseTransformation = true;

                                    // Position placeholder layer based on device type
                                    if (deviceType === "iphone-simple") {
                                        // For iPhone Simple: Placeholder goes to top (above Shadow)
                                        placeholderLayer.moveToBeginning();
                                        debugInfo.push("Placeholder moved to top (above Shadow)");
                                    } else {
                                        // For iPhone 15: Placeholder goes to bottom (behind Frame)
                                        placeholderLayer.moveToEnd();
                                        debugInfo.push("Placeholder moved to bottom (behind Frame)");
                                    }
                                    
                                    debugInfo.push("✓ Placeholder added as base layer");

                                    // Step 3: Find Screen Matte layer and set up track matte
                                    debugInfo.push("=== Setting up Screen Matte ===");
                                    var screenMatteLayer = null;

                                    // Look for Screen Matte layer in the composition
                                    for (var m = 1; m <= comp.layers.length; m++) {
                                        if (comp.layer(m).name === "Screen Matte") {
                                            screenMatteLayer = comp.layer(m);
                                            debugInfo.push("✓ Found Screen Matte layer at index " + m);
                                            break;
                                        }
                                    }

                                    if (screenMatteLayer) {
                                        // Set up track matte for placeholder layer
                                        try {
                                            // Make sure Screen Matte is positioned directly above placeholder in layer stack
                                            // The matte layer needs to be right above the layer it's matting

                                            // Find current positions
                                            var placeholderIndex = placeholderLayer.index;
                                            var screenMatteIndex = screenMatteLayer.index;

                                            debugInfo.push("Placeholder at index: " + placeholderIndex);
                                            debugInfo.push("Screen Matte at index: " + screenMatteIndex);

                                            // Screen Matte needs to be at placeholder index - 1 (above it)
                                            if (screenMatteIndex !== placeholderIndex - 1) {
                                                // Move Screen Matte to be right above placeholder
                                                if (screenMatteIndex > placeholderIndex) {
                                                    // Screen Matte is below, move it above
                                                    screenMatteLayer.moveBefore(placeholderLayer);
                                                } else {
                                                    // Screen Matte is too far above, move it to right above
                                                    screenMatteLayer.moveAfter(placeholderLayer);
                                                    screenMatteLayer.moveBefore(placeholderLayer);
                                                }
                                                debugInfo.push("Repositioned Screen Matte to be above placeholder");
                                            }

                                            // Set the track matte
                                            placeholderLayer.setTrackMatte(screenMatteLayer, TrackMatteType.ALPHA);
                                            debugInfo.push("✓ Track matte set: Placeholder using Screen Matte as Alpha");
                                            
                                        } catch(matteError) {
                                            debugInfo.push("❌ Error setting up track matte: " + matteError.toString());
                                            // Try alternate method
                                            try {
                                                placeholderLayer.trackMatteType = TrackMatteType.ALPHA;
                                                debugInfo.push("✓ Track matte set using alternate method");
                                            } catch(altError) {
                                                debugInfo.push("❌ Alternate method also failed: " + altError.toString());
                                            }
                                        }
                                    } else {
                                        debugInfo.push("⚠️ Screen Matte layer not found - Placeholder will not be masked");
                                    }

                                } else {
                                    debugInfo.push("❌ Could not create placeholder comp");
                                }
                            }

                            // Step 2b: Add Placeholder comp for Web Chrome
                            if (deviceType === "web-chrome") {
                                debugInfo.push("=== Adding Placeholder Base Layer for Web Chrome ===");

                                // Get or create placeholder comp (1440×1028 base dimensions, same as desktop)
                                var placeholderComp = getOrCreatePlaceholderComp(1440, 1028, multiplier);

                                if (placeholderComp) {
                                    // Add placeholder as precomp layer
                                    var placeholderLayer = comp.layers.add(placeholderComp);
                                    placeholderLayer.name = "Replace Me";

                                    // Always scale to 100% (this is the key difference!)
                                    placeholderLayer.transform.scale.setValue([100, 100]);
                                    debugInfo.push("Placeholder scaled to 100%");

                                    // Center the layer with Y offset for Web Chrome
                                    var targetX = comp.width/2;
                                    var targetY = comp.height/2 + (multiplier * 40); // Y offset
                                    placeholderLayer.transform.position.setValue([targetX, targetY]);
                                    debugInfo.push("Placeholder positioned with Web Chrome Y offset");

                                    // Set start time to playhead position
                                    placeholderLayer.startTime = comp.time;

                                    // Enable collapse transformations for crisp rendering
                                    placeholderLayer.collapseTransformation = true;

                                    // Move to top (where Web - 1440 was)
                                    placeholderLayer.moveToBeginning();
                                    debugInfo.push("Placeholder moved to top (where Web - 1440 was)");

                                    debugInfo.push("✓ Placeholder added as base layer for Web Chrome");
                                } else {
                                    debugInfo.push("❌ Could not create placeholder comp for Web Chrome");
                                }
                            }
                        } else {
                            // For regular iPhone UI, add the entire composition as a precomp layer
                            var templateLayer = comp.layers.add(templateComp);
                            templateLayer.name = "iPhone UI";
                            
                            // Calculate scale factor
                            var scaleFactor = (multiplier / 2) * 100;
                            
                            // Apply scaling
                            templateLayer.transform.scale.setValue([scaleFactor, scaleFactor]);
                            
                            // Center the layer
                            templateLayer.transform.position.setValue([comp.width/2, comp.height/2]);
                            
                            // Enable collapse transformations for crisp rendering
                            templateLayer.collapseTransformation = true;
                            
                            // Move to bottom of layer stack
                            templateLayer.moveToEnd();
                        }
                    }
                }
            } catch(templateError) {
                // Non-fatal if template import fails
                $.writeln("Template import error: " + templateError.toString());
            }
        }
        
        
        // Open the composition in the viewer
        comp.openInViewer();
        
        // Check if "01 - Comps" folder already exists
        var compositionsFolderExists = false;
        for (var i = 1; i <= app.project.items.length; i++) {
            var item = app.project.items[i];
            if (item instanceof FolderItem && item.name === "01 - Comps") {
                compositionsFolderExists = true;
                $.writeln("Found existing 01 - Comps folder, respecting user's folder structure");
                break;
            }
        }

        // Only create full folder structure if starting fresh (no 01 - Comps folder)
        if (!compositionsFolderExists) {
            $.writeln("No existing folder structure found, creating fresh complete structure");
            try {
                var folderStructure = [
                    {
                        name: "01 - Comps",
                        subfolders: [
                            {
                                name: "Desktop",
                                subfolders: [
                                    { name: "01_Specs" },
                                    { name: "02_Lottie" },
                                    { name: "03_Precomps" }
                                ]
                            },
                            {
                                name: "Native",
                                subfolders: [
                                    { name: "01_Specs" },
                                    { name: "02_Lottie" },
                                    { name: "03_Precomps" }
                                ]
                            },
                            { name: "zArchive" }
                        ]
                    },
                    {
                        name: "02 - Assets",
                        subfolders: [
                            { name: "Images" },
                            { name: "Projects" },
                            { name: "Reference" },
                            { name: "Renders" },
                            { name: "Video" }
                        ]
                    }
                ];

                // Create the folder structure recursively (reuses existing function)
                createFolderStructure(app.project, folderStructure);
            } catch(folderError) {
                $.writeln("Folder structure creation failed: " + folderError.toString());
            }
        }
        
        // Move composition to appropriate folder
        try {
            moveCompositionToFolder(comp, deviceType);
        } catch(orgError) {
            $.writeln("Composition organization failed: " + orgError.toString());
        }
        
        debugInfo.push("=== DEVICE CREATION COMPLETE ===");
        // app.endUndoGroup();
        return "success|" + debugInfo.join("|");
        
    } catch(e) {
        debugInfo.push("❌ Error: " + e.toString());
        // app.endUndoGroup();
        return "error|" + debugInfo.join("|");
    }
}

// Gesture Templates functionality
function addGestureFromPanel(gestureType, multiplier) {
    // app.beginUndoGroup("Add Gesture");
    
    try {
        // Check if we have an active comp
        var comp = app.project.activeItem;
        if (!comp || !(comp instanceof CompItem)) {
            alert("Please select a composition first.");
            // app.endUndoGroup();
            return "error";
        }
        
        // Define gesture compositions and layers
        var gestureData = {
            tap: {
                compName: "Gesture - Tap",
                layerName: "Gesture - Tap"
            },
            longpress: {
                compName: "Gesture - Long Press", 
                layerName: "Gesture - Long Press"
            },
            doubletap: {
                compName: "Gesture - Double Tap",
                layerName: "Gesture - Double Tap"
            },
            mouseclick: {
                compName: "Mouse - Click",
                layerName: "Mouse - Click"
            }
        };
        
        var data = gestureData[gestureType];
        if (!data) {
            alert("Invalid gesture type");
            // app.endUndoGroup();
            return "error";
        }
        
        // Import template if not already present
        var templatePath = extensionRoot + "/assets/templates/AirBoard Templates.aep";
        var templateFile = new File(templatePath);
        
        if (!templateFile.exists) {
            templatePath = extensionRoot + "\\assets\\templates\\AirBoard Templates.aep";
            templateFile = new File(templatePath);
        }
        
        if (!templateFile.exists) {
            alert("Cannot find AirBoard Templates.aep file.");
            // app.endUndoGroup();
            return "error";
        }
        
        // Find the gesture composition
        var gestureComp = null;
        for (var i = 1; i <= app.project.items.length; i++) {
            var item = app.project.items[i];
            if (item instanceof CompItem && item.name === data.compName) {
                gestureComp = item;
                break;
            }
        }
        
        // Import if not found
        if (!gestureComp) {
            var importOptions = new ImportOptions(templateFile);
            var importedItems = app.project.importFile(importOptions);
            
            // Move imported items to the Projects folder
            var importedFolder = getOrCreateImportedProjectsFolder();
            if (importedFolder && importedItems) {
                // Handle both single item and array of items
                if (importedItems instanceof Array) {
                    for (var k = 0; k < importedItems.length; k++) {
                        importedItems[k].parentFolder = importedFolder;
                    }
                } else {
                    importedItems.parentFolder = importedFolder;
                }
            }
            
            // Find after import
            for (var j = 1; j <= app.project.items.length; j++) {
                var item = app.project.items[j];
                if (item instanceof CompItem && item.name === data.compName) {
                    gestureComp = item;
                    break;
                }
            }
        }
        
        
        if (!gestureComp) {
            alert("Cannot find " + data.compName + " composition in template.");
            // app.endUndoGroup();
            return "error";
        }
        
        // Find the specific layer in the gesture comp
        var sourceLayer = null;
        for (var k = 1; k <= gestureComp.layers.length; k++) {
            var layer = gestureComp.layers[k];
            if (layer.name === data.layerName) {
                sourceLayer = layer;
                break;
            }
        }
        
        if (!sourceLayer) {
            alert("Cannot find layer '" + data.layerName + "' in " + data.compName);
            // app.endUndoGroup();
            return "error";
        }
        
        // Store layer count before copying to verify addition
        var layerCountBefore = comp.numLayers;
        
        // Clear any layer selection to avoid insertion position issues (optional, but harmless)
        try {
            for (var s = 1; s <= comp.numLayers; s++) {
                comp.layers[s].selected = false;
            }
        } catch(clearError) {
            // Non-critical if selection clearing fails
        }
        
        // Copy the source layer to the current comp
        sourceLayer.copyToComp(comp);
        
        // Verify a new layer was added
        if (comp.numLayers <= layerCountBefore) {
            alert("Error: Gesture layer was not added to the composition.");
            // app.endUndoGroup();
            return "error";
        }
        
        // The new layer is always at index 1 per AE scripting behavior; no need for name check to avoid false errors
        var gestureLayer = comp.layers[1];

        // Check if there's an "iPhone UI" layer and position gesture layer right under it
        try {
            var iPhoneUILayer = null;
            for (var i = 1; i <= comp.numLayers; i++) {
                if (comp.layers[i].name === "iPhone UI") {
                    iPhoneUILayer = comp.layers[i];
                    break;
                }
            }

            if (iPhoneUILayer) {
                // Move gesture layer to right after iPhone UI layer
                gestureLayer.moveAfter(iPhoneUILayer);
                $.writeln("Positioned gesture layer under iPhone UI");
            }
        } catch(positionError) {
            $.writeln("Layer positioning failed: " + positionError.toString());
            // Non-critical - gesture layer will stay at top if positioning fails
        }

        // Keep the original layer names so expressions work properly
        // Don't rename the layer since expressions depend on the original name

        // Apply scaling based on resolution multiplier
        // 1=50%, 2=100%, 3=150%, 4=200%, 5=250%, 6=300%
        var scalePercentage;
        switch(multiplier) {
            case 1:
                scalePercentage = 50;
                break;
            case 2:
                scalePercentage = 100;
                break;
            case 3:
                scalePercentage = 150;
                break;
            case 4:
                scalePercentage = 200;
                break;
            case 5:
                scalePercentage = 250;
                break;
            case 6:
                scalePercentage = 300;
                break;
            default:
                scalePercentage = 100; // Default to 100% if unexpected value
        }
        
        try {
            gestureLayer.transform.scale.setValue([scalePercentage, scalePercentage]);
        } catch(scaleError) {
            $.writeln("Scale application failed: " + scaleError.toString());
        }
        
        // Set layer start time to current playhead position
        try {
            var playheadTime = comp.time;
            gestureLayer.startTime = playheadTime;
        } catch(timeError) {
            $.writeln("Playhead positioning failed: " + timeError.toString());
        }
        
        // Handle positioning - check if property has keyframes  
        try {
            if (gestureLayer.transform.position.numKeys > 0) {
                // If there are keyframes, offset all keyframe values to center based on second keyframe
                var referencePos;
                if (gestureLayer.transform.position.numKeys >= 2) {
                    // Use second keyframe as reference for centering
                    referencePos = gestureLayer.transform.position.keyValue(2);
                } else {
                    // Fallback to first keyframe if only one exists
                    referencePos = gestureLayer.transform.position.keyValue(1);
                }
                var offsetX = (comp.width/2) - referencePos[0];
                var offsetY = (comp.height/2) - referencePos[1];
                
                for (var p = 1; p <= gestureLayer.transform.position.numKeys; p++) {
                    var keyTime = gestureLayer.transform.position.keyTime(p);
                    var keyValue = gestureLayer.transform.position.keyValue(p);
                    var centeredValue = [keyValue[0] + offsetX, keyValue[1] + offsetY];
                    gestureLayer.transform.position.setValueAtTime(keyTime, centeredValue);
                }
            } else {
                // No keyframes, just set the value
                gestureLayer.transform.position.setValue([comp.width/2, comp.height/2]);
            }
        } catch(posError) {
            // If positioning fails, continue without repositioning
            $.writeln("Position adjustment failed: " + posError.toString());
        }
        
        // app.endUndoGroup();
        return "success";
        
    } catch(e) {
        alert("Error adding gesture: " + e.toString());
        // app.endUndoGroup();
        return "error";
    }
}

// Add Component functionality (follows exact same pattern as gestures)
function addComponentFromPanel(componentType, multiplier) {
    try {
        // app.beginUndoGroup("Add Component");
        
        // Get active composition
        var comp = app.project.activeItem;
        if (!comp || !(comp instanceof CompItem)) {
            alert("Please select a composition first.");
            // app.endUndoGroup();
            return "error";
        }
        
        // Component data mapping
        var componentData = {
            "timer": {
                compName: "Millisecond Counter",
                layerName: "Time Counter",
                templateFile: "AirBoard Templates.aep"
            },
            "dot-loader": {
                compName: "Dot Loader",
                layerName: "Dot Loader",
                templateFile: "AirBoard Templates.aep"
            },
            "belo-spin": {
                compName: "Belo - Continuous Loop",
                layerName: "Belo Spin", // This will be the name after copying
                templateFile: "Belo Spin.aep"
            },
            "iphone-ui": {
                compName: "iPhone UI - 393",
                layerName: "iPhone UI - 393",
                templateFile: "AirBoard Templates.aep"
            }
        };
        
        var data = componentData[componentType];
        if (!data) {
            alert("Unknown component type: " + componentType);
            // app.endUndoGroup();
            return "error";
        }
        
        // Template file path
        var templatePath = extensionRoot + "/assets/templates/" + data.templateFile;
        var templateFile = new File(templatePath);
        
        // Check alternate path separator
        if (!templateFile.exists) {
            templatePath = extensionRoot + "\\assets\\templates\\" + data.templateFile;
            templateFile = new File(templatePath);
        }
        
        if (!templateFile.exists) {
            alert("Cannot find template file at: " + templatePath);
            // app.endUndoGroup();
            return "error";
        }
        
        // Find the component composition
        var componentComp = null;
        for (var i = 1; i <= app.project.items.length; i++) {
            var item = app.project.items[i];
            if (item instanceof CompItem && item.name === data.compName) {
                componentComp = item;
                break;
            }
        }
        
        // Import if not found
        if (!componentComp) {
            var importOptions = new ImportOptions(templateFile);
            var importedItems = app.project.importFile(importOptions);
            
            // Move imported items to the Projects folder
            var importedFolder = getOrCreateImportedProjectsFolder();
            if (importedFolder && importedItems) {
                // Handle both single item and array of items
                if (importedItems instanceof Array) {
                    for (var k = 0; k < importedItems.length; k++) {
                        importedItems[k].parentFolder = importedFolder;
                    }
                } else {
                    importedItems.parentFolder = importedFolder;
                }
            }
            
            // Find after import
            for (var j = 1; j <= app.project.items.length; j++) {
                var item = app.project.items[j];
                if (item instanceof CompItem && item.name === data.compName) {
                    componentComp = item;
                    break;
                }
            }
        }
        
        
        if (!componentComp) {
            alert("Cannot find " + data.compName + " composition in template.");
            // app.endUndoGroup();
            return "error";
        }
        
        // Find the specific layer in the component comp (for layer-based components)
        var sourceLayer = null;
        if (componentType !== "iphone-ui") {
            for (var k = 1; k <= componentComp.layers.length; k++) {
                var layer = componentComp.layers[k];
                if (layer.name === data.layerName) {
                    sourceLayer = layer;
                    break;
                }
            }
            
            // If exact layer name not found, try to use the first layer as fallback
            if (!sourceLayer && componentComp.layers.length > 0) {
                sourceLayer = componentComp.layers[1];
            }
        }
        
        if (!sourceLayer && componentType !== "iphone-ui") {
            alert("Cannot find any layers in " + data.compName);
            // app.endUndoGroup();
            return "error";
        }
        
        // Store layer count before copying to verify addition
        var layerCountBefore = comp.numLayers;
        
        // Clear any layer selection to avoid insertion position issues (optional, but harmless)
        try {
            for (var s = 1; s <= comp.numLayers; s++) {
                comp.layers[s].selected = false;
            }
        } catch(clearError) {
            // Non-critical if selection clearing fails
        }
        
        // Add component to composition
        var componentLayer;
        if (componentType === "iphone-ui") {
            // For iPhone UI, add the entire composition as a precomp layer
            componentLayer = comp.layers.add(componentComp);
            
            if (!componentLayer) {
                alert("Error: iPhone UI composition could not be added as layer.");
                return "error";
            }
        } else {
            // For other components, copy individual layers from the composition
            sourceLayer.copyToComp(comp);
            
            // Verify a new layer was added
            if (comp.numLayers <= layerCountBefore) {
                alert("Error: Component layer was not added to the composition.");
                // app.endUndoGroup();
                return "error";
            }
            
            // The new layer is always at index 1 per AE scripting behavior
            componentLayer = comp.layers[1];
        }
        
        // Keep the original layer names so expressions work properly
        // Don't rename the layer since expressions depend on the original name
        
        // Apply scaling based on resolution multiplier
        // 1=50%, 2=100%, 3=150%, 4=200%, 5=250%, 6=300%
        var scalePercentage;
        switch(multiplier) {
            case 1:
                scalePercentage = 50;
                break;
            case 2:
                scalePercentage = 100;
                break;
            case 3:
                scalePercentage = 150;
                break;
            case 4:
                scalePercentage = 200;
                break;
            case 5:
                scalePercentage = 250;
                break;
            case 6:
                scalePercentage = 300;
                break;
            default:
                scalePercentage = 100; // Default to 100% if unexpected value
        }
        
        try {
            componentLayer.transform.scale.setValue([scalePercentage, scalePercentage]);
        } catch(scaleError) {
            $.writeln("Scale application failed: " + scaleError.toString());
        }
        
        // Set layer start time - iPhone UI goes to start frame, others go to playhead
        try {
            var playheadTime = comp.time;
            if (componentType === "iphone-ui") {
                // iPhone UI component always starts at frame 0
                componentLayer.startTime = 0;
            } else {
                // All other components start at playhead position
                componentLayer.startTime = playheadTime;
            }
        } catch(timeError) {
            $.writeln("Playhead positioning failed: " + timeError.toString());
        }
        
        // Handle positioning - check if property has keyframes  
        try {
            // Only place Ms Counter (timer) in top-left, others go to center
            var isTimer = (componentType === "timer");
            
            if (componentLayer.transform.position.numKeys > 0) {
                // If there are keyframes, offset all keyframe values
                var currentPos = componentLayer.transform.position.value;
                var targetX, targetY, offsetX, offsetY;
                
                if (isTimer) {
                    // Top-left for timer
                    targetX = 60; // 60px padding from left edge
                    targetY = 60; // 60px padding from top edge
                } else {
                    // Center for other components (Dot Loader, Belo Spin, iPhone UI)
                    targetX = comp.width / 2;
                    targetY = comp.height / 2;
                }
                
                offsetX = targetX - currentPos[0];
                offsetY = targetY - currentPos[1];
                
                for (var p = 1; p <= componentLayer.transform.position.numKeys; p++) {
                    var keyTime = componentLayer.transform.position.keyTime(p);
                    var keyValue = componentLayer.transform.position.keyValue(p);
                    var newValue = [keyValue[0] + offsetX, keyValue[1] + offsetY];
                    componentLayer.transform.position.setValueAtTime(keyTime, newValue);
                }
            } else {
                // No keyframes, set static position
                if (isTimer) {
                    // Top-left for timer
                    componentLayer.transform.position.setValue([60, 60]);
                } else {
                    // Center for other components (Dot Loader, Belo Spin, iPhone UI)
                    componentLayer.transform.position.setValue([comp.width/2, comp.height/2]);
                }
            }
        } catch(posError) {
            $.writeln("Position placement failed: " + posError.toString());
        }
        
        // app.endUndoGroup();
        return "success";
    } catch(e) {
        alert("Error adding component: " + e.toString());
        // app.endUndoGroup();
        return "error";
    }
}

// Main function called from the panel
function createSquircleFromPanel(useCompSize, resolutionMultiplier) {
    try {
        applySquircle(useCompSize, resolutionMultiplier);
        return "success";
    } catch(e) {
        return "error";
    }
}

// Replace rectangle function called from the panel
function replaceRectangleFromPanel() {
    try {
        replaceRectangle();
        return "success";
    } catch(e) {
        alert("Error: " + e.toString());
        return "error";
    }
}

// Add Nulls function called from the panel
function addNullsFromPanel(nullType) {
    try {
        var result = addNulls(nullType);
        return result || "success";
    } catch(e) {
        DEBUG_JSX.error("addNullsFromPanel failed", e.toString());
        alert("Error: " + e.toString());
        var debugMessages = DEBUG_JSX.getMessages();
        return "error|" + e.toString() + "|" + debugMessages.join("|");
    }
}

// Apply FitToShape functionality - adapted from FitToShape.jsx
function applyFitToShape(mode) {
    try {
        // Clear previous debug messages
        DEBUG_JSX.clear();
        
        DEBUG_JSX.log("applyFitToShape called with mode: " + mode);
        
        function getLayerPositionComponents(layer) {
            try {
                var transformGroup = layer.property("Transform");
                var positionProp = transformGroup.property("Position");
                var xVal, yVal, zVal;
                if (positionProp.dimensionsSeparated) {
                    xVal = transformGroup.property("X Position").value;
                    yVal = transformGroup.property("Y Position").value;
                    var zProp = transformGroup.property("Z Position");
                    zVal = zProp ? zProp.value : 0;
                } else {
                    var posVal = positionProp.value;
                    xVal = (posVal.length > 0) ? posVal[0] : 0;
                    yVal = (posVal.length > 1) ? posVal[1] : 0;
                    zVal = (posVal.length > 2) ? posVal[2] : 0;
                }
                return [xVal, yVal, zVal];
            } catch(positionError) {
                DEBUG_JSX.log("getLayerPositionComponents failure for " + layer.name + ": " + positionError.toString());
                return [0, 0, 0];
            }
        }

        // Convert a point from layer space to composition space (handles parent transforms)
        function layerSpaceToCompSpace(layer, pointInLayerSpace, currentTime) {
            try {
                var x = pointInLayerSpace[0];
                var y = pointInLayerSpace[1];
                var z = pointInLayerSpace.length > 2 ? pointInLayerSpace[2] : 0;

                var currentLayer = layer;

                // Walk up the parent chain
                while (currentLayer) {
                    var pos = getLayerPositionComponents(currentLayer);
                    var anchor = currentLayer.anchorPoint.value;
                    var scale = currentLayer.scale.value;
                    var rotation = currentLayer.rotation ? currentLayer.rotation.value : 0;

                    // Apply scale
                    x *= (scale[0] / 100);
                    y *= (scale[1] / 100);

                    // Apply rotation (convert degrees to radians)
                    if (rotation !== 0) {
                        var rad = rotation * Math.PI / 180;
                        var cosR = Math.cos(rad);
                        var sinR = Math.sin(rad);
                        var newX = x * cosR - y * sinR;
                        var newY = x * sinR + y * cosR;
                        x = newX;
                        y = newY;
                    }

                    // Translate by (position - anchor)
                    x += pos[0] - anchor[0];
                    y += pos[1] - anchor[1];
                    z += pos[2] - (anchor.length > 2 ? anchor[2] : 0);

                    // Move to parent
                    currentLayer = currentLayer.parent;
                }

                return [x, y, z];
            } catch(e) {
                DEBUG_JSX.log("layerSpaceToCompSpace error: " + e.toString());
                return pointInLayerSpace;
            }
        }
        
        function setLayerPositionComponents(layer, xVal, yVal, zVal) {
            var transformGroup = layer.property("Transform");
            var positionProp = transformGroup.property("Position");
            if (positionProp.dimensionsSeparated) {
                try { transformGroup.property("X Position").setValue(xVal); } catch(xErr) {}
                try { transformGroup.property("Y Position").setValue(yVal); } catch(yErr) {}
                var zProp = transformGroup.property("Z Position");
                if (zProp) {
                    try { zProp.setValue(zVal); } catch(zErr) {}
                }
            } else {
                var newPos = positionProp.value;
                if (!(newPos instanceof Array)) {
                    newPos = [0, 0, 0];
                }
                if (newPos.length < 2) {
                    newPos = [0, 0];
                }
                newPos[0] = xVal;
                newPos[1] = yVal;
                if (newPos.length > 2) {
                    newPos[2] = zVal;
                }
                try {
                    positionProp.setValue(newPos);
                } catch(setErr) {
                    // As a fallback, attempt to set explicitly sized array
                    try {
                        if (positionProp.value.length === 3) {
                            positionProp.setValue([xVal, yVal, zVal]);
                        } else {
                            positionProp.setValue([xVal, yVal]);
                        }
                    } catch(setErr2) {
                        DEBUG_JSX.log("setLayerPositionComponents fallback failed for " + layer.name + ": " + setErr2.toString());
                    }
                }
            }
        }
        
        var comp = app.project.activeItem;
        if (!comp || !(comp instanceof CompItem)) {
            DEBUG_JSX.error("No active composition selected");
            alert("Please select a composition first.");
            var debugMessages = DEBUG_JSX.getMessages();
            return "error|No composition|" + debugMessages.join("|");
        }
    
        var selectedLayers = comp.selectedLayers;
        DEBUG_JSX.log("Found " + selectedLayers.length + " selected layers");
        
        if (selectedLayers.length < 2) {
            DEBUG_JSX.error("Not enough layers selected", "Need at least 2 layers");
            alert("Please select at least 2 layers: one shape layer and one or more other layers.");
            var debugMessages = DEBUG_JSX.getMessages();
            return "error|Not enough layers|" + debugMessages.join("|");
        }
    
        // Identify shape layer with highest index (bottom of layer stack) and other layers
        var shapeLayer = null;
        var highestShapeIndex = -1;
        var otherLayers = [];

        DEBUG_JSX.log("Analyzing selected layers...");

        for (var i = 0; i < selectedLayers.length; i++) {
            var layer = selectedLayers[i];
            DEBUG_JSX.log("Layer " + i + ": " + layer.name + " (type: " + (layer instanceof ShapeLayer ? "Shape" : "Other") + ", index: " + layer.index + ")");

            if (layer instanceof ShapeLayer) {
                // Check if this layer is a mask layer created by "Fit to Squircle"
                // Real mask layers: parented to shape layer + no track matte + name ends with " - Mask"
                var isMaskLayer = (layer.parent &&
                                  layer.parent instanceof ShapeLayer &&
                                  layer.trackMatteType === TrackMatteType.NO_TRACK_MATTE &&
                                  layer.name.indexOf(" - Mask") !== -1);

                if (isMaskLayer) {
                    DEBUG_JSX.log("Layer '" + layer.name + "' appears to be a mask layer (parented to '" + layer.parent.name + "'), treating as content layer");
                    otherLayers.push(layer);
                } else {
                    // Keep track of the shape layer with the highest index (bottom of layer stack)
                    if (layer.index > highestShapeIndex) {
                        // If we already had a shape layer, add it to otherLayers
                        if (shapeLayer) {
                            DEBUG_JSX.log("Moving previous shape layer '" + shapeLayer.name + "' to content layers");
                            otherLayers.push(shapeLayer);
                        }
                        shapeLayer = layer;
                        highestShapeIndex = layer.index;
                        DEBUG_JSX.log("Set shape layer to: " + layer.name + " (index: " + layer.index + ")");
                    } else {
                        // This shape layer has a lower index, treat it as content
                        DEBUG_JSX.log("Adding shape layer '" + layer.name + "' to content layers (lower index)");
                        otherLayers.push(layer);
                    }
                }
            } else {
                DEBUG_JSX.log("Adding layer '" + layer.name + "' to content layers");
                otherLayers.push(layer);
            }
        }

        DEBUG_JSX.log("Layer analysis complete. shapeLayer is: " + (shapeLayer ? shapeLayer.name : "NULL"));

        if (!shapeLayer) {
            DEBUG_JSX.log("No shape layer found, checking if mask layer was selected...");
            // Check if user accidentally selected only mask layers
            var hasMaskLayerInSelection = false;
            DEBUG_JSX.log("About to loop through " + selectedLayers.length + " selected layers");
            for (var i = 0; i < selectedLayers.length; i++) {
                var layer = selectedLayers[i];
                DEBUG_JSX.log("Checking layer " + i + ": " + layer.name);
                if (layer instanceof ShapeLayer &&
                    layer.parent &&
                    layer.parent instanceof ShapeLayer &&
                    layer.trackMatteType === TrackMatteType.NO_TRACK_MATTE &&
                    layer.name.indexOf(" - Mask") !== -1) {
                    hasMaskLayerInSelection = true;
                    DEBUG_JSX.log("Found mask layer: " + layer.name);
                    break;
                }
            }
            DEBUG_JSX.log("Mask layer detection complete. hasMaskLayerInSelection: " + hasMaskLayerInSelection);

            if (hasMaskLayerInSelection) {
                DEBUG_JSX.log("Mask layer selected instead of shape layer");
                alert("Can't Fit to Squircle because you selected the track matte layer. Please select the original Squircle layer instead (not the one with '- Mask' in the name).");
                var debugMessages = DEBUG_JSX.getMessages();
                return "error|Mask layer selected|" + debugMessages.join("|");
            } else {
                DEBUG_JSX.log("No shape layer found in selection");
                alert("No shape layer found. Please select at least one shape layer.");
                var debugMessages = DEBUG_JSX.getMessages();
                return "error|No shape layer|" + debugMessages.join("|");
            }
        }

        if (otherLayers.length === 0) {
            DEBUG_JSX.error("No content layers found", "Need at least one content layer plus shape layer");
            alert("Please select at least two layers (one shape layer to define the area, and one or more layers for content).");
            var debugMessages = DEBUG_JSX.getMessages();
            return "error|No content layers|" + debugMessages.join("|");
        }

        DEBUG_JSX.log("Final selection - Shape layer: " + (shapeLayer ? shapeLayer.name : "none") + ", Content layers: " + otherLayers.length);
    
    app.beginUndoGroup("Apply Fit: " + mode);
    
    try {
        // Make shape layer visible
        shapeLayer.enabled = true;

        // CRITICAL: Clear existing relationships from content layers FIRST
        // This prevents "hidden property" errors when re-applying to already configured layers
        for (var i = 0; i < otherLayers.length; i++) {
            var contentLayer = otherLayers[i];
            try {
                if (contentLayer.parent !== null) {
                    DEBUG_JSX.log("Pre-clearing parent from: " + contentLayer.name);
                    contentLayer.parent = null;
                }
                if (contentLayer.trackMatteType !== TrackMatteType.NO_TRACK_MATTE) {
                    DEBUG_JSX.log("Pre-clearing track matte from: " + contentLayer.name);
                    contentLayer.trackMatteType = TrackMatteType.NO_TRACK_MATTE;
                }
            } catch(preClearError) {
                DEBUG_JSX.log("Could not pre-clear relationships from " + contentLayer.name + ": " + preClearError.toString());
            }
        }

        // Check if there's already an existing mask layer for this shape layer
        // Mask layer characteristics:
        // - Parented to the shape layer
        // - Is a ShapeLayer
        // - Name contains " - Mask" (to distinguish from user-parented layers)
        // Note: We don't check trackMatteType because once it's used as a matte, its type changes
        var maskLayer = null;
        for (var i = 1; i <= comp.layers.length; i++) {
            var layer = comp.layers[i];
            DEBUG_JSX.log("Checking layer '" + layer.name + "' - parent: " + (layer.parent ? layer.parent.name : "none") + ", isShapeLayer: " + (layer instanceof ShapeLayer) + ", trackMatteType: " + layer.trackMatteType);

            if (layer.parent === shapeLayer &&
                layer !== shapeLayer &&
                layer instanceof ShapeLayer &&
                layer.name.indexOf(" - Mask") !== -1) {
                maskLayer = layer;
                DEBUG_JSX.log("Found existing mask layer: " + maskLayer.name);

                // Reset scale on existing mask layer to fix any compound transform issues
                try {
                    maskLayer.property("Transform").property("Scale").setValue([100, 100]);
                    DEBUG_JSX.log("Reset existing mask scale to [100, 100]");
                } catch(scaleError) {
                    DEBUG_JSX.log("Could not reset existing mask scale: " + scaleError.toString());
                }

                break;
            }
        }

        // Create new mask layer only if none exists
        if (!maskLayer) {
            DEBUG_JSX.log("No existing mask layer found, creating new one");
            // Create the mask layer by duplicating the shape layer
            maskLayer = shapeLayer.duplicate();
            maskLayer.name = shapeLayer.name + " - Mask";

            // CRITICAL: Turn off adjustment layer if the original was one
            // Adjustment layers cannot be used as track mattes
            try {
                if (maskLayer.adjustmentLayer) {
                    DEBUG_JSX.log("Turning off adjustment layer on mask (can't use as track matte)");
                    maskLayer.adjustmentLayer = false;
                }
            } catch(adjError) {
                DEBUG_JSX.log("Could not check/set adjustment layer: " + adjError.toString());
            }

            // Clear any inherited parent or track matte from the duplicated layer
            try {
                if (maskLayer.parent !== null) {
                    DEBUG_JSX.log("Clearing inherited parent from mask layer");
                    maskLayer.parent = null;
                }
                if (maskLayer.trackMatteType !== TrackMatteType.NO_TRACK_MATTE) {
                    DEBUG_JSX.log("Clearing inherited track matte from mask layer");
                    maskLayer.trackMatteType = TrackMatteType.NO_TRACK_MATTE;
                }
            } catch(maskClearError) {
                DEBUG_JSX.log("Could not clear inherited relationships from mask layer: " + maskClearError.toString());
            }

            // Move mask layer above the original shape layer (index - 1)
            maskLayer.moveBefore(shapeLayer);

            // Clean up mask layer - clear expressions and keyframes from transform properties
            // CRITICAL: Must clear expressions BEFORE trying to remove keyframes or set values
            try {
                var transform = maskLayer.property("Transform");
                var transformProps = ["Position", "Scale", "Rotation", "Opacity", "Anchor Point"];

                // First pass: Clear all expressions
                for (var p = 0; p < transformProps.length; p++) {
                    var prop = transform.property(transformProps[p]);
                    if (prop && prop.expression !== "") {
                        DEBUG_JSX.log("Clearing expression from mask layer: " + transformProps[p]);
                        prop.expression = "";
                    }
                }

                // Second pass: Remove keyframes
                for (var p = 0; p < transformProps.length; p++) {
                    var prop = transform.property(transformProps[p]);
                    if (prop && prop.numKeys > 0) {
                        // Remove all keyframes
                        for (var k = prop.numKeys; k >= 1; k--) {
                            prop.removeKey(k);
                        }
                        DEBUG_JSX.log("Removed keyframes from mask layer: " + transformProps[p]);
                    }
                }
            } catch(keyframeError) {
                DEBUG_JSX.log("Could not clean up mask layer properties: " + keyframeError.toString());
            }

            // Parent mask layer to original shape layer
            maskLayer.parent = shapeLayer;

            // Reset position, scale, and rotation after parenting (fixes compound transform issue)
            try {
                maskLayer.property("Transform").property("Position").setValue([0, 0]);
                maskLayer.property("Transform").property("Scale").setValue([100, 100]);
                maskLayer.property("Transform").property("Rotation").setValue(0);
                DEBUG_JSX.log("Reset mask position to [0, 0], scale to [100, 100], rotation to 0 relative to parent");
            } catch(relPosError) {
                DEBUG_JSX.log("Could not reset relative position/scale/rotation: " + relPosError.toString());
            }

            // Shy the mask layer to reduce clutter
            maskLayer.shy = true;

            // Link opacity and anchor point to original shape layer using expressions
            maskLayer.property("Transform").property("Opacity").expression = "thisComp.layer(index + 1).opacity";
            maskLayer.property("Transform").property("Anchor Point").expression = "thisComp.layer(index + 1).anchorPoint";

            // CRITICAL: Clear expressions from shape path BEFORE removing effects
            // The path may have an expression that references the Squircle effect
            try {
                var maskContents = maskLayer.property("Contents");
                if (maskContents) {
                    for (var i = 1; i <= maskContents.numProperties; i++) {
                        var maskGroup = maskContents.property(i);
                        if (maskGroup && maskGroup.property("Contents")) {
                            var maskGroupContents = maskGroup.property("Contents");
                            for (var j = 1; j <= maskGroupContents.numProperties; j++) {
                                var maskProp = maskGroupContents.property(j);
                                // Clear expression from Path property
                                if (maskProp && maskProp.property("Path")) {
                                    var pathProp = maskProp.property("Path");
                                    if (pathProp && pathProp.expression !== "") {
                                        DEBUG_JSX.log("Clearing path expression from mask layer: " + maskProp.name);
                                        pathProp.expression = "";
                                    }
                                }
                            }
                        }
                    }
                }
            } catch(pathExprError) {
                DEBUG_JSX.log("Could not clear path expressions: " + pathExprError.toString());
            }

            // Clean up mask layer effects - remove ALL effects including Squircle
            var maskEffects = maskLayer.property("Effects");
            if (maskEffects && maskEffects.numProperties > 0) {
                // Go backwards to avoid index shifting issues
                for (var fx = maskEffects.numProperties; fx >= 1; fx--) {
                    var effect = maskEffects.property(fx);
                    var effectName = effect.name;
                    effect.remove();
                    DEBUG_JSX.log("Removed effect from mask layer: " + effectName);
                }
            }
            
            // Remove layer markers from mask layer
            try {
                var markers = maskLayer.property("Marker");
                if (markers && markers.numKeys > 0) {
                    // Remove all markers in reverse order to avoid index shifting
                    for (var m = markers.numKeys; m >= 1; m--) {
                        markers.removeKey(m);
                    }
                    DEBUG_JSX.log("Removed " + markers.numKeys + " markers from mask layer");
                } else {
                    DEBUG_JSX.log("No markers found on mask layer");
                }
            } catch(markerError) {
                DEBUG_JSX.log("Could not remove markers from mask layer: " + markerError.toString());
            }
        } else {
            DEBUG_JSX.log("Reusing existing mask layer: " + maskLayer.name);
        }
        
        // Link the shape path from mask layer to original layer
        try {
            // Find the shape group in both layers
            var originalContents = shapeLayer.property("Contents");
            var maskContents = maskLayer.property("Contents");
            
            if (originalContents && maskContents) {
                // Look for shape groups in both layers
                for (var i = 1; i <= maskContents.numProperties; i++) {
                    var maskGroup = maskContents.property(i);
                    
                    // Check if this is a shape group with a path
                    if (maskGroup.property("Contents")) {
                        var maskGroupContents = maskGroup.property("Contents");
                        
                        // Find the path property in the mask layer
                        for (var j = 1; j <= maskGroupContents.numProperties; j++) {
                            var maskProp = maskGroupContents.property(j);
                            
                            // Look for Path property
                            if (maskProp.matchName === "ADBE Vector Shape - Rect" || 
                                maskProp.matchName === "ADBE Vector Shape - Ellipse" ||
                                maskProp.matchName === "ADBE Vector Shape - Group") {
                                
                                // Find corresponding path in original layer
                                if (i <= originalContents.numProperties) {
                                    var originalGroup = originalContents.property(i);
                                    if (originalGroup.property("Contents")) {
                                        var originalGroupContents = originalGroup.property("Contents");
                                        
                                        // Link the path
                                        if (j <= originalGroupContents.numProperties) {
                                            var originalProp = originalGroupContents.property(j);
                                            
                                            // Link size/radius for rectangle/ellipse
                                            if (maskProp.property("Size") && originalProp.property("Size")) {
                                                maskProp.property("Size").expression = 
                                                    'thisComp.layer(index + 1).content("' + originalGroup.name + '").content("' + originalProp.name + '").size';
                                                DEBUG_JSX.log("Linked shape size property");
                                            }
                                            
                                            // Link position if it exists
                                            if (maskProp.property("Position") && originalProp.property("Position")) {
                                                maskProp.property("Position").expression = 
                                                    'thisComp.layer(index + 1).content("' + originalGroup.name + '").content("' + originalProp.name + '").position';
                                                DEBUG_JSX.log("Linked shape position property");
                                            }
                                            
                                            // Link roundness for rounded rectangles
                                            if (maskProp.property("Roundness") && originalProp.property("Roundness")) {
                                                maskProp.property("Roundness").expression = 
                                                    'thisComp.layer(index + 1).content("' + originalGroup.name + '").content("' + originalProp.name + '").roundness';
                                                DEBUG_JSX.log("Linked shape roundness property");
                                            }
                                            
                                            // For path objects (like from Squircle effect)
                                            if (maskProp.property("Path") && originalProp.property("Path")) {
                                                maskProp.property("Path").expression = 
                                                    'thisComp.layer(index + 1).content("' + originalGroup.name + '").content("' + originalProp.name + '").path';
                                                DEBUG_JSX.log("Linked shape path property");
                                            }
                                        }
                                    }
                                }
                            }
                        }
                    }
                }
            }
        } catch(pathLinkError) {
            DEBUG_JSX.log("Could not link shape paths: " + pathLinkError.toString());
            // Not critical - mask layer will still work as a duplicate
        }
        
        var fitNoneData = null;
        if (mode === "fitNone") {
            try {
                // Account for trim: sourceTime = compTime - startTime
                var fnSourceTime = comp.time - shapeLayer.startTime;
                var fnShapeBounds = shapeLayer.sourceRectAtTime(fnSourceTime, false);
                var fnShapeWidth = Math.abs(fnShapeBounds.width);
                var fnShapeHeight = Math.abs(fnShapeBounds.height);
                if (fnShapeWidth === 0) { fnShapeWidth = 1; }
                if (fnShapeHeight === 0) { fnShapeHeight = 1; }
                
                var fnCenterLocalX = fnShapeBounds.left + fnShapeBounds.width / 2;
                var fnCenterLocalY = fnShapeBounds.top + fnShapeBounds.height / 2;
                
                var fnShapeAnchor = shapeLayer.anchorPoint.value;
                if (!fnShapeAnchor || fnShapeAnchor.length < 2) {
                    fnShapeAnchor = [0, 0, 0];
                }

                // Convert shape center from layer space to comp space (handles parent transforms)
                var shapeCenterInLayerSpace = [fnCenterLocalX, fnCenterLocalY, 0];
                var shapeCenterInCompSpace = layerSpaceToCompSpace(shapeLayer, shapeCenterInLayerSpace, comp.time);
                var fnCenterCompX = shapeCenterInCompSpace[0];
                var fnCenterCompY = shapeCenterInCompSpace[1];
                var fnCenterCompZ = shapeCenterInCompSpace[2];
                
                DEBUG_JSX.log("fitNone bounds - left: " + fnShapeBounds.left + ", top: " + fnShapeBounds.top + ", width: " + fnShapeBounds.width + ", height: " + fnShapeBounds.height);
                DEBUG_JSX.log("fitNone center in shape space - x: " + fnCenterLocalX + ", y: " + fnCenterLocalY);
                DEBUG_JSX.log("fitNone shape center comp - x: " + fnCenterCompX + ", y: " + fnCenterCompY);
                
                fitNoneData = {
                    shapeBounds: fnShapeBounds,
                    shapeWidth: fnShapeWidth,
                    shapeHeight: fnShapeHeight,
                    shapeCenterLocalX: fnCenterLocalX,
                    shapeCenterLocalY: fnCenterLocalY,
                    shapeAnchor: fnShapeAnchor,
                    shapeCenterCompX: fnCenterCompX,
                    shapeCenterCompY: fnCenterCompY,
                    shapeCenterCompZ: fnCenterCompZ,
                    layerData: [],
                    idPrefix: "__AB_FIT_PAD__" + (new Date().getTime()) + "_" + Math.floor(Math.random() * 100000)
                };
            } catch(fnError) {
                DEBUG_JSX.log("fitNone setup failed: " + fnError.toString());
            }
        }
        
        // Process each other layer (content layers only, not the shape layer)
        for (var layerIndex = 0; layerIndex < otherLayers.length; layerIndex++) {
            var otherLayer = otherLayers[layerIndex];
            
            DEBUG_JSX.log("Processing layer " + layerIndex + ": " + otherLayer.name + " (mode: " + mode + ")");
            
            // Skip individual layer processing for fitNone - we'll handle everything after precomp
            if (mode === "fitNone") {
                DEBUG_JSX.log("Skipping individual processing for fitNone mode");
                if (fitNoneData) {
                    try {
                        var originalComponents = getLayerPositionComponents(otherLayer);
                        var uniqueId = fitNoneData.idPrefix + "_" + layerIndex;
                        var originalComment = "";
                        try {
                            originalComment = otherLayer.comment || "";
                            otherLayer.comment = uniqueId;
                        } catch(commentError) {
                            DEBUG_JSX.log("fitNone could not tag comment for '" + otherLayer.name + "': " + commentError.toString());
                        }
                        fitNoneData.layerData.push({
                            id: uniqueId,
                            name: otherLayer.name,
                            position: originalComponents,
                            originalComment: originalComment,
                            label: otherLayer.label,
                            startTime: otherLayer.startTime
                        });
                        DEBUG_JSX.log("fitNone recorded '" + otherLayer.name + "' comp position: " + Math.round(originalComponents[0]) + ", " + Math.round(originalComponents[1]));
                    } catch(prePosError) {
                        DEBUG_JSX.log("fitNone could not log position for '" + otherLayer.name + "': " + prePosError.toString());
                    }
                }
                continue;
            }
            
            // Skip if this is somehow the shape layer (safety check)
            if (otherLayer === shapeLayer) {
                DEBUG_JSX.log("Skipping shape layer in content processing: " + otherLayer.name);
                continue;
            }
            
            DEBUG_JSX.log("Applying FitToShape to content layer: " + otherLayer.name);
            
            // Parent the other layer to the shape layer (not the mask layer)
            otherLayer.parent = shapeLayer;

            // Reset rotation to 0 after parenting (prevents double-rotation when parent animates)
            try {
                otherLayer.property("Transform").property("Rotation").setValue(0);
                DEBUG_JSX.log("Reset content layer rotation to 0 relative to parent");
            } catch(rotError) {
                DEBUG_JSX.log("Could not reset content layer rotation: " + rotError.toString());
            }

            // Set up track matte using the MASK layer (not the original shape layer)
            otherLayer.setTrackMatte(maskLayer, TrackMatteType.ALPHA);
            
            // Make layer visible
            otherLayer.enabled = true;
            
            // Shape layer stays visible, mask layer is auto-hidden by track matte
            shapeLayer.enabled = true;
            
            // Split dimensions on position for the other layer
            if (!otherLayer.property("Transform").property("Position").dimensionsSeparated) {
                otherLayer.property("Transform").property("Position").dimensionsSeparated = true;
            }
            
            // Add Fit to shape effect for fitWidth mode
            if (mode === "fitWidth") {
                // Double-check this isn't the shape layer
                if (otherLayer === shapeLayer) {
                    DEBUG_JSX.error("CRITICAL: Shape layer reached effect application", "Layer: " + otherLayer.name);
                    continue;
                }
                
                var effects = otherLayer.property("Effects");
                
                // Check if Fit to shape effect already exists
                var fitEffect = null;
                for (var j = 1; j <= effects.numProperties; j++) {
                    var effectName = effects.property(j).name;
                    if (effectName === "Fit to shape" || effectName === "Fit to shape - v3") {
                        fitEffect = effects.property(j);
                        // Rename it to what our expressions expect
                        if (effectName === "Fit to shape - v3") {
                            fitEffect.name = "Fit to shape";
                        }
                        break;
                    }
                }
                
                // Debug: Log current state
                DEBUG_JSX.log("Layer " + otherLayer.name + " has " + effects.numProperties + " effects, fitEffect found: " + (fitEffect ? "yes" : "no"));
                
                // Try to add the effect using the preset file
                if (!fitEffect) {
                    try {
                        // Import the FitToShape preset from assets/presets
                        var presetPath = extensionRoot + "/assets/presets/FitToShape.ffx";
                        var presetFile = new File(presetPath);
                        
                        // Check alternate path separator
                        if (!presetFile.exists) {
                            presetPath = extensionRoot + "\\assets\\presets\\FitToShape.ffx";
                            presetFile = new File(presetPath);
                        }
                        
                        if (presetFile.exists) {
                            // Count effects before applying preset
                            var effectCountBefore = effects.numProperties;
                            DEBUG_JSX.log("Before preset: " + effectCountBefore + " effects");
                            
                            // Clear all layer selections before applying preset to prevent affecting other layers
                            try {
                                for (var clearIdx = 1; clearIdx <= comp.numLayers; clearIdx++) {
                                    comp.layer(clearIdx).selected = false;
                                }
                                // Select only the target layer
                                otherLayer.selected = true;
                                DEBUG_JSX.log("Cleared selections, only targeting: " + otherLayer.name);
                            } catch(selectionError) {
                                DEBUG_JSX.log("Selection clearing error: " + selectionError.toString());
                            }
                            
                            // Apply the preset to the layer
                            otherLayer.applyPreset(presetFile);
                            
                            DEBUG_JSX.log("After preset: " + effects.numProperties + " effects");
                            
                            // Find the first newly applied "Fit to shape" effect
                            for (var k = effectCountBefore + 1; k <= effects.numProperties; k++) {
                                var effectName = effects.property(k).name;
                                DEBUG_JSX.log("Checking effect " + k + ": " + effectName);
                                if (effectName === "Fit to shape - v3" || effectName === "Fit to shape" || effectName.indexOf("Fit to shape") === 0) {
                                    fitEffect = effects.property(k);
                                    // Force rename to exact name we need
                                    try {
                                        fitEffect.name = "Fit to shape";
                                        DEBUG_JSX.log("Renamed effect to: " + fitEffect.name);
                                    } catch(renameError) {
                                        DEBUG_JSX.error("Failed to rename effect", renameError.toString());
                                    }
                                    break;
                                }
                            }
                            
                            // Remove any duplicate "Fit to shape" effects that may have been added
                            // Only remove effects that haven't been renamed yet (still have original names)
                            for (var m = effects.numProperties; m >= effectCountBefore + 1; m--) {
                                try {
                                    var currentEffect = effects.property(m);
                                    var effectName = currentEffect.name;
                                    // Only remove effects with original names, not the renamed one
                                    if ((effectName === "Fit to shape - v3" || effectName === "Fit to shape 2" || effectName === "Fit to shape 3") && currentEffect !== fitEffect) {
                                        DEBUG_JSX.log("Removing duplicate effect: " + effectName + " (index: " + m + ")");
                                        currentEffect.remove();
                                    }
                                } catch(removeError) {
                                    DEBUG_JSX.log("Error removing effect at index " + m + ": " + removeError.toString());
                                }
                            }
                            
                            // If we still don't have the effect, log error but don't create fallback
                            if (!fitEffect) {
                                DEBUG_JSX.error("Preset failed and no effect found", "Layer: " + otherLayer.name);
                                // Don't create fallback effects - this causes the duplicate effects problem
                            }
                        } else {
                            DEBUG_JSX.error("Preset file not found", "Path: " + presetPath);
                            // Don't create fallback effects - rely on preset file being present
                        }
                    } catch (e) {
                        DEBUG_JSX.error("Exception during preset application", e.toString());
                        // Don't create fallback effects - this causes duplicate effects
                    }
                }
            }
            
            // Store initial dimensions for reference
            var otherWidth, otherHeight;
            if (otherLayer instanceof TextLayer || otherLayer instanceof ShapeLayer) {
                // Account for trim: sourceTime = compTime - startTime
                var otherSourceTime = comp.time - otherLayer.startTime;
                var layerRect = otherLayer.sourceRectAtTime(otherSourceTime, false);
                otherWidth = layerRect.width;
                otherHeight = layerRect.height;
            } else {
                otherWidth = otherLayer.width;
                otherHeight = otherLayer.height;
            }
            
            // Apply expressions based on mode
            if (mode === "fitWidth") {
                // Scale expression that respects Scale To dropdown
                var scaleExpr = [
                    "var shapeLayer = parent;",
                    "// Account for trim: sourceTime = compTime - startTime",
                    "var sourceTime = time - shapeLayer.startTime;",
                    "var shapeBounds = shapeLayer.sourceRectAtTime(sourceTime, false);",
                    "var shapeWidth = shapeBounds.width;",
                    "var shapeHeight = shapeBounds.height;",
                    "var myWidth = " + otherWidth + ";",
                    "var myHeight = " + otherHeight + ";",
                    "var baseScale = value;",
                    "",
                    "// Get Scale To value from effect",
                    "var scaleToValue;",
                    "try {",
                    "  scaleToValue = effect(\"Fit to shape\")(\"Scale To\");",
                    "} catch(e) {",
                    "  try {",
                    "    scaleToValue = effect(\"Fit to shape - Scale To\")(\"Menu\");",
                    "  } catch(e2) {",
                    "    scaleToValue = 1; // Default to Width",
                    "  }",
                    "}",
                    "",
                    "// Scale based on Scale To setting",
                    "// 1 = Width, 2 = Height, 3 = Stretch, 4 = None",
                    "var scaleX, scaleY;",
                    "if (scaleToValue == 1) { // Width",
                    "  var scaleFactor = (shapeWidth / myWidth) * 100;",
                    "  scaleX = scaleY = scaleFactor;",
                    "} else if (scaleToValue == 2) { // Height",
                    "  var scaleFactor = (shapeHeight / myHeight) * 100;",
                    "  scaleX = scaleY = scaleFactor;",
                    "} else if (scaleToValue == 3) { // Stretch",
                    "  scaleX = (shapeWidth / myWidth) * 100;",
                    "  scaleY = (shapeHeight / myHeight) * 100;",
                    "} else { // None",
                    "  scaleX = scaleY = 100;",
                    "}",
                    "",
                    "[scaleX, scaleY] + (baseScale - [100, 100]);"
                ].join("\n");
                
                otherLayer.property("Transform").property("Scale").expression = scaleExpr;
                
                // X Position expression with 9-point alignment
                var xPosExpr = [
                    "var shapeLayer = parent;",
                    "// Account for trim: sourceTime = compTime - startTime",
                    "var sourceTime = time - shapeLayer.startTime;",
                    "var shapeBounds = shapeLayer.sourceRectAtTime(sourceTime, false);",
                    "var myScale = transform.scale[0] / 100;",
                    "var myWidth = " + otherWidth + " * myScale;",
                    "",
                    "// Get alignment value from effect",
                    "var alignmentValue;",
                    "try {",
                    "  alignmentValue = effect(\"Fit to shape\")(\"Alignment\");",
                    "} catch(e) {",
                    "  try {",
                    "    alignmentValue = effect(\"Fit to shape - Alignment\")(\"Menu\");",
                    "  } catch(e2) {",
                    "    alignmentValue = 1; // Default to Center",
                    "  }",
                    "}",
                    "",
                    "// Calculate X position based on alignment",
                    "var xPos;",
                    "if (alignmentValue == 2 || alignmentValue == 6 || alignmentValue == 10) {",
                    "  // Left alignment",
                    "  xPos = shapeBounds.left + myWidth/2;",
                    "} else if (alignmentValue == 3 || alignmentValue == 7 || alignmentValue == 11) {",
                    "  // Right alignment", 
                    "  xPos = shapeBounds.left + shapeBounds.width - myWidth/2;",
                    "} else {",
                    "  // Center alignment",
                    "  xPos = shapeBounds.left + shapeBounds.width/2;",
                    "}",
                    "",
                    "// Allow manual animation",
                    "if (numKeys > 0) {",
                    "  xPos + (value - valueAtTime(key(1).time));",
                    "} else {",
                    "  xPos;",
                    "}"
                ].join("\n");
                
                // Y Position expression with 9-point alignment
                var yPosExpr = [
                    "var shapeLayer = parent;",
                    "// Account for trim: sourceTime = compTime - startTime",
                    "var sourceTime = time - shapeLayer.startTime;",
                    "var shapeBounds = shapeLayer.sourceRectAtTime(sourceTime, false);",
                    "var myScale = transform.scale[1] / 100;",
                    "var myHeight = " + otherHeight + " * myScale;",
                    "",
                    "// Get alignment value from effect",
                    "var alignmentValue;",
                    "try {",
                    "  alignmentValue = effect(\"Fit to shape\")(\"Alignment\");",
                    "} catch(e) {",
                    "  try {",
                    "    alignmentValue = effect(\"Fit to shape - Alignment\")(\"Menu\");",
                    "  } catch(e2) {",
                    "    alignmentValue = 1; // Default to Center",
                    "  }",
                    "}",
                    "",
                    "// Calculate Y position based on alignment",
                    "var yPos;",
                    "if (alignmentValue >= 5 && alignmentValue <= 7) {",
                    "  // Top alignment",
                    "  yPos = shapeBounds.top + myHeight/2;",
                    "} else if (alignmentValue >= 9 && alignmentValue <= 11) {",
                    "  // Bottom alignment",
                    "  yPos = shapeBounds.top + shapeBounds.height - myHeight/2;",
                    "} else {",
                    "  // Center alignment",
                    "  yPos = shapeBounds.top + shapeBounds.height/2;",
                    "}",
                    "",
                    "// Allow manual animation",
                    "if (numKeys > 0) {",
                    "  yPos + (value - valueAtTime(key(1).time));",
                    "} else {",
                    "  yPos;",
                    "}"
                ].join("\n");
                
                otherLayer.property("Transform").property("X Position").expression = xPosExpr;
                otherLayer.property("Transform").property("Y Position").expression = yPosExpr;
            }
        } // End of loop for each other layer
        
        // Handle fitNone mode with precomp (Layers + Padding functionality)
        if (mode === "fitNone" && otherLayers.length > 0) {
            // Get shape info - account for trim
            var shapeSourceTime = comp.time - shapeLayer.startTime;
            var shapeBounds = shapeLayer.sourceRectAtTime(shapeSourceTime, false);
            DEBUG_JSX.log("fitNone bounds - left: " + shapeBounds.left + ", top: " + shapeBounds.top + ", width: " + shapeBounds.width + ", height: " + shapeBounds.height);
            
            var shapeWidth = Math.abs(shapeBounds.width);
            var shapeHeight = Math.abs(shapeBounds.height);
            if (shapeWidth === 0) { shapeWidth = 1; }
            if (shapeHeight === 0) { shapeHeight = 1; }
            
            // Determine the visual center of the squircle in layer space (relative to the shape anchor)
            var shapeCenterLocalX = shapeBounds.left + shapeBounds.width/2;
            var shapeCenterLocalY = shapeBounds.top + shapeBounds.height/2;
            DEBUG_JSX.log("fitNone center in shape space - x: " + shapeCenterLocalX + ", y: " + shapeCenterLocalY);
            
            var shapeAnchorVal = shapeLayer.anchorPoint.value;
            if (!shapeAnchorVal || shapeAnchorVal.length < 2) {
                shapeAnchorVal = [0, 0, 0];
            }

            // Convert shape center from layer space to comp space (handles parent transforms)
            var shapeCenterInLayerSpace = [shapeCenterLocalX, shapeCenterLocalY, 0];
            var shapeCenterInCompSpace = layerSpaceToCompSpace(shapeLayer, shapeCenterInLayerSpace, comp.time);
            var shapeCenterCompX = shapeCenterInCompSpace[0];
            var shapeCenterCompY = shapeCenterInCompSpace[1];
            var shapeCenterCompZ = shapeCenterInCompSpace[2];
            DEBUG_JSX.log("fitNone shape center comp - x: " + shapeCenterCompX + ", y: " + shapeCenterCompY);
            
            // Collect all other layers for precomposing and capture original positions
            var validLayers = otherLayers;
            var precomposeLayerData = [];
            var precomposeIdPrefix = "__AB_FIT_PAD__" + (new Date().getTime()) + "_" + Math.floor(Math.random() * 100000);
            
            if (validLayers.length === 0) {
                alert("No layers to precompose");
                return;
            }
            
            // Collect indices for precompose
            var indices = [];
            for (var i = 0; i < validLayers.length; i++) {
                indices.push(validLayers[i].index);
            }
            
            // Precompose the layers with "Move all attributes"
            var precompName = shapeLayer.name + " - Content";
            
            // Store the lowest index before precomposing to find the precomp after
            var lowestIndex = Infinity;
            for (var i = 0; i < indices.length; i++) {
                if (indices[i] < lowestIndex) {
                    lowestIndex = indices[i];
                }
            }
            
            comp.layers.precompose(indices, precompName, true);
            
            // Get the precomp layer
            var precomp = comp.layer(lowestIndex);

            // Apply label and startTime from original layers
            if (precomp && fitNoneData && fitNoneData.layerData.length > 0) {
                // Use the first layer's label (topmost selected layer)
                var firstLayerLabel = fitNoneData.layerData[0].label;
                if (firstLayerLabel !== undefined && firstLayerLabel !== null) {
                    precomp.label = firstLayerLabel;
                    DEBUG_JSX.log("fitNone applied label " + firstLayerLabel + " to precomp");
                }

                // Use the earliest startTime among all precomposed layers
                var earliestStartTime = fitNoneData.layerData[0].startTime;
                for (var st = 1; st < fitNoneData.layerData.length; st++) {
                    if (fitNoneData.layerData[st].startTime < earliestStartTime) {
                        earliestStartTime = fitNoneData.layerData[st].startTime;
                    }
                }
                precomp.startTime = earliestStartTime;
                DEBUG_JSX.log("fitNone set precomp startTime to " + earliestStartTime);
            }

            // Make sure precomp was created and resize its composition
            if (precomp && precomp.source) {
                var precompComp = precomp.source;
                
                // Resize the precomp to match the shape size
                precompComp.width = Math.ceil(shapeWidth);
                precompComp.height = Math.ceil(shapeHeight);
                DEBUG_JSX.log("fitNone precomp resized - w: " + precompComp.width + ", h: " + precompComp.height);
                
                // Prepare lookup for stored layer data
                var layerDataMap = {};
                for (var dataIdx = 0; dataIdx < fitNoneData.layerData.length; dataIdx++) {
                    var entry = fitNoneData.layerData[dataIdx];
                    layerDataMap[entry.id] = entry;
                }
                
                // Set precomp anchor to center of new size
                precomp.anchorPoint.setValue([precompComp.width/2, precompComp.height/2]);
                
                // Recenter each content layer inside the precomp to match original comp-space positions
                for (var j = 1; j <= precompComp.numLayers; j++) {
                    var innerLayer = precompComp.layer(j);
                    if (!innerLayer) { continue; }
                    
                    var lookupId = innerLayer.comment || "";
                    var storedInfo = layerDataMap[lookupId];
                    if (!storedInfo) {
                        DEBUG_JSX.log("fitNone no stored data for layer '" + innerLayer.name + "' (comment: " + lookupId + ")");
                        continue;
                    }
                    
                    var storedPos = storedInfo.position;
                    var newX = (precompComp.width / 2) + (storedPos[0] - shapeCenterCompX);
                    var newY = (precompComp.height / 2) + (storedPos[1] - shapeCenterCompY);
                    var newZ = storedPos[2];
                    
                    setLayerPositionComponents(innerLayer, newX, newY, newZ);
                    DEBUG_JSX.log("fitNone recentered '" + innerLayer.name + "' to: " + Math.round(newX) + ", " + Math.round(newY));

                    // Adjust inner layer's startTime relative to earliest layer (so layers start at beginning of precomp)
                    if (storedInfo.startTime !== undefined) {
                        // Calculate earliest startTime from all layer data
                        var earliestStart = fitNoneData.layerData[0].startTime;
                        for (var es = 1; es < fitNoneData.layerData.length; es++) {
                            if (fitNoneData.layerData[es].startTime < earliestStart) {
                                earliestStart = fitNoneData.layerData[es].startTime;
                            }
                        }
                        // Offset this layer's startTime so earliest layer starts at 0
                        innerLayer.startTime = storedInfo.startTime - earliestStart;
                        DEBUG_JSX.log("fitNone adjusted '" + innerLayer.name + "' startTime to " + innerLayer.startTime);
                    }

                    // Restore original comment
                    try {
                        innerLayer.comment = storedInfo.originalComment || "";
                    } catch(commentRestoreError) {
                        // Ignore if comment restoration fails
                    }
                    
                    delete layerDataMap[lookupId];
                }
                
                for (var remainingId in layerDataMap) {
                    if (layerDataMap.hasOwnProperty(remainingId)) {
                        DEBUG_JSX.log("fitNone warning: unmatched precompose data id " + remainingId);
                    }
                }
                
                // Parent the precomp to the shape layer and position it so the visual content stays put
                precomp.parent = shapeLayer;
                
                var parentSpacePos = [
                    shapeCenterLocalX - shapeAnchorVal[0],
                    shapeCenterLocalY - shapeAnchorVal[1]
                ];
                DEBUG_JSX.log("fitNone parent space position - x: " + parentSpacePos[0] + ", y: " + parentSpacePos[1]);
                setLayerPositionComponents(precomp, parentSpacePos[0], parentSpacePos[1], shapeCenterCompZ);
                
                // Set collapse transformations
                precomp.collapseTransformation = true;
                
                // Set up track matte using the MASK layer (not the original shape layer)
                try {
                    precomp.setTrackMatte(maskLayer, TrackMatteType.ALPHA);
                } catch (e) {
                    precomp.trackMatteType = TrackMatteType.ALPHA;
                }
                
                // Enable visibility
                shapeLayer.enabled = true;
                precomp.enabled = true;
                
                // Split position dimensions
                if (!precomp.property("Transform").property("Position").dimensionsSeparated) {
                    precomp.property("Transform").property("Position").dimensionsSeparated = true;
                }
                
                // Add Fit to shape effect to precomp
                var effects = precomp.property("Effects");
                
                // Check if effect already exists first
                var fitEffect = null;
                for (var j = 1; j <= effects.numProperties; j++) {
                    var effectName = effects.property(j).name;
                    if (effectName === "Fit to shape" || effectName === "Fit to shape - v3") {
                        fitEffect = effects.property(j);
                        if (effectName === "Fit to shape - v3") {
                            fitEffect.name = "Fit to shape";
                        }
                        break;
                    }
                }
                
                if (!fitEffect) {
                    try {
                        // Import the FitToShape preset from assets/presets
                        var presetPath = extensionRoot + "/assets/presets/FitToShape.ffx";
                        var presetFile = new File(presetPath);
                        
                        // Check alternate path separator
                        if (!presetFile.exists) {
                            presetPath = extensionRoot + "\\assets\\presets\\FitToShape.ffx";
                            presetFile = new File(presetPath);
                        }
                        
                        if (presetFile.exists) {
                            // Count effects before applying preset
                            var effectCountBefore = effects.numProperties;
                            DEBUG_JSX.log("Precomp before preset: " + effectCountBefore + " effects");
                            
                            // Apply the preset to the precomp
                            precomp.applyPreset(presetFile);
                            
                            DEBUG_JSX.log("Precomp after preset: " + effects.numProperties + " effects");
                            
                            // Find the first newly applied "Fit to shape" effect
                            for (var k = effectCountBefore + 1; k <= effects.numProperties; k++) {
                                var effectName = effects.property(k).name;
                                DEBUG_JSX.log("Checking precomp effect " + k + ": " + effectName);
                                if (effectName === "Fit to shape - v3" || effectName === "Fit to shape" || effectName.indexOf("Fit to shape") === 0) {
                                    fitEffect = effects.property(k);
                                    // Force rename to exact name we need
                                    try {
                                        fitEffect.name = "Fit to shape";
                                        DEBUG_JSX.log("Renamed precomp effect to: " + fitEffect.name);
                                    } catch(renameError) {
                                        DEBUG_JSX.error("Failed to rename precomp effect", renameError.toString());
                                    }
                                    break;
                                }
                            }
                            
                            // Remove any duplicate "Fit to shape" effects that may have been added
                            // Only remove effects that haven't been renamed yet (still have original names)
                            for (var m = effects.numProperties; m >= effectCountBefore + 1; m--) {
                                try {
                                    var currentEffect = effects.property(m);
                                    var effectName = currentEffect.name;
                                    // Only remove effects with original names, not the renamed one
                                    if ((effectName === "Fit to shape - v3" || effectName === "Fit to shape 2" || effectName === "Fit to shape 3") && currentEffect !== fitEffect) {
                                        DEBUG_JSX.log("Removing duplicate precomp effect: " + effectName + " (index: " + m + ")");
                                        currentEffect.remove();
                                    }
                                } catch(removeError) {
                                    DEBUG_JSX.log("Error removing precomp effect at index " + m + ": " + removeError.toString());
                                }
                            }
                            
                            // If we still don't have the effect, log error but don't create fallback
                            if (!fitEffect) {
                                DEBUG_JSX.error("Precomp preset failed and no effect found", "Precomp: " + precomp.name);
                                // Don't create fallback effects - this causes the duplicate effects problem
                            }
                        } else {
                            DEBUG_JSX.error("Precomp preset file not found", "Path: " + presetPath);
                            // Don't create fallback effects - rely on preset file being present
                        }
                    } catch (e) {
                        DEBUG_JSX.error("Exception during precomp preset application", e.toString());
                        // Don't create fallback effects - this causes duplicate effects
                    }
                }
                
                // Get precomp actual content size - account for trim
                var precompSourceTime = comp.time - precomp.startTime;
                var precompBounds = precomp.sourceRectAtTime(precompSourceTime, false);
                var precompWidth = precompBounds.width;
                var precompHeight = precompBounds.height;
                
                // Calculate padding
                var padding = (shapeWidth - precompWidth) / 2;
                
                // Scale expression that respects Scale To dropdown
                var scaleExpr = [
                    "var shapeLayer = parent;",
                    "// Account for trim: sourceTime = compTime - startTime",
                    "var sourceTime = time - shapeLayer.startTime;",
                    "var shapeBounds = shapeLayer.sourceRectAtTime(sourceTime, false);",
                    "var shapeWidth = shapeBounds.width;",
                    "var shapeHeight = shapeBounds.height;",
                    "var originalWidth = " + precompWidth + ";",
                    "var originalHeight = " + precompHeight + ";",
                    "var padding = " + padding + ";",
                    "var baseScale = value;",
                    "",
                    "// Get Scale To value from effect",
                    "var scaleToValue;",
                    "try {",
                    "  scaleToValue = effect(\"Fit to shape\")(\"Scale To\");",
                    "} catch(e) {",
                    "  try {",
                    "    scaleToValue = effect(\"Fit to shape - Scale To\")(\"Menu\");",
                    "  } catch(e2) {",
                    "    scaleToValue = 1; // Default to Width",
                    "  }",
                    "}",
                    "",
                    "// Scale based on Scale To setting",
                    "// 1 = Width, 2 = Height, 3 = Stretch, 4 = None",
                    "var scaleX, scaleY;",
                    "if (scaleToValue == 1) { // Width",
                    "  var targetWidth = shapeWidth - (padding * 2);",
                    "  var scaleFactor = (targetWidth / originalWidth) * 100;",
                    "  scaleFactor = Math.max(0, scaleFactor);",
                    "  scaleX = scaleY = scaleFactor;",
                    "} else if (scaleToValue == 2) { // Height",
                    "  var targetHeight = shapeHeight - (padding * 2);",
                    "  var scaleFactor = (targetHeight / originalHeight) * 100;",
                    "  scaleFactor = Math.max(0, scaleFactor);",
                    "  scaleX = scaleY = scaleFactor;",
                    "} else if (scaleToValue == 3) { // Stretch",
                    "  var targetWidth = shapeWidth - (padding * 2);",
                    "  var targetHeight = shapeHeight - (padding * 2);",
                    "  scaleX = Math.max(0, (targetWidth / originalWidth) * 100);",
                    "  scaleY = Math.max(0, (targetHeight / originalHeight) * 100);",
                    "} else { // None",
                    "  scaleX = scaleY = 100;",
                    "}",
                    "",
                    "[scaleX, scaleY] + (baseScale - [100, 100]);"
                ].join("\n");
                
                precomp.property("Transform").property("Scale").expression = scaleExpr;
                
                // X Position with 9-point alignment
                var xPosExpr = [
                    "var shapeLayer = parent;",
                    "// Account for trim: sourceTime = compTime - startTime",
                    "var sourceTime = time - shapeLayer.startTime;",
                    "var shapeBounds = shapeLayer.sourceRectAtTime(sourceTime, false);",
                    "var myScale = transform.scale[0] / 100;",
                    "var myWidth = " + precompWidth + " * myScale;",
                    "",
                    "// Get alignment value from effect",
                    "var alignmentValue;",
                    "try {",
                    "  alignmentValue = effect(\"Fit to shape\")(\"Alignment\");",
                    "} catch(e) {",
                    "  try {",
                    "    alignmentValue = effect(\"Fit to shape - Alignment\")(\"Menu\");",
                    "  } catch(e2) {",
                    "    alignmentValue = 1; // Default to Center",
                    "  }",
                    "}",
                    "",
                    "// Calculate X position based on alignment",
                    "var xPos;",
                    "if (alignmentValue == 2 || alignmentValue == 6 || alignmentValue == 10) {",
                    "  // Left alignment",
                    "  xPos = shapeBounds.left + myWidth/2;",
                    "} else if (alignmentValue == 3 || alignmentValue == 7 || alignmentValue == 11) {",
                    "  // Right alignment",
                    "  xPos = shapeBounds.left + shapeBounds.width - myWidth/2;",
                    "} else {",
                    "  // Center alignment",
                    "  xPos = shapeBounds.left + shapeBounds.width/2;",
                    "}",
                    "",
                    "if (numKeys > 0) {",
                    "  xPos + (value - valueAtTime(key(1).time));",
                    "} else {",
                    "  xPos;",
                    "}"
                ].join("\n");
                
                // Y Position with 9-point alignment
                var yPosExpr = [
                    "var shapeLayer = parent;",
                    "// Account for trim: sourceTime = compTime - startTime",
                    "var sourceTime = time - shapeLayer.startTime;",
                    "var shapeBounds = shapeLayer.sourceRectAtTime(sourceTime, false);",
                    "var myScale = transform.scale[1] / 100;",
                    "var myHeight = " + precompHeight + " * myScale;",
                    "",
                    "// Get alignment value from effect",
                    "var alignmentValue;",
                    "try {",
                    "  alignmentValue = effect(\"Fit to shape\")(\"Alignment\");",
                    "} catch(e) {",
                    "  try {",
                    "    alignmentValue = effect(\"Fit to shape - Alignment\")(\"Menu\");",
                    "  } catch(e2) {",
                    "    alignmentValue = 1; // Default to Center",
                    "  }",
                    "}",
                    "",
                    "// Calculate Y position based on alignment",
                    "var yPos;",
                    "if (alignmentValue >= 5 && alignmentValue <= 7) {",
                    "  // Top alignment",
                    "  yPos = shapeBounds.top + myHeight/2;",
                    "} else if (alignmentValue >= 9 && alignmentValue <= 11) {",
                    "  // Bottom alignment",
                    "  yPos = shapeBounds.top + shapeBounds.height - myHeight/2;",
                    "} else {",
                    "  // Center alignment",
                    "  yPos = shapeBounds.top + shapeBounds.height/2;",
                    "}",
                    "",
                    "if (numKeys > 0) {",
                    "  yPos + (value - valueAtTime(key(1).time));",
                    "} else {",
                    "  yPos;",
                    "}"
                ].join("\n");
                
                precomp.property("Transform").property("X Position").expression = xPosExpr;
                precomp.property("Transform").property("Y Position").expression = yPosExpr;
            }
        }
        
        // Restore original selection
        try {
            for (var restoreIdx = 1; restoreIdx <= comp.numLayers; restoreIdx++) {
                comp.layer(restoreIdx).selected = false;
            }
            // Restore original selection
            shapeLayer.selected = true;
            for (var k = 0; k < otherLayers.length; k++) {
                otherLayers[k].selected = true;
            }
            DEBUG_JSX.log("Restored original layer selection");
        } catch(restoreError) {
            DEBUG_JSX.log("Selection restore error: " + restoreError.toString());
        }
        
        DEBUG_JSX.log("FitToShape operation completed successfully");

        // Include debug messages in result
        var debugMessages = DEBUG_JSX.getMessages();
        return "success|Applied " + mode + " to " + otherLayers.length + " layers|" + debugMessages.join("|");

    } catch (error) {
        DEBUG_JSX.error("FitToShape operation failed", error.toString());
        alert("Error: " + error.toString());
        var debugMessages = DEBUG_JSX.getMessages();
        return "error|" + error.toString() + "|" + debugMessages.join("|");
    } finally {
        app.endUndoGroup();
    }
    } catch(mainError) {
        DEBUG_JSX.error("Main function error", mainError.toString());
        var debugMessages = DEBUG_JSX.getMessages();
        return "error|" + mainError.toString() + "|" + debugMessages.join("|");
    }
}

// Add nulls/guides to selected shape layer
function addNulls(nullType) {
    var comp = app.project.activeItem;
    if (!(comp && comp instanceof CompItem)) {
        alert("Please select a comp with a shape layer.");
        return;
    }

    // Handle FitToShape functionality first (these don't need the single layer validation)
    if (nullType === "layers") {
        // Fit to width functionality (equivalent to FitToShape "fit to width")
        // This requires multiple layers selected (shape + content)
        return applyFitToShape("fitWidth");
    } else if (nullType === "layers-padding") {
        // Fit original size functionality (equivalent to FitToShape "fit original size")
        // This requires multiple layers selected (shape + content)
        return applyFitToShape("fitNone");
    }

    // The rest of this function is only for vertex-nulls
    var sel = comp.selectedLayers;
    if (sel.length !== 1) {
        alert("Select exactly one shape layer.");
        return;
    }

    var baseLayer = sel[0];
    var baseName = baseLayer.name;

    app.beginUndoGroup("Add Vertex Nulls");

    // Define points based on nullType
    var points = [];
    
    if (nullType === "vertex-nulls") {
        // All 9 vertex points: 4 corners + 5 midpoints
        points = [
            // Corners
            { name: "Top Left",     exprX: "r.left", exprY: "r.top" },
            { name: "Top Right",    exprX: "r.left + r.width", exprY: "r.top" },
            { name: "Bottom Left",  exprX: "r.left", exprY: "r.top + r.height" },
            { name: "Bottom Right", exprX: "r.left + r.width", exprY: "r.top + r.height" },
            // Midpoints
            { name: "Top",     exprX: "r.left + r.width/2", exprY: "r.top" },
            { name: "Left",    exprX: "r.left", exprY: "r.top + r.height/2" },
            { name: "Center",  exprX: "r.left + r.width/2", exprY: "r.top + r.height/2" },
            { name: "Right",   exprX: "r.left + r.width", exprY: "r.top + r.height/2" },
            { name: "Bottom",  exprX: "r.left + r.width/2", exprY: "r.top + r.height" }
        ];
    } else if (nullType === "midpoints") {
        // Legacy support: Midpoints only
        points = [
            { name: "Top",     exprX: "r.left + r.width/2", exprY: "r.top" },
            { name: "Left",    exprX: "r.left", exprY: "r.top + r.height/2" },
            { name: "Center",  exprX: "r.left + r.width/2", exprY: "r.top + r.height/2" },
            { name: "Right",   exprX: "r.left + r.width", exprY: "r.top + r.height/2" },
            { name: "Bottom",  exprX: "r.left + r.width/2", exprY: "r.top + r.height" }
        ];
    } else if (nullType === "corners") {
        // Legacy support: Corners only
        points = [
            { name: "Top Left",     exprX: "r.left", exprY: "r.top" },
            { name: "Top Right",    exprX: "r.left + r.width", exprY: "r.top" },
            { name: "Bottom Left",  exprX: "r.left", exprY: "r.top + r.height" },
            { name: "Bottom Right", exprX: "r.left + r.width", exprY: "r.top + r.height" }
        ];
    }

    function guideExists(layerName) {
        for (var i = 1; i <= comp.numLayers; i++) {
            if (comp.layer(i).name === layerName) {
                return true;
            }
        }
        return false;
    }

    function makeGuide(name, exprX, exprY) {
        var guideName = baseName + " - " + name;
        if (guideExists(guideName)) {
            return null; // skip if already exists
        }

        var shapeLayer = comp.layers.addShape();
        shapeLayer.name = guideName;
        shapeLayer.guideLayer = true;

        var contents = shapeLayer.property("Contents");

        // Horizontal crosshair line
        var horiz = contents.addProperty("ADBE Vector Shape - Group");
        var horizShape = new Shape();
        horizShape.vertices = [[-10,0],[10,0]];
        horizShape.inTangents = [[0,0],[0,0]];
        horizShape.outTangents = [[0,0],[0,0]];
        horizShape.closed = false;
        horiz.property("Path").setValue(horizShape);

        var horizStroke = contents.addProperty("ADBE Vector Graphic - Stroke");
        horizStroke.property("Color").setValue([1,0.5,0]); // orange
        horizStroke.property("Stroke Width").setValue(2);

        // Vertical crosshair line
        var vert = contents.addProperty("ADBE Vector Shape - Group");
        var vertShape = new Shape();
        vertShape.vertices = [[0,-10],[0,10]];
        vertShape.inTangents = [[0,0],[0,0]];
        vertShape.outTangents = [[0,0],[0,0]];
        vertShape.closed = false;
        vert.property("Path").setValue(vertShape);

        var vertStroke = contents.addProperty("ADBE Vector Graphic - Stroke");
        vertStroke.property("Color").setValue([1,0.5,0]);
        vertStroke.property("Stroke Width").setValue(2);

        // Parent the null guide to the shape layer so it follows rotations and scaling
        shapeLayer.parent = baseLayer;
        
        // Position expressions - now working in parent space (relative to shape layer)
        var pos = shapeLayer.property("Transform").property("Position");
        pos.dimensionsSeparated = true;

        var xProp = shapeLayer.property("Transform").property("X Position");
        var yProp = shapeLayer.property("Transform").property("Y Position");

        // Parent space expressions - much simpler since we're parented to the shape layer
        var exprHeader =
            "var r = parent.sourceRectAtTime(time,false);\n";

        xProp.expression = exprHeader + exprX + ";";
        yProp.expression = exprHeader + exprY + ";";

        return shapeLayer;
    }

    var created = [];
    for (var i=0; i<points.length; i++) {
        var g = makeGuide(points[i].name, points[i].exprX, points[i].exprY);
        if (g) created.push(g);
    }

    // Ensure new ones go on top (index 1)
    for (var j=0; j<created.length; j++) {
        created[j].moveToBeginning();
    }

    app.endUndoGroup();
    
    // Return success for vertex nulls
    return "success|Created " + created.length + " vertex null guides";
}

// Apply the complete preset
function applySquircle(useCompSize, resolutionMultiplier) {
    // app.beginUndoGroup("Create Squircle");
    
    // Check if we have an active comp
    var comp = app.project.activeItem;
    if (!comp || !(comp instanceof CompItem)) {
        alert("Please select a composition first.");
        // app.endUndoGroup();
        return;
    }

    // Create a shape layer
    var layer = comp.layers.addShape();
    layer.name = "Squircle";
    
    // Build the FFX file path using the extension root passed from the panel
    var ffxPath = extensionRoot + "/assets/presets/SquircleComplete.ffx";
    var ffxFile = new File(ffxPath);
    
    // Check if file exists with alternate separator
    if (!ffxFile.exists) {
        ffxPath = extensionRoot + "\\assets\\presets\\SquircleComplete.ffx";
        ffxFile = new File(ffxPath);
    }
    
    // If still not found, try relative to script
    if (!ffxFile.exists) {
        var scriptFile = new File($.fileName);
        var scriptFolder = scriptFile.parent;
        var extRoot = scriptFolder.parent;
        ffxPath = extRoot.fsName + "/assets/presets/SquircleComplete.ffx";
        ffxFile = new File(ffxPath);
    }
    
    // Check if we found the file
    if (!ffxFile.exists) {
        alert("Cannot find SquircleComplete.ffx preset file.");
        layer.remove();
        // app.endUndoGroup();
        return;
    }
    
    // Apply the preset to the layer
    try {
        layer.applyPreset(ffxFile);
    } catch (e) {
        alert("applyPreset failed: " + e.toString());
        layer.remove();
        // app.endUndoGroup();
        return;
    }
    
    // Add a stroke with 0px width to the shape group
    try {
        var contents = layer.property("Contents");
        if (contents && contents.numProperties > 0) {
            // Find the first group (should be "Group 1" or "Squircle Shape")
            var shapeGroup = null;
            for (var i = 1; i <= contents.numProperties; i++) {
                var prop = contents.property(i);
                if (prop.matchName === "ADBE Vector Group") {
                    shapeGroup = prop;
                    break;
                }
            }
            
            if (shapeGroup && shapeGroup.property("Contents")) {
                var groupContents = shapeGroup.property("Contents");
                
                // Find where to insert the stroke (after Path, before Fill)
                var pathIndex = -1;
                var fillIndex = -1;
                
                for (var j = 1; j <= groupContents.numProperties; j++) {
                    var item = groupContents.property(j);
                    if (item.matchName === "ADBE Vector Shape - Group") {
                        pathIndex = j;
                    } else if (item.matchName === "ADBE Vector Graphic - Fill") {
                        fillIndex = j;
                    }
                }
                
                // Add stroke
                var stroke = groupContents.addProperty("ADBE Vector Graphic - Stroke");
                stroke.name = "Stroke 1";
                
                // Set stroke properties
                stroke.property("Color").setValue([1, 1, 1]); // White color
                stroke.property("Stroke Width").setValue(0);   // 0px width
                
                // Move stroke to correct position (after path, before fill)
                if (fillIndex > 0 && stroke.propertyIndex > fillIndex) {
                    stroke.moveTo(fillIndex);
                } else if (pathIndex > 0) {
                    stroke.moveTo(pathIndex + 1);
                }
            }
        }
    } catch(e) {
        // Non-fatal if stroke creation fails
    }
    
    // *** Set squircle properties based on mode ***
    try {
        var squircleEffect = layer.property("Effects").property("Squircle");
        if (squircleEffect) {
            // Default to 2x resolution if not provided
            var multiplier = resolutionMultiplier || 2;
            
            // Determine dimensions and radius based on mode
            var width, height, radius;
            
            if (useCompSize === true) {
                // Shift-click: Use comp dimensions with larger radius scaled by resolution
                width = comp.width;
                height = comp.height;
                // Base radius is 54 at 1x, so 108 at 2x, 216 at 4x, etc.
                radius = 54 * multiplier;
            } else {
                // Regular click: Use default 400x400 with standard radius scaled by resolution
                width = 400;
                height = 400;
                // Base radius is 32 at 1x, so 64 at 2x, 128 at 4x, etc.
                radius = 32 * multiplier;
            }
            
            // Set the squircle properties
            try { squircleEffect.property("Unified Corners").setValue(1); } catch(e1) {}
            try { squircleEffect.property("Width").setValue(width); } catch(e2) {}
            try { squircleEffect.property("Height").setValue(height); } catch(e3) {}
            try { squircleEffect.property("Unified Radius").setValue(radius); } catch(e4) {}
            // Also set individual corners to match radius so visual default matches
            try { squircleEffect.property("Top Left").setValue(radius); } catch(e5) {}
            try { squircleEffect.property("Top Right").setValue(radius); } catch(e6) {}
            try { squircleEffect.property("Bottom Left").setValue(radius); } catch(e7) {}
            try { squircleEffect.property("Bottom Right").setValue(radius); } catch(e8) {}
        }
    } catch(e) {
        // non-fatal if effect names differ
    }

    // Center the layer in the comp
    layer.transform.position.setValue([comp.width/2, comp.height/2]);
    
    // app.endUndoGroup();
}

// Replace selected rectangle with squircle
function replaceRectangle() {
    // app.beginUndoGroup("Replace Rectangle with Squircle");
    
    try {
        // Check if we have an active comp
        var comp = app.project.activeItem;
        if (!comp || !(comp instanceof CompItem)) {
            alert("Please select a composition first.");
            // app.endUndoGroup();
            return;
        }
        
        // Check if a layer is selected
        if (comp.selectedLayers.length === 0) {
            alert("Please select a shape layer with a rectangle.");
            // app.endUndoGroup();
            return;
        }
        
        var selectedLayer = comp.selectedLayers[0];
        
        // Check if it's a shape layer
        if (!(selectedLayer instanceof ShapeLayer)) {
            alert("Please select a shape layer with a rectangle.");
            // app.endUndoGroup();
            return;
        }
        
        // Find rectangle data in the shape layer
        var rectangleData = findRectangleData(selectedLayer);
        if (!rectangleData) {
            alert("Could not find a rectangle path in the selected layer.\nMake sure the layer contains a Rectangle Path.");
            // app.endUndoGroup();
            return;
        }
        
        // Store the original layer's transform properties
        var originalTransform = {
            anchorPoint: selectedLayer.transform.anchorPoint.value,
            position: selectedLayer.transform.position.value,
            scale: selectedLayer.transform.scale.value,
            rotation: selectedLayer.transform.rotation.value,
            opacity: selectedLayer.transform.opacity.value
        };
        
        // Store the original layer's name
        var originalName = selectedLayer.name;
        
        // Create new squircle layer
        var newLayer = comp.layers.addShape();
        newLayer.name = originalName + " (Squircle)";
        
        // Move new layer right after the original
        newLayer.moveBefore(selectedLayer);
        
        // Apply the squircle preset
        var ffxPath = extensionRoot + "/assets/presets/SquircleComplete.ffx";
        var ffxFile = new File(ffxPath);
        
        if (!ffxFile.exists) {
            ffxPath = extensionRoot + "\\assets\\presets\\SquircleComplete.ffx";
            ffxFile = new File(ffxPath);
        }
        
        if (!ffxFile.exists) {
            var scriptFile = new File($.fileName);
            var scriptFolder = scriptFile.parent;
            var extRoot = scriptFolder.parent;
            ffxPath = extRoot.fsName + "/assets/presets/SquircleComplete.ffx";
            ffxFile = new File(ffxPath);
        }
        
        if (!ffxFile.exists) {
            alert("Cannot find SquircleComplete.ffx preset file.");
            newLayer.remove();
            // app.endUndoGroup();
            return;
        }
        
        // Apply the preset
        try {
            newLayer.applyPreset(ffxFile);
        } catch (e) {
            alert("applyPreset failed: " + e.toString());
            newLayer.remove();
            // app.endUndoGroup();
            return;
        }
        
        // Apply the rectangle's properties to the squircle effect
        var squircleEffect = newLayer.property("Effects").property("Squircle");
        if (squircleEffect) {
            // Set width and height from rectangle
            try { squircleEffect.property("Width").setValue(rectangleData.width); } catch(eW){}
            try { squircleEffect.property("Height").setValue(rectangleData.height); } catch(eH){}
            
            // ALWAYS enable unified corners and set the radius to match the rectangle (even if 0)
            try { squircleEffect.property("Unified Corners").setValue(1); } catch(e1) {}
            try { squircleEffect.property("Unified Radius").setValue(rectangleData.roundness); } catch(e2) {}
            
            // Also set individual corners to match (override any defaults)
            try { squircleEffect.property("Top Left").setValue(rectangleData.roundness); } catch(e3) {}
            try { squircleEffect.property("Top Right").setValue(rectangleData.roundness); } catch(e4) {}
            try { squircleEffect.property("Bottom Left").setValue(rectangleData.roundness); } catch(e5) {}
            try { squircleEffect.property("Bottom Right").setValue(rectangleData.roundness); } catch(e6) {}
        }
        
        // Copy fill and stroke properties from the original rectangle to the new squircle
        try {
            var newContents = newLayer.property("Contents");
            if (newContents && newContents.numProperties > 0) {
                // Find the squircle's shape group
                var squircleGroup = null;
                for (var i = 1; i <= newContents.numProperties; i++) {
                    var prop = newContents.property(i);
                    if (prop.matchName === "ADBE Vector Group") {
                        squircleGroup = prop;
                        break;
                    }
                }
                
                if (squircleGroup && squircleGroup.property("Contents")) {
                    var squircleContents = squircleGroup.property("Contents");
                    
                    // Find and update the fill in the squircle
                    if (rectangleData.fillColor || rectangleData.fillOpacity !== null) {
                        for (var j = 1; j <= squircleContents.numProperties; j++) {
                            var item = squircleContents.property(j);
                            if (item.matchName === "ADBE Vector Graphic - Fill") {
                                if (rectangleData.fillColor) {
                                    try { item.property("Color").setValue(rectangleData.fillColor); } catch(e) {}
                                }
                                if (rectangleData.fillOpacity !== null) {
                                    try { item.property("Opacity").setValue(rectangleData.fillOpacity); } catch(e) {}
                                }
                                break;
                            }
                        }
                    }
                    
                    // Find and update the stroke in the squircle (or add one if needed)
                    var strokeFound = false;
                    for (var k = 1; k <= squircleContents.numProperties; k++) {
                        var item = squircleContents.property(k);
                        if (item.matchName === "ADBE Vector Graphic - Stroke") {
                            strokeFound = true;
                            if (rectangleData.strokeColor) {
                                try { item.property("Color").setValue(rectangleData.strokeColor); } catch(e) {}
                            }
                            if (rectangleData.strokeWidth !== null) {
                                try { item.property("Stroke Width").setValue(rectangleData.strokeWidth); } catch(e) {}
                            }
                            if (rectangleData.strokeOpacity !== null) {
                                try { item.property("Opacity").setValue(rectangleData.strokeOpacity); } catch(e) {}
                            }
                            break;
                        }
                    }
                    
                    // If no stroke was found but the rectangle had one, add it
                    if (!strokeFound && rectangleData.hasStroke) {
                        var newStroke = squircleContents.addProperty("ADBE Vector Graphic - Stroke");
                        newStroke.name = "Stroke 1";
                        if (rectangleData.strokeColor) {
                            try { newStroke.property("Color").setValue(rectangleData.strokeColor); } catch(e) {}
                        }
                        if (rectangleData.strokeWidth !== null) {
                            try { newStroke.property("Stroke Width").setValue(rectangleData.strokeWidth); } catch(e) {}
                        }
                        if (rectangleData.strokeOpacity !== null) {
                            try { newStroke.property("Opacity").setValue(rectangleData.strokeOpacity); } catch(e) {}
                        }
                        
                        // Move stroke before fill if needed
                        for (var m = 1; m <= squircleContents.numProperties; m++) {
                            if (squircleContents.property(m).matchName === "ADBE Vector Graphic - Fill") {
                                newStroke.moveTo(m);
                                break;
                            }
                        }
                    }
                }
            }
        } catch(e) {
            // Non-fatal if visual property copy fails
        }
        
        // Copy internal group (path) Transform position + anchor point so it sits exactly where the original did
        try {
            var newContents = newLayer.property("Contents");
            var destGroup = null;
            if (newContents) {
                for (var gi = 1; gi <= newContents.numProperties; gi++) {
                    var g = newContents.property(gi);
                    if (!g) continue;
                    var gContents = g.property("Contents");
                    if (!gContents) continue;
                    for (var pi = 1; pi <= gContents.numProperties; pi++) {
                        var p = gContents.property(pi);
                        if (!p) continue;
                        // If this group contains a rectangle or a path, assume this is the shape group
                        if (p.matchName === "ADBE Vector Shape - Rect" || p.matchName === "ADBE Vector Shape - Group" || p.matchName === "ADBE Vector Shape - Ellipse") {
                            destGroup = g;
                            break;
                        }
                    }
                    if (destGroup) break;
                }
            }
            if (destGroup && destGroup.property("Transform")) {
                var destTransform = destGroup.property("Transform");
                if (destTransform.property("Position") && rectangleData.groupPosition) {
                    try { destTransform.property("Position").setValue(rectangleData.groupPosition); } catch(ePos) {}
                }
                if (destTransform.property("Anchor Point") && rectangleData.groupAnchor) {
                    try { destTransform.property("Anchor Point").setValue(rectangleData.groupAnchor); } catch(eAnch) {}
                }
                if (destTransform.property("Scale") && rectangleData.groupScale) {
                    try { destTransform.property("Scale").setValue(rectangleData.groupScale); } catch(eScale) {}
                }
            }
        } catch (e) {
            // Non-fatal if transform copy fails
        }
        
        // Copy ALL layer-level transform properties exactly as they are
        // Use expressions/keys copy to ensure exact copying including any expressions
        var props = ["anchorPoint", "position", "scale", "rotation", "opacity"];
        
        for (var i = 0; i < props.length; i++) {
            var propName = props[i];
            var sourceProp = selectedLayer.transform.property(propName);
            var targetProp = newLayer.transform.property(propName);
            
            try {
                // Remove existing keys on target if present (avoid conflicts)
                if (targetProp.numKeys > 0) {
                    for (var kk = targetProp.numKeys; kk >= 1; kk--) {
                        targetProp.removeKey(kk);
                    }
                }
            } catch (eRem) {}
            
            try {
                if (sourceProp.numKeys > 0) {
                    // Copy keyframes if they exist
                    for (var k = 1; k <= sourceProp.numKeys; k++) {
                        var time = sourceProp.keyTime(k);
                        var value = sourceProp.keyValue(k);
                        targetProp.setValueAtTime(time, value);
                        // (Note: this doesn't copy interpolation tangents - can be added if needed)
                    }
                } else {
                    // Just copy the current value
                    try { targetProp.setValue(sourceProp.value); } catch(eV) {}
                }
                
                // Copy expression if it exists
                if (sourceProp.expression && sourceProp.expression !== "") {
                    targetProp.expression = sourceProp.expression;
                }
            } catch (eCopy) {
                // ignore non-critical property copy errors
            }
        }
        
        // Copy all effects from the original layer (like Drop Shadow, Fast Box Blur, etc.)
        try {
            var sourceEffects = selectedLayer.property("Effects");
            var targetEffects = newLayer.property("Effects");
            
            if (sourceEffects && sourceEffects.numProperties > 0) {
                // Go through each effect on the source layer
                for (var fx = 1; fx <= sourceEffects.numProperties; fx++) {
                    var sourceEffect = sourceEffects.property(fx);
                    
                    // Skip if this is a Squircle effect (we don't want to duplicate it)
                    if (sourceEffect.name === "Squircle" || sourceEffect.matchName === "Pseudo/Squircle") {
                        continue;
                    }
                    
                    try {
                        // Add the same effect to the target layer
                        var newEffect = targetEffects.addProperty(sourceEffect.matchName);
                        
                        // Copy all the effect's property values
                        for (var p = 1; p <= sourceEffect.numProperties; p++) {
                            var sourceProp = sourceEffect.property(p);
                            var targetProp = newEffect.property(p);
                            
                            // Skip properties that can't be set
                            if (!targetProp || !targetProp.canSetExpression && !targetProp.canSetValue) continue;
                            
                            try {
                                // Check if property has keyframes
                                if (sourceProp.numKeys > 0) {
                                    // Copy keyframes with full interpolation
                                    for (var key = 1; key <= sourceProp.numKeys; key++) {
                                        var keyTime = sourceProp.keyTime(key);
                                        var keyValue = sourceProp.keyValue(key);
                                        targetProp.setValueAtTime(keyTime, keyValue);
                                        
                                        // Copy temporal ease
                                        var inEase = sourceProp.keyInTemporalEase(key);
                                        var outEase = sourceProp.keyOutTemporalEase(key);
                                        targetProp.setTemporalEaseAtKey(key, inEase, outEase);
                                        
                                        // Copy temporal continuous and auto bezier
                                        if (sourceProp.keyTemporalContinuous(key)) {
                                            targetProp.setTemporalContinuousAtKey(key, true);
                                        }
                                        if (sourceProp.keyTemporalAutoBezier(key)) {
                                            targetProp.setTemporalAutoBezierAtKey(key, true);
                                        }
                                        
                                        // Copy spatial tangents if applicable
                                        var isSpatial = (sourceProp.propertyValueType === PropertyValueType.TwoD_SPATIAL || 
                                                         sourceProp.propertyValueType === PropertyValueType.ThreeD_SPATIAL);
                                        if (isSpatial) {
                                            var inTangent = sourceProp.keyInSpatialTangent(key);
                                            var outTangent = sourceProp.keyOutSpatialTangent(key);
                                            targetProp.setSpatialTangentsAtKey(key, inTangent, outTangent);
                                        }
                                        
                                        // Copy roving
                                        if (sourceProp.keyRoving(key)) {
                                            targetProp.setRovingAtKey(key, true);
                                        }
                                    }
                                } else if (sourceProp.value !== undefined) {
                                    // Just copy the static value
                                    targetProp.setValue(sourceProp.value);
                                }
                                
                                // Copy expression if it exists
                                if (sourceProp.expression && sourceProp.expression !== "") {
                                    targetProp.expression = sourceProp.expression;
                                }
                            } catch(propError) {
                                // Some properties might not be directly copyable, that's ok
                            }
                        }
                        
                        // Copy the effect's enabled state
                        if (sourceEffect.enabled !== undefined) {
                            newEffect.enabled = sourceEffect.enabled;
                        }
                        
                    } catch(effectError) {
                        // If we can't copy this particular effect, continue with others
                    }
                }
            }
        } catch(e) {
            // Non-fatal if effect copying fails
        }
        
        // Hide the original layer
        selectedLayer.enabled = false;
        
        // Select the new layer
        selectedLayer.selected = false;
        newLayer.selected = true;
        
    } catch(e) {
        alert("Error replacing rectangle: " + e.toString());
    }
    
    // app.endUndoGroup();
}


// AE Folders functionality - Create standard project folder structure
function createAEFoldersFromPanel() {
    try {
        // Check if we have a project
        if (!app.project) {
            alert("Please open a project first.");
            return "error";
        }
        
        // Check if the main folders already exist
        var mainFolders = ["01 - Comps", "02 - Assets"];
        var existingFolders = 0;

        for (var i = 1; i <= app.project.items.length; i++) {
            var item = app.project.items[i];
            if (item instanceof FolderItem) {
                for (var j = 0; j < mainFolders.length; j++) {
                    if (item.name === mainFolders[j]) {
                        existingFolders++;
                        break;
                    }
                }
            }
        }

        // Always proceed to create/restore folder structure
        // This will create missing main folders and restore missing subfolders

        // Define the folder structure
        var folderStructure = [
            {
                name: "01 - Comps",
                subfolders: [
                    {
                        name: "Desktop",
                        subfolders: [
                            { name: "01_Specs" },
                            { name: "02_Lottie" },
                            { name: "03_Precomps" }
                        ]
                    },
                    {
                        name: "Native",
                        subfolders: [
                            { name: "01_Specs" },
                            { name: "02_Lottie" },
                            { name: "03_Precomps" }
                        ]
                    },
                    { name: "zArchive" }
                ]
            },
            {
                name: "02 - Assets",
                subfolders: [
                    { name: "Images" },
                    { name: "Projects" },
                    { name: "Reference" },
                    { name: "Renders" },
                    { name: "Video" }
                ]
            }
        ];
        
        // Create the folder structure recursively
        createFolderStructure(app.project, folderStructure);

        // Provide appropriate feedback message
        if (existingFolders === mainFolders.length) {
            return "folders_restored"; // All main folders existed, subfolders may have been restored
        } else {
            return "success"; // Some main folders were created
        }
        
    } catch(e) {
        alert("Error creating AE folder structure: " + e.toString());
        return "error";
    }
}

// Recursive helper function to create folder structure
function createFolderStructure(parent, folders) {
    for (var i = 0; i < folders.length; i++) {
        var folderDef = folders[i];
        
        // Check if folder already exists
        var existingFolder = null;
        for (var j = 1; j <= parent.items.length; j++) {
            var item = parent.items[j];
            if (item instanceof FolderItem && item.name === folderDef.name) {
                existingFolder = item;
                break;
            }
        }
        
        // Create folder if it doesn't exist
        var folder = existingFolder;
        if (!folder) {
            folder = parent.items.addFolder(folderDef.name);
        }
        
        // Create subfolders if they exist
        if (folderDef.subfolders && folderDef.subfolders.length > 0) {
            createFolderStructure(folder, folderDef.subfolders);
        }
    }
}

// Finder Folders functionality - Create folder structure in file system
function createFinderFoldersFromPanel() {
    try {
        // Check if we have a project
        if (!app.project) {
            alert("Please open a project first.");
            return "error";
        }
        
        // Show folder selection dialog
        var selectedFolder = Folder.selectDialog("Choose location to create project folder structure");
        if (!selectedFolder) {
            return "cancelled"; // User cancelled
        }
        
        // Get project name (without extension) for saving the AE file
        var projectFile = app.project.file;
        var projectName = "AirBoard Project";
        if (projectFile) {
            projectName = projectFile.name.replace(/\.[^\.]*$/, ""); // Remove extension
        }
        
        // Use selected folder directly as root (no additional folder created)
        var rootFolder = selectedFolder;
        
        // Define the finder folder structure
        var finderFolderStructure = [
            {
                name: "01 - Assets",
                subfolders: [
                    {
                        name: "Images",
                        subfolders: [
                            { name: "Desktop" },
                            { name: "Native" }
                        ]
                    },
                    {
                        name: "Reference",
                        subfolders: [
                            { name: "Stills" },
                            { name: "Videos" }
                        ]
                    },
                    { name: "Vector" },
                    { name: "Video" }
                ]
            },
            {
                name: "02 - Exports",
                subfolders: [
                    { name: "Video" },
                    { name: "Lottie" }
                ]
            },
            { name: "03 - AE" },
            { name: "04 - C4D" },
            { name: "05 - Prototypes" }
        ];
        
        // Create the folder structure in file system
        createFinderFolderStructure(rootFolder, finderFolderStructure);
        
        // Save current AE project to 03 - AE folder with custom filename
        var aeFolder = new Folder(rootFolder.fsName + "/03 - AE");
        if (aeFolder.exists) {
            // Create File object with path to AE subfolder + default filename (no extension yet)
            var defaultFile = new File(aeFolder.fsName + "/" + projectName);
            
            // Open save dialog defaulting to the AE subfolder using saveDlg()
            var saveFile = defaultFile.saveDlg("Save After Effects project as:", "After Effects Project:*.aep");
            
            if (saveFile) {
                // Ensure .aep extension is included
                var fileName = saveFile.name;
                if (!fileName.match(/\.aep$/i)) {
                    fileName = fileName + ".aep";
                    saveFile = new File(saveFile.parent.fsName + "/" + fileName);
                }
                
                try {
                    app.project.save(saveFile);
                } catch(saveError) {
                    alert("Folder structure created, but could not save project: " + saveError.toString());
                }
            }
        }
        
        // Automatically open the created folder in Finder
        try {
            system.callSystem('open "' + rootFolder.fsName + '"');
        } catch(openError) {
            // Non-fatal if we can't open the folder
        }
        
        return "success";
        
    } catch(e) {
        alert("Error creating finder folder structure: " + e.toString());
        return "error";
    }
}

// Recursive helper function to create folder structure in file system
function createFinderFolderStructure(parentFolder, folders) {
    for (var i = 0; i < folders.length; i++) {
        var folderDef = folders[i];
        
        // Create folder in file system
        var newFolder = new Folder(parentFolder.fsName + "/" + folderDef.name);
        if (!newFolder.exists) {
            if (!newFolder.create()) {
                $.writeln("Could not create folder: " + newFolder.fsName);
                continue;
            }
        }
        
        // Create subfolders if they exist
        if (folderDef.subfolders && folderDef.subfolders.length > 0) {
            createFinderFolderStructure(newFolder, folderDef.subfolders);
        }
    }
}

// Helper function to find rectangle data in a shape layer
function findRectangleData(layer) {
    try {
        var contents = layer.property("Contents");
        if (!contents) return null;
        
        // Search through all groups in contents
        for (var i = 1; i <= contents.numProperties; i++) {
            var group = contents.property(i);
            if (group.matchName === "ADBE Vector Group") {
                var groupContents = group.property("Contents");
                
                // Get the group's transform position, anchor, and scale
                var groupTransform = group.property("Transform");
                var groupPosition = [0, 0];
                var groupAnchor = [0, 0];
                var groupScale = [100, 100];
                if (groupTransform) {
                    try { if (groupTransform.property("Position")) groupPosition = groupTransform.property("Position").value; } catch(ePos) {}
                    try { if (groupTransform.property("Anchor Point")) groupAnchor = groupTransform.property("Anchor Point").value; } catch(eAnc) {}
                    try { if (groupTransform.property("Scale")) groupScale = groupTransform.property("Scale").value; } catch(eScale) {}
                }
                
                // Variables to store visual properties
                var fillColor = null;
                var fillOpacity = null;
                var strokeColor = null;
                var strokeWidth = null;
                var strokeOpacity = null;
                var hasStroke = false;
                
                // Look for visual properties (fill and stroke)
                for (var v = 1; v <= groupContents.numProperties; v++) {
                    var visualProp = groupContents.property(v);
                    
                    // Check for Fill
                    if (visualProp.matchName === "ADBE Vector Graphic - Fill") {
                        try {
                            fillColor = visualProp.property("Color").value;
                            fillOpacity = visualProp.property("Opacity").value;
                        } catch(e) {}
                    }
                    
                    // Check for Stroke
                    if (visualProp.matchName === "ADBE Vector Graphic - Stroke") {
                        hasStroke = true;
                        try {
                            strokeColor = visualProp.property("Color").value;
                            strokeWidth = visualProp.property("Stroke Width").value;
                            strokeOpacity = visualProp.property("Opacity").value;
                        } catch(e) {}
                    }
                }
                
                // Look for Rectangle Path
                for (var j = 1; j <= groupContents.numProperties; j++) {
                    var prop = groupContents.property(j);
                    
                    // Check for Rectangle Path (native rect)
                    if (prop.matchName === "ADBE Vector Shape - Rect") {
                        var size = prop.property("Size").value;
                        var position = prop.property("Position").value;
                        var roundness = prop.property("Roundness").value;
                        
                        return {
                            width: size[0],
                            height: size[1],
                            position: position,
                            roundness: roundness,
                            groupPosition: groupPosition,
                            groupAnchor: groupAnchor,
                            groupScale: groupScale,
                            // Visual properties
                            fillColor: fillColor,
                            fillOpacity: fillOpacity,
                            strokeColor: strokeColor,
                            strokeWidth: strokeWidth,
                            strokeOpacity: strokeOpacity,
                            hasStroke: hasStroke
                        };
                    }
                    
                    // Also check for converted rectangle (might be a path)
                    if (prop.matchName === "ADBE Vector Shape - Group") {
                        // Check if it's named Rectangle or similar
                        if (prop.name && prop.name.toLowerCase().indexOf("rectangle") !== -1) {
                            // Try to extract size from the path bounds
                            var path = prop.property("Path");
                            if (path && path.value && path.value.vertices) {
                                var vertices = path.value.vertices;
                                if (vertices.length >= 4) {
                                    // Estimate width and height from vertices
                                    var minX = vertices[0][0], maxX = vertices[0][0];
                                    var minY = vertices[0][1], maxY = vertices[0][1];
                                    
                                    for (var v = 1; v < vertices.length; v++) {
                                        minX = Math.min(minX, vertices[v][0]);
                                        maxX = Math.max(maxX, vertices[v][0]);
                                        minY = Math.min(minY, vertices[v][1]);
                                        maxY = Math.max(maxY, vertices[v][1]);
                                    }
                                    
                                    return {
                                        width: maxX - minX,
                                        height: maxY - minY,
                                        position: [0, 0],
                                        roundness: 0, // Can't determine roundness from path
                                        groupPosition: groupPosition,
                                        groupAnchor: groupAnchor,
                                        groupScale: groupScale,
                                        // Visual properties
                                        fillColor: fillColor,
                                        fillOpacity: fillOpacity,
                                        strokeColor: strokeColor,
                                        strokeWidth: strokeWidth,
                                        strokeOpacity: strokeOpacity,
                                        hasStroke: hasStroke
                                    };
                                }
                            }
                        }
                    }
                }
            }
        }
        
        return null;
    } catch(e) {
        return null;
    }
}

// Detect the current elevation applied to a layer
function getCurrentElevation(layer) {
    try {
        // Check for stroke layer style (indicates Elevation 0)
        if (typeof layer.layerStyles !== 'undefined') {
            var layerStyles = layer.layerStyles;
            if (typeof layerStyles.stroke !== 'undefined' && layerStyles.stroke.enabled) {
                return "0"; // Stroke layer style enabled = Elevation 0
            }
        }
        
        // Alternative method for stroke layer style
        if (typeof layer.property !== 'undefined') {
            var layerStylesGroup = layer.property("Layer Styles");
            if (layerStylesGroup) {
                for (var j = 1; j <= layerStylesGroup.numProperties; j++) {
                    var styleProp = layerStylesGroup.property(j);
                    if (styleProp.name.toLowerCase().indexOf("stroke") !== -1 && styleProp.enabled) {
                        return "0"; // Stroke layer style enabled = Elevation 0
                    }
                }
            }
        }
        
        // Check for drop shadow effects (indicates Elevation 1-4)
        var effects = layer.Effects;
        var shadowCount = 0;
        for (var i = 1; i <= effects.numProperties; i++) {
            var effect = effects.property(i);
            if (effect.name.indexOf("Drop Shadow") !== -1) {
                shadowCount++;
            }
        }
        
        // Guess elevation based on shadow count (this is approximate)
        if (shadowCount === 0) {
            return null; // No shadows, no stroke = no elevation applied
        } else if (shadowCount === 1) {
            return "1"; // 1 shadow = likely Elevation 1
        } else if (shadowCount === 3) {
            return "2"; // 3 shadows = likely Elevation 2
        } else if (shadowCount === 5) {
            return "3"; // 5 shadows = likely Elevation 3
        } else if (shadowCount >= 7) {
            return "4"; // 7+ shadows = likely Elevation 4
        }
        
        // If we have shadows but can't determine exact elevation, assume change needed
        return "unknown";
        
    } catch(error) {
        return null;
    }
}

// Handle stroke layer style enable/disable based on elevation type

// Remove shadow-related effects from a layer before applying new shadow preset
function removeShadowEffects(layer, targetElevationType) {
    var debugInfo = [];
    try {
        var effects = layer.Effects;
        var effectsToRemove = [];
        
        // List of effect match names that should be removed for shadow swapping
        // Initially using common shadow effect names - will be updated based on debug output
        var shadowEffectNames = [
            "ADBE Drop Shadow",             // Drop Shadow
            "ADBE Stroke",                  // Stroke (often used for outlines/borders)
            "ADBE Gaussian Blur 2",         // Gaussian Blur (sometimes used for shadows)
            "ADBE Glow",                    // Glow effects
            "ADBE Inner/Outer Glow"         // Inner/Outer Glow
        ];
        
        // Collect effects to remove (iterate backwards to avoid index issues)
        for (var i = effects.numProperties; i >= 1; i--) {
            var effect = effects.property(i);
            var matchName = effect.matchName;
            var displayName = effect.name;
            
            // Check if this effect should be removed
            for (var j = 0; j < shadowEffectNames.length; j++) {
                if (matchName === shadowEffectNames[j]) {
                    effectsToRemove.push(i);
                    break;
                }
            }
        }
        
        // Remove the identified effects
        for (var k = 0; k < effectsToRemove.length; k++) {
            try {
                effects.property(effectsToRemove[k]).remove();
            } catch(removeError) {
                // Continue if removal fails
            }
        }
        
        // Handle layer styles (Elevation 0 uses stroke layer style, others don't)
        try {
            // Method 1: Check if layer has layerStyles property
            if (typeof layer.layerStyles !== 'undefined') {
                var layerStyles = layer.layerStyles;
                
                if (typeof layerStyles.stroke !== 'undefined') {
                    // Elevation 0 uses stroke layer style, others don't
                    if (targetElevationType === "0") {
                        // Elevation 0: Enable stroke layer style
                        if (!layerStyles.stroke.enabled) {
                            layerStyles.stroke.enabled = true;
                        }
                    } else {
                        // Elevation 1-4: Disable stroke layer style
                        if (layerStyles.stroke.enabled) {
                            layerStyles.stroke.enabled = false;
                        }
                    }
                }
            }
            
            // Method 2: Try direct property access via layer.property("Layer Styles")
            if (typeof layer.property !== 'undefined') {
                var layerStylesGroup = layer.property("Layer Styles");
                if (layerStylesGroup) {
                    for (var j = 1; j <= layerStylesGroup.numProperties; j++) {
                        var styleProp = layerStylesGroup.property(j);
                        
                        if (styleProp.name.toLowerCase().indexOf("stroke") !== -1) {
                            // Elevation 0 uses stroke layer style, others don't
                            if (targetElevationType === "0") {
                                // Elevation 0: Enable stroke layer style
                                if (!styleProp.enabled) {
                                    styleProp.enabled = true;
                                }
                            } else {
                                // Elevation 1-4: Disable stroke layer style
                                if (styleProp.enabled) {
                                    styleProp.enabled = false;
                                }
                            }
                        }
                    }
                }
            }
            
        } catch(layerStyleError) {
            // Layer style access failed - continue without error
        }
        
        return [];
        
    } catch(error) {
        return [];
    }
}

// Simplified Shadow System - No elevation detection, just apply presets and manage stroke layer styles
function addShadowFromPanel(elevationType, resolutionMultiplier) {
    try {
        // Check if we have a selected layer
        var comp = app.project.activeItem;
        if (!comp || !(comp instanceof CompItem)) {
            alert("Please select a composition first.");
            return "error";
        }
        
        var selectedLayers = comp.selectedLayers;
        if (!selectedLayers || selectedLayers.length === 0) {
            alert("Please select a layer to apply shadow to.");
            return "error";
        }
        
        var targetLayer = selectedLayers[0]; // Apply to first selected layer
        var debugInfo = [];
        
        // Debug layer information  
        debugInfo.push("=== SHADOW SYSTEM (ELEVATIONS 1-4) ===");
        debugInfo.push("Layer name: " + targetLayer.name);
        debugInfo.push("Layer type: " + targetLayer.toString());
        debugInfo.push("Layer instanceof AVLayer: " + (targetLayer instanceof AVLayer));
        
        if (targetLayer instanceof AVLayer) {
            debugInfo.push("Has source: " + (targetLayer.source !== null));
            if (targetLayer.source) {
                debugInfo.push("Source type: " + targetLayer.source.toString());
                debugInfo.push("Source instanceof FootageItem: " + (targetLayer.source instanceof FootageItem));
                
                if (targetLayer.source instanceof FootageItem) {
                    debugInfo.push("Has footageSource: " + (targetLayer.source.footageSource !== null));
                    if (targetLayer.source.footageSource) {
                        debugInfo.push("FootageSource type: " + targetLayer.source.footageSource.toString());
                        debugInfo.push("FootageSource instanceof SolidSource: " + (targetLayer.source.footageSource instanceof SolidSource));
                        
                        // Additional checks for solid detection
                        if (typeof targetLayer.source.footageSource.color !== 'undefined') {
                            debugInfo.push("Has color property (indicates solid): true");
                        }
                    }
                }
                
                // Additional solid layer detection methods
                if (targetLayer.name && targetLayer.name.indexOf("Solid") === 0) {
                    debugInfo.push("Name starts with 'Solid': true");
                }
            }
        }
        
        // Enhanced solid layer detection
        var isSolidLayer = false;
        
        // Method 1: Standard instanceof check
        if (targetLayer instanceof AVLayer && targetLayer.source instanceof FootageItem && 
            targetLayer.source.footageSource instanceof SolidSource) {
            isSolidLayer = true;
            debugInfo.push("✓ Detected as solid via SolidSource instanceof");
        }
        
        // Method 2: Check for color property (solids have this)
        if (targetLayer instanceof AVLayer && targetLayer.source instanceof FootageItem && 
            targetLayer.source.footageSource && 
            typeof targetLayer.source.footageSource.color !== 'undefined') {
            isSolidLayer = true;
            debugInfo.push("✓ Detected as solid via color property");
        }
        
        // Method 3: Check layer name pattern
        if (targetLayer.name && targetLayer.name.indexOf("Solid") === 0) {
            isSolidLayer = true;
            debugInfo.push("✓ Detected as solid via name pattern");
        }
        
        if (isSolidLayer) {
            debugInfo.push("❌ BLOCKED: This is a solid layer");
            alert("Cannot apply shadow presets to solid layers. Please select a shape layer, text layer, or other content layer.");
            return "error|" + debugInfo.join("|");
        } else {
            debugInfo.push("✅ ALLOWED: This is not a solid layer");
        }
        
        // Apply the shadow preset (Elevations 1-4 only)
        var resolutionFolder = resolutionMultiplier + "x";
        var presetFileName = resolutionMultiplier + "x - Elevation " + elevationType + ".ffx";
        var presetPath = extensionRoot + "/assets/presets/Shadows/" + resolutionFolder + "/" + presetFileName;
        var presetFile = new File(presetPath);
        
        // Check alternate path separator for Windows compatibility
        if (!presetFile.exists) {
            presetPath = extensionRoot + "\\assets\\presets\\Shadows\\" + resolutionFolder + "\\" + presetFileName;
            presetFile = new File(presetPath);
        }
        
        if (!presetFile.exists) {
            alert("Cannot find shadow preset file:\n" + presetFileName + "\n\nExpected location:\n" + presetPath);
            return "error";
        }
        
        // Apply the preset to the selected layer
        try {
            // Check layer count before applying preset
            var layerCountBefore = comp.numLayers;
            debugInfo.push("📊 Layer count before: " + layerCountBefore);
            debugInfo.push("📁 Applying preset: " + presetFileName);
            
            // Check effect count before applying preset (specifically for Elevation 1 debugging)
            var effectCountBefore = targetLayer.Effects.numProperties;
            debugInfo.push("🎭 Effect count before: " + effectCountBefore);
            
            targetLayer.applyPreset(presetFile);
            
            // Check layer count after applying preset
            var layerCountAfter = comp.numLayers;
            debugInfo.push("📊 Layer count after: " + layerCountAfter);
            
            // Check effect count after applying preset (specifically for Elevation 1 debugging)
            var effectCountAfter = targetLayer.Effects.numProperties;
            debugInfo.push("🎭 Effect count after: " + effectCountAfter);
            debugInfo.push("🎭 Effects added: " + (effectCountAfter - effectCountBefore));
            
            // Rename ALL Drop Shadow effects to match elevation type (handles both new and replaced effects)
            var effects = targetLayer.Effects;
            var dropShadowCount = 0;
            
            // Find and rename ALL Drop Shadow effects on the layer
            for (var e = 1; e <= effects.numProperties; e++) {
                var effect = effects.property(e);
                if (effect && (effect.name === "Drop Shadow" || effect.name.indexOf("Drop Shadow") === 0)) {
                    dropShadowCount++;
                    var newName = "Elevation " + elevationType;
                    
                    // If there are multiple drop shadows, keep them numbered for clarity
                    if (dropShadowCount > 1) {
                        newName = "Elevation " + elevationType + " (" + dropShadowCount + ")";
                    }
                    
                    effect.name = newName;
                    debugInfo.push("🏷️ Renamed effect " + e + " to: " + newName);
                }
            }
            
            // List all effects after preset application and renaming for debugging
            debugInfo.push("📋 Current effects on layer:");
            for (var e = 1; e <= effects.numProperties; e++) {
                var effect = effects.property(e);
                debugInfo.push("  " + e + ". " + effect.name);
            }
            
            if (layerCountAfter > layerCountBefore) {
                var newLayersCount = layerCountAfter - layerCountBefore;
                debugInfo.push("⚠️ WARNING: Preset created " + newLayersCount + " new layers");
                
                // Delete the newly created layers (they're always at the top)
                var deletedLayers = [];
                for (var i = 1; i <= newLayersCount; i++) {
                    var layerToDelete = comp.layer(1); // Always delete layer 1 (top layer)
                    deletedLayers.push(layerToDelete.name + " (" + layerToDelete.toString() + ")");
                    layerToDelete.remove();
                }
                
                debugInfo.push("🗑️ Deleted " + newLayersCount + " unwanted layers:");
                for (var j = 0; j < deletedLayers.length; j++) {
                    debugInfo.push("  - Deleted: " + deletedLayers[j]);
                }
            }
            
            debugInfo.push("✅ Preset applied successfully");
            
            return "success|" + debugInfo.join("|");
        } catch(applyError) {
            debugInfo.push("❌ Error applying preset: " + applyError.toString());
            alert("Error applying shadow preset: " + applyError.toString());
            return "error|" + debugInfo.join("|");
        }
        
    } catch(e) {
        alert("Error adding shadow: " + e.toString());
        return "error";
    }
}

// Add Shimmer functionality - Creates shimmer loading effect layers
function addShimmerFromPanel() {
    try {
        var comp = app.project.activeItem;
        
        if (!comp || !(comp instanceof CompItem)) {
            alert("Please select a composition first.");
            return "error";
        }
        
        app.beginUndoGroup("Add Shimmer Layer");
        
        try {
            // Check for existing controls layer
            var controlsLayer = null;
            var highestShimmerNum = 0;
            
            for (var i = 1; i <= comp.numLayers; i++) {
                if (comp.layer(i).name === "Shimmer Controls") {
                    controlsLayer = comp.layer(i);
                } else if (comp.layer(i).name.indexOf("Shimmer - ") !== -1) {
                    // Extract shimmer number
                    var match = comp.layer(i).name.match(/Shimmer - (\d+)/);
                    if (match) {
                        var num = parseInt(match[1]);
                        if (num > highestShimmerNum) {
                            highestShimmerNum = num;
                        }
                    }
                }
            }
            
            if (!controlsLayer) {
                // Create Controls Layer and first shimmer
                controlsLayer = createShimmerControlsLayer(comp);
                createShimmerLayer(comp, controlsLayer, 1);
            } else {
                // Create next shimmer layer
                createShimmerLayer(comp, controlsLayer, highestShimmerNum + 1);
            }
            
            return "success";
            
        } catch (error) {
            alert("Error: " + error.toString());
            return "error";
        }
        
    } catch(e) {
        alert("Error adding shimmer: " + e.toString());
        return "error";
    } finally {
        app.endUndoGroup();
    }
}

// Create the Shimmer Controls layer
function createShimmerControlsLayer(comp) {
    // Create a shape layer as the controls
    var controlsLayer = comp.layers.addShape();
    controlsLayer.name = "Shimmer Controls";
    
    // Make it a guide layer
    controlsLayer.guideLayer = true;
    
    // Set layer color to green (9 is green in AE's label colors)
    controlsLayer.label = 9;
    
    // Position in top left corner
    controlsLayer.property("Transform").property("Position").setValue([0, 0]);
    
    // Add slider control for delay
    var sliderEffect = controlsLayer.Effects.addProperty("ADBE Slider Control");
    sliderEffect.name = "Stagger Delay (frames)";
    sliderEffect.property("Slider").setValue(30);
    
    // Add color control with white color
    var colorEffect = controlsLayer.Effects.addProperty("ADBE Color Control");
    colorEffect.name = "Shimmer Color";
    // White default
    colorEffect.property("Color").setValue([1, 1, 1, 1]);
    
    // Add opacity control for the shape
    var opacityEffect = controlsLayer.Effects.addProperty("ADBE Slider Control");
    opacityEffect.name = "Shimmer Opacity";
    opacityEffect.property("Slider").setValue(60); // 60% default
    
    // Add opacity keyframes with specific timing
    var opacity = controlsLayer.property("Transform").property("Opacity");
    
    // Calculate times based on frame rate
    var fps = comp.frameRate;
    var fadeInDuration = 18 / fps;  // 300ms = 18 frames at 60fps
    var fadeOutDuration = 42 / fps; // 700ms = 42 frames at 60fps
    var waitDuration = 20 / fps;    // 333ms = 20 frames at 60fps
    
    var currentTime = 0;
    
    // Keyframe 1: Start at 0%
    opacity.setValueAtTime(currentTime, 0);
    
    // Keyframe 2: Fade to 100% over 18 frames
    currentTime += fadeInDuration;
    opacity.setValueAtTime(currentTime, 100);
    
    // Keyframe 3: Fade to 0% over 42 frames
    currentTime += fadeOutDuration;
    opacity.setValueAtTime(currentTime, 0);
    
    // Keyframe 4: Wait 20 frames (stay at 0%)
    currentTime += waitDuration;
    opacity.setValueAtTime(currentTime, 0);
    
    // Set all keyframes to use custom bezier easing (0.40, 0.00, 0.20, 1.00)
    // Current: 0.40, 0.00, 0.25, 1.00 - First handle PERFECT! Just need second 0.25→0.20
    // Keep easeIn exactly the same, slightly increase easeOut speed for -0.05
    var easeIn = new KeyframeEase(0.04, 75);   // PERFECT - don't change!
    var easeOut = new KeyframeEase(0.94, 35);  // Revert to working values
    
    for (var k = 1; k <= opacity.numKeys; k++) {
        opacity.setInterpolationTypeAtKey(k, KeyframeInterpolationType.BEZIER);
        opacity.setTemporalEaseAtKey(k, [easeIn], [easeOut]);
    }
    
    // Add loop expression to opacity
    opacity.expression = 'loopOut("cycle");';
    
    return controlsLayer;
}

// Create a Shimmer layer
function createShimmerLayer(comp, controlsLayer, shimmerNum) {
    // Create a shape layer - it will be added at the top (layer 1) by default
    var shimmerLayer = comp.layers.addShape();
    
    // Format number with leading zero
    var numStr = shimmerNum < 10 ? "0" + shimmerNum : shimmerNum.toString();
    shimmerLayer.name = "Shimmer - " + numStr;
    
    // Position at center
    shimmerLayer.property("Transform").property("Position").setValue([comp.width/2, comp.height/2]);
    
    // Add a rectangle shape with 500x500 size
    var shapeGroup = shimmerLayer.property("Contents").addProperty("ADBE Vector Group");
    shapeGroup.name = "Rectangle Group";
    
    var rect = shapeGroup.property("Contents").addProperty("ADBE Vector Shape - Rect");
    rect.property("Size").setValue([500, 500]);
    
    // Add fill
    var fill = shapeGroup.property("Contents").addProperty("ADBE Vector Graphic - Fill");
    fill.property("Color").setValue([1, 1, 1]); // White (will be overridden by expression)
    fill.property("Opacity").setValue(60); // 60% (will be overridden by expression)
    
    // Set layer label color to sea foam (label 7)
    shimmerLayer.label = 7;
    
    // Apply expressions
    var shimmerExpression = [
        '// Get the controls layer',
        'var controls = thisComp.layer("Shimmer Controls");',
        'var controlsOpacity = controls.opacity;',
        '',
        '// Get stagger delay value from slider',
        'var staggerFrames = controls.effect("Stagger Delay (frames)")("Slider");',
        '',
        '// Calculate position-based delay',
        'var myPos = thisLayer.position;',
        'var compWidth = thisComp.width;',
        'var compHeight = thisComp.height;',
        '',
        '// Calculate diagonal distance from top-left',
        'var distX = myPos[0];',
        'var distY = myPos[1];',
        'var diagonalDist = Math.sqrt(distX * distX + distY * distY);',
        '',
        '// Calculate maximum possible diagonal distance',
        'var maxDist = Math.sqrt(compWidth * compWidth + compHeight * compHeight);',
        '',
        '// Normalize distance to 0-1 range',
        'var normalizedDist = diagonalDist / maxDist;',
        '',
        '// Convert stagger frames to time',
        'var delayTime = (staggerFrames * normalizedDist) * thisComp.frameDuration;',
        '',
        '// Apply delayed opacity',
        'controlsOpacity.valueAtTime(time - delayTime);'
    ].join('\n');
    
    // Apply opacity expression
    shimmerLayer.property("Transform").property("Opacity").expression = shimmerExpression;
    
    // Link fill color and opacity to controls
    fill.property("Color").expression = 'thisComp.layer("Shimmer Controls").effect("Shimmer Color")("Color");';
    fill.property("Opacity").expression = 'thisComp.layer("Shimmer Controls").effect("Shimmer Opacity")("Slider");';
}

// Add Shimmer Effect functionality - Applies shimmer animation to selected layers
function addShimmerEffectFromPanel() {
    try {
        var comp = app.project.activeItem;
        
        if (!comp || !(comp instanceof CompItem)) {
            alert("Please select a composition first.");
            return "error";
        }
        
        app.beginUndoGroup("Add Shimmer Effect");
        
        try {
            // First, get selected layers before creating anything
            var selectedLayers = [];
            var hasControlsLayer = false;
            var controlsLayer = null;
            
            // Check if controls layer exists
            for (var i = 1; i <= comp.numLayers; i++) {
                if (comp.layer(i).name === "Shimmer Controls") {
                    controlsLayer = comp.layer(i);
                    hasControlsLayer = true;
                    break;
                }
            }
            
            // Collect selected layers (excluding controls layer if it exists)
            for (var j = 1; j <= comp.numLayers; j++) {
                var layer = comp.layer(j);
                if (layer.selected && layer !== controlsLayer) {
                    selectedLayers.push(layer);
                }
            }
            
            if (selectedLayers.length === 0) {
                alert("Please select at least one layer to apply the shimmer effect.");
                return "error";
            }
            
            // Create controls layer if it doesn't exist
            if (!hasControlsLayer) {
                controlsLayer = createShimmerEffectControlsLayer(comp);
                
                // Move controls layer below the lowest selected layer
                if (selectedLayers.length > 0) {
                    var lowestIndex = selectedLayers[selectedLayers.length - 1].index;
                    if (lowestIndex < comp.numLayers) {
                        controlsLayer.moveAfter(comp.layer(lowestIndex));
                    }
                }
            }
            
            // Sort by layer index (position in timeline)
            selectedLayers.sort(function(a, b) {
                return a.index - b.index;
            });
            
            // Apply shimmer to selected layers
            for (var k = 0; k < selectedLayers.length; k++) {
                applyShimmerToLayer(selectedLayers[k], k + 1, controlsLayer);
            }
            
            return "success";
            
        } catch (error) {
            alert("Error: " + error.toString());
            return "error";
        }
        
    } catch(e) {
        alert("Error adding shimmer effect: " + e.toString());
        return "error";
    } finally {
        app.endUndoGroup();
    }
}

// Create the Shimmer Controls layer (for effect version)
function createShimmerEffectControlsLayer(comp) {
    // Create a shape layer as the controls
    var controlsLayer = comp.layers.addShape();
    controlsLayer.name = "Shimmer Controls";
    
    // Make it a guide layer
    controlsLayer.guideLayer = true;
    
    // Set layer color to green (9 is green in AE's label colors)
    controlsLayer.label = 9;
    
    // Position in top left corner
    controlsLayer.property("Transform").property("Position").setValue([0, 0]);
    
    // Add slider control for delay
    var sliderEffect = controlsLayer.Effects.addProperty("ADBE Slider Control");
    sliderEffect.name = "Stagger Delay (frames)";
    sliderEffect.property("Slider").setValue(30);
    
    // Add fade out percentage control
    var fadeOutEffect = controlsLayer.Effects.addProperty("ADBE Slider Control");
    fadeOutEffect.name = "Fade Out %";
    fadeOutEffect.property("Slider").setValue(40);
    
    // Add global opacity control
    var globalOpacityEffect = controlsLayer.Effects.addProperty("ADBE Slider Control");
    globalOpacityEffect.name = "Shimmer Opacity";
    globalOpacityEffect.property("Slider").setValue(100);
    
    // Add opacity keyframes with inverted timing (starts at 100%, fades to fade out %)
    var opacity = controlsLayer.property("Transform").property("Opacity");
    
    // Calculate times based on frame rate
    var fps = comp.frameRate;
    var fadeOutDuration = 18 / fps;  // 300ms = 18 frames at 60fps
    var fadeInDuration = 42 / fps;   // 700ms = 42 frames at 60fps
    var waitDuration = 20 / fps;     // 333ms = 20 frames at 60fps
    
    var currentTime = 0;
    
    // Keyframe 1: Start at 100%
    opacity.setValueAtTime(currentTime, 100);
    
    // Keyframe 2: Fade to 40% over 18 frames
    currentTime += fadeOutDuration;
    opacity.setValueAtTime(currentTime, 40);
    
    // Keyframe 3: Fade back to 100% over 42 frames
    currentTime += fadeInDuration;
    opacity.setValueAtTime(currentTime, 100);
    
    // Keyframe 4: Wait 20 frames (stay at 100%)
    currentTime += waitDuration;
    opacity.setValueAtTime(currentTime, 100);
    
    // Set all keyframes to use custom bezier easing (0.40, 0.00, 0.20, 1.00)
    // Current: 0.40, 0.00, 0.25, 1.00 - First handle PERFECT! Just need second 0.25→0.20
    // Keep easeIn exactly the same, slightly increase easeOut speed for -0.05
    var easeIn = new KeyframeEase(0.04, 75);   // PERFECT - don't change!
    var easeOut = new KeyframeEase(0.94, 35);  // Revert to working values
    
    for (var k = 1; k <= opacity.numKeys; k++) {
        opacity.setInterpolationTypeAtKey(k, KeyframeInterpolationType.BEZIER);
        opacity.setTemporalEaseAtKey(k, [easeIn], [easeOut]);
    }
    
    // Add loop expression to opacity
    opacity.expression = 'loopOut("cycle");';
    
    return controlsLayer;
}

// Apply shimmer effect to a layer
function applyShimmerToLayer(layer, shimmerNum, controlsLayer) {
    // Format number with leading zero
    var numStr = shimmerNum < 10 ? "0" + shimmerNum : shimmerNum.toString();
    layer.name = "Shimmer - " + numStr;
    
    // Set layer label color to sea foam (label 7)
    layer.label = 7;
    
    // Get the layer's current opacity value
    var currentOpacity = layer.property("Transform").property("Opacity").value;
    
    // Apply shimmer expression that respects original opacity
    var shimmerExpression = [
        '// Store original opacity',
        'var originalOpacity = ' + currentOpacity + ';',
        '',
        '// Get the controls layer',
        'var controls = thisComp.layer("Shimmer Controls");',
        'var controlsOpacity = controls.opacity;',
        '',
        '// Get fade out percentage from slider',
        'var fadeOutPercent = controls.effect("Fade Out %")("Slider");',
        '',
        '// Get global opacity from slider',
        'var globalOpacity = controls.effect("Shimmer Opacity")("Slider");',
        '',
        '// Get stagger delay value from slider',
        'var staggerFrames = controls.effect("Stagger Delay (frames)")("Slider");',
        '',
        '// Calculate visual center using sourceRectAtTime',
        '// This works for all layer types including shape layers',
        'var rect = thisLayer.sourceRectAtTime(time, false);',
        'var visualPos = thisLayer.toComp([rect.left + rect.width/2, rect.top + rect.height/2]);',
        '',
        '// Calculate position-based delay using visual position',
        'var myPos = visualPos;',
        'var compWidth = thisComp.width;',
        'var compHeight = thisComp.height;',
        '',
        '// Calculate diagonal distance from top-left',
        'var distX = myPos[0];',
        'var distY = myPos[1];',
        'var diagonalDist = Math.sqrt(distX * distX + distY * distY);',
        '',
        '// Calculate maximum possible diagonal distance',
        'var maxDist = Math.sqrt(compWidth * compWidth + compHeight * compHeight);',
        '',
        '// Normalize distance to 0-1 range',
        'var normalizedDist = diagonalDist / maxDist;',
        '',
        '// Convert stagger frames to time',
        'var delayTime = (staggerFrames * normalizedDist) * thisComp.frameDuration;',
        '',
        '// Get the delayed control opacity value',
        'var delayedControlOpacity = controlsOpacity.valueAtTime(time - delayTime);',
        '',
        '// Map control opacity to use the fade out percentage',
        '// When control is at 100%, use full original opacity',
        '// When control is at 40%, use fadeOutPercent of original opacity',
        'var shimmerRange = linear(delayedControlOpacity, 40, 100, fadeOutPercent/100, 1);',
        '',
        '// Apply both shimmer and global opacity',
        'originalOpacity * shimmerRange * (globalOpacity/100);'
    ].join('\n');
    
    // Apply opacity expression
    layer.property("Transform").property("Opacity").expression = shimmerExpression;
}

// Add Blur functionality - Apply material blur presets and convert to adjustment layer
function addBlurFromPanel(materialType) {
    try {
        // Check if we have a selected layer
        var comp = app.project.activeItem;
        if (!comp || !(comp instanceof CompItem)) {
            alert("Please select a composition first.");
            return "error";
        }
        
        var selectedLayers = comp.selectedLayers;
        if (!selectedLayers || selectedLayers.length === 0) {
            alert("Please select a layer to apply blur to.");
            return "error";
        }
        
        var targetLayer = selectedLayers[0]; // Apply to first selected layer
        var materialDebugInfo = [];
        
        // Debug layer information
        materialDebugInfo.push("=== MATERIAL LAYER DEBUG ===");
        materialDebugInfo.push("Layer name: " + targetLayer.name);
        materialDebugInfo.push("Layer type: " + targetLayer.toString());
        materialDebugInfo.push("Layer instanceof AVLayer: " + (targetLayer instanceof AVLayer));
        
        if (targetLayer instanceof AVLayer) {
            materialDebugInfo.push("Has source: " + (targetLayer.source !== null));
            if (targetLayer.source) {
                materialDebugInfo.push("Source type: " + targetLayer.source.toString());
                materialDebugInfo.push("Source instanceof FootageItem: " + (targetLayer.source instanceof FootageItem));
                
                if (targetLayer.source instanceof FootageItem) {
                    materialDebugInfo.push("Has footageSource: " + (targetLayer.source.footageSource !== null));
                    if (targetLayer.source.footageSource) {
                        materialDebugInfo.push("FootageSource type: " + targetLayer.source.footageSource.toString());
                        materialDebugInfo.push("FootageSource instanceof SolidSource: " + (targetLayer.source.footageSource instanceof SolidSource));
                    }
                }
            }
        }
        
        // Enhanced solid layer detection for materials
        var isSolidLayer = false;
        
        // Method 1: Standard instanceof check
        if (targetLayer instanceof AVLayer && targetLayer.source instanceof FootageItem && 
            targetLayer.source.footageSource instanceof SolidSource) {
            isSolidLayer = true;
            materialDebugInfo.push("✓ Detected as solid via SolidSource instanceof");
        }
        
        // Method 2: Check for color property (solids have this)
        if (targetLayer instanceof AVLayer && targetLayer.source instanceof FootageItem && 
            targetLayer.source.footageSource && 
            typeof targetLayer.source.footageSource.color !== 'undefined') {
            isSolidLayer = true;
            materialDebugInfo.push("✓ Detected as solid via color property");
        }
        
        // Method 3: Check layer name pattern
        if (targetLayer.name && targetLayer.name.indexOf("Solid") === 0) {
            isSolidLayer = true;
            materialDebugInfo.push("✓ Detected as solid via name pattern");
        }
        
        if (isSolidLayer) {
            materialDebugInfo.push("❌ BLOCKED: This is a solid layer");
            alert("Cannot apply material presets to solid layers. Please select a shape layer, text layer, or other content layer.");
            return "error|" + materialDebugInfo.join("|");
        } else {
            materialDebugInfo.push("✅ ALLOWED: This is not a solid layer");
        }
        
        // Build the preset file path
        var presetFileName = materialType + ".ffx";
        var presetPath = extensionRoot + "/assets/presets/Materials/" + presetFileName;
        var presetFile = new File(presetPath);
        
        // Check alternate path separator for Windows compatibility
        if (!presetFile.exists) {
            presetPath = extensionRoot + "\\assets\\presets\\Materials\\" + presetFileName;
            presetFile = new File(presetPath);
        }
        
        if (!presetFile.exists) {
            alert("Cannot find material blur preset file:\n" + presetFileName + "\n\nExpected location:\n" + presetPath);
            return "error";
        }
        
        app.beginUndoGroup("Add Material Blur");
        
        try {
            // Convert layer to adjustment layer
            targetLayer.adjustmentLayer = true;
            materialDebugInfo.push("🔧 Converted to adjustment layer");
            
            // Remove existing material-related effects before applying new preset
            var removalDebugInfo = removeMaterialEffects(targetLayer);
            materialDebugInfo = materialDebugInfo.concat(removalDebugInfo);
            
            // Ensure the layer remains selected after effect removal
            targetLayer.selected = true;
            materialDebugInfo.push("🎯 Ensured layer remains selected after effect removal");
            
            // Check layer count before applying preset
            var layerCountBefore = comp.numLayers;
            materialDebugInfo.push("📊 Layer count before: " + layerCountBefore);
            
            // Apply the preset to the selected layer
            materialDebugInfo.push("📁 Applying preset: " + presetFileName);
            targetLayer.applyPreset(presetFile);
            
            // Check layer count after applying preset
            var layerCountAfter = comp.numLayers;
            materialDebugInfo.push("📊 Layer count after: " + layerCountAfter);
            
            // Debug: Check effects after preset application but before layer cleanup
            materialDebugInfo.push("🔍 Effects after preset application:");
            var effectsAfterPreset = targetLayer.Effects;
            for (var e = 1; e <= effectsAfterPreset.numProperties; e++) {
                var effect = effectsAfterPreset.property(e);
                materialDebugInfo.push("  " + e + ". " + effect.name + " (" + effect.matchName + ")");
            }
            
            if (layerCountAfter > layerCountBefore) {
                var newLayersCount = layerCountAfter - layerCountBefore;
                materialDebugInfo.push("⚠️ WARNING: Preset created " + newLayersCount + " new layers");
                
                // Delete the newly created layers (they're always at the top)
                var deletedLayers = [];
                for (var i = 1; i <= newLayersCount; i++) {
                    var layerToDelete = comp.layer(1); // Always delete layer 1 (top layer)
                    deletedLayers.push(layerToDelete.name + " (" + layerToDelete.toString() + ")");
                    layerToDelete.remove();
                }
                
                materialDebugInfo.push("🗑️ Deleted " + newLayersCount + " unwanted layers:");
                for (var j = 0; j < deletedLayers.length; j++) {
                    materialDebugInfo.push("  - Deleted: " + deletedLayers[j]);
                }
            }
            
            materialDebugInfo.push("✅ Preset applied successfully");
            
            // Rename ALL material effects to include material type prefix
            var effects = targetLayer.Effects;
            var renamedCount = 0;
            
            // List of common material effect names to rename
            var materialEffectNames = [
                "Hue/Saturation", "Tint", "Brightness & Contrast", "Curves", "Levels",
                "Color Balance", "Photo Filter", "Vibrance", "Channel Mixer", "Selective Color",
                "Color Lookup", "Exposure", "Shadows/Highlights", "Tritone", "Fast Blur",
                "Gaussian Blur", "Motion Blur", "Radial Blur", "Directional Blur", "Box Blur",
                "Fast Box Blur"
            ];
            
            // Find and rename material effects on the layer
            for (var e = 1; e <= effects.numProperties; e++) {
                var effect = effects.property(e);
                if (effect) {
                    var originalName = effect.name;
                    var shouldRename = false;
                    
                    // Check if this effect should be renamed
                    for (var i = 0; i < materialEffectNames.length; i++) {
                        if (originalName === materialEffectNames[i] || originalName.indexOf(materialEffectNames[i]) === 0) {
                            shouldRename = true;
                            break;
                        }
                    }
                    
                    // Also rename any effect that doesn't already have the material type prefix
                    if (shouldRename && originalName.indexOf(materialType + " - ") !== 0) {
                        var newName = materialType + " - " + originalName;
                        effect.name = newName;
                        renamedCount++;
                        materialDebugInfo.push("🏷️ Renamed effect: " + originalName + " → " + newName);
                    }
                }
            }
            
            if (renamedCount > 0) {
                materialDebugInfo.push("✅ Renamed " + renamedCount + " material effects with prefix: " + materialType + " -");
            }
            
            // List all effects after renaming for debugging
            materialDebugInfo.push("📋 Final effects on layer:");
            for (var e = 1; e <= effects.numProperties; e++) {
                var effect = effects.property(e);
                materialDebugInfo.push("  " + e + ". " + effect.name);
            }
            
            // Return success with debug info
            return "success|" + materialDebugInfo.join("|");
            
        } catch(applyError) {
            alert("Error applying material blur preset: " + applyError.toString());
            return "error";
        }
        
    } catch(e) {
        alert("Error adding material blur: " + e.toString());
        return "error";
    } finally {
        app.endUndoGroup();
    }
}

// Remove material-related effects from a layer before applying new material preset
function removeMaterialEffects(layer) {
    var debugInfo = [];
    try {
        var effects = layer.Effects;
        var effectsToRemove = [];
        
        // List of effect match names that should be removed for material swapping
        var materialEffectNames = [
            "ADBE HUE SATURATION",          // Hue/Saturation
            "ADBE Box Blur2",               // Fast Box Blur (corrected matchName)  
            "ADBE Brightness & Contrast 2", // Brightness & Contrast
            "ADBE Tint",                    // Tint
            "ADBE Box Blur"                 // Box Blur (alternative)
        ];
        
        debugInfo.push("=== EFFECT ANALYSIS ===");
        
        // Collect effects to remove (iterate backwards to avoid index issues)
        for (var i = effects.numProperties; i >= 1; i--) {
            var effect = effects.property(i);
            var matchName = effect.matchName;
            var displayName = effect.name; // This includes the numbered versions
            
            // Debug logging 
            debugInfo.push("Effect " + i + ": '" + displayName + "' (matchName: " + matchName + ")");
            
            // Check if this effect should be removed
            var shouldRemove = false;
            for (var j = 0; j < materialEffectNames.length; j++) {
                if (matchName === materialEffectNames[j]) {
                    shouldRemove = true;
                    effectsToRemove.push(i);
                    debugInfo.push("✓ WILL REMOVE: " + displayName);
                    break;
                }
            }
            
            if (!shouldRemove) {
                debugInfo.push("→ KEEPING: " + displayName + " (not a material effect)");
            }
        }
        
        // Remove the identified effects (reverse sort to maintain proper indices)
        effectsToRemove.sort(function(a, b) { return b - a; }); // Descending order
        
        for (var k = 0; k < effectsToRemove.length; k++) {
            try {
                var effectIndex = effectsToRemove[k];
                var effectToRemove = effects.property(effectIndex);
                var effectName = effectToRemove.name;
                effectToRemove.remove();
                debugInfo.push("✓ Removed effect: " + effectName + " (was at index " + effectIndex + ")");
            } catch(removeError) {
                debugInfo.push("✗ Could not remove effect at index " + effectsToRemove[k] + ": " + removeError.toString());
            }
        }
        
        if (effectsToRemove.length > 0) {
            debugInfo.push("🗑️ Removed " + effectsToRemove.length + " existing material effects");
        } else {
            debugInfo.push("ℹ️ No existing material effects found to remove");
        }
        
    } catch(error) {
        debugInfo.push("Error removing material effects: " + error.toString());
    }
    
    return debugInfo;
}

// ============================================================================
// SPRING PHYSICS & BAKING FUNCTIONS
// COPIED FROM: Sproing v0.94.2 (SpringBaker.jsx)
// SOURCE: /Users/jonas_naimark/Documents/Sproing/host/SpringBaker.jsx
// DATE COPIED: 2025-10-08
// LINES: 17-37, 41-65, 68-88, 91-96, 99-230, 574-641
//
// DO NOT MODIFY THESE FUNCTIONS - Keep identical to Sproing source
// Any changes here will break unbake compatibility with Sproing
// ============================================================================

/**
 * valueDeviation - Calculate perpendicular deviation from line
 * COPIED FROM: Sproing v0.94.2 (SpringBaker.jsx lines 17-37)
 */
function valueDeviation(pt, lineStart, lineEnd) {
    var dx = lineEnd.x - lineStart.x;
    var dim = pt.y.length;  // Number of dimensions

    if (dx === 0) {
        var distSq = 0;
        for (var d = 0; d < dim; d++) {
            distSq += Math.pow(pt.y[d] - lineStart.y[d], 2);
        }
        return Math.sqrt(distSq);
    }

    var s = (pt.x - lineStart.x) / dx;
    s = Math.max(0, Math.min(1, s));

    var distSq = 0;
    for (var d = 0; d < dim; d++) {
        var interp = lineStart.y[d] + s * (lineEnd.y[d] - lineStart.y[d]);
        distSq += Math.pow(pt.y[d] - interp, 2);
    }
    return Math.sqrt(distSq);
}

/**
 * douglasPeucker - Recursive curve simplification algorithm
 * COPIED FROM: Sproing v0.94.2 (SpringBaker.jsx lines 41-65)
 */
function douglasPeucker(points, epsilon) {
    if (points.length < 3) return points;

    var dmax = 0;
    var index = 0;
    var end = points.length - 1;

    for (var i = 1; i < end; i++) {
        var d = valueDeviation(points[i], points[0], points[end]);
        if (d > dmax) {
            index = i;
            dmax = d;
        }
    }

    var results = [];
    if (dmax > epsilon) {
        var recResults1 = douglasPeucker(points.slice(0, index + 1), epsilon);
        var recResults2 = douglasPeucker(points.slice(index), epsilon);
        results = recResults1.slice(0, -1).concat(recResults2);
    } else {
        results = [points[0], points[end]];
    }
    return results;
}

/**
 * getOriginalValueAtTime - Interpolate original value at time t (multi-dim)
 * COPIED FROM: Sproing v0.94.2 (SpringBaker.jsx lines 68-88)
 */
function getOriginalValueAtTime(t, originalPoints, dim) {
    if (originalPoints.length === 0) return new Array(dim).fill(0);  // Fallback

    // Find bracketing points
    for (var i = 0; i < originalPoints.length - 1; i++) {
        if (originalPoints[i].x <= t && t <= originalPoints[i + 1].x) {
            var frac = (t - originalPoints[i].x) / (originalPoints[i + 1].x - originalPoints[i].x);
            var y = [];
            for (var d = 0; d < dim; d++) {
                y[d] = originalPoints[i].y[d] + frac * (originalPoints[i + 1].y[d] - originalPoints[i].y[d]);
            }
            return y;
        }
    }

    // Extrapolate if outside (though shouldn't happen)
    if (t < originalPoints[0].x) {
        return originalPoints[0].y.slice();
    }
    return originalPoints[originalPoints.length - 1].y.slice();
}

/**
 * PRECISION_SETTINGS - Precision configuration for spring baking
 * COPIED FROM: Sproing v0.94.2 (SpringBaker.jsx lines 91-96)
 */
var PRECISION_SETTINGS = {
    'max': { precision: 0, maxGapFrames: 0 },    // 0 precision = use current dense baking
    'high': { precision: 10, maxGapFrames: 10 },
    'medium': { precision: 5, maxGapFrames: 15 },
    'low': { precision: 1, maxGapFrames: 20 }
};

/**
 * generateFullSpringCurve - Generate full spring curve data
 * COPIED FROM: Sproing v0.94.2 (SpringBaker.jsx lines 99-172)
 */
function generateFullSpringCurve(t1, t2, v1, v2, dampingRatio, stiffness, mass, frameRate, maxFrames) {
    var points = [];

    if (v1 instanceof Array && v2 instanceof Array && v1.length === v2.length) {
        // Multi-dimensional
        var dim = v1.length;
        var allValues = [];

        // Generate spring values for each dimension
        for (var d = 0; d < dim; d++) {
            var values = [];
            var settled = false;
            var i = 0;
            while (!settled && i < maxFrames) {
                var springVals = androidSpring(dampingRatio, stiffness, mass, v1[d], v2[d], i, frameRate);
                values = springVals;
                settled = isSettled(values, v2[d], 0.01, frameRate);
                i++;
            }
            if (values.length < 2) {
                values = androidSpring(dampingRatio, stiffness, mass, v1[d], v2[d], 1, frameRate);
            }
            allValues.push(values);
        }

        // Pad all dimensions to same length
        var maxLen = 0;
        for (var d = 0; d < dim; d++) {
            if (allValues[d].length > maxLen) maxLen = allValues[d].length;
        }
        for (var d = 0; d < dim; d++) {
            while (allValues[d].length < maxLen) {
                allValues[d].push(allValues[d][allValues[d].length - 1]);
            }
        }

        // Create points array
        for (var i = 0; i < maxLen; i++) {
            var t = t1 + (i / frameRate);
            var y = [];
            for (var d = 0; d < dim; d++) {
                y[d] = allValues[d][i];
            }
            points.push({x: t, y: y});
        }
    } else {
        // Single-dimensional
        if (v1 instanceof Array) v1 = v1[0];
        if (v2 instanceof Array) v2 = v2[0];

        var values = [];
        var settled = false;
        var i = 1;
        while (!settled && i < maxFrames) {
            var springVals = androidSpring(dampingRatio, stiffness, mass, v1, v2, i, frameRate);
            values = springVals;
            if (values.length >= 2) {
                settled = isSettled(values, v2, 0.01, frameRate);
            }
            i++;
        }

        if (values.length < 2) {
            values = androidSpring(dampingRatio, stiffness, mass, v1, v2, 1, frameRate);
        }

        for (var j = 0; j < values.length; j++) {
            var t = t1 + (j / frameRate);
            points.push({x: t, y: [values[j]]});
        }
    }

    return points;
}

/**
 * findInflectionPoints - Find points where velocity changes direction (bounce points)
 * COPIED FROM: Sproing v1.2.6 (SpringBaker.jsx lines 196-230)
 */
function findInflectionPoints(points) {
    if (points.length < 3) return [];

    var inflectionIndices = [];
    var dim = points[0].y.length;

    // Check each dimension for velocity direction changes
    for (var d = 0; d < dim; d++) {
        for (var i = 1; i < points.length - 1; i++) {
            // Calculate velocity before and after this point
            var v1 = points[i].y[d] - points[i - 1].y[d];
            var v2 = points[i + 1].y[d] - points[i].y[d];

            // If velocity changes sign, this is an inflection point (direction reversal)
            if (v1 * v2 < 0 && Math.abs(v1) > 0.001 && Math.abs(v2) > 0.001) {
                // Add index if not already in list
                var alreadyAdded = false;
                for (var j = 0; j < inflectionIndices.length; j++) {
                    if (inflectionIndices[j] === i) {
                        alreadyAdded = true;
                        break;
                    }
                }
                if (!alreadyAdded) {
                    inflectionIndices.push(i);
                }
            }
        }
    }

    // Sort indices
    inflectionIndices.sort(function(a, b) { return a - b; });

    return inflectionIndices;
}

/**
 * simplifySpringKeyframes - Simplify spring keyframes using CleanBakedKeys algorithm
 * UPDATED: Sproing v1.2.6 - Added inflection point preservation
 */
function simplifySpringKeyframes(fullCurveData, precisionSetting, frameRate) {
    if (!PRECISION_SETTINGS[precisionSetting] || precisionSetting === 'max') {
        return fullCurveData; // Return all points for max precision
    }

    var settings = PRECISION_SETTINGS[precisionSetting];
    var precision = settings.precision;
    var maxGapFrames = settings.maxGapFrames;

    if (fullCurveData.length < 3) return fullCurveData;

    var dim = fullCurveData[0].y.length;
    var frameDuration = 1.0 / frameRate;

    // Scale precision and max gap based on dimensionality
    var scaledPrecision = dim >= 2 ? precision * 2 : precision;
    var scaledMaxGapFrames = dim >= 2 ? Math.max(1, Math.round(maxGapFrames / 2)) : maxGapFrames;

    var epsilon = 20 * Math.pow(0.25, (scaledPrecision - 1) / 9);
    var maxGapTime = scaledMaxGapFrames * frameDuration;

    // Find inflection points (where velocity changes direction) - these MUST be preserved
    var inflectionIndices = findInflectionPoints(fullCurveData);

    // Apply Douglas-Peucker simplification with inflection point preservation
    var simplifiedPoints;
    if (inflectionIndices.length === 0) {
        // No inflection points, simplify normally
        simplifiedPoints = douglasPeucker(fullCurveData, epsilon);
    } else {
        // Split curve at inflection points and simplify each segment separately
        // This ensures inflection points (bounces/rebounds) are always preserved
        simplifiedPoints = [];
        var segmentStart = 0;

        for (var i = 0; i < inflectionIndices.length; i++) {
            var segmentEnd = inflectionIndices[i];

            // Simplify segment from segmentStart to segmentEnd
            var segment = fullCurveData.slice(segmentStart, segmentEnd + 1);
            var simplifiedSegment = douglasPeucker(segment, epsilon);

            // Add all points except the last one (to avoid duplicates)
            for (var j = 0; j < simplifiedSegment.length - 1; j++) {
                simplifiedPoints.push(simplifiedSegment[j]);
            }

            segmentStart = segmentEnd;
        }

        // Simplify final segment from last inflection point to end
        var finalSegment = fullCurveData.slice(segmentStart);
        var simplifiedFinalSegment = douglasPeucker(finalSegment, epsilon);
        for (var j = 0; j < simplifiedFinalSegment.length; j++) {
            simplifiedPoints.push(simplifiedFinalSegment[j]);
        }
    }

    // Insert points in large gaps if maxGapTime > 0
    if (maxGapTime > 0) {
        var keyTimes = [];
        for (var i = 0; i < simplifiedPoints.length; i++) {
            keyTimes.push(simplifiedPoints[i].x);
        }

        var newKeyTimes = [];
        for (var i = 0; i < keyTimes.length - 1; i++) {
            newKeyTimes.push(keyTimes[i]);
            var dt = keyTimes[i + 1] - keyTimes[i];
            if (dt > maxGapTime) {
                var numInsert = Math.ceil(dt / maxGapTime) - 1;
                for (var j = 1; j <= numInsert; j++) {
                    var newT = keyTimes[i] + j * (dt / (numInsert + 1));
                    newKeyTimes.push(newT);
                }
            }
        }
        newKeyTimes.push(keyTimes[keyTimes.length - 1]);

        // Sort and rebuild points
        newKeyTimes.sort(function(a, b) { return a - b; });
        simplifiedPoints = [];
        for (var i = 0; i < newKeyTimes.length; i++) {
            var val = getOriginalValueAtTime(newKeyTimes[i], fullCurveData, dim);
            simplifiedPoints.push({x: newKeyTimes[i], y: val});
        }
    }

    return simplifiedPoints;
}

/**
 * isSettled - Check if spring animation has settled
 * COPIED FROM: Sproing v0.94.2 (SpringBaker.jsx lines 574-579)
 */
function isSettled(values, endValue, threshold, frameRate) {
    var last = values[values.length - 1];
    var prev = values[values.length - 2];
    var velocity = Math.abs(last - prev) * frameRate;
    return Math.abs(last - endValue) < threshold && velocity < threshold;
}

/**
 * androidSpring - Android spring physics calculation (damped harmonic oscillator)
 * COPIED FROM: Sproing v0.94.2 (SpringBaker.jsx lines 581-641)
 */
function androidSpring(dampingRatio, stiffness, mass, fromValue, toValue, numFrames, frameRate) {
    // Validate inputs to prevent mathematical errors
    if (!dampingRatio || dampingRatio <= 0) dampingRatio = 1;
    if (!stiffness || stiffness <= 0) stiffness = 175;
    if (!mass || mass <= 0) mass = 1;
    if (!frameRate || frameRate <= 0) frameRate = 30;
    if (!numFrames || numFrames < 0) numFrames = 30;

    var omega0 = Math.sqrt(stiffness / mass);
    var zeta = dampingRatio;
    var x0 = fromValue - toValue;
    var v0 = 0;
    var result = [];
    var dt = 1.0 / frameRate;

    // Handle edge case where fromValue equals toValue
    if (Math.abs(x0) < 1e-6) {
        for (var i = 0; i <= numFrames; i++) {
            result.push(toValue);
        }
        return result;
    }
    for (var i = 0; i <= numFrames; i++) {
        var t = i * dt;
        var value;
        try {
            if (zeta < 1) {
                // Underdamped
                var omegaD = omega0 * Math.sqrt(1 - zeta * zeta);
                if (omegaD === 0) omegaD = 1e-6; // Prevent division by zero
                value = Math.exp(-zeta * omega0 * t) *
                    (x0 * Math.cos(omegaD * t) +
                     ((v0 + zeta * omega0 * x0) / omegaD) * Math.sin(omegaD * t));
            } else if (zeta === 1) {
                // Critically damped
                value = (x0 + (v0 + omega0 * x0) * t) * Math.exp(-omega0 * t);
            } else {
                // Overdamped
                var omegaD = omega0 * Math.sqrt(zeta * zeta - 1);
                if (omegaD === 0) omegaD = 1e-6; // Prevent division by zero
                var expTerm1 = Math.exp((-zeta * omega0 + omegaD) * t);
                var expTerm2 = Math.exp((-zeta * omega0 - omegaD) * t);
                var C1 = (v0 + (zeta + Math.sqrt(zeta * zeta - 1)) * omega0 * x0) / (2 * omegaD);
                var C2 = (v0 + (zeta - Math.sqrt(zeta * zeta - 1)) * omega0 * x0) / (2 * omegaD);
                value = C1 * expTerm1 + C2 * expTerm2;
            }

            // Check for invalid numbers
            if (!isFinite(value) || isNaN(value)) {
                value = (i === 0) ? x0 : 0; // Use starting displacement or settled value
            }

            result.push(toValue + value);
        } catch (e) {
            // If calculation fails, use linear interpolation as fallback
            var progress = i / numFrames;
            result.push(fromValue + (toValue - fromValue) * progress);
        }
    }
    return result;
}

// ============================================================================
// END SPRING PHYSICS FUNCTIONS (from Sproing)
// ============================================================================

// ============================================================================
// HELPER FUNCTIONS FOR SPRING-AWARE MIRROR KEYS
// ============================================================================

/**
 * findMarkerAtTime - Find marker at specific time within tolerance
 */
function findMarkerAtTime(markerProp, time, epsilon) {
    if (!markerProp || markerProp.numKeys === 0) return null;

    for (var m = 1; m <= markerProp.numKeys; m++) {
        var markerTime = markerProp.keyTime(m);
        if (Math.abs(markerTime - time) < epsilon) {
            return {index: m, time: markerTime};
        }
    }
    return null;
}

// (Removed duplicate getUniquePropertyId; using core Sproing-compatible implementation defined earlier)

/**
 * parseSpringFromMarker - Extract spring parameters from marker comment for specific property
 */
function parseSpringFromMarker(markerComment, uniquePropId) {
    if (!markerComment || markerComment === "") return null;

    // Split by separator to find blocks
    var separator = "=======================================";
    var blocks = markerComment.split(separator);

    // Find the block for this property
    var targetBlock = null;
    for (var i = 0; i < blocks.length; i++) {
        var block = blocks[i];
        if (block.indexOf("| Property: " + uniquePropId) !== -1) {
            targetBlock = block;
            break;
        }
    }

    if (!targetBlock) return null;

    // Parse spring parameters using regex
    var stiffnessMatch = targetBlock.match(/Stiffness:\s*([\d.]+)/i);
    var dampingRatioMatch = targetBlock.match(/Damping Ratio:\s*([\d.]+)/i);
    var massMatch = targetBlock.match(/Mass:\s*([\d.]+)/i);

    if (!stiffnessMatch || !dampingRatioMatch) return null;

    var stiffness = parseFloat(stiffnessMatch[1]);
    var dampingRatio = parseFloat(dampingRatioMatch[1]);
    var mass = massMatch ? parseFloat(massMatch[1]) : 1;

    // Try to extract preset name (first line of block)
    var lines = targetBlock.split("\n");
    var presetName = null;
    for (var i = 0; i < lines.length; i++) {
        var line = lines[i].trim();
        if (line !== "" && line.indexOf("Stiffness:") === -1 && line.indexOf("| Property:") === -1) {
            presetName = line;
            break;
        }
    }

    return {
        stiffness: stiffness,
        dampingRatio: dampingRatio,
        mass: mass,
        presetName: presetName,
        blockText: targetBlock
    };
}

/**
 * createSpringBlock - Format spring data block in Sproing format
 */
function createSpringBlock(stiffness, dampingRatio, mass, uniquePropId, presetName) {
    // Match Sproing block core (no extra blank lines before Property; merge appends separator)
    var dampingAbs = 2 * dampingRatio * Math.sqrt(stiffness);
    var title = presetName || "Custom Spring";
    var core = title + "\n" +
        "Stiffness: " + stiffness + ", Damping: " + dampingAbs.toFixed(2) + ", Damping Ratio: " + dampingRatio + ", Mass: " + mass + "\n" +
        "| Property: " + uniquePropId;
    return core;
}

/**
 * createOrUpdateMirroredMarker - Create or update marker with spring data
 * Handles multi-property markers by preserving other property blocks
 */
function createOrUpdateMirroredMarker(markerProp, targetTime, springBlock, uniquePropId, epsilon) {
    var existingMarkerData = findMarkerAtTime(markerProp, targetTime, epsilon);

    var separator = "=======================================";
    // Normalize input block core and append exact spacing before separator
    function normalizeBlockCore(blockText) {
        if (!blockText) return "";
        var parts = blockText.split(separator);
        var core = parts[0];
        // Trim leading/trailing whitespace to avoid extra blank lines between blocks
        core = core.replace(/^\s+/,'').replace(/\s+$/,'');
        return core;
    }

    var newBlockCore = normalizeBlockCore(springBlock);
    var newBlockWithSep = newBlockCore + "\n\n" + separator + "\n";

    if (existingMarkerData) {
        // Marker exists - parse and merge blocks
        var markerIdx = existingMarkerData.index;
        var markerTime = markerProp.keyTime(markerIdx);
        var existingComment = markerProp.keyValue(markerIdx).comment || "";

        // Split by separator and rebuild blocks excluding current property
        var rawBlocks = existingComment.split(separator);
        var rebuilt = "";
        for (var i = 0; i < rawBlocks.length; i++) {
            var blockRaw = rawBlocks[i];
            var blockCore = normalizeBlockCore(blockRaw);
            if (!blockCore) continue;
            if (blockCore.indexOf("| Property: " + uniquePropId) !== -1) {
                continue; // remove old block for this property
            }
            // Re-append kept block with exact spacing before separator
            rebuilt += blockCore + "\n\n" + separator + "\n";
        }
        // Append the new block with separator
        rebuilt += newBlockWithSep;

        // Update existing marker
        var markerValue = markerProp.keyValue(markerIdx);
        markerValue.comment = rebuilt;
        markerProp.setValueAtKey(markerIdx, markerValue);
        DEBUG_JSX.log("Updated existing marker at time " + markerTime.toFixed(3) + " with new spring block");
    } else {
        // No marker exists - create new one (single block + separator)
        var newMarker = new MarkerValue(newBlockWithSep);
        markerProp.setValueAtTime(targetTime, newMarker);
        DEBUG_JSX.log("Created new marker at time " + targetTime.toFixed(3));
    }
}

/**
 * extractSpringBlockFromMarker - Extract spring block for specific property from marker comment
 * Returns the spring block text (without separator) or null if not found
 */
function extractSpringBlockFromMarker(markerComment, uniquePropId) {
    if (!markerComment || markerComment === "") return null;

    var separator = "=======================================";
    var blocks = markerComment.split(separator);

    for (var i = 0; i < blocks.length; i++) {
        var block = blocks[i];
        var trimmedBlock = block.replace(/^\s+/,'').replace(/\s+$/,'');
        if (trimmedBlock && trimmedBlock.indexOf("| Property: " + uniquePropId) !== -1) {
            return trimmedBlock;
        }
    }
    return null;
}

/**
 * removeSpringBlockFromMarker - Remove spring block for specific property from marker comment
 * Returns updated comment with block removed, or null if all blocks were removed
 */
function removeSpringBlockFromMarker(markerComment, uniquePropId) {
    if (!markerComment || markerComment === "") return null;

    var separator = "=======================================";
    var blocks = markerComment.split(separator);
    var rebuilt = "";

    for (var i = 0; i < blocks.length; i++) {
        var block = blocks[i];
        var trimmedBlock = block.replace(/^\s+/,'').replace(/\s+$/,'');

        // Skip empty blocks and blocks matching this property
        if (!trimmedBlock || trimmedBlock.indexOf("| Property: " + uniquePropId) !== -1) {
            continue;
        }

        // Keep this block
        rebuilt += trimmedBlock + "\n\n" + separator + "\n";
    }

    // Return null if no blocks remain (marker should be deleted)
    return rebuilt === "" ? null : rebuilt;
}

/**
 * countSpringBlocksInMarker - Count number of spring blocks in marker comment
 */
function countSpringBlocksInMarker(markerComment) {
    if (!markerComment || markerComment === "") return 0;

    var separator = "=======================================";
    var blocks = markerComment.split(separator);
    var count = 0;

    for (var i = 0; i < blocks.length; i++) {
        var block = blocks[i];
        var trimmedBlock = block.replace(/^\s+/,'').replace(/\s+$/,'');
        // Count blocks that contain "| Property:" line
        if (trimmedBlock && trimmedBlock.indexOf("| Property:") !== -1) {
            count++;
        }
    }

    return count;
}

/**
 * smartSplitMergeMarker - Intelligently split or merge spring blocks when moving properties
 *
 * This handles:
 * - SPLIT: When moving one property away from a multi-property marker
 * - MERGE: When moving a property to a time where another marker exists
 * - CLEANUP: Deletes markers when all blocks are removed
 *
 * @param markerProp - The marker property (layer.marker or comp.markerProperty)
 * @param oldTime - Original time of the property's first keyframe
 * @param newTime - New time of the property's first keyframe
 * @param uniquePropId - Unique property identifier (from getUniquePropertyId)
 * @param epsilon - Time tolerance for finding markers
 * @returns {string} - Debug status message
 */
function smartSplitMergeMarker(markerProp, oldTime, newTime, uniquePropId, epsilon) {
    if (!markerProp) return "no marker property";

    var separator = "=======================================";
    var statusMsg = "";

    try {
        // Find marker at OLD time
        var oldMarkerData = findMarkerAtTime(markerProp, oldTime, epsilon);
        if (!oldMarkerData) {
            return "no marker at old time"; // No marker to split/move
        }

        var oldMarkerIdx = oldMarkerData.index;
        var oldMarkerValue = markerProp.keyValue(oldMarkerIdx);
        var oldMarkerComment = oldMarkerValue.comment || "";

        // Extract the spring block for this property
        var springBlock = extractSpringBlockFromMarker(oldMarkerComment, uniquePropId);
        if (!springBlock) {
            return "no spring block for property"; // This property isn't in the marker
        }

        DEBUG_JSX.log("SMART MARKER: Found spring block for " + uniquePropId + " at " + oldTime.toFixed(3) + "s");

        // Remove this property's block from the old marker
        var oldMarkerUpdated = removeSpringBlockFromMarker(oldMarkerComment, uniquePropId);

        if (oldMarkerUpdated === null) {
            // No blocks left - delete the old marker entirely
            markerProp.removeKey(oldMarkerIdx);
            DEBUG_JSX.log("SMART MARKER: Deleted old marker (no blocks remaining)");
            statusMsg = "deleted old marker";
        } else {
            // Update the old marker with remaining blocks
            oldMarkerValue.comment = oldMarkerUpdated;
            markerProp.setValueAtKey(oldMarkerIdx, oldMarkerValue);
            DEBUG_JSX.log("SMART MARKER: Split - removed block from old marker");
            statusMsg = "split from old marker";
        }

        // Find or create marker at NEW time
        var newMarkerData = findMarkerAtTime(markerProp, newTime, epsilon);

        if (newMarkerData) {
            // Marker exists at new time - MERGE
            var newMarkerIdx = newMarkerData.index;
            var newMarkerValue = markerProp.keyValue(newMarkerIdx);
            var newMarkerComment = newMarkerValue.comment || "";

            // Check if this property already has a block at new time (avoid duplicates)
            var existingBlock = extractSpringBlockFromMarker(newMarkerComment, uniquePropId);
            if (existingBlock) {
                // Replace existing block for this property
                var tempComment = removeSpringBlockFromMarker(newMarkerComment, uniquePropId);
                newMarkerComment = tempComment || "";
            }

            // Add the spring block to new marker
            newMarkerComment += springBlock + "\n\n" + separator + "\n";
            newMarkerValue.comment = newMarkerComment;
            markerProp.setValueAtKey(newMarkerIdx, newMarkerValue);

            DEBUG_JSX.log("SMART MARKER: Merged into existing marker at " + newTime.toFixed(3) + "s");
            statusMsg += ", merged to existing";
        } else {
            // No marker at new time - CREATE
            var newMarkerComment = springBlock + "\n\n" + separator + "\n";
            var newMarkerValue = new MarkerValue(newMarkerComment);
            markerProp.setValueAtTime(newTime, newMarkerValue);

            DEBUG_JSX.log("SMART MARKER: Created new marker at " + newTime.toFixed(3) + "s");
            statusMsg += ", created new marker";
        }

        return statusMsg;

    } catch(e) {
        DEBUG_JSX.log("SMART MARKER ERROR: " + e.toString());
        return "error: " + e.toString();
    }
}

/**
 * detectBakingPrecision - Auto-detect if spring was baked with Max precision
 * Max precision = keyframes on every single frame
 */
function detectBakingPrecision(prop, selectedKeyIndices, frameRate) {
    if (selectedKeyIndices.length < 2) {
        return 'medium'; // Not enough keys to detect
    }

    var hasEveryFrame = true;
    var frameTolerance = 0.1; // 10% tolerance for frame alignment

    // Check if keyframes are exactly 1 frame apart
    for (var i = 1; i < selectedKeyIndices.length; i++) {
        var keyIdx1 = selectedKeyIndices[i - 1];
        var keyIdx2 = selectedKeyIndices[i];

        var time1 = prop.keyTime(keyIdx1);
        var time2 = prop.keyTime(keyIdx2);

        var timeDiff = time2 - time1;
        var frameDiff = timeDiff * frameRate;

        // If not exactly 1 frame apart (within tolerance), not Max precision
        if (Math.abs(frameDiff - 1.0) > frameTolerance) {
            hasEveryFrame = false;
            break;
        }
    }

    return hasEveryFrame ? 'max' : 'medium';
}

// ============================================================================
// END HELPER FUNCTIONS
// ============================================================================

// Safe temporal ease restoration: only apply ease to sides that were originally Bezier
function restoreTemporalEaseSafely(prop, idx, inInterp, outInterp, inEase, outEase) {
    try {
        var inEases = (inInterp === KeyframeInterpolationType.BEZIER && inEase) ? inEase : [];
        var outEases = (outInterp === KeyframeInterpolationType.BEZIER && outEase) ? outEase : [];
        if ((inEases && inEases.length) || (outEases && outEases.length)) {
            prop.setTemporalEaseAtKey(idx, inEases, outEases);
        }
    } catch(e) {}
}

// Safe temporal flags restoration: keep linear keys visually linear
function restoreTemporalFlagsSafely(prop, idx, inInterp, outInterp, temporalContinuous, temporalAutoBezier) {
    try {
        // If both sides were linear originally, force auto-bezier and continuity off
        var bothLinear = (inInterp !== KeyframeInterpolationType.BEZIER && outInterp !== KeyframeInterpolationType.BEZIER);
        var autoBezier = bothLinear ? false : temporalAutoBezier;
        var continuous = bothLinear ? false : temporalContinuous;
        prop.setTemporalContinuousAtKey(idx, continuous);
        prop.setTemporalAutoBezierAtKey(idx, autoBezier);
    } catch(e) {}
}

// Mirror selected keyframes: take first and last selected key per property, duplicate them starting at playhead,
// reverse order, set second key at +30 frames, and remove easing and labels.
function mirrorKeysFromPanel(preserveDelays) {
    try {
        app.beginUndoGroup("Mirror Keys");
        var comp = app.project.activeItem;
        if (!comp || !(comp instanceof CompItem)) {
            app.endUndoGroup();
            alert("Please open a composition to mirror keyframes.");
            return "error|No active composition";
        }
        var playheadTime = comp.time;
        var frameRate = comp.frameRate || 60;
        var offsetSeconds = 30 / frameRate;

        // Convert preserveDelays to boolean (handles undefined, "false", false, etc.)
        preserveDelays = preserveDelays === true || preserveDelays === "true";

        var selectedLayers = comp.selectedLayers;
        if (selectedLayers.length === 0) {
            app.endUndoGroup();
            alert("Please select at least one layer with keyframes to mirror.");
            return "error|No layers selected";
        }

        var processedProps = 0;
        DEBUG_JSX.clear();
        DEBUG_JSX.log("Mirror Keys: playhead=" + playheadTime.toFixed(3) + "s, preserveDelays=" + preserveDelays);

        function collectSelectedKeys(prop) {
            var sel = [];
            for (var k = 1; k <= prop.numKeys; k++) {
                if (prop.keySelected(k)) sel.push(k);
            }
            return sel;
        }
        function walkProperties(group, cb) {
            for (var i = 1; i <= group.numProperties; i++) {
                var p = group.property(i);
                if (!p) continue;
                if (p.canVaryOverTime) cb(p);
                if (p.propertyType === PropertyType.INDEXED_GROUP || p.propertyType === PropertyType.NAMED_GROUP) {
                    walkProperties(p, cb);
                }
            }
        }

        for (var li = 0; li < selectedLayers.length; li++) {
            var layer = selectedLayers[li];
            DEBUG_JSX.log("Layer: " + layer.name);

            // Build a unique set of properties to process: prefer selectedProperties, but also walk all to catch selected keys
            var propertiesToProcess = [];
            var seenProps = {};
            // Add from selectedProperties
            var selectedProps = layer.selectedProperties;
            for (var pi = 0; pi < selectedProps.length; pi++) {
                var prop = selectedProps[pi];
                if (!prop || !prop.canVaryOverTime || prop.numKeys === 0) continue;
                var sel = collectSelectedKeys(prop);
                if (sel.length >= 2) {
                    propertiesToProcess.push({ prop: prop, sel: sel });
                    seenProps[prop.name + "@" + prop.propertyIndex] = true;
                }
            }
            // Fallback: walk entire property tree to catch selected keyframes
            walkProperties(layer, function(p) {
                try {
                    if (!p || p.numKeys === 0) return;
                    var keySel = collectSelectedKeys(p);
                    if (keySel.length >= 2) {
                        var key = p.name + "@" + p.propertyIndex;
                        if (!seenProps[key]) {
                            propertiesToProcess.push({ prop: p, sel: keySel });
                            seenProps[key] = true;
                        }
                    }
                } catch(e) {}
            });

            DEBUG_JSX.log("  Found props to mirror: " + propertiesToProcess.length);

            // SHIFT MODE: Find earliest and latest FIRST keyframes across all properties to calculate stagger range
            var globalEarliestFirstKey = null;
            var globalLatestFirstKey = null;
            if (preserveDelays && propertiesToProcess.length > 0) {
                for (var idx = 0; idx < propertiesToProcess.length; idx++) {
                    var entry = propertiesToProcess[idx];
                    var prop = entry.prop;
                    var sel = entry.sel;
                    var keyed = [];
                    for (var ki = 0; ki < sel.length; ki++) {
                        keyed.push({ idx: sel[ki], t: prop.keyTime(sel[ki]) });
                    }
                    keyed.sort(function(a,b){ return a.t - b.t; });
                    var firstKeyTime = keyed[0].t;

                    if (globalEarliestFirstKey === null || firstKeyTime < globalEarliestFirstKey) {
                        globalEarliestFirstKey = firstKeyTime;
                    }
                    if (globalLatestFirstKey === null || firstKeyTime > globalLatestFirstKey) {
                        globalLatestFirstKey = firstKeyTime;
                    }
                }
                var staggerRange = globalLatestFirstKey - globalEarliestFirstKey;
                DEBUG_JSX.log("  STAGGER TIMING: earliest first key=" + globalEarliestFirstKey.toFixed(3) + "s, latest first key=" + globalLatestFirstKey.toFixed(3) + "s, stagger range=" + staggerRange.toFixed(3) + "s");
            }

            for (var idx = 0; idx < propertiesToProcess.length; idx++) {
                var entry = propertiesToProcess[idx];
                var prop = entry.prop;
                var sel = entry.sel;

                // Identify first and last selected keys by time
                var firstIdx = sel[0];
                var lastIdx = sel[sel.length - 1];
                // Sort by time to ensure first/last are temporal bounds (no .map() in ExtendScript)
                var keyed = [];
                for (var ki = 0; ki < sel.length; ki++) {
                    keyed.push({ idx: sel[ki], t: prop.keyTime(sel[ki]) });
                }
                keyed.sort(function(a,b){ return a.t - b.t; });
                firstIdx = keyed[0].idx;
                lastIdx = keyed[keyed.length - 1].idx;
                var firstKeyTime = prop.keyTime(firstIdx);

                // Calculate this property's delay relative to earliest first key, and reverse it
                var propertyDelay = 0;
                var reversedDelay = 0;
                if (preserveDelays && globalEarliestFirstKey !== null) {
                    propertyDelay = firstKeyTime - globalEarliestFirstKey;
                    reversedDelay = staggerRange - propertyDelay;
                    DEBUG_JSX.log("    Prop: " + prop.name + " | firstIdx=" + firstIdx + " t=" + firstKeyTime.toFixed(3) + "s, delay=" + propertyDelay.toFixed(3) + "s → reversedDelay=" + reversedDelay.toFixed(3) + "s");
                } else {
                    DEBUG_JSX.log("    Prop: " + prop.name + " | firstIdx=" + firstIdx + " t=" + firstKeyTime.toFixed(3) + "s, lastIdx=" + lastIdx + " t=" + prop.keyTime(lastIdx).toFixed(3) + "s");
                }

                // Read values and labels of first and last
                var firstVal = prop.keyValue(firstIdx);
                var lastVal = prop.keyValue(lastIdx);
                var firstLabel = prop.keyLabel(firstIdx);
                var lastLabel = prop.keyLabel(lastIdx);

                // =================================================================
                // SPRING DETECTION: Check for Sproing spring marker at first key
                // =================================================================
                var firstKeyTime = prop.keyTime(firstIdx);
                var markerProp = null;
                try {
                    // Try both standard and matchName forms for robustness
                    markerProp = layer.property("Marker") || layer.property("ADBE Marker");
                } catch(e) {}

                var springMarkerData = null;
                var springParams = null;
                if (markerProp && markerProp.numKeys > 0) {
                    // Widen epsilon slightly to tolerate frame rounding
                    springMarkerData = findMarkerAtTime(markerProp, firstKeyTime, 0.05);
                    if (springMarkerData) {
                        var markerComment = markerProp.keyValue(springMarkerData.index).comment;
                        var uniquePropId = getUniquePropertyId(prop);
                        var parsed = parseSpringFromMarker(markerComment, uniquePropId);
                        if (parsed) {
                            springParams = {
                                stiffness: parsed.stiffness,
                                dampingRatio: parsed.dampingRatio,
                                mass: parsed.mass,
                                presetName: parsed.presetName
                            };
                            // Preserve exact original block text for this property
                            var originalSpringBlockTextForProperty = parsed.blockText;
                        }
                    }
                }

                if (springParams) {
                    // ==============================================================
                    // SPRING MODE: Bake reversed spring physics
                    // ==============================================================
                    DEBUG_JSX.log("    ✓ Spring detected: " + springParams.presetName + " (stiffness=" + springParams.stiffness + ", dampingRatio=" + springParams.dampingRatio + ")");

                    // Detect baking precision
                    var detectedPrecision = detectBakingPrecision(prop, sel, frameRate);
                    DEBUG_JSX.log("    Detected precision: " + detectedPrecision);

                    // Time Remap needs a higher-density bake to match the dense curve
                    // COPIED FROM: Sproing v1.2.10 (SpringBaker.jsx lines 1964-1967)
                    if (detectedPrecision !== 'max' && detectedPrecision !== 'high' &&
                        (prop.matchName === 'ADBE Time Remapping' || prop.name === 'Time Remap')) {
                        DEBUG_JSX.log("    Time Remap precision boost: " + detectedPrecision + " -> high");
                        detectedPrecision = 'high';
                    }

                    // Calculate start time (apply reversed delay in shift mode)
                    var springStartTime = playheadTime;
                    if (preserveDelays && reversedDelay !== undefined) {
                        springStartTime = playheadTime + reversedDelay;
                        DEBUG_JSX.log("    Spring start time: playhead + reversedDelay = " + springStartTime.toFixed(3) + "s");
                    }

                    // Generate reversed spring curve (swap start/end values)
                    var maxDuration = 3; // 3 seconds max
                    var maxFrames = Math.ceil(maxDuration * frameRate);

                    try {
                        var fullCurveData = generateFullSpringCurve(
                            springStartTime,                    // t1 (with reversed delay applied)
                            springStartTime + maxDuration,      // t2
                            lastVal,                         // v1 (reversed - end becomes start)
                            firstVal,                        // v2 (reversed - start becomes end)
                            springParams.dampingRatio,
                            springParams.stiffness,
                            springParams.mass,
                            frameRate,
                            maxFrames
                        );

                        var simplifiedKeyframes = simplifySpringKeyframes(fullCurveData, detectedPrecision, frameRate);

                        DEBUG_JSX.log("    Baking " + simplifiedKeyframes.length + " spring keyframes with " + detectedPrecision + " precision");

                        // Bake all spring keyframes (values only)
                        for (var i = 0; i < simplifiedKeyframes.length; i++) {
                            var keyData = simplifiedKeyframes[i];
                            var keyTime = keyData.x;
                            var keyValue = keyData.y;
                            var valueToSet = (keyValue.length === 1) ? keyValue[0] : keyValue;
                            prop.setValueAtTime(keyTime, valueToSet);
                        }

                        // Apply velocity-based easing exactly like Sproing (unless max precision)
                        if (detectedPrecision !== 'max') {
                            applyVelocityBasedEasing(prop, simplifiedKeyframes, fullCurveData);
                        }

                        // CRITICAL: For max precision, set linear interpolation on ALL keyframes (matching Sproing behavior)
                        // This removes all easing curves to create pure linear interpolation between every frame
                        if (detectedPrecision === 'max') {
                            DEBUG_JSX.log("    Setting linear interpolation for max precision keyframes");
                            for (var i = 0; i < simplifiedKeyframes.length; i++) {
                                var keyTime = simplifiedKeyframes[i].x;
                                var keyIndex = prop.nearestKeyIndex(keyTime);
                                if (keyIndex) {
                                    try {
                                        // Set linear temporal interpolation
                                        prop.setInterpolationTypeAtKey(keyIndex, KeyframeInterpolationType.LINEAR, KeyframeInterpolationType.LINEAR);
                                        prop.setTemporalAutoBezierAtKey(keyIndex, false);
                                        prop.setTemporalContinuousAtKey(keyIndex, false);

                                        // Set linear spatial interpolation for spatial properties (Position, etc.)
                                        if (prop.isSpatial) {
                                            prop.setSpatialAutoBezierAtKey(keyIndex, false);
                                            prop.setSpatialContinuousAtKey(keyIndex, false);
                                            // Set zero spatial tangents for linear interpolation
                                            var dim = simplifiedKeyframes[0].y.length;
                                            var zeroTangent = [];
                                            for (var d = 0; d < dim; d++) {
                                                zeroTangent.push(0);
                                            }
                                            prop.setSpatialTangentsAtKey(keyIndex, zeroTangent, zeroTangent);
                                        }
                                    } catch (e) {
                                        // Ignore if operations fail for this keyframe
                                    }
                                }
                            }
                        }

                        // Set blue labels on first and last keyframes (for Sproing unbake compatibility)
                        var firstMirroredKeyIndex = prop.nearestKeyIndex(simplifiedKeyframes[0].x);
                        var lastMirroredKeyIndex = prop.nearestKeyIndex(simplifiedKeyframes[simplifiedKeyframes.length - 1].x);

                        try {
                            prop.setLabelAtKey(firstMirroredKeyIndex, 8); // Blue label
                            prop.setLabelAtKey(lastMirroredKeyIndex, 8);  // Blue label
                            DEBUG_JSX.log("    Set blue labels on keys " + firstMirroredKeyIndex + " and " + lastMirroredKeyIndex);
                        } catch (e) {
                            DEBUG_JSX.error("Failed to set blue labels: " + e.toString());
                        }

                        // Create mirrored marker at first baked keyframe (with reversed delay applied)
                        var targetMarkerTime = springStartTime;
                        var uniquePropId = getUniquePropertyId(prop);
                        // Prefer copying exact original block text for this property if available
                        var springBlock = originalSpringBlockTextForProperty || (function(){
                            var damping = springParams.dampingRatio; // copy ratio for compatibility block
                            var title = springParams.presetName || "Mirrored Spring";
                            return title + "\n\n" +
                                "Stiffness: " + springParams.stiffness + ", Damping: " + damping.toFixed(2) +
                                ", Damping Ratio: " + springParams.dampingRatio.toFixed(2) + ", Mass: " + springParams.mass + "\n\n" +
                                "| Property: " + uniquePropId;
                        })();

                        // Strip out "Initial Velocity:" lines from the spring block for mirrored markers
                        // (Initial velocity doesn't make sense for mirrored springs)
                        if (springBlock) {
                            var lines = springBlock.split("\n");
                            var filteredLines = [];
                            for (var lineIdx = 0; lineIdx < lines.length; lineIdx++) {
                                var line = lines[lineIdx];
                                // Check if line starts with "Initial Velocity:" (with optional whitespace)
                                if (line.replace(/^\s+/, '').indexOf("Initial Velocity:") !== 0) {
                                    filteredLines.push(line);
                                }
                            }
                            springBlock = filteredLines.join("\n");
                        }

                        // Merge/update marker at first baked key using Sproing-format blocks
                        createOrUpdateMirroredMarker(markerProp, targetMarkerTime, springBlock, uniquePropId, 0.01);

                        // Reselect all baked spring keys
                        for (var rk = 1; rk <= prop.numKeys; rk++) {
                            try { prop.setSelectedAtKey(rk, false); } catch(e) {}
                        }
                        for (var i = 0; i < simplifiedKeyframes.length; i++) {
                            var keyTime = simplifiedKeyframes[i].x;
                            var keyIdx = prop.nearestKeyIndex(keyTime);
                            try { prop.setSelectedAtKey(keyIdx, true); } catch(e) {}
                        }

                        processedProps++;
                        DEBUG_JSX.log("    ✓ Spring mirror complete");

                        // Skip the linear mirroring code below
                        continue;

                    } catch (springError) {
                        DEBUG_JSX.error("Spring baking failed: " + springError.toString());
                        DEBUG_JSX.log("    Falling back to linear mirroring");
                        // Fall through to linear mirroring below
                    }
                }

                // =================================================================
                // LINEAR MODE: Default behavior (no spring detected or error)
                // =================================================================

                if (preserveDelays) {
                    // SHIFT MODE: Mirror ALL selected keys with REVERSED timing/delays
                    DEBUG_JSX.log("    === SHIFT MODE: Mirroring with reversed delays ===");
                    DEBUG_JSX.log("    Selected keys: " + sel.length);
                    DEBUG_JSX.log("    Property delay offset: reversedDelay=" + reversedDelay.toFixed(3) + "s");

                    // Collect all keyframe data
                    var allKeyData = [];
                    var firstKeyTime = prop.keyTime(firstIdx);
                    var lastKeyTime = prop.keyTime(lastIdx);
                    var totalDuration = lastKeyTime - firstKeyTime;

                    DEBUG_JSX.log("    First key time: " + firstKeyTime.toFixed(3) + "s");
                    DEBUG_JSX.log("    Last key time: " + lastKeyTime.toFixed(3) + "s");
                    DEBUG_JSX.log("    Total duration: " + totalDuration.toFixed(3) + "s");
                    DEBUG_JSX.log("    Playhead time: " + playheadTime.toFixed(3) + "s");

                    for (var ki = 0; ki < keyed.length; ki++) {
                        var keyIdx = keyed[ki].idx;
                        var keyTime = keyed[ki].t;
                        var keyVal = prop.keyValue(keyIdx);
                        var keyLabel = prop.keyLabel(keyIdx);
                        var relTime = keyTime - firstKeyTime;

                        DEBUG_JSX.log("    Key " + (ki+1) + ": time=" + keyTime.toFixed(3) + "s, relTime=" + relTime.toFixed(3) + "s, value=" + keyVal);

                        // Capture easing data
                        var keyData = {
                            originalIdx: keyIdx,
                            originalTime: keyTime,
                            relativeTime: relTime,
                            value: keyVal,
                            label: keyLabel,
                            inInterp: prop.keyInInterpolationType(keyIdx),
                            outInterp: prop.keyOutInterpolationType(keyIdx),
                            temporalContinuous: false,
                            temporalAutoBezier: false
                        };

                        // Capture temporal ease
                        if (keyData.inInterp === KeyframeInterpolationType.BEZIER ||
                            keyData.outInterp === KeyframeInterpolationType.BEZIER) {
                            try {
                                keyData.inEase = prop.keyInTemporalEase(keyIdx);
                                keyData.outEase = prop.keyOutTemporalEase(keyIdx);
                            } catch(e) {}
                        }

                        // Capture temporal continuity
                        try {
                            keyData.temporalContinuous = prop.keyTemporalContinuous(keyIdx);
                            keyData.temporalAutoBezier = prop.keyTemporalAutoBezier(keyIdx);
                        } catch(e) {}

                        // Capture spatial properties
                        if (prop.isSpatial) {
                            try {
                                keyData.spatialContinuous = prop.keySpatialContinuous(keyIdx);
                                keyData.spatialAutoBezier = prop.keySpatialAutoBezier(keyIdx);
                                keyData.inTangent = prop.keyInSpatialTangent(keyIdx);
                                keyData.outTangent = prop.keyOutSpatialTangent(keyIdx);
                            } catch(e) {}
                        }

                        allKeyData.push(keyData);
                    }

                    // Create mirrored keys in reverse order with REVERSED delays
                    DEBUG_JSX.log("    --- Creating mirrored keys ---");
                    var newKeyIndices = [];
                    for (var i = allKeyData.length - 1; i >= 0; i--) {
                        var data = allKeyData[i];
                        // Reverse the delay within this property
                        var reversedRelativeTime = totalDuration - data.relativeTime;
                        // Add the property's reversed delay offset (for cross-property delay mirroring)
                        var newTime = playheadTime + reversedDelay + reversedRelativeTime;

                        DEBUG_JSX.log("    Creating key: originalRelTime=" + data.relativeTime.toFixed(3) +
                                     "s → reversedRelTime=" + reversedRelativeTime.toFixed(3) +
                                     "s + propertyOffset=" + reversedDelay.toFixed(3) +
                                     "s → newTime=" + newTime.toFixed(3) + "s, value=" + data.value);

                        var newIdx = prop.addKey(newTime);

                        // Set value (reversed - last value becomes first, etc.)
                        prop.setValueAtKey(newIdx, data.value);

                        // Apply easing (same pattern, not reversed)
                        try {
                            prop.setInterpolationTypeAtKey(newIdx, data.inInterp, data.outInterp);
                        } catch(e) {}

                        if (data.inEase !== undefined && data.outEase !== undefined) {
                            try {
                                prop.setTemporalEaseAtKey(newIdx, data.inEase, data.outEase);
                            } catch(e) {}
                        }

                        // Restore temporal properties
                        try {
                            prop.setTemporalContinuousAtKey(newIdx, data.temporalContinuous);
                            prop.setTemporalAutoBezierAtKey(newIdx, data.temporalAutoBezier);
                        } catch(e) {}

                        // Restore spatial properties
                        if (prop.isSpatial && data.spatialContinuous !== undefined) {
                            try {
                                prop.setSpatialContinuousAtKey(newIdx, data.spatialContinuous);
                                prop.setSpatialAutoBezierAtKey(newIdx, data.spatialAutoBezier);
                                prop.setSpatialTangentsAtKey(newIdx, data.inTangent, data.outTangent);
                            } catch(e) {}
                        }

                        // Preserve label
                        try {
                            prop.setLabelAtKey(newIdx, data.label);
                        } catch(e) {}

                        newKeyIndices.push(newIdx);
                    }

                    // Reselect all new mirrored keys
                    for (var rk = 1; rk <= prop.numKeys; rk++) {
                        try { prop.setSelectedAtKey(rk, false); } catch(e) {}
                    }
                    for (var i = 0; i < newKeyIndices.length; i++) {
                        try { prop.setSelectedAtKey(newKeyIndices[i], true); } catch(e) {}
                    }

                    DEBUG_JSX.log("    ✓ Shift mode complete: Created " + newKeyIndices.length + " mirrored keys")

                } else {
                    // NORMAL MODE: Mirror only first and last keys (original behavior)
                    DEBUG_JSX.log("    Normal mode: Mirroring first and last keys only");

                    // Capture easing data from original keyframes
                    var firstKeyData = {
                        inInterp: prop.keyInInterpolationType(firstIdx),
                        outInterp: prop.keyOutInterpolationType(firstIdx),
                        temporalContinuous: false,
                        temporalAutoBezier: false
                    };
                    var lastKeyData = {
                        inInterp: prop.keyInInterpolationType(lastIdx),
                        outInterp: prop.keyOutInterpolationType(lastIdx),
                        temporalContinuous: false,
                        temporalAutoBezier: false
                    };

                    // Capture temporal ease for bezier keyframes
                    if (firstKeyData.inInterp === KeyframeInterpolationType.BEZIER ||
                        firstKeyData.outInterp === KeyframeInterpolationType.BEZIER) {
                        try {
                            firstKeyData.inEase = prop.keyInTemporalEase(firstIdx);
                            firstKeyData.outEase = prop.keyOutTemporalEase(firstIdx);
                        } catch(e) {}
                    }
                    if (lastKeyData.inInterp === KeyframeInterpolationType.BEZIER ||
                        lastKeyData.outInterp === KeyframeInterpolationType.BEZIER) {
                        try {
                            lastKeyData.inEase = prop.keyInTemporalEase(lastIdx);
                            lastKeyData.outEase = prop.keyOutTemporalEase(lastIdx);
                        } catch(e) {}
                    }

                    // Capture temporal continuity/auto-bezier
                    try {
                        firstKeyData.temporalContinuous = prop.keyTemporalContinuous(firstIdx);
                        firstKeyData.temporalAutoBezier = prop.keyTemporalAutoBezier(firstIdx);
                    } catch(e) {}
                    try {
                        lastKeyData.temporalContinuous = prop.keyTemporalContinuous(lastIdx);
                        lastKeyData.temporalAutoBezier = prop.keyTemporalAutoBezier(lastIdx);
                    } catch(e) {}

                    // Capture spatial properties for Position-like properties
                    if (prop.isSpatial) {
                        try {
                            firstKeyData.spatialContinuous = prop.keySpatialContinuous(firstIdx);
                            firstKeyData.spatialAutoBezier = prop.keySpatialAutoBezier(firstIdx);
                            firstKeyData.inTangent = prop.keyInSpatialTangent(firstIdx);
                            firstKeyData.outTangent = prop.keyOutSpatialTangent(firstIdx);
                        } catch(e) {}
                        try {
                            lastKeyData.spatialContinuous = prop.keySpatialContinuous(lastIdx);
                            lastKeyData.spatialAutoBezier = prop.keySpatialAutoBezier(lastIdx);
                            lastKeyData.inTangent = prop.keyInSpatialTangent(lastIdx);
                            lastKeyData.outTangent = prop.keyOutSpatialTangent(lastIdx);
                        } catch(e) {}
                    }

                    // Create mirrored keys: preserve original duration between keys
                    var originalDuration = prop.keyTime(lastIdx) - prop.keyTime(firstIdx);
                    var newFirst = prop.addKey(playheadTime);
                    var newSecond = prop.addKey(playheadTime + Math.max(0, originalDuration));

                    // Reverse order: the value at start becomes lastVal, and the second becomes firstVal
                    prop.setValueAtKey(newFirst, lastVal);
                    prop.setValueAtKey(newSecond, firstVal);

                    // Apply preserved easing (same pattern, not reversed)
                    try {
                        prop.setInterpolationTypeAtKey(newFirst, firstKeyData.inInterp, firstKeyData.outInterp);
                        prop.setInterpolationTypeAtKey(newSecond, lastKeyData.inInterp, lastKeyData.outInterp);
                    } catch(e) {}

                    // Restore temporal ease (same pattern)
                    if (firstKeyData.inEase !== undefined && firstKeyData.outEase !== undefined) {
                        try {
                            prop.setTemporalEaseAtKey(newFirst, firstKeyData.inEase, firstKeyData.outEase);
                        } catch(e) {}
                    }
                    if (lastKeyData.inEase !== undefined && lastKeyData.outEase !== undefined) {
                        try {
                            prop.setTemporalEaseAtKey(newSecond, lastKeyData.inEase, lastKeyData.outEase);
                        } catch(e) {}
                    }

                    // Restore temporal properties (same pattern)
                    try {
                        prop.setTemporalContinuousAtKey(newFirst, firstKeyData.temporalContinuous);
                        prop.setTemporalAutoBezierAtKey(newFirst, firstKeyData.temporalAutoBezier);
                        prop.setTemporalContinuousAtKey(newSecond, lastKeyData.temporalContinuous);
                        prop.setTemporalAutoBezierAtKey(newSecond, lastKeyData.temporalAutoBezier);
                    } catch(e) {}

                    // Restore spatial settings for Position-like properties (same pattern)
                    if (prop.isSpatial) {
                        if (firstKeyData.spatialContinuous !== undefined) {
                            try {
                                prop.setSpatialContinuousAtKey(newFirst, firstKeyData.spatialContinuous);
                                prop.setSpatialAutoBezierAtKey(newFirst, firstKeyData.spatialAutoBezier);
                                prop.setSpatialTangentsAtKey(newFirst, firstKeyData.inTangent, firstKeyData.outTangent);
                            } catch(e) {}
                        }
                        if (lastKeyData.spatialContinuous !== undefined) {
                            try {
                                prop.setSpatialContinuousAtKey(newSecond, lastKeyData.spatialContinuous);
                                prop.setSpatialAutoBezierAtKey(newSecond, lastKeyData.spatialAutoBezier);
                                prop.setSpatialTangentsAtKey(newSecond, lastKeyData.inTangent, lastKeyData.outTangent);
                            } catch(e) {}
                        }
                    }

                    // Preserve keyframe color labels (reversed to match mirrored values)
                    try {
                        prop.setLabelAtKey(newFirst, lastLabel);
                        prop.setLabelAtKey(newSecond, firstLabel);
                    } catch(e) {}

                    // Reselect only the new mirrored keys
                    for (var rk = 1; rk <= prop.numKeys; rk++) {
                        try { prop.setSelectedAtKey(rk, false); } catch(e) {}
                    }
                    try { prop.setSelectedAtKey(newFirst, true); } catch(e) {}
                    try { prop.setSelectedAtKey(newSecond, true); } catch(e) {}
                }

                processedProps++;
            }
        }

        app.endUndoGroup();
        if (processedProps === 0) {
            alert("No selected keyframes found to mirror. Please select at least two keyframes per property.");
            return "error|No selected keyframes found to mirror";
        }
        var debugMessages = DEBUG_JSX.getMessages();
        return "success|Mirrored keys on " + processedProps + " properties|" + debugMessages.join("|");
    } catch(e) {
        app.endUndoGroup();
        return "error|Mirror keys failed: " + e.toString();
    }
}
