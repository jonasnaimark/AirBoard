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
        
        var propertyTimes = [];
        
        // Generic function to recursively search for selected keyframes
        function searchAllProperties(propGroup, layerRef) {
            for (var i = 1; i <= propGroup.numProperties; i++) {
                var prop = propGroup.property(i);
                
                // Check if this property has keyframes and selected keyframes
                if (prop && prop.canVaryOverTime && prop.numKeys > 0) {
                    for (var j = 1; j <= prop.numKeys; j++) {
                        if (prop.keySelected(j)) {
                            propertyTimes.push({
                                name: prop.name,
                                property: prop,
                                layer: layerRef,
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
                    for (var j = 1; j <= layer.timeRemap.numKeys; j++) {
                        if (layer.timeRemap.keySelected(j)) {
                            propertyTimes.push({
                                name: "Time Remap",
                                property: layer.timeRemap,
                                layer: layer,
                                time: layer.timeRemap.keyTime(j),
                                keyIndex: j
                            });
                            break;
                        }
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
        
        // If only 1 keyframe selected total, return special result with duration error
        if (totalSelectedKeyframes === 1) {
            DEBUG_JSX.log("Only 1 keyframe selected - showing duration error");
            
            // Return success but with -999 duration to signal error
            var frameRate = comp.frameRate || 30;
            var delayMs = 0, delayFrames = 0; // No delay for single keyframe
            var debugInfo = "Single keyframe selected - duration operations require 2+ keyframes";
            
            // Use -999 as a special flag for "Select > 1 Keyframe" in duration field
            return "success|" + delayMs + "|" + delayFrames + "|-999|-999|1|0|0|0|0|1|Stagger|" + debugInfo;
        }
        
        // CROSS-PROPERTY MODE: Multiple properties with selected keyframes
        if (propertyTimes.length >= 2) {
            // Sort by time and calculate delays from earliest
            propertyTimes.sort(function(a, b) { return a.time - b.time; });
            var earliestTime = propertyTimes[0].time;
            
            // Calculate all delays from earliest keyframe
            var delays = [];
            for (var k = 0; k < propertyTimes.length; k++) {
                var delayMs = roundMs(propertyTimes[k].time - earliestTime);
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
            
            // Calculate durations for each property in cross-property mode
            var propertyDurations = [];
            var resultDurationMs = 0, resultDurationFrames = 0;
            
            // First, calculate duration for each property
            for (var k = 0; k < propertyTimes.length; k++) {
                var propInfo = propertyTimes[k];
                var prop = propInfo.property;
                
                // Collect ALL selected keyframes for this property
                var allSelectedKeys = [];
                for (var j = 1; j <= prop.numKeys; j++) {
                    if (prop.keySelected(j)) {
                        allSelectedKeys.push(j);
                    }
                }
                
                if (allSelectedKeys.length >= 2) {
                    // Calculate duration by finding time span of selected keyframes
                    var times = [];
                    for (var j = 0; j < allSelectedKeys.length; j++) {
                        times.push(prop.keyTime(allSelectedKeys[j]));
                    }
                    times.sort(function(a, b) { return a - b; });
                    var durationSeconds = times[times.length - 1] - times[0];
                    var durationMs = roundMs(durationSeconds);
                    propertyDurations.push(durationMs);
                    DEBUG_JSX.log("Property " + propInfo.name + " duration: " + durationMs + "ms");
                }
            }
            
            // Check if all properties have the same duration
            if (propertyDurations.length > 0) {
                var allSameDuration = true;
                var firstDuration = propertyDurations[0];
                for (var k = 1; k < propertyDurations.length; k++) {
                    if (Math.abs(propertyDurations[k] - firstDuration) > 1) { // 1ms tolerance
                        allSameDuration = false;
                        break;
                    }
                }
                
                if (allSameDuration) {
                    resultDurationMs = firstDuration;
                    resultDurationFrames = Math.round((resultDurationMs / 1000) * frameRate);
                    DEBUG_JSX.log("All properties have same duration: " + resultDurationMs + "ms");
                } else {
                    // Calculate total duration span from first to last keyframe across all properties
                    var earliestTime = Infinity;
                    var latestTime = -Infinity;
                    
                    // Group propertyTimes by property to find first and last keyframes for each property
                    var propertyGroups = {};
                    for (var k = 0; k < propertyTimes.length; k++) {
                        var propInfo = propertyTimes[k];
                        var propKey = propInfo.name + "_" + propInfo.layer.index; // Unique key per property per layer
                        
                        if (!propertyGroups[propKey]) {
                            propertyGroups[propKey] = {
                                property: propInfo.property,
                                times: []
                            };
                        }
                        propertyGroups[propKey].times.push(propInfo.time);
                    }
                    
                    // For each property group, find the earliest and latest selected keyframe times
                    for (var propKey in propertyGroups) {
                        var group = propertyGroups[propKey];
                        var prop = group.property;
                        var selectedTimes = [];
                        
                        // Get all selected keyframe times for this property
                        for (var j = 1; j <= prop.numKeys; j++) {
                            if (prop.keySelected(j)) {
                                selectedTimes.push(prop.keyTime(j));
                            }
                        }
                        
                        if (selectedTimes.length > 0) {
                            // Sort times to get first and last
                            selectedTimes.sort(function(a, b) { return a - b; });
                            var propFirstTime = selectedTimes[0];
                            var propLastTime = selectedTimes[selectedTimes.length - 1];
                            
                            // Update global earliest and latest
                            if (propFirstTime < earliestTime) {
                                earliestTime = propFirstTime;
                            }
                            if (propLastTime > latestTime) {
                                latestTime = propLastTime;
                            }
                        }
                    }
                    
                    // Check if we found valid times
                    if (earliestTime !== Infinity && latestTime !== -Infinity) {
                        var totalSpanSeconds = latestTime - earliestTime;
                        resultDurationMs = roundMs(totalSpanSeconds);
                        resultDurationFrames = Math.round(totalSpanSeconds * frameRate);
                        DEBUG_JSX.log("Properties have different durations, total span: " + resultDurationMs + "ms (from " + (earliestTime * 1000) + "ms to " + (latestTime * 1000) + "ms)");
                    } else {
                        // Fallback if we couldn't find valid times
                        resultDurationMs = -1;
                        resultDurationFrames = -1;
                        DEBUG_JSX.log("Could not calculate total span, using Multiple");
                    }
                }
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
                staggerText = calculateStagger(propertyTimes, frameRate, true); // true = keyframe mode
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

// Calculate stagger from timing data (works for both keyframes and layers)
function calculateStagger(timingData, frameRate, isKeyframeMode) {
    try {
        DEBUG_JSX.log("calculateStagger called with " + timingData.length + " items, isKeyframeMode=" + isKeyframeMode);
        
        if (timingData.length <= 1) {
            DEBUG_JSX.log("calculateStagger: Only " + timingData.length + " items, returning default");
            return "Stagger"; // Default text for single item
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
                
                // Collect all keyframe times for this layer (not just earliest)
                var timeMs = roundMs(item.time);
                // ExtendScript doesn't have indexOf, so use manual search
                var timeExists = false;
                for (var t = 0; t < layerGroups[layerIndex].times.length; t++) {
                    if (layerGroups[layerIndex].times[t] === timeMs) {
                        timeExists = true;
                        break;
                    }
                }
                if (!timeExists) {
                    layerGroups[layerIndex].times.push(timeMs);
                }
            }
            
            // Convert to array and use earliest time per layer for stagger calculation
            for (var layerIndex in layerGroups) {
                var group = layerGroups[layerIndex];
                group.times.sort(function(a, b) { return a - b; }); // Sort times
                DEBUG_JSX.log("Layer " + group.name + " (index " + group.index + ") has times: " + group.times.join(", ") + "ms, using earliest: " + group.times[0] + "ms");
                layerTimes.push({
                    time: group.times[0] / 1000, // Use earliest time in seconds
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
        
        // Sort by layer index for both keyframe and layer modes to get correct stagger sign
        // (bottom to top = highest index to lowest index)
        layerTimes.sort(function(a, b) { return b.index - a.index; });
        
        if (isKeyframeMode) {
            DEBUG_JSX.log("After sorting by layer index (bottom to top):");
            for (var i = 0; i < layerTimes.length; i++) {
                DEBUG_JSX.log("  Layer " + layerTimes[i].index + " (" + layerTimes[i].name + ") at " + Math.round(layerTimes[i].time * 1000) + "ms");
            }
        }
        
        // Calculate time differences between consecutive items
        var staggers = [];
        for (var i = 1; i < layerTimes.length; i++) {
            var staggerSeconds = layerTimes[i].time - layerTimes[i-1].time;
            var staggerMs = roundMs(staggerSeconds);
            DEBUG_JSX.log("Stagger " + i + ": " + Math.round(layerTimes[i-1].time * 1000) + "ms -> " + Math.round(layerTimes[i].time * 1000) + "ms = " + staggerMs + "ms");
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
        var sign = firstStagger < 0 ? "-" : "";
        
        return sign + Math.abs(firstStagger) + "ms / " + sign + staggerFrames + "f";
        
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
            staggerText = calculateStagger(layerTimes, frameRate, false); // false = layer mode
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
            return "error|Select > 1 Keyframe";
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
                            prop.setInterpolationTypeAtKey(newIdx, data.inInterp, data.outInterp);
                            
                            // CRITICAL FIX: Restore temporal ease if it exists (same as timeline mode)
                            if (data.inEase !== undefined && data.outEase !== undefined) {
                                try {
                                    prop.setTemporalEaseAtKey(newIdx, data.inEase, data.outEase);
                                } catch(e) {
                                    // Some properties might not support temporal ease
                                }
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
            return "error|Select > 1 Keyframe";
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
                
                // SMART SNAPPING: Snap to nearest interval based on frame input
                var durationMs = duration * 1000;
                var snapInterval = framesToMs; // The interval to snap to (e.g., 50ms for 3 frames at 60fps)
                var newDurationMs;
                
                // Check if duration is already snapped to the interval
                var remainder = durationMs % snapInterval;
                var isAlreadySnapped = remainder < 1 || remainder > (snapInterval - 1); // Within 1ms tolerance
                
                if (direction > 0) {
                    // Expand duration - snap to next interval up
                    if (isAlreadySnapped) {
                        // Already snapped, go to next interval
                        newDurationMs = durationMs + snapInterval;
                    } else {
                        // Not snapped, snap up to next interval
                        newDurationMs = Math.ceil(durationMs / snapInterval) * snapInterval;
                    }
                } else {
                    // Contract duration - snap to next interval down
                    if (isAlreadySnapped) {
                        // Already snapped, go to previous interval
                        newDurationMs = durationMs - snapInterval;
                    } else {
                        // Not snapped, snap down to previous interval
                        newDurationMs = Math.floor(durationMs / snapInterval) * snapInterval;
                    }
                }
                
                // Ensure we don't go below one frame duration
                var minDurationMs = frameDuration * 1000;
                if (newDurationMs < minDurationMs) {
                    newDurationMs = minDurationMs;
                }
                
                DEBUG_JSX.log("Smart snap: " + durationMs + "ms -> " + newDurationMs + "ms (interval: " + snapInterval + "ms, was snapped: " + isAlreadySnapped + ")");
                
                // Convert back to seconds
                var newDuration = newDurationMs / 1000;
                
                // Store the maximum duration across all properties
                if (newDuration > totalDuration) {
                    totalDuration = newDuration;
                    DEBUG_JSX.log("New maximum duration: " + (newDuration * 1000) + "ms from " + (prop.name || "unknown property"));
                }
                
                if (isTimeRemap) {
                    // TIME REMAPPING: Special handling to avoid deletion (same as original)
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
                        
                        // Try using setKeyTime method for time remapping with deferred selection
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
                                // COLLECT indices first, don't select yet
                                processedIndices.push(keyIndex);
                            } catch(e) {
                                // If setKeyTime fails, fall back to record/delete/recreate but with minimal properties
                                console.log("setKeyTime failed for time remapping, trying fallback...");
                                prop.removeKey(keyIndex);
                                var newIdx = prop.addKey(newTime);
                                try {
                                    prop.setValueAtKey(newIdx, data.value);
                                    // COLLECT indices first, don't select yet
                                    processedIndices.push(newIdx);
                                } catch(e2) {
                                    // Even this might fail
                                }
                            }
                        }
                        
                        // DEFERRED SELECTION: Select all time remap keyframes at the very end
                        for (var i = 0; i < processedIndices.length; i++) {
                            try {
                                prop.setSelectedAtKey(processedIndices[i], true);
                            } catch(e) {
                                // Selection might fail but continue
                            }
                        }
                        
                    } catch(timeRemapError) {
                        console.log("Time remapping failed: " + timeRemapError.toString());
                        // Don't break the entire operation
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
                        
                        try {
                            prop.setValueAtKey(newIdx, data.value);
                            prop.setInterpolationTypeAtKey(newIdx, data.inInterp, data.outInterp);
                            
                            // CRITICAL FIX: Restore temporal ease if it exists (same as timeline mode)
                            if (data.inEase !== undefined && data.outEase !== undefined) {
                                try {
                                    prop.setTemporalEaseAtKey(newIdx, data.inEase, data.outEase);
                                } catch(e) {
                                    // Some properties might not support temporal ease
                                }
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
                        
                        // COLLECT indices first, don't select yet
                        newSelIndices.push(newIdx);
                    }
                    
                    // COLLECT selections for GLOBAL restoration at the very end (include layer reference)
                    DEBUG_JSX.log("🎬 COLLECTING " + newSelIndices.length + " keyframe selections for property " + prop.name + " on layer " + cached.layerName);
                    allProcessedSelections.push({
                        property: prop,
                        indices: newSelIndices,
                        propertyName: prop.name,
                        layer: cached.layer  // Store layer reference for fresh property lookup
                    });
                }
        }
        
        app.endUndoGroup();
        
        if (!processedAny) {
            return "error|Select > 1 Keyframe";
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
        
        // Re-acquire fresh references and restore selections
        var freshSelectionData = [];
        for (var i = 0; i < allProcessedSelections.length; i++) {
            var selectionData = allProcessedSelections[i];
            var originalLayer = selectionData.layer; // Use stored layer reference
            
            // Re-acquire fresh property reference from the stored layer
            var freshProp = findPropertyByName(originalLayer, selectionData.propertyName);
            if (freshProp) {
                DEBUG_JSX.log("🎬 Found fresh reference for " + selectionData.propertyName + " on layer " + originalLayer.name);
                
                freshSelectionData.push({
                    property: freshProp,
                    indices: selectionData.indices,
                    propertyName: selectionData.propertyName,
                    layerName: originalLayer.name
                });
            } else {
                DEBUG_JSX.log("🎬 WARNING: Could not find fresh reference for " + selectionData.propertyName + " on layer " + originalLayer.name);
            }
        }
        
        // GLOBAL SELECTION RESTORATION: Select ALL keyframes using fresh references
        DEBUG_JSX.log("🎬 GLOBAL SELECTION RESTORATION: Processing " + freshSelectionData.length + " fresh properties");
        for (var i = 0; i < freshSelectionData.length; i++) {
            var selectionData = freshSelectionData[i];
            var prop = selectionData.property;
            var indices = selectionData.indices;
            
            // CRITICAL: First deselect ALL keyframes on this property
            DEBUG_JSX.log("🎬 Deselecting all keyframes on " + selectionData.propertyName + " (has " + prop.numKeys + " total keyframes)");
            for (var k = 1; k <= prop.numKeys; k++) {
                try {
                    prop.setSelectedAtKey(k, false);
                } catch(e) {
                    // Ignore deselection errors
                }
            }
            
            // Now select only the keyframes we want
            DEBUG_JSX.log("🎬 Restoring selection for " + selectionData.propertyName + " on layer " + selectionData.layerName + " - " + indices.length + " keyframes");
            for (var j = 0; j < indices.length; j++) {
                try {
                    prop.setSelectedAtKey(indices[j], true);
                    DEBUG_JSX.log("🎬 FRESH Selected keyframe at index " + indices[j] + " on " + selectionData.propertyName);
                } catch(e) {
                    DEBUG_JSX.log("🎬 FRESH Failed to select keyframe at index " + indices[j] + ": " + e.toString());
                }
            }
        }
        
        // NOTE: We intentionally do NOT set prop.selected = true here
        // because that can cause After Effects to auto-select ALL keyframes on the property
        // We've already selected the specific keyframes we want above
        
        // Return success with new duration
        var newDurationMs = roundMs(totalDuration);
        var newDurationFrames = Math.round(totalDuration * frameRate);
        
        DEBUG_JSX.log("🎬 Frame-based duration stretch completed: " + newDurationMs + "ms / " + newDurationFrames + "f");
        
        // Include debug messages in result
        var debugMessages = DEBUG_JSX.getMessages();
        return "success|" + newDurationMs + "|" + newDurationFrames + "|" + debugMessages.join("|");
        
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
        
        // Check if we're in cross-property mode first (same as original)
        var crossPropertyResult = checkCrossPropertyMode();
        DEBUG_JSX.log("Mode: " + (crossPropertyResult.isCrossProperty ? "cross-property" : "single-property"));
        
        // Add debug for what checkCrossPropertyMode actually found
        var comp = app.project.activeItem;
        var selectedLayers = comp.selectedLayers;
        DEBUG_JSX.log("🎬 MANUAL CHECK: " + selectedLayers.length + " selected layers");
        for (var layerIdx = 0; layerIdx < selectedLayers.length; layerIdx++) {
            var layer = selectedLayers[layerIdx];
            var selectedProps = layer.selectedProperties;
            DEBUG_JSX.log("🎬 MANUAL CHECK: Layer " + layer.name + " has " + selectedProps.length + " selected properties");
            for (var j = 0; j < selectedProps.length; j++) {
                var prop = selectedProps[j];
                var selKeys = prop.selectedKeys;
                DEBUG_JSX.log("🎬 MANUAL CHECK: Property " + prop.name + " has " + selKeys.length + " selected keyframes");
            }
        }
        
        if (crossPropertyResult.isCrossProperty) {
            // For cross-property mode, stretch each property's duration individually
            DEBUG_JSX.log("🎬 Using CROSS-PROPERTY mode - calling stretchKeyframesForCrossProperty");
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
        
        for (var i = 0; i < cachedSelections.length; i++) {
            var cached = cachedSelections[i];
            var prop = cached.property;
            var selKeys = cached.selectedIndices; // Use cached, not prop.selectedKeys!
            
            DEBUG_JSX.log("Process: " + cached.propertyName + " (" + selKeys.length + " keys)");
            
            // Use the duration stretching logic with cached selections
            var result = stretchPropertyDurationWithCache(prop, selKeys, direction * framesToSeconds, cached);
            if (result.success) {
                processedProperties++;
                
                // COLLECT selections for GLOBAL restoration at the very end
                allProcessedSelections.push({
                    property: prop,
                    indices: result.newSelIndices,
                    propertyName: cached.propertyName,
                    layer: cached.layer  // Store layer reference for fresh property lookup
                });
                
                // COLLECT all new keyframe times for total span calculation (like readKeyframesSmart does)
                for (var t = 0; t < result.newKeyframeTimes.length; t++) {
                    allProcessedKeyframeTimes.push(result.newKeyframeTimes[t]);
                }
                
                DEBUG_JSX.log("🎬 COLLECTED " + result.newSelIndices.length + " keyframe selections for property " + cached.propertyName + " with times: " + result.newKeyframeTimes.join(", "));
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
        
        // Re-acquire fresh references and restore selections
        var freshSelectionData = [];
        for (var i = 0; i < allProcessedSelections.length; i++) {
            var selectionData = allProcessedSelections[i];
            var originalLayer = selectionData.layer; // Use stored layer reference
            
            // Re-acquire fresh property reference from the stored layer
            var freshProp = findPropertyByName(originalLayer, selectionData.propertyName);
            if (freshProp) {
                DEBUG_JSX.log("🎬 Found fresh reference for " + selectionData.propertyName + " on layer " + originalLayer.name);
                
                freshSelectionData.push({
                    property: freshProp,
                    indices: selectionData.indices,
                    propertyName: selectionData.propertyName,
                    layerName: originalLayer.name
                });
            } else {
                DEBUG_JSX.log("🎬 WARNING: Could not find fresh reference for " + selectionData.propertyName + " on layer " + originalLayer.name);
            }
        }
        
        // STEP 4: GLOBAL SELECTION RESTORATION
        DEBUG_JSX.log("🎬 STEP 4: Global selection restoration for " + freshSelectionData.length + " fresh properties");
        for (var i = 0; i < freshSelectionData.length; i++) {
            var selectionData = freshSelectionData[i];
            var prop = selectionData.property;
            var indices = selectionData.indices;
            
            // CRITICAL: First deselect ALL keyframes on this property
            DEBUG_JSX.log("🎬 Deselecting all keyframes on " + selectionData.propertyName + " (has " + prop.numKeys + " total keyframes)");
            for (var k = 1; k <= prop.numKeys; k++) {
                try {
                    prop.setSelectedAtKey(k, false);
                } catch(e) {
                    // Ignore deselection errors
                }
            }
            
            // Now select only the keyframes we want
            DEBUG_JSX.log("🎬 Restoring selection for " + selectionData.propertyName + " on layer " + selectionData.layerName + " - " + indices.length + " keyframes");
            for (var j = 0; j < indices.length; j++) {
                try {
                    prop.setSelectedAtKey(indices[j], true);
                    DEBUG_JSX.log("🎬 FRESH Selected keyframe at index " + indices[j] + " on " + selectionData.propertyName);
                } catch(e) {
                    DEBUG_JSX.log("🎬 FRESH Failed to select keyframe at index " + indices[j] + ": " + e.toString());
                }
            }
        }
        
        app.endUndoGroup();
        
        // Calculate total span duration like readKeyframesSmart does for cross-property mode
        var totalDurationMs = 0;
        var totalDurationFrames = 0;
        
        if (allProcessedKeyframeTimes.length > 0) {
            // Sort all keyframe times to find earliest and latest
            allProcessedKeyframeTimes.sort(function(a, b) { return a - b; });
            var earliestTime = allProcessedKeyframeTimes[0];
            var latestTime = allProcessedKeyframeTimes[allProcessedKeyframeTimes.length - 1];
            var totalSpanSeconds = latestTime - earliestTime;
            
            totalDurationMs = Math.round(totalSpanSeconds * 1000);
            totalDurationFrames = Math.round(totalSpanSeconds * frameRate);
            
            DEBUG_JSX.log("🎬 Total span calculation: " + allProcessedKeyframeTimes.length + " keyframes from " + (earliestTime * 1000).toFixed(1) + "ms to " + (latestTime * 1000).toFixed(1) + "ms = " + totalDurationMs + "ms span");
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
function stretchPropertyDurationWithCache(prop, selectedKeys, deltaSeconds, cached) {
    try {
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
                temporalAutoBezier: prop.keyTemporalAutoBezier(keyIndex)
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
        var newKeyframeTimes = [];
        for (var k = 0; k < keyframeData.length; k++) {
            var data = keyframeData[k];
            var newIdx = prop.addKey(data.newTime);
            
            // Restore all attributes
            prop.setValueAtKey(newIdx, data.value);
            prop.setInterpolationTypeAtKey(newIdx, data.inInterp, data.outInterp);
            
            // Restore temporal ease if it exists (same as timeline mode)
            if (data.inEase !== undefined && data.outEase !== undefined) {
                try {
                    prop.setTemporalEaseAtKey(newIdx, data.inEase, data.outEase);
                } catch(e) {
                    // Some properties might not support temporal ease
                }
            }
            
            prop.setTemporalContinuousAtKey(newIdx, data.temporalContinuous);
            prop.setTemporalAutoBezierAtKey(newIdx, data.temporalAutoBezier);
            
            if (data.spatialContinuous !== undefined) {
                prop.setSpatialContinuousAtKey(newIdx, data.spatialContinuous);
                prop.setSpatialAutoBezierAtKey(newIdx, data.spatialAutoBezier);
                prop.setSpatialTangentsAtKey(newIdx, data.inTangent, data.outTangent);
            }
            
            // COLLECT indices first, DON'T select yet (global selection will handle this)
            newSelIndices.push(newIdx);
            // COLLECT times for total span calculation
            newKeyframeTimes.push(data.newTime);
        }
        
        return {
            success: true,
            durationMs: newDuration * 1000,
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
                temporalAutoBezier: prop.keyTemporalAutoBezier(keyIndex)
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
            prop.setInterpolationTypeAtKey(newIdx, data.inInterp, data.outInterp);
            
            // Restore temporal ease if it exists (same as timeline mode)
            if (data.inEase !== undefined && data.outEase !== undefined) {
                try {
                    prop.setTemporalEaseAtKey(newIdx, data.inEase, data.outEase);
                } catch(e) {
                    // Some properties might not support temporal ease
                }
            }
            
            prop.setTemporalContinuousAtKey(newIdx, data.temporalContinuous);
            prop.setTemporalAutoBezierAtKey(newIdx, data.temporalAutoBezier);
            
            if (data.spatialContinuous !== undefined) {
                prop.setSpatialContinuousAtKey(newIdx, data.spatialContinuous);
                prop.setSpatialAutoBezierAtKey(newIdx, data.spatialAutoBezier);
                prop.setSpatialTangentsAtKey(newIdx, data.inTangent, data.outTangent);
            }
            
            newSelIndices.push(newIdx);
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
                    prop.setInterpolationTypeAtKey(newIdx, keyData.inInterp, keyData.outInterp);
                    
                    // Restore temporal ease if it exists (same as timeline mode)
                    if (keyData.inEase !== undefined && keyData.outEase !== undefined) {
                        try {
                            prop.setTemporalEaseAtKey(newIdx, keyData.inEase, keyData.outEase);
                        } catch(e) {
                            // Some properties might not support temporal ease
                        }
                    }
                    
                    prop.setTemporalContinuousAtKey(newIdx, keyData.temporalContinuous);
                    prop.setTemporalAutoBezierAtKey(newIdx, keyData.temporalAutoBezier);
                    
                    if (keyData.spatialContinuous !== undefined) {
                        prop.setSpatialContinuousAtKey(newIdx, keyData.spatialContinuous);
                        prop.setSpatialAutoBezierAtKey(newIdx, keyData.spatialAutoBezier);
                        prop.setSpatialTangentsAtKey(newIdx, keyData.inTangent, keyData.outTangent);
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
        
        // Global selection restoration phase (same as delay nudging)
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
            DEBUG_JSX.log("Selection restoration error: " + selectionError.toString());
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
                    
                    // Check if this is time remapping and deselect instead of processing
                    var isTimeRemap = false;
                    try {
                        isTimeRemap = (prop.name === "Time Remap" || prop.matchName === "ADBE Time Remapping");
                    } catch(e) {
                        // Property name/matchName might not be accessible
                    }
                    
                    if (isTimeRemap) {
                        // Deselect all time remap keyframes and skip processing
                        DEBUG_JSX.log("TR_SKIP");
                        for (var k = 0; k < selKeys.length; k++) {
                            try {
                                prop.setSelectedAtKey(selKeys[k], false);
                            } catch(deselectError) {
                                // Silently skip
                            }
                        }
                        continue; // Skip this property entirely
                    }
                    
                    // Store property with its selected keyframes (make property name unique per layer)
                    var propName = layer.name + ":" + prop.name;
                    if (!propertyMap[propName]) {
                        propertyMap[propName] = {
                            property: prop,
                            layer: layer,
                            keyframes: [],
                            selectedKeys: []
                        };
                    }
                    
                    // Add all selected keyframes for this property
                    for (var k = 0; k < selKeys.length; k++) {
                        var keyIndex = selKeys[k];
                        try {
                            // Validate keyIndex is within bounds
                            if (keyIndex > 0 && keyIndex <= prop.numKeys) {
                                var keyTime = prop.keyTime(keyIndex);
                                propertyMap[propName].keyframes.push({
                                    index: keyIndex,
                                    time: keyTime
                                });
                                propertyMap[propName].selectedKeys.push(keyIndex);
                            }
                        } catch(keyError) {
                            // Skip invalid keyframes silently
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
                                temporalAutoBezier: prop.keyTemporalAutoBezier(keyIndex)
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
                            prop.setInterpolationTypeAtKey(newIdx, data.inInterp, data.outInterp);
                            
                            // CRITICAL FIX: Restore temporal ease if it exists (same as timeline mode)
                            if (data.inEase !== undefined && data.outEase !== undefined) {
                                try {
                                    prop.setTemporalEaseAtKey(newIdx, data.inEase, data.outEase);
                                } catch(e) {
                                    // Some properties might not support temporal ease
                                }
                            }
                            
                            prop.setTemporalContinuousAtKey(newIdx, data.temporalContinuous);
                            prop.setTemporalAutoBezierAtKey(newIdx, data.temporalAutoBezier);
                            
                            // Apply spatial properties if they exist (Position, etc.)
                            if (data.spatialContinuous !== undefined) {
                                prop.setSpatialContinuousAtKey(newIdx, data.spatialContinuous);
                                prop.setSpatialAutoBezierAtKey(newIdx, data.spatialAutoBezier);
                                prop.setSpatialTangentsAtKey(newIdx, data.inTangent, data.outTangent);
                            }
                            
                            newSelIndices.push(newIdx);
                            debugInfo.push("FORCED: Added keyframe at " + (data.newTime * 1000) + "ms, got index " + newIdx);
                        }
                        
                        // Store for later selection
                        timelinePropertyData.push({
                            property: prop,
                            newSelIndices: newSelIndices,
                            propName: propData.property
                        });
                    }
                    
                    // Select all new keyframes at the end (same as baseline mode)
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
                            var selectedLayers = comp.selectedLayers;
                            for (var layerIdx = 0; layerIdx < selectedLayers.length; layerIdx++) {
                                var layer = selectedLayers[layerIdx];
                                
                                if (layer.marker && layer.marker.numKeys > 0) {
                                    DEBUG_JSX.log("Checking layer '" + layer.name + "' with " + layer.marker.numKeys + " markers");
                                    
                                    for (var m = 1; m <= layer.marker.numKeys; m++) {
                                        try {
                                            var markerTime = layer.marker.keyTime(m);
                                            
                                            DEBUG_JSX.log("Checking layer marker " + m + " at time " + markerTime + "s vs original " + originalEarliestTime + "s");
                                            
                                            // Check if marker is at same time as original first keyframes (with small tolerance)
                                            if (Math.abs(markerTime - originalEarliestTime) < (0.5 / frameRate)) {
                                                var markerValue = layer.marker.keyValue(m);
                                                var markerComment = markerValue.comment || "";
                                                
                                                DEBUG_JSX.log("Found layer marker '" + markerComment + "' at original timeline position " + markerTime + "s on layer " + layer.name);
                                                debugInfo.push("MARKER SYNC: Found layer marker '" + markerComment + "' at " + markerTime + "s");
                                                
                                                var newMarkerTime = Math.max(0, newTimelineTime);
                                                
                                                markersToMove.push({
                                                    markerIndex: m,
                                                    oldTime: markerTime,
                                                    newTime: newMarkerTime,
                                                    markerValue: markerValue,
                                                    comment: markerComment,
                                                    layer: layer // Include layer reference for layer markers
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
                        
                        // Check for layer markers on selected layers
                        for (var layerIdx = 0; layerIdx < selectedLayers.length; layerIdx++) {
                            var layer = selectedLayers[layerIdx];
                            
                            if (layer.marker && layer.marker.numKeys > 0) {
                                DEBUG_JSX.log("Checking layer '" + layer.name + "' with " + layer.marker.numKeys + " markers");
                                
                                for (var m = 1; m <= layer.marker.numKeys; m++) {
                                    try {
                                        var markerTime = layer.marker.keyTime(m);
                                        
                                        // Check if marker is at same time as original first keyframes
                                        if (Math.abs(markerTime - originalEarliestTime) < (0.5 / frameRate)) {
                                            var markerValue = layer.marker.keyValue(m);
                                            var markerComment = markerValue.comment || "";
                                            
                                            DEBUG_JSX.log("Found layer marker '" + markerComment + "' to sync from " + markerTime + "s to " + newTimelineTime + "s");
                                            
                                            markersToMove.push({
                                                markerIndex: m,
                                                oldTime: markerTime,
                                                newTime: Math.max(0, newTimelineTime),
                                                markerValue: markerValue,
                                                comment: markerComment,
                                                layer: layer
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
                    try {
                        DEBUG_JSX.log("Restoring keyframe selection for " + keyframeSelectionInfo.length + " properties");
                        
                        for (var i = 0; i < keyframeSelectionInfo.length; i++) {
                            var selInfo = keyframeSelectionInfo[i];
                            var prop = selInfo.property;
                            
                            // First deselect all keyframes
                            for (var j = 1; j <= prop.numKeys; j++) {
                                prop.setSelectedAtKey(j, false);
                            }
                            
                            // Then select our keyframes
                            for (var k = 0; k < selInfo.newSelIndices.length; k++) {
                                var idx = selInfo.newSelIndices[k];
                                prop.setSelectedAtKey(idx, true);
                                DEBUG_JSX.log("Reselected keyframe at index " + idx);
                            }
                        }
                        
                        debugInfo.push("Keyframe selection restored");
                        
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
                    
                    return "success|" + displayDelayMs + "|" + displayDelayFrames + "|TIMELINE-FORCED";
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
                            return "success|0|0|TIMELINE"; 
                        }
                        newTimelineTime = 0;
                    }
                    
                    // Move all keyframes using recreate approach
                    var timelinePropertyData = [];
                    for (var propName in propertyMap) {
                        var propData = propertyMap[propName];
                        var prop = propData.property;
                        var keyframesToMove = [];
                        
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
                                temporalAutoBezier: prop.keyTemporalAutoBezier(keyIndex)
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
                            prop.setInterpolationTypeAtKey(newIdx, data.inInterp, data.outInterp);
                            
                            // CRITICAL FIX: Restore temporal ease for perfect easing preservation
                            if (data.inEase !== undefined && data.outEase !== undefined && data.inInterp === KeyframeInterpolationType.BEZIER && data.outInterp === KeyframeInterpolationType.BEZIER) {
                                prop.setTemporalEaseAtKey(newIdx, data.inEase, data.outEase);
                            }
                            
                            // CRITICAL FIX: Restore temporal properties
                            prop.setTemporalContinuousAtKey(newIdx, data.temporalContinuous);
                            prop.setTemporalAutoBezierAtKey(newIdx, data.temporalAutoBezier);
                            
                            // CRITICAL FIX: Restore spatial properties if they exist (Position, etc.)
                            if (data.spatialContinuous !== undefined) {
                                prop.setSpatialContinuousAtKey(newIdx, data.spatialContinuous);
                                prop.setSpatialAutoBezierAtKey(newIdx, data.spatialAutoBezier);
                                prop.setSpatialTangentsAtKey(newIdx, data.inTangent, data.outTangent);
                            }
                            
                            newSelIndices.push(newIdx);
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
                    return "success|" + newTimelinePositionMs + "|" + newTimelinePositionFrames + "|TIMELINE";
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
                    prop.setInterpolationTypeAtKey(newIdx, keyData.inInterp, keyData.outInterp);
                    
                    // Restore temporal ease if it exists (same as timeline mode)
                    if (keyData.inEase !== undefined && keyData.outEase !== undefined) {
                        try {
                            prop.setTemporalEaseAtKey(newIdx, keyData.inEase, keyData.outEase);
                        } catch(e) {
                            // Some properties might not support temporal ease
                        }
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
            
            // COMPOSITION MARKER SYNCING: Move markers that are at the same frame as first keyframes of properties
            try {
                DEBUG_JSX.log("Starting composition marker sync check");
                var comp = app.project.activeItem;
                var markersToMove = [];
                
                // For each property that had keyframes moved, check if there are markers at the same time as the first keyframe
                for (var i = 0; i < propertyDelays.length; i++) {
                    var propData = propertyDelays[i];
                    
                    // Find the first keyframe time for this property (before movement)
                    if (propData.keyframes && propData.keyframes.length > 0) {
                        var firstKeyframeTime = propData.keyframes[0].time; // Original time before movement
                        var firstKeyframeFrameNumber = Math.round(firstKeyframeTime * frameRate) + 1; // Convert to 1-based frame number
                        
                        
                        // Check all composition markers for ones at this exact frame
                        for (var m = 1; m <= comp.markerProperty.numKeys; m++) {
                            var markerTime = comp.markerProperty.keyTime(m);
                            var markerFrameNumber = Math.round(markerTime * frameRate) + 1;
                            
                            // Check if marker is at same frame as first keyframe (with small tolerance for floating point)
                            if (Math.abs(markerTime - firstKeyframeTime) < (0.5 / frameRate)) {
                                var markerValue = comp.markerProperty.keyValue(m);
                                var markerComment = markerValue.comment || ""; // Get marker comment/label
                                
                                // Calculate new marker time based on the same offset as the keyframe
                                var currentTime = propData.currentDelay;
                                var newKeyframeTime;
                                
                                if (useIndividualDelays) {
                                    var targetDelaySeconds = propData.targetDelay / 1000;
                                    newKeyframeTime = originalEarliestTime + targetDelaySeconds;
                                } else {
                                    if (propData.isOriginalBaseline) {
                                        newKeyframeTime = originalEarliestTime; // Baseline stays at original time
                                    } else {
                                        var targetDelaySeconds = targetDelayMs / 1000;
                                        newKeyframeTime = originalEarliestTime + targetDelaySeconds;
                                    }
                                }
                                
                                // Calculate the time offset applied to the keyframe
                                var keyframeOffset = newKeyframeTime - currentTime;
                                var newMarkerTime = markerTime + keyframeOffset;
                                
                                // Ensure marker doesn't go to negative time
                                newMarkerTime = Math.max(0, newMarkerTime);
                                
                                // Store marker info for movement (avoid duplicate moves)
                                var alreadyQueued = false;
                                for (var q = 0; q < markersToMove.length; q++) {
                                    if (markersToMove[q].type === "comp" && markersToMove[q].markerIndex === m) {
                                        alreadyQueued = true;
                                        break;
                                    }
                                }
                                
                                if (!alreadyQueued) {
                                    markersToMove.push({
                                        type: "comp",
                                        markerIndex: m,
                                        oldTime: markerTime,
                                        newTime: newMarkerTime,
                                        markerValue: markerValue,
                                        property: propData.property,
                                        comment: markerComment
                                    });
                                }
                            }
                        }
                        
                        // Also check layer markers on the same layer as this property
                        // Extract layer from property name (format is "LayerName:PropertyName")
                        var layerName = propData.property.split(":")[0];
                        var targetLayer = null;
                        for (var layerIdx = 0; layerIdx < selectedLayers.length; layerIdx++) {
                            if (selectedLayers[layerIdx].name === layerName) {
                                targetLayer = selectedLayers[layerIdx];
                                break;
                            }
                        }
                        
                        if (targetLayer && targetLayer.marker && targetLayer.marker.numKeys > 0) {
                            DEBUG_JSX.log("Checking layer markers on " + layerName + " for property " + propData.property);
                            
                            for (var m = 1; m <= targetLayer.marker.numKeys; m++) {
                                var markerTime = targetLayer.marker.keyTime(m);
                                var markerFrameNumber = Math.round(markerTime * frameRate) + 1;
                                
                                // Check if marker is at same frame as first keyframe (with small tolerance for floating point)
                                if (Math.abs(markerTime - firstKeyframeTime) < (0.5 / frameRate)) {
                                    var markerValue = targetLayer.marker.keyValue(m);
                                    var markerComment = markerValue.comment || ""; // Get marker comment/label
                                    
                                    DEBUG_JSX.log("Found layer marker at frame " + markerFrameNumber + " (time " + markerTime + "s) with comment: '" + markerComment + "' on layer " + layerName);
                                    
                                    // Calculate new marker time based on the same offset as the keyframe
                                    var currentTime = propData.currentDelay;
                                    var newKeyframeTime;
                                    
                                    if (useIndividualDelays) {
                                        var targetDelaySeconds = propData.targetDelay / 1000;
                                        newKeyframeTime = originalEarliestTime + targetDelaySeconds;
                                    } else {
                                        if (propData.isOriginalBaseline) {
                                            newKeyframeTime = originalEarliestTime; // Baseline stays at original time
                                        } else {
                                            var targetDelaySeconds = targetDelayMs / 1000;
                                            newKeyframeTime = originalEarliestTime + targetDelaySeconds;
                                        }
                                    }
                                    
                                    // Calculate the time offset applied to the keyframe
                                    var keyframeOffset = newKeyframeTime - currentTime;
                                    var newMarkerTime = markerTime + keyframeOffset;
                                    
                                    // Ensure marker doesn't go to negative time
                                    newMarkerTime = Math.max(0, newMarkerTime);
                                    
                                    DEBUG_JSX.log("Layer marker will move from " + markerTime + "s to " + newMarkerTime + "s (offset: " + keyframeOffset + "s)");
                                    
                                    // Store marker info for movement (avoid duplicate moves)
                                    var alreadyQueued = false;
                                    for (var q = 0; q < markersToMove.length; q++) {
                                        if (markersToMove[q].type === "layer" && 
                                            markersToMove[q].layer === targetLayer && 
                                            markersToMove[q].markerIndex === m) {
                                            alreadyQueued = true;
                                            break;
                                        }
                                    }
                                    
                                    if (!alreadyQueued) {
                                        markersToMove.push({
                                            type: "layer",
                                            layer: targetLayer,
                                            markerIndex: m,
                                            oldTime: markerTime,
                                            newTime: newMarkerTime,
                                            markerValue: markerValue,
                                            property: propData.property,
                                            comment: markerComment
                                        });
                                    }
                                }
                            }
                        }
                    }
                }
                
                // Move the markers that were found to be synchronized with first keyframes
                if (markersToMove.length > 0) {
                    DEBUG_JSX.log("Moving " + markersToMove.length + " synchronized markers:");
                    
                    // Sort markers by index in reverse order to avoid index shifts when removing
                    markersToMove.sort(function(a, b) { return b.markerIndex - a.markerIndex; });
                    
                    for (var m = 0; m < markersToMove.length; m++) {
                        var markerInfo = markersToMove[m];
                        
                        try {
                            if (markerInfo.type === "comp") {
                                // Remove the old composition marker
                                comp.markerProperty.removeKey(markerInfo.markerIndex);
                                
                                // Add new marker at the new time with same properties
                                var newMarkerIndex = comp.markerProperty.addKey(markerInfo.newTime);
                                comp.markerProperty.setValueAtKey(newMarkerIndex, markerInfo.markerValue);
                                
                                DEBUG_JSX.log("Moved comp marker '" + markerInfo.comment + "' from " + Math.round(markerInfo.oldTime * 1000) + "ms to " + Math.round(markerInfo.newTime * 1000) + "ms (synced with " + markerInfo.property + ")");
                                debugInfo.push("Synced comp marker '" + markerInfo.comment + "' with " + markerInfo.property);
                            } else if (markerInfo.type === "layer") {
                                // Remove the old layer marker
                                markerInfo.layer.marker.removeKey(markerInfo.markerIndex);
                                
                                // Add new marker at the new time with same properties
                                var newMarkerIndex = markerInfo.layer.marker.addKey(markerInfo.newTime);
                                markerInfo.layer.marker.setValueAtKey(newMarkerIndex, markerInfo.markerValue);
                                
                            }
                            
                        } catch(markerMoveError) {
                            DEBUG_JSX.log("MK_ERR:" + markerMoveError.toString());
                        }
                    }
                } else {
                }
                
            } catch(markerSyncError) {
                // Don't fail the entire operation if marker syncing fails
                DEBUG_JSX.log("MK_SYNC_ERR:" + markerSyncError.toString());
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
        
        return result + "|BASELINE";
        
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

// Helper function to move layer markers after specific time
function moveLabelsAfterTime(comp, cutoffTime, timeOffset) {
    var movedCount = 0;
    try {
        // Process all layers in the composition
        for (var i = 1; i <= comp.numLayers; i++) {
            try {
                var layer = comp.layer(i);
                
                // Determine if this layer was moved entirely using same logic as main function
                var layerWasMovedEntirely = (layer.startTime >= cutoffTime);
                
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
function nudgeFromPlayhead(direction, frames) {
    try {
        DEBUG_JSX.clear(); // Clear previous debug messages
        GLOBAL_OPERATION_ID++; // Increment operation ID for this run
        DEBUG_JSX.log("GD#" + GLOBAL_OPERATION_ID + ": " + (direction > 0 ? "+" : "-") + frames + "f");
        
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
            // Only move keyframes if the layer itself starts before playhead
            // (If layer starts at/after playhead, it was moved entirely and keyframes move with it)
            if (layerStartTime < playheadTime) {
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
            if (layer.source && layer.source instanceof CompItem) {
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
        
        // Adjust composition duration bidirectionally
        if (timeOffset > 0) {
            // Extending forward: only extend if elements were pushed beyond original duration
            if (furthestTime > originalDuration) {
                var extensionNeeded = timeOffset;
                var newDuration = originalDuration + extensionNeeded;
                comp.duration = newDuration;
                DEBUG_JSX.log("Dur: " + originalDuration.toFixed(2) + "s→" + newDuration.toFixed(2) + "s");
            }
        } else if (timeOffset < 0) {
            // Shrinking backward: reduce duration by the amount we moved back
            var shrinkAmount = Math.abs(timeOffset);
            var newDuration = Math.max(0.1, originalDuration - shrinkAmount); // Don't go below 0.1s
            comp.duration = newDuration;
            DEBUG_JSX.log("Dur: " + originalDuration.toFixed(2) + "s→" + newDuration.toFixed(2) + "s");
        }
        
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
                
                // Skip time remap keyframes
                if (prop && prop.name === "Time Remap") {
                    continue;
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
                    
                    // Move keyframes that are at or after cutoff time
                    var keyframesToMove = [];
                    for (var j = 1; j <= prop.numKeys; j++) {
                        var keyTime = prop.keyTime(j);
                        if (keyTime >= cutoffTime) {
                            // Create unique key ID for tracking (include effect index to avoid identical effect conflicts)
                            var uniquePropertyId = prop.matchName || prop.name;
                            if (parentEffect) {
                                // Use effect name directly to distinguish between different effect instances
                                // This is more reliable than trying to find effect indices
                                uniquePropertyId = parentEffect.matchName + "_" + parentEffect.name + "_" + uniquePropertyId;
                            }
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
                                temporalAutoBezier: prop.keyTemporalAutoBezier(keyInfo.index)
                            };
                            
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
                                prop.setInterpolationTypeAtKey(newIndex, data.inInterp, data.outInterp);
                                
                                // Restore temporal attributes
                                prop.setTemporalContinuousAtKey(newIndex, data.temporalContinuous);
                                prop.setTemporalAutoBezierAtKey(newIndex, data.temporalAutoBezier);
                                
                                // Restore temporal ease if it exists
                                if (data.inEase !== undefined && data.outEase !== undefined) {
                                    try {
                                        prop.setTemporalEaseAtKey(newIndex, data.inEase, data.outEase);
                                    } catch(e) {
                                        // Some properties might not support temporal ease
                                    }
                                }
                                
                                // Restore spatial attributes if applicable
                                if (data.spatialContinuous !== undefined) {
                                    try {
                                        prop.setSpatialContinuousAtKey(newIndex, data.spatialContinuous);
                                        prop.setSpatialAutoBezierAtKey(newIndex, data.spatialAutoBezier);
                                        prop.setSpatialTangentsAtKey(newIndex, data.inTangent, data.outTangent);
                                    } catch(e) {
                                        // Spatial properties might not be available
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
            processPropertyGroup(layer.transform);
        }
        
        // 2. Effects
        if (layer.effect && layer.effect.numProperties > 0) {
            processPropertyGroup(layer.effect);
        }
        
        // 2.5. Shape layer Contents (CRITICAL for shape layers!)
        try {
            if (layer.content && layer.content.numProperties > 0) {
                processPropertyGroup(layer.content);
            }
        } catch(e) {
            // Not a shape layer or contents not accessible
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
        
        // Adjust precomp duration bidirectionally  
        var originalPrecompDuration = precomp.duration;
        if (timeOffset > 0) {
            // Extending forward: only extend if elements were pushed beyond original duration
            if (furthestTime > originalPrecompDuration) {
                var extensionNeeded = timeOffset;
                var newDuration = originalPrecompDuration + extensionNeeded;
                precomp.duration = newDuration;
            }
        } else if (timeOffset < 0) {
            // Shrinking backward: reduce duration by the amount we moved back
            var shrinkAmount = Math.abs(timeOffset);
            var newDuration = Math.max(0.1, originalPrecompDuration - shrinkAmount); // Don't go below 0.1s
            precomp.duration = newDuration;
        }
        
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
            return nudgeFromPlayhead(direction, frames);
        }
        
        var frameRate = comp.frameRate || 30;
        var framesToMs = (frames / frameRate) * 1000;
        
        DEBUG_JSX.log("Converting " + frames + " frames to " + framesToMs + "ms at " + frameRate + "fps");
        
        // Use the existing nudgeDelay function but modify the snapping logic
        return nudgeDelayWithCustomIncrement(direction, framesToMs);
        
    } catch(e) {
        return "error|Failed to nudge delay with frames: " + e.toString();
    }
}

// Timeline mode - moves ALL selected keyframes by the same amount (no baseline logic)
// Uses the complete 4-step selection preservation pattern from KEYFRAME_SYSTEM_SUMMARY.md
// Global variable to track cumulative timeline mode offset
var TIMELINE_MODE_CUMULATIVE = 0;
var TIMELINE_MODE_CUMULATIVE_OFFSET = 0;
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
        
        // Update cumulative offset
        TIMELINE_MODE_CUMULATIVE_OFFSET += timeOffset;
        
        var selectedLayers = comp.selectedLayers;
        if (selectedLayers.length === 0) {
            // GLOBAL DELAY: When nothing is selected, nudge everything after playhead
            app.endUndoGroup();
            DEBUG_JSX.log("GLOBAL DELAY: No selection, nudging from playhead with " + frames + " frames");
            return nudgeFromPlayhead(direction, frames);
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
                    cachedSelections.push({
                        layer: layer,
                        layerName: layer.name,
                        property: prop,
                        propertyName: prop.name,
                        selectedIndices: selKeys.slice() // Make a copy!
                    });
                    DEBUG_JSX.log("  Cached " + prop.name + " with " + selKeys.length + " selected keyframes");
                }
            }
            
            // Also explicitly check for Time Remap (in case it's not in selectedProperties)
            DEBUG_JSX.log("Checking for Time Remap on layer " + layer.name);
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
                        
                        // Check if we already cached it
                        var alreadyCached = false;
                        for (var c = 0; c < cachedSelections.length; c++) {
                            if (cachedSelections[c].property === layer.timeRemap) {
                                alreadyCached = true;
                                break;
                            }
                        }
                        
                        if (!alreadyCached) {
                            cachedSelections.push({
                                layer: layer,
                                layerName: layer.name,
                                property: layer.timeRemap,
                                propertyName: "Time Remap",
                                selectedIndices: timeRemapSelKeys.slice()
                            });
                            DEBUG_JSX.log("Cached Time Remap with " + timeRemapSelKeys.length + " selected keyframes");
                            
                            // IMPORTANT: Even a single Time Remap keyframe should be treated as a keyframe operation
                            // not a layer operation, so we mark hasSelectedKeyframes = true
                            hasSelectedKeyframes = true;
                        }
                    }
                }
            } catch(e) {
                DEBUG_JSX.log("Time Remap check error: " + e.toString());
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
        
        // Collect first keyframe times for each property (for marker syncing)
        var propertyFirstKeyframeTimes = [];
        for (var i = 0; i < cachedSelections.length; i++) {
            var cached = cachedSelections[i];
            var prop = cached.property;
            var selKeys = cached.selectedIndices;
            
            // Find the first selected keyframe time for this property
            var firstKeyTime = Infinity;
            for (var k = 0; k < selKeys.length; k++) {
                var keyTime = prop.keyTime(selKeys[k]);
                if (keyTime < firstKeyTime) {
                    firstKeyTime = keyTime;
                }
            }
            
            if (firstKeyTime !== Infinity) {
                propertyFirstKeyframeTimes.push({
                    layer: cached.layer,
                    property: cached.propertyName,
                    firstTime: firstKeyTime
                });
                DEBUG_JSX.log("Property " + cached.propertyName + " on layer " + cached.layerName + " has first keyframe at " + firstKeyTime + "s");
            }
        }
        
        // Collect markers that need to move with the keyframes
        var markersToMove = [];
        
        // Check each property's first keyframe time against all markers
        for (var p = 0; p < propertyFirstKeyframeTimes.length; p++) {
            var propTiming = propertyFirstKeyframeTimes[p];
            var firstKeyframeTime = propTiming.firstTime;
            
            // Check composition markers
            if (comp.markerProperty && comp.markerProperty.numKeys > 0) {
                for (var m = 1; m <= comp.markerProperty.numKeys; m++) {
                    var markerTime = comp.markerProperty.keyTime(m);
                    
                    // Check if marker is at same time as this property's first keyframe (with small tolerance)
                    if (Math.abs(markerTime - firstKeyframeTime) < (0.5 / frameRate)) {
                        var markerValue = comp.markerProperty.keyValue(m);
                        var markerComment = markerValue.comment || "";
                        
                        // Check if we already have this marker queued
                        var alreadyQueued = false;
                        for (var q = 0; q < markersToMove.length; q++) {
                            if (markersToMove[q].type === "comp" && markersToMove[q].markerIndex === m) {
                                alreadyQueued = true;
                                break;
                            }
                        }
                        
                        if (!alreadyQueued) {
                            DEBUG_JSX.log("Found comp marker '" + markerComment + "' at property first keyframe time " + markerTime + "s (matched with " + propTiming.property + ")");
                            
                            markersToMove.push({
                                type: "comp",
                                markerIndex: m,
                                oldTime: markerTime,
                                newTime: markerTime + timeOffset,
                                markerValue: markerValue,
                                comment: markerComment
                            });
                        }
                    }
                }
            }
            
            // Check layer markers on the same layer as the property
            var layer = propTiming.layer;
            if (layer.marker && layer.marker.numKeys > 0) {
                for (var m = 1; m <= layer.marker.numKeys; m++) {
                    var markerTime = layer.marker.keyTime(m);
                    
                    // Check if marker is at same time as this property's first keyframe
                    if (Math.abs(markerTime - firstKeyframeTime) < (0.5 / frameRate)) {
                        var markerValue = layer.marker.keyValue(m);
                        var markerComment = markerValue.comment || "";
                        
                        // Check if we already have this marker queued
                        var alreadyQueued = false;
                        for (var q = 0; q < markersToMove.length; q++) {
                            if (markersToMove[q].type === "layer" && 
                                markersToMove[q].layer === layer && 
                                markersToMove[q].markerIndex === m) {
                                alreadyQueued = true;
                                break;
                            }
                        }
                        
                        if (!alreadyQueued) {
                            DEBUG_JSX.log("Found layer marker '" + markerComment + "' on layer " + layer.name + " at property first keyframe time");
                            
                            markersToMove.push({
                                type: "layer",
                                layer: layer,
                                markerIndex: m,
                                oldTime: markerTime,
                                newTime: markerTime + timeOffset,
                                markerValue: markerValue,
                                comment: markerComment
                            });
                        }
                    }
                }
            }
        }
        
        // STEP 2: PROCESS USING CACHED SELECTIONS
        for (var i = 0; i < cachedSelections.length; i++) {
            var cached = cachedSelections[i];
            var prop = cached.property;
            var selKeys = cached.selectedIndices; // Use cached, not prop.selectedKeys!
            
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
                        temporalAutoBezier: prop.keyTemporalAutoBezier(keyIndex)
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
            
            // Special handling for Time Remap - add new keys BEFORE removing old ones
            var newIndices = [];
            var isTimeRemap = false;
            try {
                isTimeRemap = (prop.name === "Time Remap" || prop.matchName === "ADBE Time Remapping");
            } catch(e) {
                // Continue with normal handling if we can't check
            }
            
            if (isTimeRemap) {
                DEBUG_JSX.log("Special Time Remap handling - add before delete");
                
                // FIRST: Add all new keyframes at new times
                for (var k = 0; k < keyframesToMove.length; k++) {
                    var data = keyframesToMove[k];
                    var newIdx = prop.addKey(data.newTime);
                    
                    // Store the new index for later value setting
                    data.newIndex = newIdx;
                    newIndices.push(newIdx);
                }
                
                // SECOND: Set values and properties on new keyframes
                for (var k = 0; k < keyframesToMove.length; k++) {
                    var data = keyframesToMove[k];
                    
                    // Set all properties on the new keyframe
                    prop.setValueAtKey(data.newIndex, data.value);
                    prop.setInterpolationTypeAtKey(data.newIndex, data.inInterp, data.outInterp);
                    
                    if (data.inEase !== undefined && data.outEase !== undefined) {
                        try {
                            prop.setTemporalEaseAtKey(data.newIndex, data.inEase, data.outEase);
                        } catch(e) {
                            // Some Time Remap keyframes might not support temporal ease
                        }
                    }
                    
                    prop.setTemporalContinuousAtKey(data.newIndex, data.temporalContinuous);
                    prop.setTemporalAutoBezierAtKey(data.newIndex, data.temporalAutoBezier);
                }
                
                // THIRD: Now remove the old keyframes (in reverse order)
                // We need to recalculate indices since we added new keys
                var indicesToRemove = [];
                for (var k = 0; k < keyframesToMove.length; k++) {
                    var oldTime = keyframesToMove[k].oldTime;
                    // Find the keyframe at the old time
                    for (var j = 1; j <= prop.numKeys; j++) {
                        if (Math.abs(prop.keyTime(j) - oldTime) < 0.001) {
                            indicesToRemove.push(j);
                            break;
                        }
                    }
                }
                
                // Remove in reverse order to maintain indices
                indicesToRemove.sort(function(a, b) { return b - a; });
                for (var k = 0; k < indicesToRemove.length; k++) {
                    try {
                        prop.removeKey(indicesToRemove[k]);
                    } catch(e) {
                        DEBUG_JSX.log("Failed to remove old Time Remap key at index " + indicesToRemove[k]);
                    }
                }
                
                movedCount += keyframesToMove.length;
                DEBUG_JSX.log("Moved " + keyframesToMove.length + " Time Remap keyframes");
                
            } else {
                // Normal handling for non-Time Remap properties
                // Remove old keyframes (in reverse order to avoid index issues)
                for (var k = keyframesToMove.length - 1; k >= 0; k--) {
                    prop.removeKey(keyframesToMove[k].index);
                }
                
                // Add new keyframes at new times with all properties preserved
                for (var k = 0; k < keyframesToMove.length; k++) {
                    var data = keyframesToMove[k];
                    var newIdx = prop.addKey(data.newTime);
                
                // Restore all keyframe properties
                prop.setValueAtKey(newIdx, data.value);
                prop.setInterpolationTypeAtKey(newIdx, data.inInterp, data.outInterp);
                
                // Restore temporal ease if it exists
                if (data.inEase !== undefined && data.outEase !== undefined) {
                    try {
                        prop.setTemporalEaseAtKey(newIdx, data.inEase, data.outEase);
                    } catch(e) {
                        // Some properties might not support temporal ease
                    }
                }
                
                prop.setTemporalContinuousAtKey(newIdx, data.temporalContinuous);
                prop.setTemporalAutoBezierAtKey(newIdx, data.temporalAutoBezier);
                
                // Restore spatial properties if they exist
                if (data.spatialContinuous !== undefined) {
                    try {
                        prop.setSpatialContinuousAtKey(newIdx, data.spatialContinuous);
                        prop.setSpatialAutoBezierAtKey(newIdx, data.spatialAutoBezier);
                        prop.setSpatialTangentsAtKey(newIdx, data.inTangent, data.outTangent);
                    } catch(e) {
                        // Some properties might not support spatial settings
                    }
                }
                
                    newIndices.push(newIdx);
                    movedCount++;
                    DEBUG_JSX.log("Moved keyframe from " + data.oldTime + "s to " + data.newTime + "s");
                }
            }
            
            // Store selections for restoration
            processedSelections.push({
                layer: cached.layer,
                propertyName: cached.propertyName,
                indices: newIndices
            });
        }
        
        // Move markers that were at the same time as the earliest keyframe
        for (var i = markersToMove.length - 1; i >= 0; i--) {
            var markerInfo = markersToMove[i];
            
            try {
                if (markerInfo.type === "comp") {
                    // Move composition marker
                    comp.markerProperty.removeKey(markerInfo.markerIndex);
                    if (markerInfo.newTime >= 0) { // Only add if new time is valid
                        var newMarkerIndex = comp.markerProperty.addKey(markerInfo.newTime);
                        comp.markerProperty.setValueAtKey(newMarkerIndex, markerInfo.markerValue);
                        DEBUG_JSX.log("Moved comp marker '" + markerInfo.comment + "' from " + markerInfo.oldTime + "s to " + markerInfo.newTime + "s");
                    }
                } else if (markerInfo.type === "layer") {
                    // Move layer marker
                    markerInfo.layer.marker.removeKey(markerInfo.markerIndex);
                    if (markerInfo.newTime >= 0) { // Only add if new time is valid
                        var newMarkerIndex = markerInfo.layer.marker.addKey(markerInfo.newTime);
                        markerInfo.layer.marker.setValueAtKey(newMarkerIndex, markerInfo.markerValue);
                        DEBUG_JSX.log("Moved layer marker '" + markerInfo.comment + "' from " + markerInfo.oldTime + "s to " + markerInfo.newTime + "s");
                    }
                }
            } catch(markerError) {
                DEBUG_JSX.log("Failed to move marker: " + markerError.toString());
            }
        }
        
        app.endUndoGroup();
        
        // STEP 3 & 4: RESTORE SELECTION WITH FRESH REFERENCES (only if we had selected keyframes originally)
        if (hasSelectedKeyframes) {
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
            
            // Restore selections on fresh property references
            for (var i = 0; i < processedSelections.length; i++) {
                var selData = processedSelections[i];
                
                // Get fresh property reference
                var freshProp = findPropertyByName(selData.layer, selData.propertyName);
                if (!freshProp) continue;
                
                // CRITICAL: First deselect ALL keyframes on this property
                for (var k = 1; k <= freshProp.numKeys; k++) {
                    try {
                        freshProp.setSelectedAtKey(k, false);
                    } catch(e) {
                        // Ignore deselection errors
                    }
                }
                
                // Now select only the keyframes we moved
                for (var j = 0; j < selData.indices.length; j++) {
                    try {
                        freshProp.setSelectedAtKey(selData.indices[j], true);
                    } catch(e) {
                        // Ignore selection errors
                    }
                }
            }
        }
        // If we moved all keyframes (no selection), don't restore any selection
        
        if (movedCount === 0) {
            return "error|No keyframes were moved";
        }
        
        // Return success with the CUMULATIVE amount moved (with sign preserved)
        var cumulativeMs = Math.round(TIMELINE_MODE_CUMULATIVE_OFFSET * 1000);
        var cumulativeFrames = Math.round(TIMELINE_MODE_CUMULATIVE_OFFSET * frameRate);
        return "success|" + cumulativeMs + "|" + cumulativeFrames + "|Moved " + movedCount + " keyframes";
        
    } catch(e) {
        app.endUndoGroup();
        return "error|Timeline mode failed: " + e.toString();
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
        
        // Call the existing nudgeDelay function which will use our custom snapping
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

// Core position nudging function with direct keyframe movement (5px increments)
function nudgePositionAxis(axis, nudgeDirection, direction) {
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
        
        // Calculate movement amount: 5px base * resolution multiplier
        var baseMovement = 5;
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
function snapKeyframeStaggersToInputValue(layerGroups, staggerFrames, frameRate, direction) {
    try {
        DEBUG_JSX.log("Smart keyframe snapping: checking if staggers need snapping to " + staggerFrames + " frame increments");
        
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
            
            // Find earliest keyframe time in this layer group
            for (var propIdx = 0; propIdx < layerGroup.keyframes.length; propIdx++) {
                var propData = layerGroup.keyframes[propIdx];
                var prop = propData.property;
                var selectedKeys = propData.selectedKeys;
                
                for (var k = 0; k < selectedKeys.length; k++) {
                    var keyTime = prop.keyTime(selectedKeys[k]);
                    if (earliestTime === null || keyTime < earliestTime) {
                        earliestTime = keyTime;
                    }
                }
            }
            
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
        
        // Sort by layer index (should already be sorted, but ensure)
        layerGroupTimes.sort(function(a, b) { return b.layerIndex - a.layerIndex; });
        
        // Calculate actual intervals between layer groups
        var actualIntervals = [];
        for (var i = 1; i < layerGroupTimes.length; i++) {
            var interval = layerGroupTimes[i].time - layerGroupTimes[i-1].time;
            actualIntervals.push(interval);
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
        
        // Determine current pattern direction
        var currentDirection;
        if (hasNegativeIntervals > hasPositiveIntervals) {
            currentDirection = -1; // Clear negative pattern
        } else if (hasPositiveIntervals > hasNegativeIntervals) {
            currentDirection = 1;  // Clear positive pattern
        } else {
            // No clear existing direction (all intervals ~0) - use requested direction
            currentDirection = direction;
        }
        DEBUG_JSX.log("Interval analysis: " + hasPositiveIntervals + " positive, " + hasNegativeIntervals + " negative, detected direction: " + currentDirection + " (requested: " + direction + ")");
        
        // Check if intervals are already uniform (at any consistent value)
        var isCleanPattern = true;
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
                DEBUG_JSX.log("Keyframe pattern is already uniform at " + (referenceInterval * 1000).toFixed(1) + "ms intervals - no snapping needed");
            }
        }
        
        if (isCleanPattern) {
            DEBUG_JSX.log("Keyframe pattern is already clean - no snapping needed");
            return false;
        }
        
        // Pattern is inconsistent - calculate offsets to snap to uniform staggers (same as uniform stagger logic)
        DEBUG_JSX.log("Keyframe pattern is inconsistent - snapping to clean uniform staggers");
        
        var baselineTime = layerGroupTimes[0].time; // Baseline layer group time
        
        // Calculate the offset each layer needs to achieve uniform stagger (same logic as uniform staggers)
        for (var layerIdx = 0; layerIdx < layerGroups.length; layerIdx++) {
            var layerGroup = layerGroups[layerIdx];
            var layerGroupTime = layerGroupTimes[layerIdx];
            var currentLayerTime = layerGroupTime.time;
            
            // Calculate what this layer's time SHOULD be for uniform stagger (with detected current direction)
            var uniformTargetTime = baselineTime + (layerIdx * currentDirection * staggerSeconds);
            
            // Calculate the OFFSET needed to get from current time to uniform target
            var snapOffset = uniformTargetTime - currentLayerTime;
            
            DEBUG_JSX.log("Layer " + layerGroup.layer.index + ": current=" + (currentLayerTime * 1000).toFixed(1) + "ms, target=" + (uniformTargetTime * 1000).toFixed(1) + "ms, offset=" + (snapOffset * 1000).toFixed(1) + "ms");
            
            // Store the offset for this layer group (will be applied to ALL keyframes in the layer)
            layerGroup.snapOffset = snapOffset;
        }
        
        // Apply snapping using keyframe recreation (same pattern as uniform staggers)
        var totalKeyframesToSnap = 0;
        for (var layerIdx = 0; layerIdx < layerGroups.length; layerIdx++) {
            var layerGroup = layerGroups[layerIdx];
            for (var propIdx = 0; propIdx < layerGroup.keyframes.length; propIdx++) {
                totalKeyframesToSnap += layerGroup.keyframes[propIdx].selectedKeys.length;
            }
        }
        
        DEBUG_JSX.log("Snapping " + totalKeyframesToSnap + " keyframes using offset-based approach");
        
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
                        temporalAutoBezier: prop.keyTemporalAutoBezier(keyIndex)
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
                    keyframesToMove: keyframesToMove
                });
            }
        }
        
        DEBUG_JSX.log("Data collection complete: Prepared " + propertyDataForSelection.length + " properties for snapping");
        
        // PHASE 2: Remove all old keyframes (group by property, reverse order - same as delay nudging)
        for (var i = 0; i < propertyDataForSelection.length; i++) {
            var propInfo = propertyDataForSelection[i];
            var prop = propInfo.property;
            var keyframesToMove = propInfo.keyframesToMove;
            
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
            
            for (var k = 0; k < keyframesToMove.length; k++) {
                var data = keyframesToMove[k];
                var newIdx = prop.addKey(data.newTime);
                prop.setValueAtKey(newIdx, data.value);
                prop.setInterpolationTypeAtKey(newIdx, data.inInterp, data.outInterp);
                
                // Restore temporal ease if it exists (same as timeline mode)
                if (data.inEase !== undefined && data.outEase !== undefined) {
                    try {
                        prop.setTemporalEaseAtKey(newIdx, data.inEase, data.outEase);
                    } catch(e) {
                        // Some properties might not support temporal ease
                    }
                }
                
                prop.setTemporalContinuousAtKey(newIdx, data.temporalContinuous);
                prop.setTemporalAutoBezierAtKey(newIdx, data.temporalAutoBezier);
                
                // Apply spatial properties if they exist (Position, etc.) - same as delay nudging
                if (data.spatialContinuous !== undefined) {
                    prop.setSpatialContinuousAtKey(newIdx, data.spatialContinuous);
                    prop.setSpatialAutoBezierAtKey(newIdx, data.spatialAutoBezier);
                    prop.setSpatialTangentsAtKey(newIdx, data.inTangent, data.outTangent);
                }
                
                newSelIndices.push(newIdx);
                DEBUG_JSX.log("Added keyframe at " + (data.newTime * 1000).toFixed(1) + "ms, got index " + newIdx);
            }
            
            // Store new indices for deferred selection (same as delay nudging)
            propInfo.newSelIndices = newSelIndices;
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
        
        // Return both success status and the actual applied stagger interval in milliseconds
        var actualStaggerMs = currentDirection * staggerSeconds * 1000;
        DEBUG_JSX.log("Smart snapping applied uniform stagger of " + actualStaggerMs.toFixed(1) + "ms");
        return {success: true, staggerMs: actualStaggerMs};
        
    } catch(e) {
        DEBUG_JSX.log("Smart keyframe stagger snapping failed: " + e.toString());
        return {success: false, staggerMs: 0};
    }
}

// Helper function to snap inconsistent staggers to clean multiples of the input value (for layers)
function snapStaggersToInputValue(layerArray, staggerFrames, frameRate) {
    try {
        DEBUG_JSX.log("=== SMART SNAPPING ANALYSIS ===");
        DEBUG_JSX.log("Checking if staggers need snapping to " + staggerFrames + " frame increments");
        
        var staggerSeconds = staggerFrames / frameRate; // Convert to seconds
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
        
        // Sort by layer index (bottom to top: highest to lowest)
        layerTimes.sort(function(a, b) { return b.index - a.index; });
        
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
            DEBUG_JSX.log("Single interval: " + (actualIntervals[0] * 1000).toFixed(1) + "ms (uniform by definition)");
        }
        
        if (isCleanPattern) {
            DEBUG_JSX.log("Pattern is already clean - no snapping needed");
            return false;
        }
        
        // Pattern is inconsistent - calculate snap targets that preserve the baseline
        DEBUG_JSX.log("Pattern is inconsistent - snapping to clean multiples");
        
        var baselineTime = layerTimes[0].time;
        var snapTargets = [baselineTime]; // Baseline stays the same
        
        // Calculate clean stagger targets
        for (var i = 1; i < layerTimes.length; i++) {
            var targetTime = baselineTime + (i * staggerSeconds);
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
        var actualStaggerMs = staggerSeconds * 1000; // Layer snapping always uses positive direction
        DEBUG_JSX.log("Smart snapping applied uniform stagger of " + actualStaggerMs.toFixed(1) + "ms");
        return {success: true, staggerMs: actualStaggerMs};
        
    } catch(e) {
        DEBUG_JSX.log("Smart stagger snapping failed: " + e.toString());
        DEBUG_JSX.log("Error details: " + e.message + " at line " + (e.line || "unknown"));
        return {success: false, staggerMs: 0};
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
        
        DEBUG_JSX.log("applyStagger called - direction: " + direction + ", frames: " + staggerFrames + ", topToBottom: " + isTopToBottom);
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

// Apply stagger to selected keyframes (grouped by layer)
function applyStaggerToKeyframes(direction, staggerMs, frameRate, staggerFrames, isTopToBottom) {
    try {
        var comp = app.project.activeItem;
        var selectedLayers = comp.selectedLayers;
        
        if (selectedLayers.length === 0) {
            return "error|No layers selected";
        }
        
        // Collect all selected keyframes grouped by layer
        var layerGroups = [];
        var hasSelectedKeyframes = false;
        
        for (var layerIdx = 0; layerIdx < selectedLayers.length; layerIdx++) {
            var layer = selectedLayers[layerIdx];
            var layerKeyframes = [];
            
            // Recursively search for selected keyframes in this layer
            function collectKeyframes(propGroup, propPath) {
                for (var i = 1; i <= propGroup.numProperties; i++) {
                    var prop = propGroup.property(i);
                    
                    // Check if this property has selected keyframes
                    if (prop && prop.canVaryOverTime && prop.numKeys > 0) {
                        var selectedKeys = [];
                        for (var k = 1; k <= prop.numKeys; k++) {
                            if (prop.keySelected(k)) {
                                selectedKeys.push(k);
                            }
                        }
                        
                        if (selectedKeys.length > 0) {
                            layerKeyframes.push({
                                property: prop,
                                propertyName: propPath + prop.name,
                                selectedKeys: selectedKeys
                            });
                            hasSelectedKeyframes = true;
                        }
                    }
                    
                    // Recursively search property groups
                    if (prop && (prop.propertyType === PropertyType.INDEXED_GROUP || 
                               prop.propertyType === PropertyType.NAMED_GROUP)) {
                        collectKeyframes(prop, propPath + prop.name + " > ");
                    }
                }
            }
            
            // Search transform properties
            collectKeyframes(layer.transform, "Transform > ");
            
            // Search effects
            if (layer.effect && layer.effect.numProperties > 0) {
                collectKeyframes(layer.effect, "Effects > ");
            }
            
            if (layerKeyframes.length > 0) {
                layerGroups.push({
                    layer: layer,
                    layerIndex: layer.index,
                    keyframes: layerKeyframes
                });
            }
        }
        
        if (!hasSelectedKeyframes) {
            return "error|No selected keyframes found";
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
        
        // First: Snap inconsistent staggers to clean multiples of input value
        var snapResult = snapKeyframeStaggersToInputValue(layerGroups, staggerFrames, frameRate, direction);
        if (snapResult.success) {
            DEBUG_JSX.log("Snapped keyframes to clean " + staggerFrames + " frame increments");
            
            // Smart snapping already created the correct uniform pattern - no additional stagger needed
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
            
            // Collect layer markers that need to be moved with keyframes
            var markersToMove = [];
            if (layer.marker && layer.marker.numKeys > 0) {
                DEBUG_JSX.log("Checking " + layer.marker.numKeys + " markers on layer " + layer.name + " for sync");
                
                // Collect all original keyframe times from this layer
                var originalKeyframeTimes = [];
                for (var propIdx = 0; propIdx < layerGroup.keyframes.length; propIdx++) {
                    var propData = layerGroup.keyframes[propIdx];
                    var prop = propData.property;
                    var selectedKeys = propData.selectedKeys;
                    
                    for (var k = 0; k < selectedKeys.length; k++) {
                        var keyIndex = selectedKeys[k];
                        var keyTime = prop.keyTime(keyIndex);
                        originalKeyframeTimes.push(keyTime);
                    }
                }
                
                // Check each marker to see if it's at the same time as any keyframe
                for (var m = 1; m <= layer.marker.numKeys; m++) {
                    var markerTime = layer.marker.keyTime(m);
                    
                    // Check if this marker is at the same time as any of the keyframes being moved
                    for (var t = 0; t < originalKeyframeTimes.length; t++) {
                        if (Math.abs(markerTime - originalKeyframeTimes[t]) < (0.5 / frameRate)) {
                            var markerValue = layer.marker.keyValue(m);
                            var markerComment = markerValue.comment || "";
                            var newMarkerTime = Math.max(0, markerTime + staggerOffset);
                            
                            DEBUG_JSX.log("Found synced marker '" + markerComment + "' at " + roundMs(markerTime) + "ms, will move to " + roundMs(newMarkerTime) + "ms");
                            
                            markersToMove.push({
                                markerIndex: m,
                                oldTime: markerTime,
                                newTime: newMarkerTime,
                                markerValue: markerValue,
                                comment: markerComment
                            });
                            break; // Only need to match once per marker
                        }
                    }
                }
            }
            
            // Move all keyframes in this layer by the cumulative offset (no clamping needed since pre-checked)
            var layerHadMovement = false; // Track if any keyframes in this layer actually moved
            for (var propIdx = 0; propIdx < layerGroup.keyframes.length; propIdx++) {
                var propData = layerGroup.keyframes[propIdx];
                var prop = propData.property;
                var selectedKeys = propData.selectedKeys;
                
                // Process all keyframes in this property (none would clamp)
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
                        temporalAutoBezier: prop.keyTemporalAutoBezier(keyIndex)
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
                    prop.setInterpolationTypeAtKey(newIdx, data.inInterp, data.outInterp);
                    
                    // CRITICAL FIX: Restore temporal ease if it exists (same as timeline mode)
                    if (data.inEase !== undefined && data.outEase !== undefined) {
                        try {
                            prop.setTemporalEaseAtKey(newIdx, data.inEase, data.outEase);
                        } catch(e) {
                            // Some properties might not support temporal ease
                        }
                    }
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
                
                // Store the new indices for final selection
                propData.newSelIndices = newSelIndices;
            }
            
            // Move the layer markers that were synced with keyframes
            if (markersToMove.length > 0) {
                DEBUG_JSX.log("Moving " + markersToMove.length + " synced markers on layer " + layer.name);
                
                // Sort markers in reverse order to avoid index shifting
                markersToMove.sort(function(a, b) { return b.markerIndex - a.markerIndex; });
                
                for (var m = 0; m < markersToMove.length; m++) {
                    var markerInfo = markersToMove[m];
                    
                    try {
                        // Remove the old marker
                        layer.marker.removeKey(markerInfo.markerIndex);
                        
                        // Add new marker at the new time with same properties
                        var newMarkerIndex = layer.marker.addKey(markerInfo.newTime);
                        layer.marker.setValueAtKey(newMarkerIndex, markerInfo.markerValue);
                        
                        DEBUG_JSX.log("Moved marker '" + markerInfo.comment + "' from " + roundMs(markerInfo.oldTime) + "ms to " + roundMs(markerInfo.newTime) + "ms");
                        
                    } catch(markerMoveError) {
                        DEBUG_JSX.log("Failed to move marker '" + markerInfo.comment + "': " + markerMoveError.toString());
                    }
                }
            }
            
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
        
        // If no layers had actual movement, show 0ms stagger since nothing actually moved
        var effectiveStagger = layersWithActualMovement > 0 ? (direction * staggerMs) : 0;
        
        return "success|Applied stagger to " + processedLayers + " layers|" + effectiveStagger + "ms per layer";
        
    } catch(e) {
        return "error|Keyframe stagger failed: " + e.toString();
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
        var snapResult = snapStaggersToInputValue(layerArray, staggerFrames, frameRate);
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

// Helper function to move composition to appropriate folder based on device type
function moveCompositionToFolder(comp, deviceType) {
    try {
        // Define folder structure mapping
        var folderMapping = {
            "iphone": "01 - Compositions > Native",
            "desktop": "01 - Compositions > Desktop",
            "iphone15": "01 - Compositions > Native",
            "iphone-simple": "01 - Compositions > Native",
            "web-chrome": "01 - Compositions > Desktop"
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
                            // For iPhone 15, also try partial matches
                            if (deviceType === "iphone15" && 
                                (item.name.indexOf("iPhone 15") !== -1 || 
                                 item.name.indexOf("iPhone15") !== -1 || 
                                 item.name.indexOf("iphone15") !== -1)) {
                                templateComp = item;
                                debugInfo.push("✓ Partial match found: '" + item.name + "'");
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
                                // Try partial match for iPhone 15
                                if (deviceType === "iphone15" && 
                                    (item.name.indexOf("iPhone 15") !== -1 || 
                                     item.name.indexOf("iPhone15") !== -1 || 
                                     item.name.indexOf("iphone15") !== -1)) {
                                    templateComp = item;
                                    debugInfo.push("✓ Partial match found after import: '" + item.name + "'");
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
                                        // Regular scaling for other layers (iPhone UI, Shadow)
                                        scaleFactor = (multiplier / 2) * 100;
                                        debugInfo.push("Regular layer, using standard scale: " + scaleFactor + "%");
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
                            
                            // Step 2: Add iPhone UI - 393 as base layer for iPhone 15 and iPhone Simple
                            if (deviceType === "iphone15" || deviceType === "iphone-simple") {
                                debugInfo.push("=== Adding iPhone UI - 393 Base Layer ===");
                                
                                // Find iPhone UI - 393 comp in the project
                                var iPhoneUIComp = null;
                                for (var k = 1; k <= app.project.items.length; k++) {
                                    var item = app.project.items[k];
                                    if (item instanceof CompItem && item.name === "iPhone UI - 393") {
                                        iPhoneUIComp = item;
                                        debugInfo.push("✓ Found iPhone UI - 393 comp");
                                        break;
                                    }
                                }
                                
                                if (iPhoneUIComp) {
                                    // Add iPhone UI - 393 as precomp layer
                                    var iPhoneUILayer = comp.layers.add(iPhoneUIComp);
                                    iPhoneUILayer.name = "iPhone UI";
                                    
                                    // Apply proper scaling (same as regular iPhone UI)
                                    var scaleFactor = (multiplier / 2) * 100;
                                    iPhoneUILayer.transform.scale.setValue([scaleFactor, scaleFactor]);
                                    debugInfo.push("iPhone UI scaled to " + scaleFactor + "%");
                                    
                                    // Center the layer
                                    iPhoneUILayer.transform.position.setValue([comp.width/2, comp.height/2]);
                                    
                                    // Set start time to playhead position
                                    iPhoneUILayer.startTime = comp.time;
                                    
                                    // Enable collapse transformations for crisp rendering
                                    iPhoneUILayer.collapseTransformation = true;
                                    
                                    // Position iPhone UI layer based on device type
                                    if (deviceType === "iphone-simple") {
                                        // For iPhone Simple: iPhone UI goes to top (above Shadow)
                                        iPhoneUILayer.moveToBeginning();
                                        debugInfo.push("iPhone UI moved to top (above Shadow)");
                                    } else {
                                        // For iPhone 15: iPhone UI goes to bottom (behind Frame)
                                        iPhoneUILayer.moveToEnd();
                                        debugInfo.push("iPhone UI moved to bottom (behind Frame)");
                                    }
                                    
                                    debugInfo.push("✓ iPhone UI - 393 added as base layer");
                                } else {
                                    debugInfo.push("❌ iPhone UI - 393 comp not found");
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
            } else {
                DEBUG_JSX.log("Adding layer '" + layer.name + "' to content layers");
                otherLayers.push(layer);
            }
        }
        
        if (!shapeLayer) {
            DEBUG_JSX.error("No shape layer found in selection");
            alert("No shape layer found. Please select at least one shape layer.");
            var debugMessages = DEBUG_JSX.getMessages();
            return "error|No shape layer|" + debugMessages.join("|");
        }
        
        if (otherLayers.length === 0) {
            DEBUG_JSX.error("No content layers found", "Need at least one content layer plus shape layer");
            alert("Please select at least two layers (one shape layer to define the area, and one or more layers for content).");
            var debugMessages = DEBUG_JSX.getMessages();
            return "error|No content layers|" + debugMessages.join("|");
        }
        
        DEBUG_JSX.log("Final selection - Shape layer: " + shapeLayer.name + ", Content layers: " + otherLayers.length);
    
    app.beginUndoGroup("Apply Fit: " + mode);
    
    try {
        // Make shape layer visible
        shapeLayer.enabled = true;
        
        // Process each other layer (content layers only, not the shape layer)
        for (var layerIndex = 0; layerIndex < otherLayers.length; layerIndex++) {
            var otherLayer = otherLayers[layerIndex];
            
            DEBUG_JSX.log("Processing layer " + layerIndex + ": " + otherLayer.name + " (mode: " + mode + ")");
            
            // Skip individual layer processing for fitNone - we'll handle everything after precomp
            if (mode === "fitNone") {
                DEBUG_JSX.log("Skipping individual processing for fitNone mode");
                continue;
            }
            
            // Skip if this is somehow the shape layer (safety check)
            if (otherLayer === shapeLayer) {
                DEBUG_JSX.log("Skipping shape layer in content processing: " + otherLayer.name);
                continue;
            }
            
            DEBUG_JSX.log("Applying FitToShape to content layer: " + otherLayer.name);
            
            // Parent the other layer to the shape layer
            otherLayer.parent = shapeLayer;
            
            // Set up track matte - works regardless of layer positions
            otherLayer.setTrackMatte(shapeLayer, TrackMatteType.ALPHA);
            
            // Make layer visible
            otherLayer.enabled = true;
            
            // Keep shape layer visible (track matte automatically hides it)
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
                var layerRect = otherLayer.sourceRectAtTime(comp.time, false);
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
                    "var shapeBounds = shapeLayer.sourceRectAtTime();",
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
                    "var shapeBounds = shapeLayer.sourceRectAtTime();",
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
                    "var shapeBounds = shapeLayer.sourceRectAtTime();",
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
            // Get shape info
            var shapeBounds = shapeLayer.sourceRectAtTime(comp.time, false);
            var shapeWidth = shapeBounds.width;
            var shapeHeight = shapeBounds.height;
            
            // Collect all other layers for precomposing
            var validLayers = otherLayers;
            
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
            
            // Make sure precomp was created and resize its composition
            if (precomp && precomp.source) {
                // Get the precomp composition
                var precompComp = precomp.source;
                
                // Calculate positioning
                var shapePos = shapeLayer.position.value;
                var shapeCenterX = shapePos[0] + shapeBounds.left + shapeBounds.width/2;
                var shapeCenterY = shapePos[1] + shapeBounds.top + shapeBounds.height/2;
                
                // Resize the precomp to match the shape size
                precompComp.width = Math.ceil(shapeWidth);
                precompComp.height = Math.ceil(shapeHeight);
                
                // Calculate the offset needed to center content in the resized precomp
                var offsetX = precompComp.width/2 - shapeCenterX;
                var offsetY = precompComp.height/2 - shapeCenterY;
                
                // Move all layers in the precomp by this offset
                for (var j = 1; j <= precompComp.numLayers; j++) {
                    try {
                        var layer = precompComp.layer(j);
                        if (!layer.locked) {
                            var pos = layer.position.value;
                            layer.position.setValue([pos[0] + offsetX, pos[1] + offsetY]);
                        }
                    } catch (e) {
                        // Skip if error
                    }
                }
                
                // Set precomp anchor to center
                precomp.anchorPoint.setValue([precompComp.width/2, precompComp.height/2]);
                
                // Position the precomp at the shape center
                precomp.position.setValue([shapeCenterX, shapeCenterY]);
                
                // Parent the precomp to the shape layer
                precomp.parent = shapeLayer;
                
                // Convert position to parent space
                var parentSpacePos = [
                    shapeCenterX - shapeLayer.position.value[0],
                    shapeCenterY - shapeLayer.position.value[1]
                ];
                precomp.position.setValue(parentSpacePos);
                
                // Set collapse transformations
                precomp.collapseTransformation = true;
                
                // Set up track matte
                try {
                    precomp.setTrackMatte(shapeLayer, TrackMatteType.ALPHA);
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
                
                // Get precomp actual content size  
                var precompBounds = precomp.sourceRectAtTime(comp.time, false);
                var precompWidth = precompBounds.width;
                var precompHeight = precompBounds.height;
                
                // Calculate padding
                var padding = (shapeWidth - precompWidth) / 2;
                
                // Scale expression that respects Scale To dropdown
                var scaleExpr = [
                    "var shapeLayer = parent;",
                    "var shapeBounds = shapeLayer.sourceRectAtTime();",
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
                    "var shapeBounds = shapeLayer.sourceRectAtTime();",
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
                    "var shapeBounds = shapeLayer.sourceRectAtTime();",
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