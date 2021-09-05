import { Migration } from '@mikro-orm/migrations';

export class Migration20210905034935 extends Migration {
  async up(): Promise<void> {
    this.addSql(
      'create table "statistic" ("id" serial primary key, "created_at" timestamptz(0) not null, "updated_at" timestamptz(0) not null, "name" text not null, "value" text not null);'
    );

    this.addSql(
      'create table "question" ("id" serial primary key, "created_at" timestamptz(0) not null, "updated_at" timestamptz(0) not null, "question_id" text not null, "question_type" text not null, "closes_at" timestamptz(0) not null, "question" text not null, "thread_name" text null, "asker_id" text not null, "guild_id" text not null, "thread_id" text not null, "choices" jsonb null, "responses" jsonb not null, "responders" jsonb not null);'
    );
  }

  async down(): Promise<void> {
    this.addSql('drop table "statistic";');

    this.addSql('drop table "question";');
  }
}
