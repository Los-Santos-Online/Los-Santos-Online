import { PrismaClient } from "@prisma/client";
import fs from "node:fs";
import path from "node:path";
import readline from "node:readline";
import { fileURLToPath } from "node:url";

const prisma = new PrismaClient();
const prismaDirectory = path.dirname(fileURLToPath(import.meta.url));
const seedDataDirectory = path.join(prismaDirectory, "seed-data");
const batchSize = 1000;

async function loadDataset({ label, fileName, model }) {
  const filePath = path.join(seedDataDirectory, fileName);
  const lines = readline.createInterface({
    input: fs.createReadStream(filePath, { encoding: "ascii" }),
    crlfDelay: Infinity,
  });

  let batch = [];
  let sourceRows = 0;
  let insertedRows = 0;

  const flush = async () => {
    if (batch.length === 0) return;
    const result = await model.createMany({
      data: batch,
      skipDuplicates: true,
    });
    insertedRows += result.count;
    batch = [];
  };

  for await (const encodedLine of lines) {
    if (!encodedLine.trim()) continue;
    const json = Buffer.from(encodedLine, "base64").toString("utf8");
    batch.push(JSON.parse(json));
    sourceRows += 1;

    if (batch.length >= batchSize) {
      await flush();
    }
  }

  await flush();
  console.log(`${label}: ${sourceRows} seed rows, ${insertedRows} inserted`);
}

async function main() {
  await loadDataset({
    label: "StatLookup",
    fileName: "stat_lookup.jsonl.b64",
    model: prisma.statLookup,
  });
  await loadDataset({
    label: "Gen9StatLookup",
    fileName: "gen9_stat_lookup.jsonl.b64",
    model: prisma.gen9StatLookup,
  });
  await loadDataset({
    label: "Mission metadata (rstar/verif)",
    fileName: "mission_metadata.jsonl.b64",
    model: prisma.uGC,
  });
}

main()
  .catch((error) => {
    console.error("Database seed failed:", error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
