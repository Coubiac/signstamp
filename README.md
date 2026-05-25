# Cerfini

Application de bureau (Tauri + React) pour remplir, annoter, signer et imprimer des PDF.

## Fonctionnalités
- Ouvrir un PDF (mono‑ ou multi‑pages) avec zoom et déplacement.
- Ajouter texte, date auto (rafraîchie à l'application d'un template), case à cocher, ellipse, ligne, flèche, surlignage.
- Mettre en forme le texte (police, taille, gras/souligné/barré, couleur).
- Importer une signature PNG/JPG ou la dessiner ; placer, redimensionner, renommer, supprimer.
- **Paraphes multi‑pages** : importer ou dessiner un paraphe, le placer une fois et le voir apparaître sur toutes les pages.
- **Remplir les formulaires AcroForm** présents dans le PDF : champs texte, cases à cocher, boutons radio, listes déroulantes ; les boutons Reset sont actionnables, les autres push buttons sont inertes.
- **Templates utilisateur** : sauvegarder les overlays placés sur un PDF récurrent sous un nom, puis les ré‑appliquer en un clic à n'importe quel PDF.
- Textes rapides réutilisables (snippets) en glisser‑déposer.
- Annuler, supprimer, vider les annotations.
- Exporter un PDF aplati (overlays gravés) et imprimer via le dialogue système.
- Barre de menu native (File / Edit / View / Help) avec raccourcis clavier — `Cmd/Ctrl + O/S/P/T/Z/+/-/0` notamment.
- Thème clair/sombre, langue détectée depuis le système (en, fr, de, es, zh, ja, ar, uk).

## Stack
- React 18 + Vite + TypeScript.
- Rendu via pdf.js, export via pdf-lib.
- Tauri v2 (Rust) pour le shell desktop et la persistance (`signatures.json`, `paraphs.json`, `templates.json`, `snippets.json` dans `app_data_dir`).
- Tests : Vitest + Testing Library (jsdom).

## Posture sécurité
- pdf.js chargé avec `isEvalSupported: false`, `disableAutoFetch: true`, `disableStream: true` — pas d'exécution de JavaScript embarqué ni de récupération de ressources distantes.
- Les commandes Tauri qui prennent un chemin valident l'extension `.pdf` côté Rust.

## Installation (utilisateur)
- Télécharger l'installateur depuis les Releases GitHub (Windows `.msi`/`.exe`, macOS `.dmg`, Linux `.deb`/`.rpm`).
- Après installation, l'app apparaît dans "Ouvrir avec" pour les fichiers PDF.
- Pas de version web hébergée — l'app est desktop‑only par design.

## Démarrage rapide (dev)
```bash
npm install
npm run tauri dev
```

## Scripts
```bash
npm run tauri dev    # Lancer l'app desktop en mode dev
npm test             # Lancer les tests une fois
npm run test:watch   # Lancer les tests en watch
npm run tauri build  # Produire les bundles pour la plateforme courante
```

## Fonctionnement (résumé)
- pdf.js (worker) affiche chaque page sur un `<canvas>`.
- Les overlays (text, sign, check, ellipse, line, arrow, highlight) sont stockés en coordonnées PDF — un drag/zoom les replace correctement.
- À l'export, pdf-lib charge le PDF d'origine, écrit les valeurs AcroForm (si présentes), puis grave chaque overlay et le paraphe sur chaque page.
- Les templates sauvegardent un snapshot des overlays + paraphe sous un nom. À l'application, les items sont deep‑clonés, leurs IDs régénérés, et les items `autoDate` rafraîchis avec la date du jour.

## Structure
```
src/
  App.tsx                     # UI + logique principale
  i18n/                       # Bundles par locale (en source de vérité)
  pdf/                        # Helpers coords + export pdf-lib
  hooks/                      # usePdfDocument, useFormFields, useDragMachine,
                              # useSignatures, useParaphAssets, useTemplates, …
  components/items/           # Un overlay par type d'item
  components/                 # FormFieldOverlay, TemplatesModal, …
  templates/                  # types + applyTemplate (pure)
src-tauri/
  src/main.rs                 # Commandes Tauri + menu natif
```

## Développement & tests
- Tests sur les coordonnées PDF, l'export pdf-lib (round-trip), la détection AcroForm, la machine de drag, `applyTemplate`, etc.
- 122 tests au dernier décompte ; tout doit rester vert.

## Licence
MIT.
