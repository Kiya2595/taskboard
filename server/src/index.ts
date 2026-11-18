import express from "express";
import cors from "cors";
import authRouter from "./routes/auth";

const app = express();
const PORT = 4000;

app.use(cors());
app.use(express.json());
app.use("/auth", authRouter);

app.get("/health", (_req, res) => {
  res.json({ status: "ok" });
});

app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});