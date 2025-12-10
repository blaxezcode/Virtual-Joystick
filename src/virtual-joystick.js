/**
 * VirtualJoystick - A customizable virtual joystick for web applications
 * Author: @blaxezcode
 * Version: 2.0.0
 * Date: 2025-03-13
 * Description: A customizable virtual joystick component for web applications.
 *
 * Features:
 * - Dynamic or static positioning
 * - Customizable appearance and themes
 * - Multiple control schemes (x/y axis locking, boundaries)
 * - Zone detection with haptic feedback
 * - Responsive design with auto-scaling
 * - Multi-touch support
 * - Event handling for touch and mouse inputs
 */
class VirtualJoystick {
  /**
   * Create a new virtual joystick
   * @param {HTMLElement} container - The container element for the joystick
   * @param {Object} options - Configuration options
   */
  constructor(container, options = {}) {
    if (!container || !(container instanceof HTMLElement)) {
      throw new Error(
        "VirtualJoystick requires a valid HTML element as container"
      );
    }

    this.container = container;
    this.options = {
      width: 100,
      height: 100,
      color: "gray",
      handleColor: "white",
      handleRadius: 20,
      onChange: null,
      onStart: null,
      onEnd: null,
      sensitivity: 1,
      boundaries: false,
      autoCenter: true,
      deadzone: 0.1,
      shape: "circle",
      mode: "static", // 'static' or 'dynamic'
      lockAxis: null, // null, 'x', or 'y'
      zones: [],
      vibration: true,
      theme: {
        base: {
          background: "rgba(128, 128, 128, 0.5)",
          border: "3px solid rgba(0, 0, 0, 0.8)",
          shadow: "0 0 10px rgba(0, 0, 0, 0.3)",
        },
        handle: {
          background: "rgba(255, 255, 255, 0.9)",
          border: "2px solid rgba(0, 0, 0, 0.8)",
          shadow: "0 0 5px rgba(0, 0, 0, 0.5)",
        },
      },
      keyboardEmulation: {
        enabled: false,
        map: {
          up: "ArrowUp",
          down: "ArrowDown",
          left: "ArrowLeft",
          right: "ArrowRight",
        },
      },
      maxMoveRadius: null, // New option: Optional visual constraint radius (if null, uses (size/2 - handleRadius))
      ...options,
    };

    // Legacy support for color and handleColor
    if (options.color && !options.theme) {
      this.options.theme.base.background = options.color;
    }
    if (options.handleColor && !options.theme) {
      this.options.theme.handle.background = options.handleColor;
    }

    this.initializeProperties();
    this.createElements();
    this.setupJoystick();
    this.setupEventListeners();
    this.startAnimationLoop();
  }

  /**
   * Predefined themes for the joystick
   */
  static get THEMES() {
    return {
      light: {
        base: {
          background: "rgba(240, 240, 240, 0.8)",
          border: "1px solid rgba(200, 200, 200, 0.5)",
          shadow: "0 4px 6px rgba(0, 0, 0, 0.1)",
        },
        handle: {
          background: "#ffffff",
          border: "1px solid rgba(200, 200, 200, 0.5)",
          shadow: "0 2px 4px rgba(0, 0, 0, 0.1)",
        },
      },
      dark: {
        base: {
          background: "rgba(30, 30, 30, 0.8)",
          border: "1px solid rgba(60, 60, 60, 0.5)",
          shadow: "0 4px 6px rgba(0, 0, 0, 0.3)",
        },
        handle: {
          background: "#424242",
          border: "1px solid rgba(60, 60, 60, 0.5)",
          shadow: "0 2px 4px rgba(0, 0, 0, 0.2)",
        },
      },
      cyberpunk: {
        base: {
          background: "rgba(20, 10, 30, 0.8)",
          border: "2px solid #00ffea",
          shadow: "0 0 15px #00ffea",
        },
        handle: {
          background: "#ff0055",
          border: "2px solid #ff0055",
          shadow: "0 0 10px #ff0055",
        },
      },
    };
  }

