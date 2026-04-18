import {
  Controller,
  Post,
  Delete,
  Get,
  Param,
  Body,
  ParseIntPipe,
  UseGuards,
  UseInterceptors,
  UploadedFile,
  Res,
  NotFoundException,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth, ApiConsumes, ApiParam } from '@nestjs/swagger';
import { memoryStorage } from 'multer';
import { Response } from 'express';
import { AttachmentsService } from './attachments.service';
import { LinkAttachmentDto } from './dto';
import { JwtAuthGuard } from '@/modules/auth/guards';
import { CurrentUser, AuthenticatedUser } from '@/common/decorators';

@ApiTags('Attachments')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('attachments')
export class AttachmentsController {
  constructor(private readonly attachmentsService: AttachmentsService) {}

  @Post('upload')
  @ApiOperation({ summary: 'Upload a file attachment' })
  @ApiConsumes('multipart/form-data')
  @ApiResponse({ status: 201, description: 'File uploaded successfully' })
  @UseInterceptors(
    FileInterceptor('file', {
      storage: memoryStorage(),
      limits: {
        fileSize: 5 * 1024 * 1024, // 5MB
      },
    }),
  )
  async upload(
    @CurrentUser() user: AuthenticatedUser,
    @UploadedFile() file: Express.Multer.File,
    @Body() dto: LinkAttachmentDto,
  ) {
    const attachment = await this.attachmentsService.upload(
      user.userId,
      file,
      dto.entryId,
    );

    return {
      id: attachment.id,
      original_filename: attachment.originalFilename,
      stored_filename: attachment.storedFilename,
      mimetype: attachment.mimetype,
      size: attachment.size,
      entry_id: attachment.entryId,
      created_at: attachment.createdAt,
    };
  }

  @Get('entry/:entryId')
  @ApiOperation({ summary: 'Get all attachments for an entry' })
  @ApiParam({ name: 'entryId', type: Number })
  @ApiResponse({ status: 200, description: 'List of attachments' })
  async getByEntry(
    @CurrentUser() user: AuthenticatedUser,
    @Param('entryId', ParseIntPipe) entryId: number,
  ) {
    const attachments = await this.attachmentsService.getByEntry(user.userId, entryId);
    return attachments.map((a) => ({
      id: a.id,
      original_filename: a.originalFilename,
      stored_filename: a.storedFilename,
      mimetype: a.mimetype,
      size: a.size,
      entry_id: a.entryId,
      created_at: a.createdAt,
    }));
  }

  @Post(':id/link')
  @ApiOperation({ summary: 'Link an attachment to an entry' })
  @ApiParam({ name: 'id', type: Number })
  @ApiResponse({ status: 200, description: 'Attachment linked to entry' })
  async linkToEntry(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: LinkAttachmentDto,
  ) {
    if (!dto.entryId) {
      throw new NotFoundException('entryId is required');
    }
    const attachment = await this.attachmentsService.linkToEntry(
      user.userId,
      id,
      dto.entryId,
    );
    return {
      id: attachment.id,
      original_filename: attachment.originalFilename,
      stored_filename: attachment.storedFilename,
      mimetype: attachment.mimetype,
      size: attachment.size,
      entry_id: attachment.entryId,
      created_at: attachment.createdAt,
    };
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Delete an attachment' })
  @ApiParam({ name: 'id', type: Number })
  @ApiResponse({ status: 200, description: 'Attachment deleted' })
  async delete(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseIntPipe) id: number,
  ): Promise<{ success: boolean }> {
    return this.attachmentsService.delete(user.userId, id);
  }

  @Get('file/:filename')
  @ApiOperation({ summary: 'Serve an attachment file' })
  @ApiParam({ name: 'filename', type: String })
  @ApiResponse({ status: 200, description: 'File content' })
  async serveFile(
    @Param('filename') filename: string,
    @Res() res: Response,
  ) {
    // Sanitize filename to prevent path traversal
    const sanitized = filename.replace(/[^a-zA-Z0-9._-]/g, '');

    try {
      const { stream, contentType } = await this.attachmentsService.getFileStream(sanitized);
      res.setHeader('Content-Type', contentType);
      stream.pipe(res);
    } catch {
      throw new NotFoundException('File not found');
    }
  }
}
