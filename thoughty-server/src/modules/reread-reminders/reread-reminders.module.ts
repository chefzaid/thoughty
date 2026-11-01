import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Entry } from '@/database/entities';
import { RereadRemindersController } from './reread-reminders.controller';
import { RereadReminderService } from './reread-reminders.service';

/** Setting and clearing reread reminders; Highlights reads the due ones through the service. */
@Module({
  imports: [TypeOrmModule.forFeature([Entry])],
  controllers: [RereadRemindersController],
  providers: [RereadReminderService],
  exports: [RereadReminderService],
})
export class RereadRemindersModule {}
