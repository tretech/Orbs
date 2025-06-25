import { db } from './firebase.js';
import { collection, doc, setDoc, updateDoc } from "https://www.gstatic.com/firebasejs/10.1.0/firebase-firestore.js";

export async function combineAndStructureTerms(rows) {
  const terms = {};
  for (const row of rows) {
    const term = row.Term.trim();
    if (!term) continue;
    const defText = row.Definition.trim();
    const tags = (row.Tags || 'PMP').split(',').map(t => t.trim().toLowerCase());

    if (!terms[term]) terms[term] = { term, definitions: [] };
    terms[term].definitions.push({
      id: crypto.randomUUID(),
      text: defText,
      tags,
      source: 'initial_csv'
    });
  }
  return Object.values(terms);
}

export async function importCSVFile(file, statusEl) {
  const text = await file.text();
  const rows = Papa.parse(text, { header: true }).data;
  const terms = await combineAndStructureTerms(rows);
  statusEl.textContent = `Importing ${terms.length} terms…`;

  for (const term of terms) {
    const docRef = doc(collection(db, 'terms'), term.term);
    await setDoc(docRef, {
      term: term.term,
      definitions: term.definitions
    });
  }

  statusEl.textContent = "✅ Import complete!";
}

if (location.pathname.endsWith('admin.html')) {
  document.getElementById('import-btn').addEventListener('click', () => {
    const file = document.getElementById('file-input').files[0];
    const status = document.getElementById('status');
    if (file) importCSVFile(file, status);
    else status.textContent = "❗ Please select a file.";
  });
}
