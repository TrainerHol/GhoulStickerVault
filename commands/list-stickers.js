const { SlashCommandBuilder, EmbedBuilder, MessageFlags } = require("discord.js");
const config = require("../utils/config");

// Use the command limit constants from the config file
const { MAX_GLOBAL_COMMANDS, MAX_GUILD_COMMANDS, MAX_STICKER_COMMANDS } = config;

module.exports = {
  data: new SlashCommandBuilder().setName("list-stickers").setDescription("List all available stickers in the vault"),

  async execute(interaction, db) {
    try {
      // Get all stickers from the database
      let stickers;
      try {
        stickers = db.prepare("SELECT * FROM stickers ORDER BY name").all();
      } catch (dbError) {
        console.error("Database error when listing stickers:", dbError);
        return interaction
          .reply({
            content: "There was a database error retrieving the stickers. Please try again later.",
            flags: MessageFlags.Ephemeral,
          })
          .catch((err) => console.error("Error sending DB error reply:", err));
      }

      if (stickers.length === 0) {
        return interaction
          .reply({
            content: "There are no stickers in the vault yet. Add some with /add-sticker!",
            flags: MessageFlags.Ephemeral,
          })
          .catch((err) => console.error("Error sending empty vault reply:", err));
      }

      // Create an embed to display the stickers
      const embed = new EmbedBuilder().setTitle("Sticker Vault").setDescription("Here are all the available stickers:").setColor(0x00aaff);

      // Group stickers by first letter for better organization
      const groupedStickers = {};
      for (const sticker of stickers) {
        const firstLetter = sticker.name.charAt(0).toUpperCase();
        if (!groupedStickers[firstLetter]) {
          groupedStickers[firstLetter] = [];
        }
        groupedStickers[firstLetter].push(sticker.name);
      }

      // Add fields for each letter group
      for (const letter in groupedStickers) {
        embed.addFields({
          name: letter,
          value: groupedStickers[letter].map((name) => `\`${name}\``).join(", "),
        });
      }

      // Add a footer with the total count and limit information
      const limitInfo = `Total stickers: ${stickers.length}/${MAX_GLOBAL_COMMANDS + MAX_GUILD_COMMANDS} (${MAX_GLOBAL_COMMANDS} global + ${MAX_GUILD_COMMANDS} server-specific)`;

      embed.setFooter({
        text: limitInfo,
      });

      await interaction
        .reply({
          embeds: [embed],
          flags: MessageFlags.Ephemeral,
        })
        .catch((err) => console.error("Error sending sticker list reply:", err));
    } catch (error) {
      console.error("Error listing stickers:", error);

      if (!interaction.replied) {
        await interaction
          .reply({
            content: "There was an error listing the stickers. Please try again later.",
            flags: MessageFlags.Ephemeral,
          })
          .catch((err) => console.error("Error sending error reply:", err));
      }
    }
  },
};
