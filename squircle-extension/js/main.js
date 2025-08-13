// This file connects the HTML panel to After Effects

// Wait for the page to load
document.addEventListener('DOMContentLoaded', function() {
    // Create connection to After Effects
    var csInterface = new CSInterface();
    
    // Get the buttons
    var createButton = document.getElementById('createSquircle');
    var replaceButton = document.getElementById('replaceRectangle');
    
    // Get the current extension path
    var extensionPath = csInterface.getSystemPath(SystemPath.EXTENSION);
    
    // Create Squircle button handler
    createButton.addEventListener('click', function() {
        // Disable button while working
        createButton.classList.add('loading');
        
        // Pass the extension path to the JSX
        var setPathScript = 'var extensionRoot = "' + extensionPath.replace(/\\/g, '\\\\') + '";';
        csInterface.evalScript(setPathScript);
        
        // Call the After Effects script
        csInterface.evalScript('createSquircleFromPanel()', function(result) {
            // Re-enable button
            createButton.classList.remove('loading');
            createButton.textContent = 'Create Squircle';
        });
    });
    
    // Replace Rectangle button handler
    replaceButton.addEventListener('click', function() {
        // Disable button while working
        replaceButton.classList.add('loading');
        
        // Pass the extension path to the JSX
        var setPathScript = 'var extensionRoot = "' + extensionPath.replace(/\\/g, '\\\\') + '";';
        csInterface.evalScript(setPathScript);
        
        // Call the replace function
        csInterface.evalScript('replaceRectangleFromPanel()', function(result) {
            // Re-enable button
            replaceButton.classList.remove('loading');
        });
    });
    
    // Set up the panel theme to match After Effects
    csInterface.setBackgroundColor(38, 38, 38); // Dark gray background
});