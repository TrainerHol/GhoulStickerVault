# Sticker Vault Discord Bot

A Discord bot that allows users to save and use custom stickers (images/GIFs) via slash commands.

## Features

- Add custom stickers with `/add-sticker`
- List all available stickers with `/list-stickers`
- Delete stickers with `/delete-sticker`
- Use stickers with `/sticker` or directly with the sticker name as a slash command
- Support for up to 95 stickers (45 global + 50 server-specific)
- Automatic server detection for server-specific commands

## Setup

1. Clone this repository
2. Install dependencies with `npm install`
3. Create a `.env` file with the following variables:
   ```
   BOT_TOKEN=your_discord_bot_token
   CLIENT_ID=your_discord_application_client_id
   DB_PATH=stickers.db
   ```
4. Register slash commands with `node deploy-commands.js`
5. Start the bot with `node index.js`

## Configuration

The bot requires the following environment variables:

- `BOT_TOKEN`: Your Discord bot token
- `CLIENT_ID`: Your Discord application client ID
- `DB_PATH`: Path to the SQLite database file (defaults to "stickers.db")

## Command Limits

Discord has the following limits for slash commands:

- 50 global commands (shared across all servers)
- 50 server-specific commands (per server)

This bot reserves 5 slots for built-in commands and can use up to:

- 45 global sticker commands
- 50 server-specific sticker commands

For a total of up to 95 stickers in a specific server.

The bot automatically detects which server a sticker is added from and will register it as a server-specific command when global slots are full.

## Commands

### `/add-sticker`

Adds a new sticker to the vault.

- `name`: The name of the sticker (used to call it later)
- `url`: The URL of the sticker image or GIF

### `/list-stickers`

Lists all available stickers in the vault.

### `/delete-sticker`

Deletes a sticker from the vault.

- `name`: The name of the sticker to delete

### `/sticker`

Sends a sticker from the vault.

- `name`: The name of the sticker to send

### Direct sticker commands

After adding a sticker, you can use it directly with a slash command of the same name.
For example, if you added a sticker named "cat", you can use it with `/cat`.

## Error Handling

The bot includes comprehensive error handling to prevent crashes and provide helpful error messages to users. All database operations and Discord API interactions are wrapped in try-catch blocks to ensure stability.

## License

MIT

## Support

If you encounter any issues or have questions, please open an issue on GitHub or contact the developer.
