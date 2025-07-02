// js/explorer.js
// This file contains all logic specific to the Explorer Mode.

let _db;
let _appId;
let _collection;
let _query;
let _getDocs;

// Three.js variables
let scene, camera, renderer;
let orbGroup; // Group to hold all orbs
let termsData = []; // Array to store fetched terms
const ORB_RADIUS = 0.5; // Radius for the sphere representing an orb
const FONT_SIZE = 0.3; // Approximate font size for term labels

// Mouse interaction variables
let isDragging = false;
let previousMouseX = 0;
let previousMouseY = 0;

/**
 * Initializes the Explorer module with Firebase instances and relevant functions.
 * @param {object} db - Firestore database instance.
 * @param {string} appId - The application ID.
 * @param {function} collectionFn - The Firestore 'collection' function.
 * @param {function} queryFn - The Firestore 'query' function.
 * @param {function} getDocsFn - The Firestore 'getDocs' function.
 */
export function initExplorer(db, appId, collectionFn, queryFn, getDocsFn) {
    _db = db;
    _appId = appId;
    _collection = collectionFn;
    _query = queryFn;
    _getDocs = getDocsFn;

    console.log("Explorer module initialized. App ID:", _appId);

    // Get the orb display area and command input
    const orbDisplayArea = document.getElementById('orb-display-area');
    const commandInput = document.getElementById('command-input');

    if (!orbDisplayArea || !commandInput) {
        console.error("Explorer UI elements not found. Cannot initialize Explorer Mode.");
        return;
    }

    // Initialize Three.js scene
    initThreeJS(orbDisplayArea);

    // Event listener for command input
    commandInput.addEventListener('keypress', (event) => {
        if (event.key === 'Enter') {
            const fullCommand = commandInput.value.trim();
            console.log("Command entered:", fullCommand);
            handleCommand(fullCommand);
            commandInput.value = ''; // Clear input after command
        }
    });

    // Mouse interaction for camera control
    orbDisplayArea.addEventListener('mousedown', (event) => {
        isDragging = true;
        previousMouseX = event.clientX;
        previousMouseY = event.clientY;
    });

    orbDisplayArea.addEventListener('mouseup', () => {
        isDragging = false;
    });

    orbDisplayArea.addEventListener('mousemove', (event) => {
        if (!isDragging) return;

        const deltaX = event.clientX - previousMouseX;
        const deltaY = event.clientY - previousMouseY;

        // Rotate the orbGroup based on mouse movement
        // Increase sensitivity for smoother rotation
        orbGroup.rotation.y += deltaX * 0.005;
        orbGroup.rotation.x += deltaY * 0.005;

        // Clamp rotation to prevent flipping
        orbGroup.rotation.x = Math.max(-Math.PI / 2, Math.min(Math.PI / 2, orbGroup.rotation.x));

        previousMouseX = event.clientX;
        previousMouseY = event.clientY;
    });

    // Handle window resize
    window.addEventListener('resize', onWindowResize);

    // Start the animation loop
    animate();

    // Initial message to user
    commandInput.placeholder = "Type 'run:' to generate orbs, 'clear:' to remove, 'list:' to see terms.";
}

/**
 * Initializes the Three.js scene, camera, and renderer.
 * @param {HTMLElement} container - The DOM element to append the canvas to.
 */
function initThreeJS(container) {
    // Scene
    scene = new THREE.Scene();
    scene.background = new THREE.Color(0x1a202c); // Match body background

    // Camera
    camera = new THREE.PerspectiveCamera(75, container.clientWidth / container.clientHeight, 0.1, 1000);
    camera.position.z = 5; // Position camera back

    // Renderer
    renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setSize(container.clientWidth, container.clientHeight);
    container.appendChild(renderer.domElement); // Append canvas to the container

    // Lighting
    const ambientLight = new THREE.AmbientLight(0x404040); // Soft white light
    scene.add(ambientLight);
    const directionalLight = new THREE.DirectionalLight(0xffffff, 0.7); // Brighter directional light
    directionalLight.position.set(0, 1, 1).normalize();
    scene.add(directionalLight);

    // Orb group for easy rotation/manipulation of all orbs
    orbGroup = new THREE.Group();
    scene.add(orbGroup);
}

/**
 * Handles window resize events to update camera aspect and renderer size.
 */
function onWindowResize() {
    const orbDisplayArea = document.getElementById('orb-display-area');
    if (!orbDisplayArea || !camera || !renderer) return;

    camera.aspect = orbDisplayArea.clientWidth / orbDisplayArea.clientHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(orbDisplayArea.clientWidth, orbDisplayArea.clientHeight);
}

/**
 * The main animation loop for Three.js.
 */
