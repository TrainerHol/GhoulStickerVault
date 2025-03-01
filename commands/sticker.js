const { SlashCommandBuilder, MessageFlags } = require("discord.js");

module.exports = {
  data: new SlashCommandBuilder()
    .setName("sticker")
    .setDescription("Send a sticker from the vault")
    .addStringOption((option) => option.setName("name").setDescription("The name of the sticker to send").setRequired(true)),

  async execute(interaction, db) {
    try {
      const name = interaction.options.getString("name").toLowerCase();

      // Get the sticker from the database
      let sticker;
      try {
        sticker = db.prepare("SELECT * FROM stickers WHERE name = ?").get(name);
      } catch (dbError) {
        console.error("Database error when retrieving sticker:", dbError);
        return interaction
          .reply({
            content: "There was a database error retrieving the sticker. Please try again later.",
            flags: MessageFlags.Ephemeral,
          })
          .catch((err) => console.error("Error sending DB error reply:", err));
      }

      if (!sticker) {
        return interaction
          .reply({
            content: `No sticker found with the name "${name}".`,
            flags: MessageFlags.Ephemeral,
          })
          .catch((err) => console.error("Error sending not found reply:", err));
      }

      // Send the sticker as a regular message
      try {
        // Acknowledge the interaction first
        await interaction.deferReply().catch((err) => console.error("Error deferring reply:", err));

        // Send the sticker as a regular message
        await interaction.channel
          .send({
            content: sticker.url,
          })
          .catch((err) => console.error("Error sending sticker message:", err));

        // Delete the interaction reply to keep the chat clean
        await interaction.deleteReply().catch((err) => console.error("Error deleting reply:", err));
      } catch (error) {
        console.error("Error sending sticker:", error);

        // If something went wrong, edit the deferred reply with an error message
        if (interaction.deferred && !interaction.replied) {
          await interaction
            .editReply({
              content: "There was an error sending the sticker. Please try again later.",
              flags: MessageFlags.Ephemeral,
            })
            .catch((err) => console.error("Error editing error reply:", err));
        }
      }
    } catch (error) {
      console.error("Error handling sticker command:", error);

      // If the interaction was already deferred, edit the reply
      if (interaction.deferred && !interaction.replied) {
        await interaction
          .editReply({
            content: "There was an error sending the sticker. Please try again later.",
            flags: MessageFlags.Ephemeral,
          })
          .catch((err) => console.error("Error editing error reply:", err));
      } else if (!interaction.replied) {
        await interaction
          .reply({
            content: "There was an error sending the sticker. Please try again later.",
            flags: MessageFlags.Ephemeral,
          })
          .catch((err) => console.error("Error sending error reply:", err));
      }
    }
  },
};
