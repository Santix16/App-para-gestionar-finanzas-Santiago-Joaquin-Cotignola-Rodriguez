import { app } from "./app";
import { env } from "./config/env";

app.listen(env.PORT, () => console.log(`API en http://localhost:${env.PORT}`));