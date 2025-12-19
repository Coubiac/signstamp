# SignStamp

Application de bureau (Tauri + React) pour remplir et signer des PDF.  
Ce dépôt sert aussi de test de création "full IA" (conception, code, UI, refactor, tests).

## Fonctionnalités
- Ouvrir un PDF (viewer multi‑pages avec scroll).
- Ajouter du texte, une date du jour, une croix (case à cocher).
- Importer une signature (PNG/JPG) et la placer/redimensionner.
- Exporter un PDF aplati (texte + image intégrés).
- Sauvegarde des signatures en local (Tauri).
- UI responsive + thème clair/sombre selon le système.
- Traductions automatiques selon la langue du système.

## Stack
- Front: React + Vite
- PDF: pdf.js (rendu) + pdf-lib (export)
- Desktop: Tauri v2
- Tests: Vitest + Testing Library

## Démarrage rapide
```bash
npm install
npm run tauri dev
```

## Scripts
```bash
npm run dev       # Vite (web)
npm run tauri dev # App desktop
npm run build     # Build web
npm test          # Tests
```

## Fonctionnement (résumé)
- Le rendu PDF utilise pdf.js (worker) pour afficher chaque page.
- Les annotations (texte/croix/signature) sont stockées en coordonnées PDF.
- L’export crée un nouveau PDF aplati via pdf-lib.
- Les signatures importées sont persistées dans `app_data` côté Tauri.

## Structure
```
src/
  App.tsx           # UI + logique principale
  i18n.ts           # Traductions
  pdf/              # helpers PDF (coords, export)
src-tauri/
  src/main.rs       # commandes Tauri (save/load signatures, export)
```

## Développement & tests
- Tests unitaires: coordonnées PDF + export.
- Tests UI minimaux: actions critiques (export désactivé sans PDF, import signature actif).

## Notes
- En mode web, la persistance des signatures n’est pas active (Tauri uniquement).
- L’export utilise un dialogue natif via Tauri (mode desktop).

## Roadmap (optionnel)
- Vignettes de pages + navigation rapide.
- Outils supplémentaires (tampons, surlignage).
- Gestion avancée des signatures (tags, suppression).

## Licence
MIT.
