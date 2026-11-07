# Lichi Live – Dialogue EN-HE — Guide

## Le principe

Un seul téléphone (ou une seule tablette) posé **au milieu de la table**.
L'écran est coupé en deux :

- **En bas** : vous (la langue du client de la licence, par exemple l'anglais).
- **En haut, à l'envers** : la personne en face (par exemple l'hébreu). Elle lit
  son texte à l'endroit, de son côté de la table.

Personne n'appuie sur un bouton pour prendre la parole : chacun parle quand il
veut, **la langue est reconnue automatiquement**.

- Quand vous parlez anglais : vous voyez en bas ce que vous avez dit (« You said »)
  pour vérifier la transcription, et la personne en face voit la traduction en
  hébreu, en grand, de son côté.
- Quand elle répond en hébreu : elle voit sa phrase transcrite de son côté, et
  vous voyez la traduction anglaise en grand, en bas.

## Les trois boutons du centre

| Bouton | Rôle |
|---|---|
| 🎤 (le grand bouton) | **ON** : rouge, avec des ondes qui bougent de chaque côté au rythme de la voix. **OFF** : gris et barré. Les heures de la licence ne sont décomptées que sur ON. |
| 🔊 | **Lire à voix haute** la dernière intervention traduite (une ou plusieurs phrases de la même personne), en entier. Le bouton pulse pendant la lecture ; un nouvel appui l'arrête. |
| Aa | Agrandit le texte (4 tailles). |

Toucher une bulle fait lire cette réplique traduite à voix haute.
Pendant la lecture, le micro est COUPÉ automatiquement (bouton micro gris et barré), puis il se rallume tout seul à la fin : la tablette ne retraduit jamais sa propre voix.
La lecture utilise la voix de synthèse de la tablette (sur iPhone/iPad : voix hébreu « Carmit », anglais, etc.).

## Mettre l'icône sur l'écran d'accueil (iPhone)

1. Ouvrir le lien de licence dans **Safari**.
2. Bouton Partager → **« Sur l'écran d'accueil »**.
3. L'icône Lichi apparaît avec le nom « Lichi EN-HE ». Le lien de licence est
   gardé dans l'icône : il n'y a plus rien à retaper.

Sur Android (Chrome) : menu ⋮ → « Ajouter à l'écran d'accueil ».

## Moteur : Microsoft Azure Speech

Depuis cette version, la reconnaissance et la traduction sont faites par
**Microsoft Azure Speech** (le même moteur que l'application WordPress
« 3 langues »), et non plus par Gemini :
- Azure reconnaît automatiquement laquelle des deux langues est parlée ;
- il utilise un modèle spécialisé par langue (ex : hébreu he-IL) ;
- il découpe la parole phrase par phrase (bulles propres) ;
- il accepte un **glossaire** par licence (voir plus bas).

La clé Azure reste cachée sur Netlify : le navigateur ne reçoit qu'un ticket
de 10 minutes, et seulement avec une licence valide.

⚠️ La page WordPress affichait la clé Azure en clair dans son code :
il faut la **régénérer** dans le portail Azure (ressource Speech →
« Clés et point de terminaison » → « Régénérer la clé 1 ») et mettre la
nouvelle clé dans Netlify. (La page WordPress devra utiliser la clé 2 ou être
mise à jour.)

## Mise en ligne (GitHub + Netlify)

Structure exacte :

    index.html
    admin-licences.html
    manifest.webmanifest
    netlify.toml
    package.json
    icons/            (5 fichiers d'icônes)
    netlify/functions/azure-token.js
    netlify/functions/licences.js
    netlify/functions/ui-strings.js

Le fichier `netlify/functions/rt-session.js` (Gemini) n'est plus utilisé :
vous pouvez le supprimer de GitHub.

Variables Netlify (Site settings → Environment variables) :

    AZURE_SPEECH_KEY     = la clé de votre ressource Azure Speech
    AZURE_SPEECH_REGION  = francecentral   (la région de la ressource)
    ADMIN_PASSWORD       = mot de passe de la page d'administration
    FIREBASE_DB_URL      = l'adresse de votre base Firebase
    GEMINI_API_KEY       = (facultatif) sert seulement à traduire les boutons
                           pour une langue autre que anglais / hébreu / français

Après avoir ajouté les variables : Deploys → Trigger deploy → Deploy site.

## Licences

Même page que d'habitude, en anglais : `https://votre-site.netlify.app/admin-licences.html`

- Les langues se choisissent à la création de la licence :
  « Customer language » = en bas de l'écran, « Other person's language » = en haut.
- **Glossary** : une liste de mots ou d'expressions qu'Azure doit bien
  reconnaître (ex : ים המלח, Massada, noms de personnes, de lieux, de produits).
  À la création (un terme par ligne) ou ensuite avec le bouton « Glossary (n) »
  de chaque licence (termes séparés par « ; »).
- Codes du type **LICHI-7K3M-Q9X2**, rangés à part dans Firebase (`/licences_lichi/`).
- Pause automatique après 15 minutes sans parole (le décompte s'arrête).

## Si quelque chose ne marche pas

- « Connection lost — retrying… » qui ne s'arrête pas → vérifier AZURE_SPEECH_KEY
  et AZURE_SPEECH_REGION sur Netlify, puis redéployer.
- « Speech engine not loaded » → problème de connexion internet de la tablette.
- Pas de son à la lecture → vérifier que la tablette n'est pas en mode silencieux.
- « Access reserved for customers » → ouvrir le lien de licence complet (`…/?licence=LICHI-…`).
