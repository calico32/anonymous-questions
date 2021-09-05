import { Entity, PrimaryKey, Property } from '@mikro-orm/core';
import { Snowflake } from 'discord.js';

@Entity()
export class Question {
  @PrimaryKey({ type: 'number' })
  id!: number;

  @Property({ type: 'date' })
  createdAt = new Date();

  @Property({ type: 'date', onUpdate: () => new Date() })
  updatedAt = new Date();

  @Property({ type: 'text' })
  questionId!: string;

  @Property({ type: 'text' })
  questionType!: 'multiple-choice' | 'free-response';

  @Property({ type: 'date' })
  closesAt!: Date;

  @Property({ type: 'text' })
  question!: string;

  @Property({ type: 'text', nullable: true })
  threadName?: string;

  @Property({ type: 'text' })
  askerId!: Snowflake;

  @Property({ type: 'text' })
  guildId!: Snowflake;

  @Property({ type: 'text' })
  startMessageId!: string;

  @Property({ type: 'text' })
  threadId!: Snowflake;

  @Property({ type: 'jsonb', nullable: true })
  choices?: string[];

  @Property({ type: 'jsonb', default: [] })
  responses!: string[];

  @Property({ type: 'jsonb', default: [] })
  responders!: Snowflake[];
}
