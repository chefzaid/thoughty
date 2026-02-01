import { ExecutionContext } from '@nestjs/common';
import { CurrentUser, AuthenticatedUser } from './current-user.decorator';
import { ROUTE_ARGS_METADATA } from '@nestjs/common/constants';

// Helper to get the factory function from a param decorator
function getParamDecoratorFactory(decorator: Function) {
  class TestClass {
    test(@decorator() user: AuthenticatedUser) {}
  }

  const args = Reflect.getMetadata(ROUTE_ARGS_METADATA, TestClass, 'test');
  return args[Object.keys(args)[0]].factory;
}

describe('CurrentUser Decorator', () => {
  const mockUser: AuthenticatedUser = {
    userId: 1,
    email: 'test@example.com',
    username: 'testuser',
  };

  const createMockExecutionContext = (user: AuthenticatedUser | null): ExecutionContext => {
    return {
      switchToHttp: jest.fn().mockReturnValue({
        getRequest: jest.fn().mockReturnValue({ user }),
      }),
      getHandler: jest.fn(),
      getClass: jest.fn(),
      getType: jest.fn(),
      getArgs: jest.fn(),
      getArgByIndex: jest.fn(),
      switchToRpc: jest.fn(),
      switchToWs: jest.fn(),
    } as unknown as ExecutionContext;
  };

  it('should return the full user object when no data key is specified', () => {
    const factory = getParamDecoratorFactory(CurrentUser);
    const context = createMockExecutionContext(mockUser);

    const result = factory(undefined, context);

    expect(result).toEqual(mockUser);
  });

  it('should return null when user is not present in request', () => {
    const factory = getParamDecoratorFactory(CurrentUser);
    const context = createMockExecutionContext(null);

    const result = factory(undefined, context);

    expect(result).toBeNull();
  });

  it('should return specific property when data key is provided', () => {
    class TestClass {
      test(@CurrentUser('userId') userId: number) {}
    }

    const args = Reflect.getMetadata(ROUTE_ARGS_METADATA, TestClass, 'test');
    const factory = args[Object.keys(args)[0]].factory;
    const context = createMockExecutionContext(mockUser);

    const result = factory('userId', context);

    expect(result).toBe(1);
  });

  it('should return email when email key is provided', () => {
    class TestClass {
      test(@CurrentUser('email') email: string) {}
    }

    const args = Reflect.getMetadata(ROUTE_ARGS_METADATA, TestClass, 'test');
    const factory = args[Object.keys(args)[0]].factory;
    const context = createMockExecutionContext(mockUser);

    const result = factory('email', context);

    expect(result).toBe('test@example.com');
  });

  it('should return username when username key is provided', () => {
    class TestClass {
      test(@CurrentUser('username') username: string) {}
    }

    const args = Reflect.getMetadata(ROUTE_ARGS_METADATA, TestClass, 'test');
    const factory = args[Object.keys(args)[0]].factory;
    const context = createMockExecutionContext(mockUser);

    const result = factory('username', context);

    expect(result).toBe('testuser');
  });
});
