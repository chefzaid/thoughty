import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { FeatureRequest, FeatureRequestVote } from '@/database/entities';
import { FeatureRequestsController } from './feature-requests.controller';
import { FeatureRequestsService } from './feature-requests.service';

@Module({
  imports: [TypeOrmModule.forFeature([FeatureRequest, FeatureRequestVote])],
  controllers: [FeatureRequestsController],
  providers: [FeatureRequestsService],
})
export class FeatureRequestsModule {}
