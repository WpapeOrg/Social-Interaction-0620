import cors from "cors";
import express from "express";
import helmet from "helmet";
import morgan from "morgan";
import { config } from "./config";
import { router } from "./routes";

const app = express();
const port = config.port;

app.use(helmet());
app.use(cors());
app.use(express.json());
app.use(morgan("dev"));

app.get("/health", (_req, res) => {
  res.status(200).json({
    ok: true,
    service: "social-interaction-api",
    time: new Date().toISOString()
  });
});

app.use(router);

app.use((err: Error, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  console.error(err);
  res.status(500).json({ message: "Internal Server Error" });
});

app.listen(port, () => {
  console.log(`API listening on http://localhost:${port}`);
});