  /**
   * Initialize internal properties
   * @private
   */
  initializeProperties() {
    this.position = { x: 0, y: 0 };
    this.delta = { x: 0, y: 0 };
    this.angle = 0;
    this.distance = 0;
    this.isPressed = false;
    this.touchId = null;
    this.initialPosition = { x: 0, y: 0 };
    this.currentZone = null;
    this.maxRadius = this.options.width / 2;
    this.requestId = null;
    this.activeKeys = new Set();
    this._handleResizeBound = this._handleResize.bind(this);
  }

  /**
   * Create DOM elements for the joystick
   * @private
   */
  createElements() {
    this.joystick = document.createElement("div");
    this.joystick.className = "virtual-joystick";

    this.base = document.createElement("div");
    this.base.className = "joystick-base";

    this.handle = document.createElement("div");
    this.handle.className = "joystick-handle";

    this.zones = new Map();

    if (this.options.zones && this.options.zones.length) {
      this.createZones();
    }
  }

  /**
   * Create zone indicators
   * @private
   */
  createZones() {
    this.options.zones.forEach((zone) => {
      if (
        !zone.id ||
        typeof zone.min !== "number" ||
        typeof zone.max !== "number"
      ) {
        console.warn("Invalid zone configuration", zone);
        return;
      }

      const zoneElement = document.createElement("div");
      zoneElement.className = "joystick-zone";

      const min = Math.min(1, Math.max(0, zone.min));
      const max = Math.min(1, Math.max(0, zone.max));
      const minRadius = min * this.maxRadius;
      const maxRadius = max * this.maxRadius;

      zoneElement.style.cssText = `
                position: absolute;
                border: 2px dashed ${zone.color || "rgba(255, 255, 255, 0.3)"};
                border-radius: 50%;
                pointer-events: none;
                top: 50%;
                left: 50%;
                width: ${maxRadius * 2}px;
                height: ${maxRadius * 2}px;
                transform: translate(-50%, -50%);
            `;

      if (min > 0) {
        const innerZone = document.createElement("div");
        innerZone.className = "joystick-zone-inner";
        innerZone.style.cssText = `
                    position: absolute;
                    border: 2px dashed ${
                      zone.color || "rgba(255, 255, 255, 0.3)"
                    };
                    border-radius: 50%;
                    pointer-events: none;
                    top: 50%;
                    left: 50%;
                    width: ${minRadius * 2}px;
                    height: ${minRadius * 2}px;
                    transform: translate(-50%, -50%);
                `;
        zoneElement.appendChild(innerZone);
      }

      this.zones.set(zone.id, {
        element: zoneElement,
        config: zone,
      });
      this.joystick.appendChild(zoneElement);
    });
  }

  /**
   * Set up the joystick appearance
   * @private
   */
  setupJoystick() {
    const { width, height, theme, shape } = this.options;

    this.joystick.style.cssText = `
            width: ${width}px;
            height: ${height}px;
            position: relative;
            touch-action: none;
            user-select: none;
        `;

    this.base.style.cssText = `
            width: 100%;
            height: 100%;
            border-radius: ${shape === "circle" ? "50%" : "10px"};
            background: ${theme.base.background};
            border: ${theme.base.border};
            box-shadow: ${theme.base.shadow};
            position: absolute;
            top: 0;
            left: 0;
        `;

    this.setupHandle();
    this.joystick.appendChild(this.base);
    this.joystick.appendChild(this.handle);
    this.container.appendChild(this.joystick);
    this.joystickRect = this.joystick.getBoundingClientRect();

    // Calculate max radius: use custom limit if provided, otherwise default to physical bounds
    const physicalLimit =
      Math.min(width, height) / 2 - this.options.handleRadius;
    this.maxRadius = this.options.maxMoveRadius
      ? Math.min(this.options.maxMoveRadius, physicalLimit)
      : physicalLimit;
  }

