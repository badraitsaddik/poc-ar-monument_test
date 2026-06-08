# Monument AR — MVP

Application web AR (PWA) pour identifier des monuments à l'aide de la boussole
et du NFT Image Tracking d'AR.js. Aucune installation, tourne dans le navigateur mobile.

## Architecture

  Boussole + GPS  →  Bearing Engine  →  Filtre candidats  →  NFT Tracking  →  Overlay AR

1. La boussole lit le cap magnétique (corrigé pour iOS/Android + compensation tilt)
2. Le bearing engine calcule l'angle entre le cap et chaque monument (Haversine)
3. Seuls les monuments dans un cone de ±15° sont chargés comme marqueurs NFT
4. Quand l'utilisateur lève le téléphone, AR.js NFT reconnaît le monument visuellement
5. L'overlay A-Frame s'affiche ancré sur le monument

## Structure du projet

  monument-ar/
  ├── index.html              Point d'entrée
  ├── monuments.json          Base de données des monuments (lat/lon/marker)
  ├── css/
  │   └── style.css           UI complète (écran démarrage, HUD, panneaux)
  ├── js/
  │   ├── app.js              Orchestrateur principal
  │   ├── bearing-engine.js   Boussole + GPS + calcul de cap + filtre
  │   ├── nft-manager.js      Chargement dynamique des entités NFT dans A-Frame
  │   └── ui.js               Mise à jour des éléments DOM
  ├── markers/
  │   ├── README.md           Instructions de génération des marqueurs NFT
  │   ├── pantheon.fset       } À générer avec NFT Marker Creator
  │   ├── pantheon.fset3      }
  │   └── pantheon.iset       }
  └── images/
      └── README.md           Photos source pour génération NFT (offline)

## Mise en route

### 1. Générer les marqueurs NFT
  https://carnaux.github.io/NFT-Marker-Creator/
  → Uploadez une photo de façade pour chaque monument
  → Placez les .fset / .fset3 / .iset dans markers/

### 2. Configurer monuments.json
  Adaptez les coordonnées lat/lon et le chemin "marker" pour vos monuments.

### 3. Servir en HTTPS (obligatoire)
  # Développement local avec HTTPS
  npx serve .          # puis tunnel ngrok
  ngrok http 3000

  # Production
  Déployez sur Netlify ou GitHub Pages (HTTPS automatique)

### 4. Tester sur mobile
  - Chrome Android : fonctionne natif
  - Safari iOS : requiert l'autorisation DeviceOrientation (gérée au clic)
  - Firefox Android : recommandé si Chrome ouvre la mauvaise caméra

## Comportement de l'application

  [Écran démarrage]
    → Clic "Démarrer" → demande permissions iOS si nécessaire

  [Mode Guidage — téléphone à plat]
    → Boussole visuelle tournante
    → Liste des monuments avec direction (▲ devant / ◀ gauche / ▶ droite)
    → Seuls les monuments dans ±15° sont des "candidats"

  [Mode démo compas seul]
    → Renseignez un champ "azimuth" dans monuments.json pour chaque monument
    → L'application compare uniquement le cap du téléphone à l'azimut cible
    → Le GPS reste désactivé pendant la démo

  [Mode NFT — téléphone levé (beta > 30°)]
    → Les marqueurs NFT des candidats sont chargés dans la scène A-Frame
    → Pointez vers le monument → tracking visuel → overlay nom + description

## Limitations connues

- NFT fonctionne mieux à <20m en extérieur avec bonne lumière
- Nécessite HTTPS (caméra + gyroscope bloqués en HTTP)
- iOS : la permission DeviceOrientation doit être déclenchée par un geste utilisateur
- Android multi-caméras : utiliser Firefox si Chrome choisit la mauvaise caméra
- Déclinaison magnétique non corrigée (erreur max ~5° selon région)
- En mode compas seul, il faut définir un azimut cible pour chaque monument

## Technologies

  AR.js (NFT Image Tracking + Location Based)
  A-Frame 1.6
  ARToolKitX (WASM, inclus dans AR.js)
  API Web : DeviceOrientationEvent, Geolocation, MediaDevices
  Modules ES6 natifs (pas de bundler requis)
