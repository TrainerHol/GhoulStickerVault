const { SlashCommandBuilder, REST, Routes, MessageFlags } = require("discord.js");
const config = require("../utils/config");

// Use the command limit constants from the config file
const { MAX_GLOBAL_COMMANDS, MAX_GUILD_COMMANDS, MAX_STICKER_COMMANDS } = config;

module.exports = {
  data: new SlashCommandBuilder()
    .setName("add-sticker")
    .setDescription("Add a sticker or GIF to the sticker vault")
    .addStringOption((option) => option.setName("name").setDescription("The name of the sticker (used to call it later)").setRequired(true))
    .addStringOption((option) => option.setName("url").setDescription("The URL of the sticker image or GIF").setRequired(true)),

  async execute(interaction, db) {
    try {
      const name = interaction.options.getString("name").toLowerCase();
      const url = interaction.options.getString("url");
      const userId = interaction.user.id;

      // Get the guild ID from the interaction
      const guildId = interaction.guildId;

      // Validate name (only allow alphanumeric and underscore)
      if (!name.match(/^[a-z0-9_]+$/)) {
        return interaction
          .reply({
            content: "Sticker name can only contain lowercase letters, numbers, and underscores.",
            flags: MessageFlags.Ephemeral,
          })
          .catch((err) => console.error("Error sending validation reply:", err));
      }

      // Validate URL (basic check)
      if (!url.match(/^https?:\/\/.+\.(jpg|jpeg|png|gif|webp)(\?.*)?$/i)) {
        return interaction
          .reply({
            content: "Please provide a valid image URL (ending with .jpg, .png, .gif, or .webp)",
            flags: MessageFlags.Ephemeral,
          })
          .catch((err) => console.error("Error sending URL validation reply:", err));
      }

      // Check if sticker with this name already exists
      const existingSticker = db.prepare("SELECT * FROM stickers WHERE name = ?").get(name);

      if (existingSticker) {
        return interaction
          .reply({
            content: `A sticker with the name "${name}" already exists. Please choose a different name.`,
            flags: MessageFlags.Ephemeral,
          })
          .catch((err) => console.error("Error sending duplicate name reply:", err));
      }

      // Check if name conflicts with built-in commands
      if (["add-sticker", "list-stickers", "delete-sticker", "sticker"].includes(name)) {
        return interaction
          .reply({
            content: `The name "${name}" conflicts with a built-in command. Please choose a different name.`,
            flags: MessageFlags.Ephemeral,
          })
          .catch((err) => console.error("Error sending name conflict reply:", err));
      }

      // Check if we've reached the maximum number of sticker commands
      const stickerCount = db.prepare("SELECT COUNT(*) as count FROM stickers").get().count;
      if (stickerCount >= MAX_STICKER_COMMANDS) {
        return interaction
          .reply({
            content: `Cannot add more stickers. The maximum limit of ${MAX_STICKER_COMMANDS} stickers has been reached. Please delete some stickers before adding new ones.`,
            flags: MessageFlags.Ephemeral,
          })
          .catch((err) => console.error("Error sending limit reached reply:", err));
      }

      // Insert the sticker into the database
      let result;
      try {
        const stmt = db.prepare("INSERT INTO stickers (name, url, user_id, guild_id, command_registered) VALUES (?, ?, ?, ?, 0)");
        result = stmt.run(name, url, userId, guildId);
      } catch (dbError) {
        console.error("Database error when adding sticker:", dbError);
        return interaction
          .reply({
            content: "There was a database error adding your sticker. Please try again later.",
            flags: MessageFlags.Ephemeral,
          })
          .catch((err) => console.error("Error sending DB error reply:", err));
      }

      // Defer the reply while we register the command
      await interaction.deferReply().catch((err) => console.error("Error deferring reply:", err));

      // Register the sticker as a slash command
      try {
        const rest = new REST({ version: "10" }).setToken(config.token);

        // Create command data
        const commandData = {
          name: name,
          description: `Send the ${name} sticker`,
          type: 1, // CHAT_INPUT
        };

        // Determine whether to register as global or guild command
        let commandRegistered = false;

        // First try to register as a global command
        try {
          // Get existing global commands
          const globalCommandsRoute = Routes.applicationCommands(config.clientId);
          const existingGlobalCommands = await rest.get(globalCommandsRoute);

          // Count existing global sticker commands (excluding built-in commands)
          const existingGlobalStickerCommands = existingGlobalCommands.filter((cmd) => !["add-sticker", "list-stickers", "delete-sticker", "sticker"].includes(cmd.name));

          // Check if we have room for more global commands
          if (existingGlobalStickerCommands.length < MAX_GLOBAL_COMMANDS) {
            // Register as global command
            await rest.post(globalCommandsRoute, { body: commandData });
            console.log(`Registered global command for sticker: ${name}`);
            commandRegistered = true;
          }
        } catch (globalError) {
          console.error("Error checking/registering global command:", globalError);
        }

        // If not registered globally and we have a guild ID, try to register as a guild command
        if (!commandRegistered && guildId) {
          try {
            // Get existing guild commands
            const guildCommandsRoute = Routes.applicationGuildCommands(config.clientId, guildId);
            const existingGuildCommands = await rest.get(guildCommandsRoute);

            // Check if we have room for more guild commands
            if (existingGuildCommands.length < MAX_GUILD_COMMANDS) {
              // Register as guild command
              await rest.post(guildCommandsRoute, { body: commandData });
              console.log(`Registered guild command for sticker: ${name} in guild ${guildId}`);
              commandRegistered = true;
            }
          } catch (guildError) {
            console.error("Error checking/registering guild command:", guildError);
          }
        }

        if (commandRegistered) {
          // Update the sticker in the database to mark as registered
          db.prepare("UPDATE stickers SET command_registered = 1 WHERE id = ?").run(result.lastInsertRowid);

          await interaction
            .editReply({
              content: `Sticker "${name}" has been added to the vault!\nUse it with \`/${name}\`\n\n${url}`,
            })
            .catch((err) => console.error("Error editing success reply:", err));
        } else {
          // Could not register command due to limits
          await interaction
            .editReply({
              content: `Sticker "${name}" has been added to the vault, but could not be registered as a command due to Discord limits. It will be registered when space becomes available.\n\n${url}`,
            })
            .catch((err) => console.error("Error editing limit reply:", err));
        }
      } catch (error) {
        console.error("Error registering sticker command:", error);

        // Still mark as added even if command registration failed
        await interaction
          .editReply({
            content: `Sticker "${name}" has been added to the vault, but there was an error registering the command. It will be registered when the bot restarts.\n\n${url}`,
          })
          .catch((err) => console.error("Error editing failure reply:", err));
      }
    } catch (error) {
      console.error("Error adding sticker:", error);

      // If the interaction was already deferred, edit the reply
      if (interaction.deferred) {
        await interaction
          .editReply({
            content: "There was an error adding your sticker. Please try again later.",
            flags: MessageFlags.Ephemeral,
          })
          .catch((err) => console.error("Error editing error reply:", err));
      } else if (!interaction.replied) {
        await interaction
          .reply({
            content: "There was an error adding your sticker. Please try again later.",
            flags: MessageFlags.Ephemeral,
          })
          .catch((err) => console.error("Error sending error reply:", err));
      }
    }
  },
};
