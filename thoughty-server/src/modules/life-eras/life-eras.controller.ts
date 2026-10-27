import { Body, Controller, Delete, Get, Param, ParseIntPipe, Patch, Post, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiParam, ApiResponse, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '@/modules/auth/guards';
import { CurrentUser, AuthenticatedUser } from '@/common/decorators';
import { SuccessResponseDto } from '@/common/dto';
import { CreateLifeEraDto, LifeEraListResponseDto, LifeEraResponseDto, UpdateLifeEraDto } from './dto';
import { LifeErasService } from './life-eras.service';

@ApiTags('Life eras')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('life-eras')
export class LifeErasController {
  constructor(private readonly lifeErasService: LifeErasService) {}

  @Get()
  @ApiOperation({ summary: 'List the writer’s life eras, by start date' })
  @ApiResponse({ status: 200, description: 'Life eras and the limit', type: LifeEraListResponseDto })
  async list(@CurrentUser() user: AuthenticatedUser): Promise<LifeEraListResponseDto> {
    return this.lifeErasService.list(user.userId);
  }

  @Post()
  @ApiOperation({ summary: 'Add a named date range of the writer’s life' })
  @ApiResponse({ status: 201, description: 'Era added', type: LifeEraResponseDto })
  @ApiResponse({ status: 400, description: 'Invalid era, an end before the start, or the life era limit is reached' })
  @ApiResponse({ status: 409, description: 'A life era with this name already exists' })
  async create(@CurrentUser() user: AuthenticatedUser, @Body() dto: CreateLifeEraDto): Promise<LifeEraResponseDto> {
    return this.lifeErasService.create(user.userId, dto);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Change a life era’s name, dates, colour, emoji or note' })
  @ApiParam({ name: 'id', type: Number })
  @ApiResponse({ status: 200, description: 'Era changed', type: LifeEraResponseDto })
  @ApiResponse({ status: 400, description: 'Invalid era, or an end before the start' })
  @ApiResponse({ status: 404, description: 'Life era not found' })
  @ApiResponse({ status: 409, description: 'A life era with this name already exists' })
  async update(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateLifeEraDto,
  ): Promise<LifeEraResponseDto> {
    return this.lifeErasService.update(user.userId, id, dto);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Delete a life era; saved searches filtered by it then cover every date' })
  @ApiParam({ name: 'id', type: Number })
  @ApiResponse({ status: 200, description: 'Era deleted', type: SuccessResponseDto })
  @ApiResponse({ status: 404, description: 'Life era not found' })
  async delete(@CurrentUser() user: AuthenticatedUser, @Param('id', ParseIntPipe) id: number): Promise<SuccessResponseDto> {
    return this.lifeErasService.delete(user.userId, id);
  }
}
