// js/explorer.js
// This file contains all logic specific to the Explorer Mode.

// Core Three.js via importmap
import * as THREE from 'three';

// Post-processing via mapped imports
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js';

let _db;
let _appId;
let _collection;
let _query;
let _getDocs;

// Three.js variables
let scene, camera, renderer;
let composer; // New: Declare composer for post-processing
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

    // Setup scene, camera, and renderer, and post-processing composer
    setupScene(orbDisplayArea);
    // Add lighting to the scene
    setupLighting();
    // Setup mouse interaction for scene manipulation
    setupOrbsAreaInteraction(orbDisplayArea, commandInput);

    // Start the animation loop
    animate();
}

/**
 * Sets up the Three.js scene, camera, renderer, and post-processing composer.
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
    camera.position.z = 20; // Adjusted initial camera distance for better bloom visibility
    camera.position.y = 0;
    camera.position.x = 0;

    renderer = new THREE.WebGLRenderer({ antialias: true }); // Antialiasing for smoother edges
    renderer.setSize(orbDisplayArea.clientWidth, orbDisplayArea.clientHeight);
    orbDisplayArea.appendChild(renderer.domElement);

    // Enable shadow maps on the renderer for lights to cast shadows
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap; // Softer shadows

    // --- NEW: Setup EffectComposer for post-processing ---
    composer = new EffectComposer(renderer);
    composer.addPass(new RenderPass(scene, camera));

    // UnrealBloomPass parameters: strength, radius, threshold
    // strength: How intense the glow is (higher = more bloom)
    // radius: How far the glow spreads (higher = wider glow)
    // threshold: Only pixels brighter than this value will bloom (0 = everything blooms, 1 = only brightest)
    const bloomPass = new UnrealBloomPass(
        new THREE.Vector2(orbDisplayArea.clientWidth, orbDisplayArea.clientHeight),
        1.5, // strength
        0.5, // radius
        0.01 // threshold (a low threshold ensures more of the orb glows)
    );
    composer.addPass(bloomPass);

    // Handle window resizing to keep the scene responsive
    window.addEventListener('resize', () => {
        if (orbDisplayArea.clientWidth === 0 || orbDisplayArea.clientHeight === 0) return;
        camera.aspect = orbDisplayArea.clientWidth / orbDisplayArea.clientHeight;
        camera.updateProjectionMatrix();
        renderer.setSize(orbDisplayArea.clientWidth, orbDisplayArea.clientHeight);
        composer.setSize(orbDisplayArea.clientWidth, orbDisplayArea.clientHeight); // Update composer size too
    });
}

/**
 * Adds lights to the Three.js scene.
 */
function setupLighting() {
    // Ambient Light: Provides a basic level of light to all objects in the scene equally.
    const ambientLight = new THREE.AmbientLight(0x404040, 2);
    scene.add(ambientLight);

    // Directional Light: Simulates light from a distant source.
    const directionalLight1 = new THREE.DirectionalLight(0xffffff, 2);
    directionalLight1.position.set(5, 10, 7.5);
    directionalLight1.castShadow = true;
    scene.add(directionalLight1);

    const directionalLight2 = new THREE.DirectionalLight(0x80b3ff, 1);
    directionalLight2.position.set(-5, -10, -7.5);
    scene.add(directionalLight2);
}


/**
 * Sets up mouse interaction for orbiting the camera.
 * @param {HTMLElement} orbDisplayArea - The DOM element to attach event listeners to.
 * @param {HTMLElement} commandInput - The command input field.
 */
function setupOrbsAreaInteraction(orbDisplayArea, commandInput) {
    orbDisplayArea.addEventListener('mousedown', (e) => {
        if (e.target !== commandInput) {
            isDragging = true;
            previousMouseX = e.clientX;
            previousMouseY = e.clientY;
            orbDisplayArea.style.cursor = 'grabbing';
            e.preventDefault();
        }
    });

    orbDisplayArea.addEventListener('mousemove', (e) => {
        if (!isDragging) return;

        const deltaX = e.clientX - previousMouseX;
        const deltaY = e.clientY - previousMouseY;

        if (orbGroup) {
            orbGroup.rotation.y += deltaX * 0.005;
        }

        if (orbGroup) {
            const newRotationX = orbGroup.rotation.x + deltaY * 0.005;
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
        e.preventDefault();
        camera.position.z += e.deltaY * 0.05;
        if (camera.position.z < 5) camera.position.z = 5;
        if (camera.position.z > 50) camera.position.z = 50;
    });

    commandInput.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
            handleCommand(commandInput.value);
            commandInput.value = '';
        }
    });
}

/**
 * Fetches terms from Firestore.
 */
async function fetchTerms() {
    // Only attempt to fetch if Firestore is initialized
    if (!_db || !_collection || !_query || !_getDocs) {
        console.warn("Firestore functions not available. Cannot fetch terms.");
        return [];
    }
    const termsCollectionRef = _collection(_db, `artifacts/${_appId}/public/data/terms`);
    const q = _query(termsCollectionRef);
    const snapshot = await _getDocs(q);

    const fetchedTerms = [];
    snapshot.forEach(doc => {
        const data = doc.data();
        fetchedTerms.push({
            id: doc.id,
            term: data.term,
            definitions: data.definitions || [],
            tags: data.tags || [],
            style: data.style || {},
            position: data.position || null
        });
    });
    return fetchedTerms;
}

/**
 * Renders the orbs in the Three.js scene based on fetched terms data.
 */