  /**
   * Set up the joystick handle
   * @private
   */
  setupHandle() {
    const { handleRadius, theme } = this.options;

    this.handle.style.cssText = `
            width: ${handleRadius * 2}px;
            height: ${handleRadius * 2}px;
            border-radius: 50%;
            background: ${theme.handle.background};
            border: ${theme.handle.border};
            box-shadow: ${theme.handle.shadow};
            position: absolute;
            touch-action: none;
            transition: transform 0.1s ease-out;
            cursor: grab;
            will-change: transform;
            transform: translate(-50%, -50%);
            top: 50%;
            left: 50%;
            z-index: 10;
        `;
  }

  /**
   * Set up event listeners
   * @private
   */
  setupEventListeners() {
    // For static mode, listen to events on the joystick base
    const targetElement =
      this.options.mode === "static" ? this.joystick : this.handle;

    // Use passive: false for touch events to allow preventDefault()
    targetElement.addEventListener(
      "mousedown",
      this.handleMouseDown.bind(this)
    );
    targetElement.addEventListener(
      "touchstart",
      this.handleTouchStart.bind(this),
      { passive: false }
    );

    document.addEventListener("mousemove", this.handleMouseMove.bind(this));
    document.addEventListener("touchmove", this.handleTouchMove.bind(this), {
      passive: false,
    });
    document.addEventListener("mouseup", this.handleMouseUp.bind(this));
    document.addEventListener("touchend", this.handleTouchEnd.bind(this));
    document.addEventListener("touchcancel", this.handleTouchEnd.bind(this));

    window.addEventListener("resize", this._handleResizeBound);
    window.addEventListener("orientationchange", this._handleResizeBound);
  }

  /**
   * Handle mouse down event
   * @param {MouseEvent} event - The mouse event
   * @private
   */
  handleMouseDown(event) {
    event.preventDefault();

    // Recalculate rect in case of scroll/resize
    this.joystickRect = this.joystick.getBoundingClientRect();

    if (this.options.mode === "dynamic") {
      const rect = this.container.getBoundingClientRect();
      const x = event.clientX - rect.left;
      const y = event.clientY - rect.top;

      this.joystick.style.position = "absolute";
      this.joystick.style.left = `${x - this.options.width / 2}px`;
      this.joystick.style.top = `${y - this.options.height / 2}px`;
      this.joystickRect = this.joystick.getBoundingClientRect();
    }

    this.isPressed = true;
    this.handle.style.cursor = "grabbing";
    this.updatePosition(event.clientX, event.clientY);

    if (typeof this.options.onStart === "function") {
      this.options.onStart({
        position: this.position,
        delta: this.delta,
        angle: this.angle,
        distance: this.distance,
      });
    }
  }

  /**
   * Handle mouse move event
   * @param {MouseEvent} event - The mouse event
   * @private
   */
  handleMouseMove(event) {
    if (this.isPressed) {
      event.preventDefault();
      this.updatePosition(event.clientX, event.clientY);
    }
  }

  /**
   * Handle mouse up event
   * @param {MouseEvent} event - The mouse event
   * @private
   */
  handleMouseUp(event) {
    if (this.isPressed) {
      event.preventDefault();
      this.isPressed = false;
      this.handle.style.cursor = "grab";

      if (this.options.autoCenter) {
        this.resetPosition();
      }

      if (typeof this.options.onEnd === "function") {
        this.options.onEnd({
          position: this.position,
          delta: this.delta,
          angle: this.angle,
          distance: this.distance,
        });
      }
    }
  }

