import { CommandInteraction, Formatters, InteractionReplyOptions, Util } from 'discord.js';
import dotenv from 'dotenv';
import _ from 'lodash';
import { getLogger } from 'log4js';
import { Question } from './entities/Question';
import { Statistic } from './entities/Statistic';
import { askData, respondData, TimeoutValue } from './models/commandData';
import { Embed } from './models/Embed';
import { client, getORM } from './providers';
import { generateId, resolvePath } from './util';

dotenv.config({ path: resolvePath('.env') });

const error = (int: CommandInteraction, message: string) => {
  const options = {
    embeds: [Embed.error(message)],
    ephemeral: true,
  } as InteractionReplyOptions;

  if (int.deferred) int.editReply(options);
  else if (int.replied) int.followUp(options);
  else int.reply(options);
};

const generateUniqueId = async () => {
  const em = (await getORM()).em.fork();
  const questions = await em.find(Question, {});

  let id: string;
  do id = generateId();
  while (questions.some(q => q.questionId === id));

  return id;
};

const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';

const ask = async (int: CommandInteraction) => {
  if (!int.inGuild()) return error(int, 'This command can only be run in a server text channel.');

  if (int.channel?.type !== 'GUILD_TEXT' && int.channel?.type !== 'GUILD_NEWS')
    return error(int, 'This command can only be run in a text channel, not a thread.');

  const { options: opt } = int;

  const questionType = opt.getSubcommand();
  const timeout = opt.getString('timeout', true) as TimeoutValue;
  const questionText = opt.getString('question', true).trim().replace(/ +/g, ' ');
  let threadName = opt.getString('thread-name');
  let choices: string[];

  if (questionType === 'multiple-choice') {
    choices = opt
      .getString('choices', true)
      .split(',')
      .map(choice => choice.trim().replace(/ +/g, ' '));
    if (choices.length < 1 || choices.length > 15)
      return error(int, 'Specify at least 2 and no more than 15 answer choices.');

    if (questionText.length + choices.map(choice => choice.length).reduce((a, b) => a + b) > 1500)
      return error(int, 'Too much content. Try shortening your question and/or answer choices.');
  } else if (questionType === 'free-response') {
    if (questionText.length > 1500)
      return error(int, 'Too much content. Try shortening your question and/or answer choices.');
  }

  if (threadName) {
    if (threadName.length > 100) return error(int, 'Thread name too long.');
  } else threadName = _.truncate(Util.cleanContent(questionText, int.channel), { length: 99 });

  const questionId = await generateUniqueId();
  const closesAt = new Date(Date.now() + parseInt(timeout));

  const startMessage = await int.reply({
    fetchReply: true,
    embeds: [
      new Embed({
        author: { name: `Question ${questionId}` },
        title: `New question asked by ${int.user.tag}`,
        description: 'Follow this thread for info!',
      }),
    ],
  });

  const thread = await int.channel.threads.create({
    name: threadName,
    autoArchiveDuration: 1440,
    reason: `Question ${questionId} asked by ${int.user.tag}`,
    type: 'GUILD_PUBLIC_THREAD',
    startMessage: startMessage.id,
  });

  const questionMessage = await thread.send({
    embeds: [
      new Embed({
        description: `${questionText}${
          questionType === 'multiple-choice'
            ? '\n\n' + choices!.map((c, i) => `${alphabet[i]}. ${c}`).join('\n')
            : ''
        }`,
      })
        .addField('Question ID', questionId, true)
        .addField(
          'Type',
          questionType === 'multiple-choice' ? 'Multiple Choice' : 'Free Response',
          true
        )
        .addField(
          'Closing Time',
          closesAt.toLocaleString('en-US', { timeZone: 'UTC', timeZoneName: 'short' }),
          true
        ),
    ],
  });

  const respondMessage = await thread.send({
    embeds: [
      new Embed({
        title: 'How to respond',
        description: `Use the /respond command with your response. \nExample: /respond ${questionId} ${
          questionType === 'multiple-choice' ? 'A' : 'Lorem ipsum dolor sit amet…'
        }`,
        footer: {
          text: 'Your response will be anonymously published in this channel at the time of closing (noted above). Responders must be current guild members. You may only respond once. Your user ID will be saved separately from your response to prevent multiple responses from the same user.',
        },
      }),
    ],
  });

  thread
    .createMessageCollector({
      time: 1000 * 5,
      filter: msg => msg.type === 'CHANNEL_PINNED_MESSAGE',
    })
    .on('collect', msg => void msg.delete());

  await respondMessage.pin();
  await questionMessage.pin();

  const em = (await getORM()).em.fork();

  const question = em.create(Question, {
    questionId,
    questionType,
    question: questionText,
    closesAt,
    startMessageId: startMessage.id,
    askerId: int.user.id,
    guildId: int.guildId,
    channelId: int.channelId,
    threadId: thread.id,
    threadName,
    choices: questionType === 'multiple-choice' ? choices! : undefined,
    responses: [],
    responders: [],
  });

  const statistic = await em.findOneOrFail(Statistic, { name: 'questions' });
  statistic.value = (parseInt(statistic.value) + 1).toString();

  em.persist(question);
  await em.flush();
};