function animate() {
    requestAnimationFrame(animate);

    // Rotate the orb group slowly
    if (orbGroup) {
        // orbGroup.rotation.y += 0.001; // Continuous slow rotation (optional)
    }

    renderer.render(scene, camera);
}

/**
 * Fetches terms from Firestore and updates the termsData array.
 * @returns {Promise<Array>} - A promise that resolves with the fetched terms.
 */
async function fetchTerms() {
    if (!_db || !_collection || !_getDocs) {
        console.warn("Firestore not initialized for Explorer. Cannot fetch terms.");
        return [];
    }
    console.log("Fetching terms from Firestore...");
    try {
        const termsCollectionRef = _collection(_db, `artifacts/${_appId}/public/data/terms`);
        const snapshot = await _getDocs(termsCollectionRef);
        const fetchedTerms = [];
        snapshot.forEach(doc => {
            fetchedTerms.push({ id: doc.id, ...doc.data() });
        });
        termsData = fetchedTerms; // Update global termsData
        console.log("Fetched terms:", termsData.length, "terms.");
        return termsData;
    } catch (error) {
        console.error("Error fetching terms:", error);
        return [];
    }
}

/**
 * Renders the terms as interactive orbs in the 3D scene.
 */
async function renderOrbs() {
    // Clear existing orbs from the group
    console.log("Clearing existing orbs...");
    while (orbGroup.children.length > 0) {
        const child = orbGroup.children[0];
        orbGroup.remove(child);
        // Dispose of geometry, material, texture to free up memory
        if (child.geometry) child.geometry.dispose();
        if (child.material) child.material.dispose();
        if (child.map) child.map.dispose(); // For textures on sprites
    }
    console.log("Existing orbs cleared.");


    if (termsData.length === 0) {
        const commandInput = document.getElementById('command-input');
        commandInput.placeholder = "No terms found. Import some in Admin Mode first. Type 'run:' to try again.";
        return;
    }

    const geometry = new THREE.SphereGeometry(ORB_RADIUS, 32, 32);

    // Position orbs in a sphere or grid for visibility
    const numOrbs = termsData.length;
    const phi = Math.PI * (3 - Math.sqrt(5)); // Golden angle approximation for even distribution
    console.log(`Rendering ${numOrbs} orbs...`);
    for (let i = 0; i < numOrbs; i++) {
        const y = 1 - (i / (numOrbs - 1)) * 2; // y goes from 1 to -1
        const radius = Math.sqrt(1 - y * y); // Radius at y

        const theta = phi * i;

        const x = radius * Math.cos(theta);
        const z = radius * Math.sin(theta);

        // Adjust overall spread - dynamically based on number of orbs
        // Ensure minimum spread for small number of orbs
        const spreadFactor = Math.max(2, numOrbs * 0.15);
        const position = new THREE.Vector3(x * spreadFactor, y * spreadFactor, z * spreadFactor);

        // Create orb mesh
        const material = new THREE.MeshPhongMaterial({
            color: new THREE.Color(Math.random() * 0xffffff), // Random color for each orb
            transparent: true,
            opacity: 0.8,
            shininess: 50
        });
        const orbMesh = new THREE.Mesh(geometry, material);
        orbMesh.position.copy(position);
        orbMesh.userData = { term: termsData[i].term, id: termsData[i].id }; // Store term data
        const tags = termsData[i].tags || [];
        orbMesh.userData.tags = tags;

        // Example: Calculate style
        const styleConfig = getOrbStyleFromTags(tags); // Function to define below
        orbMesh.userData.style = styleConfig;

        // Apply style to orb
        orbMesh.material.color.set(styleConfig.color);
        orbMesh.scale.set(styleConfig.size, styleConfig.size, styleConfig.size);
        orbGroup.add(orbMesh);

        // Add 2D text label using CanvasTexture for simplicity
        const canvas = document.createElement('canvas');
        const context = canvas.getContext('2d');
        const text = termsData[i].term;

        // Dynamically size canvas based on text
        context.font = `Bold ${Math.round(FONT_SIZE * 50)}px Inter`; // Set font to measure text
        const textMetrics = context.measureText(text);
        const textWidth = textMetrics.width;
        const textHeight = Math.round(FONT_SIZE * 50 * 1.2); // Estimate height based on font size + line height

        canvas.width = textWidth + 20; // Add padding
        canvas.height = textHeight + 10; // Add padding

        // Clear canvas and redraw text after resizing
        context.clearRect(0, 0, canvas.width, canvas.height);
        context.font = `Bold ${Math.round(FONT_SIZE * 50)}px Inter`;
        context.fillStyle = 'white';
        context.textAlign = 'center';
        context.textBaseline = 'middle';
        context.fillText(text, canvas.width / 2, canvas.height / 2);

        const texture = new THREE.CanvasTexture(canvas);
        const spriteMaterial = new THREE.SpriteMaterial({ map: texture });
        const sprite = new THREE.Sprite(spriteMaterial);
        // Adjust sprite scale based on canvas dimensions and desired world size
        const aspectRatio = canvas.width / canvas.height;
        sprite.scale.set(FONT_SIZE * 2 * aspectRatio, FONT_SIZE * 2, 1); // Scale to fit desired world size

        // Position text slightly above the orb
        sprite.position.copy(position);
        sprite.position.y += ORB_RADIUS + (FONT_SIZE * 0.5); // Position above orb, adjust offset
        sprite.position.z += 0.01; // Slight offset to prevent z-fighting with orb

        orbGroup.add(sprite);
    }
    console.log("Orbs rendered successfully.");
}
/**
 * Maps tags to orb style properties: size, pulse frequency, movement speed, and color.
 * @param {Array} tags - Array of tag strings.
 * @returns {Object} Style configuration for the orb.
 */
