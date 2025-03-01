const Database = require("better-sqlite3");
const { REST, Routes } = require("discord.js");
const config = require("./utils/config");

// Initialize database
const db = new Database(config.dbPath || "stickers.db");

// Add command_registered column if it doesn't exist
try {
  db.exec(`
    ALTER TABLE stickers ADD COLUMN command_registered BOOLEAN DEFAULT 0;
  `);
  console.log("Added command_registered column to stickers table");
} catch (error) {
  // Column might already exist
  console.log("command_registered column already exists or could not be added");
}

// Function to register sticker commands
async function registerStickerCommands() {
  try {
    // Get all stickers that haven't been registered as commands
    const stickers = db.prepare("SELECT * FROM stickers WHERE command_registered = 0").all();

    if (stickers.length === 0) {
      console.log("No stickers to migrate");
      return;
    }

    console.log(`Found ${stickers.length} stickers to register as commands`);
    console.log(`Using ${config.useGlobalCommands ? "global" : "guild"} commands`);
    console.log(`Webhooks are ${config.useWebhooks ? "enabled" : "disabled"}`);

    // Create REST instance
    const rest = new REST({ version: "10" }).setToken(config.token);

    // Determine which route to use based on configuration
    let commandsRoute;
    if (config.useGlobalCommands) {
      console.log("Using global commands");
      commandsRoute = Routes.applicationCommands(config.clientId);
    } else if (config.guildId) {
      console.log(`Using guild commands for guild ID: ${config.guildId}`);
      commandsRoute = Routes.applicationGuildCommands(config.clientId, config.guildId);
    } else {
      console.log("No guild ID provided, defaulting to global commands");
      commandsRoute = Routes.applicationCommands(config.clientId);
    }

    // Get existing commands
    const existingCommands = await rest.get(commandsRoute);

    // Register each sticker as a command
    for (const sticker of stickers) {
      // Check if command already exists
      const commandExists = existingCommands.some((cmd) => cmd.name === sticker.name);

      if (!commandExists) {
        // Create command data
        const commandData = {
          name: sticker.name,
          description: `Send the ${sticker.name} sticker`,
          type: 1, // CHAT_INPUT
        };

        try {
          // Register the command
          await rest.post(commandsRoute, { body: commandData });

          console.log(`Registered command for sticker: ${sticker.name}`);

          // Update the sticker in the database
          db.prepare("UPDATE stickers SET command_registered = 1 WHERE id = ?").run(sticker.id);
        } catch (error) {
          console.error(`Error registering command for sticker ${sticker.name}:`, error);
        }
      } else {
        console.log(`Command for sticker ${sticker.name} already exists`);
        // Mark as registered anyway
        db.prepare("UPDATE stickers SET command_registered = 1 WHERE id = ?").run(sticker.id);
      }
    }

    console.log("Finished registering sticker commands");
  } catch (error) {
    console.error("Error registering sticker commands:", error);
  } finally {
    // Close the database
    db.close();
  }
}

// Run the migration
registerStickerCommands();
