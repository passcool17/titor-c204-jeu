# Mission Titor · C204 — v0.1.0

- Lien jouable : https://passcool17.github.io/titor-c204-jeu/
- Dépôt : https://github.com/passcool17/titor-c204-jeu
- État : v0.1.0 — nouveau jeu, distinct des applications déjà publiées (`titor-c204`, scène Corvette, `c204-2026`). Le joueur est l’opérateur de l’unité C204, au volant d’une Corvette 1967. Mission (récit de John Titor, 2000-2001) : partir de 2036, aller en 1975 chercher un IBM 5100, revenir en 2036. Chaque saut = quatre mini-jeux de démarrage, puis un maintien du champ. Vue éclatée interactive, fiches étiquetées **Documenté** / **Jamais authentifié** / **Ajout de modèle**, page Sources. Interface en français.

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

Les liens **retour** dans ces trois applications n’ont **pas** été ajoutés dans cette version : cela demanderait de modifier des dépôts existants, et nécessite l’accord de Pascal.

## Ressources (source et licence)

| Fichier | Source | Licence |
|---|---|---|
| `assets/c204-v2.glb` (335 472 o, Draco + WebP) | `/workspace/assets3d/titor-c204/glb/c204.glb` v2, chaîne 3D du projet (Modélisation → Rig → Rendu) | Création originale, propriété de Pascal |
| `assets/corvette-v2.glb` (295 120 o, Draco + WebP) | `/workspace/assets3d/corvette-1967/glb/corvette.glb` v2, même chaîne ; sans logo ni marque officielle | Création originale, propriété de Pascal |
| Three.js r170 | [three@0.170.0](https://www.npmjs.com/package/three) via importmap jsDelivr | MIT |
| detect-gpu 5.0.70 | Benchmarks auto-hébergés (`./detect-gpu-benchmarks`) | MIT |
| Décodeurs Draco et Basis | copies locales depuis `three/examples/jsm/libs/` (pas de CDN pour les transcodeurs) | Apache-2.0 / Three.js |

Aucun modèle nouveau n’a été commandé. Le verre (`C204_PortGlass`, `Corvette_Glass`) est rendu **opaque** (pas de transmission, pas de second passage). Les maillages de l’unité embarquée dans la Corvette sont fusionnés par matériau, pour rester sous 100 appels de dessin. Ombres désactivées. `pixelRatio` plafonné à 2 ; palier GPU ≤ 1 → `pixelRatio` 1. Service worker manuel, actifs versionnés, HTML en réseau d’abord.

## Mesures (412×915, `--gl angle-gl`)

Outil : `node /home/box/opt/perf3d/measure.mjs` (présent aussi sous `/workspace/perf3d/measure.mjs`). **Les fps de la box ne sont pas les fps d’un S20 FE** (ici ANGLE / llvmpipe). 0 erreur console, 0 transmission.

| Vue | Appels | Triangles | fps box | JS p95 (ms) |
|---|---:|---:|---:|---:|
| Menu | 41 | 13 748 | ~60 | 0,5 |
| Conduite | 55 | 14 680 | ~60 | 0,6 |
| Mini-jeu | 67 | 4 972 | ~60 | 0,6 |
| Saut | 56 | 26 968 | ~60 | 0,7 |
| Éclatée | 72 | 5 352 | ~60 | 0,6 |

Tout est sous 100 appels. Les fps réels sur Samsung Remote Test Lab (S20 FE, `?fps=1`) ne sont **pas encore** mesurés.

Tests Playwright (`tests/t01.js`) : 412×915 et 915×412, 0 erreur console, 0 requête 4xx, chaque mini-jeu complétable via `window.__game`, saut, fiche éclatée, page Sources (8 liens).

## Sources citées

Toutes les fiches et la page Sources du jeu portent un lien. Rien n’est présenté comme réel s’il n’est pas vérifiable. Les personnes (Kerr, Tipler, Dubke / B.D.) sont citées dans le texte, sans portrait.

- Posts **TimeTravel_0**, Time Travel Institute, novembre 2000 – début 2001 : [recueil](https://timetravelinstitute.com/t/john-titor-the-original-posts-on-the-time-travel-institute-2000-2001/19725), [index](https://timetravelinstitute.com/t/every-john-titor-post-timetravel-0-verified-complete-index/19981)
- Fil « I am from 2036 », forums Post-to-Post d’Art Bell, 27 janvier – 24 mars 2001, dont le message d’introduction du 27 janvier : [transcription PDF](https://scorpionofscofflaw.wordpress.com/wp-content/uploads/2016/11/complete-posts-from-art-bells-post-to-post-message-board.pdf) (le forum d’origine n’est plus en ligne)
- « John Titor Time Machine Manual », mentions *Army Model GE / C204 Gravity Distortion Time Displacement Unit* et *RESTRICTED FILE TMH-2006/4605* : [Internet Archive](https://archive.org/details/JohnTitorTimeMachineManual)
- IBM 5100, émulation System/360 : [Post Bulletin](https://www.postbulletin.com/rochester-magazine/john-titor-who-was-the-time-traveler-that-visited-rochester) (ingénieur désigné B.D. dans cette version) ; [alt.folklore.computers](https://alt.folklore.computers.narkive.com/b3MlCvVT/john-titor-was-right-ibm-5100) (citation de l’article 2004 nommant Bob Dubke, et rappel que l’émulation pour APL n’était pas un secret d’État)
- Frank J. Tipler, « Rotating cylinders and the possibility of global causality violation », *Phys. Rev. D* 9, 2203 (15 avril 1974), [DOI 10.1103/PhysRevD.9.2203](https://journals.aps.org/prd/abstract/10.1103/PhysRevD.9.2203)
- Roy P. Kerr, « Gravitational Field of a Spinning Mass as an Example of Algebraically Special Metrics », *Phys. Rev. Lett.* 11, 237 (1er septembre 1963), [DOI 10.1103/PhysRevLett.11.237](https://journals.aps.org/prl/abstract/10.1103/PhysRevLett.11.237)

## Fiches (vue éclatée)

Chaque pièce du GLB ouvre une fiche, regroupée par thème. Étiquette principale :

- **Jamais authentifié** : boîtier, couvercle, pont, plaque TMH-2006/4605, évents « rayons X » (légende tardive Paranormalis 2013), singularités principale et de pilotage, bobines, générateurs de champ, injecteurs, régulateur et générateur d’électrons, refroidissement, capteurs de mouvement et de rayon, horloges au césium (en tant que pièces de l’unité), VGL, ordinateurs, batterie, écran, interrupteur, déconnexion, commandes d’urgence, télécommande, hublots, pare-feu.
- **Documenté** : le message d’introduction (existence du post, 27 janv. 2001) est traité comme documenté sur la page Sources, avec la précision que son *contenu* n’est pas authentifié. Les fiches mélangent souvent un fait scientifique sourcé (Kerr 1963, Tipler 1974, définition SI du césium 133, entretien Dubke / B.D.) et le récit de Titor, clairement séparé.
- **Ajout de modèle** : charnières, poignées, loquets, patins, plaque de danger, anneau « top-spin », câbles — détails géométriques absents des légendes de 2000-2001.

## Captures

- `/workspace/games3d/titor-c204-jeu-v010.png` — saut (conduite dans le tunnel)
- `/workspace/games3d/titor-c204-jeu-v010-eclate.png` — vue éclatée + fiche
- `/workspace/games3d/titor-c204-jeu-v010-minijeu.png` — injection d’électrons
- `/workspace/games3d/titor-c204-jeu-v010-compare.png` — comparaison jeu (3/4, profil, arrière) / aperçus du modèle / pages 6, 7 et 8 du manuel (Internet Archive)

## Prochaines étapes

- Mesurer les fps réels sur S20 FE (Remote Test Lab, `?fps=1`).
- Accords de Pascal : liens retour dans `titor-c204` et `c204-2026` ; tout nouveau modèle (IBM 5100, etc.).
- Si besoin : réduire la mémoire textures (~36 Mo GPU estimés, atlases décompressés), améliorer la visibilité de l’unité dans la Corvette (capot / capote), passage optionnel en 2000 comme dans le récit.
- Envoyer au Testeur QA (fait par le Chef de cabinet, pas par ce dépôt).
