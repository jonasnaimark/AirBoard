// This file connects the HTML panel to After Effects

// Always show all control buttons - per user request for consistency
setTimeout(function() {
    var durationControls = document.querySelector('#durationDisplay .number-controls');
    var delayControls = document.querySelector('#delayDisplay .number-controls');
    var xControls = document.querySelector('#xDistanceDisplay .distance-controls');
    var yControls = document.querySelector('#yDistanceDisplay .distance-controls');
    
    // Always show all buttons for consistency
    if (durationControls) durationControls.style.display = 'flex';
    if (delayControls) delayControls.style.display = 'flex';
    if (xControls) xControls.style.display = 'flex';
    if (yControls) yControls.style.display = 'flex';
}, 1000); // Wait for DOM to be ready

// Debug utilities for Chrome DevTools
const DEBUG = {
    log: (msg, data) => console.log(`🎬 AirBoard: ${msg}`, data || ''),
    error: (msg, error) => console.error(`❌ AirBoard Error: ${msg}`, error),
    info: (msg, data) => console.info(`ℹ️ AirBoard: ${msg}`, data || ''),
    warn: (msg, data) => console.warn(`⚠️ AirBoard Warning: ${msg}`, data || '')
};

// Helper functions to show/hide control buttons
function hidePositionButtons() {
    var xControls = document.querySelector('#xDistanceDisplay .distance-controls');
    var yControls = document.querySelector('#yDistanceDisplay .distance-controls');
    if (xControls) xControls.style.display = 'none';
    if (yControls) yControls.style.display = 'none';
}

function showPositionButtons() {
    var xControls = document.querySelector('#xDistanceDisplay .distance-controls');
    var yControls = document.querySelector('#yDistanceDisplay .distance-controls');
    if (xControls) xControls.style.display = 'flex';
    if (yControls) yControls.style.display = 'flex';
}

function hideXButtons() {
    var xControls = document.querySelector('#xDistanceDisplay .distance-controls');
    if (xControls) xControls.style.display = 'none';
}

function showXButtons() {
    var xControls = document.querySelector('#xDistanceDisplay .distance-controls');
    if (xControls) xControls.style.display = 'flex';
}

function hideYButtons() {
    var yControls = document.querySelector('#yDistanceDisplay .distance-controls');
    if (yControls) yControls.style.display = 'none';
}

function showYButtons() {
    var yControls = document.querySelector('#yDistanceDisplay .distance-controls');
    if (yControls) yControls.style.display = 'flex';
}

function hideDurationButtons() {
    var durationControls = document.querySelector('#durationDisplay .number-controls');
    if (durationControls) durationControls.style.display = 'none';
}

function showDurationButtons() {
    var durationControls = document.querySelector('#durationDisplay .number-controls');
    if (durationControls) durationControls.style.display = 'flex';
}


// Add simple debug panel to the extension UI (DEV MODE only)
window.addDebugPanel = () => {
    if (document.getElementById('debug-panel')) return; // Already exists
    
    const debugPanel = document.createElement('div');
    debugPanel.id = 'debug-panel';
    debugPanel.style.cssText = `
        position: fixed;
        top: 10px;
        right: 10px;
        width: 250px;
        background: #1a1a1a;
        border: 1px solid #444;
        border-radius: 6px;
        padding: 10px;
        font-size: 10px;
        color: #ccc;
        z-index: 1000;
        max-height: 200px;
        overflow-y: auto;
        user-select: text;
        -webkit-user-select: text;
        -moz-user-select: text;
        font-family: monospace;
    `;
    
    debugPanel.innerHTML = `
        <div style="font-weight: bold; margin-bottom: 5px; user-select: none;">🐛 Debug Panel</div>
        <div id="debug-log" style="
            user-select: text; 
            -webkit-user-select: text; 
            -moz-user-select: text;
            font-family: monospace;
            font-size: 9px;
            line-height: 1.3;
        "></div>
        <div style="margin-top: 8px; user-select: none;">
            <button onclick="document.getElementById('debug-log').innerHTML = ''" style="
                background: #444; 
                border: 1px solid #666; 
                color: #ccc; 
                padding: 2px 6px; 
                border-radius: 3px; 
                font-size: 9px;
                margin-right: 4px;
                cursor: pointer;
            ">Clear</button>
            <button onclick="navigator.clipboard && navigator.clipboard.writeText(document.getElementById('debug-log').innerText)" style="
                background: #444; 
                border: 1px solid #666; 
                color: #ccc; 
                padding: 2px 6px; 
                border-radius: 3px; 
                font-size: 9px;
                margin-right: 4px;
                cursor: pointer;
            ">Copy</button>
            <button onclick="document.getElementById('debug-panel').remove()" style="
                background: #666; 
                border: 1px solid #888; 
                color: white; 
                padding: 2px 6px; 
                border-radius: 3px; 
                font-size: 9px;
                cursor: pointer;
            ">Close</button>
        </div>
    `;
    
    document.body.appendChild(debugPanel);
    
    // Redirect console.log to debug panel
    const originalLog = console.log;
    console.log = (...args) => {
        originalLog(...args);
        const logDiv = document.getElementById('debug-log');
        if (logDiv) {
            logDiv.innerHTML += `<div style="
                margin: 2px 0; 
                font-size: 9px; 
                padding: 1px 0;
                user-select: text;
                -webkit-user-select: text;
                word-wrap: break-word;
            ">${args.join(' ')}</div>`;
            logDiv.scrollTop = logDiv.scrollHeight;
        }
    };
};

