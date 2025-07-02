// js/explorer.js
// This file contains all logic specific to the Explorer Mode.

import { CSS2DRenderer, CSS2DObject } from "./CSS2DRenderer.js";
import { OrbitControls } from "./OrbitControls.js";

let _db;
let _appId;
let _collection;
let _query;
let _getDocs;

// Three.js variables
let scene, camera, renderer, cssRenderer; // cssRenderer added
let controls; // OrbitControls added
let orbGroup; // Group to hold all orbs
let termsData = []; // Array to store fetched terms
const ORB_RADIUS = 0.5; // Radius for the sphere representing an orb

// Definition Panel UI Elements and State
let definitionPanel, termTitle, definitionText, definitionCounter, definitionTags, definitionPanelControls;
let definitionPanelVisible = false;
let currentOrb = null;
let currentDefinitionIndex = 0;
let isOrbFocused = false; // New state to track if an orb is focused

// Mouse interaction variables for glow
let mouseGlow;

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
    mouseGlow = document.querySelector('.mouse-glow'); // Get mouse glow element

    if (!orbDisplayArea || !commandInput || !mouseGlow) {
        console.error("Explorer UI elements not found. Cannot initialize Explorer Mode.");
        return;
    }

    // Initialize Three.js scene and renderers
    initThreeJS(orbDisplayArea);

    // Get Definition Panel UI elements
    definitionPanel = document.querySelector('.definition-panel');
    termTitle = document.querySelector('.definition-panel .term-title');
    definitionText = document.querySelector('.definition-panel .definition-text');
    definitionTags = document.querySelector('.definition-panel .definition-tags');
    definitionCounter = document.querySelector('.definition-panel .definition-counter');
    definitionPanelControls = document.querySelector('.definition-panel .controls');


    // Event listener for command input
    commandInput.addEventListener('keypress', (event) => {
        if (event.key === 'Enter') {
            const fullCommand = commandInput.value.trim();
            console.log("Command entered:", fullCommand);
            handleCommand(fullCommand);
            commandInput.value = ''; // Clear input after command
        }
    });

    // Mouse interaction for glow effect
    document.addEventListener('mousemove', onMouseMove);

    // Orb interaction: Double click
    orbDisplayArea.addEventListener('dblclick', onOrbDoubleClick, false);

    // Keyboard interaction for definition panel
    window.addEventListener('keydown', onKeyDown, false);

    // Handle window resize
    window.addEventListener('resize', onWindowResize);

    // Start the animation loop
    animate();

    // Initial message to user
    commandInput.placeholder = "Type 'run' to generate orbs, 'clear' to remove, 'list' to see terms.";
}

/**
 * Initializes the Three.js scene, camera, and renderer.
 * @param {HTMLElement} container - The DOM element to append the canvas to.
 */
function initThreeJS(container) {
    // Scene
    scene = new THREE.Scene();
    scene.background = new THREE.Color(0x1a202c); // Dark background

    // Camera
    camera = new THREE.PerspectiveCamera(75, container.clientWidth / container.clientHeight, 0.1, 1000);
    camera.position.z = 10; // Position camera back

    // WebGL Renderer
    renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true }); // alpha:true for transparency
    renderer.setSize(container.clientWidth, container.clientHeight);
    container.appendChild(renderer.domElement);

    // CSS2D Renderer for HTML labels/overlays
    cssRenderer = new CSS2DRenderer();
    cssRenderer.setSize(container.clientWidth, container.clientHeight);
    cssRenderer.domElement.style.position = 'absolute';
    cssRenderer.domElement.style.top = '0px';
    cssRenderer.domElement.style.pointerEvents = 'none'; // Essential to allow clicks to pass through
    container.appendChild(cssRenderer.domElement);

    // OrbitControls for camera interaction (rotate, zoom, pan)
    // Pass the WebGLRenderer's DOM element for controls to attach to
    controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true; // For a smoother camera feel
    controls.dampingFactor = 0.05;
    controls.screenSpacePanning = false; // Limit panning to not go off plane
    controls.minDistance = 5;
    controls.maxDistance = 50;

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
    if (!orbDisplayArea || !camera || !renderer || !cssRenderer) return;

    camera.aspect = orbDisplayArea.clientWidth / orbDisplayArea.clientHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(orbDisplayArea.clientWidth, orbDisplayArea.clientHeight);
    cssRenderer.setSize(orbDisplayArea.clientWidth, orbDisplayArea.clientHeight);
}

/**
 * The main animation loop for Three.js.
 */
