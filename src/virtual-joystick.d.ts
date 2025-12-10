export interface JoystickPosition {
    x: number;
    y: number;
}

export interface JoystickState {
    position: JoystickPosition;
    delta: JoystickPosition;
    angle: number;
    distance: number;
    zone: string | null;
    isPressed: boolean;
    vector?: JoystickPosition; // Normalized vector (-1 to 1)
}

export interface JoystickZone {
    id: string;
    min: number;
    max: number;
    color?: string;
}

export interface JoystickTheme {
    base: {
        background?: string;
        border?: string;
        shadow?: string;
    };
    handle: {
        background?: string;
        border?: string;
        shadow?: string;
    };
}

export interface JoystickOptions {
    width?: number;
    height?: number;
    color?: string;
    handleColor?: string;
    handleRadius?: number;
    maxMoveRadius?: number | null;
    sensitivity?: number;
    deadzone?: number;
    boundaries?: boolean;
    autoCenter?: boolean;
    shape?: 'circle' | 'square';
    mode?: 'static' | 'dynamic';
    lockAxis?: 'x' | 'y' | null;
    zones?: JoystickZone[];
    vibration?: boolean;
    theme?: JoystickTheme;
    onChange?: (state: JoystickState) => void;
    onStart?: (state: JoystickState) => void;
    onEnd?: (state: JoystickState) => void;
    keyboardEmulation?: {
        enabled: boolean;
        map?: {
            up?: string;
            down?: string;
            left?: string;
            right?: string;
        };
    };
}

export default class VirtualJoystick {
    static get THEMES(): { [key: string]: JoystickTheme };
    constructor(container: HTMLElement, options?: JoystickOptions);
    destroy(): void;
    setOption(option: string, value: any): void;
    getState(): JoystickState;
    resetPosition(): void;
    refreshJoystick(): void;
}
