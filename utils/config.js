const fs = require("fs");
const path = require("path");
require("dotenv").config();

// Function to load configuration from environment variables or config.json as fallback
function loadConfig() {
  // First check for environment variables
  if (process.env.BOT_TOKEN && process.env.CLIENT_ID) {
    return {
      token: process.env.BOT_TOKEN,
      clientId: process.env.CLIENT_ID,
      dbPath: process.env.DB_PATH || "stickers.db",
      guildId: process.env.GUILD_ID || null, // Guild ID for server-specific commands
    };
  }

  // Fall back to config.json if environment variables are not set
  try {
    const configPath = path.join(__dirname, "..", "config.json");
    if (fs.existsSync(configPath)) {
      const config = require(configPath);
      // Ensure dbPath has a default
      config.dbPath = config.dbPath || "stickers.db";
      // Ensure guildId has a default
      config.guildId = config.guildId || null;
      return config;
    }
  } catch (error) {
    console.warn("Could not load config.json");
  }

  throw new Error("No configuration found. Please set environment variables or create a config.json file.");
}

module.exports = loadConfig();

// Command limits
// Maximum number of global commands allowed (50 total - 5 built-in commands)
module.exports.MAX_GLOBAL_COMMANDS = 45;
// Maximum number of server-specific commands allowed (50 total)
module.exports.MAX_GUILD_COMMANDS = 50;
// Total maximum sticker commands (global + guild specific)
module.exports.MAX_STICKER_COMMANDS = module.exports.MAX_GLOBAL_COMMANDS + module.exports.MAX_GUILD_COMMANDS;
