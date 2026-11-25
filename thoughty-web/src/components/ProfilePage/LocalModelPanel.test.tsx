import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { readLocalModelSettings, writeLocalModelSettings } from '../../services/localModel/localModelSettings';
import { translations } from '../../utils/translations';
import { fillTranslationParams } from '../../utils/translationParams';
import LocalModelPanel from './LocalModelPanel';

vi.mock('../../contexts/AuthContext', () => ({ useAuth: () => ({ user: { id: 7 } }) }));

const en = translations.en as Record<string, string>;
const t = (key: string, params?: Record<string, string | number>) => fillTranslationParams(en[key] ?? key, params);
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status });

const renderPanel = () => render(<LocalModelPanel theme="dark" t={t} />);
const fill = (label: string, value: string) => fireEvent.change(screen.getByLabelText(label), { target: { value } });

beforeEach(() => localStorage.clear());
afterEach(() => vi.unstubAllGlobals());

describe('LocalModelPanel', () => {
  it('saves the writer’s own model server in this browser, and removes it', () => {
    renderPanel();
    expect(screen.getByRole('region', { name: 'Your own model' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Remove' })).not.toBeInTheDocument();

    fill('Server address', 'http://localhost:11434/v1/');
    fill('Model', ' llama3.2 ');
    fill('API key (optional)', 'secret');
    fireEvent.click(screen.getByRole('button', { name: 'Save model server' }));

    expect(screen.getByText('Saved in this browser.')).toBeInTheDocument();
    expect(screen.getByLabelText('Server address')).toHaveValue('http://localhost:11434/v1');
    expect(readLocalModelSettings(7)).toEqual({ baseUrl: 'http://localhost:11434/v1', model: 'llama3.2', apiKey: 'secret' });

    fireEvent.click(screen.getByRole('button', { name: 'Remove' }));
    expect(screen.getByText('Removed from this browser.')).toBeInTheDocument();
    expect(readLocalModelSettings(7)).toBeNull();
    expect(screen.getByLabelText('Model')).toHaveValue('');
  });

  it('shows what is saved, and refuses plain http to another device or a missing model', () => {
    writeLocalModelSettings(7, { baseUrl: 'http://127.0.0.1:1234/v1', model: 'qwen', apiKey: '' });
    renderPanel();
    expect(screen.getByLabelText('Server address')).toHaveValue('http://127.0.0.1:1234/v1');
    expect(screen.getByLabelText('Model')).toHaveValue('qwen');

    fill('Server address', 'http://192.168.1.4:11434/v1');
    fireEvent.click(screen.getByRole('button', { name: 'Save model server' }));
    expect(screen.getByText(/Plain http only works for a server on this device/)).toBeInTheDocument();
    expect(readLocalModelSettings(7)?.baseUrl).toBe('http://127.0.0.1:1234/v1');

    fill('Server address', 'not an address');
    fireEvent.click(screen.getByRole('button', { name: 'Test connection' }));
    expect(screen.getByText(/Enter a web address starting with http/)).toBeInTheDocument();

    fill('Server address', 'http://localhost:11434/v1');
    fill('Model', '');
    fireEvent.click(screen.getByRole('button', { name: 'Save model server' }));
    expect(screen.getByText('Enter the name of the model to use.')).toBeInTheDocument();
    expect(readLocalModelSettings(7)?.model).toBe('qwen');
  });

  it('tests the connection the way the AI actions call the server', async () => {
    const fetchMock = vi.fn().mockResolvedValue(json({ data: [{ id: 'llama3.2:latest' }] }));
    vi.stubGlobal('fetch', fetchMock);
    renderPanel();
    fill('Server address', 'http://localhost:11434/v1');
    fill('Model', 'llama3.2');
    fireEvent.click(screen.getByRole('button', { name: 'Test connection' }));

    expect(await screen.findByText('Connected: llama3.2 is ready on your server.')).toBeInTheDocument();
    expect(fetchMock).toHaveBeenCalledWith('http://localhost:11434/v1/models', expect.objectContaining({ credentials: 'omit' }));
  });

  it('saves and tests a server elsewhere behind https, with its key', async () => {
    const fetchMock = vi.fn().mockResolvedValue(json({ data: [{ id: 'qwen2.5' }] }));
    vi.stubGlobal('fetch', fetchMock);
    renderPanel();
    fill('Server address', 'https://models.home.example/v1/');
    fill('Model', 'qwen2.5');
    fill('API key (optional)', 'sk-home');
    fireEvent.click(screen.getByRole('button', { name: 'Test connection' }));

    expect(await screen.findByText('Connected: qwen2.5 is ready on your server.')).toBeInTheDocument();
    expect(fetchMock).toHaveBeenCalledWith('https://models.home.example/v1/models', expect.objectContaining({
      credentials: 'omit',
      redirect: 'error',
      headers: { Authorization: 'Bearer sk-home' },
    }));
    fireEvent.click(screen.getByRole('button', { name: 'Save model server' }));
    expect(readLocalModelSettings(7)).toEqual({ baseUrl: 'https://models.home.example/v1', model: 'qwen2.5', apiKey: 'sk-home' });
  });

  it('says how to allow this site when the server answers without allowing it, and lists the models it has', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValueOnce(new TypeError('Failed to fetch')).mockResolvedValueOnce(new Response(null)));
    renderPanel();
    fill('Server address', 'http://localhost:11434/v1');
    fill('Model', 'llama3.2');
    fireEvent.click(screen.getByRole('button', { name: 'Test connection' }));

    expect(await screen.findByText(/set OLLAMA_ORIGINS to it/)).toBeInTheDocument();
    expect(screen.getByText(`This site’s address to allow: ${globalThis.location.origin}`)).toBeInTheDocument();

    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(json({ data: [{ id: 'mistral' }, { id: 'phi3' }] })));
    fireEvent.click(screen.getByRole('button', { name: 'Test connection' }));
    expect(await screen.findByText('Models on your server: mistral, phi3')).toBeInTheDocument();
    expect(screen.getByText(/does not have this model/)).toBeInTheDocument();
  });

  it('says when the browser cannot keep the settings', () => {
    const setItem = vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('blocked');
    });
    renderPanel();
    fill('Server address', 'http://localhost:11434/v1');
    fill('Model', 'llama3.2');
    fireEvent.click(screen.getByRole('button', { name: 'Save model server' }));
    expect(screen.getByText(/could not keep these settings/)).toBeInTheDocument();
    setItem.mockRestore();
  });
});
