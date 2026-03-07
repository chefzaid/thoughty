import {
  Controller,
  Get,
  Post,
  Put,
  Patch,
  Delete,
  Body,
  Param,
  ParseIntPipe,
  UseGuards,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth, ApiParam } from '@nestjs/swagger';
import { DiariesService } from './diaries.service';
import { CreateDiaryDto, UpdateDiaryDto, DiaryResponseDto } from './dto';
import { JwtAuthGuard } from '@/modules/auth/guards';
import { CurrentUser, AuthenticatedUser } from '@/common/decorators';

@ApiTags('Diaries')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('diaries')
export class DiariesController {
  constructor(private readonly diariesService: DiariesService) {}

  @Get()
  @ApiOperation({ summary: 'Get all diaries for the current user' })
  @ApiResponse({ status: 200, description: 'List of diaries', type: [DiaryResponseDto] })
  async findAll(@CurrentUser() user: AuthenticatedUser): Promise<DiaryResponseDto[]> {
    return this.diariesService.findAll(user.userId);
  }

  @Post()
  @ApiOperation({ summary: 'Create a new diary' })
  @ApiResponse({ status: 201, description: 'Diary created', type: DiaryResponseDto })
  @ApiResponse({ status: 400, description: 'Validation error' })
  async create(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: CreateDiaryDto,
  ): Promise<DiaryResponseDto> {
    return this.diariesService.create(user.userId, dto);
  }

  @Put(':id')
  @ApiOperation({ summary: 'Update a diary' })
  @ApiParam({ name: 'id', type: Number })
  @ApiResponse({ status: 200, description: 'Diary updated', type: DiaryResponseDto })
  @ApiResponse({ status: 404, description: 'Diary not found' })
  async update(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateDiaryDto,
  ): Promise<DiaryResponseDto> {
    return this.diariesService.update(user.userId, id, dto);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Delete a diary (entries moved to default diary)' })
  @ApiParam({ name: 'id', type: Number })
  @ApiResponse({ status: 200, description: 'Diary deleted' })
  @ApiResponse({ status: 400, description: 'Cannot delete default diary' })
  @ApiResponse({ status: 404, description: 'Diary not found' })
  async delete(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseIntPipe) id: number,
  ): Promise<{ success: boolean }> {
    return this.diariesService.delete(user.userId, id);
  }

  @Patch(':id/default')
  @ApiOperation({ summary: 'Set a diary as the default' })
  @ApiParam({ name: 'id', type: Number })
  @ApiResponse({ status: 200, description: 'Default diary set', type: DiaryResponseDto })
  @ApiResponse({ status: 404, description: 'Diary not found' })
  async setDefault(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseIntPipe) id: number,
  ): Promise<DiaryResponseDto> {
    return this.diariesService.setDefault(user.userId, id);
  }
}
