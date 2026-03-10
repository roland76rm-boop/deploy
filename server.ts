import express from "express";
import fetch from "node-fetch";
import csv from "csv-parser";
import { createServer as createViteServer } from "vite";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function startServer() {
  const app = express();
  const PORT = parseInt(process.env.PORT || '3002');

  // API routes FIRST
  app.get("/api/health", (req, res) => {
    res.json({ status: "ok" });
  });

  app.get("/api/data", async (req, res) => {
    const csvUrl = "https://docs.google.com/spreadsheets/d/e/2PACX-1vS-occMsYGW9OWfFdVvQgDHUND2DPk0EEYwqgLQLqfQZ2l5ZzCQAFv-KXI4jpwDrhhNo-ytteaTxjuv/pub?gid=0&single=true&output=csv";
    try {
      const response = await fetch(csvUrl);
      const text = await response.text();
      const records = [];
      const parser = csv();
      parser.on('data', (data) => records.push(data));
      parser.on('end', () => res.json(records));
      parser.write(text);
      parser.end();
    } catch (error) {
      console.error("Error fetching CSV data:", error);
      res.status(500).json({ error: "Failed to fetch data" });
    }
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      root: __dirname,
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    app.use(express.static(path.resolve(__dirname, 'dist')));
    app.get('*', (req, res) => {
      res.sendFile(path.resolve(__dirname, 'dist', 'index.html'));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
