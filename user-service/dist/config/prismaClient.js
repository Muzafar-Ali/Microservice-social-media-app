// import { PrismaClient } from "@prisma/client";
import { PrismaClient } from "@prisma/client";
import config from "./config.js";
const prisma = new PrismaClient({
    datasourceUrl: config.dataBaseUrl,
    log: config.environment === "development" ? ["query", "info", "warn", "info"] : ["error"]
});
// handle gracefull shutdown
process.on("beforeExit", async () => {
    await prisma.$disconnect();
});
process.on("SIGINT", async () => {
    await prisma.$disconnect();
    process.exit(0);
});
process.on("SIGTERM", async () => {
    await prisma.$disconnect();
    process.exit(0);
});
export default prisma;
