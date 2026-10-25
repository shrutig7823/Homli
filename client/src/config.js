// config.js: settings you may change. This file is safe to commit: it holds NO secrets.
// API_BASE is the web address of the Homli backend (the Node + Express + SQLite server in pg-app-backend/).
//   - Empty ("")  -> the website uses its built-in FAKE API (data.js + localStorage). Works anywhere, nothing is shared.
//   - Set         -> the website calls the real backend: real database, shared feedback, Google photos.
// On your own laptop ("localhost") it points at the local backend automatically.
// After you deploy the backend, paste its address below, for example "https://homli-api.onrender.com".
const DEPLOYED_API = "https://homli-api-vntc.onrender.com";
const API_BASE = (location.hostname === "localhost" || location.hostname === "127.0.0.1") ? "http://localhost:3000" : DEPLOYED_API;
const PHOTO_API_BASE = API_BASE;   // photos and reviews now come from the same backend
