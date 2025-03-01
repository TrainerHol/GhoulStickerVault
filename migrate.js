const { REST, Routes } = require("discord.js");
const Database = require("better-sqlite3");
const config = require("./utils/config");

async function migrate() {
  try {
    console.log("Starting migration process...");

    // Connect to the database
    let db;
    try {
      db = new Database(config.dbPath);
      console.log(`Connected to database: ${config.dbPath}`);
    } catch (dbError) {
      console.error("Failed to connect to the database:", dbError);
      process.exit(1);
    }

    // Check if command_registered column exists
    try {
      const tableInfo = db.prepare("PRAGMA table_info(stickers)").all();
      const hasCommandRegistered = tableInfo.some((column) => column.name === "command_registered");

      // Add command_registered column if it doesn't exist
      if (!hasCommandRegistered) {
        console.log("Adding command_registered column to stickers table...");
        db.prepare("ALTER TABLE stickers ADD COLUMN command_registered INTEGER DEFAULT 0").run();
        console.log("Column added successfully.");
      } else {
        console.log("command_registered column already exists.");
      }
    } catch (schemaError) {
      console.error("Error checking or updating database schema:", schemaError);
      db.close();
      process.exit(1);
    }

    // Get all stickers that haven't been registered as commands
    let stickers;
    try {
      stickers = db.prepare("SELECT * FROM stickers WHERE command_registered = 0").all();
      console.log(`Found ${stickers.length} stickers to register as commands.`);
    } catch (queryError) {
      console.error("Error querying stickers:", queryError);
      db.close();
      process.exit(1);
    }

    if (stickers.length === 0) {
      console.log("No stickers to migrate. Exiting.");
      db.close();
      return;
    }

    // Create REST instance
    const rest = new REST({ version: "10" }).setToken(config.token);

    // Use global commands route
    const commandsRoute = Routes.applicationCommands(config.clientId);

    // Register each sticker as a command
    let successCount = 0;
    let errorCount = 0;

    for (const sticker of stickers) {
      try {
        // Create command data
        const commandData = {
          name: sticker.name,
          description: `Send the ${sticker.name} sticker`,
          type: 1, // CHAT_INPUT
        };

        // Register the command
        await rest.post(commandsRoute, { body: commandData });
        console.log(`Registered command for sticker: ${sticker.name}`);

        // Update the sticker in the database
        db.prepare("UPDATE stickers SET command_registered = 1 WHERE id = ?").run(sticker.id);
        successCount++;
      } catch (error) {
        console.error(`Error registering command for sticker ${sticker.name}:`, error);
        errorCount++;
      }
    }

    console.log(`Migration complete. Successfully registered ${successCount} commands. Failed: ${errorCount}.`);
    db.close();
  } catch (error) {
    console.error("Unhandled error during migration:", error);
    process.exit(1);
  }
}

// Execute the migration
migrate().catch((error) => {
  console.error("Unhandled error in migrate.js:", error);
  process.exit(1);
});
