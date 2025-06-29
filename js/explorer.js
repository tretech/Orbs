// js/explorer.js
// This file contains all logic specific to the Explorer Mode, including 3D orb visualization.

import { collection, getDocs } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js";

let _db;
let _auth;
let _appId;
let _currentUserId;
let _THREE;

// Three.js variables
let scene, camera, renderer, orbContainer;
const orbs = []; // Array to hold Three.js mesh objects for orbs
const orbData = []; // Array to hold the fetched term data for orbs

// Mouse control variables
let isDragging = false;
let previousMousePosition = { x: 0, y: 0 };

/**
 * Initializes the Explorer module with Firebase, user details, and Three.js.
 * @param {object} db - Firestore database instance.
 * @param {object} auth - Firebase Auth instance.
 * @param {string} appId - The application ID.
 * @param {string} currentUserId - The current authenticated user's ID.
 * @param {object} THREE_LIB - The Three.js library object.
 */
export function initExplorer(db, auth, appId, currentUserId, THREE_LIB) {
    _db = db;
    _auth = auth;
    _appId = appId;
    _currentUserId = currentUserId;
    _THREE = THREE_LIB;

    orbContainer = document.getElementById('orb-container');
    if (!orbContainer) {
        console.error("Orb container not found!");
        return;
    }
    orbContainer.innerHTML = ''; // Clear "Loading orbs..." message

    console.log("Explorer module initialized. App ID:", _appId);

    setupThreeJs();
    addEventListeners();
    fetchAndDisplayOrbs();
    animate(); // Start the animation loop
}

/**
 * Sets up the Three.js scene, camera, and renderer.
 */
function setupThreeJs() {
    // Scene
    scene = new _THREE.Scene();
    scene.background = new _THREE.Color(0x1a202c); // Match body background

    // Camera
    camera = new _THREE.PerspectiveCamera(75, orbContainer.clientWidth / orbContainer.clientHeight, 0.1, 1000);
    camera.position.z = 5;

    // Renderer
    renderer = new _THREE.WebGLRenderer({ antialias: true });
    renderer.setSize(orbContainer.clientWidth, orbContainer.clientHeight);
    orbContainer.appendChild(renderer.domElement);

    // Add a simple ambient light
    const ambientLight = new _THREE.AmbientLight(0x404040); // soft white light
    scene.add(ambientLight);

    // Add a directional light
    const directionalLight = new _THREE.DirectionalLight(0xffffff, 0.5);
    directionalLight.position.set(1, 1, 1).normalize();
    scene.add(directionalLight);

    // Handle window resizing
    window.addEventListener('resize', onWindowResize, false);
}

/**
 * Handles window resizing to adjust Three.js renderer and camera.
 */
function onWindowResize() {
    if (orbContainer && renderer && camera) {
        camera.aspect = orbContainer.clientWidth / orbContainer.clientHeight;
        camera.updateProjectionMatrix();
        renderer.setSize(orbContainer.clientWidth, orbContainer.clientHeight);
    }
}

/**
 * Adds event listeners for mouse interaction and the command line input.
 */
function addEventListeners() {
    // Mouse control for camera movement
    renderer.domElement.addEventListener('mousedown', onMouseDown, false);
    renderer.domElement.addEventListener('mouseup', onMouseUp, false);
    renderer.domElement.addEventListener('mousemove', onMouseMove, false);

    // Command line input for "run:" commands
    const commandLineInput = document.getElementById('command-line-input');
    if (commandLineInput) {
        commandLineInput.addEventListener('keypress', onCommandLineKeyPress);
    }
}

/**
 * Handles mouse down event for camera rotation.
 * @param {MouseEvent} event - The mouse event.
 */
function onMouseDown(event) {
    isDragging = true;
    previousMousePosition = {
        x: event.clientX,
        y: event.clientY
    };
}

/**
 * Handles mouse up event.
 */
function onMouseUp() {
    isDragging = false;
}

/**
 * Handles mouse move event for camera rotation.
 * @param {MouseEvent} event - The mouse event.
 */
function onMouseMove(event) {
    if (!isDragging) return;

    const deltaMove = {
        x: event.clientX - previousMousePosition.x,
        y: event.clientY - previousMousePosition.y
    };

    // Sensitivity of rotation
    const rotationSpeed = 0.005;

    // Rotate around Y-axis for horizontal mouse movement
    scene.rotation.y += deltaMove.x * rotationSpeed;

    // Rotate around X-axis for vertical mouse movement (limit to avoid flipping)
    scene.rotation.x += deltaMove.y * rotationSpeed;
    scene.rotation.x = Math.max(-Math.PI / 2, Math.min(Math.PI / 2, scene.rotation.x)); // Limit vertical rotation

    previousMousePosition = {
        x: event.clientX,
        y: event.clientY
    };
}

/**
 * Handles key presses on the command line input.
 * @param {KeyboardEvent} event - The keyboard event.
 */
function onCommandLineKeyPress(event) {
    if (event.key === 'Enter') {
        const input = event.target.value.trim();
        console.log("Command entered:", input);
        event.target.value = ''; // Clear input

        if (input.startsWith('run:')) {
            const command = input.substring(4).trim();
            executeCommand(command);
        } else {
            console.warn("Invalid command format. Use 'run: [command]'");
        }
    }
}

