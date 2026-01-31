import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import ProfilePictureEditor from './ProfilePictureEditor';

const mockT = (key) => key;

describe('ProfilePictureEditor', () => {
    beforeEach(() => {
        globalThis.FileReader = class MockFileReader {
            readAsDataURL() {
                setTimeout(() => {
                    this.onload({ target: { result: 'data:image/png;base64,abc' } });
                }, 0);
            }
        };

        globalThis.Image = class MockImage {
            width = 200;
            height = 200;
            _src = '';
            set src(value) {
                this._src = value;
                if (this.onload) this.onload();
            }
            get src() {
                return this._src;
            }
        };

        vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue({
            beginPath: vi.fn(),
            arc: vi.fn(),
            closePath: vi.fn(),
            clip: vi.fn(),
            drawImage: vi.fn()
        });
        vi.spyOn(HTMLCanvasElement.prototype, 'toDataURL').mockReturnValue('data:image/jpeg;base64,xyz');
    });

    afterEach(() => {
        vi.restoreAllMocks();
    });

    it('renders nothing when closed', () => {
        render(
            <ProfilePictureEditor
                isOpen={false}
                onClose={vi.fn()}
                onSave={vi.fn()}
                t={mockT}
                isDark={false}
            />
        );
        expect(screen.queryByText('editProfilePicture')).not.toBeInTheDocument();
    });

    it('renders upload area when open', () => {
        render(
            <ProfilePictureEditor
                isOpen={true}
                onClose={vi.fn()}
                onSave={vi.fn()}
                t={mockT}
                isDark={false}
            />
        );
        expect(screen.getByText('clickToUpload')).toBeInTheDocument();
        expect(screen.getByText('maxFileSize')).toBeInTheDocument();
    });

    it('loads image and enables save', async () => {
        const onSave = vi.fn();
        const onClose = vi.fn();
        render(
            <ProfilePictureEditor
                isOpen={true}
                onClose={onClose}
                onSave={onSave}
                t={mockT}
                isDark={true}
            />
        );

        const input = document.querySelector('input[type="file"]');
        const file = new File(['img'], 'test.png', { type: 'image/png' });
        fireEvent.change(input, { target: { files: [file] } });

        await waitFor(() => {
            expect(screen.getByLabelText('Zoom')).toBeInTheDocument();
            expect(screen.getByText('save')).toBeEnabled();
        });

        fireEvent.click(screen.getByText('save'));
        expect(onSave).toHaveBeenCalledWith('data:image/jpeg;base64,xyz');
        expect(onClose).toHaveBeenCalled();
    });

    it('closes on overlay click', () => {
        const onClose = vi.fn();
        const { container } = render(
            <ProfilePictureEditor
                isOpen={true}
                onClose={onClose}
                onSave={vi.fn()}
                t={mockT}
                isDark={false}
            />
        );
        const overlay = container.querySelector('.ppe-overlay');
        fireEvent.click(overlay);
        expect(onClose).toHaveBeenCalled();
    });
});
