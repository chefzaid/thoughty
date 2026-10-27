import { Body, Controller, Delete, Get, HttpCode, Param, ParseIntPipe, Patch, Post, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiParam, ApiResponse, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '@/modules/auth/guards';
import { CurrentUser, AuthenticatedUser } from '@/common/decorators';
import { SuccessResponseDto } from '@/common/dto';
import { MergePersonDto, PersonListResponseDto, PersonResponseDto, UpdatePersonDto } from './dto';
import { PeopleService } from './people.service';

@ApiTags('People')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('people')
export class PeopleController {
  constructor(private readonly peopleService: PeopleService) {}

  @Get()
  @ApiOperation({ summary: 'List the people the writer mentions with @handle, by name, with how many entries mention each' })
  @ApiResponse({ status: 200, description: 'People and the limit', type: PersonListResponseDto })
  async list(@CurrentUser() user: AuthenticatedUser): Promise<PersonListResponseDto> {
    return this.peopleService.list(user.userId);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Change the name shown for a person; their handles and the entries’ text stay as they are' })
  @ApiParam({ name: 'id', type: Number })
  @ApiResponse({ status: 200, description: 'Person renamed', type: PersonResponseDto })
  @ApiResponse({ status: 400, description: 'Invalid name' })
  @ApiResponse({ status: 404, description: 'Person not found' })
  async rename(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdatePersonDto,
  ): Promise<PersonResponseDto> {
    return this.peopleService.rename(user.userId, id, dto);
  }

  @Post(':id/merge')
  @HttpCode(200)
  @ApiOperation({ summary: 'Merge a duplicate into this person: its handles and entries move here, then it is deleted' })
  @ApiParam({ name: 'id', type: Number, description: 'The person kept' })
  @ApiResponse({ status: 200, description: 'The person kept, with the duplicate merged in', type: PersonResponseDto })
  @ApiResponse({ status: 400, description: 'A person cannot be merged into themselves' })
  @ApiResponse({ status: 404, description: 'Person not found' })
  async merge(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: MergePersonDto,
  ): Promise<PersonResponseDto> {
    return this.peopleService.merge(user.userId, id, dto);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Delete a person: their entries are unlinked and keep their text' })
  @ApiParam({ name: 'id', type: Number })
  @ApiResponse({ status: 200, description: 'Person deleted', type: SuccessResponseDto })
  @ApiResponse({ status: 404, description: 'Person not found' })
  async delete(@CurrentUser() user: AuthenticatedUser, @Param('id', ParseIntPipe) id: number): Promise<SuccessResponseDto> {
    return this.peopleService.delete(user.userId, id);
  }
}
