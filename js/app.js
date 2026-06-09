/**
 * app.js
 * Point d'entrée de l'application.
 * Orchestre : permissions → GPS+boussole → sync NFT → UI
 */

import {
  startBearingEngine,
  stopBearingEngine,
  requestCompassPermission,
} from './bearing-engine.js';

import {
  showLoader, hideLoader,
  showStartScreen, hideStartScreen,
  updateCompass, updateGPSAccuracy, updateTargetAzimuth,
  updatePhoneStatus, updateDirectionList,
  showDetectedMonument, hideDetectedPanel,
  showError, onStartClick,
} from './ui.js';

function ensureARVideoVisible() {
  const arContainer = document.getElementById('ar-container');
  if (!arContainer) return;

  const applyVideoFix = (videoEl) => {
    if (!videoEl) return;
    // iOS/Safari: ces attributs évitent un flux bloqué ou hors contexte inline.
    videoEl.setAttribute('playsinline', 'true');
    videoEl.setAttribute('webkit-playsinline', 'true');
    videoEl.setAttribute('autoplay', 'true');
    videoEl.setAttribute('muted', 'true');
    videoEl.muted = true;
    videoEl.playsInline = true;
    videoEl.style.zIndex = '1';
    videoEl.style.visibility = 'visible';
    videoEl.style.opacity = '1';

    const playPromise = videoEl.play();
    if (playPromise && typeof playPromise.catch === 'function') {
      playPromise.catch(() => {
        // Échec silencieux: un nouveau geste utilisateur relancera la lecture.
      });
    }
  };

  const existingVideo = arContainer.querySelector('video');
  if (existingVideo) {
    applyVideoFix(existingVideo);
    return;
  }

  const observer = new MutationObserver(() => {
    const video = arContainer.querySelector('video');
    if (!video) return;
    applyVideoFix(video);
    observer.disconnect();
  });

  observer.observe(arContainer, { childList: true, subtree: true });
  setTimeout(() => observer.disconnect(), 15000);
}

// ─────────────────────────────────────────────────────────────────────────────
// Initialisation au chargement
// ─────────────────────────────────────────────────────────────────────────────
window.addEventListener('DOMContentLoaded', () => {
  showStartScreen();
  onStartClick(handleStart);

  // Fermer le panneau de monument détecté
  document.getElementById('detected-close').addEventListener('click', hideDetectedPanel);

  // Écouter les événements NFT (depuis nft-manager)
  window.addEventListener('monumentDetected', (e) => showDetectedMonument(e.detail));
  window.addEventListener('monumentLost',     ()  => hideDetectedPanel());

  // Masquer le loader AR.js quand les descripteurs sont prêts
  window.addEventListener('arjs-nft-loaded', () => {
    hideLoader();
    console.log('[App] Module AR prêt');
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Démarrage (déclenché par bouton pour obtenir les permissions iOS)
// ─────────────────────────────────────────────────────────────────────────────
async function handleStart() {
  showLoader('Demande de permissions…');

  try {
    await requestCompassPermission();
  } catch (e) {
    showError('Accès à la boussole refusé : ' + e.message);
    hideLoader();
    return;
  }

  hideStartScreen();
  ensureARVideoVisible();
  showLoader('Initialisation boussole…');

  const scene = document.querySelector('a-scene');
  const useGPS = false;
  const enableNFT = false;

  // ── Boucle principale : mise à jour boussole ───────────────────────────────
  await startBearingEngine({
    useGPS,
    onUpdate: ({ heading, candidates, all, phoneIsRaised, beta }) => {

      // 1. Mettre à jour la boussole visuelle
      updateCompass(heading);

      // 1bis. Afficher l'azimut cible du meilleur candidat
      const primaryTarget = all && all.length > 0 ? all[0] : null;
      const targetBearing = primaryTarget && primaryTarget.bearing !== null ? primaryTarget.bearing : null;
      const targetSource = primaryTarget ? primaryTarget.targetSource : null;
      updateTargetAzimuth(targetBearing, targetSource || 'azimuth');

      // 2. Mettre à jour la liste directionnelle
      updateDirectionList(all, phoneIsRaised);

      // 3. Mettre à jour le statut (à plat / levé)
      updatePhoneStatus(phoneIsRaised);

      // 3bis. GPS désactivé pendant la démo
      updateGPSAccuracy(null);

      // 4. NFT désactivé pour la démo: on garde uniquement le guidage boussole
      if (enableNFT) {
        // TODO: réactiver syncNFTEntities / clearAllNFT si le tracking visuel est nécessaire.
      }
    },

    onGPSError: (err) => {
      const msg = err.code === 1 ? 'GPS refusé. Veuillez autoriser la localisation.'
                : err.code === 2 ? 'Signal GPS indisponible.'
                : 'Erreur GPS : ' + err.message;
      showError(msg);
      hideLoader();
    },
  });

  // Premier loader masqué après 8s max (AR.js peut être lent à démarrer)
  setTimeout(hideLoader, 8000);
}

// ─────────────────────────────────────────────────────────────────────────────
// Nettoyage si l'utilisateur quitte la page
// ─────────────────────────────────────────────────────────────────────────────
window.addEventListener('pagehide', stopBearingEngine);
