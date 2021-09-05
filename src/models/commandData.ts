import {
  ApplicationCommandData,
  ApplicationCommandOption,
  ApplicationCommandOptionChoice,
} from 'discord.js';
import _ from 'lodash';

const timeoutValues = [
  { name: '1 minute', value: '60000' },
  { name: '5 minutes', value: '300000' },
  { name: '15 minutes', value: '900000' },
  { name: '30 minutes', value: '1800000' },
  { name: '1 hour', value: '3600000' },
  { name: '2 hours', value: '7200000' },
  { name: '4 hours', value: '14400000' },
  { name: '6 hours', value: '21600000' },
  { name: '8 hours', value: '28800000' },
  { name: '12 hours', value: '43200000' },
  { name: '24 hours', value: '86400000' },
] as const;

export type TimeoutValue = typeof timeoutValues[number]['value'];

const timeout: ApplicationCommandOption = {
  type: 'STRING',
  name: 'timeout',
  description: 'How long responses should be accepted for.',
  required: true,
  choices: timeoutValues as unknown as ApplicationCommandOptionChoice[],
};

const question: ApplicationCommandOption = {
  type: 'STRING',
  name: 'question',
  description: 'Question to ask.',
  required: true,
};

const threadName: ApplicationCommandOption = {
  type: 'STRING',
  name: 'thread-name',
  description:
    'Optional custom thread name. If not provided, the question will be used as the title.',
};

export const askData: ApplicationCommandData = {
  type: 'CHAT_INPUT',
  name: 'ask',
  description:
    'Ask a new question. This command creates a public thread and thus should be run in a text channel.',
  options: [
    {
      type: 'SUB_COMMAND',
      name: 'multiple-choice',
      description: 'Ask a multiple choice question.',
      options: [
        _.cloneDeep(timeout),
        _.cloneDeep(question),
        {
          type: 'STRING',
          name: 'choices',
          description: 'Comma-separated list of choices, e.g. "Option A, Option B, Option C".',
          required: true,
        },
        _.cloneDeep(threadName),
      ],
    },
    {
      type: 'SUB_COMMAND',
      name: 'free-response',
      description: 'Ask a free response question.',
      options: [_.cloneDeep(timeout), _.cloneDeep(question), _.cloneDeep(threadName)],
    },
  ],
};

export const respondData: ApplicationCommandData = {
  type: 'CHAT_INPUT',
  name: 'respond',
  description: 'Respond to an open question',
  options: [
    {
      type: 'STRING',
      name: 'question-id',
      description: 'ID for the question you are responding to; located in the question embed.',
      required: true,
    },
    {
      type: 'STRING',
      name: 'response',
      description:
        'Response to the question. Use a single letter (e.g. `A`) for multiple-choice questions.',
      required: true,
    },
  ],
};
