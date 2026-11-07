// netlify/functions/licences.js
// Gestion des licences de LICHI LIVE – DIALOGUE.
// Le mot de passe admin et l'adresse de la base Firebase restent ICI,
// cote serveur — jamais dans le navigateur.
//
// Variables a definir sur Netlify (Site settings -> Environment variables) :
//   ADMIN_PASSWORD    = le mot de passe de la page d'administration
//   FIREBASE_DB_URL   = l'adresse de votre base Firebase
//                       (ex: https://sogevoxreunion-default-rtdb.europe-west1.firebasedatabase.app)
//
// Les licences sont rangees dans la base sous /licences_lichi/
// (separees de TalkWithoutBorders, pour ne pas melanger les clients).

exports.handler = async (event) => {
  if (event.httpMethod !== "POST") {
    return json(405, { error: "Method not allowed" });
  }

  const adminPassword = process.env.ADMIN_PASSWORD;
  const dbUrl = (process.env.FIREBASE_DB_URL || "").replace(/\/+$/, "");

  if (!adminPassword) return json(500, { error: "ADMIN_PASSWORD missing on Netlify." });
  if (!dbUrl) return json(500, { error: "FIREBASE_DB_URL missing on Netlify." });

  let body;
  try {
    body = JSON.parse(event.body || "{}");
  } catch {
    return json(400, { error: "Unreadable request." });
  }

  const action = body.action;
  const base = `${dbUrl}/licences_lichi`;

  // Le mot de passe n'est exige que pour les actions d'ADMINISTRATION.
  // "verify" et "use" sont appelees par le site cote client (avec le code licence).
  const actionsAdmin = ["list", "create", "delete", "glossary"];
  if (actionsAdmin.includes(action)) {
    if (String(body.password || "") !== String(adminPassword)) {
      return json(401, { error: "Wrong password." });
    }
  }

  try {
    // ----- LISTER toutes les licences -----
    if (action === "list") {
      const r = await fetch(`${base}.json`);
      const data = (await r.json()) || {};
      // On transforme l'objet Firebase en liste triee (plus recentes en premier)
      const liste = Object.entries(data)
        .map(([id, lic]) => ({ id, ...lic }))
        .sort((a, b) => (b.creeLe || "").localeCompare(a.creeLe || ""));
      return json(200, { licences: liste });
    }

    // ----- CREER une licence -----
    if (action === "create") {
      const client = String(body.client || "").trim();
      const heures = Number(body.heures);
      const expiration = String(body.expiration || "").trim(); // format AAAA-MM-JJ

      if (!client) return json(400, { error: "Customer name is required." });
      if (!Number.isFinite(heures) || heures <= 0) {
        return json(400, { error: "Hours must be a positive number." });
      }
      if (!/^\d{4}-\d{2}-\d{2}$/.test(expiration)) {
        return json(400, { error: "Expiry date is required." });
      }

      // Langues choisies dans l'administration (catalogue Gemini).
      // Un code de langue ressemble a "fr", "en", "zh-Hans", "pt-BR"...
      const codeLangueValide = /^[a-zA-Z]{2,3}(-[a-zA-Z]{2,4})?$/;
      const langueHote = codeLangueValide.test(body.langueHote || "") ? body.langueHote : "en";
      const langueInvite = codeLangueValide.test(body.langueInvite || "") ? body.langueInvite : "he";
      if (langueHote === langueInvite) {
        return json(400, { error: "The two languages must be different." });
      }

      const glossaire = nettoyerGlossaire(body.glossaire);
      const code = genererCode();
      const licence = {
        code,
        client,
        heures,              // total achete
        heuresRestantes: heures,
        expiration,          // AAAA-MM-JJ
        langueHote,          // langue parlee par le client (ex: "fr")
        langueInvite,        // langue parlee par son interlocuteur (ex: "en")
        glossaire,           // mots et expressions a bien reconnaitre (ex: "ים המלח")
        creeLe: new Date().toISOString(),
      };

      const r = await fetch(`${base}.json`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(licence),
      });
      if (!r.ok) return json(502, { error: "Firebase refused the write." });
      const { name: id } = await r.json();
      return json(200, { ok: true, licence: { id, ...licence } });
    }

    // ----- MODIFIER le glossaire d'une licence -----
    if (action === "glossary") {
      const id = String(body.id || "").trim();
      if (!id || /[.#$\[\]\/]/.test(id)) return json(400, { error: "Invalid id." });
      const glossaire = nettoyerGlossaire(body.glossaire);
      const r = await fetch(`${base}/${id}.json`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ glossaire }),
      });
      if (!r.ok) return json(502, { error: "Firebase refused the update." });
      return json(200, { ok: true, glossaire });
    }

    // ----- SUPPRIMER une licence -----
    if (action === "delete") {
      const id = String(body.id || "").trim();
      if (!id || /[.#$\[\]\/]/.test(id)) return json(400, { error: "Invalid id." });
      const r = await fetch(`${base}/${id}.json`, { method: "DELETE" });
      if (!r.ok) return json(502, { error: "Firebase refused the deletion." });
      return json(200, { ok: true });
    }

    // ----- VERIFIER une licence (appele par le site quand le client ouvre son lien) -----
    if (action === "verify") {
      const resultat = await trouverLicence(base, body.code);
      if (resultat.error) return json(200, { ok: false, error: resultat.error });
      const { licence } = resultat;
      return json(200, {
        ok: true,
        licence: {
          code: licence.code,
          client: licence.client,
          heuresRestantes: licence.heuresRestantes,
          expiration: licence.expiration,
          langueHote: licence.langueHote || "en",
          langueInvite: licence.langueInvite || "he",
          glossaire: Array.isArray(licence.glossaire) ? licence.glossaire : [],
        },
      });
    }

    // ----- CONSOMMER du temps (appele chaque minute pendant une conversation) -----
    if (action === "use") {
      const minutes = Number(body.minutes);
      if (!Number.isFinite(minutes) || minutes <= 0 || minutes > 10) {
        return json(400, { error: "Invalid duration." });
      }
      const resultat = await trouverLicence(base, body.code);
      if (resultat.error) return json(200, { ok: false, error: resultat.error });

      const { id, licence } = resultat;
      const nouvellesHeures = Math.max(0, (licence.heuresRestantes || 0) - minutes / 60);

      const r = await fetch(`${base}/${id}.json`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ heuresRestantes: nouvellesHeures }),
      });
      if (!r.ok) return json(502, { error: "Firebase refused the update." });

      return json(200, { ok: true, heuresRestantes: nouvellesHeures });
    }

    return json(400, { error: "Unknown action." });
  } catch (e) {
    return json(500, { error: String(e.message || e) });
  }
};

