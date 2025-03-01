# Docker Setup Guide for GhoulStickerVault

This guide will help you set up and run the GhoulStickerVault Discord bot using Docker on your Linux server.

## Prerequisites

- Docker installed on your server
- Docker Compose installed on your server
- Your Discord bot token and client ID

## Setup Steps

1. **Clone the repository to your server**

   ```bash
   git clone <your-repository-url>
   cd GhoulStickerVault
   ```

2. **Create a .env file with your Discord bot credentials**

   ```bash
   cp .env.example .env
   nano .env  # or use any text editor you prefer
   ```

   Fill in your bot token, client ID, and other configuration options.

3. **Build and start the Docker container**

   ```bash
   docker-compose up -d
   ```

   This will build the Docker image and start the container in detached mode.

4. **Deploy slash commands (first time setup)**

   ```bash
   docker-compose exec discord-bot npm run deploy
   ```

5. **Check the logs**

   ```bash
   docker-compose logs -f
   ```

## Managing the Bot

- **Stop the bot**

  ```bash
  docker-compose down
  ```

- **Restart the bot**

  ```bash
  docker-compose restart
  ```

- **Update the bot (after pulling new code)**

  ```bash
  docker-compose down
  docker-compose build
  docker-compose up -d
  ```

## Database Management

The SQLite database (stickers.db) is stored in the root directory of your project on your host machine and is mounted as a volume in the Docker container. This ensures that your data persists even if the container is removed or rebuilt.

## Troubleshooting

- **Check container status**

  ```bash
  docker-compose ps
  ```

- **View detailed logs**

  ```bash
  docker-compose logs -f
  ```

- **Access the container shell**

  ```bash
  docker-compose exec discord-bot sh
  ```

- **If you're having issues with npm dependencies**

  The Docker setup should handle all dependencies automatically. If you need to manually install or update dependencies:

  ```bash
  docker-compose exec discord-bot npm install <package-name>
  ```
