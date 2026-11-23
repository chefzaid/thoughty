import { describe, expect, it, vi } from 'vitest';
import { act, render, renderHook, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { getTranslation, type Language } from '../../utils/translations';
import AiConsentDialog from './AiConsentDialog';
import { useAiConsentController } from './useAiConsentController';

const tFor = (language: Language) => (key: string, params?: Record<string, string | number>) => getTranslation(language, key, params);
const request = {
  text: 'A dream about the sea',
  details: [{ label: 'aiConsentTags' as const, value: 'dreams, sea' }],
  task: 'tag' as const,
};

describe('AiConsentDialog', () => {
  it('shows nothing while no request waits', () => {
    const { container } = render(<AiConsentDialog request={null} config={{}} onAnswer={vi.fn()} t={tFor('en')} />);
    expect(container).toBeEmptyDOMElement();
  });

  it('shows exactly the text, what goes with it and the model, and answers yes or no', async () => {
    const user = userEvent.setup();
    const onAnswer = vi.fn();
    render(<AiConsentDialog request={request} config={{ theme: 'light', openRouterTagModel: 'openai/gpt-4o-mini' }} onAnswer={onAnswer} t={tFor('en')} />);

    const dialog = screen.getByRole('dialog', { name: 'Send this to the AI?' });
    expect(screen.getByTestId('ai-consent-text')).toHaveTextContent('A dream about the sea');
    expect(screen.getByTestId('ai-consent-text')).toHaveClass('privacy-text');
    expect(dialog).toHaveTextContent('Tags it already hasdreams, sea');
    expect(dialog).toHaveTextContent('It goes to OpenRouter, for the model openai/gpt-4o-mini.');
    expect(screen.getByRole('button', { name: 'Cancel' })).toHaveFocus();

    await user.click(screen.getByRole('button', { name: 'Send' }));
    expect(onAnswer).toHaveBeenLastCalledWith(true);
    await user.keyboard('{Escape}');
    expect(onAnswer).toHaveBeenLastCalledWith(false);
  });

  it('says so in French when Thoughty’s default model takes it', () => {
    render(<AiConsentDialog request={{ text: 'Un rêve', task: 'writing' }} config={{}} onAnswer={vi.fn()} t={tFor('fr')} />);

    expect(screen.getByRole('dialog', { name: "Envoyer ceci à l'IA ?" })).toHaveTextContent(
      'Il part chez OpenRouter, pour le modèle que Thoughty utilise par défaut.',
    );
    expect(screen.getByRole('button', { name: 'Envoyer' })).toBeInTheDocument();
  });
});

describe('useAiConsentController', () => {
  it('resolves a request with the answer, a request replaced with no, and one left open on unmount with no', async () => {
    const { result, unmount } = renderHook(() => useAiConsentController());

    let first!: Promise<boolean>;
    act(() => {
      first = result.current.requestConsent(request);
    });
    expect(result.current.request).toBe(request);

    let second!: Promise<boolean>;
    act(() => {
      second = result.current.requestConsent({ ...request, text: 'Another' });
    });
    await expect(first).resolves.toBe(false);

    act(() => result.current.answer(true));
    await expect(second).resolves.toBe(true);
    expect(result.current.request).toBeNull();

    let third!: Promise<boolean>;
    act(() => {
      third = result.current.requestConsent(request);
    });
    unmount();
    await expect(third).resolves.toBe(false);
  });
});
