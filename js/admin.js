// js/admin.js
// This file contains all logic specific to the Admin Panel.

import { addDoc, getDocs, deleteDoc, doc, updateDoc, query, where } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js";

let _db;
let _auth;
let _appId;
let _currentUserId;
let _serverTimestamp;
let _Papa;
let _showConfirmModal; // Function to show the custom confirmation modal
let _collection;
let _query;
let _where;
let _addDoc;
let _getDocs;
let _doc;
let _updateDoc;
let _deleteDoc;

let definitionCounter = 0; // Tracks the number of definition blocks in the form
let termsCollectionRef; // Reference to the Firestore terms collection

// Define expected and alternative column headers for rehash logic
const COLUMN_MAPPINGS = {
    'term': ['Term', 'Concept', 'Word', 'Name'],
    'note': ['Note', 'Description', 'Summary'],
    'definition': ['Definition', 'Meaning', 'deff', 'Explanation'],
    'tags': ['Tags', 'Keywords', 'Categories']
};

/**
 * Initializes the Admin module with Firebase instances, user details, and external libraries.
 * @param {object} db - Firestore database instance.
 * @param {object} auth - Firebase Auth instance.
 * @param {string} appId - The application ID.
 * @param {string} currentUserId - The current authenticated user's ID.
 * @param {function} serverTimestamp - Firebase serverTimestamp function.
 * @param {object} Papa - Papa Parse library instance.
 * @param {function} showConfirmModal - Function to display the custom confirmation modal.
 * @param {function} collectionFn - The Firestore 'collection' function.
 * @param {function} queryFn - The Firestore 'query' function.
 * @param {function} whereFn - The Firestore 'where' function.
 * @param {function} addDocFn - The Firestore 'addDoc' function.
 * @param {function} getDocsFn - The Firestore 'getDocs' function.
 * @param {function} docFn - The Firestore 'doc' function.
 * @param {function} updateDocFn - The Firestore 'updateDoc' function.
 * @param {function} deleteDocFn - The Firestore 'deleteDoc' function.
 */
export function initAdmin(db, auth, appId, currentUserId, serverTimestamp, Papa, showConfirmModal, collectionFn, queryFn, whereFn, addDocFn, getDocsFn, docFn, updateDocFn, deleteDocFn) {
    _db = db;
    _auth = auth;
    _appId = appId;
    _currentUserId = currentUserId;
    _serverTimestamp = serverTimestamp;
    _Papa = Papa;
    _showConfirmModal = showConfirmModal;
    _collection = collectionFn;
    _query = queryFn;
    _where = whereFn;
    _addDoc = addDocFn;
    _getDocs = getDocsFn;
    _doc = docFn;
    _updateDoc = updateDocFn;
    _deleteDoc = deleteDocFn;

    termsCollectionRef = _collection(_db, `artifacts/${_appId}/public/data/terms`);

    console.log("Admin module initialized. App ID:", _appId);

    // UI elements specific to Admin panel - ensure they are present after innerHTML update in index.html
    const addDefinitionBtn = document.getElementById('add-definition-btn');
    const termForm = document.getElementById('term-form');
    const saveTermBtn = document.getElementById('save-term-btn');
    const refreshTermsBtn = document.getElementById('refresh-terms-btn');
    const csvFileInput = document.getElementById('csv-file-input');
    const importCsvBtn = document.getElementById('import-csv-btn');
    const clearDatabaseBtn = document.getElementById('clear-database-btn');

    // Attach event listeners
    if (addDefinitionBtn) addDefinitionBtn.addEventListener('click', addDefinitionBlock);
    if (termForm) termForm.addEventListener('submit', handleSaveTerm);
    if (refreshTermsBtn) refreshTermsBtn.addEventListener('click', displayTermsMatrix);
    if (importCsvBtn) importCsvBtn.addEventListener('click', handleImportCsv);
    if (clearDatabaseBtn) clearDatabaseBtn.addEventListener('click', handleClearDatabase);

    // Add an initial definition block when the admin panel loads
    addDefinitionBlock();

    // Set initial state of save button based on authentication
    if (saveTermBtn) {
        saveTermBtn.disabled = !(_auth.currentUser && _auth.currentUser.uid);
    }

    // Display existing terms on load
    displayTermsMatrix();
}

