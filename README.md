orbs/ (root)
│
├─ public/
│   ├ orb-icon.png         ← your favicon
│   ├ explorer.html        ← main orb UI
│   └ admin.html           ← importer + AI admin tool
│
├─ src/
│   ├ firebase.js          ← Firebase init & Firestore helpers
│   ├ data.js              ← import / CSV / Sheet processing
│   ├ orbs.js              ← Three.js orb logic + interactions
│   └ ui.js                ← Definition panel, AI flows, input handlers
│
└─ assets/
    ├ style.css           ← shared styles
    ├ click.mp3           ← orb click audio
    └ glow-shader.js      ← optional shader glow code
