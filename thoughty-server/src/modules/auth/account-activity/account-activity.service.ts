import { type BeforeApplicationShutdown, Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { IsNull, LessThan, MoreThan, Repository } from 'typeorm';
import { BackgroundTasks } from '@/common/utils/background-tasks.util';
import { isPlaceholderEmail } from '@/common/utils/placeholder-email.util';
import { AccountEvent, type AccountEventKind, Setting, type User } from '@/database/entities';
import { describeEmailFailure, EmailService } from '../services/email.service';
import { findAccountLanguage } from '../services/account-language';
import { currentClientSoftware, type ClientSoftware } from './client-software';
import { renderNewSignInEmail } from './new-sign-in-email';
import type { AccountActivityResponseDto, AccountEventDto } from './dto';

/** How long account activity is kept and listed. */
export const ACCOUNT_ACTIVITY_RETENTION_DAYS = 365;
/** Events per page of the list. */
export const ACCOUNT_ACTIVITY_PAGE_SIZE = 50;
/** The setting that turns the new-browser sign-in email off (`false`); on when it was never set. */
export const NEW_BROWSER_EMAIL_SETTING = 'newBrowserSignInEmail';
/** Namespace of the advisory lock that serializes one account's sign-ins, so two at once send one email. */
const SIGN_IN_LOCK_NAMESPACE = 'account_sign_ins';

const DAY_MS = 24 * 60 * 60 * 1000;

/** The start of the window account activity covers, a year before `now`. */
export function accountActivityCutoff(now = new Date()): Date {
  return new Date(now.getTime() - ACCOUNT_ACTIVITY_RETENTION_DAYS * DAY_MS);
}

function toEventDto(event: AccountEvent): AccountEventDto {
  return {
    id: event.id,
    kind: event.kind,
    browser: event.browser,
    system: event.system,
    createdAt: event.createdAt,
  };
}

/**
 * A writer's account activity: sign-ins, refused sign-ins, sign-outs and security changes, each with the
 * browser and system of the request that made it (`ClientSoftwareMiddleware`). A sign-in from a browser
 * and system the account has not signed in from in the past year sends an email, unless turned off.
 */
@Injectable()
export class AccountActivityService implements BeforeApplicationShutdown {
  private readonly logger = new Logger(AccountActivityService.name);
  /** The new sign-in emails being sent in the background. */
  private readonly emails = new BackgroundTasks();

  constructor(
    @InjectRepository(AccountEvent)
    private readonly eventRepository: Repository<AccountEvent>,
    @InjectRepository(Setting)
    private readonly settingRepository: Repository<Setting>,
    private readonly emailService: EmailService,
    private readonly configService: ConfigService,
  ) {}

  /**
   * Records `kind` for the account, from the browser and system of the request in progress. The action
   * it records is already done, so a failure here is logged and never fails the request.
   */
  async record(userId: number, kind: AccountEventKind): Promise<void> {
    try {
      await this.insert(this.eventRepository, userId, kind, currentClientSoftware());
    } catch (error) {
      this.logFailure(kind, error);
    }
  }

  /**
   * Records a sign-in, and emails the writer when it comes from a browser and system the account has
   * not signed in from before, though not for its first sign-in. The check and the record run under a
   * lock per account, so two sign-ins at once from a new browser send one email.
   */
  async recordSignIn(user: Pick<User, 'id' | 'email'>): Promise<void> {
    const software = currentClientSoftware();
    try {
      const { event, notify } = await this.eventRepository.manager.transaction(async (manager) => {
        await manager.query('SELECT pg_advisory_xact_lock(hashtext($1), $2)', [SIGN_IN_LOCK_NAMESPACE, user.id]);
        const events = manager.getRepository(AccountEvent);
        const knownSoftware = await events.exists({
          where: {
            userId: user.id,
            kind: 'sign_in',
            browser: software.browser ?? IsNull(),
            system: software.system ?? IsNull(),
          },
        });
        // A first sign-in, such as right after sign-up, sends nothing
        const notify =
          !knownSoftware && (await events.exists({ where: { userId: user.id, kind: 'sign_in' } }));
        return { event: await this.insert(events, user.id, 'sign_in', software), notify };
      });
      if (notify) {
        // Sent in the background, so a slow mail server never holds up the sign-in
        this.emails.run(this.sendNewSignInEmail(user, software, event.createdAt));
      }
    } catch (error) {
      this.logFailure('sign_in', error);
    }
  }

  /** Resolves once every new sign-in email in flight has been sent or has failed (each failure is logged). */
  emailsSettled(): Promise<void> {
    return this.emails.settled();
  }

  /** Lets the emails in flight go out before the database and the process close. */
  beforeApplicationShutdown(): Promise<void> {
    return this.emailsSettled();
  }

  /** The past year's events, newest first, a page at a time (`before`: the last id of the page before). */
  async list(userId: number, before?: number, now = new Date()): Promise<AccountActivityResponseDto> {
    const [events, newBrowserEmail] = await Promise.all([
      this.eventRepository.find({
        where: {
          userId,
          createdAt: MoreThan(accountActivityCutoff(now)),
          ...(before ? { id: LessThan(before) } : {}),
        },
        order: { id: 'DESC' },
        take: ACCOUNT_ACTIVITY_PAGE_SIZE + 1,
      }),
      this.newBrowserEmailEnabled(userId),
    ]);
    const page = events.slice(0, ACCOUNT_ACTIVITY_PAGE_SIZE);
    return {
      events: page.map(toEventDto),
      nextBefore: events.length > ACCOUNT_ACTIVITY_PAGE_SIZE ? page[page.length - 1]!.id : null,
      newBrowserEmail,
    };
  }

  /** The past year's events, oldest first, for the data download. */
  async listForDownload(userId: number, now = new Date()): Promise<AccountEventDto[]> {
    const events = await this.eventRepository.find({
      where: { userId, createdAt: MoreThan(accountActivityCutoff(now)) },
      order: { id: 'ASC' },
    });
    return events.map(toEventDto);
  }

  async newBrowserEmailEnabled(userId: number): Promise<boolean> {
    const setting = await this.settingRepository.findOne({
      where: { userId, key: NEW_BROWSER_EMAIL_SETTING },
      select: { value: true },
    });
    return setting?.value !== 'false';
  }

  async setNewBrowserEmail(userId: number, enabled: boolean): Promise<boolean> {
    await this.settingRepository.upsert(
      { userId, key: NEW_BROWSER_EMAIL_SETTING, value: String(enabled) },
      ['userId', 'key'],
    );
    return enabled;
  }

  /** Removes the events older than a year; returns how many. */
  async purgeExpired(now = new Date()): Promise<number> {
    const { affected } = await this.eventRepository.delete({ createdAt: LessThan(accountActivityCutoff(now)) });
    return affected ?? 0;
  }

  private insert(
    events: Repository<AccountEvent>,
    userId: number,
    kind: AccountEventKind,
    software: ClientSoftware,
  ): Promise<AccountEvent> {
    return events.save(events.create({ userId, kind, browser: software.browser, system: software.system }));
  }

  private async sendNewSignInEmail(
    user: Pick<User, 'id' | 'email'>,
    software: ClientSoftware,
    signedInAt: Date,
  ): Promise<void> {
    try {
      if (isPlaceholderEmail(user.email) || !this.emailService.isConfigured()) return;
      if (!(await this.newBrowserEmailEnabled(user.id))) return;
      const email = renderNewSignInEmail({
        language: await findAccountLanguage(this.settingRepository, user.id),
        software,
        signedInAt,
        frontendUrl: this.configService.get<string>('FRONTEND_URL', 'http://localhost:5173'),
      });
      await this.emailService.sendRenderedEmail(user.email, email);
    } catch (error) {
      this.logger.warn(`New sign-in email not sent to user ${user.id}: ${describeEmailFailure(error)}`);
    }
  }

  private logFailure(kind: AccountEventKind, error: unknown): void {
    this.logger.error(
      `Account activity not recorded (${kind}): ${error instanceof Error ? error.message : 'unknown error'}`,
    );
  }
}
