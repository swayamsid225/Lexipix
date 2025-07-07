// config/redis.js
import { createClient } from 'redis';

const redisClient = createClient({
  url: process.env.REDIS_URL,
  socket: {
    tls: true,  // Required for rediss:// (secure TLS)
    rejectUnauthorized: false // Optional: disable strict cert check
  }
});

redisClient.on('error', (err) => console.error('Redis Client Error', err));

await redisClient.connect(); // make sure this is awaited somewhere in your app

export default redisClient;
