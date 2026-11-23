import { Body, Controller, HttpCode, HttpStatus, Post } from '@nestjs/common';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { Public, RATE_LIMITS, SuccessResponseDto, throttleDefault } from '@/common';
import { ContactMessageDto } from './dto';
import { ContactService } from './contact.service';

@ApiTags('Contact')
@Controller('contact')
export class ContactController {
  constructor(private readonly contactService: ContactService) {}

  @Public()
  @Post()
  @HttpCode(HttpStatus.ACCEPTED)
  @Throttle(throttleDefault(RATE_LIMITS.contactMessage))
  @ApiOperation({
    summary: 'Send a message from the Contact page',
    description:
      'Emails the message as plain text to the deployment\'s `CONTACT_EMAIL`, with the sender as ' +
      'reply-to. Nothing is stored. Five messages per hour from one address.',
  })
  @ApiResponse({ status: 202, description: 'Handed to the mail server', type: SuccessResponseDto })
  @ApiResponse({
    status: 400,
    description: 'Validation error, or the hidden bot-trap field filled in (`CONTACT_INVALID_REQUEST`)',
  })
  @ApiResponse({ status: 429, description: 'Too many messages from this address (`RATE_LIMITED`)' })
  @ApiResponse({ status: 502, description: 'The mail server refused the message (`CONTACT_NOT_SENT`)' })
  @ApiResponse({
    status: 503,
    description: 'No mail server, or `CONTACT_EMAIL` is not an address (`CONTACT_NOT_CONFIGURED`)',
  })
  async send(@Body() dto: ContactMessageDto): Promise<SuccessResponseDto> {
    await this.contactService.send(dto);
    return { success: true };
  }
}
