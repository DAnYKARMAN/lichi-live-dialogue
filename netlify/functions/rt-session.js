// netlify/functions/rt-session.js
// Fabrique un "ticket d'entree" temporaire (jeton ephemere) pour une session
// de TRADUCTION EN DIRECT GEMINI (Google).
// La cle secrete Google reste ICI, cote serveur — jamais dans le navigateur.
//
// Variable Netlify : GEMINI_API_KEY (cle Google AI Studio)

const MODELE_PAR_DEFAUT = "models/gemini-3.5-live-translate-preview";

// On memorise le modele trouve pour ne pas redemander la liste a chaque fois.
let modeleMemorise = null;

// Demande a Google la liste des modeles du compte et choisit le modele de
// TRADUCTION EN DIRECT le plus recent reellement disponible.
async function trouverModeleTraduction(apiKey) {
  if (modeleMemorise) return modeleMemorise;
  try {
    const r = await fetch(
      "https://generativelanguage.googleapis.com/v1beta/models?pageSize=1000",
      { headers: { "x-goog-api-key": apiKey } }
    );
    const d = await r.json();
    if (r.ok && Array.isArray(d.models)) {
      const candidats = d.models
        .map((m) => m.name || "")
        .filter((n) => n.includes("live-translate"));
      candidats.sort().reverse(); // le plus recent en premier
      if (candidats.length) modeleMemorise = candidats[0];
    }
  } catch (e) {}
  return modeleMemorise || MODELE_PAR_DEFAUT;
}

exports.handler = async (event) => {
  if (event.httpMethod !== "POST") {
    return json(405, { error: "Method not allowed" });
  }

  try {
    const { targetLanguage } = JSON.parse(event.body || "{}");
    const language = String(targetLanguage || "en");

    if (!/^[a-zA-Z]{2,3}(-[a-zA-Z]{2,4})?$/.test(language)) {
      return json(400, { error: "Invalid language code." });
    }

    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) return json(500, { error: "GEMINI_API_KEY missing on Netlify." });

    const model = await trouverModeleTraduction(apiKey);
    const expireTime = new Date(Date.now() + 30 * 60 * 1000).toISOString();

    const creer = (corps) =>
      fetch("https://generativelanguage.googleapis.com/v1beta/auth_tokens", {
        method: "POST",
        headers: { "x-goog-api-key": apiKey, "Content-Type": "application/json" },
        body: JSON.stringify(corps),
      });

    // 1er essai : ticket VERROUILLE sur le modele et la langue cible.
    let response = await creer({
      uses: 1,
      expireTime,
      liveConnectConstraints: {
        model,
        config: {
          responseModalities: ["AUDIO"],
          inputAudioTranscription: {},
          outputAudioTranscription: {},
          translationConfig: { targetLanguageCode: language },
        },
      },
    });
    let data = await response.json().catch(() => ({}));

    // 2e essai (secours) : ticket simple ; la langue cible sera alors
    // envoyee par le navigateur au demarrage de la session.
    if (!response.ok) {
      const premierRefus = data;
      response = await creer({ uses: 1, expireTime });
      data = await response.json().catch(() => ({}));
      if (!response.ok) {
        return json(response.status, {
          error: "Translation session refused (code " + response.status + ")",
          detail: (data && data.error) || data || premierRefus,
        });
      }
    }

    if (!data.name) {
      return json(502, { error: "Unexpected translation engine response.", detail: data });
    }

    // On renvoie : le ticket, le modele reellement disponible, la langue cible.
    return json(200, { token: data.name, model, target: language });
  } catch (e) {
    return json(500, { error: String(e.message || e) });
  }
};

function json(statusCode, obj) {
  return {
    statusCode,
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(obj),
  };
}
