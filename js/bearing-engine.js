/**
 * bearing-engine.js
 * Gère la boussole, le calcul de cap géodésique (Haversine),
 * le filtrage des monuments candidats et les messages directionnels.
 */

const CONFIG = {
  THRESHOLD_DEG:   15,
  SMOOTH_FACTOR:   0.15,
  MAX_CANDIDATES:  5,
  TILT_THRESHOLD:  30,
  MAX_DIST_M:      2000,
};

let _smoothedHeading  = null;
let _monuments        = [];
let _userLat          = null;
let _userLon          = null;
let _gpsWatcher       = null;
let _orientationBound = null;

function normalizeAngle(degrees) {
  return (degrees % 360 + 360) % 360;
}

function resolveTarget(monument) {
  if (_userLat !== null && _userLon !== null && typeof monument.lat === 'number' && typeof monument.lon === 'number') {
    return {
      bearing: computeBearing(_userLat, _userLon, monument.lat, monument.lon),
      dist: haversineDistance(_userLat, _userLon, monument.lat, monument.lon),
      source: 'gps',
    };
  }

  if (typeof monument.azimuth === 'number' && Number.isFinite(monument.azimuth)) {
    return {
      bearing: normalizeAngle(monument.azimuth),
      dist: null,
      source: 'azimuth',
    };
  }

  return { bearing: null, dist: null, source: null };
}

// ── 1. Chargement des monuments ──────────────────────────────────────────────
async function loadMonuments(url = './monuments.json') {
  const res = await fetch(url);
  if (!res.ok) throw new Error('Impossible de charger ' + url);
  _monuments = await res.json();
  console.log('[BearingEngine] ' + _monuments.length + ' monuments chargés');
  return _monuments;
}

// ── 2. GPS ───────────────────────────────────────────────────────────────────
function startGPS(onPosition, onError) {
  if (!navigator.geolocation) { onError(new Error('Géolocalisation non supportée')); return; }
  _gpsWatcher = navigator.geolocation.watchPosition(
    (pos) => {
      _userLat = pos.coords.latitude;
      _userLon = pos.coords.longitude;
      onPosition(_userLat, _userLon, pos.coords.accuracy);
    },
    onError,
    { enableHighAccuracy: true, maximumAge: 3000, timeout: 10000 }
  );
}

function stopGPS() {
  if (_gpsWatcher !== null) { navigator.geolocation.clearWatch(_gpsWatcher); _gpsWatcher = null; }
}

// ── 3. Permission iOS 13+ ────────────────────────────────────────────────────
async function requestCompassPermission() {
  if (typeof DeviceOrientationEvent !== 'undefined' &&
      typeof DeviceOrientationEvent.requestPermission === 'function') {
    const result = await DeviceOrientationEvent.requestPermission();
    if (result !== 'granted') throw new Error('Permission boussole refusée');
  }
}

// ── 4. Boussole ───────────────────────────────────────────────────────────────
function initCompass(onHeadingUpdate) {
  function handleOrientation(event) {
    let rawHeading;
    if (event.webkitCompassHeading !== undefined && event.webkitCompassHeading !== null) {
      rawHeading = event.webkitCompassHeading;
    } else if (event.alpha !== null) {
      rawHeading = _headingFromOrientation(event.alpha, event.beta ?? 0, event.gamma ?? 0);
    } else { return; }

    const beta  = event.beta  ?? 0;
    const gamma = event.gamma ?? 0;

    if (_smoothedHeading === null) {
      _smoothedHeading = rawHeading;
    } else {
      let delta = rawHeading - _smoothedHeading;
      if (delta >  180) delta -= 360;
      if (delta < -180) delta += 360;
      _smoothedHeading = (_smoothedHeading + CONFIG.SMOOTH_FACTOR * delta + 360) % 360;
    }
    onHeadingUpdate(_smoothedHeading, beta, gamma);
  }

  const eventName = 'ondeviceorientationabsolute' in window
    ? 'deviceorientationabsolute' : 'deviceorientation';
  _orientationBound = handleOrientation;
  window.addEventListener(eventName, _orientationBound, true);
}

function stopCompass() {
  if (_orientationBound) {
    window.removeEventListener('deviceorientationabsolute', _orientationBound, true);
    window.removeEventListener('deviceorientation', _orientationBound, true);
    _orientationBound = null;
  }
}

// ── 5. Cap calculé depuis l'orientation de l'appareil ─────────────────────────
function _headingFromOrientation(alpha, beta, gamma) {
  const toRad = (d) => d * Math.PI / 180;
  const a = toRad(alpha);
  const b = toRad(beta);
  const g = toRad(gamma);

  const cA = Math.cos(a), sA = Math.sin(a);
  const cB = Math.cos(b), sB = Math.sin(b);
  const cG = Math.cos(g), sG = Math.sin(g);

  const x = -cA * sG - sA * sB * cG;
  const y = -sA * sG + cA * sB * cG;

  let heading = (Math.atan2(x, y) * 180 / Math.PI + 360) % 360;
  const orientationAngle = _getScreenOrientationAngle();
  heading = (heading + orientationAngle + 360) % 360;
  return heading;
}

function _getScreenOrientationAngle() {
  if (screen.orientation && typeof screen.orientation.angle === 'number') {
    return screen.orientation.angle;
  }
  if (typeof window.orientation === 'number') {
    return window.orientation;
  }
  return 0;
}

