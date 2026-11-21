import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Diary, PersonalAccessToken } from '@/database/entities';
import { AuthModule } from '@/modules/auth/auth.module';
import { EntriesModule } from '@/modules/entries/entries.module';
import { AccessTokenGuard } from './access-token.guard';
import { AccessTokensController } from './access-tokens.controller';
import { AccessTokensService } from './access-tokens.service';
import { PublicApiController } from './public-api.controller';
import { PublicApiService } from './public-api.service';

@Module({
  imports: [TypeOrmModule.forFeature([PersonalAccessToken, Diary]), AuthModule, EntriesModule],
  controllers: [AccessTokensController, PublicApiController],
  providers: [AccessTokensService, PublicApiService, AccessTokenGuard],
})
export class AccessTokensModule {}
