// js/explorer.js
// This file contains all logic specific to the Explorer Mode.

import * as THREE from 'https://cdnjs.cloudflare.com/ajax/libs/three.js/r128/three.min.js'; // Ensure Three.js is imported this way if using modules
// Note: If you are not running from a server that supports modules,
// and are just opening index.html directly, this import style might fail.
// In that case, you'd rely on the global THREE object from the script tag in index.html.
// The current setup in index.html uses a script tag, so 'THREE' should be globally available.
// If you encounter issues, remove the import statement above and rely on the global THREE.

let _db;
let _appId;
let _collection;
let _query;
let _getDocs;

// Three.js variables
let scene, camera, renderer;
let orbGroup; // Group to hold all orbs
let termsData = []; // Array to store fetched terms
const ORB_RADIUS = 0.5; // Base radius for the sphere representing an orb
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

    const orbDisplayArea = document.getElementById('orb-display-area');
    const commandInput = document.getElementById('command-input');

    if (!orbDisplayArea || !commandInput) {
        console.error("Missing necessary DOM elements for Explorer mode.");
        return;
    }

    // Setup scene, camera, and renderer
    setupScene(orbDisplayArea);
    // Add lighting to the scene
    setupLighting();
    // Setup mouse interaction for scene manipulation
    setupOrbsAreaInteraction(orbDisplayArea, commandInput);

    // Start the animation loop
    animate();
}

/**
 * Sets up the Three.js scene, camera, and renderer.
 * @param {HTMLElement} orbDisplayArea - The DOM element where the Three.js canvas will be rendered.
 */
function setupScene(orbDisplayArea) {
    scene = new THREE.Scene();
    scene.background = new THREE.Color(0x0a0a0a); // Very dark gray/black background for contrast

    camera = new THREE.PerspectiveCamera(
        75,
        orbDisplayArea.clientWidth / orbDisplayArea.clientHeight,
        0.1,
        1000
    );
    camera.position.z = 15; // Initial camera distance
    camera.position.y = 0;
    camera.position.x = 0;

    renderer = new THREE.WebGLRenderer({ antialias: true }); // Antialiasing for smoother edges
    renderer.setSize(orbDisplayArea.clientWidth, orbDisplayArea.clientHeight);
    orbDisplayArea.appendChild(renderer.domElement);

    // Enable shadow maps on the renderer for lights to cast shadows
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap; // Softer shadows

    // Handle window resizing to keep the scene responsive
    window.addEventListener('resize', () => {
        if (orbDisplayArea.clientWidth === 0 || orbDisplayArea.clientHeight === 0) return; // Prevent division by zero
        camera.aspect = orbDisplayArea.clientWidth / orbDisplayArea.clientHeight;
        camera.updateProjectionMatrix();
        renderer.setSize(orbDisplayArea.clientWidth, orbDisplayArea.clientHeight);
    });
}

/**
 * Adds lights to the Three.js scene.
 */
function setupLighting() {
    // Ambient Light: Illuminates all objects equally from all directions.
    // Provides basic visibility to all parts of objects.
    const ambientLight = new THREE.AmbientLight(0x404040, 2); // Color, Intensity
    scene.add(ambientLight);

    // Directional Light: Simulates light from a distant source (like the sun).
    // Objects are illuminated uniformly from a specific direction.
    const directionalLight1 = new THREE.DirectionalLight(0xffffff, 2); // White light, Intensity
    directionalLight1.position.set(5, 10, 7.5); // Position of the light source
    directionalLight1.castShadow = true; // This light can cast shadows
    scene.add(directionalLight1);

    // Another Directional Light for softer, more complex lighting (e.g., fill light)
    const directionalLight2 = new THREE.DirectionalLight(0x80b3ff, 1); // Blueish light, Intensity
    directionalLight2.position.set(-5, -10, -7.5);
    scene.add(directionalLight2);

    // You can also add PointLights for localized light sources, like glowing elements
    // const pointLight = new THREE.PointLight(0xff0000, 1, 100); // Red light, intensity 1, range 100
    // pointLight.position.set(0, 0, 5);
    // scene.add(pointLight);
}


