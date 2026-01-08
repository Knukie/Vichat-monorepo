import { Client, Events, GatewayIntentBits, Partials } from "discord.js";
import { allowedChannels, config, ensureSharedEnv } from "../core/config.js";
import { pool } from "../core/db.js";
import { runValki } from "../core/valki.js";
import { chunkDiscord, cleanText, MSG_MENTION_ONLY } from "../core/utils.js";

ensureSharedEnv();

const { DISCORD_TOKEN } = config;

if (!DISCORD_TOKEN) {
  console.log("ℹ️ DISCORD_TOKEN not set — Discord bot disabled.");
  process.exit(0);
}

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.DirectMessages,
    GatewayIntentBits.MessageContent
  ],
  partials: [Partials.Channel]
});

const repliedIds = new Set();

function markReplied(id) {
  repliedIds.add(id);
  if (repliedIds.size > 2000) {
    const first = repliedIds.values().next().value;
    repliedIds.delete(first);
  }
}

client.once(Events.ClientReady, () => {
  console.log(`✅ VALKI (Discord) online as ${client.user.tag}`);
});

client.on(Events.MessageCreate, async (m) => {
  try {
    const hasText = !!(m?.content && m.content.trim());
    const hasFiles = !!(m?.attachments && m.attachments.size > 0);
    if (!hasText && !hasFiles) return;
    if (m.author?.bot) return;
    if (repliedIds.has(m.id)) return;

    let input = m.content || "";

    if (m.inGuild()) {
      if (allowedChannels.size && !allowedChannels.has(m.channel.id)) return;
      if (!m.mentions.has(client.user)) return;

      input = cleanText((m.content || "").replace(new RegExp(`<@!?${client.user.id}>`, "g"), ""));

      if (!input && !hasFiles) {
        markReplied(m.id);
        return m.reply(MSG_MENTION_ONLY);
      }
    } else {
      input = cleanText(m.content);
    }

    if (hasFiles) {
      const files = [...m.attachments.values()]
        .map((a) => `${a.name}: ${a.url}`)
        .join("\n");
      input = (input ? `${input}\n\n` : "") + `Attachments:\n${files}`;
    }

    await m.channel.sendTyping();

    const cid = m.inGuild() ? m.channel.id : m.author.id;
    const requestId = m.id;
    const reply = await runValki({
      userText: input,
      conversationId: cid,
      preferredLocale: "",
      images: [],
      requestId
    });

    markReplied(m.id);

    const chunks = chunkDiscord(reply);
    for (let i = 0; i < chunks.length; i++) {
      if (i === 0) await m.reply(chunks[i]);
      else await m.channel.send(chunks[i]);
    }
  } catch (err) {
    console.error("Discord handler error:", err);
  }
});

client.login(DISCORD_TOKEN).catch((err) => {
  console.error("❌ Discord login failed:", err);
});

async function shutdown(signal) {
  try {
    console.log(`\n🧯 Shutdown (${signal})...`);
    client?.destroy();
    await pool.end().catch(() => {});
    process.exit(0);
  } catch {
    process.exit(1);
  }
}

process.on("SIGINT", () => shutdown("SIGINT"));
process.on("SIGTERM", () => shutdown("SIGTERM"));
