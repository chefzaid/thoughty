import { HttpStatus } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import type { Response } from 'express';
import { RATE_LIMITS } from '@/common';
import { SignUpController } from './sign-up.controller';
import { SignUpService } from './services/sign-up.service';

const mockResponse = () => {
  const res = { cookie: jest.fn(), status: jest.fn(), json: jest.fn() };
  res.status.mockReturnValue(res);
  return res as unknown as Response & { cookie: jest.Mock; status: jest.Mock; json: jest.Mock };
};

const COOKIE_OPTIONS = {
  httpOnly: true,
  secure: false,
  sameSite: 'strict',
  path: '/api/auth',
  maxAge: 7 * 24 * 60 * 60 * 1000,
};

describe('SignUpController', () => {
  let controller: SignUpController;
  let signUpService: { register: jest.Mock; complete: jest.Mock };

  beforeEach(async () => {
    signUpService = { register: jest.fn(), complete: jest.fn() };
    const module = await Test.createTestingModule({
      controllers: [SignUpController],
      providers: [{ provide: SignUpService, useValue: signUpService }],
    }).compile();
    controller = module.get(SignUpController);
  });

  it.each(['register', 'complete'] as const)('throttles %s like the other sign-in attempts', (name) => {
    const handler = SignUpController.prototype[name];
    expect(Reflect.getMetadata('THROTTLER:LIMITdefault', handler)).toBe(RATE_LIMITS.authAttempt.limit);
    expect(Reflect.getMetadata('THROTTLER:TTLdefault', handler)).toBe(RATE_LIMITS.authAttempt.ttl);
  });

  it('answers a verify-first sign-up with 202 and sets no cookie', async () => {
    const started = { verificationRequired: true, message: 'Check your email' };
    signUpService.register.mockResolvedValue(started);
    const res = mockResponse();
    const dto = { email: 'a@b.com', password: 'Pass123!@', username: 'ab' };

    await controller.register(dto, res);
    expect(signUpService.register).toHaveBeenCalledWith(dto);
    expect(res.status).toHaveBeenCalledWith(HttpStatus.ACCEPTED);
    expect(res.json).toHaveBeenCalledWith(started);
    expect(res.cookie).not.toHaveBeenCalled();
  });

  it('signs in at once without a mail server, the refresh token only in its cookie', async () => {
    signUpService.register.mockResolvedValue({ user: { id: 1 }, accessToken: 'token', refreshToken: 'rt' });
    const res = mockResponse();

    await controller.register({ email: 'a@b.com', password: 'Pass123!@' }, res);
    expect(res.status).toHaveBeenCalledWith(HttpStatus.CREATED);
    expect(res.json).toHaveBeenCalledWith({ user: { id: 1 }, accessToken: 'token' });
    expect(res.cookie).toHaveBeenCalledWith('thoughty_refresh_token', 'rt', COOKIE_OPTIONS);
  });

  it('completes a sign-up and starts its session', async () => {
    signUpService.complete.mockResolvedValue({ user: { id: 2, isNewUser: true }, accessToken: 'a', refreshToken: 'r' });
    const res = mockResponse();
    const dto = { token: 'link', password: 'Pass123!@' };

    await expect(controller.complete(dto, res)).resolves.toEqual({ user: { id: 2, isNewUser: true }, accessToken: 'a' });
    expect(signUpService.complete).toHaveBeenCalledWith(dto);
    expect(res.cookie).toHaveBeenCalledWith('thoughty_refresh_token', 'r', COOKIE_OPTIONS);
  });
});