/**
 * Sets up mouse interaction for orbiting the camera.
 * @param {HTMLElement} orbDisplayArea - The DOM element to attach event listeners to.
 * @param {HTMLElement} commandInput - The command input field.
 */
function setupOrbsAreaInteraction(orbDisplayArea, commandInput) {
    orbDisplayArea.addEventListener('mousedown', (e) => {
        // Only allow dragging if not clicking on command input
        if (e.target !== commandInput) {
            isDragging = true;
            previousMouseX = e.clientX;
            previousMouseY = e.clientY;
            orbDisplayArea.style.cursor = 'grabbing';
            e.preventDefault(); // Prevent default browser drag behavior
        }
    });

    orbDisplayArea.addEventListener('mousemove', (e) => {
        if (!isDragging) return;

        const deltaX = e.clientX - previousMouseX;
        const deltaY = e.clientY - previousMouseY;

        // Rotate the scene around Y-axis for horizontal drag
        if (orbGroup) {
            orbGroup.rotation.y += deltaX * 0.005;
        }

        // Rotate the scene around X-axis for vertical drag
        // Limit X-axis rotation to prevent flipping
        if (orbGroup) {
            const newRotationX = orbGroup.rotation.x + deltaY * 0.005;
            // Prevent camera from flipping upside down
            if (newRotationX > -Math.PI / 2 && newRotationX < Math.PI / 2) {
                orbGroup.rotation.x = newRotationX;
            }
        }

        previousMouseX = e.clientX;
        previousMouseY = e.clientY;
    });

    orbDisplayArea.addEventListener('mouseup', () => {
        isDragging = false;
        orbDisplayArea.style.cursor = 'grab';
    });

    orbDisplayArea.addEventListener('mouseleave', () => {
        isDragging = false;
        orbDisplayArea.style.cursor = 'default';
    });

    orbDisplayArea.addEventListener('wheel', (e) => {
        e.preventDefault(); // Prevent page scrolling
        camera.position.z += e.deltaY * 0.05; // Zoom in/out
        // Limit zoom
        if (camera.position.z < 5) camera.position.z = 5;
        if (camera.position.z > 50) camera.position.z = 50;
    });

    commandInput.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
            handleCommand(commandInput.value);
            commandInput.value = ''; // Clear input after command
        }
    });
}

/**
 * Fetches terms from Firestore.
 */
async function fetchTerms() {
    const termsCollectionRef = _collection(_db, `artifacts/${_appId}/public/data/terms`);
    const q = _query(termsCollectionRef); // No specific query filters for now, get all
    const snapshot = await _getDocs(q);
    
    const fetchedTerms = [];
    snapshot.forEach(doc => {
        const data = doc.data();
        fetchedTerms.push({
            id: doc.id,
            term: data.term,
            definitions: data.definitions || [],
            tags: data.tags || [],
            style: data.style || {}, // Expect style data from Firestore
            position: data.position || null // If you store positions in Firestore
        });
    });
    return fetchedTerms;
}

/**
 * Renders the orbs in the Three.js scene based on fetched terms data.
 */
