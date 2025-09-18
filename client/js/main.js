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
        width: 280px;
        background: #1a1a1a;
        border: 2px solid #f39c12;
        border-radius: 6px;
        padding: 8px;
        font-size: 10px;
        color: #ccc;
        z-index: 1000;
        max-height: 150px;
        overflow-y: auto;
        user-select: text;
        -webkit-user-select: text;
        -moz-user-select: text;
        font-family: monospace;
    `;
    
    debugPanel.innerHTML = `
        <div style="font-weight: bold; margin-bottom: 5px; user-select: none; color: #f39c12;">
            🎯 Stagger Bug Debug
        </div>
        <div style="font-size: 8px; color: #888; margin-bottom: 5px; user-select: none;">
            Showing: IRREGULAR SNAP, SNAP RESULT, FINAL RESULT
        </div>
        <div id="debug-log" style="
            user-select: text; 
            -webkit-user-select: text; 
            -moz-user-select: text;
            font-family: monospace;
            font-size: 9px;
            line-height: 1.2;
        "></div>
        <div style="margin-top: 6px; user-select: none;">
            <button onclick="document.getElementById('debug-log').innerHTML = ''" style="
                background: #444; 
                border: 1px solid #666; 
                color: #ccc; 
                padding: 2px 6px; 
                border-radius: 3px; 
                font-size: 8px;
                margin-right: 4px;
                cursor: pointer;
            ">Clear</button>
            <button onclick="navigator.clipboard && navigator.clipboard.writeText(document.getElementById('debug-log').innerText)" style="
                background: #444; 
                border: 1px solid #666; 
                color: #ccc; 
                padding: 2px 6px; 
                border-radius: 3px; 
                font-size: 8px;
                margin-right: 4px;
                cursor: pointer;
            ">Copy</button>
            <button onclick="document.getElementById('debug-panel').remove()" style="
                background: #666; 
                border: 1px solid #888; 
                color: white; 
                padding: 2px 6px; 
                border-radius: 3px; 
                font-size: 8px;
                cursor: pointer;
            ">Close</button>
        </div>
    `;
    
    document.body.appendChild(debugPanel);
    
    // Redirect console.log to debug panel - FILTERED for stagger debugging
    const originalLog = console.log;
    console.log = (...args) => {
        originalLog(...args);
        const message = args.join(' ');
        
        // Only show specific stagger debug messages
        const staggerKeywords = [
            '🎯 IRREGULAR SNAP:',
            '🎯 SNAP RESULT DEBUG:',
            '🎯 FINAL RESULT DEBUG:',
            '🎯 IRREGULAR LAYER FIX:',
            '🎯 REVERSE DIRECTION:',
            'Applied stagger to',
            'Smart snapping direction:'
        ];
        
        const isStaggerDebug = staggerKeywords.some(keyword => message.includes(keyword));
        
        if (isStaggerDebug) {
            const logDiv = document.getElementById('debug-log');
            if (logDiv) {
                // Color-code different message types
                let color = '#ccc';
                if (message.includes('🎯 IRREGULAR SNAP:')) color = '#e74c3c';
                if (message.includes('🎯 SNAP RESULT DEBUG:')) color = '#f39c12';
                if (message.includes('🎯 FINAL RESULT DEBUG:')) color = '#2ecc71';
                if (message.includes('🎯 IRREGULAR LAYER FIX:')) color = '#9b59b6';
                if (message.includes('Applied stagger to')) color = '#3498db';
                
                logDiv.innerHTML += `<div style="
                    margin: 1px 0; 
                    font-size: 9px; 
                    padding: 1px 0;
                    user-select: text;
                    -webkit-user-select: text;
                    word-wrap: break-word;
                    color: ${color};
                ">${message}</div>`;
                logDiv.scrollTop = logDiv.scrollHeight;
            }
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
    var addSquircleButton = document.getElementById('addSquircle');
    var squircleModeDropdown = document.getElementById('squircleMode');
    var addNullButton = document.getElementById('addNull');
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
        resolutionText.textContent = 'Resolution: ' + currentValue + 'x';
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
    
    // Duration +/- buttons - stretch keyframes with dynamic frame values
    var durationInputField = document.getElementById('durationInput');
    if (durationIncrementBtn && durationDecrementBtn && durationInputField) {
        // Create tooltip for duration input
        createTooltip(durationInputField, 'Frames');
        
        durationIncrementBtn.addEventListener('click', function() {
            console.log('Duration increment (stretch forward) clicked');
            
            if (!csInterface) {
                console.log('CSInterface not available');
                return;
            }
            
            // Get duration frames from input field
            var durationFrames = parseFloat(durationInputField.value) || 3;
            console.log('Applying +' + durationFrames + ' frame duration stretch');
            
            durationIncrementBtn.disabled = true;
            
            // Call the frame-based function that maintains selection and uses dynamic input
            var script = 'stretchKeyframesWithFrames(1, ' + durationFrames + ')';
            csInterface.evalScript(script, function(result) {
                console.log('Duration stretch forward result:', result);
                
                durationIncrementBtn.disabled = false;
                
                if (result && result.indexOf('|') !== -1) {
                    var parts = result.split('|');
                    var status = parts[0];
                    
                    // Extract debug messages (starting from index 3)
                    var debugMessages = [];
                    for (var i = 3; i < parts.length; i++) {
                        if (parts[i] && parts[i].trim()) {
                            debugMessages.push(parts[i]);
                        }
                    }
                    
                    // Display debug messages in panel
                    if (debugMessages.length > 0) {
                        var debugLog = document.getElementById('debug-log');
                        if (debugLog) {
                            debugLog.innerHTML += '<div style="margin: 4px 0; color: #4a9eff; font-weight: bold;">🎬 Duration Stretch Forward:</div>';
                            for (var j = 0; j < debugMessages.length; j++) {
                                debugLog.innerHTML += '<div style="margin: 1px 0; font-size: 9px; color: #ccc;">' + debugMessages[j] + '</div>';
                            }
                            debugLog.scrollTop = debugLog.scrollHeight;
                        }
                    }
                    
                    if (status === 'success') {
                        var durationMs = parseInt(parts[1]);
                        var durationFrames = parseInt(parts[2]);
                        
                        // Update duration display
                        var durationText = document.getElementById('durationText');
                        if (durationMs === -1) {
                            durationText.innerHTML = 'Duration: <span style="opacity: 0.75;">Multiple</span>';
                        } else {
                            durationText.innerHTML = 'Duration: <span style="opacity: 0.75;">' + durationMs + 'ms / ' + durationFrames + 'f</span>';
                        }
                        durationText.style.opacity = '1';
                        
                        console.log('Updated duration to:', durationMs + 'ms /', durationFrames + 'f');
                    } else if (status === 'error') {
                        var errorMsg = parts[1] || 'Unknown error';
                        var durationText = document.getElementById('durationText');
                        
                        if (errorMsg === 'Select > 1 Key') {
                            durationText.innerHTML = 'Duration: <span style="opacity: 0.75;">Select > 1 Key</span>';
                        } else {
                            durationText.innerHTML = 'Duration: <span style="opacity: 0.75;">0ms / 0f</span>';
                        }
                        durationText.style.opacity = '1';
                    }
                } else {
                    // Unexpected result format
                    var durationText = document.getElementById('durationText');
                    durationText.innerHTML = 'Duration: <span style="opacity: 0.75;">Select > 1 Key</span>';
                    durationText.style.opacity = '1';
                }
            });
        });
        
        durationDecrementBtn.addEventListener('click', function() {
            console.log('Duration decrement (stretch backward) clicked');
            
            if (!csInterface) {
                console.log('CSInterface not available');
                return;
            }
            
            // Get duration frames from input field
            var durationFrames = parseFloat(durationInputField.value) || 3;
            console.log('Applying -' + durationFrames + ' frame duration stretch');
            
            durationDecrementBtn.disabled = true;
            
            // Call the frame-based function that maintains selection and uses dynamic input
            var script = 'stretchKeyframesWithFrames(-1, ' + durationFrames + ')';
            csInterface.evalScript(script, function(result) {
                console.log('Duration stretch backward result:', result);
                
                durationDecrementBtn.disabled = false;
                
                if (result && result.indexOf('|') !== -1) {
                    var parts = result.split('|');
                    var status = parts[0];
                    
                    // Extract debug messages (starting from index 3)
                    var debugMessages = [];
                    for (var i = 3; i < parts.length; i++) {
                        if (parts[i] && parts[i].trim()) {
                            debugMessages.push(parts[i]);
                        }
                    }
                    
                    // Display debug messages in panel
                    if (debugMessages.length > 0) {
                        var debugLog = document.getElementById('debug-log');
                        if (debugLog) {
                            debugLog.innerHTML += '<div style="margin: 4px 0; color: #4a9eff; font-weight: bold;">🎬 Duration Stretch Backward:</div>';
                            for (var j = 0; j < debugMessages.length; j++) {
                                debugLog.innerHTML += '<div style="margin: 1px 0; font-size: 9px; color: #ccc;">' + debugMessages[j] + '</div>';
                            }
                            debugLog.scrollTop = debugLog.scrollHeight;
                        }
                    }
                    
                    if (status === 'success') {
                        var durationMs = parseInt(parts[1]);
                        var durationFrames = parseInt(parts[2]);
                        
                        // Update duration display
                        var durationText = document.getElementById('durationText');
                        if (durationMs === -1) {
                            durationText.innerHTML = 'Duration: <span style="opacity: 0.75;">Multiple</span>';
                        } else {
                            durationText.innerHTML = 'Duration: <span style="opacity: 0.75;">' + durationMs + 'ms / ' + durationFrames + 'f</span>';
                        }
                        durationText.style.opacity = '1';
                        
                        console.log('Updated duration to:', durationMs + 'ms /', durationFrames + 'f');
                    } else if (status === 'error') {
                        var errorMsg = parts[1] || 'Unknown error';
                        var durationText = document.getElementById('durationText');
                        
                        if (errorMsg === 'Select > 1 Key') {
                            durationText.innerHTML = 'Duration: <span style="opacity: 0.75;">Select > 1 Key</span>';
                        } else {
                            durationText.innerHTML = 'Duration: <span style="opacity: 0.75;">0ms / 0f</span>';
                        }
                        durationText.style.opacity = '1';
                    }
                } else {
                    // Unexpected result format
                    var durationText = document.getElementById('durationText');
                    durationText.innerHTML = 'Duration: <span style="opacity: 0.75;">Select > 1 Key</span>';
                    durationText.style.opacity = '1';
                }
            });
        });
    }
    
    // Delay +/- buttons - call delay nudging functions with dynamic frame values
    var delayInputField = document.getElementById('delayInput');
    if (delayIncrementBtn && delayDecrementBtn && delayInputField) {
        // Create tooltip for delay input
        createTooltip(delayInputField, 'Frames');
        
        delayIncrementBtn.addEventListener('click', function(event) {
            var isShiftHeld = event.shiftKey;
            console.log('Delay increment (nudge forward) clicked' + (isShiftHeld ? ' [SHIFT - Baseline Mode]' : ' [Normal - Timeline Mode]'));
            
            if (!csInterface) {
                console.log('CSInterface not available');
                return;
            }
            
            // Get delay frames from input field
            var delayFrames = parseFloat(delayInputField.value) || 3;
            console.log('Applying +' + delayFrames + ' frame delay nudge' + (isShiftHeld ? ' (baseline mode - baseline stays fixed)' : ' (timeline mode - all keyframes move)'));
            
            delayIncrementBtn.disabled = true;
            
            // Choose function based on shift key (SWAPPED: normal = timeline, shift = baseline)
            var script = isShiftHeld 
                ? 'nudgeDelayWithFrames(1, ' + delayFrames + ')'   // SHIFT: Baseline mode - respect baseline
                : 'nudgeDelayTimelineMode(1, ' + delayFrames + ')';  // NORMAL: Timeline mode - move all keyframes
            
            csInterface.evalScript(script, function(result) {
                console.log('Delay nudge forward result' + (isShiftHeld ? ' [BASELINE MODE]' : ' [TIMELINE MODE]') + ':', result);
                handleDelayResult(result, delayIncrementBtn);
            });
        });
        
        // Helper function to handle delay result processing
        function handleDelayResult(result, button) {
            button.disabled = false;
            
            if (result && result.indexOf('|') !== -1) {
                var parts = result.split('|');
                var status = parts[0];
                
                // Extract debug messages if present (starting from index 4)
                var debugMessages = [];
                if (parts.length > 4) {
                    debugMessages = parts.slice(4);
                }
                
                // Display debug messages in panel if available
                if (debugMessages.length > 0) {
                    var debugLog = document.getElementById('debug-log');
                    if (debugLog) {
                        debugLog.innerHTML += '<div style="margin: 4px 0; color: #4aff9e; font-weight: bold;">🎬 Global Delay Debug:</div>';
                        for (var j = 0; j < debugMessages.length; j++) {
                            debugLog.innerHTML += '<div style="margin: 1px 0; font-size: 9px; color: #ccc;">' + debugMessages[j] + '</div>';
                        }
                        debugLog.scrollTop = debugLog.scrollHeight;
                    }
                }
                
                if (status === 'success') {
                    var delayMs = parseInt(parts[1]);
                    var delayFrames = parseInt(parts[2]);
                    
                    // Update delay display
                    var delayText = document.getElementById('delayText');
                    
                    if (delayMs === -1) {
                        delayText.innerHTML = 'Delay: <span style="opacity: 0.75;">Multiple</span>';
                    } else {
                        delayText.innerHTML = 'Delay: <span style="opacity: 0.75;">' + delayMs + 'ms / ' + delayFrames + 'f</span>';
                    }
                    delayText.style.opacity = '1';
                    
                    console.log('Updated delay to:', delayMs + 'ms /', delayFrames + 'f');
                } else if (status === 'error') {
                    // Use consistent error message for delay buttons
                    var delayText = document.getElementById('delayText');
                    delayText.innerHTML = 'Delay: <span style="opacity: 0.75;">0ms / 0f</span>';
                    delayText.style.opacity = '1';
                    console.error('Delay error:', parts[1] || 'Unknown error');
                }
            } else {
                // Unexpected result format
                var delayText = document.getElementById('delayText');
                delayText.innerHTML = 'Delay: <span style="opacity: 0.75;">0ms / 0f</span>';
                delayText.style.opacity = '1';
            }
        }
        
        delayDecrementBtn.addEventListener('click', function(event) {
            var isShiftHeld = event.shiftKey;
            console.log('Delay decrement (nudge backward) clicked' + (isShiftHeld ? ' [SHIFT - Baseline Mode]' : ' [Normal - Timeline Mode]'));
            
            if (!csInterface) {
                console.log('CSInterface not available');
                return;
            }
            
            // Get delay frames from input field
            var delayFrames = parseFloat(delayInputField.value) || 3;
            console.log('Applying -' + delayFrames + ' frame delay nudge' + (isShiftHeld ? ' (baseline mode - baseline stays fixed)' : ' (timeline mode - all keyframes move)'));
            
            delayDecrementBtn.disabled = true;
            
            // Choose function based on shift key (SWAPPED: normal = timeline, shift = baseline)
            var script = isShiftHeld 
                ? 'nudgeDelayWithFrames(-1, ' + delayFrames + ')'   // SHIFT: Baseline mode - respect baseline
                : 'nudgeDelayTimelineMode(-1, ' + delayFrames + ')';  // NORMAL: Timeline mode - move all keyframes
            
            csInterface.evalScript(script, function(result) {
                console.log('Delay nudge backward result' + (isShiftHeld ? ' [BASELINE MODE]' : ' [TIMELINE MODE]') + ':', result);
                handleDelayResult(result, delayDecrementBtn);
            });
        });
    }
    
    // Helper function for automatic keyframe reading after stagger operations
    function handleReadKeyframes() {
        DEBUG.log('handleReadKeyframes called - ENTRY POINT');
        console.trace('Call stack for handleReadKeyframes');
        
        // Reset all displays to default text when starting read operation
        var durationText = document.getElementById('durationText');
        var delayText = document.getElementById('delayText');
        var xDistanceText = document.getElementById('xDistanceText');
        var yDistanceText = document.getElementById('yDistanceText');
        var staggerText = document.getElementById('staggerText');
        
        // Reset all displays to default text when starting read operation
        durationText.textContent = 'Duration';
        durationText.style.opacity = '0.75';
        delayText.textContent = 'Delay';
        delayText.style.opacity = '0.75';
        xDistanceText.textContent = 'X distance';
        xDistanceText.style.opacity = '0.75';
        yDistanceText.textContent = 'Y distance';
        yDistanceText.style.opacity = '0.75';
        staggerText.textContent = 'Stagger';
        staggerText.style.opacity = '0.75';
        
        // Reset cumulative stagger counter
        cumulativeStaggerFrames = 0;
        
        // Check if CSInterface is available
        if (!csInterface) {
            durationText.textContent = 'Duration';
            durationText.style.opacity = '0.75';
            delayText.textContent = 'Delay';
            delayText.style.opacity = '0.75';
            xDistanceText.textContent = 'X distance';
            xDistanceText.style.opacity = '0.75';
            yDistanceText.textContent = 'Y distance';
            yDistanceText.style.opacity = '0.75';
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
                    
                    // Show 0 values for any error
                    if (errorMsg === 'Select > 1 Key') {
                        // Show 0 values in all rows
                        durationText.innerHTML = 'Duration: <span style="opacity: 0.75;">0ms / 0f</span>';
                        durationText.style.opacity = '1';
                        delayText.innerHTML = 'Delay: <span style="opacity: 0.75;">0ms / 0f</span>';
                        delayText.style.opacity = '1';
                        var staggerTextElement = document.getElementById('staggerText');
                        if (staggerTextElement) {
                            staggerTextElement.innerHTML = 'Stagger: <span style="opacity: 0.75;">0ms / 0f</span>';
                            staggerTextElement.style.opacity = '1';
                        }
                        xDistanceText.innerHTML = 'X: <span style="opacity: 0.75;">0px @1x</span>';
                        xDistanceText.style.opacity = '1';
                        yDistanceText.innerHTML = 'Y: <span style="opacity: 0.75;">0px @1x</span>';
                        yDistanceText.style.opacity = '1';
                    } else {
                        // Other errors: reset to default text
                        durationText.textContent = 'Duration';
                        durationText.style.opacity = '0.75';
                        delayText.textContent = 'Delay';
                        delayText.style.opacity = '0.75';
                        var staggerTextElement = document.getElementById('staggerText');
                        if (staggerTextElement) {
                            staggerTextElement.textContent = 'Stagger';
                            staggerTextElement.style.opacity = '0.75';
                        }
                        cumulativeStaggerFrames = 0; // Reset counter without changing display
                        xDistanceText.textContent = 'X distance';
                        xDistanceText.style.opacity = '0.75';
                        yDistanceText.textContent = 'Y distance';
                        yDistanceText.style.opacity = '0.75';
                    }
                    
                    DEBUG.error('Keyframe reading failed:', errorMsg);
                } else if (status === 'success') {
                    // Check if this is cross-property mode first to determine parsing format
                    // Cross-property flag is at index 10: success|delay|delayF|dur|durF|1|x|y|hasX|hasY|FLAG|stagger|debug
                    var isCrossPropertyMode = parts.length > 10 && parts[10] === '1';
                    DEBUG.log('Cross-property mode detection: parts[10]=' + parts[10] + ', isCrossPropertyMode=' + isCrossPropertyMode);
                    
                    var delayMs, delayFrames, durationMs, durationFrames;
                    var xDistance, yDistance, hasXDistance, hasYDistance;
                    var staggerText = "Stagger";
                    
                    if (isCrossPropertyMode) {
                        // Cross-property format: success|delayMs|delayFrames|durationMs|durationFrames|1|xDistance|yDistance|hasX|hasY|1|stagger
                        delayMs = parseInt(parts[1]);
                        delayFrames = parseInt(parts[2]);
                        durationMs = parseInt(parts[3]);
                        durationFrames = parseInt(parts[4]);
                        xDistance = parts.length > 6 ? parseInt(parts[6]) : 0;
                        yDistance = parts.length > 7 ? parseInt(parts[7]) : 0;
                        hasXDistance = parts.length > 8 ? (parts[8] === '1') : false;
                        hasYDistance = parts.length > 9 ? (parts[9] === '1') : false;
                        staggerText = parts.length > 11 ? parts[11] : "Stagger";
                    } else {
                        // Single-property format: success|durationMs|durationFrames|firstKeyIndex|lastKeyIndex|propertyIndex|xDistance|yDistance|hasX|hasY|0|Stagger
                        durationMs = parseInt(parts[1]);
                        durationFrames = parseInt(parts[2]);
                        delayMs = 0; // No delay concept in single-property mode
                        delayFrames = 0;
                        xDistance = parts.length > 6 ? parseInt(parts[6]) : 0;
                        yDistance = parts.length > 7 ? parseInt(parts[7]) : 0;
                        hasXDistance = parts.length > 8 ? (parts[8] === '1') : false;
                        hasYDistance = parts.length > 9 ? (parts[9] === '1') : false;
                        staggerText = parts.length > 11 ? parts[11] : "Stagger";
                    }
                    
                    DEBUG.log('Successfully parsed delay:', delayMs + 'ms, ' + delayFrames + ' frames');
                    DEBUG.log('Successfully parsed duration:', durationMs + 'ms, ' + durationFrames + ' frames');
                    DEBUG.log('Successfully parsed X distance:', xDistance + 'px, hasX=' + hasXDistance);
                    DEBUG.log('Successfully parsed Y distance:', yDistance + 'px, hasY=' + hasYDistance);
                    
                    // Store cross-property mode flag for duration buttons to use
                    window.lastReadKeyframesWasCrossProperty = isCrossPropertyMode;
                    
                    // Update displays based on mode
                    var delayText = document.getElementById('delayText');
                    
                    if (isCrossPropertyMode) {
                        // Cross-property mode: show delay info in delay row AND duration info in duration row
                        
                        // Initialize flags for opacity handling
                        var durationOpacitySet = false;
                        var delayOpacitySet = false;
                        var staggerOpacitySet = false;
                        var isSingleKeyframe = (durationMs === -999);
                        
                        // Handle duration display
                        if (durationMs === -1) {
                            durationText.innerHTML = 'Duration: <span style="opacity: 0.75;">Multiple</span>';
                        } else if (durationMs === -999) {
                            // For single keyframe - show default text when reading, not error message
                            durationText.innerHTML = 'Duration';
                            durationText.style.opacity = '0.75';
                            // Skip the opacity override below for this case
                            durationOpacitySet = true;
                        } else if (durationMs === 0) {
                            // For keyframes with no meaningful duration - show default text (can't stretch across properties)
                            durationText.innerHTML = 'Duration';
                            durationText.style.opacity = '0.75';
                            durationOpacitySet = true;
                            // Duration operations don't work with 0ms, but delay operations might still be valid
                        } else {
                            durationText.innerHTML = 'Duration: <span style="opacity: 0.75;">' + durationMs + 'ms / ' + durationFrames + 'f</span>';
                        }
                        // Only set opacity to 1 if we haven't already set it to 0.75 for single keyframe
                        if (!durationOpacitySet) {
                            durationText.style.opacity = '1';
                        }
                        
                        // Handle delay display
                        if (delayMs === -1) {
                            delayText.innerHTML = 'Delay: <span style="opacity: 0.75;">Multiple</span>';
                        } else if (isSingleKeyframe) {
                            // For true single keyframe scenarios - show default text
                            delayText.innerHTML = 'Delay';
                            delayText.style.opacity = '0.75';
                            delayOpacitySet = true;
                        } else {
                            // Show actual delay value (works for both single layer cross-property and multi-layer)
                            delayText.innerHTML = 'Delay: <span style="opacity: 0.75;">' + delayMs + 'ms / ' + delayFrames + 'f</span>';
                        }
                        // Only set opacity to 1 if we haven't already set it to 0.75 for single keyframe
                        if (!delayOpacitySet) {
                            delayText.style.opacity = '1';
                        }
                        
                        // Store for delay nudging - commented out as element doesn't exist
                        // document.getElementById('delayValue').value = delayMs;
                        
                        // Update stagger display (only in cross-property mode)
                        var staggerTextElement = document.getElementById('staggerText');
                        if (staggerTextElement) {
                            console.log('handleReadKeyframes: Updating stagger display with staggerText="' + staggerText + '"');
                            if (staggerText === "Stagger") {
                                // Check if this is a single-layer cross-property scenario by looking at the full result string
                                // The result contains debug info like "Found X keyframes across 1 layers"
                                var isSingleLayerCrossProperty = result.indexOf("across 1 layers") !== -1;
                                
                                if (isSingleKeyframe || isSingleLayerCrossProperty) {
                                    // For single keyframe OR cross-property on single layer - show default text when reading
                                    staggerTextElement.innerHTML = 'Stagger';
                                    staggerTextElement.style.opacity = '0.75';
                                    staggerOpacitySet = true;
                                    resetCumulativeStagger(true); // Treat as single keyframe scenario
                                    console.log('handleReadKeyframes: Set stagger to default text (single keyframe: ' + isSingleKeyframe + ', single layer cross-property: ' + isSingleLayerCrossProperty + ')');
                                } else {
                                    // Multiple layers with stagger - show 0 
                                    staggerTextElement.innerHTML = 'Stagger: <span style="opacity: 0.75;">0ms / 0f</span>';
                                    staggerTextElement.style.opacity = '1';
                                    resetCumulativeStagger(false);
                                    console.log('handleReadKeyframes: Set stagger to 0 (multi-layer scenario)');
                                }
                            } else if (staggerText === "Multiple") {
                                // Multiple stagger values - show with prefix
                                staggerTextElement.innerHTML = 'Stagger: <span style="opacity: 0.75;">Multiple</span>';
                                if (!staggerOpacitySet) {
                                    staggerTextElement.style.opacity = '1';
                                }
                                console.log('handleReadKeyframes: Set stagger to "Stagger: Multiple"');
                            } else {
                                // Show stagger value
                                staggerTextElement.innerHTML = 'Stagger: <span style="opacity: 0.75;">' + staggerText + '</span>';
                                if (!staggerOpacitySet) {
                                    staggerTextElement.style.opacity = '1';
                                }
                                console.log('handleReadKeyframes: Set stagger to "Stagger: ' + staggerText + '"');
                            }
                        }
                    } else {
                        // Single-property mode: show duration info in duration row
                        DEBUG.log('ENTERING SINGLE-PROPERTY MODE BLOCK');
                        DEBUG.log('About to update delayText');
                        delayText.innerHTML = 'Delay: <span style="opacity: 0.75;">0ms / 0f</span>';
                        delayText.style.opacity = '1';
                        DEBUG.log('delayText updated');
                        
                        DEBUG.log('About to update durationText with: ' + durationMs + 'ms / ' + durationFrames + 'f');
                        durationText.innerHTML = 'Duration: <span style="opacity: 0.75;">' + durationMs + 'ms / ' + durationFrames + 'f</span>';
                        DEBUG.log('durationText.innerHTML set');
                        durationText.style.opacity = '1';
                        DEBUG.log('durationText.opacity set');
                        // durationValue.value = durationMs; // This element doesn't exist and isn't needed
                        DEBUG.log('Duration display updated');
                        
                        // Reset stagger to default in single-property mode
                        // Single-property mode is always single layer, so show default text like single keyframe
                        DEBUG.log('About to call resetCumulativeStagger');
                        resetCumulativeStagger(true); // Show default text since single-property = single layer = can't stagger
                        DEBUG.log('After resetCumulativeStagger');
                    }
                    // Don't override opacity - it's already set in the conditional logic above
                    
                    DEBUG.log('CHECKPOINT: After duration update, before buttons');
                    
                    // Always show all buttons for consistency
                    showDurationButtons();
                    showPositionButtons();
                    
                    DEBUG.log('CHECKPOINT: After showing buttons, before resolution');
                    
                    try {
                        // Get current resolution multiplier for scaling
                        var resolutionMultiplier = parseInt(document.getElementById('resolutionMultiplier').value) || 2;
                        DEBUG.log('Resolution multiplier:', resolutionMultiplier);
                        
                        // Update X Distance display
                        var xDistanceText = document.getElementById('xDistanceText');
                        DEBUG.log('About to update X distance. hasXDistance=' + hasXDistance + ', xDistance=' + xDistance);
                        if (hasXDistance) {
                            // Check for special "Multiple" value
                            if (xDistance === -999999) {
                                xDistanceText.innerHTML = 'X: <span style="opacity: 0.75;">Multiple</span>';
                                DEBUG.log('Set X distance to Multiple');
                            } else {
                                var scaledXDistance = parseFloat((xDistance / resolutionMultiplier).toFixed(2));
                                DEBUG.log('Scaled X distance:', scaledXDistance);
                                
                                if (scaledXDistance === 0) {
                                    xDistanceText.innerHTML = 'X: <span style="opacity: 0.75;">0px @1x</span>';
                                } else {
                                    // Show directional format
                                    var direction = scaledXDistance > 0 ? 'Right' : 'Left';
                                    var absScaledXDistance = Math.abs(scaledXDistance);
                                    xDistanceText.innerHTML = 'X: <span style="opacity: 0.75;">' + direction + ' ' + absScaledXDistance + 'px @1x</span>';
                                    DEBUG.log('Set X distance text to:', xDistanceText.innerHTML);
                                }
                            }
                            xDistanceText.style.opacity = '1';
                        }
                        // If hasXDistance is false, leave the element untouched in its default HTML state
                    
                        // Update Y Distance display
                        var yDistanceText = document.getElementById('yDistanceText');
                        if (hasYDistance) {
                            // Check for special "Multiple" value
                            if (yDistance === -999999) {
                                yDistanceText.innerHTML = 'Y: <span style="opacity: 0.75;">Multiple</span>';
                                DEBUG.log('Set Y distance to Multiple');
                            } else {
                                var scaledYDistance = parseFloat((yDistance / resolutionMultiplier).toFixed(2));
                                
                                if (scaledYDistance === 0) {
                                    yDistanceText.innerHTML = 'Y: <span style="opacity: 0.75;">0px @1x</span>';
                                } else {
                                    // Show directional format
                                    var direction = scaledYDistance > 0 ? 'Down' : 'Up';
                                    var absScaledYDistance = Math.abs(scaledYDistance);
                                    yDistanceText.innerHTML = 'Y: <span style="opacity: 0.75;">' + direction + ' ' + absScaledYDistance + 'px @1x</span>';
                                }
                            }
                            yDistanceText.style.opacity = '1';
                        }
                        // If hasYDistance is false, leave the element untouched in its default HTML state
                    
                        console.log('Updated duration to:', durationMs + 'ms /', durationFrames + 'f');
                        console.log('X Distance:', hasXDistance ? scaledXDistance + 'px @1x (raw: ' + xDistance + 'px @' + resolutionMultiplier + 'x)' : 'N/A');
                        console.log('Y Distance:', hasYDistance ? scaledYDistance + 'px @1x (raw: ' + yDistance + 'px @' + resolutionMultiplier + 'x)' : 'N/A');
                    } catch(e) {
                        DEBUG.error('ERROR updating X/Y distances:', e);
                        console.error('Error in X/Y distance update:', e);
                    }
                }
            } else {
                // Reset all displays to 0 values
                durationText.innerHTML = 'Duration: <span style="opacity: 0.75;">0ms / 0f</span>';
                durationText.style.opacity = '1';
                delayText.innerHTML = 'Delay: <span style="opacity: 0.75;">0ms / 0f</span>';
                delayText.style.opacity = '1';
                
                // Reset X and Y distance displays to 0
                xDistanceText.innerHTML = 'X: <span style="opacity: 0.75;">0px @1x</span>';
                xDistanceText.style.opacity = '1';
                yDistanceText.innerHTML = 'Y: <span style="opacity: 0.75;">0px @1x</span>';
                yDistanceText.style.opacity = '1';
                
                console.log('Unexpected result:', result);
            }
        });
    }
    
    // Read Keyframes button handler
    var readKeyframesButton = document.getElementById('readKeyframes');
    readKeyframesButton.addEventListener('click', function() {
        DEBUG.log('Read Keyframes clicked');
        handleReadKeyframes();
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
    
    // Global tooltip creation function (reusable across all inputs)
    function createTooltip(element, text) {
            var tooltip = null;
            
            element.addEventListener('mouseenter', function() {
                tooltip = document.createElement('div');
                tooltip.textContent = text;
                tooltip.style.cssText = `
                    position: fixed;
                    background-color: #1a1a1a;
                    color: #ffffff;
                    padding: 4px 8px;
                    border-radius: 4px;
                    font-size: 10px;
                    font-weight: 400;
                    white-space: nowrap;
                    border: 1px solid rgba(255, 255, 255, 0.12);
                    box-shadow: 0 2px 8px rgba(0, 0, 0, 0.3);
                    z-index: 1000;
                    pointer-events: none;
                    opacity: 0;
                    transition: opacity 0.2s ease-in-out;
                `;
                
                document.body.appendChild(tooltip);
                
                var rect = element.getBoundingClientRect();
                tooltip.style.left = (rect.left + rect.width / 2 - tooltip.offsetWidth / 2) + 'px';
                tooltip.style.top = (rect.top - tooltip.offsetHeight - 8) + 'px';
                
                setTimeout(() => tooltip.style.opacity = '1', 10);
            });
            
            element.addEventListener('mouseleave', function() {
                if (tooltip) {
                    tooltip.style.opacity = '0';
                    setTimeout(() => {
                        if (tooltip && tooltip.parentNode) {
                            tooltip.parentNode.removeChild(tooltip);
                        }
                        tooltip = null;
                    }, 200);
                }
            });
        }
    
    // Setup stagger input tooltip functionality
    var staggerInput = document.getElementById('staggerInput');
    if (staggerInput) {
        createTooltip(staggerInput, 'Frames');
    }
    
    // Setup stagger direction button tooltip
    var staggerActionBtn = document.getElementById('staggerActionBtn');
    if (staggerActionBtn) {
        createTooltip(staggerActionBtn, 'Stagger direction');
    }
    
    // Setup In/Out button tooltips for X and Y distance
    var xInBtn = document.getElementById('xInBtn');
    var xOutBtn = document.getElementById('xOutBtn');
    var yInBtn = document.getElementById('yInBtn');
    var yOutBtn = document.getElementById('yOutBtn');
    
    if (xInBtn) createTooltip(xInBtn, 'First keyframe');
    if (xOutBtn) createTooltip(xOutBtn, 'Last keyframe');
    if (yInBtn) createTooltip(yInBtn, 'First keyframe');
    if (yOutBtn) createTooltip(yOutBtn, 'Last keyframe');
    
    // Stagger +/- buttons
    var staggerIncrementBtn = document.getElementById('staggerIncrementBtn');
    var staggerDecrementBtn = document.getElementById('staggerDecrementBtn');
    var staggerInputField = document.getElementById('staggerInput');
    
    if (staggerIncrementBtn) {
        staggerIncrementBtn.addEventListener('click', function() {
            console.log('Stagger increment (+) clicked');
            
            if (!csInterface) {
                console.log('CSInterface not available');
                return;
            }
            
            // Skip pre-check - let ExtendScript handle single layer vs multi-layer scenarios
            // This allows same-layer staggering to work
            proceedWithStaggerIncrement();
            
            function proceedWithStaggerIncrement() {
                // Get stagger frames from input field
                var staggerFrames = parseFloat(staggerInputField.value) || 3;
                
                // Check if stagger direction is flipped (top to bottom)
                var staggerActionBtn = document.getElementById('staggerActionBtn');
                var isTopToBottom = staggerActionBtn && staggerActionBtn.classList.contains('flipped');
                console.log('Applying +' + staggerFrames + ' frame stagger' + (isTopToBottom ? ' (top to bottom)' : ' (bottom to top)'));
                
                staggerIncrementBtn.disabled = true;
            
            // Call the ExtendScript function with +1 direction, frame count, and layer order flag
            var script = 'applyStagger(1, ' + staggerFrames + ', ' + isTopToBottom + ')';
            csInterface.evalScript(script, function(result) {
                console.log('Stagger increment result:', result);
                
                staggerIncrementBtn.disabled = false;
                
                if (result && result.indexOf('|') !== -1) {
                    var parts = result.split('|');
                    var status = parts[0];
                    
                    // Extract debug messages (everything after the main result parts)
                    var debugMessages = [];
                    for (var i = 3; i < parts.length; i++) {
                        if (parts[i] && parts[i].trim()) {
                            debugMessages.push(parts[i]);
                        }
                    }
                    
                    // Display debug messages in debug panel if it exists
                    if (debugMessages.length > 0) {
                        var debugLog = document.getElementById('debug-log');
                        if (debugLog) {
                            debugLog.innerHTML += '<div style="margin: 4px 0; color: #4a9eff; font-weight: bold;">🎬 Stagger Increment Debug:</div>';
                            for (var j = 0; j < debugMessages.length; j++) {
                                debugLog.innerHTML += '<div style="margin: 1px 0; font-size: 9px; color: #ccc;">' + debugMessages[j] + '</div>';
                            }
                            debugLog.scrollTop = debugLog.scrollHeight;
                        }
                    }
                    
                    if (status === 'success') {
                        // Check if stagger was stopped due to negative times
                        if (parts[1] && parts[1].indexOf('stopped') !== -1) {
                            console.log('Stagger stopped due to negative times:', parts[1]);
                            // Don't update cumulative stagger if operation was stopped
                        } else {
                            // Check the actual stagger result to see if any movement occurred
                            // parts[2] contains the effective stagger like "0ms per layer" or "50ms per layer"
                            var effectiveStaggerText = parts[2] || '';
                            var effectiveStaggerMatch = effectiveStaggerText.match(/([-\d\.]+)ms per layer/);
                            var effectiveStaggerValue = effectiveStaggerMatch ? parseFloat(effectiveStaggerMatch[1]) : null;
                            
                            console.log('Debug INCREMENT: effectiveStaggerValue=' + effectiveStaggerValue + ' from "' + effectiveStaggerText + '"');
                            
                            // Remove all immediate stagger display updates - let handleReadKeyframes() handle it
                            console.log('Stagger operation completed, letting automatic read update the display');
                        }
                        
                        // After successful stagger operation, automatically read current state
                        setTimeout(function() {
                            console.log('Auto-reading keyframes after stagger increment to get current state');
                            handleReadKeyframes();
                        }, 100);
                        
                    } else if (status === 'error') {
                        console.log('Stagger error:', parts[1]);
                        
                        // Check if this is a single layer scenario and show appropriate message
                        var errorMsg = parts[1] || '';
                        var staggerTextElement = document.getElementById('staggerText');
                        if (staggerTextElement) {
                            if (errorMsg.indexOf('No selected keyframes') !== -1 || 
                                errorMsg.indexOf('single layer') !== -1 ||
                                errorMsg.indexOf('one layer') !== -1) {
                                staggerTextElement.innerHTML = 'Stagger: <span style="opacity: 0.75;">Select > 1 Layer</span>';
                                staggerTextElement.style.opacity = '1';
                            } else {
                                // For other errors, show default stagger text
                                staggerTextElement.innerHTML = 'Stagger';
                                staggerTextElement.style.opacity = '0.75';
                            }
                        }
                    }
                } else {
                    console.log('Invalid stagger result:', result);
                }
            });
            } // Close proceedWithStaggerIncrement function
        });
    }
    
    if (staggerDecrementBtn) {
        staggerDecrementBtn.addEventListener('click', function() {
            console.log('Stagger decrement (-) clicked');
            
            if (!csInterface) {
                console.log('CSInterface not available');
                return;
            }
            
            // Skip pre-check - let ExtendScript handle single layer vs multi-layer scenarios
            // This allows same-layer staggering to work
            proceedWithStaggerDecrement();
            
            function proceedWithStaggerDecrement() {
                // Get stagger frames from input field
                var staggerFrames = parseFloat(staggerInputField.value) || 3;
                
                // Check if stagger direction is flipped (top to bottom)
                var staggerActionBtn = document.getElementById('staggerActionBtn');
                var isTopToBottom = staggerActionBtn && staggerActionBtn.classList.contains('flipped');
                console.log('Applying -' + staggerFrames + ' frame stagger' + (isTopToBottom ? ' (top to bottom)' : ' (bottom to top)'));
                
                staggerDecrementBtn.disabled = true;
            
            // Call the ExtendScript function with -1 direction, frame count, and layer order flag
            var script = 'applyStagger(-1, ' + staggerFrames + ', ' + isTopToBottom + ')';
            csInterface.evalScript(script, function(result) {
                console.log('Stagger decrement result:', result);
                
                staggerDecrementBtn.disabled = false;
                
                if (result && result.indexOf('|') !== -1) {
                    var parts = result.split('|');
                    var status = parts[0];
                    
                    // Extract debug messages (everything after the main result parts)
                    var debugMessages = [];
                    for (var i = 3; i < parts.length; i++) {
                        if (parts[i] && parts[i].trim()) {
                            debugMessages.push(parts[i]);
                        }
                    }
                    
                    // Display debug messages in debug panel if it exists
                    if (debugMessages.length > 0) {
                        var debugLog = document.getElementById('debug-log');
                        if (debugLog) {
                            debugLog.innerHTML += '<div style="margin: 4px 0; color: #ff9a4a; font-weight: bold;">🎬 Stagger Decrement Debug:</div>';
                            for (var j = 0; j < debugMessages.length; j++) {
                                debugLog.innerHTML += '<div style="margin: 1px 0; font-size: 9px; color: #ccc;">' + debugMessages[j] + '</div>';
                            }
                            debugLog.scrollTop = debugLog.scrollHeight;
                        }
                    }
                    
                    if (status === 'success') {
                        // Check if stagger was stopped due to negative times
                        if (parts[1] && parts[1].indexOf('stopped') !== -1) {
                            console.log('Stagger stopped due to negative times:', parts[1]);
                            // Don't update cumulative stagger if operation was stopped
                        } else {
                            // Check the actual stagger result to see if any movement occurred
                            // parts[2] contains the effective stagger like "0ms per layer" or "-50ms per layer"
                            var effectiveStaggerText = parts[2] || '';
                            var effectiveStaggerMatch = effectiveStaggerText.match(/([-\d\.]+)ms per layer/);
                            var effectiveStaggerValue = effectiveStaggerMatch ? parseFloat(effectiveStaggerMatch[1]) : null;
                            
                            console.log('Debug DECREMENT: effectiveStaggerValue=' + effectiveStaggerValue + ' from "' + effectiveStaggerText + '"');
                            
                            // Remove all immediate stagger display updates - let handleReadKeyframes() handle it
                            console.log('Stagger operation completed, letting automatic read update the display');
                        }
                        
                        // After successful stagger operation, automatically read current state
                        setTimeout(function() {
                            console.log('Auto-reading keyframes after stagger decrement to get current state');
                            handleReadKeyframes();
                        }, 100);
                        
                    } else if (status === 'error') {
                        console.log('Stagger error:', parts[1]);
                        
                        // Check if this is a single layer scenario and show appropriate message
                        var errorMsg = parts[1] || '';
                        var staggerTextElement = document.getElementById('staggerText');
                        if (staggerTextElement) {
                            if (errorMsg.indexOf('No selected keyframes') !== -1 || 
                                errorMsg.indexOf('single layer') !== -1 ||
                                errorMsg.indexOf('one layer') !== -1) {
                                staggerTextElement.innerHTML = 'Stagger: <span style="opacity: 0.75;">Select > 1 Layer</span>';
                                staggerTextElement.style.opacity = '1';
                            } else {
                                // For other errors, show default stagger text
                                staggerTextElement.innerHTML = 'Stagger';
                                staggerTextElement.style.opacity = '0.75';
                            }
                        }
                    }
                } else {
                    console.log('Invalid stagger result:', result);
                }
            });
            } // Close proceedWithStaggerDecrement function
        });
    }
    
    // Stagger Action Button - Toggle flip functionality
    var staggerActionBtn = document.getElementById('staggerActionBtn');
    if (staggerActionBtn) {
        staggerActionBtn.addEventListener('click', function() {
            console.log('Stagger action button clicked');
            
            // Toggle the flipped class
            if (staggerActionBtn.classList.contains('flipped')) {
                staggerActionBtn.classList.remove('flipped');
                console.log('Stagger direction: Bottom to Top (default)');
                DEBUG.log('Stagger direction changed to: Bottom to Top');
            } else {
                staggerActionBtn.classList.add('flipped');
                console.log('Stagger direction: Top to Bottom');
                DEBUG.log('Stagger direction changed to: Top to Bottom');
            }
        });
    }
    
    // X Distance +/- buttons
    var xIncrementBtn = document.getElementById('xIncrementBtn');
    var xDecrementBtn = document.getElementById('xDecrementBtn');
    
    if (xIncrementBtn && xDecrementBtn) {
        // X → button: Move selected keyframe right by 5px
        xIncrementBtn.addEventListener('click', function() {
            console.log('X Right arrow clicked');
            
            if (!csInterface) {
                console.log('CSInterface not available');
                return;
            }
            
            // Get current In/Out state
            var isInDirection = document.getElementById('xInBtn').classList.contains('selected');
            var direction = isInDirection ? 'in' : 'out';
            
            // Call the ExtendScript function: positive = right
            csInterface.evalScript('nudgeXPosition(1, "' + direction + '")', function(result) {
                console.log('X nudge right result:', result);
                
                // Update display based on result
                updateDistanceDisplay('x', result);
            });
        });
        
        // X ← button: Move selected keyframe left by 5px
        xDecrementBtn.addEventListener('click', function() {
            console.log('X Left arrow clicked');
            
            if (!csInterface) {
                console.log('CSInterface not available');
                return;
            }
            
            // Get current In/Out state
            var isInDirection = document.getElementById('xInBtn').classList.contains('selected');
            var direction = isInDirection ? 'in' : 'out';
            
            // Call the ExtendScript function: negative = left
            csInterface.evalScript('nudgeXPosition(-1, "' + direction + '")', function(result) {
                console.log('X nudge left result:', result);
                
                // Update display based on result
                updateDistanceDisplay('x', result);
            });
        });
    }
    
    // Y Distance +/- buttons
    var yIncrementBtn = document.getElementById('yIncrementBtn');
    var yDecrementBtn = document.getElementById('yDecrementBtn');
    
    if (yIncrementBtn && yDecrementBtn) {
        // Y ↓ button: Move selected keyframe down by 5px
        yIncrementBtn.addEventListener('click', function() {
            console.log('Y Down arrow clicked');
            
            if (!csInterface) {
                console.log('CSInterface not available');
                return;
            }
            
            // Get current In/Out state
            var isInDirection = document.getElementById('yInBtn').classList.contains('selected');
            var direction = isInDirection ? 'in' : 'out';
            
            // Call the ExtendScript function: positive = down
            csInterface.evalScript('nudgeYPosition(1, "' + direction + '")', function(result) {
                console.log('Y nudge down result:', result);
                
                // Update display based on result
                updateDistanceDisplay('y', result);
            });
        });
        
        // Y ↑ button: Move selected keyframe up by 5px
        yDecrementBtn.addEventListener('click', function() {
            console.log('Y Up arrow clicked');
            
            if (!csInterface) {
                console.log('CSInterface not available');
                return;
            }
            
            // Get current In/Out state
            var isInDirection = document.getElementById('yInBtn').classList.contains('selected');
            var direction = isInDirection ? 'in' : 'out';
            
            // Call the ExtendScript function: negative = up
            csInterface.evalScript('nudgeYPosition(-1, "' + direction + '")', function(result) {
                console.log('Y nudge up result:', result);
                
                // Update display based on result
                updateDistanceDisplay('y', result);
            });
        });
    }
    
    // Global variable to track cumulative stagger amount
    var cumulativeStaggerFrames = 0;
    
    // Helper function to update stagger display after staggering
    function updateStaggerDisplay(appliedStaggerFrames, direction, isSuccess) {
        var staggerText = document.getElementById('staggerText');
        if (!staggerText) return;
        
        if (isSuccess) {
            // Update cumulative stagger (direction: 1 for +, -1 for -)
            cumulativeStaggerFrames += appliedStaggerFrames * direction;
            
            if (cumulativeStaggerFrames !== 0) {
                // Calculate milliseconds based on 60fps (or could get actual frame rate)
                // Using same conversion as the ExtendScript: frames/frameRate * 1000
                // For simplicity, assume 60fps: 1 frame = 16.67ms, so 3 frames = 50ms
                var staggerMs = Math.round((cumulativeStaggerFrames / 60) * 1000);
                
                // Show the cumulative stagger amount (handles both positive and negative)
                staggerText.innerHTML = 'Stagger: <span style="opacity: 0.75;">' + staggerMs + 'ms / ' + cumulativeStaggerFrames + 'f</span>';
                staggerText.style.opacity = '1';
                
                console.log('Updated stagger display: cumulative ' + cumulativeStaggerFrames + ' frames = ' + staggerMs + 'ms');
            } else {
                // Reset to zero display when exactly zero
                staggerText.innerHTML = 'Stagger: <span style="opacity: 0.75;">0ms / 0f</span>';
                staggerText.style.opacity = '1';
                cumulativeStaggerFrames = 0; // Ensure it's exactly zero
            }
        }
    }
    
    // Function to reset cumulative stagger (called when reading keyframes detects no stagger)
    function resetCumulativeStagger(isSingleKeyframe) {
        cumulativeStaggerFrames = 0;
        var staggerText = document.getElementById('staggerText');
        if (staggerText) {
            if (isSingleKeyframe) {
                // For single keyframe - show default text at lower opacity
                staggerText.innerHTML = 'Stagger';
                staggerText.style.opacity = '0.75';
            } else {
                // Normal case - show 0ms stagger
                staggerText.innerHTML = 'Stagger: <span style="opacity: 0.75;">0ms / 0f</span>';
                staggerText.style.opacity = '1';
            }
        }
    }
    
    // Helper function to update distance display after nudging
    function updateDistanceDisplay(axis, result) {
        var textElement = document.getElementById(axis + 'DistanceText');
        
        if (result && result.indexOf('|') !== -1) {
            var parts = result.split('|');
            var status = parts[0];
            
            // Extract debug messages (parts 3 and beyond, following the same pattern as stagger functions)
            var debugMessages = [];
            for (var i = 3; i < parts.length; i++) {
                if (parts[i] && parts[i].trim()) {
                    debugMessages.push(parts[i]);
                }
            }
            
            // Display debug messages in debug panel if it exists
            if (debugMessages.length > 0) {
                var debugLog = document.getElementById('debug-log');
                if (debugLog) {
                    var axisUpper = axis.toUpperCase();
                    debugLog.innerHTML += '<div style="margin: 4px 0; color: #9a4aff; font-weight: bold;">🎬 ' + axisUpper + ' Position Nudge Debug:</div>';
                    for (var j = 0; j < debugMessages.length; j++) {
                        debugLog.innerHTML += '<div style="margin: 1px 0; font-size: 9px; color: #ccc;">' + debugMessages[j] + '</div>';
                    }
                    debugLog.scrollTop = debugLog.scrollHeight;
                }
            }
            
            if (status === 'success') {
                var distance = parseFloat(parts[1]);
                var hasDistance = parts[2] === '1';
                
                // Get current resolution multiplier for scaling display
                var resolutionMultiplier = parseInt(document.getElementById('resolutionMultiplier').value) || 2;
                
                if (hasDistance) {
                    // Check for special "Multiple" flag value
                    if (distance === -999999) {
                        textElement.innerHTML = axis.toUpperCase() + ': <span style="opacity: 0.75;">Multiple</span>';
                        textElement.style.opacity = '1';
                    } else {
                        // Show directional values with Up/Down/Left/Right
                        var scaledDistance = parseFloat((distance / resolutionMultiplier).toFixed(2));
                        
                        if (scaledDistance === 0) {
                            // Zero distance
                            textElement.innerHTML = axis.toUpperCase() + ': <span style="opacity: 0.75;">0px @1x</span>';
                        } else {
                            // Determine direction based on axis and sign
                            var direction = '';
                            var absScaledDistance = Math.abs(scaledDistance);
                            
                            if (axis === 'x') {
                                direction = scaledDistance > 0 ? 'Right' : 'Left';
                            } else { // y axis
                                direction = scaledDistance > 0 ? 'Down' : 'Up';
                            }
                            
                            textElement.innerHTML = axis.toUpperCase() + ': <span style="opacity: 0.75;">' + direction + ' ' + absScaledDistance + 'px @1x</span>';
                        }
                        textElement.style.opacity = '1';
                    }
                } else {
                    textElement.innerHTML = axis.toUpperCase() + ': <span style="opacity: 0.75;">0px @1x</span>';
                    textElement.style.opacity = '1';
                }
            } else if (status === 'error') {
                // Use consistent error message for all distance buttons
                textElement.innerHTML = axis.toUpperCase() + ': <span style="opacity: 0.75;">0px @1x</span>';
                textElement.style.opacity = '1';
            }
        } else {
            textElement.innerHTML = axis.toUpperCase() + ': <span style="opacity: 0.75;">0px @1x</span>';
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
            
            // Parse debug information if present
            if (result && result.indexOf('|') !== -1) {
                var parts = result.split('|');
                var status = parts[0]; // success or error
                var debugInfo = parts.slice(1); // everything after first pipe
                
                if (debugInfo.length > 0) {
                    // Show debug info in debug panel if it exists
                    var debugContent = document.getElementById('debug-log');
                    if (debugContent) {
                        debugContent.innerHTML += '<h3>=== DEVICE CREATION DEBUG ===</h3>';
                        for (var i = 0; i < debugInfo.length; i++) {
                            debugContent.innerHTML += '<div>' + debugInfo[i] + '</div>';
                        }
                        debugContent.scrollTop = debugContent.scrollHeight;
                    }
                    
                    // Also log to console for backup
                    DEBUG.log('=== DEVICE CREATION DEBUG ===');
                    for (var i = 0; i < debugInfo.length; i++) {
                        console.log(debugInfo[i]);
                    }
                }
            }
            
            // Re-enable button
            addDeviceButton.disabled = false;
        });
    });
    
    // Add Squircle button handler (handles both new and replace based on dropdown)
    addSquircleButton.addEventListener('click', function(event) {
        var mode = squircleModeDropdown.value;
        var isShiftHeld = event.shiftKey;
        console.log('Add Squircle clicked with mode:', mode, 'shift held:', isShiftHeld);
        
        // Disable button while working
        addSquircleButton.classList.add('loading');
        
        // Pass the extension path to the JSX
        var setPathScript = 'var extensionRoot = "' + extensionPath.replace(/\\/g, '\\\\') + '";';
        csInterface.evalScript(setPathScript);
        
        // Call the appropriate After Effects function based on mode
        var scriptFunction;
        if (mode === 'replace') {
            scriptFunction = 'replaceRectangleFromPanel()';
        } else {
            // For new squircle, get current resolution multiplier and check if shift is held
            var resolutionMultiplier = parseInt(document.getElementById('resolutionMultiplier').value) || 2;
            console.log('Resolution multiplier for squircle:', resolutionMultiplier);
            
            if (isShiftHeld) {
                scriptFunction = 'createSquircleFromPanel(true, ' + resolutionMultiplier + ')'; // comp-sized with resolution scaling
            } else {
                scriptFunction = 'createSquircleFromPanel(false, ' + resolutionMultiplier + ')'; // default size with resolution scaling
            }
        }
        
        csInterface.evalScript(scriptFunction, function(result) {
            console.log('Squircle result:', result);
            // Re-enable button
            addSquircleButton.classList.remove('loading');
        });
    });
    
    // Add Nulls button handler
    addNullButton.addEventListener('click', function() {
        console.log('Add Nulls clicked');
        
        // Get selected null type from dropdown
        var nullType = document.getElementById('nullType').value;
        console.log('Null type:', nullType);
        
        // Disable button while working
        addNullButton.disabled = true;
        addNullButton.textContent = 'Adding...';
        
        // Pass the extension path to the JSX
        var setPathScript = 'var extensionRoot = "' + extensionPath.replace(/\\/g, '\\\\') + '";';
        csInterface.evalScript(setPathScript);
        
        // Call the After Effects script with the null type
        csInterface.evalScript('addNullsFromPanel("' + nullType + '")', function(result) {
            console.log('Add Nulls result:', result);
            
            // Extract debug messages if present
            if (result && result.indexOf('|') !== -1) {
                var parts = result.split('|');
                var status = parts[0];
                
                // Extract debug messages (everything after main result parts)
                var debugMessages = [];
                for (var i = 2; i < parts.length; i++) {
                    if (parts[i] && parts[i].trim()) {
                        debugMessages.push(parts[i]);
                    }
                }
                
                // Display debug messages in debug panel
                if (debugMessages.length > 0) {
                    var debugLog = document.getElementById('debug-log');
                    if (debugLog) {
                        debugLog.innerHTML += '<div style="margin: 4px 0; color: #4a9eff; font-weight: bold;">🎬 Fit to Squircle Debug:</div>'
                        for (var j = 0; j < debugMessages.length; j++) {
                            debugLog.innerHTML += '<div style="margin: 1px 0; font-size: 9px; color: #ccc;">' + debugMessages[j] + '</div>';
                        }
                        debugLog.scrollTop = debugLog.scrollHeight;
                    }
                }
                
                // Show result status
                if (status === 'error') {
                    console.error('Fit to Squircle failed:', parts[1] || 'Unknown error');
                } else {
                    console.log('Fit to Squircle succeeded:', parts[1] || 'Success');
                }
            }
            
            // Re-enable button
            addNullButton.disabled = false;
            addNullButton.textContent = 'Fit to Squircle';
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
        
        // Add debug panel for testing (DEV MODE)
        addDebugPanel();
    }, 200);
    
    
    // Set up the panel theme to match After Effects
    csInterface.setBackgroundColor(38, 38, 38); // Dark gray background
    
});