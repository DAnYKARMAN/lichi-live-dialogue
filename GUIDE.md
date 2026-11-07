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
| 🎤 (le grand bouton rouge) | Démarrer / mettre en pause l'écoute. Les heures de la licence ne sont décomptées que pendant l'écoute. |
| 🔊 | **Traduction orale** activée/désactivée. Barré = la machine ne parle pas. Le choix est mémorisé. |
| Aa | Agrandit le texte (4 tailles). Utile pour une personne qui voit mal. |

Pour une personne malvoyante : **toucher un message fait réentendre la
traduction**, même quand la traduction orale est coupée.

Pendant que le téléphone parle, il n'écoute pas le micro (sinon il retraduirait
sa propre voix). Il faut donc laisser la voix finir avant de répondre.

## Mettre l'icône sur l'écran d'accueil (iPhone)

1. Ouvrir le lien de licence dans **Safari**.
2. Bouton Partager → **« Sur l'écran d'accueil »**.
3. L'icône Lichi apparaît avec le nom « Lichi EN-HE ». Le lien de licence est
   gardé dans l'icône : il n'y a plus rien à retaper.

Sur Android (Chrome) : menu ⋮ → « Ajouter à l'écran d'accueil ».

## Mise en ligne (nouveau projet GitHub + Netlify)

Structure exacte :

    index.html
    admin-licences.html
    manifest.webmanifest
    netlify.toml
    package.json
    icons/            (5 fichiers d'icônes)
    netlify/functions/rt-session.js
    netlify/functions/licences.js
    netlify/functions/ui-strings.js

Variables Netlify (Site settings → Environment variables) — les mêmes que
d'habitude, **sauf LiveKit qui n'est plus nécessaire** (un seul appareil) :

    GEMINI_API_KEY   = votre clé Google AI Studio
    ADMIN_PASSWORD   = mot de passe de la page d'administration
    FIREBASE_DB_URL  = l'adresse de votre base Firebase

Après avoir ajouté les variables : Deploys → Trigger deploy → Deploy site.

## Licences

Même page que d'habitude, en anglais : `https://votre-site.netlify.app/admin-licences.html`

- Les langues se choisissent à la création de la licence :
  « Customer language » = en bas de l'écran, « Other person's language » = en haut.
  Par défaut : English / Hebrew.
- Codes du type **LICHI-7K3M-Q9X2**.
- Les licences Lichi sont rangées à part dans Firebase (`/licences_lichi/`) :
  elles ne se mélangent pas avec celles de TalkWithoutBorders.
- Pause automatique après 15 minutes sans parole (le décompte s'arrête).

## Coût à connaître

Pour reconnaître la langue instantanément, l'application écoute avec **deux
canaux Gemini en même temps** (un vers l'hébreu, un vers l'anglais) et garde
automatiquement le bon. La consommation Gemini est donc environ **double** par
minute par rapport à TalkWithoutBorders. Le décompte des heures de licence,
lui, reste d'une minute par minute.

## Si quelque chose ne marche pas

- « Connection lost — retrying… » qui ne s'arrête pas → vérifier GEMINI_API_KEY puis redéployer.
- Pas de son → vérifier que 🔊 n'est pas barré, et que le téléphone n'est pas en mode silencieux.
- « Access reserved for customers » → ouvrir le lien de licence complet (`…/?licence=LICHI-…`).
