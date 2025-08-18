// This file connects the HTML panel to After Effects

// Wait for the page to load
document.addEventListener('DOMContentLoaded', function() {
    // Create connection to After Effects
    var csInterface;
    var extensionPath = "";
    
    try {
        csInterface = new CSInterface();
        extensionPath = csInterface.getSystemPath(SystemPath.EXTENSION);
    } catch(e) {
        console.log("CSInterface not available:", e);
    }
    
    // Get the buttons
    var createButton = document.getElementById('createSquircle');
    var replaceButton = document.getElementById('replaceRectangle');
    var addDeviceButton = document.getElementById('addDevice');
    var addGestureButton = document.getElementById('addGesture');
    var resolutionInput = document.getElementById('resolutionMultiplier');
    var resolutionText = document.getElementById('resolutionText');
    
    // Accordion functionality
    function initializeAccordion() {
        var accordionToggles = document.querySelectorAll('.accordion-toggle');
        
        accordionToggles.forEach(function(toggle) {
            toggle.addEventListener('click', function(e) {
                // Only handle click if it's specifically on the toggle button, not the header
                if (e.target !== this && !this.contains(e.target)) return;
                
                var sectionName = this.getAttribute('data-section');
                var content = document.querySelector('.section-content[data-section="' + sectionName + '"]');
                var section = content ? content.closest('.section') : null;
                
                if (content && section) {
                    var isCollapsed = content.classList.contains('collapsed');
                    
                    if (isCollapsed) {
                        // Expand
                        content.classList.remove('collapsed');
                        section.classList.remove('collapsed');
                        this.classList.remove('collapsed');
                    } else {
                        // Collapse
                        content.classList.add('collapsed');
                        section.classList.add('collapsed');
                        this.classList.add('collapsed');
                    }
                }
            });
        });
    }
    
    
    // Section reordering functionality
    function initializeSectionReordering() {
        var container = document.querySelector('.container');
        
        function attachReorderHandlers() {
            var moveUpButtons = document.querySelectorAll('.move-up');
            var moveDownButtons = document.querySelectorAll('.move-down');
            
            moveUpButtons.forEach(function(button) {
                button.addEventListener('click', function(e) {
                    e.preventDefault();
                    e.stopPropagation();
                    
                    var sectionContainer = this.closest('.section-container');
                    var previousSibling = sectionContainer.previousElementSibling;
                    
                    if (previousSibling) {
                        // Calculate the distance to slide
                        var previousHeight = previousSibling.offsetHeight + 10; // height + margin
                        
                        // Add moving class for elevated shadow
                        sectionContainer.classList.add('moving');
                        
                        // Slide the section up to the previous position
                        sectionContainer.style.transform = 'translateY(-' + previousHeight + 'px)';
                        
                        // Also slide the previous section down
                        var sectionHeight = sectionContainer.offsetHeight + 10;
                        previousSibling.style.transform = 'translateY(' + sectionHeight + 'px)';
                        
                        setTimeout(function() {
                            // Move in DOM first
                            container.insertBefore(sectionContainer, previousSibling);
                            
                            // Now both sections should end up at their correct positions
                            // Reset transforms immediately without animation
                            sectionContainer.style.transition = 'none';
                            previousSibling.style.transition = 'none';
                            sectionContainer.style.transform = '';
                            previousSibling.style.transform = '';
                            
                            // Restore transition after a brief moment
                            setTimeout(function() {
                                sectionContainer.style.transition = '';
                                previousSibling.style.transition = '';
                                sectionContainer.classList.remove('moving');
                                
                                // Reattach handlers after DOM change
                                setTimeout(attachReorderHandlers, 50);
                            }, 50);
                        }, 300);
                    }
                });
            });
            
            moveDownButtons.forEach(function(button) {
                button.addEventListener('click', function(e) {
                    e.preventDefault();
                    e.stopPropagation();
                    
                    var sectionContainer = this.closest('.section-container');
                    var nextSibling = sectionContainer.nextElementSibling;
                    
                    if (nextSibling) {
                        // Calculate the distance to slide
                        var nextHeight = nextSibling.offsetHeight + 10; // height + margin
                        
                        // Add moving class for elevated shadow
                        sectionContainer.classList.add('moving');
                        
                        // Slide the section down to the next position
                        sectionContainer.style.transform = 'translateY(' + nextHeight + 'px)';
                        
                        // Also slide the next section up
                        var sectionHeight = sectionContainer.offsetHeight + 10;
                        nextSibling.style.transform = 'translateY(-' + sectionHeight + 'px)';
                        
                        setTimeout(function() {
                            // Move in DOM first
                            var nextNextSibling = nextSibling.nextElementSibling;
                            if (nextNextSibling) {
                                container.insertBefore(sectionContainer, nextNextSibling);
                            } else {
                                container.appendChild(sectionContainer);
                            }
                            
                            // Reset transforms immediately without animation
                            sectionContainer.style.transition = 'none';
                            nextSibling.style.transition = 'none';
                            sectionContainer.style.transform = '';
                            nextSibling.style.transform = '';
                            
                            // Restore transition after a brief moment
                            setTimeout(function() {
                                sectionContainer.style.transition = '';
                                nextSibling.style.transition = '';
                                sectionContainer.classList.remove('moving');
                                
                                // Reattach handlers after DOM change
                                setTimeout(attachReorderHandlers, 50);
                            }, 50);
                        }, 300);
                    }
                });
            });
        }
        
        attachReorderHandlers();
    }
    
    // Initialize accordion on page load
    initializeAccordion();
    
    // Initialize section reordering
    initializeSectionReordering();
    
    // Function to update resolution display text only
    function updateResolutionDisplay() {
        var currentValue = resolutionInput.value;
        console.log('Updating display to:', currentValue);
        resolutionText.textContent = 'Resolution @' + currentValue + 'x';
        console.log('Display updated to:', resolutionText.textContent);
    }
    
    // Function to save resolution preference
    function saveResolutionPreference(multiplier) {
        if (csInterface) {
            var script = 'saveResolutionPreference(' + multiplier + ')';
            csInterface.evalScript(script, function(result) {
                console.log('Resolution preference saved:', result);
            });
        }
    }
    
    // Function to load resolution preference on startup
    function loadResolutionPreference() {
        if (csInterface) {
            var script = 'loadResolutionPreference()';
            csInterface.evalScript(script, function(result) {
                var savedResolution = parseInt(result);
                if (savedResolution >= 1 && savedResolution <= 6) {
                    resolutionInput.value = savedResolution;
                    updateResolutionDisplay();
                    console.log('Loaded resolution preference:', savedResolution);
                }
            });
        }
    }
    
    // Get the increment/decrement buttons and attach event listeners
    var incrementBtn = document.querySelector('.resolution-display .number-btn.increment');
    var decrementBtn = document.querySelector('.resolution-display .number-btn.decrement');
    
    incrementBtn.addEventListener('click', function() {
        console.log('Increment clicked');
        var currentValue = parseInt(resolutionInput.value);
        console.log('Current value:', currentValue);
        var maxValue = 6; // Max resolution multiplier
        if (currentValue < maxValue) {
            resolutionInput.value = currentValue + 1;
            console.log('New value:', resolutionInput.value);
            updateResolutionDisplay();
            // Save the new preference
            saveResolutionPreference(parseInt(resolutionInput.value));
        }
    });
    
    decrementBtn.addEventListener('click', function() {
        console.log('Decrement clicked');
        var currentValue = parseInt(resolutionInput.value);
        console.log('Current value:', currentValue);
        var minValue = 1; // Min resolution multiplier
        if (currentValue > minValue) {
            resolutionInput.value = currentValue - 1;
            console.log('New value:', resolutionInput.value);
            updateResolutionDisplay();
            // Save the new preference
            saveResolutionPreference(parseInt(resolutionInput.value));
        }
    });
    
    // Keyframe Reader Controls
    var durationValue = document.getElementById('durationValue');
    var durationText = document.getElementById('durationText');
    
    // Duration +/- buttons (StackOverflow record/delete/recreate approach)
    var durationIncrementBtn = document.querySelector('#durationDisplay .number-btn.increment');
    var durationDecrementBtn = document.querySelector('#durationDisplay .number-btn.decrement');
    
    if (durationIncrementBtn && durationDecrementBtn) {
        // + button: Stretch keyframes forward by 3 frames
        durationIncrementBtn.addEventListener('click', function() {
            console.log('Duration increment (stretch forward) clicked');
            
            // Check if CSInterface is available
            if (!csInterface) {
                console.log('CSInterface not available');
                return;
            }
            
            // Disable button while working
            durationIncrementBtn.disabled = true;
            
            // Call the ExtendScript function
            csInterface.evalScript('stretchKeyframesForward()', function(result) {
                console.log('Stretch forward result:', result);
                
                // Re-enable button
                durationIncrementBtn.disabled = false;
                
                // Update display if successful (same format as readKeyframesDuration)
                if (result && result.indexOf('|') !== -1) {
                    var parts = result.split('|');
                    var status = parts[0];
                    
                    if (status === 'success') {
                        var durationMs = parseInt(parts[1]);
                        var durationFrames = parseInt(parts[2]);
                        
                        // Update the duration value and display
                        durationValue.value = durationMs;
                        durationText.textContent = durationMs + 'ms / ' + durationFrames + 'f';
                        durationText.style.opacity = '1';
                        
                        console.log('Updated duration to:', durationMs + 'ms /', durationFrames + 'f');
                    } else if (status === 'error') {
                        var errorMsg = parts[1] || 'Unknown error';
                        console.log('Stretch error:', errorMsg);
                        
                        // Show error briefly, then revert to selection message
                        durationText.textContent = 'Select > 1 Keyframe';
                    }
                } else {
                    durationText.textContent = 'Select > 1 Keyframe';
                    console.log('Unexpected result:', result);
                }
            });
        });
        
        // - button: Shrink keyframes backward by 3 frames
        durationDecrementBtn.addEventListener('click', function() {
            console.log('Duration decrement (stretch backward) clicked');
            
            // Check if CSInterface is available
            if (!csInterface) {
                console.log('CSInterface not available');
                return;
            }
            
            // Disable button while working
            durationDecrementBtn.disabled = true;
            
            // Call the ExtendScript function
            csInterface.evalScript('stretchKeyframesBackward()', function(result) {
                console.log('Stretch backward result:', result);
                
                // Re-enable button
                durationDecrementBtn.disabled = false;
                
                // Update display if successful (same format as readKeyframesDuration)
                if (result && result.indexOf('|') !== -1) {
                    var parts = result.split('|');
                    var status = parts[0];
                    
                    if (status === 'success') {
                        var durationMs = parseInt(parts[1]);
                        var durationFrames = parseInt(parts[2]);
                        
                        // Update the duration value and display
                        durationValue.value = durationMs;
                        durationText.textContent = durationMs + 'ms / ' + durationFrames + 'f';
                        durationText.style.opacity = '1';
                        
                        console.log('Updated duration to:', durationMs + 'ms /', durationFrames + 'f');
                    } else if (status === 'error') {
                        var errorMsg = parts[1] || 'Unknown error';
                        console.log('Shrink error:', errorMsg);
                        
                        // Show error briefly, then revert to selection message
                        durationText.textContent = 'Select > 1 Keyframe';
                    }
                } else {
                    durationText.textContent = 'Select > 1 Keyframe';
                    console.log('Unexpected result:', result);
                }
            });
        });
    }
    
    // Read Keyframes button handler
    var readKeyframesButton = document.getElementById('readKeyframes');
    readKeyframesButton.addEventListener('click', function() {
        console.log('Read Keyframes clicked');
        
        // Check if CSInterface is available
        if (!csInterface) {
            durationText.textContent = 'Select > 1 Keyframe';
            return;
        }
        
        // Call the After Effects script to read keyframe duration
        csInterface.evalScript('readKeyframesDuration()', function(result) {
            console.log('Keyframe reading result:', result);
            
            if (result && result.indexOf('|') !== -1) {
                var parts = result.split('|');
                var status = parts[0];
                
                if (status === 'success') {
                    var durationMs = parseInt(parts[1]);
                    var durationFrames = parseInt(parts[2]);
                    
                    // Update the duration value and display
                    durationValue.value = durationMs;
                    durationText.textContent = durationMs + 'ms / ' + durationFrames + 'f';
                    
                    // Change duration label to 100% opacity for brightness
                    durationText.style.opacity = '1';
                    
                    console.log('Updated duration to:', durationMs + 'ms /', durationFrames + 'f');
                } else if (status === 'error') {
                    var errorMsg = parts[1] || 'Unknown error';
                    
                    // Update duration text label with error message
                    durationText.textContent = 'Select > 1 Keyframe';
                    
                    console.log('Error:', errorMsg);
                }
            } else {
                durationText.textContent = 'Select > 1 Keyframe';
                console.log('Unexpected result:', result);
            }
        });
    });
    
    // Don't initialize displays on startup - keep default labels
    
    // Add Device button handler
    addDeviceButton.addEventListener('click', function() {
        console.log('Add Device clicked');
        
        // Get selected device type and resolution multiplier
        var deviceType = document.getElementById('deviceType').value;
        var resolutionMultiplier = parseInt(document.getElementById('resolutionMultiplier').value);
        
        // Validate input
        if (isNaN(resolutionMultiplier) || resolutionMultiplier < 1 || resolutionMultiplier > 6) {
            alert('Please enter a resolution multiplier between 1 and 6');
            addDeviceButton.disabled = false;
            addDeviceButton.textContent = 'Add Device';
            return;
        }
        
        console.log('Device Type:', deviceType, 'Resolution Multiplier:', resolutionMultiplier);
        
        // Disable button while working
        addDeviceButton.disabled = true;
        
        // Check if CSInterface is available
        if (!csInterface) {
            alert('CSInterface not available. Please run this in After Effects.');
            addDeviceButton.disabled = false;
            return;
        }
        
        // Pass the extension path to the JSX
        var setPathScript = 'var extensionRoot = "' + extensionPath.replace(/\\/g, '\\\\') + '";';
        csInterface.evalScript(setPathScript);
        
        // Call the After Effects script to create device composition
        var script = 'createDeviceComposition("' + deviceType + '", ' + resolutionMultiplier + ')';
        console.log('Executing script:', script);
        
        csInterface.evalScript(script, function(result) {
            console.log('Device creation result:', result);
            // Re-enable button
            addDeviceButton.disabled = false;
        });
    });
    
    // Create Squircle button handler
    createButton.addEventListener('click', function() {
        console.log('Create Squircle clicked');
        
        // Disable button while working
        createButton.classList.add('loading');
        
        // Pass the extension path to the JSX
        var setPathScript = 'var extensionRoot = "' + extensionPath.replace(/\\/g, '\\\\') + '";';
        csInterface.evalScript(setPathScript);
        
        // Call the After Effects script
        csInterface.evalScript('createSquircleFromPanel()', function(result) {
            console.log('Squircle result:', result);
            // Re-enable button
            createButton.classList.remove('loading');
        });
    });
    
    // Replace Rectangle button handler
    replaceButton.addEventListener('click', function() {
        console.log('Replace Rectangle clicked');
        
        // Disable button while working
        replaceButton.classList.add('loading');
        
        // Pass the extension path to the JSX
        var setPathScript = 'var extensionRoot = "' + extensionPath.replace(/\\/g, '\\\\') + '";';
        csInterface.evalScript(setPathScript);
        
        // Call the replace function
        csInterface.evalScript('replaceRectangleFromPanel()', function(result) {
            console.log('Replace result:', result);
            // Re-enable button
            replaceButton.classList.remove('loading');
        });
    });
    
    // Add Gesture button handler
    addGestureButton.addEventListener('click', function() {
        console.log('Add Gesture clicked');
        
        // Get selected gesture type and resolution multiplier
        var gestureType = document.getElementById('gestureType').value;
        var resolutionMultiplier = parseInt(document.getElementById('resolutionMultiplier').value);
        
        console.log('Gesture Type:', gestureType, 'Resolution Multiplier:', resolutionMultiplier);
        
        // Disable button while working
        addGestureButton.disabled = true;
        
        // Pass the extension path to the JSX
        var setPathScript = 'var extensionRoot = "' + extensionPath.replace(/\\/g, '\\\\') + '";';
        csInterface.evalScript(setPathScript);
        
        // Call the After Effects script to add gesture
        var script = 'addGestureFromPanel("' + gestureType + '", ' + resolutionMultiplier + ')';
        console.log('Executing script:', script);
        
        csInterface.evalScript(script, function(result) {
            console.log('Gesture result:', result);
            // Re-enable button
            addGestureButton.disabled = false;
        });
    });
    
    // Add Component button handler
    var addComponentButton = document.getElementById('addComponent');
    addComponentButton.addEventListener('click', function() {
        console.log('Add Component clicked');
        
        // Get selected component type and resolution multiplier
        var componentType = document.getElementById('componentType').value;
        var resolutionMultiplier = parseInt(document.getElementById('resolutionMultiplier').value);
        
        console.log('Component Type:', componentType, 'Resolution Multiplier:', resolutionMultiplier);
        
        // Disable button while working
        addComponentButton.disabled = true;
        
        // Check if CSInterface is available
        if (!csInterface) {
            alert('CSInterface not available. Please run this in After Effects.');
            addComponentButton.disabled = false;
            return;
        }
        
        // Pass the extension path to the JSX
        var setPathScript = 'var extensionRoot = "' + extensionPath.replace(/\\/g, '\\\\') + '";';
        csInterface.evalScript(setPathScript);
        
        // Call the After Effects script to add component
        var script = 'addComponentFromPanel("' + componentType + '", ' + resolutionMultiplier + ')';
        console.log('Executing script:', script);
        
        csInterface.evalScript(script, function(result) {
            console.log('Component result:', result);
            // Re-enable button
            addComponentButton.disabled = false;
        });
    });
    
    // AE Folders button handler
    var aeFoldersButton = document.getElementById('aeFolders');
    aeFoldersButton.addEventListener('click', function() {
        console.log('AE Folders clicked');
        
        // Disable button while working
        aeFoldersButton.disabled = true;
        
        // Call the After Effects script to create folder structure
        var script = 'createAEFoldersFromPanel()';
        console.log('Executing script:', script);
        
        csInterface.evalScript(script, function(result) {
            console.log('AE Folders result:', result);
            // Re-enable button
            aeFoldersButton.disabled = false;
        });
    });
    
    // Finder Folders button handler
    var finderFoldersButton = document.getElementById('finderFolders');
    finderFoldersButton.addEventListener('click', function() {
        console.log('Finder Folders clicked');
        
        // Disable button while working
        finderFoldersButton.disabled = true;
        
        // Call the After Effects script to create finder folder structure
        var script = 'createFinderFoldersFromPanel()';
        console.log('Executing script:', script);
        
        csInterface.evalScript(script, function(result) {
            console.log('Finder Folders result:', result);
            // Re-enable button
            finderFoldersButton.disabled = false;
        });
    });
    
    // Add Shadow button handler
    var addShadowButton = document.getElementById('addShadow');
    addShadowButton.addEventListener('click', function() {
        console.log('Add Shadow clicked');
        
        // Get elevation type and resolution multiplier
        var elevationType = document.getElementById('elevationType').value;
        var resolutionMultiplier = parseInt(document.getElementById('resolutionMultiplier').value);
        
        console.log('Elevation Type:', elevationType, 'Resolution Multiplier:', resolutionMultiplier);
        
        // Disable button while working
        addShadowButton.disabled = true;
        
        // Check if CSInterface is available
        if (!csInterface) {
            alert('CSInterface not available. Please run this in After Effects.');
            addShadowButton.disabled = false;
            return;
        }
        
        // Pass the extension path to the JSX
        var setPathScript = 'var extensionRoot = "' + extensionPath.replace(/\\/g, '\\\\') + '";';
        csInterface.evalScript(setPathScript);
        
        // Call the After Effects script
        var script = 'addShadowFromPanel("' + elevationType + '", ' + resolutionMultiplier + ')';
        console.log('Executing script:', script);
        
        csInterface.evalScript(script, function(result) {
            console.log('Shadow result:', result);
            // Re-enable button
            addShadowButton.disabled = false;
        });
    });
    
    
    // Load saved resolution preference on startup
    loadResolutionPreference();
    
    
    // Set up the panel theme to match After Effects
    csInterface.setBackgroundColor(38, 38, 38); // Dark gray background
});