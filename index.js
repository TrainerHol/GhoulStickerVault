const { Client, GatewayIntentBits, Collection, REST, Routes, MessageFlags } = require("discord.js");
const fs = require("fs");
const path = require("path");
const Database = require("better-sqlite3");
const config = require("./utils/config");

// Use the command limit constants from the config file
const { MAX_GLOBAL_COMMANDS, MAX_GUILD_COMMANDS, MAX_STICKER_COMMANDS } = config;

// Create a new client instance
const client = new Client({
  intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMessages],
});

// Initialize commands collection
client.commands = new Collection();

// Initialize database
let db;
try {
  db = new Database(config.dbPath || "stickers.db");

  // Create tables if they don't exist
  db.exec(`
    CREATE TABLE IF NOT EXISTS stickers (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT UNIQUE NOT NULL,
      url TEXT NOT NULL,
      user_id TEXT NOT NULL,
      guild_id TEXT,
      command_registered BOOLEAN DEFAULT 0,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
  `);

  // Add guild_id column if it doesn't exist (for backward compatibility)
  const tableInfo = db.prepare("PRAGMA table_info(stickers)").all();
  if (!tableInfo.some((column) => column.name === "guild_id")) {
    console.log("Adding guild_id column to stickers table");
    db.exec("ALTER TABLE stickers ADD COLUMN guild_id TEXT");
  }
} catch (error) {
  console.error("Error initializing database:", error);
  process.exit(1); // Exit if we can't initialize the database
}

// Load command files
try {
  const commandsPath = path.join(__dirname, "commands");
  const commandFiles = fs.readdirSync(commandsPath).filter((file) => file.endsWith(".js"));

  for (const file of commandFiles) {
    try {
      const filePath = path.join(commandsPath, file);
      const command = require(filePath);

      // Set a new item in the Collection with the key as the command name and the value as the exported module
      if ("data" in command && "execute" in command) {
        client.commands.set(command.data.name, command);
      } else {
        console.log(`[WARNING] The command at ${filePath} is missing a required "data" or "execute" property.`);
      }
    } catch (error) {
      console.error(`Error loading command file ${file}:`, error);
    }
  }
} catch (error) {
  console.error("Error loading command files:", error);
}

// Function to register sticker commands
async function registerStickerCommands() {
  try {
    // Get all stickers that haven't been registered as commands
    const stickers = db.prepare("SELECT * FROM stickers WHERE command_registered = 0").all();

    if (stickers.length === 0) {
      return;
    }

    console.log(`Found ${stickers.length} stickers to register as commands`);

    // Create REST instance
    const rest = new REST({ version: "10" }).setToken(config.token);

    // Use global commands route
    const globalCommandsRoute = Routes.applicationCommands(config.clientId);

    // Get existing global commands
    const existingGlobalCommands = await rest.get(globalCommandsRoute);

    // Count existing global sticker commands (excluding built-in commands)
    const existingGlobalStickerCommands = existingGlobalCommands.filter((cmd) => !["add-sticker", "list-stickers", "delete-sticker", "sticker"].includes(cmd.name));

    console.log(`Found ${existingGlobalStickerCommands.length} existing global sticker commands`);

    // Calculate available global slots
    const availableGlobalSlots = MAX_GLOBAL_COMMANDS - existingGlobalStickerCommands.length;
    console.log(`Available global slots: ${availableGlobalSlots}`);

    // Track guild commands by guild ID
    const guildCommands = new Map();

    // Register stickers as commands
    for (const sticker of stickers) {
      try {
        // Check if command already exists globally
        const commandExistsGlobally = existingGlobalCommands.some((cmd) => cmd.name === sticker.name);

        if (commandExistsGlobally) {
          console.log(`Command ${sticker.name} already exists globally, skipping`);
          continue;
        }

        // Create command data
        const commandData = {
          name: sticker.name,
          description: `Send the ${sticker.name} sticker`,
          type: 1, // CHAT_INPUT
        };

        // Try to register as global command if slots are available
        if (availableGlobalSlots > 0) {
          try {
            await rest.post(globalCommandsRoute, { body: commandData });
            console.log(`Registered global command for sticker: ${sticker.name}`);

            // Update the sticker in the database
            db.prepare("UPDATE stickers SET command_registered = 1 WHERE id = ?").run(sticker.id);

            // Decrement available slots
            availableGlobalSlots--;
            continue;
          } catch (error) {
            console.error(`Error registering global command for sticker ${sticker.name}:`, error);
          }
        }

        // If we couldn't register globally and we have a guild ID, try to register as a guild command
        if (sticker.guild_id) {
          // Get or initialize guild commands for this guild
          if (!guildCommands.has(sticker.guild_id)) {
            try {
              const guildCommandsRoute = Routes.applicationGuildCommands(config.clientId, sticker.guild_id);
              const existingGuildCommands = await rest.get(guildCommandsRoute);
              guildCommands.set(sticker.guild_id, {
                commands: existingGuildCommands,
                route: guildCommandsRoute,
                availableSlots: MAX_GUILD_COMMANDS - existingGuildCommands.length,
              });
              console.log(`Guild ${sticker.guild_id} has ${existingGuildCommands.length} commands, ${MAX_GUILD_COMMANDS - existingGuildCommands.length} slots available`);
            } catch (error) {
              console.error(`Error getting commands for guild ${sticker.guild_id}:`, error);
              continue;
            }
          }

          const guildInfo = guildCommands.get(sticker.guild_id);

          // Check if command already exists in this guild
          const commandExistsInGuild = guildInfo.commands.some((cmd) => cmd.name === sticker.name);

          if (commandExistsInGuild) {
            console.log(`Command ${sticker.name} already exists in guild ${sticker.guild_id}, skipping`);
            continue;
          }

          // Check if we have room for more guild commands
          if (guildInfo.availableSlots > 0) {
            try {
              // Register as guild command
              await rest.post(guildInfo.route, { body: commandData });
              console.log(`Registered guild command for sticker: ${sticker.name} in guild ${sticker.guild_id}`);

              // Update the sticker in the database
              db.prepare("UPDATE stickers SET command_registered = 1 WHERE id = ?").run(sticker.id);

              // Update tracking
              guildInfo.commands.push({ name: sticker.name });
              guildInfo.availableSlots--;
            } catch (error) {
              console.error(`Error registering guild command for sticker ${sticker.name}:`, error);
            }
          } else {
            console.log(`No slots available for sticker: ${sticker.name} in guild ${sticker.guild_id}`);
          }
        } else {
          console.log(`No guild ID for sticker: ${sticker.name} and no global slots available`);
        }
      } catch (error) {
        console.error(`Error processing sticker ${sticker.name}:`, error);
      }
    }

    console.log("Finished registering sticker commands");
  } catch (error) {
    console.error("Error registering sticker commands:", error);
  }
}