/**
 * Displays existing terms from Firestore in a scrollable matrix (table).
 */
async function displayTermsMatrix() {
    const termsMatrixBody = document.getElementById('terms-matrix-body');
    if (!termsMatrixBody) return;

    termsMatrixBody.innerHTML = '<tr><td colspan="3" class="text-center py-4">Loading terms...</td></tr>';

    try {
        const snapshot = await _getDocs(termsCollectionRef);
        if (snapshot.empty) {
            termsMatrixBody.innerHTML = '<tr><td colspan="3" class="text-center py-4 text-gray-400">No terms found in the database.</td></tr>';
            return;
        }

        let html = '';
        snapshot.forEach(doc => {
            const termData = doc.data();
            html += `
                <tr class="bg-gray-800 border-b border-gray-700 hover:bg-gray-600">
                    <th scope="row" class="py-3 px-6 font-medium text-white whitespace-nowrap">${termData.term}</th>
                    <td class="py-3 px-6 text-center">${termData.indexDefs || 0}</td>
                    <td class="py-3 px-6 text-center">${termData.indexTags || 0}</td>
                </tr>
            `;
        });
        termsMatrixBody.innerHTML = html;
    } catch (error) {
        console.error("Error fetching terms for matrix:", error);
        termsMatrixBody.innerHTML = `<tr><td colspan="3" class="text-center py-4 text-red-400">Error loading terms: ${error.message}</td></tr>`;
    }
}

/**
 * Adds a new definition block to the form for single term entry.
 */
function addDefinitionBlock() {
    definitionCounter++;
    const definitionsContainer = document.getElementById('definitions-container');
    if (!definitionsContainer) return;

    const block = document.createElement('div');
    block.className = 'definition-block bg-gray-700 p-4 rounded-lg border border-gray-600';
    block.innerHTML = `
        <label class="block text-sm font-medium text-gray-300 mb-1">Definition ${definitionCounter}</label>
        <textarea required class="definition-text w-full bg-gray-600 border border-gray-500 rounded-md px-3 py-2 text-white focus:outline-none focus:ring-1 focus:ring-cyan-500" rows="3" placeholder="Explain the term..."></textarea>
        <label class="block text-sm font-medium text-gray-300 mt-2 mb-1">Tags (comma-separated, e.g., color:red, type:process, origin:manual)</label>
        <input type="text" class="definition-tags w-full bg-gray-600 border border-gray-500 rounded-md px-3 py-2 text-white focus:outline-none focus:ring-1 focus:ring-cyan-500" placeholder="e.g., biology:core, color:green">
    `;
    definitionsContainer.appendChild(block);
}

/**
 * Handles the saving of a single term to Firestore.
 * It will either add a new term or merge with an existing one.
 * @param {Event} event - The form submission event.
 */
