// Global variable to store extension path (set by the panel)
var extensionRoot = "";

// Debug utilities for ExtendScript
var DEBUG_JSX = {
    log: function(message, data) {
        $.writeln("🎬 AirBoard: " + message + (data ? " | " + data : ""));
    },
    error: function(message, error) {
        $.writeln("❌ AirBoard Error: " + message + " | " + error.toString());
    },
    info: function(message, data) {
        $.writeln("ℹ️ AirBoard Info: " + message + (data ? " | " + data : ""));
    }
};

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
        var comp = app.project.activeItem;
        if (!comp || !(comp instanceof CompItem)) {
            return "error|No composition selected";
        }
        
        var selectedLayers = comp.selectedLayers;
        if (selectedLayers.length === 0) {
            return "error|No layers selected";
        }
        
        var layer = selectedLayers[0];
        var propertyTimes = [];
        
        // Generic function to recursively search for selected keyframes
        function searchAllProperties(propGroup) {
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
                            break; // Only need first selected keyframe for cross-property
                        }
                    }
                }
                
                // Recurse into property groups
                if (prop && (prop.propertyType === PropertyType.INDEXED_GROUP || 
                           prop.propertyType === PropertyType.NAMED_GROUP)) {
                    searchAllProperties(prop);
                }
            }
        }
        
        // Search all layer properties
        searchAllProperties(layer);
        
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
                        break;
                    }
                }
            }
        } catch(e) {
            // Time remap might not be available
        }
        
        // CROSS-PROPERTY MODE: Multiple properties with selected keyframes
        if (propertyTimes.length >= 2) {
            // Sort by time and calculate delays from earliest
            propertyTimes.sort(function(a, b) { return a.time - b.time; });
            var earliestTime = propertyTimes[0].time;
            
            // Calculate all delays from earliest keyframe
            var delays = [];
            for (var k = 0; k < propertyTimes.length; k++) {
                var delayMs = Math.round((propertyTimes[k].time - earliestTime) * 1000);
                delays.push(delayMs);
            }
            
            // Check if all delays are the same (find unique delays)
            var uniqueDelays = [];
            for (var k = 0; k < delays.length; k++) {
                var found = false;
                for (var j = 0; j < uniqueDelays.length; j++) {
                    if (uniqueDelays[j] === delays[k]) {
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
                
                // Find unique non-zero delays
                var uniqueNonZeroDelays = [];
                for (var k = 0; k < nonZeroDelays.length; k++) {
                    var found = false;
                    for (var j = 0; j < uniqueNonZeroDelays.length; j++) {
                        if (uniqueNonZeroDelays[j] === nonZeroDelays[k]) {
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
            
            return "success|" + resultDelayMs + "|" + resultDelayFrames + "|1|1|1|0|0|0|0|1";
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
        
        // Search all layer properties for multiple selected keyframes
        singlePropertyData = searchForMultipleKeyframes(layer);
        
        // Also check Time Remap for multiple keyframes
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
        
        if (singlePropertyData) {
            // Calculate duration between first and last keyframes
            var firstKeyIndex = singlePropertyData.keys[0];
            var lastKeyIndex = singlePropertyData.keys[singlePropertyData.keys.length - 1];
            var time1 = singlePropertyData.property.keyTime(firstKeyIndex);
            var time2 = singlePropertyData.property.keyTime(lastKeyIndex);
            var durationSeconds = Math.abs(time2 - time1);
            var durationMs = Math.round(durationSeconds * 1000);
            var frameRate = comp.frameRate || 30;
            var durationFrames = Math.round(durationSeconds * frameRate);
            
            return "success|" + durationMs + "|" + durationFrames + "|" + firstKeyIndex + "|" + lastKeyIndex + "|1|0|0|0|0|0";
        }
        
        return "error|Please select more than 1 keyframe";
        
    } catch(e) {
        return "error|" + e.toString();
    }
}

// Read Keyframes - Calculate duration between selected keyframes
function readKeyframesDuration() {
    DEBUG_JSX.log("=== ORIGINAL FUNCTION TEST ===");
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
        
        // Function to recursively search for selected keyframes in a property group
        function searchPropertyGroup(propGroup) {
            for (var i = 1; i <= propGroup.numProperties; i++) {
                var prop = propGroup.property(i);
                
                // Check if this property has selected keyframes
                var result = findSelectedKeyframes(prop);
                if (result) {
                    return result;
                }
                
                // If it's a property group, search recursively
                if (prop.propertyType === PropertyType.INDEXED_GROUP || 
                    prop.propertyType === PropertyType.NAMED_GROUP) {
                    var groupResult = searchPropertyGroup(prop);
                    if (groupResult) {
                        return groupResult;
                    }
                }
            }
            return null;
        }
        
        // Search through all layer properties for selected keyframes
        var keyframeData = null;
        
        // Check transform properties first
        keyframeData = searchPropertyGroup(layer.transform);
        
        // If no selected keyframes in transform, check special layer properties
        if (!keyframeData) {
            // Check Time Remap property specifically
            try {
                if (layer.timeRemapEnabled && layer.timeRemap) {
                    keyframeData = findSelectedKeyframes(layer.timeRemap);
                }
            } catch(e) {
                // Time remap might not be available
            }
        }
        
        // Check effects
        if (!keyframeData && layer.effect && layer.effect.numProperties > 0) {
            keyframeData = searchPropertyGroup(layer.effect);
        }
        
        // Check mask properties
        if (!keyframeData) {
            if (layer.mask && layer.mask.numProperties > 0) {
                keyframeData = searchPropertyGroup(layer.mask);
            }
        }
        
        // Check other layer properties like audio levels, layer styles, etc.
        if (!keyframeData) {
            try {
                // Check audio levels if it's an audio layer
                if (layer.hasAudio && layer.audioLevels) {
                    keyframeData = findSelectedKeyframes(layer.audioLevels);
                }
            } catch(e) {
                // Audio levels might not be available
            }
        }
        
        if (!keyframeData) {
            return "error|Please select more than 1 keyframe";
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
        var durationMs = Math.round(durationSeconds * 1000);
        
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
            
            for (var i = 1; i <= propGroup.numProperties; i++) {
                var prop = propGroup.property(i);
                
                // Check if this is a position property with selected keyframes
                if (isPositionProperty(prop)) {
                    var selectedKeys = [];
                    for (var j = 1; j <= prop.numKeys; j++) {
                        if (prop.keySelected(j)) {
                            selectedKeys.push(j);
                        }
                    }
                    
                    if (selectedKeys.length >= 2) {
                        var distance = calculatePositionDistance(prop, selectedKeys);
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
        
        // Calculate position distances from transform properties
        var positionResults = searchForPositionKeyframes(layer.transform);
        xDistance = positionResults.x;
        yDistance = positionResults.y;
        hasXDistance = positionResults.hasX;
        hasYDistance = positionResults.hasY;
        
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
        var newDurationMs = Math.round(newDuration * 1000);
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
                        temporalAutoBezier: prop.keyTemporalAutoBezier(idx)
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
                
                totalDuration = newDuration; // Store for return value
                
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
                            prop.setInterpolationTypeAtKey(newIdx, data.inInterp, data.outInterp);
                            
                            // Only set temporal ease for bezier keyframes to preserve linear keyframes
                            if (data.inEase !== undefined && data.outEase !== undefined) {
                                prop.setTemporalEaseAtKey(newIdx, data.inEase, data.outEase);
                            }
                            
                            prop.setTemporalContinuousAtKey(newIdx, data.temporalContinuous);
                            prop.setTemporalAutoBezierAtKey(newIdx, data.temporalAutoBezier);
                            
                            if (data.spatialContinuous !== undefined) {
                                prop.setSpatialContinuousAtKey(newIdx, data.spatialContinuous);
                                prop.setSpatialAutoBezierAtKey(newIdx, data.spatialAutoBezier);
                                prop.setSpatialTangentsAtKey(newIdx, data.inTangent, data.outTangent);
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
                }
            }
        }
        
        app.endUndoGroup();
        
        if (!processedAny) {
            return "error|Please select more than 1 keyframe";
        }
        
        // Return success with new duration
        var newDurationMs = Math.round(totalDuration * 1000);
        var newDurationFrames = Math.round(totalDuration * comp.frameRate);
        
        return "success|" + newDurationMs + "|" + newDurationFrames;
        
    } catch(e) {
        app.endUndoGroup();
        return "error|Failed to stretch keyframes: " + e.toString();
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
            return stretchKeyframesGrokApproach(3); // forward 3 frames
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
            return stretchKeyframesGrokApproach(-3); // backward 3 frames
        }
    } catch(e) {
        return "error|Failed to stretch keyframes backward: " + e.toString();
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
    
    // Cross-property mode: multiple properties with selected keyframes
    var result = { isCrossProperty: propertyNames.length > 1 };
    
    // Add debug info to help troubleshoot
    if (propertyNames.length === 0) {
        DEBUG_JSX.log("No properties found with selected keyframes!");
    } else if (propertyNames.length === 1) {
        DEBUG_JSX.log("Only one property found: " + propertyNames[0] + " - using duration mode");
    } else {
        DEBUG_JSX.log("Multiple properties found - using delay mode");
    }
    
    return result;
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
        DEBUG_JSX.log("nudgeDelay called with direction: " + direction);
        app.beginUndoGroup("Nudge Delay");
        
        var comp = app.project.activeItem;
        if (!(comp && comp instanceof CompItem)) {
            app.endUndoGroup();
            return "error|No composition selected";
        }
        
        // Early safety check for frame rate
        var frameRate = comp.frameRate;
        if (!frameRate || frameRate <= 0 || isNaN(frameRate)) {
            app.endUndoGroup();
            return "error|Invalid frame rate: " + frameRate;
        }
        
        var selectedLayers = comp.selectedLayers;
        if (selectedLayers.length === 0) {
            app.endUndoGroup();
            return "error|No layers selected";
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
                    if (prop.propertyValueType === PropertyValueType.NO_VALUE || prop.numKeys === 0) continue;
                    
                    var selKeys = prop.selectedKeys;
                    if (selKeys.length === 0) continue;
                    
                    // Store property with its selected keyframes
                    var propName = prop.name;
                    if (!propertyMap[propName]) {
                        propertyMap[propName] = {
                            property: prop,
                            keyframes: []
                        };
                    }
                    
                    // Add all selected keyframes for this property
                    for (var k = 0; k < selKeys.length; k++) {
                        var keyIndex = selKeys[k];
                        propertyMap[propName].keyframes.push({
                            index: keyIndex,
                            time: prop.keyTime(keyIndex)
                        });
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
        
        DEBUG_JSX.log("Found " + propertyNames.length + " properties: " + propertyNames.join(", "));
        
        if (propertyNames.length === 0) {
            app.endUndoGroup();
            return "error|No selected keyframes found";
        }
        
        if (propertyNames.length <= 1) {
            app.endUndoGroup();
            return "error|Need multiple properties for delay nudging - found " + propertyNames.length + " properties: " + propertyNames.join(", ");
        }
        
        // DEBUG: Return debug info to see what's being processed
        var debugInfo = [];
        debugInfo.push("Found " + propertyNames.length + " properties: " + propertyNames.join(", "));
        
        var propertyDelays = [];
        var earliestTime = Number.MAX_VALUE;
        
        // First pass: find the earliest time to identify original baseline
        for (var propName in propertyMap) {
            var propData = propertyMap[propName];
            var keyframes = propData.keyframes;
            keyframes.sort(function(a, b) { return a.time - b.time; });
            var firstTime = keyframes[0].time;
            
            if (firstTime < earliestTime) {
                earliestTime = firstTime;
            }
        }
        
        // Second pass: build property delays with original baseline tracking
        for (var propName in propertyMap) {
            var propData = propertyMap[propName];
            var keyframes = propData.keyframes;
            debugInfo.push("Property '" + propName + "' has " + keyframes.length + " keyframes");
            
            // Sort by time to get first keyframe
            keyframes.sort(function(a, b) { return a.time - b.time; });
            var firstTime = keyframes[0].time;
            
            debugInfo.push("First time for " + propName + ": " + firstTime + "s");
            
            // Track if this is the original baseline property
            var isOriginalBaseline = Math.abs(firstTime - earliestTime) < 0.001;
            
            propertyDelays.push({
                property: propName,
                propObject: propData.property,
                keyframes: keyframes,
                currentDelay: firstTime,
                timeOffset: 0,
                isOriginalBaseline: isOriginalBaseline
            });
            
            if (isOriginalBaseline) {
                debugInfo.push(propName + " is ORIGINAL baseline (never moves)");
            }
        }
        
        debugInfo.push("Earliest time: " + earliestTime + "s");
        
        // Calculate delays relative to earliest time (baseline = 0ms)
        try {
            for (var i = 0; i < propertyDelays.length; i++) {
                var timeDiff = propertyDelays[i].currentDelay - earliestTime;
                var delayMs = timeDiff * 1000;
                
                if (isNaN(delayMs) || !isFinite(delayMs)) {
                    throw new Error("Invalid delay calculation for " + propertyDelays[i].property + ": timeDiff=" + timeDiff + ", delayMs=" + delayMs);
                }
                
                propertyDelays[i].relativeDelay = delayMs;
                debugInfo.push(propertyDelays[i].property + " delay: " + delayMs + "ms");
            }
        } catch(calcError) {
            app.endUndoGroup();
            return "error|Delay calculation error: " + calcError.toString() + " | " + debugInfo.join(" | ");
        }
        
        // Check if all delays are the same (unified) or different (multiple)
        var firstDelay = propertyDelays[0].relativeDelay;
        var allSameDelay = true;
        DEBUG_JSX.log("First delay: " + firstDelay + "ms");
        
        for (var i = 1; i < propertyDelays.length; i++) {
            DEBUG_JSX.log("Comparing delay " + i + ": " + propertyDelays[i].relativeDelay + "ms vs " + firstDelay + "ms");
            if (Math.abs(propertyDelays[i].relativeDelay - firstDelay) > 1) { // 1ms tolerance
                allSameDelay = false;
                break;
            }
        }
        
        DEBUG_JSX.log("All same delay: " + allSameDelay);
        
        var targetDelayMs;
        
        try {
            if (allSameDelay) {
                // All delays are the same - apply 50ms snapping to the unified delay
                debugInfo.push("Unified delay: " + firstDelay + "ms");
                targetDelayMs = calculateDelaySnap(firstDelay, direction);
                debugInfo.push("Target after snapping: " + targetDelayMs + "ms");
            } else {
                // Multiple different delays - nudge each property individually
                debugInfo.push("Multiple delays - nudging each property individually");
                
                // Calculate target delay for each property individually
                for (var i = 0; i < propertyDelays.length; i++) {
                    var propDelay = propertyDelays[i];
                    var currentDelay = propDelay.relativeDelay;
                    
                    if (propDelay.isOriginalBaseline) {
                        // Original baseline property - never moves
                        propDelay.targetDelay = 0;
                        debugInfo.push(propDelay.property + ": original baseline, never moves");
                    } else {
                        // Apply individual 50ms snapping to this property (even if currently at 0ms)
                        var targetDelay = calculateDelaySnap(currentDelay, direction);
                        propDelay.targetDelay = targetDelay;
                        debugInfo.push(propDelay.property + ": " + currentDelay + "ms → " + targetDelay + "ms (snap result)");
                        
                        // Extra debug for 0ms case
                        if (Math.abs(currentDelay) < 1) {
                            debugInfo.push("DEBUG: Property at 0ms, direction=" + direction + ", snap result=" + targetDelay);
                        }
                    }
                }
                
                // Set a flag to indicate individual processing
                var useIndividualDelays = true;
            }
        } catch(snapError) {
            app.endUndoGroup();
            return "error|Snapping error: " + snapError.toString() + " | " + debugInfo.join(" | ");
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
                    var targetTime = earliestTime + targetDelaySeconds;
                    timeOffset = targetTime - currentTime;
                    debugInfo.push("Property " + propData.property + " individual: target=" + propData.targetDelay + "ms, offset=" + timeOffset + "s");
                    
                    // Extra debug for problematic case
                    if (Math.abs(propData.relativeDelay) < 1 && Math.abs(propData.targetDelay - 50) < 1) {
                        debugInfo.push("DEBUG: 0ms→50ms case: current=" + currentTime + "s, target=" + targetTime + "s, offset=" + timeOffset + "s");
                    }
                } else {
                    // Unified delay mode - all properties move to same target
                    var targetDelaySeconds = targetDelayMs / 1000;
                    
                    // Safety check for divide by zero
                    if (isNaN(targetDelaySeconds) || !isFinite(targetDelaySeconds)) {
                        throw new Error("Invalid targetDelaySeconds: " + targetDelaySeconds + " from targetDelayMs: " + targetDelayMs);
                    }
                    
                    var targetTime = earliestTime + targetDelaySeconds;
                    
                    // Handle original baseline property - recreate keyframes at same positions to maintain selection
                    if (propData.isOriginalBaseline) {
                        timeOffset = 0; // No time offset for original baseline property
                        debugInfo.push("Original baseline property " + propData.property + " - no offset");
                    } else {
                        timeOffset = targetTime - currentTime;
                        debugInfo.push("Property " + propData.property + " unified offset: " + timeOffset + "s");
                    }
                }
                
                // Move all selected keyframes of this property by the time offset using remove/recreate approach
                var prop = propData.propObject;
                var keyframesToMove = [];
                
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
                            temporalAutoBezier: prop.keyTemporalAutoBezier(keyIndex)
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
                    prop.setInterpolationTypeAtKey(newIdx, keyData.inInterp, keyData.outInterp);
                    
                    // Only set temporal ease if it was bezier
                    if (keyData.inEase !== undefined) {
                        prop.setTemporalEaseAtKey(newIdx, keyData.inEase, keyData.outEase);
                    }
                    
                    prop.setTemporalContinuousAtKey(newIdx, keyData.temporalContinuous);
                    prop.setTemporalAutoBezierAtKey(newIdx, keyData.temporalAutoBezier);
                    
                    if (keyData.spatialContinuous !== undefined) {
                        prop.setSpatialContinuousAtKey(newIdx, keyData.spatialContinuous);
                        prop.setSpatialAutoBezierAtKey(newIdx, keyData.spatialAutoBezier);
                        prop.setSpatialTangentsAtKey(newIdx, keyData.inTangent, keyData.outTangent);
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
                
                // Store new indices for later selection
                propData.newSelIndices = newSelIndices;
            }
            
            debugInfo.push("Total keyframes moved: " + movedCount);
            
        } catch(moveError) {
            app.endUndoGroup();
            return "error|Keyframe moving error: " + moveError.toString() + " | " + debugInfo.join(" | ");
        }
        
        // Final pass: Select all the new keyframes after all adjustments are complete
        try {
            for (var i = 0; i < propertyDelays.length; i++) {
                var propData = propertyDelays[i];
                if (propData.newSelIndices) {
                    var prop = propData.propObject;
                    for (var k = 0; k < propData.newSelIndices.length; k++) {
                        prop.setSelectedAtKey(propData.newSelIndices[k], true);
                    }
                    debugInfo.push("Selected " + propData.newSelIndices.length + " keyframes on " + propData.property);
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
        
        returnFrames = Math.round(returnDelayMs * frameRate / 1000);
        
        var result = "success|" + returnDelayMs + "|" + returnFrames + "|" + isCrossPropertyMode;
        DEBUG_JSX.log("Returning result: " + result);
        
        return result;
        
    } catch(e) {
        app.endUndoGroup();
        var errorMsg = e.toString();
        if (errorMsg.indexOf("divide by zero") !== -1) {
            return "error|Divide by zero in delay nudging. Debug: propertyTimes=" + (typeof propertyTimes !== 'undefined' ? propertyTimes.length : 'undefined') + ", direction=" + direction + ". Error: " + errorMsg;
        } else {
            return "error|Failed to nudge delay: " + errorMsg;
        }
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
            DEBUG_JSX.log("Not snapped, direction -, result: " + result);
            return result;
        }
    }
}

// X Position nudging functions
function nudgeXPosition(pixelAmount, direction) {
    try {
        return nudgePositionAxis('x', pixelAmount, direction);
    } catch(e) {
        return "error|Failed to nudge X position: " + e.toString();
    }
}

// Y Position nudging functions  
function nudgeYPosition(pixelAmount, direction) {
    try {
        return nudgePositionAxis('y', pixelAmount, direction);
    } catch(e) {
        return "error|Failed to nudge Y position: " + e.toString();
    }
}

// Core position nudging function with distance-based smart 10px snapping
function nudgePositionAxis(axis, nudgeDirection, direction) {
    try {
        app.beginUndoGroup("Nudge " + axis.toUpperCase() + " Distance");
        
        var comp = app.project.activeItem;
        if (!(comp && comp instanceof CompItem)) {
            app.endUndoGroup();
            return "error|Please select a composition";
        }
        
        var selectedLayers = comp.selectedLayers;
        var processedAny = false;
        var finalDistance = 0;
        var hasDistance = false;
        
        for (var i = 0; i < selectedLayers.length; i++) {
            var layer = selectedLayers[i];
            var selectedProps = layer.selectedProperties;
            
            for (var j = 0; j < selectedProps.length; j++) {
                var prop = selectedProps[j];
                if (prop.propertyValueType === PropertyValueType.NO_VALUE || prop.numKeys < 2) continue;
                
                var selKeys = prop.selectedKeys;
                if (selKeys.length < 2) continue;
                
                // Check if this is a position-related property and if it matches the axis
                if (!isPositionProperty(prop)) continue;
                
                // Check axis compatibility
                var propName = prop.name.toLowerCase();
                var isValidAxis = false;
                
                if (axis === 'x') {
                    // X axis: works with Position or X Position
                    isValidAxis = (propName === "position" || propName === "x position");
                } else {
                    // Y axis: works with Position or Y Position  
                    isValidAxis = (propName === "position" || propName === "y position");
                }
                
                if (!isValidAxis) {
                    // Return axis mismatch error
                    app.endUndoGroup();
                    return "error|Select " + axis.toUpperCase() + " position keyframes";
                }
                
                processedAny = true;
                
                // Sort selected key indices
                selKeys.sort(function(a, b) { return a - b; });
                
                // Get the first and last keyframes for distance calculation
                var firstKeyIndex = selKeys[0];
                var lastKeyIndex = selKeys[selKeys.length - 1];
                
                var firstValue = prop.keyValue(firstKeyIndex);
                var lastValue = prop.keyValue(lastKeyIndex);
                
                // Extract the coordinate values for the specified axis
                var firstCoord, lastCoord;
                
                if (firstValue instanceof Array && lastValue instanceof Array) {
                    // 2D Position case [x, y]
                    if (firstValue.length >= 2 && lastValue.length >= 2) {
                        firstCoord = axis === 'x' ? firstValue[0] : firstValue[1];
                        lastCoord = axis === 'x' ? lastValue[0] : lastValue[1];
                    } else {
                        continue;
                    }
                } else if (typeof firstValue === "number" && typeof lastValue === "number") {
                    // 1D Position case
                    firstCoord = firstValue;
                    lastCoord = lastValue;
                } else {
                    continue;
                }
                
                // Calculate current distance
                var currentDistance = Math.abs(lastCoord - firstCoord);
                
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
                
                // Calculate target distance using smart 5px snapping (resolution-aware)
                var targetDistance = calculateSmartDistanceNudge(currentDistance, nudgeDirection, resolutionMultiplier);
                
                // Calculate the adjustment needed
                var distanceDifference = targetDistance - currentDistance;
                
                // Determine which keyframe to move and in which direction
                var keyIndexToMove, newCoord;
                
                if (direction === 'in') {
                    // "In" mode: move first keyframe to achieve target distance
                    keyIndexToMove = firstKeyIndex;
                    if (lastCoord >= firstCoord) {
                        // Normal case: last > first, move first towards/away from last
                        newCoord = firstCoord - distanceDifference;
                    } else {
                        // Reverse case: first > last, move first towards/away from last
                        newCoord = firstCoord + distanceDifference;
                    }
                } else {
                    // "Out" mode: move last keyframe to achieve target distance  
                    keyIndexToMove = lastKeyIndex;
                    if (lastCoord >= firstCoord) {
                        // Normal case: last > first, move last towards/away from first
                        newCoord = lastCoord + distanceDifference;
                    } else {
                        // Reverse case: first > last, move last towards/away from first
                        newCoord = lastCoord - distanceDifference;
                    }
                }
                
                // Apply the new value
                var currentValue = prop.keyValue(keyIndexToMove);
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
                    continue;
                }
                
                // Apply the new keyframe value
                try {
                    prop.setValueAtKey(keyIndexToMove, newValue);
                } catch(e) {
                    $.writeln("Failed to set keyframe value: " + e.toString());
                }
                
                // Store the final distance for return
                finalDistance = targetDistance;
                hasDistance = true;
            }
        }
        
        app.endUndoGroup();
        
        if (!processedAny) {
            return "error|Select " + axis.toUpperCase() + " position keyframes";
        }
        
        // Recalculate total distance for display (in case of multi-keyframe paths)
        if (processedAny) {
            // Re-read to get accurate total distance through all keyframes
            var readResult = readKeyframesDuration();
            if (readResult && readResult.indexOf('success|') === 0) {
                var parts = readResult.split('|');
                var xDistance = parseFloat(parts[6]) || 0;
                var yDistance = parseFloat(parts[7]) || 0;
                var hasXDistance = parts[8] === '1';
                var hasYDistance = parts[9] === '1';
                
                if (axis === 'x' && hasXDistance) {
                    finalDistance = xDistance;
                } else if (axis === 'y' && hasYDistance) {
                    finalDistance = yDistance;
                }
            }
        }
        
        return "success|" + finalDistance + "|" + (hasDistance ? "1" : "0");
        
    } catch(e) {
        app.endUndoGroup();
        return "error|Failed to nudge distance: " + e.toString();
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
    if (!posProperty || keyIndices.length < 2) return { x: 0, y: 0, hasX: false, hasY: false };
    
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
        // 2D Position case
        if (value1.length >= 2 && value2.length >= 2) {
            totalXDist = Math.abs(value2[0] - value1[0]);
            totalYDist = Math.abs(value2[1] - value1[1]);
            hasXData = true;
            hasYData = true;
        }
    } else if (typeof value1 === "number" && typeof value2 === "number") {
        // 1D Position case (X Position or Y Position)
        var propName = posProperty.name.toLowerCase();
        if (propName === "x position") {
            totalXDist = Math.abs(value2 - value1);
            hasXData = true;
        } else if (propName === "y position") {
            totalYDist = Math.abs(value2 - value1);
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
    
    // Check if current distance is already aligned to scaledIncrement boundary
    var remainder = Math.abs(currentDistance % scaledIncrement);
    var tolerance = 0.1;
    var isAlreadySnapped = (remainder < tolerance) || (remainder > (scaledIncrement - tolerance));
    
    if (isAlreadySnapped) {
        // Already snapped to boundary - apply scaled increment/decrement
        if (nudgeDirection > 0) {
            // + button: increase distance by scaledIncrement
            return currentDistance + scaledIncrement;
        } else {
            // - button: decrease distance by scaledIncrement (minimum 0)
            return Math.max(0, currentDistance - scaledIncrement);
        }
    } else {
        // Not snapped yet - snap to nearest scaledIncrement multiple
        if (nudgeDirection > 0) {
            // + button: snap to next higher scaledIncrement
            return Math.ceil(currentDistance / scaledIncrement) * scaledIncrement;
        } else {
            // - button: snap to next lower scaledIncrement (minimum 0)
            return Math.max(0, Math.floor(currentDistance / scaledIncrement) * scaledIncrement);
        }
    }
}

// Helper function to move composition to appropriate folder based on device type
function moveCompositionToFolder(comp, deviceType) {
    try {
        // Define folder structure mapping
        var folderMapping = {
            "iphone": "01 - Compositions > Native",
            "desktop": "01 - Compositions > Desktop"
        };
        
        var targetFolderPath = folderMapping[deviceType];
        if (!targetFolderPath) {
            $.writeln("Unknown device type for folder organization: " + deviceType);
            return;
        }
        
        // Split the path to get folder hierarchy
        var folderNames = targetFolderPath.split(" > ");
        var currentFolder = null;
        
        // Find or create the folder hierarchy
        for (var i = 0; i < folderNames.length; i++) {
            var folderName = folderNames[i];
            var foundFolder = null;
            
            if (currentFolder === null) {
                // Look in root level
                for (var j = 1; j <= app.project.items.length; j++) {
                    var item = app.project.items[j];
                    if (item instanceof FolderItem && item.name === folderName) {
                        foundFolder = item;
                        break;
                    }
                }
            } else {
                // Look in current folder
                for (var k = 1; k <= currentFolder.items.length; k++) {
                    var item = currentFolder.items[k];
                    if (item instanceof FolderItem && item.name === folderName) {
                        foundFolder = item;
                        break;
                    }
                }
            }
            
            // Create folder if not found
            if (!foundFolder) {
                if (currentFolder === null) {
                    foundFolder = app.project.items.addFolder(folderName);
                } else {
                    foundFolder = currentFolder.items.addFolder(folderName);
                }
            }
            
            currentFolder = foundFolder;
        }
        
        // Move the composition to the target folder
        if (currentFolder) {
            comp.parentFolder = currentFolder;
        }
        
    } catch(e) {
        $.writeln("Error in moveCompositionToFolder: " + e.toString());
    }
}

// Helper function to find or create the zImported_projects folder
function getOrCreateImportedProjectsFolder() {
    try {
        // Look for 03 - Assets folder first
        var assetsFolder = null;
        for (var i = 1; i <= app.project.items.length; i++) {
            var item = app.project.items[i];
            if (item instanceof FolderItem && item.name === "03 - Assets") {
                assetsFolder = item;
                break;
            }
        }
        
        // If no Assets folder exists, create it
        if (!assetsFolder) {
            assetsFolder = app.project.items.addFolder("03 - Assets");
        }
        
        // Look for zImported_projects folder inside Assets
        var importedFolder = null;
        for (var j = 1; j <= assetsFolder.items.length; j++) {
            var item = assetsFolder.items[j];
            if (item instanceof FolderItem && item.name === "zImported_projects") {
                importedFolder = item;
                break;
            }
        }
        
        // If no zImported_projects folder exists, create it
        if (!importedFolder) {
            importedFolder = assetsFolder.items.addFolder("zImported_projects");
        }
        
        return importedFolder;
    } catch(e) {
        // If we can't create the folder structure, return null (import will go to root)
        $.writeln("Could not create zImported_projects folder: " + e.toString());
        return null;
    }
}



// Device Templates functionality
function createDeviceComposition(deviceType, multiplier) {
    // app.beginUndoGroup("Create Device Composition");
    
    try {
        // Base device specifications (1x scale)
        var baseSpecs = {
            iphone: { width: 393, height: 852 },
            desktop: { width: 1440, height: 1028 }
        };
        
        // Get base dimensions for selected device
        var baseDimensions = baseSpecs[deviceType];
        if (!baseDimensions) {
            alert("Invalid device type");
            // app.endUndoGroup();
            return "error";
        }
        
        // Calculate dimensions based on multiplier
        var dimensions = {
            width: baseDimensions.width * multiplier,
            height: baseDimensions.height * multiplier
        };
        
        // Create composition name
        var compName = deviceType.charAt(0).toUpperCase() + deviceType.slice(1) + " @" + multiplier + "x";
        
        // Create new composition
        var comp = app.project.items.addComp(
            compName,                    // name
            dimensions.width,            // width
            dimensions.height,           // height
            1.0,                        // pixel aspect ratio
            10.0,                       // duration (10 seconds)
            60                          // frame rate (60fps)
        );
        
        // Set background color to white
        comp.bgColor = [1, 1, 1];
        
        // If it's an iPhone, import and add the iPhone UI template
        if (deviceType === "iphone") {
            try {
                // Build path to the template file
                var templatePath = extensionRoot + "/assets/templates/AirBoard Templates.aep";
                var templateFile = new File(templatePath);
                
                // Check alternate path separator
                if (!templateFile.exists) {
                    templatePath = extensionRoot + "\\assets\\templates\\AirBoard Templates.aep";
                    templateFile = new File(templatePath);
                }
                
                if (templateFile.exists) {
                    // First check if the template composition already exists in the project
                    var templateComp = null;
                    for (var i = 1; i <= app.project.items.length; i++) {
                        var item = app.project.items[i];
                        if (item instanceof CompItem && item.name === "iPhone 14 UI") {
                            templateComp = item;
                            break;
                        }
                    }
                    
                    // Only import if not already present
                    if (!templateComp) {
                        var importOptions = new ImportOptions(templateFile);
                        var importedItems = app.project.importFile(importOptions);
                        
                        // Move imported items to the zImported_projects folder
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
                        
                        // Find the imported composition first
                        for (var j = 1; j <= app.project.items.length; j++) {
                            var item = app.project.items[j];
                            if (item instanceof CompItem && item.name === "iPhone 14 UI") {
                                templateComp = item;
                                break;
                            }
                        }
                        
                    }
                    
                    if (templateComp) {
                        // Add the template comp as a layer to our new comp
                        var templateLayer = comp.layers.add(templateComp);
                        templateLayer.name = "iPhone UI";
                        
                        // Calculate scale factor based on the multiplier
                        // The template is designed for @2x, so we need to scale relative to that
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
            } catch(templateError) {
                // Non-fatal if template import fails
                $.writeln("Template import error: " + templateError.toString());
            }
        }
        
        
        // Open the composition in the viewer
        comp.openInViewer();
        
        // Create the full AE project folder structure (same as AE Folders button)
        try {
            var folderStructure = [
                {
                    name: "01 - Compositions",
                    subfolders: [
                        {
                            name: "Desktop",
                            subfolders: [
                                { name: "01_Specs" },
                                { name: "02_Lottie" }
                            ]
                        },
                        {
                            name: "Native", 
                            subfolders: [
                                { name: "01_Specs" },
                                { name: "02_Lottie" }
                            ]
                        },
                        { name: "zArchive" }
                    ]
                },
                { name: "02 - Precomps" },
                {
                    name: "03 - Assets",
                    subfolders: [
                        { name: "Images" },
                        { name: "Reference" },
                        { name: "Renders" },
                        { name: "Vector" },
                        { name: "Video" },
                        { name: "zImported_projects" }
                    ]
                }
            ];
            
            // Create the folder structure recursively (reuses existing function)
            createFolderStructure(app.project, folderStructure);
        } catch(folderError) {
            $.writeln("Folder structure creation failed: " + folderError.toString());
        }
        
        // Move composition to appropriate folder
        try {
            moveCompositionToFolder(comp, deviceType);
        } catch(orgError) {
            $.writeln("Composition organization failed: " + orgError.toString());
        }
        
        // app.endUndoGroup();
        return "success";
        
    } catch(e) {
        alert("Error creating device composition: " + e.toString());
        // app.endUndoGroup();
        return "error";
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
            
            // Move imported items to the zImported_projects folder
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
                compName: "iPhone 14 UI",
                layerName: "iPhone 14 UI",
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
            
            // Move imported items to the zImported_projects folder
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
        
        // Set layer start time to current playhead position
        try {
            var playheadTime = comp.time;
            componentLayer.startTime = playheadTime;
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
function createSquircleFromPanel() {
    try {
        applySquircle();
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

// Apply the complete preset
function applySquircle() {
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
    
    // *** Ensure Create behavior has Unified Corners ON and Unified Radius default 64 ***
    try {
        var squircleEffect = layer.property("Effects").property("Squircle");
        if (squircleEffect) {
            try { squircleEffect.property("Unified Corners").setValue(1); } catch(e1) {}
            try { squircleEffect.property("Unified Radius").setValue(64); } catch(e2) {}
            // Also set individual corners to 64 so visual default matches
            try { squircleEffect.property("Top Left").setValue(64); } catch(e3) {}
            try { squircleEffect.property("Top Right").setValue(64); } catch(e4) {}
            try { squircleEffect.property("Bottom Left").setValue(64); } catch(e5) {}
            try { squircleEffect.property("Bottom Right").setValue(64); } catch(e6) {}
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
        var mainFolders = ["01 - Compositions", "02 - Precomps", "03 - Assets"];
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
        
        // If all 3 main folders exist, show message and return
        if (existingFolders === mainFolders.length) {
            alert("AE Folders have already been created");
            return "already_exists";
        }
        
        // Define the folder structure
        var folderStructure = [
            {
                name: "01 - Compositions",
                subfolders: [
                    {
                        name: "Desktop",
                        subfolders: [
                            { name: "01_Specs" },
                            { name: "02_Lottie" }
                        ]
                    },
                    {
                        name: "Native", 
                        subfolders: [
                            { name: "01_Specs" },
                            { name: "02_Lottie" }
                        ]
                    },
                    { name: "zArchive" }
                ]
            },
            { name: "02 - Precomps" },
            {
                name: "03 - Assets",
                subfolders: [
                    { name: "Images" },
                    { name: "Reference" },
                    { name: "Renders" },
                    { name: "Vector" },
                    { name: "Video" },
                    { name: "zImported_projects" }
                ]
            }
        ];
        
        // Create the folder structure recursively
        createFolderStructure(app.project, folderStructure);
        
        return "success";
        
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
                    { name: "Figma" },
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
            { name: "05 - Prototypes" },
            { name: "06 - Decks" }
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
                    alert("Project folder structure created successfully!\nProject saved to: " + saveFile.fsName);
                } catch(saveError) {
                    alert("Folder structure created, but could not save project: " + saveError.toString());
                }
            } else {
                alert("Project folder structure created successfully!\nProject save was cancelled.");
            }
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
                
                // Get the group's transform position and anchor
                var groupTransform = group.property("Transform");
                var groupPosition = [0, 0];
                var groupAnchor = [0, 0];
                if (groupTransform) {
                    try { if (groupTransform.property("Position")) groupPosition = groupTransform.property("Position").value; } catch(ePos) {}
                    try { if (groupTransform.property("Anchor Point")) groupAnchor = groupTransform.property("Anchor Point").value; } catch(eAnc) {}
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
            
            // List all effects after preset application for debugging
            debugInfo.push("📋 Current effects on layer:");
            var effects = targetLayer.Effects;
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
    var easeIn = new KeyframeEase(0.40, 40);
    var easeOut = new KeyframeEase(0.20, 80);
    
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
    var easeIn = new KeyframeEase(0.40, 40);
    var easeOut = new KeyframeEase(0.20, 80);
    
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