function renderOrbs() {
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

    orbGroup = new THREE.Group();
    scene.add(orbGroup);

    if (termsData.length === 0) {
        console.log("No terms data to render orbs.");
        return;
    }

    const numOrbs = termsData.length;
    const spiralRadiusIncrement = 0.5;
    const spiralAngleIncrement = Math.PI * (3 - Math.sqrt(5)); // Golden angle

    termsData.forEach((term, index) => {
        const termId = term.id;
        const termName = term.term;
        const termColor = term.style && term.style.color ? new THREE.Color(term.style.color) : new THREE.Color(0x007bff);
        const scaledRadius = term.style && term.style.size ? ORB_RADIUS * term.style.size : ORB_RADIUS;

        const sphereGeometry = new THREE.SphereGeometry(scaledRadius, 32, 32);

        const orbMaterial = new THREE.MeshPhongMaterial({
            color: termColor,
            shininess: 80,
            specular: new THREE.Color(0x555555),
            emissive: termColor,
            emissiveIntensity: 0.5
        });

        const orb = new THREE.Mesh(sphereGeometry, orbMaterial);

        const angle = index * spiralAngleIncrement;
        const radius = index * spiralRadiusIncrement;
        orb.position.x = radius * Math.cos(angle);
        orb.position.y = radius * Math.sin(angle);
        orb.position.z = (index % 2 === 0 ? 1 : -1) * (index * 0.1);

        orb.userData = {
            id: termId,
            term: termName,
            definitions: term.definitions,
            tags: term.tags,
            style: {
                ...term.style,
                pulseSpeed: term.style && term.style.pulseSpeed ? term.style.pulseSpeed : 0.05,
                baseScale: scaledRadius
            }
        };

        orb.receiveShadow = true;
        orb.castShadow = true;

        orbGroup.add(orb);

        // Add text label as a Sprite
        const canvas = document.createElement('canvas');
        const context = canvas.getContext('2d');
        const fontSizePx = Math.ceil(FONT_SIZE * 100);
        context.font = `${fontSizePx}px Arial`;
        const textWidth = context.measureText(termName).width;
        canvas.width = textWidth + 10;
        canvas.height = fontSizePx + 10;
        context.font = `${fontSizePx}px Arial`;
        context.fillStyle = 'white';
        context.textAlign = 'center';
        context.textBaseline = 'middle';
        context.fillText(termName, canvas.width / 2, canvas.height / 2);

        const texture = new THREE.CanvasTexture(canvas);
        const spriteMaterial = new THREE.SpriteMaterial({ map: texture });
        const sprite = new THREE.Sprite(spriteMaterial);

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

    const orbs = orbGroup.children.filter(child => child.isMesh);

    const repulsionStrength = 0.005;
    const attractionStrength = 0.002;

    for (let i = 0; i < orbs.length; i++) {
        let orbA = orbs[i];
        let force = new THREE.Vector3(0, 0, 0);

        for (let j = 0; j < orbs.length; j++) {
            if (i === j) continue;

            let orbB = orbs[j];
            let diff = new THREE.Vector3().subVectors(orbA.position, orbB.position);
            let dist = diff.length();

            if (dist < 0.1) dist = 0.1;

            let repulse = diff.clone().normalize().multiplyScalar(repulsionStrength / dist);
            force.add(repulse);

            if (orbA.userData.tags && orbB.userData.tags) {
                const shared = orbA.userData.tags.filter(tag => orbB.userData.tags.includes(tag));
                if (shared.length > 0) {
                    let attract = diff.clone().normalize().multiplyScalar(-attractionStrength * shared.length);
                    force.add(attract);
                }
            }
        }
        orbA.position.add(force);

        const centerForce = orbA.position.clone().multiplyScalar(-0.0001);
        orbA.position.add(centerForce);

        const scaleBase = orbA.userData.style.baseScale;
        const pulseSpeed = orbA.userData.style.pulseSpeed;
        const pulseFactor = 1 + Math.sin(Date.now() * pulseSpeed) * 0.1;
        orbA.scale.setScalar(pulseFactor);

        // Update sprite position to stay with its orb
        const sprite = orbGroup.children.find(child => child.isSprite && child.position.x === orbA.position.x && child.position.y === orbA.position.y);
        if (sprite) {
            sprite.position.set(orbA.position.x, orbA.position.y + orbA.geometry.parameters.radius * orbA.scale.y + FONT_SIZE * 0.5, orbA.position.z);
        }
    }
}

/**
 * Main animation loop.
 */
function animate() {
    requestAnimationFrame(animate);

    applyForces();

    // Render the scene using the EffectComposer for post-processing effects
    if (composer) {
        composer.render();
    } else { // Fallback if composer somehow not initialized (shouldn't happen with current setup)
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

    const parts = fullCommandInput.split(':');
    if (parts.length > 1) {
        commandPrefix = parts[0].trim().toLowerCase();
        actualCommand = parts.slice(1).join(':').trim().toLowerCase();
    } else {
        actualCommand = fullCommandInput.toLowerCase();
    }

    console.log(`Executing command: '${commandPrefix}' with value: '${actualCommand}'`);

    switch (commandPrefix) {
        case 'run':
            commandInput.placeholder = "Loading orbs...";
            termsData = await fetchTerms();
            if (termsData.length > 0) {
                renderOrbs();
                commandInput.placeholder = `Orbs active! Displaying ${termsData.length} terms. Type 'clear:' to reset or 'run:' again.`;
            } else {
                commandInput.placeholder = "No terms found. Import some in Admin Mode first. Type 'run:' to try again.";
            }
            break;
        case 'clear':
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
            termsData = [];
            commandInput.placeholder = "Orbs cleared. Type 'run:' to load again.";
            break;
        case 'list':
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
