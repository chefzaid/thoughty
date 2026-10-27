import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { LifeEra } from '@/database/entities';
import { LifeErasController } from './life-eras.controller';
import { LifeErasService } from './life-eras.service';

@Module({
  imports: [TypeOrmModule.forFeature([LifeEra])],
  controllers: [LifeErasController],
  providers: [LifeErasService],
  exports: [LifeErasService],
})
export class LifeErasModule {}
