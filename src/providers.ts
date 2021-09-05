import { Connection, EntityManager, IDatabaseDriver, MikroORM } from '@mikro-orm/core';
import log4js from 'log4js';
import { Statistic } from './entities/Statistic';
import mikroOrmConfig from './mikro-orm.config';
import { CustomClient } from './models/CustomClient';
import { resolvePath } from './util';

export const client = new CustomClient();

const devMode = process.env.NODE_ENV === 'development';

const fileAppender = {
  type: 'file',
  maxLogSize: 10485760, // ~10 MB
  compress: true,
};

const levelFilter = (name: string) => ({
  type: 'logLevelFilter',
  appender: name,
  maxLevel: 'mark',
});

log4js.configure({
  appenders: {
    _fileTrace: { ...fileAppender, filename: resolvePath(`logs/core-trace.log`) },
    fileTrace: { ...levelFilter('_fileTrace'), level: 'trace' },

    _fileDebug: { ...fileAppender, filename: resolvePath(`logs/core-debug.log`) },
    fileDebug: { ...levelFilter('_fileDebug'), level: 'debug' },

    _fileInfo: { ...fileAppender, filename: resolvePath(`logs/core-info.log`) },
    fileInfo: { ...levelFilter('_fileInfo'), level: 'info' },

    _fileWarn: { ...fileAppender, filename: resolvePath(`logs/core-warn.log`) },
    fileWarn: { ...levelFilter('_fileWarn'), level: 'warn' },

    _console: { type: 'console', layout: { type: 'colored' } },
    console: {
      ...levelFilter('_console'),
      level: devMode ? 'trace' : 'info',
    },
  },
  categories: {
    default: {
      appenders: devMode
        ? ['console']
        : ['console', 'fileWarn', 'fileInfo', 'fileDebug', 'fileTrace'],
      level: 'trace',
      enableCallStack: !devMode,
    },
  },
});

const orm = MikroORM.init(mikroOrmConfig);

export const getORM = (): typeof orm => orm;

const ensureStat = async (
  em: EntityManager<IDatabaseDriver<Connection>>,
  name: string,
  value: string
) => {
  em = em.fork();

  try {
    await em.findOneOrFail(Statistic, { name });
  } catch {
    const stat = em.create(Statistic, { name, value });
    em.persistAndFlush(stat);
  }
};

orm.then(async orm => {
  await orm.getMigrator().up();

  const em = orm.em.fork();

  ensureStat(em, 'questions', '0');
  ensureStat(em, 'responses', '0');
});