// Wait for the page to load
document.addEventListener('DOMContentLoaded', function() {
    // Create connection to After Effects
    var csInterface;
    var extensionPath = "";
    
    try {
        csInterface = new CSInterface();
        extensionPath = csInterface.getSystemPath(SystemPath.EXTENSION);
        DEBUG.log('CSInterface initialized successfully');
    } catch(e) {
        DEBUG.error("CSInterface not available", e);
    }
    
    // Get the buttons
    var createButton = document.getElementById('createSquircle');
    var replaceButton = document.getElementById('replaceRectangle');
    var addDeviceButton = document.getElementById('addDevice');
    var addGestureButton = document.getElementById('addGesture');
    var addOverlayButton = document.getElementById('addOverlay');
    var addShimmerButton = document.getElementById('shimmerLayers');
    var addBlurButton = document.getElementById('addBlur');
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
                    
                    // Save accordion states after toggle
                    setTimeout(saveAccordionStates, 100);
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
                                
                                // Reattach handlers and save order after DOM change
                                setTimeout(function() {
                                    attachReorderHandlers();
                                    saveSectionOrder();
                                }, 50);
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
                                
                                // Reattach handlers and save order after DOM change
                                setTimeout(function() {
                                    attachReorderHandlers();
                                    saveSectionOrder();
                                }, 50);
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
    
    // Function to save section order
    function saveSectionOrder() {
        if (csInterface) {
            var container = document.querySelector('.container');
            var sections = Array.from(container.querySelectorAll('.section-container'));
            var sectionOrder = sections.map(function(section) {
                var header = section.querySelector('.section-header h2');
                return header ? header.textContent : '';
            }).join('|');
            
            var script = 'saveSectionOrder(' + JSON.stringify(sectionOrder) + ')';
            csInterface.evalScript(script, function(result) {
                console.log('Section order saved:', result);
            });
        }
    }
    
    // Function to load section order on startup
    function loadSectionOrder() {
        if (csInterface) {
            var script = 'loadSectionOrder()';
            csInterface.evalScript(script, function(result) {
                if (result && result.length > 0) {
                    applySectionOrder(result);
                    console.log('Loaded section order:', result);
                } else {
                    // Apply default section order if no saved order exists
                    var defaultOrder = 'Device Templates|Gestures|Presets|Keyframe Reader|Components|Project Setup';
                    applySectionOrder(defaultOrder);
                    console.log('Applied default section order:', defaultOrder);
                }
            });
        }
    }
    
    // Function to apply saved section order
    function applySectionOrder(orderString) {
        var container = document.querySelector('.container');
        var sections = Array.from(container.querySelectorAll('.section-container'));
        var orderArray = orderString.split('|');
        
        // Create a map of section titles to section elements
        var sectionMap = {};
        sections.forEach(function(section) {
            var header = section.querySelector('.section-header h2');
            if (header) {
                sectionMap[header.textContent] = section;
            }
        });
        
        // Reorder sections according to saved order
        orderArray.forEach(function(title, index) {
            var section = sectionMap[title];
            if (section) {
                container.appendChild(section);
            }
        });
    }
    
    // Function to save accordion states
    function saveAccordionStates() {
        if (csInterface) {
            var sections = document.querySelectorAll('.section');
            var states = [];
            
            sections.forEach(function(section) {
                var header = section.querySelector('.section-header h2');
                var isCollapsed = section.classList.contains('collapsed');
                if (header) {
                    states.push(header.textContent + ':' + (isCollapsed ? 'collapsed' : 'expanded'));
                }
            });
            
            var statesString = states.join('|');
            var script = 'saveAccordionStates(' + JSON.stringify(statesString) + ')';
            csInterface.evalScript(script, function(result) {
                console.log('Accordion states saved:', result);
            });
        }
    }
    
    // Function to load accordion states on startup
    function loadAccordionStates() {
        if (csInterface) {
            var script = 'loadAccordionStates()';
            csInterface.evalScript(script, function(result) {
                if (result && result.length > 0) {
                    applyAccordionStates(result);
                    console.log('Loaded accordion states:', result);
                }
            });
        }
    }
    
    // Function to apply saved accordion states
    function applyAccordionStates(statesString) {
        var states = statesString.split('|');
        var stateMap = {};
        
        states.forEach(function(state) {
            var parts = state.split(':');
            if (parts.length === 2) {
                stateMap[parts[0]] = parts[1] === 'collapsed';
            }
        });
        
        var sections = document.querySelectorAll('.section');
        sections.forEach(function(section) {
            var header = section.querySelector('.section-header h2');
            if (header && stateMap.hasOwnProperty(header.textContent)) {
                var shouldBeCollapsed = stateMap[header.textContent];
                var content = section.querySelector('.section-content');
                var toggle = section.querySelector('.accordion-toggle');
                
                if (shouldBeCollapsed) {
                    content.classList.add('collapsed');
                    section.classList.add('collapsed');
                    toggle.classList.add('collapsed');
                } else {
                    content.classList.remove('collapsed');
                    section.classList.remove('collapsed');
                    toggle.classList.remove('collapsed');
                }
            }
        });
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
    var durationIncrementBtn = document.getElementById('durationIncrementBtn');
    var durationDecrementBtn = document.getElementById('durationDecrementBtn');
    
    // Delay +/- buttons
    var delayIncrementBtn = document.getElementById('delayIncrementBtn');
    var delayDecrementBtn = document.getElementById('delayDecrementBtn');
    
    if (durationIncrementBtn && durationDecrementBtn) {
        // + button: Stretch keyframes forward by 3 frames OR multi-property duration by 50ms
        durationIncrementBtn.addEventListener('click', function() {
            console.log('Duration increment (stretch forward) clicked');
            
            // Check if CSInterface is available
            if (!csInterface) {
                console.log('CSInterface not available');
                return;
            }
            
            // Disable button while working
            durationIncrementBtn.disabled = true;
            
            // Check the stored cross-property mode flag to determine which function to call
            var isMultiPropertyMode = window.lastReadKeyframesWasCrossProperty || false;
            var scriptFunction = isMultiPropertyMode ? 'stretchMultiPropertyDurationForward()' : 'stretchKeyframesForward()';
            
            console.log('Calling script function:', scriptFunction);
            
            // Call the appropriate ExtendScript function
            csInterface.evalScript(scriptFunction, function(result) {
                console.log('Stretch forward result:', result);
                
                // Re-enable button
                durationIncrementBtn.disabled = false;
                
                // Update display if successful
                if (result && result.indexOf('|') !== -1) {
                    var parts = result.split('|');
                    var status = parts[0];
                    
                    if (status === 'success') {
                        // Check if this was a multi-property call
                        if (scriptFunction.indexOf('Multi') !== -1) {
                            // Multi-property operation completed - re-read keyframes to get updated values
                            console.log('Multi-property operation completed, re-reading keyframes...');
                            csInterface.evalScript('readKeyframesSmart()', function(readResult) {
                                if (readResult && readResult.indexOf('success|') === 0) {
                                    var readParts = readResult.split('|');
                                    var isCrossPropertyMode = readParts[readParts.length - 1] === '1';
                                    
                                    var durationMs, durationFrames;
                                    if (isCrossPropertyMode) {
                                        durationMs = parseInt(readParts[3]);
                                        durationFrames = parseInt(readParts[4]);
                                    } else {
                                        durationMs = parseInt(readParts[1]);
                                        durationFrames = parseInt(readParts[2]);
                                    }
                                    
                                    // Update duration display with actual new values
                                    if (isCrossPropertyMode) {
                                        if (durationMs === -1) {
                                            durationText.textContent = 'Duration: Multiple';
                                        } else {
                                            durationText.textContent = 'Duration: ' + durationMs + 'ms / ' + durationFrames + 'f';
                                        }
                                    } else {
                                        durationText.textContent = 'Duration: ' + durationMs + 'ms / ' + durationFrames + 'f';
                                    }
                                    durationText.style.opacity = '1';
                                    console.log('Updated duration to:', durationMs + 'ms /', durationFrames + 'f');
                                }
                            });
                        } else {
                            // Single-property operation - parse result directly
                            var durationMs = parseInt(parts[1]);
                            var durationFrames = parseInt(parts[2]);
                            
                            durationText.textContent = 'Duration: ' + durationMs + 'ms / ' + durationFrames + 'f';
                            durationText.style.opacity = '1';
                            console.log('Updated duration to:', durationMs + 'ms /', durationFrames + 'f');
                        }
                    } else if (status === 'error') {
                        var errorMsg = parts[1] || 'Unknown error';
                        console.log('Stretch error:', errorMsg);
                        
                        // Show error briefly, then revert to selection message
                        durationText.textContent = 'Select > 1 Keyframe';
                        durationText.style.opacity = '1';
                    }
                } else {
                    durationText.textContent = 'Select > 1 Keyframe';
                    durationText.style.opacity = '1';
                    console.log('Unexpected result:', result);
                }
            });
        });
        
        // - button: Shrink keyframes backward by 3 frames OR multi-property duration by 50ms
        durationDecrementBtn.addEventListener('click', function() {
            console.log('Duration decrement (stretch backward) clicked');
            
            // Check if CSInterface is available
            if (!csInterface) {
                console.log('CSInterface not available');
                return;
            }
            
            // Disable button while working
            durationDecrementBtn.disabled = true;
            
            // Check the stored cross-property mode flag to determine which function to call
            var isMultiPropertyMode = window.lastReadKeyframesWasCrossProperty || false;
            var scriptFunction = isMultiPropertyMode ? 'stretchMultiPropertyDurationBackward()' : 'stretchKeyframesBackward()';
            
            console.log('Calling script function:', scriptFunction);
            
            // Call the appropriate ExtendScript function
            csInterface.evalScript(scriptFunction, function(result) {
                console.log('Stretch backward result:', result);
                
                // Re-enable button
                durationDecrementBtn.disabled = false;
                
                // Update display if successful
                if (result && result.indexOf('|') !== -1) {
                    var parts = result.split('|');
                    var status = parts[0];
                    
                    if (status === 'success') {
                        // Check if this was a multi-property call
                        if (scriptFunction.indexOf('Multi') !== -1) {
                            // Multi-property operation completed - re-read keyframes to get updated values
                            console.log('Multi-property operation completed, re-reading keyframes...');
                            csInterface.evalScript('readKeyframesSmart()', function(readResult) {
                                if (readResult && readResult.indexOf('success|') === 0) {
                                    var readParts = readResult.split('|');
                                    var isCrossPropertyMode = readParts[readParts.length - 1] === '1';
                                    
                                    var durationMs, durationFrames;
                                    if (isCrossPropertyMode) {
                                        durationMs = parseInt(readParts[3]);
                                        durationFrames = parseInt(readParts[4]);
                                    } else {
                                        durationMs = parseInt(readParts[1]);
                                        durationFrames = parseInt(readParts[2]);
                                    }
                                    
                                    // Update duration display with actual new values
                                    if (isCrossPropertyMode) {
                                        if (durationMs === -1) {
                                            durationText.textContent = 'Duration: Multiple';
                                        } else {
                                            durationText.textContent = 'Duration: ' + durationMs + 'ms / ' + durationFrames + 'f';
                                        }
                                    } else {
                                        durationText.textContent = 'Duration: ' + durationMs + 'ms / ' + durationFrames + 'f';
                                    }
                                    durationText.style.opacity = '1';
                                    console.log('Updated duration to:', durationMs + 'ms /', durationFrames + 'f');
                                }
                            });
                        } else {
                            // Single-property operation - parse result directly
                            var durationMs = parseInt(parts[1]);
                            var durationFrames = parseInt(parts[2]);
                            
                            durationText.textContent = 'Duration: ' + durationMs + 'ms / ' + durationFrames + 'f';
                            durationText.style.opacity = '1';
                            console.log('Updated duration to:', durationMs + 'ms /', durationFrames + 'f');
                        }
                    } else if (status === 'error') {
                        var errorMsg = parts[1] || 'Unknown error';
                        console.log('Shrink error:', errorMsg);
                        
                        // Show error briefly, then revert to selection message
                        durationText.textContent = 'Select > 1 Keyframe';
                        durationText.style.opacity = '1';
                    }
                } else {
                    durationText.textContent = 'Select > 1 Keyframe';
                    durationText.style.opacity = '1';
                    console.log('Unexpected result:', result);
                }
            });
        });
    }
    
    // Delay +/- buttons - call delay nudging functions directly
    if (delayIncrementBtn && delayDecrementBtn) {
        delayIncrementBtn.addEventListener('click', function() {
            console.log('Delay increment (nudge forward) clicked');
            
            if (!csInterface) {
                console.log('CSInterface not available');
                return;
            }
            
            delayIncrementBtn.disabled = true;
            
            csInterface.evalScript('nudgeDelayForward()', function(result) {
                console.log('Delay nudge forward result:', result);
                
                delayIncrementBtn.disabled = false;
                
                if (result && result.indexOf('|') !== -1) {
                    var parts = result.split('|');
                    var status = parts[0];
                    
                    if (status === 'success') {
                        var delayMs = parseInt(parts[1]);
                        var delayFrames = parseInt(parts[2]);
                        
                        // Update delay display
                        var delayText = document.getElementById('delayText');
                        if (delayMs === -1) {
                            delayText.textContent = 'Delay: Multiple';
                        } else {
                            delayText.textContent = 'Delay: ' + delayMs + 'ms / ' + delayFrames + 'f';
                        }
                        delayText.style.opacity = '1';
                        
                        console.log('Updated delay to:', delayMs + 'ms /', delayFrames + 'f');
                    } else if (status === 'error') {
                        // Use consistent error message for delay buttons
                        var delayText = document.getElementById('delayText');
                        delayText.textContent = 'Select > 1 Keyframe';
                        delayText.style.opacity = '1';
                    }
                } else {
                    // Unexpected result format
                    var delayText = document.getElementById('delayText');
                    delayText.textContent = 'Select > 1 Keyframe';
                    delayText.style.opacity = '1';
                }
            });
        });
        
        delayDecrementBtn.addEventListener('click', function() {
            console.log('Delay decrement (nudge backward) clicked');
            
            if (!csInterface) {
                console.log('CSInterface not available');
                return;
            }
            
            delayDecrementBtn.disabled = true;
            
            csInterface.evalScript('nudgeDelayBackward()', function(result) {
                console.log('Delay nudge backward result:', result);
                
                delayDecrementBtn.disabled = false;
                
                if (result && result.indexOf('|') !== -1) {
                    var parts = result.split('|');
                    var status = parts[0];
                    
                    if (status === 'success') {
                        var delayMs = parseInt(parts[1]);
                        var delayFrames = parseInt(parts[2]);
                        
                        // Update delay display
                        var delayText = document.getElementById('delayText');
                        if (delayMs === -1) {
                            delayText.textContent = 'Delay: Multiple';
                        } else {
                            delayText.textContent = 'Delay: ' + delayMs + 'ms / ' + delayFrames + 'f';
                        }
                        delayText.style.opacity = '1';
                        
                        console.log('Updated delay to:', delayMs + 'ms /', delayFrames + 'f');
                    } else if (status === 'error') {
                        // Use consistent error message for delay buttons
                        var delayText = document.getElementById('delayText');
                        delayText.textContent = 'Select > 1 Keyframe';
                        delayText.style.opacity = '1';
                    }
                } else {
                    // Unexpected result format
                    var delayText = document.getElementById('delayText');
                    delayText.textContent = 'Select > 1 Keyframe';
                    delayText.style.opacity = '1';
                }
            });
        });
    }
    
    // Read Keyframes button handler
    var readKeyframesButton = document.getElementById('readKeyframes');
    readKeyframesButton.addEventListener('click', function() {
        DEBUG.log('Read Keyframes clicked');
        
        // Reset all displays to default text when starting read operation
        var delayText = document.getElementById('delayText');
        var xDistanceText = document.getElementById('xDistanceText');
        var yDistanceText = document.getElementById('yDistanceText');
        
        durationText.textContent = 'Duration';
        durationText.style.opacity = '0.5';
        delayText.textContent = 'Delay';
        delayText.style.opacity = '0.5';
        xDistanceText.textContent = 'X distance';
        xDistanceText.style.opacity = '0.5';
        yDistanceText.textContent = 'Y distance';
        yDistanceText.style.opacity = '0.5';
        
        // Check if CSInterface is available
        if (!csInterface) {
            durationText.textContent = 'Duration';
            durationText.style.opacity = '0.5';
            delayText.textContent = 'Delay';
            delayText.style.opacity = '0.5';
            xDistanceText.textContent = 'X distance';
            xDistanceText.style.opacity = '0.5';
            yDistanceText.textContent = 'Y distance';
            yDistanceText.style.opacity = '0.5';
            return;
        }
        
        // Call the After Effects script to read keyframe duration
        DEBUG.log('About to call readKeyframesDuration() in After Effects...');
        csInterface.evalScript('readKeyframesSmart()', function(result) {
            DEBUG.log('Got result from After Effects:', result);
            
            if (result && result.indexOf('|') !== -1) {
                var parts = result.split('|');
                var status = parts[0];
                
                if (status === 'error') {
                    var errorMsg = parts[1] || 'Unknown error';
                    
                    // Get all text elements
                    var delayText = document.getElementById('delayText');
                    var xDistanceText = document.getElementById('xDistanceText');
                    var yDistanceText = document.getElementById('yDistanceText');
                    
                    // Simple logic: if error is "Select > 1 Keyframe", show this message in all 4 rows
                    if (errorMsg === 'Select > 1 Keyframe') {
                        // Show "Select > 1 Keyframe" in all 4 rows
                        durationText.textContent = 'Select > 1 Keyframe';
                        durationText.style.opacity = '1';
                        delayText.textContent = 'Select > 1 Keyframe';
                        delayText.style.opacity = '1';
                        xDistanceText.textContent = 'Select > 1 Keyframe';
                        xDistanceText.style.opacity = '1';
                        yDistanceText.textContent = 'Select > 1 Keyframe';
                        yDistanceText.style.opacity = '1';
                    } else {
                        // Other errors: reset to default text
                        durationText.textContent = 'Duration';
                        durationText.style.opacity = '0.5';
                        delayText.textContent = 'Delay';
                        delayText.style.opacity = '0.5';
                        xDistanceText.textContent = 'X distance';
                        xDistanceText.style.opacity = '0.5';
                        yDistanceText.textContent = 'Y distance';
                        yDistanceText.style.opacity = '0.5';
                    }
                    
                    DEBUG.error('Keyframe reading failed:', errorMsg);
                } else if (status === 'success') {
                    // Check if this is cross-property mode first to determine parsing format
                    var isCrossPropertyMode = parts[parts.length - 1] === '1';
                    
                    var delayMs, delayFrames, durationMs, durationFrames;
                    var xDistance, yDistance, hasXDistance, hasYDistance;
                    
                    if (isCrossPropertyMode) {
                        // Cross-property format: success|delayMs|delayFrames|durationMs|durationFrames|1|xDistance|yDistance|hasX|hasY|1
                        delayMs = parseInt(parts[1]);
                        delayFrames = parseInt(parts[2]);
                        durationMs = parseInt(parts[3]);
                        durationFrames = parseInt(parts[4]);
                        xDistance = parts.length > 6 ? parseInt(parts[6]) : 0;
                        yDistance = parts.length > 7 ? parseInt(parts[7]) : 0;
                        hasXDistance = parts.length > 8 ? (parts[8] === '1') : false;
                        hasYDistance = parts.length > 9 ? (parts[9] === '1') : false;
                    } else {
                        // Single-property format: success|durationMs|durationFrames|...|xDistance|yDistance|hasX|hasY|0
                        durationMs = parseInt(parts[1]);
                        durationFrames = parseInt(parts[2]);
                        delayMs = 0; // No delay concept in single-property mode
                        delayFrames = 0;
                        xDistance = parts.length > 6 ? parseInt(parts[6]) : 0;
                        yDistance = parts.length > 7 ? parseInt(parts[7]) : 0;
                        hasXDistance = parts.length > 8 ? (parts[8] === '1') : false;
                        hasYDistance = parts.length > 9 ? (parts[9] === '1') : false;
                    }
                    
                    DEBUG.log('Successfully parsed delay:', delayMs + 'ms, ' + delayFrames + ' frames');
                    DEBUG.log('Successfully parsed duration:', durationMs + 'ms, ' + durationFrames + ' frames');
                    
                    // Store cross-property mode flag for duration buttons to use
                    window.lastReadKeyframesWasCrossProperty = isCrossPropertyMode;
                    
                    // Update displays based on mode
                    var delayText = document.getElementById('delayText');
                    
                    if (isCrossPropertyMode) {
                        // Cross-property mode: show delay info in delay row AND duration info in duration row
                        
                        // Handle duration display
                        if (durationMs === -1) {
                            durationText.textContent = 'Duration: Multiple';
                        } else {
                            durationText.textContent = 'Duration: ' + durationMs + 'ms / ' + durationFrames + 'f';
                        }
                        durationText.style.opacity = '1';
                        
                        // Handle delay display
                        if (delayMs === -1) {
                            delayText.textContent = 'Delay: Multiple';
                        } else if (delayMs === 0) {
                            delayText.textContent = 'Delay: 0ms / 0f';
                        } else {
                            delayText.textContent = 'Delay: ' + delayMs + 'ms / ' + delayFrames + 'f';
                        }
                        delayText.style.opacity = '1';
                        
                        // Store for delay nudging
                        document.getElementById('delayValue').value = delayMs;
                    } else {
                        // Single-property mode: show duration info in duration row
                        delayText.textContent = 'Delay';
                        delayText.style.opacity = '0.5';
                        
                        durationText.textContent = 'Duration: ' + durationMs + 'ms / ' + durationFrames + 'f';
                        durationValue.value = durationMs;
                    }
                    durationText.style.opacity = '1';
                    
                    // Always show all buttons for consistency
                    showDurationButtons();
                    showPositionButtons();
                    
                    // Get current resolution multiplier for scaling
                    var resolutionMultiplier = parseInt(document.getElementById('resolutionMultiplier').value) || 2;
                    
                    // Update X Distance display
                    var xDistanceText = document.getElementById('xDistanceText');
                    if (hasXDistance) {
                        if (xDistance > 0) {
                            var scaledXDistance = parseFloat((xDistance / resolutionMultiplier).toFixed(2));
                            xDistanceText.textContent = 'X: ' + scaledXDistance + 'px @1x';
                            xDistanceText.style.opacity = '1';
                        } else {
                            // Has X position keyframes but no distance change
                            xDistanceText.textContent = 'No change in X position';
                            xDistanceText.style.opacity = '1';
                        }
                    } else {
                        // No X position keyframes selected - return to default text
                        xDistanceText.textContent = 'X distance';
                        xDistanceText.style.opacity = '0.5';
                    }
                    
                    // Update Y Distance display
                    var yDistanceText = document.getElementById('yDistanceText');
                    if (hasYDistance) {
                        if (yDistance > 0) {
                            var scaledYDistance = parseFloat((yDistance / resolutionMultiplier).toFixed(2));
                            yDistanceText.textContent = 'Y: ' + scaledYDistance + 'px @1x';
                            yDistanceText.style.opacity = '1';
                        } else {
                            // Has Y position keyframes but no distance change
                            yDistanceText.textContent = 'No change in Y position';
                            yDistanceText.style.opacity = '1';
                        }
                    } else {
                        // No Y position keyframes selected - return to default text
                        yDistanceText.textContent = 'Y distance';
                        yDistanceText.style.opacity = '0.5';
                    }
                    
                    console.log('Updated duration to:', durationMs + 'ms /', durationFrames + 'f');
                    console.log('X Distance:', hasXDistance ? scaledXDistance + 'px @1x (raw: ' + xDistance + 'px @' + resolutionMultiplier + 'x)' : 'N/A');
                    console.log('Y Distance:', hasYDistance ? scaledYDistance + 'px @1x (raw: ' + yDistance + 'px @' + resolutionMultiplier + 'x)' : 'N/A');
                }
            } else {
                // Reset all displays to default text  
                durationText.textContent = 'Duration';
                durationText.style.opacity = '0.5';
                delayText.textContent = 'Delay';
                delayText.style.opacity = '0.5';
                
                // Reset X and Y distance displays to default text
                xDistanceText.textContent = 'X distance';
                xDistanceText.style.opacity = '0.5';
                yDistanceText.textContent = 'Y distance';
                yDistanceText.style.opacity = '0.5';
                
                console.log('Unexpected result:', result);
            }
        });
    });
    
    // Don't initialize displays on startup - keep default labels
    
    // Distance controls - In/Out toggle functionality
    function setupInOutToggle(inBtnId, outBtnId) {
        var inBtn = document.getElementById(inBtnId);
        var outBtn = document.getElementById(outBtnId);
        
        inBtn.addEventListener('click', function() {
            inBtn.classList.add('selected');
            outBtn.classList.remove('selected');
        });
        
        outBtn.addEventListener('click', function() {
            outBtn.classList.add('selected');
            inBtn.classList.remove('selected');
        });
    }
    
    // Setup toggle functionality for both X and Y distance controls
    setupInOutToggle('xInBtn', 'xOutBtn');
    setupInOutToggle('yInBtn', 'yOutBtn');
    
    // X Distance +/- buttons
    var xIncrementBtn = document.getElementById('xIncrementBtn');
    var xDecrementBtn = document.getElementById('xDecrementBtn');
    
    if (xIncrementBtn && xDecrementBtn) {
        // X + button: Move X position forward by 10px
        xIncrementBtn.addEventListener('click', function() {
            console.log('X Distance increment clicked');
            
            if (!csInterface) {
                console.log('CSInterface not available');
                return;
            }
            
            // Get current In/Out state
            var isInDirection = document.getElementById('xInBtn').classList.contains('selected');
            var direction = isInDirection ? 'in' : 'out';
            
            // Call the ExtendScript function
            csInterface.evalScript('nudgeXPosition(1, "' + direction + '")', function(result) {
                console.log('X nudge forward result:', result);
                
                // Update display based on result
                updateDistanceDisplay('x', result);
            });
        });
        
        // X - button: Move X position backward by 10px
        xDecrementBtn.addEventListener('click', function() {
            console.log('X Distance decrement clicked');
            
            if (!csInterface) {
                console.log('CSInterface not available');
                return;
            }
            
            // Get current In/Out state
            var isInDirection = document.getElementById('xInBtn').classList.contains('selected');
            var direction = isInDirection ? 'in' : 'out';
            
            // Call the ExtendScript function
            csInterface.evalScript('nudgeXPosition(-1, "' + direction + '")', function(result) {
                console.log('X nudge backward result:', result);
                
                // Update display based on result
                updateDistanceDisplay('x', result);
            });
        });
    }
    
    // Y Distance +/- buttons
    var yIncrementBtn = document.getElementById('yIncrementBtn');
    var yDecrementBtn = document.getElementById('yDecrementBtn');
    
    if (yIncrementBtn && yDecrementBtn) {
        // Y + button: Move Y position forward by 10px
        yIncrementBtn.addEventListener('click', function() {
            console.log('Y Distance increment clicked');
            
            if (!csInterface) {
                console.log('CSInterface not available');
                return;
            }
            
            // Get current In/Out state
            var isInDirection = document.getElementById('yInBtn').classList.contains('selected');
            var direction = isInDirection ? 'in' : 'out';
            
            // Call the ExtendScript function
            csInterface.evalScript('nudgeYPosition(1, "' + direction + '")', function(result) {
                console.log('Y nudge forward result:', result);
                
                // Update display based on result
                updateDistanceDisplay('y', result);
            });
        });
        
        // Y - button: Move Y position backward by 10px
        yDecrementBtn.addEventListener('click', function() {
            console.log('Y Distance decrement clicked');
            
            if (!csInterface) {
                console.log('CSInterface not available');
                return;
            }
            
            // Get current In/Out state
            var isInDirection = document.getElementById('yInBtn').classList.contains('selected');
            var direction = isInDirection ? 'in' : 'out';
            
            // Call the ExtendScript function
            csInterface.evalScript('nudgeYPosition(-1, "' + direction + '")', function(result) {
                console.log('Y nudge backward result:', result);
                
                // Update display based on result
                updateDistanceDisplay('y', result);
            });
        });
    }
    
    // Helper function to update distance display after nudging
    function updateDistanceDisplay(axis, result) {
        var textElement = document.getElementById(axis + 'DistanceText');
        
        if (result && result.indexOf('|') !== -1) {
            var parts = result.split('|');
            var status = parts[0];
            
            if (status === 'success') {
                var distance = parseFloat(parts[1]);
                var hasDistance = parts[2] === '1';
                
                // Get current resolution multiplier for scaling display
                var resolutionMultiplier = parseInt(document.getElementById('resolutionMultiplier').value) || 2;
                
                if (hasDistance && distance > 0) {
                    var scaledDistance = parseFloat((distance / resolutionMultiplier).toFixed(2));
                    textElement.textContent = axis.toUpperCase() + ': ' + scaledDistance + 'px @1x';
                    textElement.style.opacity = '1';
                } else {
                    textElement.textContent = 'Select > 1 Keyframe';
                    textElement.style.opacity = '1';
                }
            } else if (status === 'error') {
                // Use consistent error message for all distance buttons
                textElement.textContent = 'Select > 1 Keyframe';
                textElement.style.opacity = '1';
            }
        } else {
            textElement.textContent = 'Select > 1 Keyframe';
            textElement.style.opacity = '1';
        }
    }
    
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
    
    // Add Overlay button handler
    addOverlayButton.addEventListener('click', function() {
        console.log('Add Overlay clicked');
        
        // Disable button while working
        addOverlayButton.disabled = true;
        addOverlayButton.textContent = 'Adding...';
        
        // Call the After Effects script to add shimmer
        csInterface.evalScript('addShimmerFromPanel()', function(result) {
            console.log('Shimmer result:', result);
            // Re-enable button
            addOverlayButton.disabled = false;
            addOverlayButton.textContent = 'Add Overlay';
        });
    });
    
    // Add Shimmer button handler
    addShimmerButton.addEventListener('click', function() {
        console.log('Add Shimmer clicked');
        
        // Disable button while working
        addShimmerButton.disabled = true;
        addShimmerButton.textContent = 'Adding...';
        
        // Call the After Effects script to add shimmer effect
        csInterface.evalScript('addShimmerEffectFromPanel()', function(result) {
            console.log('Shimmer effect result:', result);
            // Re-enable button
            addShimmerButton.disabled = false;
            addShimmerButton.textContent = 'Add Shimmer';
        });
    });
    
    // Add Blur button handler
    addBlurButton.addEventListener('click', function() {
        console.log('Add Blur clicked');
        
        // Get selected material type
        var materialType = document.getElementById('materialType').value;
        
        console.log('Material Type:', materialType);
        
        // Disable button while working
        addBlurButton.disabled = true;
        addBlurButton.textContent = 'Adding...';
        
        // Pass the extension path to the JSX
        var setPathScript = 'var extensionRoot = "' + extensionPath.replace(/\\/g, '\\\\') + '";';
        csInterface.evalScript(setPathScript);
        
        // Call the After Effects script to add material blur
        var script = 'addBlurFromPanel("' + materialType + '")';
        console.log('Executing script:', script);
        
        csInterface.evalScript(script, function(result) {
            console.log('Material blur result:', result);
            
            // Parse debug info from result and show in debug panel
            if (result && result.indexOf('|') > -1) {
                var parts = result.split('|');
                var status = parts[0];
                var debugInfo = parts.slice(1);
                
                // Show debug info in the debug panel
                var debugPanel = document.getElementById('debugPanel');
                if (debugPanel) {
                    debugPanel.style.display = 'block';
                    var debugContent = document.getElementById('debugContent');
                    if (debugContent) {
                        debugContent.innerHTML = '<h3>=== MATERIAL EFFECT DEBUG INFO ===</h3>';
                        for (var i = 0; i < debugInfo.length; i++) {
                            debugContent.innerHTML += '<div>' + debugInfo[i] + '</div>';
                        }
                    }
                }
                
                // Also log to console for backup
                console.log('=== MATERIAL EFFECT DEBUG INFO ===');
                for (var i = 0; i < debugInfo.length; i++) {
                    console.log(debugInfo[i]);
                }
            }
            
            // Re-enable button
            addBlurButton.disabled = false;
            addBlurButton.textContent = 'Add Blur';
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
            
            // Parse debug information and show in debug panel
            if (result && result.indexOf('|') > -1) {
                var parts = result.split('|');
                var debugInfo = parts.slice(1);
                
                // Show debug info in the debug panel
                var debugPanel = document.getElementById('debugPanel');
                if (debugPanel) {
                    debugPanel.style.display = 'block';
                    var debugContent = document.getElementById('debugContent');
                    if (debugContent) {
                        debugContent.innerHTML = '<h3>=== SHADOW DEBUG INFO ===</h3>';
                        for (var i = 0; i < debugInfo.length; i++) {
                            debugContent.innerHTML += '<div>' + debugInfo[i] + '</div>';
                        }
                    }
                }
                
                // Also log to console for backup
                console.log('=== SHADOW DEBUG INFO ===');
                for (var i = 0; i < debugInfo.length; i++) {
                    console.log(debugInfo[i]);
                }
            }
            
            // Re-enable button
            addShadowButton.disabled = false;
        });
    });
    
    
    // Load saved preferences on startup
    loadResolutionPreference();
    
    // Load section preferences after a brief delay to ensure DOM is ready
    setTimeout(function() {
        loadSectionOrder();
        setTimeout(loadAccordionStates, 100);
    }, 200);
    
    
    // Set up the panel theme to match After Effects
    csInterface.setBackgroundColor(38, 38, 38); // Dark gray background
    
});