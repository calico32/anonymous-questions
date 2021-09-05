import { Migration } from '@mikro-orm/migrations';

export class Migration20210905043226 extends Migration {
  async up(): Promise<void> {
    this.addSql('alter table "question" add column "start_message_id" text not null;');
  }

  async down(): Promise<void> {
    this.addSql('alter table "question" drop column "start_message_id";');
  }
}
