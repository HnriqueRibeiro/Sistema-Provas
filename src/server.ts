import express from "express";
import cors from "cors";
import { routes } from "./routes/index.js";
import { errorHandling } from "./middlewares/error-handling.js";

const PORT = 3000;
const app = express();

app.set("trust proxy", 1);
app.use(cors());
app.use(express.json());
app.use(routes);
app.use(errorHandling);

app.listen(PORT, () => {
  console.log(`The server is running on PORT ${PORT}`);
});
