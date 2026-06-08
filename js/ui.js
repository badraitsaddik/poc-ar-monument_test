/**
 * ui.js
 * Gère tous les éléments d'interface :
 * - écran de démarrage (demande de permissions)
 * - boussole visuelle
 * - liste directionnelle des monuments
 * - panneau de monument détecté
 * - messages d'erreur
 */

import { getDirectionMessage } from './bearing-engine.js';

// ── Références DOM ────────────────────────────────────────────────────────────
const $ = (id) => document.getElementById(id);

const els = {
  startScreen:    $('start-screen'),
  startBtn:       $('start-btn'),
  arContainer:    $('ar-container'),
  loader:         $('loader'),
  loaderText:     $('loader-text'),
  compassNeedle:  $('compass-needle'),
  compassDeg:     $('compass-deg'),
  targetAzimuth:  $('target-azimuth'),
  directionList:  $('direction-list'),
  detectedPanel:  $('detected-panel'),
  detectedName:   $('detected-name'),
  detectedDesc:   $('detected-desc'),
  detectedClose:  $('detected-close'),
  errorToast:     $('error-toast'),
  errorText:      $('error-text'),
  gpsAccuracy:    $('gps-accuracy'),
  phoneStatus:    $('phone-status'),
};

// ── Loader ────────────────────────────────────────────────────────────────────
function showLoader(text = 'Chargement…') {
  els.loader.style.display = 'flex';
  els.loaderText.textContent = text;
}

function hideLoader() {
  els.loader.style.display = 'none';
}

// ── Écran démarrage ───────────────────────────────────────────────────────────
function showStartScreen() {
  els.startScreen.style.display = 'flex';
  els.arContainer.style.display = 'none';
}

function hideStartScreen() {
  els.startScreen.style.display = 'none';
  els.arContainer.style.display = 'block';
}

// ── Boussole visuelle ─────────────────────────────────────────────────────────
function updateCompass(heading) {
  // La flèche pointe vers le Nord : on tourne dans le sens inverse du cap
  els.compassNeedle.style.transform = 'rotate(' + (-heading) + 'deg)';
  els.compassDeg.textContent = 'Cap ' + Math.round(heading) + '°';
}

// ── Statut GPS ────────────────────────────────────────────────────────────────
function updateGPSAccuracy(accuracy) {
  if (!els.gpsAccuracy) return;
  if (accuracy === null || accuracy === undefined) {
    els.gpsAccuracy.textContent = 'GPS désactivé';
    els.gpsAccuracy.style.color = '#94a3b8';
    return;
  }
  const txt = accuracy < 20 ? '±' + Math.round(accuracy) + 'm' : '~' + Math.round(accuracy) + 'm ⚠';
  els.gpsAccuracy.textContent = txt;
  els.gpsAccuracy.style.color = accuracy < 20 ? '#4ade80' : '#facc15';
}

function updateTargetAzimuth(targetBearing, source = 'azimuth') {
  if (!els.targetAzimuth) return;
  if (targetBearing === null || targetBearing === undefined) {
    els.targetAzimuth.textContent = 'Azimut cible --';
    return;
  }

  const label = source === 'gps' ? 'Cap cible ' : 'Azimut cible ';
  els.targetAzimuth.textContent = label + Math.round(targetBearing) + '°';
}

// ── Statut téléphone (à plat / levé) ─────────────────────────────────────────
function updatePhoneStatus(phoneIsRaised) {
  if (!els.phoneStatus) return;
  els.phoneStatus.textContent = phoneIsRaised ? '📷 Pointez vers le monument' : '🧭 Guidage boussole';
}

// ── Liste directionnelle ──────────────────────────────────────────────────────
function updateDirectionList(allMonuments, phoneIsRaised = false) {
  if (!els.directionList) return;
  if (!allMonuments || allMonuments.length === 0) {
    els.directionList.innerHTML = '<p class="no-monuments">Aucun monument à proximité</p>';
    return;
  }

  els.directionList.innerHTML = allMonuments.slice(0, 6).map((m) => {
    const msg    = getDirectionMessage(m, phoneIsRaised);
    const isInAxis = phoneIsRaised && msg.status === 'front';
    const arrow  = msg.status === 'front' ? '▲' : msg.status === 'right' ? '▶' : '◀';
    return (
      '<div class="monument-item ' + (isInAxis ? 'in-axis' : '') + '">' +
        '<span class="arrow-icon">' + arrow + '</span>' +
        '<div class="monument-info">' +
          '<span class="monument-name">' + m.nom + '</span>' +
          '<span class="monument-dist">' + msg.dist + (msg.detail ? ' · ' + msg.detail : '') + '</span>' +
        '</div>' +
      '</div>'
    );
  }).join('');
}

// ── Panneau monument détecté ──────────────────────────────────────────────────
function showDetectedMonument(monument) {
  els.detectedName.textContent = monument.nom;
  els.detectedDesc.textContent = monument.description || '';
  els.detectedPanel.classList.add('visible');
}

function hideDetectedPanel() {
  els.detectedPanel.classList.remove('visible');
}

// ── Toast d'erreur ────────────────────────────────────────────────────────────
function showError(message, duration = 4000) {
  els.errorText.textContent = message;
  els.errorToast.classList.add('visible');
  setTimeout(() => els.errorToast.classList.remove('visible'), duration);
}

// ── Export du bouton démarrage ────────────────────────────────────────────────
function onStartClick(callback) {
  els.startBtn.addEventListener('click', callback);
}

export {
  showLoader, hideLoader,
  showStartScreen, hideStartScreen,
  updateCompass,
  updateGPSAccuracy,
  updateTargetAzimuth,
  updatePhoneStatus,
  updateDirectionList,
  showDetectedMonument, hideDetectedPanel,
  showError,
  onStartClick,
};
