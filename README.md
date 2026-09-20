# Discord Preview Social Links

A Discord user-installable app that automatically fixes social media link embeds by converting them to embed-friendly alternatives.

## Features

- `/preview` slash command - Takes a URL and converts it to an embed-friendly version
- "Preview Link" message context menu - Right-click any message to preview links
- Automatic fallback system - Tries multiple embed fixers if one fails
- Smart tracking - Monitors which fixers are working and applies cooldowns to broken ones
- Embed detection - Waits to see if embeds appear before trying alternatives

## Supported Platforms

Twitter/X, Instagram, TikTok, Reddit, Facebook, Bluesky, YouTube, Twitch, and many more!

## Setup

1. Copy `.env.example` to `.env` and add your Discord bot token and client ID
2. Install dependencies: `npm install`
3. Invite the bot using this URL format:
   ```
   https://discord.com/api/oauth2/authorize?client_id=YOUR_CLIENT_ID&permissions=274877991936&scope=bot%20applications.commands
   ```
4. Run the bot: `npm start`

## Configuration

The bot uses `fixers.json` to map social media domains to their embed-friendly alternatives.
The bot maintains `fixer-status.json` to track which fixers are currently working.
