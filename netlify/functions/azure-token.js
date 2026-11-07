// netlify/functions/azure-token.js
// Fabrique un "ticket" temporaire (10 minutes) pour le moteur de reconnaissance
// et de traduction MICROSOFT AZURE SPEECH. La cle Azure reste ICI, cote
// serveur — jamais dans le navigateur (contrairement a l'ancienne page WordPress).
// Le ticket n'est donne qu'a un client qui a une licence Lichi valide.
//
// Variables Netlify :
//   AZURE_SPEECH_KEY     = la cle de la ressource Azure Speech
//   AZURE_SPEECH_REGION  = la region de la ressource (ex : francecentral)
//   FIREBASE_DB_URL      = l'adresse de la base Firebase (pour verifier la licence)

exports.handler = async (event) => {
  if (event.httpMethod !== "POST") return json(405, { error: "Method not allowed" });

  const key = process.env.AZURE_SPEECH_KEY;
  const region = (process.env.AZURE_SPEECH_REGION || "francecentral").trim();
  const dbUrl = (process.env.FIREBASE_DB_URL || "").replace(/\/+$/, "");
  if (!key) return json(500, { error: "AZURE_SPEECH_KEY missing on Netlify." });
  if (!dbUrl) return json(500, { error: "FIREBASE_DB_URL missing on Netlify." });

  try {
    const { code } = JSON.parse(event.body || "{}");
    const ok = await licenceValide(`${dbUrl}/licences_lichi`, code);
    if (!ok) return json(403, { error: "Invalid or expired license." });

    const r = await fetch(`https://${region}.api.cognitive.microsoft.com/sts/v1.0/issueToken`, {
      method: "POST",
      headers: { "Ocp-Apim-Subscription-Key": key, "Content-Length": "0" },
    });
    const token = await r.text();
    if (!r.ok) return json(502, { error: "Azure refused the token (code " + r.status + ")." });
    return json(200, { token, region });
  } catch (e) {
    return json(500, { error: String(e.message || e) });
  }
};

async function licenceValide(base, codeRecu) {
  const code = String(codeRecu || "").trim().toUpperCase();
  if (!code) return false;
  const r = await fetch(`${base}.json`);
  const data = (await r.json()) || {};
  for (const lic of Object.values(data)) {
    if (!lic || String(lic.code || "").toUpperCase() !== code) continue;
    const aujourdHui = new Date(); aujourdHui.setHours(0, 0, 0, 0);
    const exp = new Date(lic.expiration + "T23:59:59");
    if (isNaN(exp.getTime()) || exp < aujourdHui) return false;
    const restantes = lic.heuresRestantes != null ? lic.heuresRestantes : lic.heures;
    return restantes > 0;
  }
  return false;
}

function json(statusCode, obj) {
  return { statusCode, headers: { "Content-Type": "application/json" }, body: JSON.stringify(obj) };
}
