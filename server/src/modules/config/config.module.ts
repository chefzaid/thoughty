import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Setting } from '@/database/entities';
import { ConfigController } from './config.controller';
import { ConfigService } from './config.service';

@Module({
  imports: [TypeOrmModule.forFeature([Setting])],
  controllers: [ConfigController],
  providers: [ConfigService],
  exports: [ConfigService],
})
export class UserConfigModule {}
