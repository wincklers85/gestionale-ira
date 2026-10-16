# IRA Gestionale — CRM Ristorante IRA

Backend iniziale per l'invio diretto di messaggi SMS e WhatsApp dall'applicazione, senza aprire app esterne.

## Stack
Node.js 20+, Express 5, Twilio Programmable Messaging per SMS, Meta WhatsApp Cloud API per WhatsApp.

## Avvio
1. `npm install`
2. Copiare `.env.example` in `.env` (non committare il file contenente segreti).
3. Inserire le credenziali dei provider e una `IRA_API_KEY` robusta.
4. `npm start`
5. `GET /health` per verificare il servizio.

## API (fase iniziale)
Autenticazione: header `X-API-Key: <IRA_API_KEY>`.
- `POST /api/messages/sms` con `{"to":"+393331234567","body":"La tua prenotazione...","purpose":"booking","bookingId":"..."}`
- `POST /api/messages/whatsapp/template` con `{"to":"+393331234567","templateName":"prenotazione_conferma","language":"it","parameters":["Mario","20:30"],"purpose":"booking","bookingId":"..."}`
- `POST /api/messages/whatsapp/text` per rispondere a un cliente nella finestra consentita dalla piattaforma: `{"to":"+393331234567","body":"Confermiamo!","purpose":"booking","bookingId":"...","customerServiceWindowOpen":true}`

Per i messaggi marketing è necessario includere `purpose:"marketing"` e `marketingConsentVerified:true`. **Attenzione: questo flag non è una prova legale**, è una misura provvisoria del prototipo. Prima di attivare campagne occorre implementare database, storico dei consensi verificabile per canale/finalità, soppressioni e revoche, autenticazione utenti e limiti di invio. Non esporre questo servizio pubblicamente senza tali presidi.

## Stato
È uno scheletro di integrazione **non ancora un gestionale utilizzabile in produzione**. Nessun account provider è collegato, non ci sono invii attivi, webhook verificati, database o interfaccia amministrativa. API e messaggi sono pronti per test controllati una volta configurate le credenziali.

## Sicurezza e conformità
- Non inviare promozioni a numeri soltanto importati dalla rubrica.
- Separare le comunicazioni di servizio inerenti a prenotazioni da quelle promozionali.
- Le richieste di consenso non vanno inviate indiscriminatamente a contatti che non hanno autorizzato comunicazioni commerciali.
- Utilizzare template WhatsApp approvati e rispettare le regole Meta.
- Proteggere segreti e dati personali. Verificare termini, tariffe, regole locali del mittente SMS e GDPR.
