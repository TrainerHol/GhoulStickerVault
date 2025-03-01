const { SlashCommandBuilder, REST, Routes, MessageFlags } = require("discord.js");
const config = require("../utils/config");

module.exports = {
  data: new SlashCommandBuilder()
    .setName("delete-sticker")
    .setDescription("Delete a sticker from the sticker vault")
    .addStringOption((option) => option.setName("name").setDescription("The name of the sticker to delete").setRequired(true)),

  async execute(interaction, db) {
    try {
      const name = interaction.options.getString("name").toLowerCase();
      const userId = interaction.user.id;

      // Check if sticker exists
      const sticker = db.prepare("SELECT * FROM stickers WHERE name = ?").get(name);

      if (!sticker) {
        return interaction
          .reply({
            content: `No sticker found with the name "${name}".`,
            flags: MessageFlags.Ephemeral,
          })
          .catch((err) => console.error("Error sending not found reply:", err));
      }

      // Delete the sticker from the database
      try {
        db.prepare("DELETE FROM stickers WHERE name = ?").run(name);
      } catch (dbError) {
        console.error("Database error when deleting sticker:", dbError);
        return interaction
          .reply({
            content: "There was a database error deleting your sticker. Please try again later.",
            flags: MessageFlags.Ephemeral,
          })
          .catch((err) => console.error("Error sending DB error reply:", err));
      }

      // Defer the reply while we delete the command
      await interaction.deferReply({ flags: MessageFlags.Ephemeral }).catch((err) => console.error("Error deferring reply:", err));

      // Delete the slash command
      try {
        const rest = new REST({ version: "10" }).setToken(config.token);

        // Use global commands route
        const commandsRoute = Routes.applicationCommands(config.clientId);

        // Get all commands
        const commands = await rest.get(commandsRoute);

        // Find the command ID for the sticker
        const commandToDelete = commands.find((cmd) => cmd.name === name);

        if (commandToDelete) {
          // Delete the command
          await rest.delete(Routes.applicationCommand(config.clientId, commandToDelete.id));

          await interaction
            .editReply({
              content: `Sticker "${name}" has been deleted from the vault.`,
              flags: MessageFlags.Ephemeral,
            })
            .catch((err) => console.error("Error editing success reply:", err));
        } else {
          await interaction
            .editReply({
              content: `Sticker "${name}" has been deleted from the vault, but the command could not be found.`,
              flags: MessageFlags.Ephemeral,
            })
            .catch((err) => console.error("Error editing command not found reply:", err));
        }
      } catch (error) {
        console.error("Error deleting sticker command:", error);

        await interaction
          .editReply({
            content: `Sticker "${name}" has been deleted from the vault, but there was an error removing the command. It will be removed when the bot restarts.`,
            flags: MessageFlags.Ephemeral,
          })
          .catch((err) => console.error("Error editing failure reply:", err));
      }
    } catch (error) {
      console.error("Error deleting sticker:", error);

      // If the interaction was already deferred, edit the reply
      if (interaction.deferred) {
        await interaction
          .editReply({
            content: "There was an error deleting your sticker. Please try again later.",
            flags: MessageFlags.Ephemeral,
          })
          .catch((err) => console.error("Error editing error reply:", err));
      } else if (!interaction.replied) {
        await interaction
          .reply({
            content: "There was an error deleting your sticker. Please try again later.",
            flags: MessageFlags.Ephemeral,
          })
          .catch((err) => console.error("Error sending error reply:", err));
      }
    }
  },
};
