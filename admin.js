// js/admin.js
// This file contains all logic specific to the Admin Panel.

let _db;
let _auth;
let _appId;
let _currentUserId;
let _serverTimestamp;
let definitionCounter = 0; // Tracks the number of definition blocks in the form

/**
 * Initializes the Admin module with Firebase instances and user details.
 * @param {object} db - Firestore database instance.
 * @param {object} auth - Firebase Auth instance.
 * @param {string} appId - The application ID.
 * @param {string} currentUserId - The current authenticated user's ID.
 * @param {function} serverTimestamp - Firebase serverTimestamp function.
 */
export function initAdmin(db, auth, appId, currentUserId, serverTimestamp) {
    _db = db;
    _auth = auth;
    _appId = appId;
    _currentUserId = currentUserId;
    _serverTimestamp = serverTimestamp;

    console.log("Admin module initialized.");

    // UI elements specific to Admin panel
    const addDefinitionBtn = document.getElementById('add-definition-btn');
    const definitionsContainer = document.getElementById('definitions-container');
    const termForm = document.getElementById('term-form');
    const saveTermBtn = document.getElementById('save-term-btn');
    const saveBtnText = document.getElementById('save-btn-text');
    const saveSpinner = document.getElementById('save-spinner');
    const statusMessage = document.getElementById('status-message');

    // Attach event listeners
    if (addDefinitionBtn) {
        addDefinitionBtn.addEventListener('click', addDefinitionBlock);
    }
    if (termForm) {
        termForm.addEventListener('submit', handleSaveTerm);
    }

    // Add an initial definition block when the admin panel loads
    addDefinitionBlock();

    // Set initial state of save button based on authentication
    if (saveTermBtn) {
        saveTermBtn.disabled = !(_auth.currentUser && _auth.currentUser.uid);
    }
}

/**
 * Adds a new definition block to the form.
 */
function addDefinitionBlock() {
    definitionCounter++;
    const block = document.createElement('div');
    block.className = 'definition-block bg-gray-700 p-4 rounded-lg border border-gray-600';
    block.innerHTML = `
        <label class="block text-sm font-medium text-gray-300 mb-1">Definition ${definitionCounter}</label>
        <textarea required class="definition-text w-full bg-gray-600 border border-gray-500 rounded-md px-3 py-2 text-white focus:outline-none focus:ring-1 focus:ring-cyan-500" rows="3" placeholder="Explain the term..."></textarea>
        <label class="block text-sm font-medium text-gray-300 mt-2 mb-1">Tags (comma-separated, e.g., color:red, type:process)</label>
        <input type="text" class="definition-tags w-full bg-gray-600 border border-gray-500 rounded-md px-3 py-2 text-white focus:outline-none focus:ring-1 focus:ring-cyan-500" placeholder="e.g., biology:core, origin:manual">
    `;
    const definitionsContainer = document.getElementById('definitions-container');
    if (definitionsContainer) {
        definitionsContainer.appendChild(block);
    }
}

/**
 * Handles the saving of a term to Firestore.
 * Collects data from the form, validates, and uploads.
 * @param {Event} event - The form submission event.
 */
async function handleSaveTerm(event) {
    event.preventDefault(); // Prevent default form submission

    const saveTermBtn = document.getElementById('save-term-btn');
    const saveBtnText = document.getElementById('save-btn-text');
    const saveSpinner = document.getElementById('save-spinner');
    const statusMessage = document.getElementById('status-message');

    // Show loading state
    saveTermBtn.disabled = true;
    saveBtnText.textContent = 'Saving...';
    saveSpinner.classList.remove('hidden');
    statusMessage.textContent = '';
    statusMessage.classList.remove('text-red-500', 'text-green-500');
    statusMessage.classList.add('text-yellow-400');

    try {
        const termInput = document.getElementById('term');
        const noteInput = document.getElementById('note');
        const definitionTexts = document.querySelectorAll('.definition-text');
        const definitionTags = document.querySelectorAll('.definition-tags');

        const termName = termInput ? termInput.value.trim() : '';
        const note = noteInput ? noteInput.value.trim() : '';

        if (!termName) {
            statusMessage.textContent = 'Error: Term name is required.';
            statusMessage.classList.replace('text-yellow-400', 'text-red-500');
            return;
        }
        if (definitionTexts.length === 0) {
            statusMessage.textContent = 'Error: At least one definition is required.';
            statusMessage.classList.replace('text-yellow-400', 'text-red-500');
            return;
        }

        const definitions = [];
        let totalTagsCount = 0;

        definitionTexts.forEach((textInput, index) => {
            const definitionText = textInput.value.trim();
            const tagsInput = definitionTags[index] ? definitionTags[index].value.trim() : '';

            const tagsArray = tagsInput.split(',').map(tag => tag.trim()).filter(tag => tag !== '');

            if (definitionText) {
                definitions.push({
                    text: definitionText,
                    tags: tagsArray,
                    modified: _serverTimestamp() // Auto-add modified timestamp for new definitions
                });
                totalTagsCount += tagsArray.length;
            }
        });

        if (definitions.length === 0) {
            statusMessage.textContent = 'Error: No valid definitions found. Please fill in at least one.';
            statusMessage.classList.replace('text-yellow-400', 'text-red-500');
            return;
        }

        // Construct the term object adhering to the schema
        const newTerm = {
            term: termName,
            note: note,
            indexDefs: definitions.length,
            indexTags: totalTagsCount,
            definitions: definitions,
            createdBy: _currentUserId,
            createdAt: _serverTimestamp(),
            updatedAt: _serverTimestamp()
        };

        // Save to Firestore
        // Collection path: artifacts/{appId}/public/data/terms
        const termsCollectionRef = collection(_db, `artifacts/${_appId}/public/data/terms`);
        await addDoc(termsCollectionRef, newTerm);

        statusMessage.textContent = 'Term saved successfully!';
        statusMessage.classList.replace('text-yellow-400', 'text-green-500');

        // Clear the form after successful save
        termInput.value = '';
        if (noteInput) noteInput.value = '';
        definitionsContainer.innerHTML = '';
        definitionCounter = 0;
        addDefinitionBlock(); // Add back one empty definition block

    } catch (error) {
        console.error("Error saving term:", error);
        statusMessage.textContent = `Error saving term: ${error.message}`;
        statusMessage.classList.replace('text-yellow-400', 'text-red-500');
    } finally {
        // Reset loading state
        saveTermBtn.disabled = false;
        saveBtnText.textContent = 'Save Term';
        saveSpinner.classList.add('hidden');
    }
}

// Ensure the initial save button state is correct when admin.js loads
document.addEventListener('DOMContentLoaded', () => {
    const saveBtn = document.getElementById('save-term-btn');
    if (saveBtn && _auth) { // _auth might not be fully initialized yet on initial DOMContentLoad
         // This will be properly set by the onAuthStateChanged listener in index.html
         // and then later reinforced by the initAdmin call.
        saveBtn.disabled = true; // Default to disabled until auth confirms
    }
});
