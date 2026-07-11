import https from "node:https";

export const blueSphereHttpsAgent = new https.Agent({
  rejectUnauthorized: false,
});