function animate() {
    requestAnimationFrame(animate);

    // Update OrbitControls
    controls.update();

    // Rotate the orbGroup slowly when not focused on an orb
    if (orbGroup && !isOrbFocused) {
        orbGroup.rotation.y += 0.001; // Gentle continuous rotation
        orbGroup.rotation.x += Math.sin(Date.now() * 0.0001) * 0.0005; // Gentle up/down wobble
    }

    // Individual orb animations (e.g., slight bobbing, pulsating)
    orbGroup.children.forEach(child => {
        if (child.isMesh) { // Only apply to orb meshes
            child.position.y += Math.sin(Date.now() * 0.002 + child.id) * 0.001; // Gentle bobbing
            child.scale.setScalar(1 + Math.sin(Date.now() * 0.001 + child.id) * 0.01); // Subtle pulsating
        }
    });


    renderer.render(scene, camera);
    cssRenderer.render(scene, camera); // Render CSS objects
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
 * Orb titles are hidden until double-clicked.
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
        // If CSS2DObject, also remove its element from DOM
        if (child instanceof CSS2DObject && child.element.parentNode) {
            child.element.parentNode.removeChild(child.element);
        }
    }
    console.log("Existing orbs cleared.");

    if (termsData.length === 0) {
        const commandInput = document.getElementById('command-input');
        commandInput.placeholder = "No terms found. Import some in Admin Mode first. Type 'run' to try again.";
        return;
    }

    const geometry = new THREE.SphereGeometry(ORB_RADIUS, 32, 32);

    // Position orbs using a spiral or more dynamic layout
    const numOrbs = termsData.length;
    const spacing = ORB_RADIUS * 4; // Distance between orbs
    const maxDimension = Math.ceil(Math.sqrt(numOrbs)); // Approximate grid size
    const startX = -(maxDimension / 2) * spacing;
    const startY = -(maxDimension / 2) * spacing;
    const startZ = -5; // Start a bit behind the camera
    // Tag-to-trait style map
    const tagStyleMap = {
      science: { color: 0x4fc3f7, pulseFreq: 0.01, velocity: 0.005 },
      emotion: { color: 0xff4081, pulseFreq: 0.02, velocity: 0.008 },
      philosophy: { color: 0x9575cd, pulseFreq: 0.015, velocity: 0.006 },
      technology: { color: 0x00e676, pulseFreq: 0.012, velocity: 0.006 },
      art: { color: 0xffc107, pulseFreq: 0.018, velocity: 0.007 }
    };
    function getOrbStyle(tags) {
      const defaults = { color: 0xffffff, pulseFreq: 0.01, velocity: 0.005 };
      if (!tags || tags.length === 0) return defaults;

      for (const tag of tags) {
        if (tagStyleMap[tag]) return tagStyleMap[tag];
      }

      return defaults;
    }
    console.log(`Rendering ${numOrbs} orbs...`);
    termsData.forEach((termItem, index) => {
        // Simple grid positioning for now, can be replaced with more complex physics positioning later
        const x = startX + (index % maxDimension) * spacing;
        const y = startY + Math.floor(index / maxDimension) * spacing;
        const z = startZ + (Math.random() - 0.5) * spacing; // Add some depth variation
        const style = getOrbStyle(termItem.tags);
        const geometry = new THREE.SphereGeometry(ORB_RADIUS, 32, 32);
        const material = new THREE.MeshPhongMaterial({
          color: style.color,
          transparent: true,
          opacity: 0.8,
          shininess: 50
        });
        const position = new THREE.Vector3(x, y, z);

        const material = new THREE.MeshPhongMaterial({
            color: new THREE.Color(Math.random() * 0xffffff), // Random color for each orb
            transparent: true,
            opacity: 0.8,
            shininess: 50
        });
            // Get tag-driven style traits for this orb
        const style = getOrbStyle(termItem.tags);

            // Create orb mesh
        const orbMesh = new THREE.Mesh(geometry, new THREE.MeshPhongMaterial({
          color: style.color,
          transparent: true,
          opacity: 0.8,
          shininess: 50
        }));

        orbMesh.position.copy(position);
        orbMesh.name = `orb-${termItem.id}`; // Give it a unique name for raycasting

            // Attach all necessary metadata and traits
        orbMesh.userData = {
          term: termItem,
          originalPosition: position.clone(),
          originalScale: orbMesh.scale.clone(),
          tags: termItem.tags || [],
          pulseFreq: style.pulseFreq,
          velocity: style.velocity
        };

        orbGroup.add(orbMesh);

        // Term labels (hidden initially, will be shown on double-click)
        // CSS2DObject can hold an HTML element directly
        const div = document.createElement('div');
        div.className = 'orb-label-hidden'; // CSS class to hide by default
        div.textContent = termItem.term;
        div.style.color = 'white';
        div.style.backgroundColor = 'rgba(0,0,0,0.6)';
        div.style.padding = '5px 10px';
        div.style.borderRadius = '5px';
        div.style.pointerEvents = 'none'; // So it doesn't block clicks
        div.style.opacity = '0'; // Hidden by default
        div.style.transition = 'opacity 0.3s ease-in-out'; // Smooth transition

        const cssObject = new CSS2DObject(div);
        cssObject.position.copy(position);
        cssObject.position.y += ORB_RADIUS + 0.5; // Position above orb
        cssObject.userData.isLabel = true; // Mark as label
        cssObject.userData.orbRef = orbMesh; // Reference to the orb it belongs to
        orbGroup.add(cssObject); // Add CSS2DObject to the orbGroup

        // Store CSS2DObject reference in orbMesh's userData
        orbMesh.userData.label = cssObject;
    });
    console.log("Orbs rendered successfully.");
}

