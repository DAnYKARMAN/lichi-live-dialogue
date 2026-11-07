// netlify/functions/ui-strings.js
// Traduit les textes de l'ecran de dialogue dans une langue qui n'est pas
// deja integree (anglais, hebreu, francais le sont). Traduction faite UNE
// seule fois par langue avec Gemini, puis rangee dans Firebase.
//
// Variables Netlify utilisees : GEMINI_API_KEY, FIREBASE_DB_URL

const TEXTES_EN = {
  tapToStart: "Tap the microphone to start",
  connecting: "Connecting…",
  listening: "Listening — speak in {A} or {B}",
  paused: "Paused — tap the microphone to continue",
  youSaid: "You said",
  voiceOn: "Spoken translation: ON",
  voiceOff: "Spoken translation: OFF",
  retrying: "Connection lost — retrying…",
  inactive: "Paused after 15 minutes without speech.",
  micError: "Microphone unavailable. Please allow microphone access.",
  noHours: "This license has no hours left. Please contact us to top it up.",
  tapReplay: "Tap a message to hear it again",
};

exports.handler = async (event) => {
  if (event.httpMethod !== "POST") return json(405, { error: "Method not allowed" });
  try {
    const { lang } = JSON.parse(event.body || "{}");
    const code = String(lang || "en");
    if (!/^[a-zA-Z]{2,3}(-[a-zA-Z]{2,4})?$/.test(code)) return json(400, { error: "Invalid language code." });
    if (code === "en") return json(200, { strings: TEXTES_EN });

    const dbUrl = (process.env.FIREBASE_DB_URL || "").replace(/\/+$/, "");
    const cacheUrl = dbUrl ? `${dbUrl}/ui_strings_lichi/v1/${code}.json` : null;

    // 1) Deja traduit ? On sert la version rangee dans Firebase.
    if (cacheUrl) {
      try {
        const r = await fetch(cacheUrl);
        const enCache = await r.json();
        if (enCache && enCache.tapToStart) return json(200, { strings: enCache });
      } catch (e) {}
    }

    // 2) Sinon traduction par Gemini (plusieurs noms de modeles, Google les renomme parfois).
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) return json(500, { error: "GEMINI_API_KEY missing on Netlify." });

    const modeles = ["gemini-flash-latest", "gemini-2.5-flash", "gemini-2.0-flash"];
    let r = null, data = {};
    for (const modele of modeles) {
      r = await fetch("https://generativelanguage.googleapis.com/v1beta/models/" + modele + ":generateContent", {
        method: "POST",
        headers: { "x-goog-api-key": apiKey, "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [{ parts: [{ text:
            "Translate the VALUES of this JSON object into the language whose BCP-47 code is \"" + code +
            "\". Keep the KEYS unchanged. Keep the placeholders {A} and {B} exactly as they are. " +
            "Use short, natural wording for on-screen messages. Return ONLY the JSON object.\n\n" +
            JSON.stringify(TEXTES_EN) }] }],
          generationConfig: { temperature: 0.2, responseMimeType: "application/json" },
        }),
      });
      data = await r.json().catch(() => ({}));
      if (r.ok) break;
    }
    if (!r || !r.ok) return json(502, { error: "UI translation refused", detail: data.error || data });

    let strings = {};
    try { strings = JSON.parse(data.candidates[0].content.parts[0].text); } catch (e) {
      return json(502, { error: "Unreadable translation." });
    }
    const complet = {};
    for (const cle of Object.keys(TEXTES_EN)) {
      complet[cle] = (typeof strings[cle] === "string" && strings[cle].trim()) ? strings[cle] : TEXTES_EN[cle];
    }
    if (cacheUrl) {
      try { await fetch(cacheUrl, { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(complet) }); } catch (e) {}
    }
    return json(200, { strings: complet });
  } catch (e) {
    return json(500, { error: String(e.message || e) });
  }
};

function json(statusCode, obj) {
  return { statusCode, headers: { "Content-Type": "application/json" }, body: JSON.stringify(obj) };
}
