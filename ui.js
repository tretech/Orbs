import { db } from './firebase.js';
import { doc, updateDoc } from 'https://www.gstatic.com/firebasejs/10.1.0/firebase-firestore.js';
import { orbMesh, orbDataArray } from './orbs.js';

let currentOrb = null;
let currentDefinitionIndex = 0;
let definitionPanelVisible = false;

const panel = document.getElementById('definition-panel');
const textBox = document.getElementById('definition-text');
const aiBox = document.querySelector('.ai-suggestion');
const suggestionText = document.querySelector('.suggestion-text');

export function showDefinitionPanel(term) {
  currentDefinitionIndex = 0;
  updateDefinitionPanel(term);
  panel.classList.remove('hidden');
  definitionPanelVisible = true;
  playClickSound();
}

export function hideDefinitionPanel() {
  panel.classList.add('hidden');
  aiBox.classList.add('hidden');
  definitionPanelVisible = false;
}

export function cycleDefinition(dir) {
  const defs = currentOrb?.term?.definitions || [];
  if (!defs.length) return;
  currentDefinitionIndex = (currentDefinitionIndex + dir + defs.length) % defs.length;
  updateDefinitionPanel(currentOrb.term);
}

function updateDefinitionPanel(term) {
  const def = term.definitions?.[currentDefinitionIndex];
  textBox.textContent = def?.text || '(No definition)';
}

function playClickSound() {
  const clickSound = new Audio('./assets/click.mp3');
  clickSound.volume = 0.5;
  clickSound.play();
}

export function setupUIEvents() {
  document.getElementById('prev-def').onclick = () => cycleDefinition(-1);
  document.getElementById('next-def').onclick = () => cycleDefinition(1);
  document.getElementById('ai-generate').onclick = () => requestAIDefinition();
  document.getElementById('accept-ai').onclick = () => saveAIDefinition();
  document.getElementById('retry-ai').onclick = () => requestAIDefinition();
  document.getElementById('cancel-ai').onclick = () => hideAISuggestion();

  window.addEventListener('wheel', e => {
    if (definitionPanelVisible) cycleDefinition(e.deltaY > 0 ? 1 : -1);
  });
}

function requestAIDefinition() {
  suggestionText.textContent = 'Thinking...';
  aiBox.classList.remove('hidden');
  const term = currentOrb.term.term;
  const newDef = { text: `This is a generated definition for ${term}...`, tags: ['ai_generated'] };
  setTimeout(() => {
    suggestionText.textContent = newDef.text;
    aiBox.dataset.generatedDef = JSON.stringify(newDef);
  }, 1000);
}

function hideAISuggestion() {
  aiBox.classList.add('hidden');
  suggestionText.textContent = '';
}

async function saveAIDefinition() {
  const def = JSON.parse(aiBox.dataset.generatedDef);
  const termDocRef = doc(db, 'terms', currentOrb.term.term);
  const updatedDefs = [...(currentOrb.term.definitions || []), def];
  try {
    await updateDoc(termDocRef, { definitions: updatedDefs });
    hideAISuggestion();
    currentOrb.term.definitions = updatedDefs;
    currentDefinitionIndex = updatedDefs.length - 1;
    updateDefinitionPanel(currentOrb.term);
  } catch (err) {
    alert('Save failed.');
  }
}

export function handleClick(raycaster, mouse) {
  raycaster.setFromCamera(mouse, camera);
  const intersects = raycaster.intersectObject(orbMesh);
  if (intersects.length > 0) {
    const index = intersects[0].instanceId;
    const term = orbDataArray[index];
    if (currentOrb?.index === index) {
      hideDefinitionPanel();
      currentOrb = null;
    } else {
      currentOrb = { index, term };
      showDefinitionPanel(term);
    }
  }
}
