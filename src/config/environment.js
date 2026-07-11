import "dotenv/config";

const env = process.env;

env.DOMAIN ||= env.ROS_HOST || "dev.lossantosonline.com";
env.ROS_HOST ||= env.DOMAIN;

if (env.SERVER_SECRET) {
  const encodedSecret = encodeURIComponent(env.SERVER_SECRET);
  env.POSTGRES_PRISMA_URL ||= `postgresql://lso:${encodedSecret}@localhost:5432/lso?schema=public&connect_timeout=15&sslmode=disable`;
  env.POSTGRES_URL_NON_POOLING ||= `postgresql://lso:${encodedSecret}@localhost:5432/lso?schema=public&sslmode=disable`;
}
