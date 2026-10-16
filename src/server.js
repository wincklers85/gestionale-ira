import "dotenv/config";
import express from "express";
import twilio from "twilio";

const app = express();
app.disable("x-powered-by");
app.use(express.json({ limit: "16kb" }));
app.use(express.static("public", { index: "index.html" }));
const secret = process.env.IRA_API_KEY;
const sendRoutes = express.Router();
sendRoutes.use((req, res, next) => {
  if (!secret || req.get("X-API-Key") !== secret) return res.status(401).json({ error: "Unauthorized" });
  next();
});
const phonePattern = /^\+[1-9]\d{7,14}$/;
const invalid = (res, error) => res.status(400).json({ error });
function validate(req, res, kind) {
  const { to, purpose } = req.body;
  if (!phonePattern.test(to || "")) return invalid(res, "Numero richiesto in formato E.164 (+39...)");
  if (!["booking", "marketing"].includes(purpose)) return invalid(res, "purpose deve essere booking o marketing");
  if (purpose === "booking" && (typeof req.body.bookingId !== "string" || !req.body.bookingId.trim())) return invalid(res, "bookingId richiesto");
  if (purpose === "marketing" && req.body.marketingConsentVerified !== true) return invalid(res, "Marketing bloccato: consenso verificato richiesto");
  if (kind === "sms" || kind === "text") {
    if (typeof req.body.body !== "string" || !req.body.body.trim() || req.body.body.length > 1000) return invalid(res, "body richiesto (max 1000 caratteri)");
  }
  return null;
}
sendRoutes.post("/sms", async (req, res) => {
  if (validate(req, res, "sms")) return;
  const { TWILIO_ACCOUNT_SID: sid, TWILIO_AUTH_TOKEN: token, TWILIO_MESSAGING_SERVICE_SID: service } = process.env;
  if (!sid || !token || !service) return res.status(503).json({ error: "Gateway SMS non configurato" });
  try {
    const result = await twilio(sid, token).messages.create({ to: req.body.to, body: req.body.body, messagingServiceSid: service });
    res.status(202).json({ id: result.sid, status: result.status, provider: "twilio" });
  } catch (error) {
    console.error("SMS provider error", error.code || error.name);
    res.status(502).json({ error: "Invio SMS rifiutato dal provider" });
  }
});
async function sendWhatsApp(req, res, payload) {
  const { META_GRAPH_VERSION: version, META_WA_PHONE_NUMBER_ID: phoneId, META_WA_ACCESS_TOKEN: token } = process.env;
  if (!version || !/^v\d+\.\d+$/.test(version) || !phoneId || !token) return res.status(503).json({ error: "Gateway WhatsApp non configurato" });
  try {
    const response = await fetch(`https://graph.facebook.com/${version}/${encodeURIComponent(phoneId)}/messages`, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify({ messaging_product: "whatsapp", to: req.body.to.replace("+", ""), ...payload }),
      signal: AbortSignal.timeout(15000)
    });
    if (!response.ok) { console.error("WhatsApp provider HTTP", response.status); return res.status(502).json({ error: "Invio WhatsApp rifiutato dal provider" }); }
    const data = await response.json();
    return res.status(202).json({ id: data.messages?.[0]?.id || null, provider: "meta" });
  } catch (error) {
    console.error("WhatsApp network failure", error.name);
    return res.status(502).json({ error: "Gateway WhatsApp non raggiungibile" });
  }
}
sendRoutes.post("/whatsapp/template", async (req, res) => {
  if (validate(req, res, "template")) return;
  const { templateName, language = "it", parameters = [] } = req.body;
  if (!/^[a-z0-9_]{1,512}$/.test(templateName || "") || !/^[a-z]{2}(?:_[A-Z]{2})?$/.test(language) || !Array.isArray(parameters) || parameters.length > 10 || parameters.some(p => typeof p !== "string" || p.length > 200)) return invalid(res, "Template o parametri non validi");
  const components = parameters.length ? [{ type: "body", parameters: parameters.map(text => ({ type: "text", text })) }] : [];
  await sendWhatsApp(req, res, { type: "template", template: { name: templateName, language: { code: language }, ...(components.length ? { components } : {}) } });
});
sendRoutes.post("/whatsapp/text", async (req, res) => {
  if (validate(req, res, "text")) return;
  if (req.body.customerServiceWindowOpen !== true) return invalid(res, "Messaggio libero consentito solo nella finestra di assistenza verificata");
  await sendWhatsApp(req, res, { type: "text", text: { preview_url: false, body: req.body.body } });
});
app.get("/health", (_req, res) => res.json({ service: "ira-messaging", status: "ok" }));
app.use("/api/messages", sendRoutes);
app.use((error, _req, res, _next) => {
  if (error instanceof SyntaxError && "body" in error) return res.status(400).json({ error: "JSON non valido" });
  return res.status(500).json({ error: "Errore interno" });
});
app.listen(Number(process.env.PORT || 3000), () => console.log("IRA messaging API listening"));
