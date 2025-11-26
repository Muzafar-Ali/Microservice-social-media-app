import { createApp } from "./app.js";
import { initRedis } from "./config/redisClient.js";
const PORT = process.env.PORT || 4001;
async function bootstrap() {
    try {
        await initRedis();
        const app = await createApp();
        app.listen(PORT, () => {
            console.log(`app is listening at ${PORT}`);
        });
    }
    catch (err) {
        console.error("❌ Failed to start app", err);
        process.exit(1);
    }
}
bootstrap();
