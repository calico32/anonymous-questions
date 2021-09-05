import { Client, ClientUser, Guild, GuildEmoji, Intents, Snowflake } from 'discord.js';
import { getLogger } from 'log4js';

type KnownEmojis = 'success' | 'error' | 'warn' | 'worksonmymachine' | 'up_arrow' | 'down_arrow';

export class CustomClient extends Client {
  readonly devMode = process.env.NODE_ENV === 'development';
  readonly user!: ClientUser;

  mediaServer!: Guild;

  constructor() {
    super({
      intents: [
        Intents.FLAGS.DIRECT_MESSAGES, //
        Intents.FLAGS.GUILDS,
        Intents.FLAGS.GUILD_MESSAGES,
      ],
      allowedMentions: {
        repliedUser: false,
      },
    });

    const logger = getLogger('CustomClient#constructor');

    this.on('ready', () => {
      if (!process.env.MEDIA_SERVER_ID) {
        logger.warn('no media server set! disabling custom emojis');
        return;
      }

      this.mediaServer = this.guilds.cache.get(process.env.MEDIA_SERVER_ID as Snowflake)!;

      const expectedEmojis = ['success', 'error', 'warn', 'up_arrow', 'down_arrow'];
      expectedEmojis.forEach(name => {
        if (!this.getCustomEmoji(name))
          logger.warn(`media server missing '${name}' emoji! using fallback`);
      });
    });
  }

  getCustomEmoji<T extends KnownEmojis>(name: T): GuildEmoji | undefined;
  getCustomEmoji<T extends string | symbol>(name: Exclude<T, KnownEmojis>): GuildEmoji | undefined;
  getCustomEmoji(name: string): GuildEmoji | undefined {
    return this.mediaServer?.emojis.cache.find(e => e.name === name);
  }
}