function getOrbStyleFromTags(tags) {
    const tagCount = tags.length;
    // Clamp maximum tag influence to avoid extremes
    const maxTags = 6;

    // Size: range 0.8 - 1.5
    const size = 0.8 + Math.min(tagCount, maxTags) * 0.12;

    // Pulse frequency: range 0.5 - 1.5 Hz
    const pulseFreq = 0.5 + Math.min(tagCount, maxTags) * 0.18;

    // Movement speed: range 0.01 - 0.045
    const speed = 0.01 + Math.min(tagCount, maxTags) * 0.007;

    // Color: Hash first tag to a color, or default if no tags
    const baseColor = tags[0]
        ? stringToColor(tags[0])
        : "#00bfff";

    return {
        size,
        pulseFreq,
        speed,
        color: baseColor
    };
}

/**
 * Utility: Hash a string to a color hex.
 * @param {string} str
 * @returns {string} Hex color string.
 */
function stringToColor(str) {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
        hash = str.charCodeAt(i) + ((hash << 5) - hash);
    }
    let color = (hash & 0x00FFFFFF).toString(16).toUpperCase();
    return "#" + "00000".substring(0, 6 - color.length) + color;
}
/**
 * Handles commands entered into the input field.
 * @param {string} fullCommandInput - The full command string from the input field.
 */
async function handleCommand(fullCommandInput) {
    const commandInput = document.getElementById('command-input');
    let commandPrefix = '';
    let actualCommand = '';

    // Split the command by the first colon to differentiate prefix from command
    const parts = fullCommandInput.split(':');
    if (parts.length > 1) {
        commandPrefix = parts[0].trim().toLowerCase();
        actualCommand = parts.slice(1).join(':').trim().toLowerCase(); // Rejoin if command itself has colons
    } else {
        // If no colon, treat the whole input as the command
        actualCommand = fullCommandInput.toLowerCase();
    }
    const tags = termsData[i].tags || [];
orbMesh.userData.tags = tags;

// Example: Calculate style
const styleConfig = getOrbStyleFromTags(tags); // Function to define below
orbMesh.userData.style = styleConfig;

// Apply style to orb
orbMesh.material.color.set(styleConfig.color);
orbMesh.scale.set(styleConfig.size, styleConfig.size, styleConfig.size);
    console.log(`Executing command: '${commandPrefix}' with value: '${actualCommand}'`);

    switch (commandPrefix) {
        case 'run':
            commandInput.placeholder = "Loading orbs...";
            termsData = await fetchTerms(); // Re-fetch in case new terms were added
            if (termsData.length > 0) {
                renderOrbs();
                commandInput.placeholder = `Orbs active! Displaying ${termsData.length} terms. Type 'clear:' to reset or 'run:' again.`;
            } else {
                commandInput.placeholder = "No terms found. Import some in Admin Mode first. Type 'run:' to try again.";
            }
            break;
        case 'clear':
            while (orbGroup.children.length > 0) {
                const child = orbGroup.children[0];
                orbGroup.remove(child);
                // Dispose of geometry, material, texture to free up memory
                if (child.geometry) child.geometry.dispose();
                if (child.material) child.material.dispose();
                if (child.map) child.map.dispose();
            }
            commandInput.placeholder = "Orbs cleared. Type 'run:' to restart.";
            console.log("Orbs cleared successfully.");
            break;
        case 'list': // For debugging
            console.log("Current Terms:", termsData);
            commandInput.placeholder = "Terms listed in console. Type 'run:' to restart.";
            break;
        default:
            commandInput.placeholder = `Unknown command or format. Try 'run:', 'clear:', or 'list:'.`;
            break;
    }
}
