/**
 * nft-manager.js
 * Gère le chargement dynamique des entités NFT dans la scène A-Frame
 * selon la liste de candidats fournie par le bearing engine.
 * Évite de recharger les marqueurs déjà présents dans la scène.
 */

// IDs des entités NFT actuellement dans la scène
const _loadedMarkers = new Map(); // id → <a-nft> element

/**
 * Met à jour la scène A-Frame avec les nouveaux candidats.
 * Ajoute les entités manquantes, retire celles hors scope.
 * @param {Array}    candidates  - monuments filtrés par le bearing engine
 * @param {Element}  scene       - élément <a-scene>
 */
function syncNFTEntities(candidates, scene) {
  const candidateIds = new Set(candidates.map((m) => m.id));

  // ── Retirer les entités qui ne sont plus candidates ──────────────────────
  for (const [id, entity] of _loadedMarkers) {
    if (!candidateIds.has(id)) {
      scene.removeChild(entity);
      _loadedMarkers.delete(id);
      console.log('[NFT] Retiré :', id);
    }
  }

  // ── Ajouter les nouvelles entités candidates ──────────────────────────────
  for (const monument of candidates) {
    if (_loadedMarkers.has(monument.id)) continue; // déjà chargé

    const nftEntity = _createNFTEntity(monument);
    scene.appendChild(nftEntity);
    _loadedMarkers.set(monument.id, nftEntity);
    console.log('[NFT] Chargé :', monument.id, '— marqueur :', monument.marker);
  }
}

/**
 * Crée une entité <a-nft> avec son overlay (texte + panneau d'info).
 */
function _createNFTEntity(monument) {
  const nft = document.createElement('a-nft');
  nft.setAttribute('type', 'nft');
  nft.setAttribute('url', monument.marker);
  nft.setAttribute('smooth', 'true');
  nft.setAttribute('smoothCount', '10');
  nft.setAttribute('smoothTolerance', '.01');
  nft.setAttribute('smoothThreshold', '5');
  nft.setAttribute('emitevents', 'true');
  nft.dataset.monumentId = monument.id;

  // ── Panneau de fond ───────────────────────────────────────────────────────
  const plane = document.createElement('a-plane');
  plane.setAttribute('position', '0 250 0');
  plane.setAttribute('rotation', '0 0 0');
  plane.setAttribute('width',  '400');
  plane.setAttribute('height', '120');
  plane.setAttribute('color',  '#1a1a2e');
  plane.setAttribute('opacity', '0.85');

  // ── Nom du monument ───────────────────────────────────────────────────────
  const title = document.createElement('a-text');
  title.setAttribute('value', monument.nom);
  title.setAttribute('position', '0 275 0');
  title.setAttribute('align', 'center');
  title.setAttribute('color', '#ffffff');
  title.setAttribute('width', '350');
  title.setAttribute('wrap-count', '30');
  title.setAttribute('font', 'mozillavr');

  // ── Description ───────────────────────────────────────────────────────────
  const desc = document.createElement('a-text');
  desc.setAttribute('value', monument.description || '');
  desc.setAttribute('position', '0 235 0');
  desc.setAttribute('align', 'center');
  desc.setAttribute('color', '#a8d8ea');
  desc.setAttribute('width', '300');
  desc.setAttribute('wrap-count', '40');
  desc.setAttribute('font', 'mozillavr');

  nft.appendChild(plane);
  nft.appendChild(title);
  nft.appendChild(desc);

  // ── Événements markerFound / markerLost ───────────────────────────────────
  nft.addEventListener('markerFound', () => {
    console.log('[NFT] Marqueur détecté :', monument.nom);
    window.dispatchEvent(new CustomEvent('monumentDetected', { detail: monument }));
  });

  nft.addEventListener('markerLost', () => {
    console.log('[NFT] Marqueur perdu :', monument.nom);
    window.dispatchEvent(new CustomEvent('monumentLost', { detail: monument }));
  });

  return nft;
}

/**
 * Retire tous les marqueurs NFT de la scène.
 */
function clearAllNFT(scene) {
  for (const [id, entity] of _loadedMarkers) {
    scene.removeChild(entity);
  }
  _loadedMarkers.clear();
}

/**
 * Retourne les IDs des marqueurs actuellement chargés.
 */
function getLoadedMarkerIds() {
  return [..._loadedMarkers.keys()];
}

export { syncNFTEntities, clearAllNFT, getLoadedMarkerIds };