  /**
   * Handle touch start event
   * @param {TouchEvent} event - The touch event
   * @private
   */
  handleTouchStart(event) {
    event.preventDefault();

    // Recalculate rect in case of scroll/resize
    this.joystickRect = this.joystick.getBoundingClientRect();

    if (this.touchId === null) {
      const touch = event.changedTouches[0];
      this.touchId = touch.identifier;

      if (this.options.mode === "dynamic") {
        const rect = this.container.getBoundingClientRect();
        const x = touch.clientX - rect.left;
        const y = touch.clientY - rect.top;

        this.joystick.style.position = "absolute";
        this.joystick.style.left = `${x - this.options.width / 2}px`;
        this.joystick.style.top = `${y - this.options.height / 2}px`;
        this.joystickRect = this.joystick.getBoundingClientRect();
      }

      this.isPressed = true;
      this.updatePosition(touch.clientX, touch.clientY);

      if (typeof this.options.onStart === "function") {
        this.options.onStart({
          position: this.position,
          delta: this.delta,
          angle: this.angle,
          distance: this.distance,
        });
      }
    }
  }

  /**
   * Handle touch move event
   * @param {TouchEvent} event - The touch event
   * @private
   */
  handleTouchMove(event) {
    if (this.isPressed) {
      event.preventDefault();

      for (let i = 0; i < event.changedTouches.length; i++) {
        const touch = event.changedTouches[i];
        if (touch.identifier === this.touchId) {
          this.updatePosition(touch.clientX, touch.clientY);
          break;
        }
      }
    }
  }

  /**
   * Handle touch end event
   * @param {TouchEvent} event - The touch event
   * @private
   */
  handleTouchEnd(event) {
    for (let i = 0; i < event.changedTouches.length; i++) {
      if (event.changedTouches[i].identifier === this.touchId) {
        this.touchId = null;
        this.isPressed = false;

        if (this.options.autoCenter) {
          this.resetPosition();
        }

        if (typeof this.options.onEnd === "function") {
          this.options.onEnd({
            position: this.position,
            delta: this.delta,
            angle: this.angle,
            distance: this.distance,
          });
        }
        break;
      }
    }
  }

  /**
   * Update the joystick position based on input coordinates
   * @param {number} clientX - The x coordinate
   * @param {number} clientY - The y coordinate
   * @private
   */
  updatePosition(clientX, clientY) {
    const { sensitivity, boundaries, lockAxis, deadzone } = this.options;
    const centerX = this.joystickRect.left + this.joystickRect.width / 2;
    const centerY = this.joystickRect.top + this.joystickRect.height / 2;

    let dx = (clientX - centerX) * sensitivity;
    let dy = (clientY - centerY) * sensitivity;

    if (lockAxis === "x") dy = 0;
    if (lockAxis === "y") dx = 0;

    const distance = Math.sqrt(dx * dx + dy * dy);
    let normalizedDistance = distance / this.maxRadius;
    this.angle = Math.atan2(dy, dx);

    // Apply boundaries if enabled
    if (boundaries && distance > this.maxRadius) {
      dx = Math.cos(this.angle) * this.maxRadius;
      dy = Math.sin(this.angle) * this.maxRadius;
      normalizedDistance = 1;
    }

    // Apply deadzone
    if (normalizedDistance < deadzone) {
      dx = 0;
      dy = 0;
      normalizedDistance = 0;
    }

    this.position = { x: dx, y: dy };
    this.delta = {
      x: dx / this.maxRadius,
      y: dy / this.maxRadius,
    };
    this.distance = normalizedDistance;

    // Calculate normalized values between -1 and 1
    const nx =
      Math.abs(normalizedDistance) < deadzone ? 0 : dx / this.maxRadius;
    const ny =
      Math.abs(normalizedDistance) < deadzone ? 0 : dy / this.maxRadius;

    // Ensure we don't exceed boundaries
    this.delta = {
      x: Math.max(-1, Math.min(1, nx)),
      y: Math.max(-1, Math.min(1, ny)),
    };

    // Update handle position using transform for better performance
    this.handle.style.transform = `translate(calc(-50% + ${dx}px), calc(-50% + ${dy}px))`;

    this.checkZones();
    this.updateKeyboard();
    this.emitChange();
  }