async function handleSaveTerm(event) {
    event.preventDefault();

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
        if (definitionTexts.length === 0 || Array.from(definitionTexts).every(input => !input.value.trim())) {
            statusMessage.textContent = 'Error: At least one definition is required.';
            statusMessage.classList.replace('text-yellow-400', 'text-red-500');
            return;
        }

        const incomingDefinitions = [];
        definitionTexts.forEach((textInput, index) => {
            const definitionText = textInput.value.trim();
            const tagsInput = definitionTags[index] ? definitionTags[index].value.trim() : '';
            const tagsArray = tagsInput.split(',').map(tag => tag.trim()).filter(tag => tag !== '');

            if (definitionText) {
                incomingDefinitions.push({
                    text: definitionText,
                    tags: tagsArray,
                    origin: 'manual' // Default origin for manual entry
                });
            }
        });

        if (incomingDefinitions.length === 0) {
            statusMessage.textContent = 'Error: No valid definitions found. Please fill in at least one.';
            statusMessage.classList.replace('text-yellow-400', 'text-red-500');
            return;
        }

        // Check if term already exists
        const q = _query(termsCollectionRef, _where('term', '==', termName));
        const querySnapshot = await _getDocs(q);

        let termId = null;
        let existingTermData = null;

        if (!querySnapshot.empty) {
            termId = querySnapshot.docs[0].id;
            existingTermData = querySnapshot.docs[0].data();
        }

        let definitionsToSave = existingTermData ? [...existingTermData.definitions] : [];
        let definitionsAddedCount = 0;
        let definitionsUpdatedCount = 0;

        incomingDefinitions.forEach(newDef => {
            const existingDefIndex = definitionsToSave.findIndex(def => def.text === newDef.text);

            if (existingDefIndex !== -1) {
                // Definition exists, check if tags need merging/updating
                const existingDef = definitionsToSave[existingDefIndex];
                const mergedTags = Array.from(new Set([...existingDef.tags, ...newDef.tags])); // Merge tags, remove duplicates

                if (existingDef.tags.length !== mergedTags.length || !existingDef.tags.every(tag => mergedTags.includes(tag))) {
                    // Tags have changed or new tags added
                    definitionsToSave[existingDefIndex] = {
                        ...existingDef,
                        tags: mergedTags,
                        modified: _serverTimestamp()
                    };
                    definitionsUpdatedCount++;
                }
            } else {
                // New definition
                definitionsToSave.push({
                    ...newDef,
                    createdAt: _serverTimestamp(),
                    modified: _serverTimestamp() // Also add modified for new definitions
                });
                definitionsAddedCount++;
            }
        });

        const totalIndexDefs = definitionsToSave.length;
        const totalIndexTags = definitionsToSave.reduce((acc, def) => acc + def.tags.length, 0);

        const termDataToSave = {
            term: termName,
            note: note,
            indexDefs: totalIndexDefs,
            indexTags: totalIndexTags,
            definitions: definitionsToSave,
            updatedAt: _serverTimestamp(),
            // createdBy and createdAt are set only for truly new terms
            ...(termId ? {} : { createdBy: _currentUserId, createdAt: _serverTimestamp() })
        };

        if (termId) {
            // Update existing term
            await _updateDoc(_doc(_db, `artifacts/${_appId}/public/data/terms`, termId), termDataToSave);
            statusMessage.textContent = `Term "${termName}" updated successfully! Added ${definitionsAddedCount} new definitions, updated ${definitionsUpdatedCount} definitions.`;
        } else {
            // Add new term
            await _addDoc(termsCollectionRef, termDataToSave);
            statusMessage.textContent = `Term "${termName}" added successfully!`;
        }

        statusMessage.classList.replace('text-yellow-400', 'text-green-500');

        // Clear the form after successful save
        termInput.value = '';
        if (noteInput) noteInput.value = '';
        document.getElementById('definitions-container').innerHTML = '';
        definitionCounter = 0;
        addDefinitionBlock(); // Add back one empty definition block
        displayTermsMatrix(); // Refresh the displayed terms

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

/**
 * Attempts to rehash a row from CSV data based on predefined column mappings.
 * It tries to find the best match for 'term', 'note', 'definition', and 'tags'.
 * @param {object} row - The raw row object parsed by PapaParse.
 * @param {Array<string>} headers - The original headers from the CSV.
 * @returns {object|null} - A rehashed row object with standard keys, or null if essential data is missing.
 */
function rehashCsvRow(row, headers) {
    const rehashedRow = {};
    let termFound = false;
    let definitionFound = false;

    for (const internalKey in COLUMN_MAPPINGS) {
        const possibleHeaders = COLUMN_MAPPINGS[internalKey];
        for (const header of possibleHeaders) {
            // Check original header casing and lowercase version
            if (row[header] !== undefined) {
                rehashedRow[internalKey] = String(row[header]).trim();
                if (internalKey === 'term' && rehashedRow[internalKey] !== '') termFound = true;
                if (internalKey === 'definition' && rehashedRow[internalKey] !== '') definitionFound = true;
                break; // Found a match for this internal key, move to next
            }
            // Check case-insensitive match
            const caseInsensitiveHeader = headers.find(h => h.toLowerCase() === header.toLowerCase());
            if (caseInsensitiveHeader && row[caseInsensitiveHeader] !== undefined) {
                 rehashedRow[internalKey] = String(row[caseInsensitiveHeader]).trim();
                 if (internalKey === 'term' && rehashedRow[internalKey] !== '') termFound = true;
                 if (internalKey === 'definition' && rehashedRow[internalKey] !== '') definitionFound = true;
                 break;
            }
        }
        // If no matching header found, set to empty string
        if (rehashedRow[internalKey] === undefined) {
            rehashedRow[internalKey] = '';
        }
    }

    // Critical validation: A term and at least one definition are required for a valid entry
    if (!termFound || !definitionFound) {
        return null; // This row cannot be meaningfully rehashed or is incomplete
    }

    return rehashedRow;
}


/**
 * Handles CSV file import, parsing data and merging it into the database.
 * Includes rehash logic for column mapping.
 * @param {File} file - The CSV file to import.
 * @param {string} fileName - The name of the imported file.
 * @param {HTMLElement} importStatusMessage - The element to display import status.
 */
async function processCsvFile(file, fileName, importStatusMessage) {
    importStatusMessage.textContent = `Importing "${fileName}"... (Parsing)`;
    importStatusMessage.classList.remove('text-red-500', 'text-green-500');
    importStatusMessage.classList.add('text-yellow-400');

    let parsedData;
    try {
        console.log(`Attempting to parse CSV file: ${fileName}`);
        parsedData = await new Promise((resolve, reject) => {
            _Papa.parse(file, {
                header: true, // Treat first row as headers
                skipEmptyLines: true,
                dynamicTyping: true, // Attempt to convert numbers/booleans
                complete: function(results) {
                    console.log("PapaParse complete results:", results);
                    if (results.errors.length) {
                        reject(new Error(`CSV parsing errors: ${results.errors.map(e => e.message).join('; ')}`));
                    } else {
                        resolve(results.data);
                    }
                },
                error: function(err) {
                    console.error("PapaParse error:", err);
                    reject(err);
                }
            });
        });

        console.log("Raw Parsed Data:", parsedData);

        if (!parsedData || parsedData.length === 0) {
            importStatusMessage.textContent = 'CSV file is empty or could not be parsed into meaningful data.';
            importStatusMessage.classList.replace('text-yellow-400', 'text-red-500');
            return;
        }

        // Get actual headers from parsed data (PapaParse provides them in the first object's keys)
        const actualHeaders = parsedData.length > 0 ? Object.keys(parsedData[0]) : [];
        console.log("Actual CSV Headers:", actualHeaders);

        const rehashedData = [];
        let rowsSkippedDueToRehash = 0;
        parsedData.forEach((row, index) => {
            const rehashedRow = rehashCsvRow(row, actualHeaders);
            if (rehashedRow) {
                rehashedData.push(rehashedRow);
            } else {
                rowsSkippedDueToRehash++;
                console.warn(`Skipped row ${index + 1} due to insufficient data after rehash:`, row);
            }
        });

        console.log("Rehashed Data:", rehashedData);
        if (rehashedData.length === 0) {
             importStatusMessage.textContent = `No valid terms found in the CSV file after rehash. ${rowsSkippedDueToRehash} rows skipped.`;
             importStatusMessage.classList.replace('text-yellow-400', 'text-red-500');
             return;
        }


        importStatusMessage.textContent = `Processing ${rehashedData.length} valid rows from "${fileName}"...`;

        // Group data by term, assuming one row per definition for a term after rehash
        const termsToProcess = {};
        rehashedData.forEach(row => {
            const termName = row.term; // Use the rehashed 'term' key
            if (!termsToProcess[termName]) {
                termsToProcess[termName] = {
                    term: termName,
                    note: row.note, // Use rehashed 'note' key
                    definitions: []
                };
            }

            const definitionText = row.definition; // Use rehashed 'definition' key
            const tagsInput = row.tags; // Use rehashed 'tags' key
            const tagsArray = tagsInput.split(',').map(tag => tag.trim()).filter(tag => tag !== '');

            if (definitionText) {
                termsToProcess[termName].definitions.push({
                    text: definitionText,
                    tags: tagsArray,
                    origin: fileName // Origin from the imported file
                });
            }
        });

        console.log("Terms grouped for processing:", termsToProcess);
        if (Object.keys(termsToProcess).length === 0) {
            importStatusMessage.textContent = 'No valid terms found in the CSV file after grouping parsed data.';
            importStatusMessage.classList.replace('text-yellow-400', 'text-red-500');
            return;
        }

        let termsAdded = 0;
        let termsUpdated = 0;
        let definitionsSkipped = 0;
        let definitionsAdded = 0;
        let definitionsUpdated = 0;
        let totalTermsInCsv = Object.keys(termsToProcess).length;
        let termsProcessedCount = 0;

        for (const termName in termsToProcess) {
            termsProcessedCount++;
            importStatusMessage.textContent = `Processing term ${termsProcessedCount} of ${totalTermsInCsv}: "${termName}"...`;
            const incomingTermData = termsToProcess[termName];

            // Check if term already exists in Firestore
            const q = _query(termsCollectionRef, _where('term', '==', termName));
            const querySnapshot = await _getDocs(q);

            let termDocId = null;
            let existingTermFirestoreData = null;

            if (!querySnapshot.empty) {
                termDocId = querySnapshot.docs[0].id;
                existingTermFirestoreData = querySnapshot.docs[0].data();
            }

            let definitionsForFirestore = existingTermFirestoreData ? [...(existingTermFirestoreData.definitions || [])] : []; // Ensure definitions array exists
            let termWasUpdated = false;

            // Merge definitions
            incomingTermData.definitions.forEach(newDef => {
                const existingDefIndex = definitionsForFirestore.findIndex(def => def.text === newDef.text);

                if (existingDefIndex !== -1) {
                    // Definition text is a duplicate. Check and merge tags.
                    const existingDef = definitionsForFirestore[existingDefIndex];
                    const mergedTags = Array.from(new Set([...(existingDef.tags || []), ...newDef.tags])); // Ensure tags array exists before spread

                    if (existingDef.tags.length !== mergedTags.length || !existingDef.tags.every(tag => mergedTags.includes(tag))) {
                        // Tags have changed or new tags added
                        definitionsForFirestore[existingDefIndex] = {
                            ...existingDef,
                            tags: mergedTags,
                            modified: _serverTimestamp() // Mark as modified
                        };
                        definitionsUpdated++;
                        termWasUpdated = true;
                    } else {
                        definitionsSkipped++; // Definition and tags are identical
                    }
                } else {
                    // New definition
                    definitionsForFirestore.push({
                        ...newDef,
                        createdAt: _serverTimestamp(),
                        modified: _serverTimestamp() // Also mark new definitions as modified
                    });
                    definitionsAdded++;
                    termWasUpdated = true;
                }
            });

            // Calculate updated indices
            const newIndexDefs = definitionsForFirestore.length;
            const newIndexTags = definitionsForFirestore.reduce((acc, def) => acc + (def.tags ? def.tags.length : 0), 0); // Handle potential undefined tags

            const dataToSave = {
                term: incomingTermData.term,
                note: incomingTermData.note,
                indexDefs: newIndexDefs,
                indexTags: newIndexTags,
                definitions: definitionsForFirestore,
                updatedAt: _serverTimestamp()
            };

            if (termDocId) {
                // Update existing term document
                await _updateDoc(_doc(_db, `artifacts/${_appId}/public/data/terms`, termDocId), dataToSave);
                if (termWasUpdated) {
                    termsUpdated++;
                }
            } else {
                // Add new term document
                dataToSave.createdBy = _currentUserId;
                dataToSave.createdAt = _serverTimestamp();
                await _addDoc(termsCollectionRef, dataToSave);
                termsAdded++;
            }
        }

        importStatusMessage.textContent = `Import complete: ${termsAdded} terms added, ${termsUpdated} terms updated. ${definitionsAdded} new definitions added, ${definitionsUpdated} existing definitions updated, ${definitionsSkipped} definitions skipped. ${rowsSkippedDueToRehash} rows skipped due to rehash issues.`;
        importStatusMessage.classList.replace('text-yellow-400', 'text-green-500');
        displayTermsMatrix(); // Refresh the matrix
        csvFileInput.value = ''; // Clear file input

    } catch (error) {
        console.error("Error importing CSV:", error);
        importStatusMessage.textContent = `Error importing CSV: ${error.message}`;
        importStatusMessage.classList.replace('text-yellow-400', 'text-red-500');
    }
}

/**
 * Handles the 'Import CSV' button click.
 */
async function handleImportCsv() {
    const csvFileInput = document.getElementById('csv-file-input');
    const importStatusMessage = document.getElementById('import-status-message');
    if (!csvFileInput || !csvFileInput.files.length) {
        importStatusMessage.textContent = 'Please select a CSV file.';
        importStatusMessage.classList.remove('text-yellow-400', 'text-green-500');
        importStatusMessage.classList.add('text-red-500');
        return;
    }
    const file = csvFileInput.files[0];
    await processCsvFile(file, file.name, importStatusMessage);
}


/**
 * Handles clearing all terms from the database with a confirmation step.
 */
async function handleClearDatabase() {
    const clearDatabaseBtn = document.getElementById('clear-database-btn');
    clearDatabaseBtn.disabled = true; // Disable button during operation
    const importStatusMessage = document.getElementById('import-status-message'); // Reuse for general status

    const isConfirmed = await _showConfirmModal(
        "Confirm Database Clear",
        "This action will permanently delete ALL terms from the database. Are you absolutely sure?"
    );

    if (!isConfirmed) {
        console.log("Database clear canceled.");
        clearDatabaseBtn.disabled = false; // Re-enable button
        importStatusMessage.textContent = 'Database clear cancelled.';
        importStatusMessage.classList.remove('text-red-500', 'text-green-500');
        importStatusMessage.classList.add('text-yellow-400');
        return;
    }

    importStatusMessage.textContent = 'Clearing database...';
    importStatusMessage.classList.remove('text-red-500', 'text-green-500');
    importStatusMessage.classList.add('text-yellow-400');

    try {
        const snapshot = await _getDocs(termsCollectionRef);
        if (snapshot.empty) {
            importStatusMessage.textContent = 'Database is already empty.';
            importStatusMessage.classList.replace('text-yellow-400', 'text-green-500');
            return;
        }

        const deletePromises = [];
        snapshot.forEach(docItem => {
            deletePromises.push(_deleteDoc(_doc(termsCollectionRef, docItem.id)));
        });

        await Promise.all(deletePromises);
        importStatusMessage.textContent = `Successfully cleared ${snapshot.size} terms from the database.`;
        importStatusMessage.classList.replace('text-yellow-400', 'text-green-500');
        displayTermsMatrix(); // Refresh the matrix to show it's empty

    } catch (error) {
        console.error("Error clearing database:", error);
        importStatusMessage.textContent = `Error clearing database: ${error.message}`;
        importStatusMessage.classList.replace('text-yellow-400', 'text-red-500');
    } finally {
        clearDatabaseBtn.disabled = false; // Re-enable button
    }
}