// Retrouve une licence par son code et verifie qu'elle est valide.
// Renvoie { id, licence } si tout va bien, ou { error: "..." } sinon.
async function trouverLicence(base, codeRecu) {
  const code = String(codeRecu || "").trim().toUpperCase();
  if (!code) return { error: "No license code provided." };

  const r = await fetch(`${base}.json`);
  const data = (await r.json()) || {};

  let id = null;
  let licence = null;
  for (const [cle, lic] of Object.entries(data)) {
    if (lic && String(lic.code || "").toUpperCase() === code) {
      id = cle;
      licence = lic;
      break;
    }
  }

  if (!licence) return { error: "License not found. Please check your link." };

  // Expiree ?
  const aujourdHui = new Date();
  aujourdHui.setHours(0, 0, 0, 0);
  const dateExp = new Date(licence.expiration + "T23:59:59");
  if (isNaN(dateExp.getTime()) || dateExp < aujourdHui) {
    return { error: "This license has expired." };
  }

  // Plus d'heures ?
  const restantes = licence.heuresRestantes != null ? licence.heuresRestantes : licence.heures;
  if (!(restantes > 0)) {
    return { error: "This license has no hours left." };
  }

  licence.heuresRestantes = restantes;
  return { id, licence };
}

// Glossaire : liste de mots/expressions (une par ligne), 300 au maximum.
function nettoyerGlossaire(entree) {
  const liste = Array.isArray(entree) ? entree : String(entree || "").split(/[\n;]+/);
  const vus = new Set();
  const propre = [];
  for (const t of liste) {
    const m = String(t || "").trim().slice(0, 80);
    if (m && !vus.has(m)) { vus.add(m); propre.push(m); }
    if (propre.length >= 300) break;
  }
  return propre;
}

// Genere un code de licence lisible, du type LICHI-7K3M-Q9X2
function genererCode() {
  const alphabet = "ABCDEFGHJKMNPQRSTUVWXYZ23456789"; // sans O/0, I/1, L
  const bloc = () =>
    Array.from({ length: 4 }, () => alphabet[Math.floor(Math.random() * alphabet.length)]).join("");
  return `LICHI-${bloc()}-${bloc()}`;
}

function json(statusCode, obj) {
  return {
    statusCode,
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(obj),
  };
}