// ── 6. Bearing Haversine ─────────────────────────────────────────────────────
function computeBearing(lat1, lon1, lat2, lon2) {
  const toRad = (d) => d * Math.PI / 180;
  const φ1 = toRad(lat1), φ2 = toRad(lat2), Δλ = toRad(lon2 - lon1);
  const y = Math.sin(Δλ) * Math.cos(φ2);
  const x = Math.cos(φ1) * Math.sin(φ2) - Math.sin(φ1) * Math.cos(φ2) * Math.cos(Δλ);
  return (Math.atan2(y, x) * 180 / Math.PI + 360) % 360;
}

// ── 7. Distance Haversine (mètres) ───────────────────────────────────────────
function haversineDistance(lat1, lon1, lat2, lon2) {
  const R = 6371000;
  const toRad = (d) => d * Math.PI / 180;
  const Δφ = toRad(lat2 - lat1), Δλ = toRad(lon2 - lon1);
  const a = Math.sin(Δφ/2)**2 + Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(Δλ/2)**2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

// ── 8. Delta angulaire (négatif=gauche, positif=droite) ──────────────────────
function angularDelta(heading, bearing) {
  let delta = bearing - heading;
  if (delta >  180) delta -= 360;
  if (delta < -180) delta += 360;
  return delta;
}

// ── 9. Filtre candidats ───────────────────────────────────────────────────────
function filterCandidates(heading) {
  return _monuments
    .map((m) => {
      const target = resolveTarget(m);
      if (target.bearing === null) return { ...m, bearing: null, delta: null, dist: null, targetSource: null };

      const delta = angularDelta(heading, target.bearing);
      return { ...m, bearing: target.bearing, delta, dist: target.dist, targetSource: target.source };
    })
    .filter((m) => m.bearing !== null && Math.abs(m.delta) <= CONFIG.THRESHOLD_DEG && (m.dist === null || m.dist <= (m.distance_max_m || CONFIG.MAX_DIST_M)))
    .sort((a, b) => Math.abs(a.delta) - Math.abs(b.delta))
    .slice(0, CONFIG.MAX_CANDIDATES);
}

// ── 10. Tous les monuments avec direction ────────────────────────────────────
function getAllWithBearing(heading) {
  return _monuments
    .map((m) => {
      const target = resolveTarget(m);
      if (target.bearing === null) return { ...m, bearing: null, delta: null, dist: null, targetSource: null };

      const delta = angularDelta(heading, target.bearing);
      return { ...m, bearing: target.bearing, delta, dist: target.dist, targetSource: target.source };
    })
    .filter((m) => m.bearing !== null)
    .sort((a, b) => Math.abs(a.delta) - Math.abs(b.delta));
}

// ── 11. Message directionnel ─────────────────────────────────────────────────
function getDirectionMessage(monument, phoneIsRaised = true) {
  const { nom, delta, dist, bearing, targetSource } = monument;
  const distStr = dist === null || dist === undefined ? 'distance n/a' : (dist > 1000 ? (dist/1000).toFixed(1) + ' km' : Math.round(dist) + ' m');
  const targetLabel = bearing === null || bearing === undefined
    ? 'azimut n/a'
    : (targetSource === 'azimuth' ? 'Azimut ' : 'Cap ') + Math.round(bearing) + '°';

  if (delta === null || delta === undefined) {
    return { text: nom + ' — cible non définie', detail: targetLabel, dist: distStr, status: 'unknown' };
  }

  if (!phoneIsRaised) {
    const side = delta > 0 ? 'droite' : 'gauche';
    const degrees = Math.abs(Math.round(delta));
    return {
      text: nom + ' est à votre ' + side,
      detail: targetLabel + ' · Écart ' + degrees + '°',
      dist: distStr,
      status: 'tilt',
    };
  }
  if (Math.abs(delta) <= CONFIG.THRESHOLD_DEG) {
    return { text: nom + ' est devant vous', detail: targetLabel, dist: distStr, status: 'front' };
  }
  const side    = delta > 0 ? 'droite' : 'gauche';
  const degrees = Math.abs(Math.round(delta));
  return { text: nom + ' est à votre ' + side, detail: targetLabel + ' · Tournez de ' + degrees + '°', dist: distStr, status: delta > 0 ? 'right' : 'left' };
}

// ── 12. Boucle principale ────────────────────────────────────────────────────
async function startBearingEngine({ onUpdate, onGPSError, useGPS = true }) {
  await loadMonuments();
  if (useGPS) {
    startGPS(
      () => {
        if (_smoothedHeading !== null) {
          onUpdate({ heading: _smoothedHeading, candidates: filterCandidates(_smoothedHeading), all: getAllWithBearing(_smoothedHeading) });
        }
      },
      onGPSError || ((e) => console.error('[GPS]', e))
    );
  }
  initCompass((heading, beta) => {
    onUpdate({ heading, candidates: filterCandidates(heading), all: getAllWithBearing(heading), phoneIsRaised: Math.abs(beta) > CONFIG.TILT_THRESHOLD, beta });
  });
}

function stopBearingEngine() { stopGPS(); stopCompass(); }

export { startBearingEngine, stopBearingEngine, requestCompassPermission, getDirectionMessage, computeBearing, haversineDistance, angularDelta, CONFIG };