/**
 * Handles commands entered into the input field.
 * @param {string} fullCommandInput - The full command string from the input field.
 */
async function handleCommand(fullCommandInput) {
    const commandInput = document.getElementById('command-input');
    let commandToExecute = fullCommandInput.trim().toLowerCase(); // Assume entire input is command by default

    // If a colon exists, treat the part before the colon as the main command
    const colonIndex = commandToExecute.indexOf(':');
    if (colonIndex !== -1) {
        commandToExecute = commandToExecute.substring(0, colonIndex).trim();
    }

    console.log(`Executing command: '${commandToExecute}'`);

    switch (commandToExecute) {
        case 'run':
            commandInput.placeholder = "Loading orbs...";
            termsData = await fetchTerms(); // Re-fetch in case new terms were added
            if (termsData.length > 0) {
                renderOrbs();
                commandInput.placeholder = `Orbs active! Displaying ${termsData.length} terms. Double-click an orb to view definitions. Type 'clear' to reset or 'run' again.`;
            } else {
                commandInput.placeholder = "No terms found. Import some in Admin Mode first. Type 'run' to try again.";
            }
            break;
        case 'clear':
            while (orbGroup.children.length > 0) {
                const child = orbGroup.children[0];
                orbGroup.remove(child);
                if (child.geometry) child.geometry.dispose();
                if (child.material) child.material.dispose();
                if (child instanceof CSS2DObject && child.element.parentNode) {
                    child.element.parentNode.removeChild(child.element);
                }
            }
            commandInput.placeholder = "Orbs cleared. Type 'run' to restart.";
            console.log("Orbs cleared successfully.");
            break;
        case 'list': // For debugging
            console.log("Current Terms:", termsData);
            commandInput.placeholder = "Terms listed in console. Type 'run' to restart.";
            break;
        default:
            commandInput.placeholder = `Unknown command: '${commandToExecute}'. Try 'run', 'clear', or 'list'.`;
            break;
    }
}


// --- Definition Panel and Orb Interaction Functions ---

function showDefinitionPanel(termData) {
    if (!termData || !termData.definitions || termData.definitions.length === 0) {
        termTitle.textContent = termData.term || 'No Term';
        definitionText.textContent = 'No definition available.';
        definitionTags.textContent = '';
        definitionCounter.textContent = '';
        definitionPanel.classList.add('active');
        definitionPanelVisible = true;
        return;
    }

    currentDefinitionIndex = 0; // Reset to first definition
    updateDefinitionPanel(termData);
    definitionPanel.classList.add('active');
    definitionPanelVisible = true;

    // Hide all orb labels (except the focused one if needed later)
    orbGroup.children.forEach(child => {
        if (child.userData.isLabel && child.userData.orbRef !== currentOrb) {
            child.element.style.opacity = '0'; // Hide
        }
    });

    // Bring current orb's label to full opacity
    if (currentOrb && currentOrb.userData.label) {
        currentOrb.userData.label.element.style.opacity = '1';
    }
}

function hideDefinitionPanel() {
    definitionPanel.classList.remove('active');
    definitionPanelVisible = false;
    isOrbFocused = false;

    // Reset camera controls and orb position
    controls.target.copy(new THREE.Vector3(0, 0, 0)); // Reset target to origin
    controls.update();

    // Restore all orb labels to hidden state
    orbGroup.children.forEach(child => {
        if (child.userData.isLabel) {
            child.element.style.opacity = '0';
        }
        // Also restore orb positions/scales if they were altered for focus
        if (child.isMesh && child.userData.originalPosition) {
            child.position.copy(child.userData.originalPosition);
            child.scale.copy(child.userData.originalScale);
        }
    });
    currentOrb = null; // Clear focused orb
}

