# SignStamp

Application de bureau (Tauri + React) pour remplir, annoter, signer et imprimer des PDF.

## Fonctionnalités
- Ouvrir un PDF.
- Afficher un PDF multi‑pages avec zoom et déplacement.
- Ajouter texte, date auto, case à cocher, ellipse, ligne, flèche, surlignage.
- Mettre en forme le texte (police, taille, gras/souligné/barré).
- Choisir couleurs et épaisseur de trait pour les annotations.
- Importer une signature PNG/JPG ou la dessiner, puis placer/redimensionner, renommer/supprimer.
- Utiliser des textes rapides réutilisables (snippets) en glisser‑déposer.
- Annuler, supprimer, vider les annotations.
- Exporter un PDF aplati et imprimer via le dialogue système.
- Basculer le thème clair/sombre et adapter la langue au système.

## Stack
- Utiliser React + Vite.
- Rendre via pdf.js et exporter via pdf-lib.
- Cibler Tauri v2.
- Tester avec Vitest + Testing Library.

## Installation (utilisateur)
- Télécharger l’installateur depuis les Releases GitHub (Windows/macOS/Linux).
- Retrouver l’app dans “Ouvrir avec” pour les PDF après installation.
- Ne fournir que l’app desktop Tauri (pas de version web hébergée).

## Démarrage rapide (dev)
```bash
npm install
npm run tauri dev
```

## Scripts
```bash
npm run tauri dev # Lancer l’app desktop
npm test          # Lancer les tests
```

## Fonctionnement (résumé)
- Utiliser pdf.js (worker) pour afficher chaque page.
- Stocker les annotations en coordonnées PDF.
- Créer un nouveau PDF aplati via pdf-lib.
- Persister signatures et snippets côté Tauri (app_data).

## Structure
```
src/
  App.tsx           # Regrouper l’UI + logique principale
  i18n.ts           # Gérer les traductions
  pdf/              # Regrouper les helpers PDF (coords, export)
src-tauri/
  src/main.rs       # Exposer les commandes Tauri (save/load, open-with, export)
```

## Développement & tests
- Tester les coordonnées PDF et l’export.
- Tester les actions UI critiques (export désactivé sans PDF, import signature actif).

## Licence
MIT.
