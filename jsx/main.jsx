// Global variable to store extension path (set by the panel)
var extensionRoot = "";

// Debug utilities for ExtendScript
var DEBUG_JSX = {
    messages: [],
    log: function(message, data) {
        var logMsg = "🎬 AirBoard: " + message + (data ? " | " + data : "");
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
                    var durationMs = Math.round(durationSeconds * 1000);
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
                    resultDurationMs = -1; // Flag for "Multiple" durations
                    resultDurationFrames = -1;
                    DEBUG_JSX.log("Properties have different durations");
                }
            }
            
            // Calculate position distances from the propertyTimes array
            var xDistance = 0, yDistance = 0, hasXDistance = false, hasYDistance = false;
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
                            
                            var distance = calculatePositionDistance(prop, allSelectedKeys);
                            DEBUG_JSX.log("Position distance calculated: x=" + distance.x + ", y=" + distance.y + ", hasX=" + distance.hasX + ", hasY=" + distance.hasY);
                            
                            if (distance.hasX) {
                                xDistance += distance.x;
                                hasXDistance = true;
                            }
                            if (distance.hasY) {
                                yDistance += distance.y;
                                hasYDistance = true;
                            }
                        }
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
                var timeMs = Math.round(item.time * 1000);
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
            var staggerMs = Math.round(staggerSeconds * 1000);
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
        
        // Collect layer startTimes (same approach as keyframe reading)
        var layerTimes = [];
        
        for (var i = 0; i < selectedLayers.length; i++) {
            var layer = selectedLayers[i];
            layerTimes.push({
                name: layer.name,
                time: layer.startTime,
                index: layer.index // Add layer index for proper stagger calculation
            });
        }
        
        DEBUG_JSX.log("Found " + layerTimes.length + " layers with startTimes");
        
        if (layerTimes.length === 1) {
            // Single layer - show its startTime as delay
            var delayMs = Math.round(layerTimes[0].time * 1000);
            var delayFrames = Math.round(layerTimes[0].time * frameRate);
            
            // Single layer mode - return with cross-property format and duration -999 (not applicable for layers)
            var result = "success|" + delayMs + "|" + delayFrames + "|-999|-999|1|0|0|0|0|1|Stagger|Layer " + layerTimes[0].name + " at " + delayMs + "ms";
            DEBUG_JSX.log("Single layer result: " + result);
            return result;
        }
        
        // Multiple layers - use same logic as keyframe cross-property reading
        layerTimes.sort(function(a, b) { return a.time - b.time; });
        var earliestTime = layerTimes[0].time;
        
        // Calculate all delays from earliest layer
        var delays = [];
        for (var k = 0; k < layerTimes.length; k++) {
            var delayMs = Math.round((layerTimes[k].time - earliestTime) * 1000);
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
        
        // Build debug string
        var debugStrings = [];
        for (var k = 0; k < layerTimes.length; k++) {
            debugStrings.push(layerTimes[k].name + " at " + delays[k] + "ms");
        }
        
        // Calculate stagger for layers (layer mode)
        var staggerText = "Stagger";
        try {
            staggerText = calculateStagger(layerTimes, frameRate, false); // false = layer mode
        } catch(e) {
            DEBUG_JSX.log("Layer stagger calculation failed: " + e.toString());
        }
        
        // Return in same format as keyframe reading but with stagger: success|delayMs|delayFrames|durationMs|durationFrames|crossProperty|xDist|yDist|hasX|hasY|isCrossProperty|stagger|debug
        var result = "success|" + resultDelayMs + "|" + resultDelayFrames + "|-999|-999|1|0|0|0|0|1|" + staggerText + "|Found " + layerTimes.length + " layers across " + selectedLayers.length + " layers | " + debugStrings.join(" | ");
        
        DEBUG_JSX.log("Layer delays result: " + result);
        return result;
        
    } catch(e) {
        return "error|Failed to read layer delays: " + e.toString();
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
            return "error|Select > 1 Keyframe";
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
        DEBUG_JSX.log("BASELINE_CACHE reset");
    },
    
    initialize: function(earliestTime, baselineProperty) {
        if (!this.isInitialized) {
            this.originalEarliestTime = earliestTime;
            this.originalBaselineProperty = baselineProperty;
            this.isInitialized = true;
            DEBUG_JSX.log("BASELINE_CACHE initialized: " + baselineProperty + " at " + earliestTime + "s");
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
            var currentDurationMs = Math.round((times[times.length - 1] - times[0]) * 1000);
            
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
                        DEBUG_JSX.log("Deselecting " + selKeys.length + " Time Remap keyframes on " + layer.name);
                        for (var k = 0; k < selKeys.length; k++) {
                            try {
                                prop.setSelectedAtKey(selKeys[k], false);
                            } catch(deselectError) {
                                DEBUG_JSX.log("Failed to deselect Time Remap keyframe: " + deselectError.toString());
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
                            // Skip invalid keyframes but continue processing
                            DEBUG_JSX.log("Skipping invalid keyframe at index " + keyIndex + " for property " + prop.name + ": " + keyError.toString());
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
        
        DEBUG_JSX.log("Found " + propertyNames.length + " properties: " + propertyNames.join(", "));
        
        if (propertyNames.length === 0) {
            // No keyframes selected - try layer startTime nudging
            DEBUG_JSX.log("No keyframes found, attempting layer startTime nudging");
            return nudgeLayerStartTimes(selectedLayers, direction, frameRate, comp);
        }
        
        // Allow single properties for timeline position nudging when all keyframes have same baseline
        if (propertyNames.length === 0) {
            app.endUndoGroup();
            return "error|No selected keyframes found";
        }
        
        // DEBUG: Return debug info to see what's being processed
        var debugInfo = [];
        debugInfo.push("Found " + propertyNames.length + " properties: " + propertyNames.join(", "));
        
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
        
        // IMPORTANT: Reset baseline cache each time to ensure fresh detection of current state
        // This ensures we always detect baseline vs delayed properties correctly
        BASELINE_CACHE.reset();
        var baselineData = BASELINE_CACHE.initialize(scanEarliestTime, scanBaselineProperty);
        var originalEarliestTime = baselineData.earliestTime;
        var originalBaselineProperty = baselineData.baselineProperty;
        
        // Second pass: build property delays with original baseline tracking
        for (var propName in propertyMap) {
            var propData = propertyMap[propName];
            var keyframes = propData.keyframes;
            debugInfo.push("Property '" + propName + "' has " + keyframes.length + " keyframes");
            
            // Sort by time to get first keyframe
            keyframes.sort(function(a, b) { return a.time - b.time; });
            var firstTime = keyframes[0].time;
            
            debugInfo.push("First time for " + propName + ": " + firstTime + "s");
            
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
            
            if (isOriginalBaseline) {
                debugInfo.push(propName + " is baseline property at " + firstTime + "s (never moves)");
            }
        }
        
        debugInfo.push("LOCKED Original Earliest time: " + originalEarliestTime + "s");
        debugInfo.push("LOCKED Original Baseline property: " + originalBaselineProperty);
        debugInfo.push("Cache initialized: " + BASELINE_CACHE.isInitialized);
        debugInfo.push("Current scan found: " + scanBaselineProperty + " at " + scanEarliestTime + "s");
        
        // Debug each property's baseline status
        for (var i = 0; i < propertyDelays.length; i++) {
            var propDelay = propertyDelays[i];
            debugInfo.push("Property " + propDelay.property + ": currentDelay=" + propDelay.currentDelay + "s, isOriginalBaseline=" + propDelay.isOriginalBaseline);
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
        
        if (propertyNames.length === 1) {
            // Single property mode: check if ALL selected keyframes within the property have the same time
            var singlePropData = propertyDelays[0];
            var keyframes = singlePropData.keyframes;
            
            if (keyframes.length > 1) {
                var firstKeyTime = keyframes[0].time;
                for (var k = 1; k < keyframes.length; k++) {
                    if (Math.abs(keyframes[k].time - firstKeyTime) > 0.001) { // 1ms tolerance in seconds
                        allSameDelay = false;
                        break;
                    }
                }
                DEBUG_JSX.log("Single property: checking " + keyframes.length + " keyframes, all same time: " + allSameDelay);
            }
        } else {
            // Multi-property mode: check if all properties have the same delay
            for (var i = 1; i < propertyDelays.length; i++) {
                DEBUG_JSX.log("Comparing delay " + i + ": " + propertyDelays[i].relativeDelay + "ms vs " + firstDelay + "ms");
                if (Math.abs(propertyDelays[i].relativeDelay - firstDelay) > 1) { // 1ms tolerance
                    allSameDelay = false;
                    break;
                }
            }
        }
        
        DEBUG_JSX.log("All same delay: " + allSameDelay);
        
        var targetDelayMs;
        
        try {
            // NEW SPECIAL CASE: Timeline position nudging when ALL **FIRST** keyframes are at the exact same time
            // This should only check the FIRST keyframe of each property (the baseline), not all keyframes
            var allFirstKeyframesAtSameTime = true;
            var firstKeyframeTime = null;
            var totalPropertiesCount = 0;
            
            debugInfo.push("=== TIMELINE MODE DETECTION (First keyframes only) ===");
            for (var propName in propertyMap) {
                var keyframes = propertyMap[propName].keyframes;
                debugInfo.push("Property " + propName + " has " + keyframes.length + " keyframes");
                
                if (keyframes.length > 0) {
                    totalPropertiesCount++;
                    // Only check the FIRST keyframe of each property
                    var firstKeyTime = keyframes[0].time;
                    debugInfo.push("  First keyframe at " + (firstKeyTime * 1000) + "ms");
                    
                    if (firstKeyframeTime === null) {
                        firstKeyframeTime = firstKeyTime;
                        debugInfo.push("  Reference time set to: " + (firstKeyframeTime * 1000) + "ms");
                    } else if (Math.abs(firstKeyTime - firstKeyframeTime) > 0.001) { // 1ms tolerance in seconds
                        debugInfo.push("  Time difference detected: " + (firstKeyTime * 1000) + "ms vs " + (firstKeyframeTime * 1000) + "ms = " + Math.abs(firstKeyTime - firstKeyframeTime) + "s");
                        allFirstKeyframesAtSameTime = false;
                        break;
                    }
                }
            }
            
            debugInfo.push("Timeline detection result: allFirstKeyframesAtSameTime=" + allFirstKeyframesAtSameTime + ", totalProperties=" + totalPropertiesCount + ", firstTime=" + (firstKeyframeTime ? (firstKeyframeTime * 1000) + "ms" : "null"));
            
            // Force timeline mode when properties are at baseline (0ms delay) - works for single OR multiple properties
            debugInfo.push("FORCED CHECK: properties=" + propertyDelays.length + ", allSameDelay=" + allSameDelay + ", firstDelay=" + propertyDelays[0].relativeDelay + "ms");
            // For single properties, force timeline mode regardless of allSameDelay if at baseline
            // For multiple properties, require allSameDelay
            var shouldForceTimeline = (propertyDelays.length === 1 && Math.abs(propertyDelays[0].relativeDelay) < 1) ||
                                    (propertyDelays.length >= 2 && allSameDelay && Math.abs(propertyDelays[0].relativeDelay) < 1);
            if (shouldForceTimeline) {
                debugInfo.push("FORCED TIMELINE: Properties at 0ms delay, forcing timeline mode for " + propertyDelays.length + " properties");
                try {
                    var timelineNudgeSeconds = (direction > 0 ? 50 : -50) / 1000.0;
                    var newTimelineTime = Math.max(0, originalEarliestTime + timelineNudgeSeconds);
                    
                    // Move all keyframes using the same approach as baseline mode
                    var timelinePropertyData = [];
                    for (var i = 0; i < propertyDelays.length; i++) {
                        var propData = propertyDelays[i];
                        var prop = propData.propObject;
                        var keyframesToMove = [];
                        
                        // Calculate the timeline offset to apply to all keyframes
                        var timelineOffset = newTimelineTime - originalEarliestTime;
                        
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
                            
                            // Apply easing if it exists (same as duration/baseline modes)
                            if (data.inEase !== undefined && data.outEase !== undefined) {
                                prop.setTemporalEaseAtKey(newIdx, data.inEase, data.outEase);
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
                    
                    return "success|" + newTimelinePositionMs + "|" + newTimelinePositionFrames + "|TIMELINE-FORCED|" + finalDebugInfo.join(" | ");
                } catch(forcedError) {
                    debugInfo.push("FORCED TIMELINE ERROR: " + forcedError.toString());
                }
            }
            
            if (allFirstKeyframesAtSameTime && firstKeyframeTime !== null) {
                try {
                    debugInfo.push("TIMELINE MODE: Moving all keyframes from " + (firstKeyframeTime * 1000) + "ms");
                    
                    // Timeline position nudging: move all keyframes by 50ms in timeline
                    var timelineNudgeSeconds = (direction > 0 ? 50 : -50) / 1000.0;
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
                    
                    var newTimelinePositionMs = newTimelineTime * 1000;
                    var newTimelinePositionFrames = Math.round(newTimelineTime * frameRate);
                    
                    app.endUndoGroup();
                    return "success|" + newTimelinePositionMs + "|" + newTimelinePositionFrames + "|TIMELINE|" + debugInfo.join(" | ");
                } catch(timelineError) {
                    debugInfo.push("TIMELINE ERROR: " + timelineError.toString());
                    // Fall through to baseline mode
                }
            }
            
            // EXISTING LOGIC: Normal delay adjustment (restore original baseline behavior)
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
                    var targetTime = originalEarliestTime + targetDelaySeconds; // Use LOCKED baseline time
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
                    
                    var targetTime = originalEarliestTime + targetDelaySeconds; // Use LOCKED baseline time
                    
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
                        
                        DEBUG_JSX.log("Property " + propData.property + " first keyframe originally at " + firstKeyframeTime + "s (frame " + firstKeyframeFrameNumber + ")");
                        
                        // Check all composition markers for ones at this exact frame
                        for (var m = 1; m <= comp.markerProperty.numKeys; m++) {
                            var markerTime = comp.markerProperty.keyTime(m);
                            var markerFrameNumber = Math.round(markerTime * frameRate) + 1;
                            
                            // Check if marker is at same frame as first keyframe (with small tolerance for floating point)
                            if (Math.abs(markerTime - firstKeyframeTime) < (0.5 / frameRate)) {
                                var markerValue = comp.markerProperty.keyValue(m);
                                var markerComment = markerValue.comment || ""; // Get marker comment/label
                                
                                DEBUG_JSX.log("Found marker at frame " + markerFrameNumber + " (time " + markerTime + "s) with comment: '" + markerComment + "'");
                                
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
                                
                                DEBUG_JSX.log("Marker will move from " + markerTime + "s to " + newMarkerTime + "s (offset: " + keyframeOffset + "s)");
                                
                                // Store marker info for movement (avoid duplicate moves)
                                var alreadyQueued = false;
                                for (var q = 0; q < markersToMove.length; q++) {
                                    if (markersToMove[q].markerIndex === m) {
                                        alreadyQueued = true;
                                        break;
                                    }
                                }
                                
                                if (!alreadyQueued) {
                                    markersToMove.push({
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
                
                // Move the markers that were found to be synchronized with first keyframes
                if (markersToMove.length > 0) {
                    DEBUG_JSX.log("Moving " + markersToMove.length + " synchronized markers:");
                    
                    // Sort markers by index in reverse order to avoid index shifts when removing
                    markersToMove.sort(function(a, b) { return b.markerIndex - a.markerIndex; });
                    
                    for (var m = 0; m < markersToMove.length; m++) {
                        var markerInfo = markersToMove[m];
                        
                        try {
                            // Remove the old marker
                            comp.markerProperty.removeKey(markerInfo.markerIndex);
                            
                            // Add new marker at the new time with same properties
                            var newMarkerIndex = comp.markerProperty.addKey(markerInfo.newTime);
                            comp.markerProperty.setValueAtKey(newMarkerIndex, markerInfo.markerValue);
                            
                            DEBUG_JSX.log("Moved marker '" + markerInfo.comment + "' from " + Math.round(markerInfo.oldTime * 1000) + "ms to " + Math.round(markerInfo.newTime * 1000) + "ms (synced with " + markerInfo.property + ")");
                            debugInfo.push("Synced marker '" + markerInfo.comment + "' with " + markerInfo.property);
                            
                        } catch(markerMoveError) {
                            DEBUG_JSX.log("Failed to move marker " + markerInfo.comment + ": " + markerMoveError.toString());
                            debugInfo.push("Failed to sync marker: " + markerMoveError.toString());
                        }
                    }
                } else {
                    DEBUG_JSX.log("No composition markers found at first keyframe times");
                }
                
            } catch(markerSyncError) {
                // Don't fail the entire operation if marker syncing fails
                DEBUG_JSX.log("Marker sync error: " + markerSyncError.toString());
                debugInfo.push("Marker sync error: " + markerSyncError.toString());
            }
            
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
        
        return result + "|BASELINE|" + debugInfo.join(" | ");
        
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

// Layer startTime nudging - uses same logic as keyframe delay nudging
function nudgeLayerStartTimes(selectedLayers, direction, frameRate, comp) {
    try {
        DEBUG_JSX.log("nudgeLayerStartTimes: processing " + selectedLayers.length + " layers");
        
        // Collect layer startTimes (same approach as keyframe delay detection)
        var layerDelays = [];
        var debugInfo = [];
        
        // Find baseline (earliest startTime) - same logic as keyframe baseline detection
        var scanEarliestTime = Number.MAX_VALUE;
        var scanBaselineLayer = null;
        
        for (var i = 0; i < selectedLayers.length; i++) {
            var layer = selectedLayers[i];
            var startTime = layer.startTime;
            
            if (startTime < scanEarliestTime) {
                scanEarliestTime = startTime;
                scanBaselineLayer = layer.name;
            }
        }
        
        DEBUG_JSX.log("Layer baseline detection: earliest=" + scanEarliestTime + "s, baseline=" + scanBaselineLayer);
        
        // Use same baseline cache approach as keyframes
        BASELINE_CACHE.reset();
        var baselineData = BASELINE_CACHE.initialize(scanEarliestTime, scanBaselineLayer);
        var originalEarliestTime = baselineData.earliestTime;
        
        // Build layer delays with baseline tracking
        for (var i = 0; i < selectedLayers.length; i++) {
            var layer = selectedLayers[i];
            var startTime = layer.startTime;
            
            // Track if this is a baseline layer
            var isOriginalBaseline = (Math.abs(startTime - originalEarliestTime) < 0.001);
            
            layerDelays.push({
                layer: layer,
                currentDelay: startTime,
                isOriginalBaseline: isOriginalBaseline
            });
            
            debugInfo.push("Layer " + layer.name + ": startTime=" + startTime + "s, isBaseline=" + isOriginalBaseline);
        }
        
        // Apply same snapping logic as keyframes
        var allSameDelay = true;
        var firstDelay = (layerDelays[0].currentDelay - originalEarliestTime) * 1000; // Convert to ms
        
        for (var i = 1; i < layerDelays.length; i++) {
            var delayMs = (layerDelays[i].currentDelay - originalEarliestTime) * 1000;
            if (Math.abs(delayMs - firstDelay) > 1) { // 1ms tolerance
                allSameDelay = false;
                break;
            }
        }
        
        DEBUG_JSX.log("All layers have same delay: " + allSameDelay + ", firstDelay=" + firstDelay + "ms");
        
        // Move layers using same logic as keyframes
        var movedCount = 0;
        if (allSameDelay && Math.abs(firstDelay) < 1) {
            // Timeline mode - all layers at baseline, move together by 50ms
            var timelineNudgeSeconds = (direction > 0 ? 50 : -50) / 1000.0;
            
            for (var i = 0; i < layerDelays.length; i++) {
                var layerData = layerDelays[i];
                var newStartTime = Math.max(0, layerData.currentDelay + timelineNudgeSeconds);
                
                // Clamp to composition bounds
                newStartTime = Math.min(newStartTime, comp.duration);
                
                layerData.layer.startTime = newStartTime;
                movedCount++;
                debugInfo.push("Timeline mode: Moved " + layerData.layer.name + " to " + newStartTime + "s");
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
                var currentDelayMs = (layerData.currentDelay - originalEarliestTime) * 1000;
                var targetDelayMs = calculateDelaySnap(currentDelayMs, direction);
                var targetTime = originalEarliestTime + (targetDelayMs / 1000);
                
                // Clamp to bounds
                targetTime = Math.max(0, Math.min(targetTime, comp.duration));
                
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
        
        // Use first selected layer
        var layer = selectedLayers[0];
        
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
        
        // Find the property for this axis
        var axisPropertyData = findAxisProperty(layer, axis);
        if (!axisPropertyData) {
            app.endUndoGroup();
            return "error|Select " + axis.toUpperCase() + " position keyframes";
        }
        
        var prop = axisPropertyData.property;
        var selKeys = axisPropertyData.keys;
        
        if (selKeys.length < 2) {
            app.endUndoGroup();
            if (selKeys.length === 1) {
                return "error|Select > 1 " + axis.toUpperCase() + " position keyframe";
            } else {
                return "error|Select " + axis.toUpperCase() + " position keyframes";
            }
        }
        
        processedAny = true;
        
        // Sort selected key indices
        selKeys.sort(function(a, b) { return a - b; });
        
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
            app.endUndoGroup();
            return "error|Invalid position value type";
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
            app.endUndoGroup();
            return "error|Invalid other keyframe position value type";
        }
        
        // Calculate current distance between keyframes
        var currentDistance = Math.abs(currentCoord - otherCoord);
        
        // Smart snapping: check if current DISTANCE is aligned to scaledIncrement boundary
        var distanceRemainder = Math.abs(currentDistance % scaledIncrement);
        var tolerance = 0.1;
        var isDistanceAlreadySnapped = (distanceRemainder < tolerance) || (distanceRemainder > (scaledIncrement - tolerance));
        
        DEBUG_JSX.log("Position snapping debug:");
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
            app.endUndoGroup();
            return "error|Invalid position value type";
        }
        
        // Apply the new keyframe value
        try {
            prop.setValueAtKey(keyIndexToMove, newValue);
        } catch(e) {
            app.endUndoGroup();
            return "error|Failed to set keyframe value: " + e.toString();
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
                
                // Apply easing if it exists (same as delay nudging)
                if (data.inEase !== undefined && data.outEase !== undefined) {
                    prop.setTemporalEaseAtKey(newIdx, data.inEase, data.outEase);
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
function applyStagger(direction, staggerFrames) {
    try {
        // Clear debug messages from previous operations
        DEBUG_JSX.clear();
        
        DEBUG_JSX.log("applyStagger called - direction: " + direction + ", frames: " + staggerFrames);
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
        var staggerMs = Math.round((staggerFrames / frameRate) * 1000);
        DEBUG_JSX.log("Stagger: " + staggerFrames + " frames = " + staggerMs + "ms at " + frameRate + "fps");
        
        // Check for selected keyframes first (keyframes take precedence)
        var keyframeResult = applyStaggerToKeyframes(direction, staggerMs, frameRate, staggerFrames);
        if (keyframeResult.indexOf("error|No selected keyframes") !== 0) {
            app.endUndoGroup();
            var debugMessages = DEBUG_JSX.getMessages();
            return keyframeResult + "|" + debugMessages.join("|");
        }
        
        // If no keyframes selected, try layers
        var layerResult = applyStaggerToLayers(direction, staggerMs, frameRate, staggerFrames);
        
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
function applyStaggerToKeyframes(direction, staggerMs, frameRate, staggerFrames) {
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
        
        // Sort layers by index (bottom to top: highest index to lowest)
        layerGroups.sort(function(a, b) { return b.layerIndex - a.layerIndex; });
        
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
            
            // Calculate cumulative stagger offset for this layer position
            var staggerOffset = layerIdx * direction * staggerMs / 1000; // in seconds
            
            DEBUG_JSX.log("Layer " + layerGroup.layer.index + ": applying cumulative offset " + (staggerOffset * 1000) + "ms");
            
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
                    
                    keyframeData.push({
                        oldIndex: keyIndex,
                        newTime: finalTime,
                        value: prop.keyValue(keyIndex),
                        inInterp: prop.keyInInterpolationType(keyIndex),
                        outInterp: prop.keyOutInterpolationType(keyIndex),
                        temporalContinuous: prop.keyTemporalContinuous(keyIndex),
                        temporalAutoBezier: prop.keyTemporalAutoBezier(keyIndex),
                        // Temporal ease data
                        inEase: prop.keyInInterpolationType(keyIndex) === KeyframeInterpolationType.BEZIER ? prop.keyInTemporalEase(keyIndex) : null,
                        outEase: prop.keyInInterpolationType(keyIndex) === KeyframeInterpolationType.BEZIER ? prop.keyOutTemporalEase(keyIndex) : null,
                        // Spatial data for position properties
                        spatialContinuous: prop.isSpatial ? prop.keySpatialContinuous(keyIndex) : null,
                        spatialAutoBezier: prop.isSpatial ? prop.keySpatialAutoBezier(keyIndex) : null,
                        inTangent: prop.isSpatial ? prop.keyInSpatialTangent(keyIndex) : null,
                        outTangent: prop.isSpatial ? prop.keyOutSpatialTangent(keyIndex) : null
                    });
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
                    
                    // Restore temporal properties
                    if (data.inEase !== null && data.outEase !== null) {
                        prop.setTemporalEaseAtKey(newIdx, data.inEase, data.outEase);
                    }
                    prop.setTemporalContinuousAtKey(newIdx, data.temporalContinuous);
                    prop.setTemporalAutoBezierAtKey(newIdx, data.temporalAutoBezier);
                    
                    // Restore spatial properties for position
                    if (data.spatialContinuous !== null) {
                        prop.setSpatialContinuousAtKey(newIdx, data.spatialContinuous);
                        prop.setSpatialAutoBezierAtKey(newIdx, data.spatialAutoBezier);
                        prop.setSpatialTangentsAtKey(newIdx, data.inTangent, data.outTangent);
                    }
                    
                    newSelIndices.push(newIdx);
                }
                
                // Store the new indices for final selection
                propData.newSelIndices = newSelIndices;
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
function applyStaggerToLayers(direction, staggerMs, frameRate, staggerFrames) {
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
        
        // Sort layers by index (bottom to top: highest index to lowest)
        layerArray.sort(function(a, b) { return b.index - a.index; });
        
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
        
        // Create composition name
        var compName = deviceType.charAt(0).toUpperCase() + deviceType.slice(1) + " @" + multiplier + "x";
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