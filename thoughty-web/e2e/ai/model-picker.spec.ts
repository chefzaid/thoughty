import { expect, test } from '../support/test';
import { setupMockApp } from '../support/mockApp';

test.describe('OpenRouter model picker', () => {
  test('lists the OpenRouter models, filters them, and saves the chosen one', async ({ page }) => {
    const { state } = await setupMockApp(page, { startAuthenticated: true });

    await page.goto('/profile');
    const trigger = page.locator('.model-dropdown-trigger');
    await expect(trigger).toHaveText('openai/gpt-4o-mini');

    await trigger.click();
    const items = page.locator('.model-dropdown-item');
    await expect(items.locator('.model-dropdown-item-name')).toHaveText([
      'Anthropic: Claude 3.5 Haiku',
      'Mistral: Mistral Small 3.1 24B',
      'OpenAI: GPT-4o-mini',
    ]);

    await page.getByPlaceholder('Search models...').fill('haiku');
    await expect(items).toHaveCount(1);
    await items.click();
    await expect(trigger).toHaveText('Anthropic: Claude 3.5 Haiku');

    await page.getByRole('button', { name: 'Save Changes' }).click();
    await page.getByText('Saved successfully').waitFor();
    expect(state.config.openRouterModel).toBe('anthropic/claude-3.5-haiku');
  });
});
