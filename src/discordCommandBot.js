import {
  ActivityType,
  Client,
  GatewayIntentBits,
  SlashCommandBuilder,
} from "discord.js";
import { PrismaClient } from "@prisma/client";
import "./config/environment.js";

const ACTIVE_WINDOW_MS = 10 * 60 * 1000;
const STATUS_INTERVAL_MS = 60 * 1000;
const prisma = new PrismaClient();
const client = new Client({ intents: [GatewayIntentBits.Guilds] });

async function getPlayerCounts() {
  const activePlayers = await prisma.activePlayer.findMany({
    where: {
      lastSeen: { gte: new Date(Date.now() - ACTIVE_WINDOW_MS) },
    },
    select: { platform: true },
  });

  const counts = {
    PS4: 0,
    PS5: 0,
    XBOX360: 0,
    XBOXONE: 0,
    PCROS: 0,
  };

  for (const player of activePlayers) {
    if (Object.hasOwn(counts, player.platform)) {
      counts[player.platform] += 1;
    }
  }

  return {
    ...counts,
    total: Object.values(counts).reduce((sum, count) => sum + count, 0),
  };
}

async function updatePlayerCountStatus() {
  const counts = await getPlayerCounts();
  const activity = `Online: ${counts.total} | PS4: ${counts.PS4} | PS5: ${counts.PS5} | X360: ${counts.XBOX360}`;
  await client.user.setActivity(activity, { type: ActivityType.Playing });
}

client.once("clientReady", async () => {
  console.log(`Discord player-count bot logged in as ${client.user.tag}`);

  const command = new SlashCommandBuilder()
    .setName("playercount")
    .setDescription("Shows current active player counts by platform");

  try {
    await client.application.commands.create(
      command,
      process.env.DISCORD_GUILD_ID || undefined,
    );
    console.log("Registered /playercount command");
  } catch (error) {
    console.error("Failed to register /playercount command:", error);
  }

  await updatePlayerCountStatus().catch((error) => {
    console.error("Failed to update Discord player-count status:", error);
  });

  setInterval(() => {
    updatePlayerCountStatus().catch((error) => {
      console.error("Failed to update Discord player-count status:", error);
    });
  }, STATUS_INTERVAL_MS);
});

client.on("interactionCreate", async (interaction) => {
  if (!interaction.isChatInputCommand() || interaction.commandName !== "playercount") {
    return;
  }

  try {
    const counts = await getPlayerCounts();
    await interaction.reply({
      content: [
        `Online: **${counts.total}**`,
        `PS4: **${counts.PS4}**`,
        `PS5: **${counts.PS5}**`,
        `Xbox 360: **${counts.XBOX360}**`,
        `Xbox One: **${counts.XBOXONE}**`,
        `PC: **${counts.PCROS}**`,
      ].join("\n"),
      allowedMentions: { parse: [] },
    });
  } catch (error) {
    console.error("Failed to answer /playercount:", error);
    if (!interaction.replied) {
      await interaction.reply({ content: "Unable to read player counts.", ephemeral: true });
    }
  }
});

if (process.env.DISCORD_TOKEN) {
  client.login(process.env.DISCORD_TOKEN).catch((error) => {
    console.error("Discord player-count bot failed to start:", error.message);
    process.exitCode = 1;
  });
} else {
  console.log("Discord player-count bot disabled because DISCORD_TOKEN is empty.");
  await prisma.$disconnect();
}

export default client;
