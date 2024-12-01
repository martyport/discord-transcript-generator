import { type GuildMember, type Message, type User, UserFlags } from 'discord.js';
import { RenderMessageContext } from '../generator';

export type Profile = {
  author: string; // author of the message
  avatar?: string; // avatar of the author
  roleColor?: string; // role color of the author
  roleIcon?: string; // role color of the author
  roleName?: string; // role name of the author

  bot?: boolean; // is the author a bot
  verified?: boolean; // is the author verified
};

export async function buildProfiles(messages: Message[], options: RenderMessageContext) {
  const profiles: Record<string, Profile> = {};

  // loop through messages
  for (const message of messages) {
    // add all users
    const author = message.author;
    if (!profiles[author.id]) {
      // add profile
      profiles[author.id] = buildProfile(options, message.member, author);
    }

    // add interaction users
    if (message.interaction) {
      const user = message.interaction.user;
      if (!profiles[user.id]) {
        profiles[user.id] = buildProfile(options, null, user);
      }
    }

    // threads
    if (message.thread && message.thread.lastMessage) {
      profiles[message.thread.lastMessage.author.id] = buildProfile(
        options,
        message.thread.lastMessage.member,
        message.thread.lastMessage.author
      );
    }
  }

  // return as a JSON
  return profiles;
}

function buildProfile(options: RenderMessageContext, member: GuildMember | null, author: User) {
  return {
    author: member?.nickname ?? author.displayName ?? author.username,
    // avatar: member?.displayAvatarURL({ size: 64 }) ?? author.displayAvatarURL({ size: 64 }),
    avatar: options.customAvatarURL
      ? options.customAvatarURL.replace('[userId]', author.id).replace('[userAvatar]', author.avatar ?? 'null')
      : member?.displayAvatarURL({ size: 64 }) ?? author.displayAvatarURL({ size: 64 }),
    roleColor: member?.displayHexColor === "#000000" ? undefined : member?.displayHexColor,
    // roleIcon: member?.roles.icon?.iconURL() ?? undefined,
    roleIcon: member?.roles.icon?.icon
      ? options.customRoleIconURL
        ? options.customRoleIconURL
            .replace('[guildId]', member.guild.id)
            .replace('[roleId]', member.roles.icon.id)
            .replace('[roleIcon]', member.roles.icon.icon)
        : member.roles.icon.iconURL() ?? undefined
      : undefined,
    roleName: member?.roles.hoist?.name ?? undefined,
    bot: author.bot,
    verified: author.flags?.has(UserFlags.VerifiedBot),
  };
}
