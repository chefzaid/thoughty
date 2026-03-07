import { sanitizeString, sanitizeObject } from './sanitize.util';

describe('sanitize.util', () => {
  describe('sanitizeString', () => {
    it('should return the same string for safe input', () => {
      const result = sanitizeString('Hello World');

      expect(result).toBe('Hello World');
    });

    it('should strip script tags', () => {
      const result = sanitizeString('<script>alert("xss")</script>Hello');

      expect(result).not.toContain('<script>');
      expect(result).not.toContain('alert');
      expect(result).toContain('Hello');
    });

    it('should strip HTML tags', () => {
      const result = sanitizeString('<div>Hello</div>');

      expect(result).not.toContain('<div>');
      expect(result).not.toContain('</div>');
      expect(result).toContain('Hello');
    });

    it('should handle empty string', () => {
      const result = sanitizeString('');

      expect(result).toBe('');
    });

    it('should handle XSS attack vectors', () => {
      const xssInputs = [
        ['<img src=x onerror=alert(1)>', 'alert'],
        ['<svg onload=alert(1)>', 'alert'],
        ['<a href="javascript:alert(1)">click</a>', 'javascript:'],
        ['"><script>alert(1)</script>', '<script>'],
      ] as const;

      for (const [input, expected] of xssInputs) {
        const result = sanitizeString(input);
        expect(result).not.toContain(expected);
      }
    });

    it('should return non-string input as-is', () => {
      const num = 123 as any;
      const result = sanitizeString(num);

      expect(result).toBe(123);
    });

    it('should handle unicode characters', () => {
      const result = sanitizeString('Hello 世界 🌍');

      expect(result).toBe('Hello 世界 🌍');
    });

    it('should handle nested tags', () => {
      const result = sanitizeString('<div><span><script>bad</script></span></div>');

      expect(result).not.toContain('<');
      expect(result).not.toContain('>');
    });
  });

  describe('sanitizeObject', () => {
    it('should sanitize string values in object', () => {
      const input = {
        name: '<script>alert(1)</script>John',
        email: 'john@example.com',
      };

      const result = sanitizeObject(input);

      expect(result.name).not.toContain('<script>');
      expect(result.name).toContain('John');
      expect(result.email).toBe('john@example.com');
    });

    it('should sanitize object keys', () => {
      const input = {
        '<script>key</script>': 'value',
      };

      const result = sanitizeObject(input);
      const keys = Object.keys(result);

      expect(keys[0]).not.toContain('<script>');
    });

    it('should handle nested objects', () => {
      const input = {
        user: {
          name: '<div>John</div>',
          profile: {
            bio: '<script>alert(1)</script>Hello',
          },
        },
      };

      const result = sanitizeObject(input);

      expect(result.user.name).not.toContain('<div>');
      expect(result.user.profile.bio).not.toContain('<script>');
      expect(result.user.profile.bio).toContain('Hello');
    });

    it('should handle arrays', () => {
      const input = ['<script>1</script>', '<div>2</div>', 'safe'];

      const result = sanitizeObject(input);

      expect(result[0]).not.toContain('<script>');
      expect(result[1]).not.toContain('<div>');
      expect(result[2]).toBe('safe');
    });

    it('should handle arrays of objects', () => {
      const input = [
        { name: '<script>John</script>' },
        { name: '<div>Jane</div>' },
      ];

      const result = sanitizeObject(input);

      expect(result[0].name).not.toContain('<script>');
      expect(result[1].name).not.toContain('<div>');
    });

    it('should handle null values', () => {
      const input = { name: null };

      const result = sanitizeObject(input);

      expect(result.name).toBeNull();
    });

    it('should handle undefined values', () => {
      const input = { name: undefined };

      const result = sanitizeObject(input);

      expect(result.name).toBeUndefined();
    });

    it('should handle number values', () => {
      const input = { count: 42, price: 19.99 };

      const result = sanitizeObject(input);

      expect(result.count).toBe(42);
      expect(result.price).toBe(19.99);
    });

    it('should handle boolean values', () => {
      const input = { active: true, deleted: false };

      const result = sanitizeObject(input);

      expect(result.active).toBe(true);
      expect(result.deleted).toBe(false);
    });

    it('should handle empty object', () => {
      const result = sanitizeObject({});

      expect(result).toEqual({});
    });

    it('should handle empty array', () => {
      const result = sanitizeObject([]);

      expect(result).toEqual([]);
    });

    it('should handle deeply nested structures', () => {
      const input = {
        level1: {
          level2: {
            level3: {
              level4: {
                value: '<script>deep</script>',
              },
            },
          },
        },
      };

      const result = sanitizeObject(input);

      expect(result.level1.level2.level3.level4.value).not.toContain('<script>');
    });

    it('should handle mixed arrays and objects', () => {
      const input = {
        items: [
          '<script>1</script>',
          { nested: '<div>2</div>' },
          [{ deep: '<span>3</span>' }],
        ],
      };

      const result = sanitizeObject(input) as {
        items: (string | { nested: string } | { deep: string }[])[];
      };

      expect(result.items[0]).not.toContain('<script>');
      expect((result.items[1] as { nested: string }).nested).not.toContain('<div>');
      expect((result.items[2] as { deep: string }[])[0].deep).not.toContain('<span>');
    });
  });
});