/**
 * Executes a command from the command line.
 * @param {string} command - The command string.
 */
function executeCommand(command) {
    // This is where you'll implement command logic (e.g., filtering orbs)
    console.log("Executing command:", command);
    // Example: if (command === 'show all') { showAllOrbs(); }
    // More complex commands will involve parsing and acting on orb properties
}


/**
 * Fetches terms from Firestore and creates 3D orbs based on their properties.
 */
async function fetchAndDisplayOrbs() {
    // Clear existing orbs from scene and arrays
    orbs.forEach(orb => scene.remove(orb));
    orbs.length = 0;
    orbData.length = 0;

    try {
        const termsCollectionRef = collection(_db, `artifacts/${_appId}/public/data/terms`);
        const snapshot = await getDocs(termsCollectionRef);

        if (snapshot.empty) {
            console.log("No terms found in the database for orb generation.");
            orbContainer.innerHTML = '<p class="text-gray-400">No terms to display. Add some in Admin Mode!</p>';
            return;
        }

        const orbPositions = [];
        const maxAttempts = 1000; // Limit attempts to find non-overlapping positions
        const minDistance = 1; // Minimum distance between orb centers

        snapshot.forEach(doc => {
            const term = doc.data();
            orbData.push(term);

            // Determine orb properties from tags
            let color = 0x0077ff; // Default blue
            let radius = 0.5; // Default size
            let speed = 0.01; // Default speed
            let motionType = 'random'; // Default motion

            if (term.definitions && term.definitions.length > 0) {
                term.definitions.forEach(def => {
                    def.tags.forEach(tag => {
                        const [key, value] = tag.split(':');
                        if (key === 'color') {
                            // Convert color name or hex string to Three.js color
                            color = new _THREE.Color(value);
                        } else if (key === 'size') {
                            if (value === 'small') radius = 0.3;
                            else if (value === 'medium') radius = 0.6;
                            else if (value === 'large') radius = 0.9;
                            else radius = parseFloat(value) || 0.5;
                        } else if (key === 'speed') {
                            if (value === 'slow') speed = 0.005;
                            else if (value === 'medium') speed = 0.01;
                            else if (value === 'fast') speed = 0.02;
                            else speed = parseFloat(value) || 0.01;
                        } else if (key === 'motion') {
                            motionType = value; // e.g., 'repulse', 'attract'
                        }
                    });
                });
            }

            // Find a non-overlapping position for the orb
            let positionFound = false;
            let pos;
            for (let i = 0; i < maxAttempts; i++) {
                // Generate a random position within a sphere
                const x = (Math.random() - 0.5) * 10;
                const y = (Math.random() - 0.5) * 10;
                const z = (Math.random() - 0.5) * 10;
                pos = new _THREE.Vector3(x, y, z);

                let overlap = false;
                for (const existingPos of orbPositions) {
                    if (existingPos.distanceTo(pos) < (radius * 2 + minDistance)) { // Check for overlap
                        overlap = true;
                        break;
                    }
                }
                if (!overlap) {
                    positionFound = true;
                    orbPositions.push(pos);
                    break;
                }
            }

            if (!positionFound) {
                console.warn("Could not find non-overlapping position for an orb. Placing it anyway.");
                // Fallback: just place it, might overlap
                const x = (Math.random() - 0.5) * 10;
                const y = (Math.random() - 0.5) * 10;
                const z = (Math.random() - 0.5) * 10;
                pos = new _THREE.Vector3(x, y, z);
                orbPositions.push(pos);
            }

            // Create Orb Mesh
            const geometry = new _THREE.SphereGeometry(radius, 32, 32);
            const material = new _THREE.MeshPhongMaterial({ color: color, flatShading: true }); // PhongMaterial for lighting effects
            const mesh = new _THREE.Mesh(geometry, material);
            mesh.position.copy(pos);

            // Store orb properties on the mesh for animation
            mesh.userData.termData = term;
            mesh.userData.speed = speed;
            mesh.userData.motionType = motionType;

            scene.add(mesh);
            orbs.push(mesh);
        });

        if (orbs.length > 0) {
            orbContainer.innerHTML = ''; // Clear "No terms" message if orbs are generated
        }


    } catch (error) {
        console.error("Error fetching or creating orbs:", error);
        orbContainer.innerHTML = '<p class="text-red-400">Error displaying orbs. Check console.</p>';
    }
}


/**
 * Animation loop for the orbs.
 */
function animate() {
    requestAnimationFrame(animate);

    orbs.forEach(orb => {
        // Simple rotation for all orbs
        orb.rotation.x += 0.01;
        orb.rotation.y += 0.01;

        // Basic movement based on speed
        // This can be expanded to more complex tag-driven motion
        orb.position.x += Math.sin(Date.now() * 0.0001 * orb.userData.speed) * 0.01;
        orb.position.y += Math.cos(Date.now() * 0.0001 * orb.userData.speed) * 0.01;
    });

    renderer.render(scene, camera);
}
