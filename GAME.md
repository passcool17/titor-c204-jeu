# Mission Titor · C204 — v0.1.2

- Lien jouable : https://passcool17.github.io/titor-c204-jeu/
- Dépôt : https://github.com/passcool17/titor-c204-jeu
- État : v0.1.2 — IBM 5100 3D à bord après le saut de 1975, crédit Sketchfab. Reprend aussi les corrections QA de la v0.1.1 (767c8f6). Nouveau jeu, distinct des applications déjà publiées (`titor-c204`, scène Corvette, `c204-2026`). Le joueur est l’opérateur de l’unité C204, au volant d’une Corvette 1967. Mission (récit de John Titor, 2000-2001) : partir de 2036, aller en 1975 chercher un IBM 5100, revenir en 2036. Chaque saut = quatre mini-jeux de démarrage, puis un maintien du champ. Vue éclatée interactive, fiches étiquetées **Documenté** / **Jamais authentifié** / **Ajout de modèle**, page Sources. Interface en français.

## v0.1.2 — IBM 5100 (12 nov. 2026, soir)

Le GLB livré par Rendu, approuvé par Pascal (21:29, heure de Toronto), est branché dans le jeu.

- Fichier : `assets/ibm5100.glb` (944 136 o, md5 `812ac2ce01abc318f34891e17c248040`), copie de `/workspace/assets3d/titor-c204-jeu/glb/ibm5100.glb`.
- Statique, aucun clip. Nœuds : `ibm_5100` (racine) → `ibm_5100_body`, `ibm_5100_screen`, `ibm_5100_tape` (enfants quantifiés sous ces nœuds). 2 matériaux `IBM5100_Body`, `IBM5100_Screen`. 3 436 triangles, 3 appels.
- Dimensions (Rendu / `verify_glb`) : **0,4465 × 0,2038 × 0,6123 m** (larg. × haut. × prof., Y vers le haut), face avant **+Z**, origine au centre du dessous. Émissif de l’écran 1,2. Pas de tangentes dans le fichier (générées à l’exécution). Pas de transmission.
- Extensions requises : `KHR_mesh_quantization`, `EXT_meshopt_compression`, `KHR_texture_basisu` (aussi `KHR_texture_transform`, `KHR_materials_emissive_strength`). Le chargeur du jeu avait déjà Meshopt et KTX2.
- Mémoire textures GPU du GLB (`gltf-transform inspect`, gpuSize) : **2 796 229 o** ≈ 2,67 Mo (1× UASTC 1024 + 2× ETC1S 1024). `measure.mjs` surestime le KTX2 (largeur×hauteur×4) : ne pas prendre ce chiffre pour la VRAM.
- Gameplay : invisible au départ. Après le premier saut réussi (arrivée en 1975), l’ordinateur apparaît sur le **siège passager** (parenté à la Corvette, coussin à y ≈ 0,445 m, face +Z vers le pare-brise). Il reste à bord pour le retour en 2036 et les sauts suivants. Une nouvelle partie le masque.
- Aperçu de vérification Rendu : `/workspace/assets3d/titor-c204-jeu/rendus/ibm5100_verify.png`.

