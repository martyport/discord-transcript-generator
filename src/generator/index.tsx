import { ChannelType, type Awaitable, type Channel, type Message, type Role, type User } from 'discord.js';
import ReactDOMServer from 'react-dom/server';
import React from 'react';
import { DiscordHeader, DiscordMessages } from '@derockdev/discord-components-react';
import renderMessage from './renderers/message';
import renderContent, { RenderType } from './renderers/content';
import { buildProfiles } from '../utils/buildProfiles';
import { revealSpoiler, scrollToMessage } from '../static/client';
import { readFileSync } from 'fs';
import path from 'path';
import { renderToString } from '@derockdev/discord-components-core/hydrate';
import { isDefined } from '../utils/utils';
import moment from 'moment';

// read the package.json file and get the @derockdev/discord-components-core version
let discordComponentsVersion = '^3.6.1';

try {
  const packagePath = path.join(__dirname, '..', '..', 'package.json');
  const packageJSON = JSON.parse(readFileSync(packagePath, 'utf8'));
  discordComponentsVersion = packageJSON.dependencies['@derockdev/discord-components-core'] ?? discordComponentsVersion;
  // eslint-disable-next-line no-empty
} catch {} // ignore errors

export type RenderMessageContext = {
  messages: Message[];
  channel: Channel;

  callbacks: {
    resolveChannel: (channelId: string) => Awaitable<Channel | null>;
    resolveUser: (userId: string) => Awaitable<User | null>;
    resolveRole: (roleId: string) => Awaitable<Role | null>;
  };

  poweredBy?: boolean;
  footerText?: string;
  saveImages: boolean;
  favicon: 'guild' | string;
  hydrate: boolean;
  customGuildIconURL: string | undefined;
  customAttachmentURL: string | undefined;
  customAvatarURL: string | undefined;
  customRoleIconURL: string | undefined;
};

export default async function renderMessages({ messages, channel, callbacks, ...options }: RenderMessageContext) {
  const profiles = buildProfiles(messages, { messages, channel, callbacks, ...options });

  const chatBody = (
    await Promise.all(
      messages.map((message) =>
        renderMessage(message, {
          messages,
          channel,
          callbacks,
          ...options,
        })
      )
    )
  ).filter(isDefined);

  const elements = (
    <DiscordMessages style={{ border: '5px solid gray', borderRadius: '10px' }}>
      {/* header */}
      <DiscordHeader
        style={{ padding: '1rem', borderBottom: '5px solid rgba(79, 84, 92, 0.48)' }}
        guild={channel.isDMBased() ? 'DM Transkript' : channel.guild.name}
        channel={
          channel.isDMBased()
            ? channel.type === ChannelType.DM
              ? channel.recipient?.tag ?? 'Unknown Recipient'
              : 'Unknown Recipient'
            : channel.name
        }
        icon={
          channel.isDMBased()
            ? undefined
            : channel.guild.icon
            ? options.customGuildIconURL
              ? options.customGuildIconURL
                  .replace('[guildId]', channel.guildId)
                  .replace('[guildIcon]', channel.guild.icon)
              : channel.guild.iconURL({ size: 128 }) ?? undefined
            : undefined
        }
      >
        {channel.isThread()
          ? `Thread in ${channel.parent?.name ?? 'Unknown Channel'}`
          : channel.isDMBased()
          ? `Direktnachrichten`
          : channel.isVoiceBased()
          ? `Voice-Textchannel ${channel.name}`
          : channel.type === ChannelType.GuildCategory
          ? `Category Channel`
          : 'topic' in channel && channel.topic
          ? await renderContent(channel.topic, { messages, channel, callbacks, type: RenderType.REPLY, ...options })
          : `Dieser Kanal hat keine Beschreibung.`}
      </DiscordHeader>

      {/* body */}
      {chatBody}

      {/* footer */}
      <div
        style={{
          textAlign: 'center',
          borderTop: '1px solid rgba(79, 84, 92, 0.48)',
          marginTop: '20px',
          padding: '5px',
        }}
      >
        {
          /*
          options.footerText
          ? options.footerText
              .replaceAll('{number}', messages.length.toString())
              .replace('{s}', messages.length > 1 ? 's' : '')
          : `Exported ${messages.length} message${messages.length > 1 ? 's' : ''}.`
          */
          `${messages.length} Nachricht${
            messages.length > 1 ? 'en' : ''
          } gespeichert | Transkript erstellt am ${moment().format('DD.MM.YYYY, HH:mm:ss')} Uhr`
        }{' '}
        {options.poweredBy ? (
          <span style={{ textAlign: 'center' }}>
            Powered by{' '}
            <a href="https://github.com/ItzDerock/discord-html-transcripts" style={{ color: 'lightblue' }}>
              discord-html-transcripts
            </a>
            .
          </span>
        ) : null}
      </div>
    </DiscordMessages>
  );

  const markup = ReactDOMServer.renderToStaticMarkup(
    <html>
      <head>
        <meta charSet="utf-8" />
        {/*<meta name="viewport" content="width=device-width, initial-scale=1" />*/}

        {/* favicon */}
        <link
          rel="icon"
          type="image/png"
          href={
            options.favicon === 'guild'
              ? channel.isDMBased()
                ? undefined
                : channel.guild.iconURL({ size: 16, extension: 'png' }) ?? undefined
              : options.favicon
          }
        />

        {/* title */}
        <title>{channel.isDMBased() ? 'DM Transkript' : channel.name + ' | Transkript'}</title>

        {/* message reference handler */}
        <script
          dangerouslySetInnerHTML={{
            __html: scrollToMessage,
          }}
        />

        {!options.hydrate && (
          <>
            {/* profiles */}
            <script
              dangerouslySetInnerHTML={{
                __html: `window.$discordMessage={profiles:${JSON.stringify(await profiles)}}`,
              }}
            ></script>
            {/* component library */}
            <script
              type="module"
              src={`https://cdn.jsdelivr.net/npm/@derockdev/discord-components-core@${discordComponentsVersion}/dist/derockdev-discord-components-core/derockdev-discord-components-core.esm.js`}
            ></script>
          </>
        )}
      </head>

      <body
        style={{
          margin: '30px',
          backgroundColor: '#36393e',
        }}
      >
        {elements}
      </body>
      {/* Make sure the script runs after the DOM has loaded */}
      {options.hydrate && <script dangerouslySetInnerHTML={{ __html: revealSpoiler }}></script>}
    </html>
  );

  if (options.hydrate) {
    const result = await renderToString(markup, {
      beforeHydrate: async (document) => {
        document.defaultView.$discordMessage = {
          profiles: await profiles,
        };
      },
    });

    return result.html;
  }

  return markup;
}
