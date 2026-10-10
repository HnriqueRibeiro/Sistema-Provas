import express from "express";
import cors from "cors";
import { routes } from "./routes/index.js";
import { errorHandling } from "./middlewares/error-handling.js";

const PORT = 3000; //porta que vai escutar o servidor
const app = express(); //inicialize express

app.use(cors()); //liberação de acesso a api
app.use(express.json());
app.use(routes);
app.use(errorHandling); //middleware de tratamento de erros

app.listen(PORT, () => {
  console.log(`The server is running on PORT ${PORT}`);
}); //express comece a escutar na PORT, quamdo iniciar execute essa função