const respond = async (int: CommandInteraction) => {
  // note: all replies must be ephemeral to protect privacy

  const questionId = int.options.getString('question-id', true);
  let response = int.options.getString('response', true);

  await int.deferReply({ ephemeral: true });

  const em = (await getORM()).em.fork();

  const question = await em.findOne(Question, { questionId });

  if (!question)
    return int.editReply({
      embeds: [
        Embed.error(
          '**Invalid question ID**',
          'Make sure your question ID is valid and the question is not closed. Questions only accept responses before the closing time noted in the bot message.'
        ),
      ],
    });

  if (question.responders.includes(int.user.id))
    return error(int, 'You have already responded to this question.');

  const guild = await client.guilds.fetch(question.guildId);
  const member = await guild.members.fetch(int.user.id);

  if (!member) return error(int, 'You must be in the server the question was asked in to respond.');

  let responseIndex: number;

  // validate response based on type
  if (question.questionType === 'multiple-choice') {
    if (response.length !== 1)
      return error(int, 'Your response to this multiple-choice question should be one letter.');

    const validResponses = alphabet.slice(0, question.choices!.length).split('');
    responseIndex = validResponses.findIndex(
      letter => letter.toLowerCase() === response.toLowerCase()
    );
    if (responseIndex === -1)
      return error(
        int,
        'Invalid answer choice. Your response should be the letter of an answer choice.'
      );

    response = response.toLowerCase();
  } else {
    if (response.length < 3 || response.length > 1500)
      return error(
        int,
        'Your response should be at least 3 and less than 1,500 characters in length.'
      );
  }

  question.responders = _.shuffle([...question.responders, int.user.id]);
  question.responses = _.shuffle([...question.responses, response]);

  const statistic = await em.findOneOrFail(Statistic, { name: 'responses' });
  statistic.value = (parseInt(statistic.value) + 1).toString();

  int.editReply({
    embeds: [
      Embed.success(
        `Successfully added your response! Come back at ${question.closesAt.toLocaleString(
          'en-US',
          { timeZone: 'UTC', timeZoneName: 'short' }
        )} to see all the responses.`,
        question.questionType === 'multiple-choice'
          ? `You chose **${question.choices![responseIndex!]}**.`
          : undefined
      ).setAuthor('Question ' + question.questionId),
    ],
  });

  await em.flush();
};

const closeQuestion = async (question: Question) => {
  const thread = await client.channels.fetch(question.threadId);
  if (!thread?.isThread()) return;

  const message = await thread.parent?.messages.fetch(question.startMessageId);
  if (message) {
    message.edit({
      embeds: [
        new Embed({
          author: { name: `Question ${question.questionId}` },
          title: `New question asked by ${(await client.users.fetch(question.askerId)).tag}`,
          description: 'This question has been closed.',
        }),
      ],
    });
  }

  const responseCount = question.responses.length;

  await thread.send({
    embeds: [
      new Embed({
        title: 'Question closed',
        description: `This question is no longer accepting responses.\n\n${
          responseCount
            ? `${responseCount} response${responseCount === 1 ? '' : 's'} ${
                responseCount === 1 ? 'was' : 'were'
              } received and are shown below` +
              (question.questionType === 'free-response' ? ', in no particular order:' : ':')
            : 'No one responded in the alotted time.'
        }`,
      }),
    ],
  });

  if (responseCount) {
    if (question.questionType === 'multiple-choice') {
      const responsesText = question
        .choices!.map((c, i) => {
          const numberChosen = question.responses.filter(
            r => r.toLowerCase() === alphabet[i].toLowerCase()
          ).length;
          return `${alphabet[i]}. ${c}: **${numberChosen.toLocaleString()}** (${Math.round(
            (numberChosen / (question.responses.length ?? 1)) * 100
          )}%)`;
        })
        .join('\n');

      await thread.send({ embeds: [Embed.info(responsesText)] });
    } else {
      const responses = _.shuffle(question.responses.map(r => Util.cleanContent(r, thread)));

      for (const response of responses) {
        await thread.send({ embeds: [Embed.info(response)] });
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
    }
  }
};

let questionUpdater: NodeJS.Timer;
client.on('ready', () => {
  questionUpdater = setInterval(async () => {
    const em = (await getORM()).em.fork();

    const questions = await em.find(Question, {});

    for (const question of questions) {
      if (question.closesAt.getTime() < Date.now()) {
        await em.removeAndFlush(question);
        try {
          await closeQuestion(question);
        } catch (err) {
          getLogger('questionUpdater').error(err);
        }
      }
    }
  }, 5000);
});

client.on('interactionCreate', async int => {
  if (!int.isCommand()) return;

  try {
    if (int.commandName === 'ask') ask(int);
    else if (int.commandName === 'respond') respond(int);
  } catch (err) {
    getLogger('Client!interactionCreate').error(err);
    error(int, Formatters.codeBlock(err.message));
  }
});

client.on('messageCreate', async msg => {
  if (!msg.guild) return;
  if (!process.env.BOT_ADMINISTRATORS?.split(',').includes(msg.author.id)) return;

  if (msg.content === 'aq.clear') {
    if (!client.devMode) return;
    const em = (await getORM()).em.fork();

    const questions = await em.find(Question, {});
    questions.forEach(q => em.remove(q));
    await em.flush();

    msg.reply({ embeds: [Embed.success(`Cleared ${questions.length}  questions`)] });
  } else if (msg.content === 'aq.deploy') {
    const data = [askData, respondData];

    client.devMode
      ? await msg.guild.commands.set(data)
      : await client.application!.commands.set(data);

    msg.reply({
      embeds: [
        Embed.success(
          `Deployed 2 commands ${client.devMode ? `to **${msg.guild.name}**` : '**globally**'}`
        ),
      ],
    });
  }
});

client.login(process.env.DISCORD_TOKEN);
