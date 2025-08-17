// Global variable to store extension path (set by the panel)
var extensionRoot = "";

// User Preferences - Save/Load resolution multiplier
function saveResolutionPreference(multiplier) {
    try {
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

// Read Keyframes - Calculate duration between selected keyframes
function readKeyframesDuration() {
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
        
        return "success|" + durationMs + "|" + durationFrames;
        
    } catch(e) {
        return "error|Failed to read keyframes: " + e.toString();
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
                // If there are keyframes, offset all keyframe values to center
                var currentPos = gestureLayer.transform.position.value;
                var offsetX = (comp.width/2) - currentPos[0];
                var offsetY = (comp.height/2) - currentPos[1];
                
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
                layerName: "Time Counter"
            },
            "dot-loader": {
                compName: "Dot Loader",
                layerName: "Dot Loader"
            }
        };
        
        var data = componentData[componentType];
        if (!data) {
            alert("Unknown component type: " + componentType);
            // app.endUndoGroup();
            return "error";
        }
        
        // Template file path
        var templatePath = extensionRoot + "/assets/templates/AirBoard Templates.aep";
        var templateFile = new File(templatePath);
        
        // Check alternate path separator
        if (!templateFile.exists) {
            templatePath = extensionRoot + "\\assets\\templates\\AirBoard Templates.aep";
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
        
        // Find the specific layer in the component comp
        var sourceLayer = null;
        for (var k = 1; k <= componentComp.layers.length; k++) {
            var layer = componentComp.layers[k];
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
            alert("Error: Component layer was not added to the composition.");
            // app.endUndoGroup();
            return "error";
        }
        
        // The new layer is always at index 1 per AE scripting behavior; no need for name check to avoid false errors
        var componentLayer = comp.layers[1];
        
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
                    // Center for other components
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
                    // Center for other components
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

// Add Shadow functionality - Apply elevation shadow presets based on resolution and elevation
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
        
        // Build the preset file path based on resolution and elevation
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
            targetLayer.applyPreset(presetFile);
            return "success";
        } catch(applyError) {
            alert("Error applying shadow preset: " + applyError.toString());
            return "error";
        }
        
    } catch(e) {
        alert("Error adding shadow: " + e.toString());
        return "error";
    }
}