// When the client is ready, run this code (only once)
client.once("ready", async () => {
  console.log(`Logged in as ${client.user.tag}!`);

  // Register sticker commands
  await registerStickerCommands();

  console.log("Bot is ready!");
});

// Handle interactions
client.on("interactionCreate", async (interaction) => {
  try {
    if (!interaction.isCommand()) return;

    const commandName = interaction.commandName;

    // Check if it's a built-in command
    const command = client.commands.get(commandName);

    if (command) {
      try {
        await command.execute(interaction, db);
      } catch (error) {
        console.error(`Error executing command ${commandName}:`, error);

        // Only reply if we haven't replied already
        if (!interaction.replied && !interaction.deferred) {
          await interaction
            .reply({
              content: "There was an error while executing this command!",
              flags: MessageFlags.Ephemeral,
            })
            .catch((err) => console.error("Error sending error reply:", err));
        } else if (interaction.deferred) {
          await interaction
            .editReply({
              content: "There was an error while executing this command!",
              flags: MessageFlags.Ephemeral,
            })
            .catch((err) => console.error("Error editing error reply:", err));
        }
      }
      return;
    }

    // If not a built-in command, check if it's a sticker command
    try {
      const sticker = db.prepare("SELECT * FROM stickers WHERE name = ?").get(commandName);

      if (sticker) {
        // It's a sticker command, handle it
        // No longer using ephemeral messages
        await interaction.deferReply().catch((err) => console.error("Error deferring reply:", err));

        // Get user information
        const user = interaction.user;

        try {
          // Reply with just the sticker URL in a non-ephemeral message
          await interaction.editReply({
            content: sticker.url,
          });
        } catch (error) {
          console.error("Error sending sticker message:", error);
          await interaction
            .editReply({
              content: "There was an error sending the sticker. Please try again later.",
            })
            .catch((err) => console.error("Error editing error reply:", err));
          return;
        }
      } else {
        // Unknown command
        await interaction
          .reply({
            content: `Unknown command: ${commandName}`,
            flags: MessageFlags.Ephemeral,
          })
          .catch((err) => console.error("Error sending unknown command reply:", err));
      }
    } catch (error) {
      console.error("Error handling sticker command:", error);

      if (interaction.deferred) {
        await interaction
          .editReply({
            content: "There was an error using the sticker. Please try again later.",
            flags: MessageFlags.Ephemeral,
          })
          .catch((err) => console.error("Error editing error reply:", err));
      } else if (!interaction.replied) {
        await interaction
          .reply({
            content: "There was an error using the sticker. Please try again later.",
            flags: MessageFlags.Ephemeral,
          })
          .catch((err) => console.error("Error sending error reply:", err));
      }
    }
  } catch (error) {
    console.error("Unhandled error in interaction handler:", error);
  }
});

// Error handling for the client
client.on("error", (error) => {
  console.error("Discord client error:", error);
});

// Process-level error handling
process.on("unhandledRejection", (error) => {
  console.error("Unhandled promise rejection:", error);
});

process.on("uncaughtException", (error) => {
  console.error("Uncaught exception:", error);
  // Don't exit the process, just log the error
});

// Login to Discord with your client's token
client.login(config.token).catch((error) => {
  console.error("Error logging in to Discord:", error);
  process.exit(1);
});