  /**
   * Check if the joystick is in any defined zones
   * @private
   */
  checkZones() {
    if (!this.options.zones || !this.options.zones.length) return;

    const distance = Math.sqrt(this.delta.x ** 2 + this.delta.y ** 2);
    let newZone = null;

    for (const [id, zone] of this.zones) {
      if (distance >= zone.config.min && distance <= zone.config.max) {
        newZone = id;
        break;
      }
    }

    if (this.currentZone !== newZone) {
      this.currentZone = newZone;
      if (newZone && this.options.vibration && navigator.vibrate) {
        try {
          navigator.vibrate(50);
        } catch (e) {
          // Vibration API not supported or permission denied
        }
      }
    }
  }

  /**
   * Emit change event with current joystick state
   * @private
   */
  emitChange() {
    if (typeof this.options.onChange === "function") {
      this.options.onChange({
        position: this.position,
        delta: this.delta,
        angle: this.angle,
        distance: this.distance,
        zone: this.currentZone,
        isPressed: this.isPressed,
        vector: this.delta, // Normalized vector
      });
    }
  }

  /**
   * Handle resize events
   * @private
   */
  _handleResize() {
    this.joystickRect = this.joystick.getBoundingClientRect();
    this.maxRadius =
      Math.min(this.joystickRect.width, this.joystickRect.height) / 2 -
      this.options.handleRadius;

    if (this.isPressed) {
      if (this.touchId !== null) {
        // Find the active touch
        const touches = document.createTouchList?.() || [];
        for (let i = 0; i < touches?.length || 0; i++) {
          if (touches[i].identifier === this.touchId) {
            this.updatePosition(touches[i].clientX, touches[i].clientY);
            break;
          }
        }
      }
    } else if (this.options.autoCenter) {
      this.resetPosition();
    }

    this.refreshJoystick();
  }

  /**
   * Start the animation loop for continuous updates
   * @private
   */
  startAnimationLoop() {
    const animate = () => {
      if (this.isPressed) {
        this.emitChange();
      }
      this.requestId = requestAnimationFrame(animate);
    };
    this.requestId = requestAnimationFrame(animate);
  }

  /**
   * Reset the joystick to center position
   * @public
   */
  resetPosition() {
    this.position = { x: 0, y: 0 };
    this.delta = { x: 0, y: 0 };
    this.angle = 0;
    this.distance = 0;
    this.currentZone = null;

    this.handle.style.transform = "translate(-50%, -50%)";

    this.updateKeyboard(); // Ensure keyboard state is reset
    this.emitChange();
  }

  /**
   * Refresh the joystick appearance
   * @public
   */
  refreshJoystick() {
    const containerRect = this.container.getBoundingClientRect();

    // Only resize if we're in responsive mode
    if (this.options.responsive !== false) {
      const scale = Math.min(
        containerRect.width / this.options.width,
        containerRect.height / this.options.height
      );

      const newWidth = this.options.width * scale;
      const newHeight = this.options.height * scale;

      this.joystick.style.width = `${newWidth}px`;
      this.joystick.style.height = `${newHeight}px`;

      const handleSize = this.options.handleRadius * 2 * scale;
      this.handle.style.width = `${handleSize}px`;
      this.handle.style.height = `${handleSize}px`;
    }

    // Update rects after resize
    this.joystickRect = this.joystick.getBoundingClientRect();

    const physicalLimit =
      Math.min(this.joystickRect.width, this.joystickRect.height) / 2 -
      this.options.handleRadius;
    this.maxRadius = this.options.maxMoveRadius
      ? Math.min(this.options.maxMoveRadius, physicalLimit)
      : physicalLimit;

    // Update zone sizes
    this.options.zones?.forEach((zone) => {
      const zoneObj = this.zones.get(zone.id);
      if (zoneObj) {
        const min = Math.min(1, Math.max(0, zone.min));
        const max = Math.min(1, Math.max(0, zone.max));
        const minRadius = min * this.maxRadius;
        const maxRadius = max * this.maxRadius;

        zoneObj.element.style.width = `${maxRadius * 2}px`;
        zoneObj.element.style.height = `${maxRadius * 2}px`;

        const innerZone = zoneObj.element.querySelector(".joystick-zone-inner");
        if (innerZone) {
          innerZone.style.width = `${minRadius * 2}px`;
          innerZone.style.height = `${minRadius * 2}px`;
        }
      }
    });
  }

