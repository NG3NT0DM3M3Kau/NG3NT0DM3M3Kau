const { Client, GatewayIntentBits, SlashCommandBuilder, REST, Routes, EmbedBuilder, PermissionsBitField, ActivityType } = require('discord.js');
require('dotenv').config();

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMembers,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent
  ]
});

let invitesCache = new Map();
let inviteTrackingChannel = new Map(); // Cache untuk menyimpan channel tracking undangan

// Fungsi untuk memperbarui cache undangan
async function updateInviteCache(guild) {
  const invites = await guild.invites.fetch();
  invitesCache.set(guild.id, invites);
}

// Event: Bot siap digunakan
client.once('ready', async () => {
  console.log(`✅ Bot siap sebagai ${client.user.tag}`);
  
    client.user.setPresence({
        activities: [{ name: 'KaaayraaCommunity', type: ActivityType.Watching }],
        status: 'online'
    });
  for (const guild of client.guilds.cache.values()) {
    await updateInviteCache(guild);
  }
  registerCommands();
});

// Mendaftarkan Slash Commands
async function registerCommands() {
  const commands = [
    new SlashCommandBuilder()
      .setName('serverinfo')
      .setDescription('Menampilkan informasi tentang server ini.'),
    new SlashCommandBuilder()
      .setName('setinvitechannel')
      .setDescription('Mengatur channel untuk tracking undangan.')
      .addChannelOption(option =>
        option.setName('channel')
          .setDescription('Channel untuk mengirim pesan tracking undangan.')
          .setRequired(true)
      )
  ];

  const rest = new REST({ version: '10' }).setToken(process.env.DISCORD_TOKEN);

  try {
    console.log('🚀 Mendaftarkan Slash Commands...');
    await rest.put(
      Routes.applicationCommands(process.env.DISCORD_CLIENT_ID),
      { body: commands.map(command => command.toJSON()) }
    );
    console.log('✅ Slash Commands berhasil didaftarkan!');
  } catch (error) {
    console.error('❌ Gagal mendaftarkan Slash Commands:', error);
  }
}

// Event: Welcome Member dengan Embed
client.on('guildMemberAdd', async member => {
  const channelId = inviteTrackingChannel.get(member.guild.id);
  const inviteChannel = channelId ? member.guild.channels.cache.get(channelId) : member.guild.systemChannel;

  if (!inviteChannel) return;

  const cachedInvites = invitesCache.get(member.guild.id);
  const newInvites = await member.guild.invites.fetch();
  invitesCache.set(member.guild.id, newInvites);

  const usedInvite = newInvites.find(inv => cachedInvites.get(inv.code)?.uses < inv.uses);
  const inviterInfo = usedInvite ? `diundang oleh **${usedInvite.inviter.tag}**` : 'dengan undangan yang tidak diketahui';

  const embed = new EmbedBuilder()
    .setColor(0x6A0DAD)
    .setTitle('🎉 Selamat Datang di Server!')
    .setDescription(
      `Halo ${member}, selamat datang di **${member.guild.name}**!\n\n` +
      `Kamu ${inviterInfo}.\n` +
      `🔗 Jangan lupa cek <#peraturan> dan bergabung dalam komunitas!`
    )
    .setThumbnail(member.user.displayAvatarURL({ dynamic: true }))
    .setFooter({ text: `Member ke-${member.guild.memberCount}`, iconURL: member.guild.iconURL() })
    .setTimestamp();

  inviteChannel.send({ embeds: [embed] });
});

// **Anti-Link Feature - Only Allow Admin Roles**
client.on('messageCreate', async message => {
  if (message.author.bot) return;

  // Deteksi tautan
  const linkPattern = /(https?:\/\/[^\s]+)/g;
  if (linkPattern.test(message.content)) {
    if (!message.member.permissions.has(PermissionsBitField.Flags.Administrator)) {
      await message.delete();
      await message.channel.send({
        content: `🚫 ${message.author}, hanya pengguna dengan role **Administrator** yang dapat mengirim tautan.`,
        ephemeral: true
      });
    }
  }
});

// Event: Slash Command Handler
client.on('interactionCreate', async interaction => {
  if (!interaction.isCommand()) return;

  if (interaction.commandName === 'serverinfo') {
    const guild = interaction.guild;
    const embed = new EmbedBuilder()
      .setColor(0x0099FF)
      .setTitle(`📊 Informasi Server: ${guild.name}`)
      .setThumbnail(guild.iconURL({ dynamic: true }))
      .addFields(
        { name: '🆔 Server ID', value: guild.id, inline: true },
        { name: '👑 Owner', value: `<@${guild.ownerId}>`, inline: true },
        { name: '👥 Total Member', value: `${guild.memberCount}`, inline: true },
        { name: '📅 Dibuat Pada', value: `<t:${Math.floor(guild.createdTimestamp / 1000)}:F>`, inline: false }
      );

    await interaction.reply({ embeds: [embed] });
  }

  if (interaction.commandName === 'setinvitechannel') {
    if (!interaction.member.permissions.has(PermissionsBitField.Flags.Administrator)) {
      return interaction.reply({ content: '🚫 Kamu memerlukan izin **Administrator** untuk menggunakan perintah ini.', ephemeral: true });
    }

    const channel = interaction.options.getChannel('channel');
    if (!channel.isTextBased()) {
      return interaction.reply({ content: '🚫 Harap pilih channel teks yang valid.', ephemeral: true });
    }

    inviteTrackingChannel.set(interaction.guild.id, channel.id);
    await interaction.reply({ content: `✅ Channel tracking undangan berhasil diatur ke ${channel}.` });
  }
});

// Event: Cache update untuk invite baru
client.on('inviteCreate', async invite => {
  await updateInviteCache(invite.guild);
});

// Event: Cache update untuk invite yang dihapus
client.on('inviteDelete', async invite => {
  await updateInviteCache(invite.guild);
});

// Login ke Discord
client.login(process.env.DISCORD_TOKEN);