**Crédit (licence CC BY 4.0), aussi dans la page Sources du jeu :** [Computer IBM 5100 by Danny Kuzmishchev, CC BY 4.0, Sketchfab](https://sketchfab.com/3d-models/computer-ibm-5100-e2767c9c3fb549ccbd82b25555244dd6). Adaptation low-poly pour ce projet, même licence. Ce n’est pas une pièce IBM officielle.

## Corrections v0.1.1 (rapport QA du 12 nov. 2026)

1. **Vies après un game over.** « Menu » puis « Commencer la mission » remettent vies, score et niveau (3 vies). Seul « Recommencer » le faisait en v0.1.0. Test de régression dans `tests/t01.js`.
2. **Unité visible dans la Corvette.** Le verre de la voiture (`Corvette_Glass`) est en alpha simple (transparent, opacité 0,35, `depthWrite` false, `renderOrder` 1) — **pas de transmission, pas de second passage**. La capote (`soft_top`) est masquée (roadster). Une lumière ponctuelle éclaire la cabine (sans ombre). La caméra de conduite est un 3/4 avant un peu haut, pour voir le boîtier (plaques TMH et DANGER) derrière les sièges. Le verre des hublots de l’unité (`C204_PortGlass`) reste opaque.
3. **Menu en paysage 915×412.** Le panneau est une colonne à gauche (environ 340 px), compact, avec les boutons sur deux colonnes. La Corvette reste visible à droite.
4. **Service worker.** Une seule constante `VERSION` (dans `data.js`) sert à l’URL d’enregistrement (`sw.js?v=` + VERSION, `updateViaCache: 'none'`). Le SW lit ce `?v=` pour le nom du cache et les URL précachées. `skipWaiting` + `clients.claim`, suppression des anciens caches à l’activation, HTML en réseau d’abord, `data.js` aussi en réseau d’abord.

## Contrôles

- **Tactile** : joystick virtuel (conduite, saut, stabilisation des singularités — deux joysticks), bouton d’action pour l’injection, le verrouillage VGL et la synchro des horloges. Toucher une pièce en vue éclatée ouvre sa fiche. Glisser pour tourner, pincer pour zoomer (menu et éclatée).
- **Clavier** : WASD ou flèches (conduite / singularité principale), IJKL (singularité de pilotage), Espace ou Entrée (action), Échap (fermer un panneau / revenir).
- **Manette** : stick gauche, stick droit, bouton A (action).
- Plein écran (bouton ⛶). Son de synthèse Web Audio, déverrouillé au premier toucher ; bouton muet.

## Gameplay

1. **Injection d’électrons** — toucher quand le curseur est dans la zone verte.
2. **Stabiliser les deux singularités** — garder les deux indicateurs au centre (joysticks).
3. **Verrouillage de gravité variable (VGL)** — verrouiller au bon moment.
4. **Synchroniser les horloges au césium** — aligner les deux compteurs.
5. **Saut** — contrer la dérive du champ jusqu’à l’arrivée, ou échec.

Trois vies, score, niveaux plus difficiles après le retour en 2036. Écran d’échec et recommencer.

Ceci est un **jeu**. Aucune machine de ce type n’a été démontrée. Le récit de Titor n’a jamais été authentifié.

## Liens vers les autres applications

Depuis ce jeu (menu « Autres scènes ») :

- [C204 · 2001 — unité et dossier](https://passcool17.github.io/titor-c204/)
- [Scène Corvette 1967](https://passcool17.github.io/titor-c204/#corvette)
- [C204 · 2026 — unité fictive modernisée](https://passcool17.github.io/c204-2026/)

Les liens **retour** dans ces trois applications ne sont pas dans ce dépôt (d’autres dépôts, accord de Pascal).

## Ressources (source et licence)

| Fichier | Source | Licence |
|---|---|---|
| `assets/c204-v2.glb` (335 472 o, Draco + WebP) | `/workspace/assets3d/titor-c204/glb/c204.glb` v2, chaîne 3D du projet (Modélisation → Rig → Rendu) | Création originale, propriété de Pascal |
| `assets/corvette-v2.glb` (295 120 o, Draco + WebP) | `/workspace/assets3d/corvette-1967/glb/corvette.glb` v2, même chaîne ; sans logo ni marque officielle | Création originale, propriété de Pascal |
| `assets/ibm5100.glb` (944 136 o, meshopt + KTX2, 3 436 tris) | `/workspace/assets3d/titor-c204-jeu/glb/ibm5100.glb`, chaîne 3D (Modélisation → Rig → Rendu), approuvé par Pascal le 12 nov. 2026 21:29 | Dérivé de [Computer IBM 5100 by Danny Kuzmishchev, CC BY 4.0, Sketchfab](https://sketchfab.com/3d-models/computer-ibm-5100-e2767c9c3fb549ccbd82b25555244dd6) |
| Three.js r170 | [three@0.170.0](https://www.npmjs.com/package/three) via importmap jsDelivr | MIT |
| detect-gpu 5.0.70 | Benchmarks auto-hébergés (`./detect-gpu-benchmarks`) | MIT |
| Décodeurs Draco et Basis | copies locales depuis `three/examples/jsm/libs/` (pas de CDN pour les transcodeurs) | Apache-2.0 / Three.js |

Aucun modèle nouveau n’a été commandé. Les maillages de l’unité embarquée dans la Corvette sont fusionnés par matériau, pour rester sous 100 appels de dessin. Ombres désactivées. `pixelRatio` plafonné à 2 ; palier GPU ≤ 1 → `pixelRatio` 1.

## Mesures (412×915, `--gl angle-gl`)

Outil : `node /home/box/opt/perf3d/measure.mjs` (présent aussi sous `/workspace/perf3d/measure.mjs`). **Les fps de la box ne sont pas les fps d’un S20 FE** (ici ANGLE / llvmpipe). 0 erreur console, 0 transmission.

Textures : les atlases Corvette + C204 (WebP 1024) restent ≈ **36,06 Mo** d’estimation measure (RGBA). L’IBM 5100 ajoute **2 796 229 o** de VRAM réelle (`gpuSize`, KTX2) ≈ 2,67 Mo. `measure.mjs` surestime le KTX2 (il compte largeur×hauteur×4) et affiche alors un total trompeur (~72 Mo) : le chiffre à retenir pour l’IBM est le gpuSize.

| Vue | Appels | Triangles | fps box | JS p95 (ms) | IBM à bord |
|---|---:|---:|---:|---:|---|
| Menu | 40 | 12 860 | ~60 | 0,5 | non |
| Conduite | 44 | 12 824 | ~58 | 0,4 | non |
| Conduite (retour 1975→2036) | 47 | 16 260 | ~36–60 | 0,3 | oui (+3 appels) |
| Mini-jeu | 67 | 4 972 | ~60 | 0,4 | non (scène unité) |
| Saut | 56 | 26 232 | ~60 | 0,5 | non (aller) |
| Saut avec IBM | 59 | 29 668 | ~54 | 0,4 | oui |
| Éclatée | 72 | 5 352 | ~60 | 0,4 | non (scène unité) |
| Menu avec IBM | 58 | 17 380 | — | — | oui (si on revient au menu sans reset) |

Tout est sous 100 appels. Les fps réels sur Samsung Remote Test Lab (S20 FE, `?fps=1`) ne sont **pas encore** mesurés.

Tests Playwright (`tests/t01.js`) : 412×915 et 915×412, 0 erreur console, 0 requête 4xx, chaque mini-jeu complétable via `window.__game`, saut, IBM visible après le premier saut (nœuds `ibm_5100` / `_body` / `_screen` / `_tape`, 3 maillages, parenté à la Corvette) et masqué sur une nouvelle partie, fiche éclatée, page Sources (**9** liens, dont le crédit Sketchfab exact), régression « game over → Menu → Commencer » (3 vies), capote masquée, verre Corvette en alpha sans transmission.

## Sources citées

Toutes les fiches et la page Sources du jeu portent un lien. Rien n’est présenté comme réel s’il n’est pas vérifiable. Les personnes (Kerr, Tipler, Dubke / B.D.) sont citées dans le texte, sans portrait.

- Posts **TimeTravel_0**, Time Travel Institute, novembre 2000 – début 2001 : [recueil](https://timetravelinstitute.com/t/john-titor-the-original-posts-on-the-time-travel-institute-2000-2001/19725), [index](https://timetravelinstitute.com/t/every-john-titor-post-timetravel-0-verified-complete-index/19981)
- Fil « I am from 2036 », forums Post-to-Post d’Art Bell, 27 janvier – 24 mars 2001, dont le message d’introduction du 27 janvier : [transcription PDF](https://scorpionofscofflaw.wordpress.com/wp-content/uploads/2016/11/complete-posts-from-art-bells-post-to-post-message-board.pdf) (le forum d’origine n’est plus en ligne)
- « John Titor Time Machine Manual », mentions *Army Model GE / C204 Gravity Distortion Time Displacement Unit* et *RESTRICTED FILE TMH-2006/4605* : [Internet Archive](https://archive.org/details/JohnTitorTimeMachineManual)
- IBM 5100, émulation System/360 : [Post Bulletin](https://www.postbulletin.com/rochester-magazine/john-titor-who-was-the-time-traveler-that-visited-rochester) (ingénieur désigné B.D. dans cette version) ; [alt.folklore.computers](https://alt.folklore.computers.narkive.com/b3MlCvVT/john-titor-was-right-ibm-5100) (citation de l’article 2004 nommant Bob Dubke, et rappel que l’émulation pour APL n’était pas un secret d’État)
- Frank J. Tipler, « Rotating cylinders and the possibility of global causality violation », *Phys. Rev. D* 9, 2203 (15 avril 1974), [DOI 10.1103/PhysRevD.9.2203](https://journals.aps.org/prd/abstract/10.1103/PhysRevD.9.2203)
- Roy P. Kerr, « Gravitational Field of a Spinning Mass as an Example of Algebraically Special Metrics », *Phys. Rev. Lett.* 11, 237 (1er septembre 1963), [DOI 10.1103/PhysRevLett.11.237](https://journals.aps.org/prl/abstract/10.1103/PhysRevLett.11.237)
- Modèle 3D de l’IBM 5100 : [Computer IBM 5100 by Danny Kuzmishchev, CC BY 4.0, Sketchfab](https://sketchfab.com/3d-models/computer-ibm-5100-e2767c9c3fb549ccbd82b25555244dd6) — même crédit, même URL, dans la page Sources du jeu

## Fiches (vue éclatée)

Chaque pièce du GLB ouvre une fiche, regroupée par thème. Étiquette principale :

- **Jamais authentifié** : boîtier, couvercle, pont, plaque TMH-2006/4605, évents « rayons X » (légende tardive Paranormalis 2013), singularités principale et de pilotage, bobines, générateurs de champ, injecteurs, régulateur et générateur d’électrons, refroidissement, capteurs de mouvement et de rayon, horloges au césium (en tant que pièces de l’unité), VGL, ordinateurs, batterie, écran, interrupteur, déconnexion, commandes d’urgence, télécommande, hublots, pare-feu.
- **Documenté** : le message d’introduction (existence du post, 27 janv. 2001) est traité comme documenté sur la page Sources, avec la précision que son *contenu* n’est pas authentifié. Les fiches mélangent souvent un fait scientifique sourcé (Kerr 1963, Tipler 1974, définition SI du césium 133, entretien Dubke / B.D.) et le récit de Titor, clairement séparé.
- **Ajout de modèle** : charnières, poignées, loquets, patins, plaque de danger, anneau « top-spin », câbles — détails géométriques absents des légendes de 2000-2001.

## Captures

- `/workspace/games3d/titor-c204-jeu-v011.png` — conduite v0.1.1, unité visible dans la cabine (capote baissée, verre alpha)
- `/workspace/games3d/titor-c204-jeu-v011-paysage.png` — menu en 915×412, panneau à gauche, voiture à droite
- `/workspace/games3d/titor-c204-jeu-v012.png` — conduite du retour, IBM 5100 sur le siège passager, unité C204 visible derrière
- `/workspace/games3d/titor-c204-jeu-v012-ibm-cabine.png` — cabine rapprochée, IBM et unité
- `/workspace/games3d/titor-c204-jeu-v012-1975.png` — palier « 1975 — IBM 5100 à bord »

## Limites / prochaines étapes

- Mesurer les fps réels sur S20 FE (Remote Test Lab, `?fps=1`).
- Mémoire textures des atlases Corvette + C204 encore ≈ 36 Mo (WebP décompressé) ; l’IBM est déjà en KTX2 (≈ 2,67 Mo). Une conversion KTX2 des atlases de la voiture réduirait surtout la VRAM, non faite ici.
- L’arrêt en 2000 n’est pas jouable : le retour en 2036 est direct.
- Accords de Pascal : liens retour dans `titor-c204` et `c204-2026` ; tout nouveau modèle supplémentaire.
