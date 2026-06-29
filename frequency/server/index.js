/* FREQUENCY API — Express server for Render.
 * Frontend (Vercel) and API (Render) are different sites, so CORS is
 * explicit and cookies are SameSite=None (see lib/auth.js). */
import express from "express";
import cors from "cors";
import healthRoute from "./routes/health.js";
import signalsRoute from "./routes/signals.js";
import reportRoute from "./routes/report.js";
import friendsRoute from "./routes/friends.js";
import authRoute from "./routes/auth.js";

const app = express();
app.disable("x-powered-by");
app.set("trust proxy", 1); // Render sits behind a proxy; needed for Secure cookies

const allowedOrigins = (process.env.FRONTEND_ORIGIN || "")
  .split(",")
  .map((s) => s.trim())
  .filter(Boolean);

app.use(cors({
  origin(origin, callback) {
    // same-origin tools (curl, health checks) send no Origin header
    if (!origin || allowedOrigins.length === 0 || allowedOrigins.includes(origin)) {
      return callback(null, true);
    }
    callback(new Error("not allowed by CORS"));
  },
  credentials: true,
}));
app.use(express.json({ limit: "16kb" }));
app.use((req, res, next) => { res.setHeader("Cache-Control", "no-store"); next(); });

app.use("/api/health", healthRoute);
app.use("/api/signals", signalsRoute);
app.use("/api/report", reportRoute);
app.use("/api/friends", friendsRoute);
app.use("/api/auth", authRoute);

app.get("/", (req, res) => res.json({ ok: true, service: "frequency-api" }));

const port = process.env.PORT || 8787;
app.listen(port, () => console.log(`frequency api listening on :${port}`));