function renderOrbs() {
    // Dispose of previous orb geometries and materials to prevent memory leaks
    if (orbGroup) {
        orbGroup.children.forEach(child => {
            if (child.isMesh) {
                child.geometry.dispose();
                child.material.dispose();
            }
            if (child.isSprite) { // For text labels
                child.material.dispose();
            }
            // If any textures are used, dispose them too:
            // if (child.material.map) child.material.map.dispose();
        });
        scene.remove(orbGroup);
        orbGroup = null; // Clear the group reference
    }

    orbGroup = new THREE.Group();
    scene.add(orbGroup);

    if (termsData.length === 0) {
        console.log("No terms data to render orbs.");
        return;
    }

    // Generate initial positions for new orbs
    // Simple spiral arrangement for better initial spread
    const numOrbs = termsData.length;
    const spiralRadiusIncrement = 0.5;
    const spiralAngleIncrement = Math.PI * (3 - Math.sqrt(5)); // Golden angle

    termsData.forEach((term, index) => {
        const termId = term.id;
        const termName = term.term;
        const termColor = term.style && term.style.color ? new THREE.Color(term.style.color) : new THREE.Color(0x007bff); // Default blue
        const scaledRadius = term.style && term.style.size ? ORB_RADIUS * term.style.size : ORB_RADIUS;

        const sphereGeometry = new THREE.SphereGeometry(scaledRadius, 32, 32); // More segments for smoother spheres
        
        // --- NEW MATERIAL: MeshPhongMaterial for shiny, light-reacting surfaces ---
        const orbMaterial = new THREE.MeshPhongMaterial({
            color: termColor,
            shininess: 80, // Higher shininess for more pronounced specular highlights
            specular: new THREE.Color(0x555555), // Color of the specular highlight
            // emissive: new THREE.Color(0x000000) // Could add a subtle glow if needed, but not with bloom
        });

        const orb = new THREE.Mesh(sphereGeometry, orbMaterial);

        // Initial position for orbs (using spiral)
        const angle = index * spiralAngleIncrement;
        const radius = index * spiralRadiusIncrement;
        orb.position.x = radius * Math.cos(angle);
        orb.position.y = radius * Math.sin(angle);
        orb.position.z = (index % 2 === 0 ? 1 : -1) * (index * 0.1); // Add a little Z spread

        // Store data in userData for physics and styling
        orb.userData = {
            id: termId,
            term: termName,
            definitions: term.definitions,
            tags: term.tags,
            style: {
                ...term.style, // Preserve existing style properties
                pulseSpeed: term.style && term.style.pulseSpeed ? term.style.pulseSpeed : 0.05, // Default pulse speed
                baseScale: scaledRadius // Store base scale for pulsing
            }
        };

        orb.receiveShadow = true; // Orb can receive shadows from other objects
        orb.castShadow = true;   // Orb can cast shadows

        orbGroup.add(orb);

        // Add text label as a Sprite
        const canvas = document.createElement('canvas');
        const context = canvas.getContext('2d');
        const fontSizePx = Math.ceil(FONT_SIZE * 100); // Scale font size
        context.font = `${fontSizePx}px Arial`; // Use a standard font
        const textWidth = context.measureText(termName).width;
        canvas.width = textWidth + 10; // Add some padding
        canvas.height = fontSizePx + 10;
        context.font = `${fontSizePx}px Arial`;
        context.fillStyle = 'white';
        context.textAlign = 'center';
        context.textBaseline = 'middle';
        context.fillText(termName, canvas.width / 2, canvas.height / 2);

        const texture = new THREE.CanvasTexture(canvas);
        const spriteMaterial = new THREE.SpriteMaterial({ map: texture });
        const sprite = new THREE.Sprite(spriteMaterial);

        // Position label above the orb, scaled to fit
        sprite.position.set(orb.position.x, orb.position.y + scaledRadius + FONT_SIZE * 0.5, orb.position.z);
        sprite.scale.set(canvas.width / fontSizePx * FONT_SIZE, canvas.height / fontSizePx * FONT_SIZE, 1);
        orbGroup.add(sprite);
    });
}

/**
 * Applies physical forces to orbs to simulate movement and interactions.
 */
