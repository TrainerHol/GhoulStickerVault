const { REST, Routes } = require("discord.js");
const fs = require("fs");
const path = require("path");
const config = require("./utils/config");

// Function to register commands
async function registerCommands() {
  try {
    // Create an array to hold command data
    const commands = [];

    // Get all command files
    const commandsPath = path.join(__dirname, "commands");
    const commandFiles = fs.readdirSync(commandsPath).filter((file) => file.endsWith(".js") && file !== "dynamic-sticker.js");

    // Load command data from each file
    for (const file of commandFiles) {
      try {
        const filePath = path.join(commandsPath, file);
        const command = require(filePath);

        if ("data" in command && "execute" in command) {
          commands.push(command.data.toJSON());
        } else {
          console.log(`[WARNING] The command at ${filePath} is missing required "data" or "execute" properties.`);
        }
      } catch (error) {
        console.error(`[ERROR] Error loading command file ${file}:`, error);
      }
    }

    // Create REST instance
    const rest = new REST({ version: "10" }).setToken(config.token);

    // Use global commands route
    const commandsRoute = Routes.applicationCommands(config.clientId);

    console.log(`Started refreshing ${commands.length} application (/) commands globally.`);

    // Deploy commands
    try {
      const data = await rest.put(commandsRoute, { body: commands });
      console.log(`Successfully reloaded ${data.length} application (/) commands globally.`);
    } catch (error) {
      console.error("Error deploying commands:", error);
      process.exit(1);
    }
  } catch (error) {
    console.error("Error in registerCommands function:", error);
    process.exit(1);
  }
}

// Execute the function
registerCommands().catch((error) => {
  console.error("Unhandled error in deploy-commands.js:", error);
  process.exit(1);
});