function cycleDefinition(direction) {
    if (currentOrb && currentOrb.userData.term && currentOrb.userData.term.definitions) {
        const definitions = currentOrb.userData.term.definitions;
        if (definitions.length > 1) {
            currentDefinitionIndex = (currentDefinitionIndex + direction + definitions.length) % definitions.length;
            updateDefinitionPanel(currentOrb.userData.term);
        }
    }
}

function updateDefinitionPanel(termData) {
    termTitle.textContent = termData.term;
    if (termData.definitions && termData.definitions.length > 0) {
        const currentDef = termData.definitions[currentDefinitionIndex];
        definitionText.textContent = currentDef.text;
        definitionTags.textContent = `Tags: ${currentDef.tags ? currentDef.tags.join(', ') : 'None'}`;
        definitionCounter.textContent = `Definition ${currentDefinitionIndex + 1} of ${termData.definitions.length}`;
    } else {
        definitionText.textContent = 'No definition available.';
        definitionTags.textContent = '';
        definitionCounter.textContent = '';
    }
}

// Raycaster for orb double-click detection
const raycaster = new THREE.Raycaster();
const mouse = new THREE.Vector2();

function onOrbDoubleClick(event) {
    event.preventDefault(); // Prevent browser double-click behavior (e.g., text selection)

    // Convert mouse coordinates to normalized device coordinates (-1 to +1)
    mouse.x = (event.clientX / window.innerWidth) * 2 - 1;
    mouse.y = -(event.clientY / window.innerHeight) * 2 + 1;

    raycaster.setFromCamera(mouse, camera);

    // Only intersect with orb meshes, not their labels or other objects
    const intersects = raycaster.intersectObjects(orbGroup.children.filter(obj => obj.isMesh));

    if (intersects.length > 0) {
        const intersectedOrb = intersects[0].object;
        if (intersectedOrb.userData && intersectedOrb.userData.term) {
            if (isOrbFocused && intersectedOrb === currentOrb) {
                // If the same orb is double-clicked again, unfocus
                hideDefinitionPanel();
                // Move orb back to original position (handled by hideDefinitionPanel)
            } else {
                // Double-clicked a new orb, or first double-click
                isOrbFocused = true;
                currentOrb = intersectedOrb;

                // Animate camera to focus on the orb
                const targetPosition = new THREE.Vector3().copy(currentOrb.position);
                const cameraEndPosition = new THREE.Vector3().copy(targetPosition).add(new THREE.Vector3(0, 0, 5)); // 5 units back from orb
                
                // Animate orb to center and expand
                new TWEEN.Tween(currentOrb.position)
                    .to({ x: 0, y: 0, z: 0 }, 500)
                    .easing(TWEEN.Easing.Quadratic.Out)
                    .start();
                new TWEEN.Tween(currentOrb.scale)
                    .to({ x: 1.5, y: 1.5, z: 1.5 }, 500)
                    .easing(TWEEN.Easing.Quadratic.Out)
                    .start();

                // TWEEN.js is not imported, let's just directly set the camera target and position
                // For a proper animation, you'd integrate a library like TWEEN.js or implement custom animation.
                // For now, instantly move camera target to the orb's position
                controls.target.copy(currentOrb.position);
                controls.update(); // Update controls after changing target

                // Also make the label visible and centered relative to the orb
                if (currentOrb.userData.label) {
                    currentOrb.userData.label.position.copy(currentOrb.position);
                    currentOrb.userData.label.position.y += ORB_RADIUS + 0.5; // Position above orb
                    currentOrb.userData.label.element.style.opacity = '1'; // Make label visible
                }

                showDefinitionPanel(currentOrb.userData.term);
            }
        }
    } else {
        // Double-clicked on empty space, close panel if open
        if (definitionPanelVisible) {
            hideDefinitionPanel();
        }
    }
}


function onKeyDown(event) {
    if (event.key === 'Escape' && definitionPanelVisible) {
        hideDefinitionPanel();
    } else if (event.key === 'ArrowRight' && definitionPanelVisible && currentOrb) {
        cycleDefinition(1); // Next definition
    } else if (event.key === 'ArrowLeft' && definitionPanelVisible && currentOrb) {
        cycleDefinition(-1); // Previous definition
    }
    // Add up/down arrow key logic for cycling definitions as well, if desired
    // For now, let's keep it left/right to match common UI patterns.
}

// Mouse glow effect
function onMouseMove(event) {
    mouseGlow.style.left = `${event.clientX}px`;
    mouseGlow.style.top = `${event.clientY}px`;
}

// Note: Advanced mouse interaction (attract/repel based on speed/angle)
// and physics-based orb-to-orb interaction would require a physics engine
// (e.g., Cannon.js, Rapier.js) and custom force calculations based on tags.
// This is beyond the scope of a single update but is a great next step!
