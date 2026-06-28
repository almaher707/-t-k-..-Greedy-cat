import express from "express";
import axios from "axios";
import { createServer as createViteServer } from "vite";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json());

  // Proxy route for Greedy Lion notifications
  app.get("/api/greedy-lion/notify", async (req, res) => {
    try {
      const response = await axios.get("https://h5.hoho.media/greedy_lion/get_notify", {
        params: {
          game_name: "greedy",
          region: "XM"
        },
        headers: {
          "accept": "application/json, text/plain, */*",
          "origin": "https://m.hoho.media",
          "referer": "https://m.hoho.media/",
          "user-agent": "Mozilla/5.0 (Linux; Android 12; SM-N975U Build/SP1A.210812.016; wv) AppleWebKit/537.36 (KHTML, like Gecko) Version/4.0 Chrome/145.0.7632.79 Mobile Safari/537.36 YoHo/5040050 LangCode/ar",
          "x-uid": "83449490",
          "x-auth-token": "83e53e7b911e188b741c583277096bcd10580abd78cd43b7499debe9e52daf24"
        }
      });
      res.json(response.data);
    } catch (error: any) {
      console.error("Proxy error:", error.message);
      res.status(500).json({ error: "Failed to fetch data from Greedy Lion API" });
    }
  });

  // Proxy route for Query My Bet
  app.get("/api/greedy-lion/query-bet", async (req, res) => {
    try {
      const response = await axios.get("https://h5.hoho.media/greedy_lion/query_my_bet", {
        params: {
          act_id: req.query.act_id || "17727554990",
          round: req.query.round || "111328",
          svrid: "0",
          game_id: "0",
          coin_type: "0",
          time: Date.now()
        },
        headers: {
          "accept": "application/json, text/plain, */*",
          "origin": "https://m.hoho.media",
          "referer": "https://m.hoho.media/",
          "user-agent": "Mozilla/5.0 (Linux; Android 12; SM-N975U Build/SP1A.210812.016; wv) AppleWebKit/537.36 (KHTML, like Gecko) Version/4.0 Chrome/145.0.7632.79 Mobile Safari/537.36 YoHo/5040050 LangCode/ar",
          "x-uid": "83449490",
          "x-auth-token": "83e53e7b911e188b741c583277096bcd10580abd78cd43b7499debe9e52daf24"
        }
      });
      res.json(response.data);
    } catch (error: any) {
      console.error("Proxy error (query-bet):", error.message);
      res.status(500).json({ error: "Failed to fetch bet data" });
    }
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    app.use(express.static(path.join(__dirname, "dist")));
    app.get("*all", (req, res) => {
      res.sendFile(path.join(__dirname, "dist", "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://0.0.0.0:${PORT}`);
  });
}

startServer();
