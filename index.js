import { Client, GatewayIntentBits, REST, Routes, PermissionFlagsBits } from 'discord.js';
import { config } from 'dotenv';
import { convertUrl, initializeFixerStatus } from './lib/linkConverter.js';

config();

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent
  ]
});

const commands = [
  {
    name: 'preview',
    description: 'Preview a social media link with automatic embed fixing',
    integration_types: [0, 1], // Guild and user install
    contexts: [0, 1, 2], // Guild, DM, and group DM
    options: [
      {
        name: 'url',
        description: 'The social media URL to preview',
        type: 3, // STRING
        required: true
      }
    ]
  },
  {
    name: 'Preview Link',
    type: 3, // MESSAGE context menu
    integration_types: [0, 1],
    contexts: [0, 1, 2]
  }
];

client.once('ready', async () => {
  console.log(`✅ Logged in as ${client.user.tag}`);

  await initializeFixerStatus();

  // Register commands
  const rest = new REST({ version: '10' }).setToken(process.env.DISCORD_TOKEN);
  try {
    console.log('🔄 Registering application commands...');
    await rest.put(
      Routes.applicationCommands(process.env.DISCORD_CLIENT_ID),
      { body: commands }
    );
    console.log('✅ Successfully registered application commands');
  } catch (error) {
    console.error('❌ Error registering commands:', error);
  }
});

client.on('interactionCreate', async (interaction) => {
  try {
    if (interaction.isChatInputCommand() && interaction.commandName === 'preview') {
      await handlePreviewCommand(interaction);
    } else if (interaction.isMessageContextMenuCommand() && interaction.commandName === 'Preview Link') {
      await handlePreviewContextMenu(interaction);
    }
  } catch (error) {
    console.error('Error handling interaction:', error);
    const errorMessage = 'An error occurred while processing your request.';
    if (interaction.replied || interaction.deferred) {
      await interaction.followUp({ content: errorMessage, ephemeral: true });
    } else {
      await interaction.reply({ content: errorMessage, ephemeral: true });
    }
  }
});

async function handlePreviewCommand(interaction) {
  const url = interaction.options.getString('url');
  await processUrl(interaction, url);
}

async function handlePreviewContextMenu(interaction) {
  const message = interaction.targetMessage;

  // Extract URLs from message content
  const urlRegex = /(https?:\/\/[^\s]+)/g;
  const urls = message.content.match(urlRegex);

  if (!urls || urls.length === 0) {
    return interaction.reply({
      content: 'No URLs found in this message.',
      ephemeral: true
    });
  }

  // Process the first URL found
  await processUrl(interaction, urls[0]);
}

async function processUrl(interaction, originalUrl) {
  await interaction.deferReply();

  const result = await convertUrl(originalUrl);

  if (!result.converted) {
    return interaction.editReply({
      content: `No embed fixer available for this URL:\n${originalUrl}`
    });
  }

  // Send the first attempt
  await interaction.editReply({
    content: result.url
  });

  // Wait 10 seconds to see if an embed appears
  await wait(10000);

  // Fetch the message to check for embeds
  const fetchedMessage = await interaction.fetchReply();

  if (fetchedMessage.embeds.length > 0) {
    console.log(`✅ Embed appeared for ${result.domain} using ${result.fixer}`);
    return;
  }

  console.log(`⚠️ No embed after 10s for ${result.url}`);

  // Try with /?a appended
  const urlWithParam = result.url + (result.url.includes('?') ? '&a' : '?a');
  await interaction.editReply({ content: urlWithParam });

  await wait(10000);

  const fetchedMessage2 = await interaction.fetchReply();

  if (fetchedMessage2.embeds.length > 0) {
    console.log(`✅ Embed appeared with ?a parameter for ${result.domain} using ${result.fixer}`);
    return;
  }

  console.log(`⚠️ No embed after 10s with ?a parameter`);

  // Try the next fixer
  const nextResult = await convertUrl(originalUrl, result.fixerIndex + 1);

  if (!nextResult.converted || nextResult.fixerIndex === result.fixerIndex) {
    // No more fixers to try
    await interaction.editReply({
      content: `${result.url}\n\n*No working embed fixer found. Original: ${originalUrl}*`
    });
    return;
  }

  // Try the next fixer
  await interaction.editReply({ content: nextResult.url });

  await wait(10000);

  const fetchedMessage3 = await interaction.fetchReply();

  if (fetchedMessage3.embeds.length > 0) {
    console.log(`✅ Embed appeared for ${nextResult.domain} using ${nextResult.fixer} (fallback)`);
  } else {
    console.log(`⚠️ No embed with fallback fixer either`);
  }
}

function wait(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

client.login(process.env.DISCORD_TOKEN);