function applyForces() {
    if (!orbGroup) return;

    // Only consider Meshes (the actual orbs) for motion
    const orbs = orbGroup.children.filter(child => child.isMesh);

    const repulsionStrength = 0.005; // General repulsion between all orbs
    const attractionStrength = 0.002; // Attraction based on shared tags

    for (let i = 0; i < orbs.length; i++) {
        let orbA = orbs[i];
        let force = new THREE.Vector3(0, 0, 0);

        for (let j = 0; j < orbs.length; j++) {
            if (i === j) continue; // Don't apply force to self

            let orbB = orbs[j];
            let diff = new THREE.Vector3().subVectors(orbA.position, orbB.position);
            let dist = diff.length();

            if (dist < 0.1) dist = 0.1; // Prevent division by zero or extreme forces at close proximity

            // Repulsive force: Push orbs away from each other
            let repulse = diff.clone().normalize().multiplyScalar(repulsionStrength / dist);
            force.add(repulse);

            // Attraction based on shared tags
            if (orbA.userData.tags && orbB.userData.tags) {
                const shared = orbA.userData.tags.filter(tag => orbB.userData.tags.includes(tag));
                if (shared.length > 0) {
                    // Stronger attraction for more shared tags
                    let attract = diff.clone().normalize().multiplyScalar(-attractionStrength * shared.length);
                    force.add(attract);
                }
            }
        }
        // Apply force (move orb slightly)
        orbA.position.add(force);

        // Keep orbs somewhat centered in the scene
        const centerForce = orbA.position.clone().multiplyScalar(-0.0001); // Weak pull to center
        orbA.position.add(centerForce);

        // Pulse animation for visual flair
        const scaleBase = orbA.userData.style.baseScale;
        const pulseSpeed = orbA.userData.style.pulseSpeed;
        const pulseFactor = 1 + Math.sin(Date.now() * pulseSpeed) * 0.1; // Pulsates between 0.9x and 1.1x base size
        orbA.scale.setScalar(pulseFactor);

        // Update sprite position to stay with its orb
        const sprite = orbGroup.children.find(child => child.isSprite && child.position.x === orbA.position.x && child.position.y === orbA.position.y); // Simplified finding, might need more robust
        if (sprite) {
            sprite.position.set(orbA.position.x, orbA.position.y + orbA.geometry.parameters.radius * orbA.scale.y + FONT_SIZE * 0.5, orbA.position.z);
        }
    }
}

/**
 * Main animation loop.
 */
function animate() {
    requestAnimationFrame(animate); // Request the next frame

    applyForces(); // Update orb positions based on forces

    // Render the scene if all Three.js components are ready
    if (renderer && scene && camera) {
        renderer.render(scene, camera);
    }
}


/**
 * Handles commands entered in the explorer input field.
 * @param {string} fullCommandInput - The full command string from the input.
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
        // If no colon, treat the whole input as the command (this means commandPrefix remains '')
        actualCommand = fullCommandInput.toLowerCase();
    }

    console.log(`Executing command: '${commandPrefix}' with value: '${actualCommand}'`);

    switch (commandPrefix) { // The switch now correctly checks the prefix before the colon
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
            // Clear orbs from scene
            if (orbGroup) {
                orbGroup.children.forEach(child => {
                    if (child.isMesh) {
                        child.geometry.dispose();
                        child.material.dispose();
                    }
                    if (child.isSprite) {
                        child.material.dispose();
                    }
                });
                scene.remove(orbGroup);
                orbGroup = null;
            }
            termsData = []; // Clear data
            commandInput.placeholder = "Orbs cleared. Type 'run:' to load again.";
            break;
        case 'list': // For debugging: list terms
            if (termsData.length > 0) {
                console.log("Current Terms Data:");
                termsData.forEach(term => console.log(`- ${term.term} (ID: ${term.id})`));
                commandInput.placeholder = `Listed ${termsData.length} terms to console.`;
            } else {
                commandInput.placeholder = "No terms loaded to list. Type 'run:' first.";
            }
            break;
        default:
            commandInput.placeholder = `Unknown command or format. Try 'run:', 'clear:', or 'list:'.`;
            break;
    }
}

// Ensure the `THREE` global object is available if not using module imports for `three.min.js`
// If you uncommented the import at the top, you might not need this.
// window.THREE = THREE;
```
