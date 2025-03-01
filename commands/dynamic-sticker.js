const { MessageFlags } = require("discord.js");

module.exports = {
  createDynamicStickerCommand: (name, url) => {
    return {
      data: {
        name,
        description: `Send the ${name} sticker`,
      },
      async execute(interaction, db) {
        try {
          // Acknowledge the interaction first
          await interaction.deferReply().catch((err) => console.error(`Error deferring reply for ${name}:`, err));

          // Send the sticker as a regular message
          await interaction.channel
            .send({
              content: url,
            })
            .catch((err) => console.error(`Error sending sticker message for ${name}:`, err));

          // Delete the interaction reply to keep the chat clean
          await interaction.deleteReply().catch((err) => console.error(`Error deleting reply for ${name}:`, err));
        } catch (error) {
          console.error(`Error handling dynamic sticker command ${name}:`, error);

          // If something went wrong, edit the deferred reply with an error message
          if (interaction.deferred && !interaction.replied) {
            await interaction
              .editReply({
                content: "There was an error sending the sticker. Please try again later.",
                flags: MessageFlags.Ephemeral,
              })
              .catch((err) => console.error(`Error editing error reply for ${name}:`, err));
          } else if (!interaction.replied) {
            await interaction
              .reply({
                content: "There was an error sending the sticker. Please try again later.",
                flags: MessageFlags.Ephemeral,
              })
              .catch((err) => console.error(`Error sending error reply for ${name}:`, err));
          }
        }
      },
    };
  },
};
