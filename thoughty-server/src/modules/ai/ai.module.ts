import { Module } from '@nestjs/common';
import { UserConfigModule } from '@/modules/config';
import { AiController } from './ai.controller';
import { AiService } from './ai.service';

@Module({
  imports: [UserConfigModule],
  controllers: [AiController],
  providers: [AiService],
  exports: [AiService],
})
export class AiModule {}