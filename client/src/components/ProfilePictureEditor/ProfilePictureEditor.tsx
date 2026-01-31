import React, { useState, useRef, useCallback, useEffect, TouchEvent, MouseEvent, ChangeEvent } from 'react';
import './ProfilePictureEditor.css';

interface Position {
    x: number;
    y: number;
}

interface ProfilePictureEditorProps {
    readonly isOpen: boolean;
    readonly onClose: () => void;
    readonly onSave: (dataUrl: string) => void;
    readonly t: (key: string) => string;
    readonly isDark?: boolean;
}

function ProfilePictureEditor({ isOpen, onClose, onSave, t, isDark }: ProfilePictureEditorProps): React.ReactElement | null {
    const [image, setImage] = useState<HTMLImageElement | null>(null);
    const [zoom, setZoom] = useState<number>(1);
    const [position, setPosition] = useState<Position>({ x: 0, y: 0 });
    const [isDragging, setIsDragging] = useState<boolean>(false);
    const [dragStart, setDragStart] = useState<Position>({ x: 0, y: 0 });
    const containerRef = useRef<HTMLButtonElement>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);

    const CANVAS_SIZE = 200;
    const MIN_ZOOM = 1;
    const MAX_ZOOM = 3;

    // Reset state when modal opens
    useEffect(() => {
        if (isOpen) {
            setImage(null);
            setZoom(1);
            setPosition({ x: 0, y: 0 });
        }
    }, [isOpen]);

    const handleFileSelect = (e: ChangeEvent<HTMLInputElement>): void => {
        const file = e.target.files?.[0];
        if (!file) return;

        if (!file.type.startsWith('image/')) {
            return;
        }

        if (file.size > 5 * 1024 * 1024) {
            return;
        }

        const reader = new FileReader();
        reader.onload = (event) => {
            const img = new Image();
            img.onload = () => {
                setImage(img);
                setZoom(1);
                setPosition({ x: 0, y: 0 });
            };
            img.src = event.target?.result as string;
        };
        reader.readAsDataURL(file);
    };

    const handleZoomChange = (e: ChangeEvent<HTMLInputElement>): void => {
        const newZoom = Number.parseFloat(e.target.value);
        setZoom(newZoom);
    };

    const handleMouseDown = (e: MouseEvent<HTMLButtonElement>): void => {
        if (!image) return;
        setIsDragging(true);
        setDragStart({
            x: e.clientX - position.x,
            y: e.clientY - position.y
        });
    };

    const handleMouseMove = useCallback((e: globalThis.MouseEvent): void => {
        if (!isDragging || !image) return;
        
        const newX = e.clientX - dragStart.x;
        const newY = e.clientY - dragStart.y;
        
        // Calculate bounds based on zoom
        const scaledSize = CANVAS_SIZE * zoom;
        const maxOffset = (scaledSize - CANVAS_SIZE) / 2;
        
        setPosition({
            x: Math.max(-maxOffset, Math.min(maxOffset, newX)),
            y: Math.max(-maxOffset, Math.min(maxOffset, newY))
        });
    }, [isDragging, dragStart, zoom, image]);

    const handleMouseUp = (): void => {
        setIsDragging(false);
    };

    // Touch handlers for mobile
    const handleTouchStart = (e: TouchEvent<HTMLButtonElement>): void => {
        if (!image) return;
        const touch = e.touches[0];
        if (!touch) return;
        setIsDragging(true);
        setDragStart({
            x: touch.clientX - position.x,
            y: touch.clientY - position.y
        });
    };

    const handleTouchMove = useCallback((e: globalThis.TouchEvent): void => {
        if (!isDragging || !image) return;
        e.preventDefault();
        
        const touch = e.touches[0];
        if (!touch) return;
        const newX = touch.clientX - dragStart.x;
        const newY = touch.clientY - dragStart.y;
        
        const scaledSize = CANVAS_SIZE * zoom;
        const maxOffset = (scaledSize - CANVAS_SIZE) / 2;
        
        setPosition({
            x: Math.max(-maxOffset, Math.min(maxOffset, newX)),
            y: Math.max(-maxOffset, Math.min(maxOffset, newY))
        });
    }, [isDragging, dragStart, zoom, image]);

    const handleTouchEnd = (): void => {
        setIsDragging(false);
    };

    useEffect(() => {
        if (isDragging) {
            globalThis.addEventListener('mousemove', handleMouseMove);
            globalThis.addEventListener('mouseup', handleMouseUp);
            globalThis.addEventListener('touchmove', handleTouchMove, { passive: false });
            globalThis.addEventListener('touchend', handleTouchEnd);
        }
        return () => {
            globalThis.removeEventListener('mousemove', handleMouseMove);
            globalThis.removeEventListener('mouseup', handleMouseUp);
            globalThis.removeEventListener('touchmove', handleTouchMove);
            globalThis.removeEventListener('touchend', handleTouchEnd);
        };
    }, [isDragging, handleMouseMove, handleTouchMove]);

    const handleSave = (): void => {
        if (!image) return;

        const canvas = document.createElement('canvas');
        canvas.width = CANVAS_SIZE;
        canvas.height = CANVAS_SIZE;
        const ctx = canvas.getContext('2d');
        if (!ctx) return;

        // Create circular clip
        ctx.beginPath();
        ctx.arc(CANVAS_SIZE / 2, CANVAS_SIZE / 2, CANVAS_SIZE / 2, 0, Math.PI * 2);
        ctx.closePath();
        ctx.clip();

        // Calculate the display size of the image in the preview
        const containerSize = CANVAS_SIZE;
        const imgAspect = image.width / image.height;
        
        let displayWidth: number, displayHeight: number;
        if (imgAspect > 1) {
            displayHeight = containerSize;
            displayWidth = containerSize * imgAspect;
        } else {
            displayWidth = containerSize;
            displayHeight = containerSize / imgAspect;
        }

        // Apply zoom
        displayWidth *= zoom;
        displayHeight *= zoom;

        // Calculate position (centered by default, then offset by position)
        const drawX = (containerSize - displayWidth) / 2 + position.x;
        const drawY = (containerSize - displayHeight) / 2 + position.y;

        // Draw the image
        ctx.drawImage(
            image,
            0, 0, image.width, image.height,
            drawX, drawY, displayWidth, displayHeight
        );

        // Convert to base64
        const dataUrl = canvas.toDataURL('image/jpeg', 0.9);
        onSave(dataUrl);
        onClose();
    };

    if (!isOpen) return null;

    return (
        <dialog
            className="ppe-overlay"
            open
            onClick={(event) => {
                if (event.target === event.currentTarget) {
                    onClose();
                }
            }}
            onCancel={(event) => {
                event.preventDefault();
                onClose();
            }}
            aria-labelledby="ppe-title"
        >
            <div className={`ppe-modal ${isDark ? 'dark' : 'light'}`}>
                <div className="ppe-header">
                    <h3 id="ppe-title">{t('editProfilePicture')}</h3>
                    <button className="ppe-close-btn" onClick={onClose} aria-label={t('close')}>
                        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                        </svg>
                    </button>
                </div>

                <div className="ppe-content">
                    {image ? (
                        <div className="ppe-editor">
                            <button
                                type="button"
                                ref={containerRef}
                                className="ppe-preview-container"
                                onMouseDown={handleMouseDown}
                                onTouchStart={handleTouchStart}
                                aria-label={t('changeProfilePicture')}
                            >
                                <div 
                                    className="ppe-image-wrapper"
                                    style={{
                                        transform: `translate(${position.x}px, ${position.y}px) scale(${zoom})`
                                    }}
                                >
                                    <img src={image.src} alt="Preview" draggable={false} />
                                </div>
                                <div className="ppe-circle-mask" />
                            </button>

                            <div className="ppe-controls">
                                <label className="ppe-zoom-label" htmlFor="zoom-slider">
                                    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0zM10 7v3m0 0v3m0-3h3m-3 0H7" />
                                    </svg>
                                    <span className="sr-only">Zoom</span>
                                </label>
                                <input
                                    id="zoom-slider"
                                    type="range"
                                    min={MIN_ZOOM}
                                    max={MAX_ZOOM}
                                    step={0.1}
                                    value={zoom}
                                    onChange={handleZoomChange}
                                    className="ppe-zoom-slider"
                                    aria-label="Zoom"
                                />
                                <span className="ppe-zoom-value" aria-live="polite">{Math.round(zoom * 100)}%</span>
                            </div>

                            <button 
                                className="ppe-change-image-btn"
                                onClick={() => fileInputRef.current?.click()}
                            >
                                {t('changeImage')}
                            </button>
                        </div>
                    ) : (
                        <button 
                            type="button"
                            className="ppe-upload-area" 
                            onClick={() => fileInputRef.current?.click()}
                        >
                            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                            </svg>
                            <span>{t('clickToUpload')}</span>
                            <span className="ppe-upload-hint">{t('maxFileSize')}</span>
                        </button>
                    )}

                    <input
                        ref={fileInputRef}
                        type="file"
                        accept="image/*"
                        onChange={handleFileSelect}
                        className="ppe-file-input"
                    />
                </div>

                <div className="ppe-footer">
                    <button className="ppe-cancel-btn" onClick={onClose}>
                        {t('cancel')}
                    </button>
                    <button 
                        className="ppe-save-btn" 
                        onClick={handleSave}
                        disabled={!image}
                    >
                        {t('save')}
                    </button>
                </div>
            </div>
        </dialog>
    );
}

export default ProfilePictureEditor;