  /**
   * Set a new option value
   * @param {string} option - The option name
   * @param {*} value - The new value
   * @public
   */
  setOption(option, value) {
    if (option in this.options) {
      this.options[option] = value;

      // Handle special cases
      if (option === "theme") {
        this.base.style.background = value.base.background;
        this.base.style.border = value.base.border;
        this.base.style.boxShadow = value.base.shadow;

        this.handle.style.background = value.handle.background;
        this.handle.style.border = value.handle.border;
        this.handle.style.boxShadow = value.handle.shadow;
      } else if (option === "handleRadius") {
        this.handle.style.width = `${value * 2}px`;
        this.handle.style.height = `${value * 2}px`;
        this.maxRadius =
          Math.min(this.joystickRect.width, this.joystickRect.height) / 2 -
          value;
      } else if (option === "shape") {
        this.base.style.borderRadius = value === "circle" ? "50%" : "10px";
      } else if (option === "zones") {
        // Clear existing zones
        this.zones.forEach((zone) => {
          this.joystick.removeChild(zone.element);
        });
        this.zones.clear();

        // Create new zones
        this.createZones();
      } else if (option === "color") {
        this.base.style.background = value;
        this.options.theme.base.background = value;
      } else if (option === "handleColor") {
        this.handle.style.background = value;
        this.options.theme.handle.background = value;
      } else if (option === "maxMoveRadius") {
        this.options.maxMoveRadius = value;
      }

      this.refreshJoystick();
    }
  }

  /**
   * Get the current joystick state
   * @returns {Object} The current state
   * @public
   */
  getState() {
    return {
      position: this.position,
      delta: this.delta,
      angle: this.angle,
      distance: this.distance,
      zone: this.currentZone,
      isPressed: this.isPressed,
    };
  }

  /**
   * Clean up and remove the joystick
   * @public
   */
  destroy() {
    if (this.container.contains(this.joystick)) {
      this.container.removeChild(this.joystick);
    }

    if (this.options.keyboardEmulation?.enabled) {
      this.activeKeys.forEach((key) => this.triggerKeyEvent(key, "keyup"));
      this.activeKeys.clear();
    }

    // Remove event listeners
    window.removeEventListener("resize", this._handleResizeBound);
    window.removeEventListener("orientationchange", this._handleResizeBound);

    // Cancel animation frame
    if (this.requestId) {
      cancelAnimationFrame(this.requestId);
      this.requestId = null;
    }
  }

  /**
   * Update keyboard emulation
   * @private
   */
  updateKeyboard() {
    if (!this.options.keyboardEmulation?.enabled) return;

    const { map } = this.options.keyboardEmulation;
    const { x, y } = this.delta;
    const threshold = 0.3; // threshold to trigger key
    const newKeys = new Set();

    if (y < -threshold) newKeys.add(map.up);
    if (y > threshold) newKeys.add(map.down);
    if (x < -threshold) newKeys.add(map.left);
    if (x > threshold) newKeys.add(map.right);

    // Diff
    this.activeKeys.forEach((key) => {
      if (!newKeys.has(key)) {
        this.triggerKeyEvent(key, "keyup");
      }
    });

    newKeys.forEach((key) => {
      if (!this.activeKeys.has(key)) {
        this.triggerKeyEvent(key, "keydown");
      }
    });

    this.activeKeys = newKeys;
  }

  /**
   * Trigger a keyboard event
   * @private
   */
  triggerKeyEvent(key, type) {
    if (!key) return;
    const event = new KeyboardEvent(type, {
      key: key,
      code: key,
      bubbles: true,
      cancelable: true,
    });
    window.dispatchEvent(event);
  }
}

export default VirtualJoystick;
