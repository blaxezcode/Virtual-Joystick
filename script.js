/*
SCRIPT FOR THE VIRTUAL JOYSTICK DEMO
AUTHOR: blaxezcode
version: 4.0.0
*/

import VirtualJoystick from "./src/virtual-joystick.js";
import { Game } from "./src/game.js";

console.log("Joystec Script Initialized");

let joystick;
let game;
let zoneCount = 0;

function isDemoPage() {
  return window.location.pathname.endsWith("demo.html");
}

function initializeGame() {
  const canvas = document.getElementById("game-canvas");
  if (canvas) {
    game = new Game("game-canvas");
    game.start();
    console.log("Game started");
  }
}

function initializeJoystick(options) {
  const container = document.getElementById("joystick-container");
  if (!container) return;

  console.log("Initializing Joystick with options:", options);

  // Clear the container first
  container.innerHTML = "";

  if (joystick) joystick.destroy();

  // FORCE STATIC MODE for Landing Page visibility if not explicitly set
  // This ensures the user sees something immediately.
  // We check if we are on demo page or not.
  if (!isDemoPage() && !options.mode) {
    options.mode = "static";
    console.log("Forcing 'static' mode for non-demo page.");
  }

  // Create the joystick with the container element
  joystick = new VirtualJoystick(container, {
    ...options,
    onChange: (data) => {
      updateJoystickValues(data);
      if (game) {
        // Pass normalized delta to game
        game.updateinput(data.delta);
      }
    },
  });

  // Ensure the container is visible and sized
  container.style.display = "block";
  container.style.position = "absolute"; // FIX: Must be absolute to overlay the canvas
  container.style.zIndex = "100"; // FIX: Ensure it is on top
  container.style.width = `${options.width}px`;
  container.style.height = `${options.height}px`;
}

function addZone() {
  zoneCount++;
  const zoneId = `zone-${zoneCount}`;
  const zoneSettings = document.getElementById("zone-settings");
  if (!zoneSettings) return;

  const zoneSetting = document.createElement("div");
  zoneSetting.className = "zone-setting";
  zoneSetting.id = `${zoneId}-setting`;

  zoneSetting.innerHTML = `
        <div class="zone-header">
            <h4>Zone ${zoneCount}</h4>
            <button class="btn-icon zone-remove-btn" data-zone-id="${zoneId}">
                <i class="fas fa-times"></i>
            </button>
        </div>
        <div class="control-row">
            <input type="color" id="${zoneId}-color" value="#000000">
            <div class="range-inputs">
                <input type="number" id="${zoneId}-min" value="0.2" min="0" max="1" step="0.05" placeholder="Min">
                <span>-</span>
                <input type="number" id="${zoneId}-max" value="0.5" min="0" max="1" step="0.05" placeholder="Max">
            </div>
        </div>
    `;

  zoneSettings.appendChild(zoneSetting);
  attachZoneEventListeners(zoneSetting);
  updateJoystickFromPanel();
}

function attachZoneEventListeners(zoneSetting) {
  zoneSetting.querySelectorAll("input").forEach((input) => {
    input.addEventListener("change", updateJoystickFromPanel);
  });
  const removeBtn = zoneSetting.querySelector(".zone-remove-btn");
  if (removeBtn) {
    removeBtn.addEventListener("click", () =>
      removeZone(removeBtn.getAttribute("data-zone-id"))
    );
  }
}

function removeZone(zoneId) {
  const zoneSetting = document.getElementById(`${zoneId}-setting`);
  if (zoneSetting) {
    zoneSetting.remove();
    updateJoystickFromPanel();
  }
}

function getZonesFromPanel() {
  const zones = [];
  document.querySelectorAll(".zone-setting").forEach((zoneSetting) => {
    const zoneId = zoneSetting.id.replace("-setting", "");
    const colorInput = document.getElementById(`${zoneId}-color`);
    const minInput = document.getElementById(`${zoneId}-min`);
    const maxInput = document.getElementById(`${zoneId}-max`);

    if (colorInput && minInput && maxInput) {
      zones.push({
        id: zoneId,
        color: colorInput.value,
        min: parseFloat(minInput.value),
        max: parseFloat(maxInput.value),
      });
    }
  });
  return zones;
}

function updateJoystickFromPanel() {
  // Safe getter with fallback to defaults if element missing
  const getVal = (id, type = "string", fallback) => {
    const el = document.getElementById(id);
    if (!el) return fallback;
    return type === "number" ? parseFloat(el.value) : el.value;
  };
  const getCheck = (id, fallback = false) => {
    const el = document.getElementById(id);
    return el ? el.checked : fallback;
  };

  // Determine if we need to recreate the joystick (for heavy changes like mode)
  // or if we can just update options (for smooth real-time updates).
  const currentMode = joystick ? joystick.options.mode : null;
  const newMode = getVal("mode", "string", "static");

  const options = {
    width: getVal("width", "number", 150),
    height: getVal("height", "number", 150),
    handleRadius: getVal("handleRadius", "number", 35),
    maxMoveRadius: getVal("maxMoveRadius", "number", null) || null, // Allow null for default
    color: getVal("color", "string", "white"),
    handleColor: getVal("handleColor", "string", "black"),
    sensitivity: getVal("sensitivity", "number", 1),
    deadzone: getVal("deadzone", "number", 0.1),
    boundaries: getCheck("boundaries", true),
    autoCenter: getCheck("autoCenter", true),
    shape: getVal("shape", "string", "circle"),
    mode: newMode,
    lockAxis: getVal("lockAxis", "string", null) || null,
    vibration: getCheck("vibration", true),
    zones: getZonesFromPanel(),
  };

  if (joystick && currentMode === newMode) {
    // Update container size FIRST so refreshJoystick sees correct bounds
    const container = document.getElementById("joystick-container");
    if (container) {
      container.style.width = `${options.width}px`;
      container.style.height = `${options.height}px`;
    }

    // Smooth update: Only set options that have changed
    Object.keys(options).forEach((key) => {
      // Simple JSON stringify comparison works well for primitives and the zones array
      if (
        JSON.stringify(joystick.options[key]) !== JSON.stringify(options[key])
      ) {
        joystick.setOption(key, options[key]);
      }
    });
  } else {
    // Full recreation needed (first load or mode change)
    initializeJoystick(options);
  }
}

function updateJoystickValues(data) {
  // Update stats in demo.html header if it exists
  const setVal = (id, val) => {
    const el = document.getElementById(id);
    if (el) el.textContent = val;
  };

  setVal("positionX", data.position.x.toFixed(2));
  setVal("positionY", data.position.y.toFixed(2));

  // Update overlay stats in index.html
  const statX = document.getElementById("stat-x");
  const statY = document.getElementById("stat-y");
  if (statX) statX.textContent = data.delta.x.toFixed(2);
  if (statY) statY.textContent = data.delta.y.toFixed(2);

  setVal("deltaX", data.delta.x.toFixed(2));
  setVal("deltaY", data.delta.y.toFixed(2));
  setVal("angle", (data.angle * (180 / Math.PI)).toFixed(2));
  setVal("distance", data.distance.toFixed(2));
  setVal("currentZone", data.zone || "None");
}

// UI Interaction Setup
function setupInteractions() {
  // Setup interactions if on demo page OR if controls exist
  if (!isDemoPage() && !document.getElementById("width-slider")) return;

  // Sliders syncing
  const linkSlider = (sliderId, inputId) => {
    const slider = document.getElementById(sliderId);
    const input = document.getElementById(inputId);
    if (slider && input) {
      slider.addEventListener("input", () => {
        input.value = slider.value;
        updateJoystickFromPanel();
      });
      input.addEventListener("change", () => {
        slider.value = input.value;
        updateJoystickFromPanel();
      });
    }
  };

  linkSlider("width-slider", "width");
  // FIX: Also link width slider to height for square/circle aspect ratio
  const widthSlider = document.getElementById("width-slider");
  const heightInput = document.getElementById("height");
  if (widthSlider && heightInput) {
    widthSlider.addEventListener("input", () => {
      heightInput.value = widthSlider.value;
      updateJoystickFromPanel();
    });
  }

  linkSlider("handleRadius-slider", "handleRadius");
  linkSlider("maxMoveRadius-slider", "maxMoveRadius"); // New slider setup
  linkSlider("sensitivity-slider", "sensitivity");
  linkSlider("deadzone-slider", "deadzone");

  // Color Pickers
  const linkColor = (pickerId, textId) => {
    const picker = document.getElementById(pickerId);
    const text = document.getElementById(textId);
    if (picker && text) {
      picker.addEventListener("input", () => {
        text.value = picker.value;
        updateJoystickFromPanel();
      });
      text.addEventListener("input", () => {
        picker.value = text.value;
        updateJoystickFromPanel();
      });
    }
  };

  linkColor("color", "color-text");
  linkColor("handleColor", "handleColor-text");

  // Selects and Checkboxes
  document.querySelectorAll('select, input[type="checkbox"]').forEach((el) => {
    el.addEventListener("change", updateJoystickFromPanel);
  });

  // Buttons
  const addZoneBtn = document.getElementById("addZone");
  if (addZoneBtn) addZoneBtn.addEventListener("click", addZone);

  const saveBtn = document.getElementById("save-config");
  if (saveBtn) saveBtn.addEventListener("click", saveConfiguration);

  const resetBtn = document.getElementById("reset-config");
  if (resetBtn) resetBtn.addEventListener("click", resetConfiguration);

  // Sidebar Toggle
  const sidebarToggle = document.getElementById("sidebar-toggle");
  const sidebar = document.querySelector(".floating-sidebar");

  if (sidebarToggle && sidebar) {
    sidebarToggle.addEventListener("click", () => {
      sidebar.classList.toggle("active");
      sidebarToggle.classList.toggle("active");

      const isOpen = sidebar.classList.contains("active");
      if (game) game.setPause(isOpen);
    });
  }
}

function saveConfiguration() {
  showToast("Configuration Saved");
}

function resetConfiguration() {
  localStorage.removeItem("joystickConfig");
  loadDefaultConfiguration();
  showToast("Reset to Defaults");
}

function loadDefaultConfiguration() {
  const defaultConfig = {
    width: 100,
    height: 100,
    handleRadius: 25,
    color: "#f0f0f0", // Paper Grey
    handleColor: "#000000", // Ink Black
    sensitivity: 1,
    deadzone: 0.1,
    boundaries: true,
    autoCenter: true,
    shape: "circle",
    mode: "static", // Default to static so it's visible!
    lockAxis: "",
    vibration: true,
    zones: [],
  };
  applyConfiguration(defaultConfig);
}

function applyConfiguration(config) {
  // Only proceed if joystick container exists
  if (!document.getElementById("joystick-container")) return;

  // Helper to set values
  const setVal = (id, val) => {
    const el = document.getElementById(id);
    const sl = document.getElementById(id + "-slider");
    if (el) el.value = val;
    if (sl) sl.value = val;
  };

  setVal("width", config.width);
  setVal("height", config.height);
  setVal("handleRadius", config.handleRadius);
  setVal("sensitivity", config.sensitivity);
  setVal("deadzone", config.deadzone);

  if (document.getElementById("color"))
    document.getElementById("color").value = config.color;
  if (document.getElementById("color-text"))
    document.getElementById("color-text").value = config.color;
  if (document.getElementById("handleColor"))
    document.getElementById("handleColor").value = config.handleColor;
  if (document.getElementById("handleColor-text"))
    document.getElementById("handleColor-text").value = config.handleColor;

  if (document.getElementById("boundaries"))
    document.getElementById("boundaries").checked = config.boundaries;
  if (document.getElementById("autoCenter"))
    document.getElementById("autoCenter").checked = config.autoCenter;
  if (document.getElementById("vibration"))
    document.getElementById("vibration").checked = config.vibration;

  if (document.getElementById("shape"))
    document.getElementById("shape").value = config.shape;
  if (document.getElementById("mode"))
    document.getElementById("mode").value = config.mode;
  if (document.getElementById("lockAxis"))
    document.getElementById("lockAxis").value = config.lockAxis || "";

  updateJoystickFromPanel();
}

// Initial Load
document.addEventListener("DOMContentLoaded", () => {
  // Check if we are on a page that needs the game/joystick (index or demo)
  if (document.getElementById("game-canvas")) {
    initializeGame();
    // We only load default config if no saved one? Or just force default for demo?
    // Let's force default for consistency
    loadDefaultConfiguration();

    // Setup interactions if controls exist
    if (isDemoPage() || document.getElementById("width-slider")) {
      setupInteractions();
    }
  }
});

function showToast(message) {
  // Simple toast
  const container = document.getElementById("toast-container");
  if (!container) return;
  const toast = document.createElement("div");
  toast.className = "toast";
  toast.textContent = message;
  container.appendChild(toast);
  setTimeout(() => {
    toast.classList.add("show");
    setTimeout(() => {
      toast.classList.remove("show");
      setTimeout(() => toast.remove(), 300);
    }, 3000);
  }, 10);
}

// Expose copy function globally
window.copyCode = function (button) {
  const pre = button.nextElementSibling; // The pre tag is next to the button
  if (pre) {
    const code = pre.textContent;
    navigator.clipboard
      .writeText(code)
      .then(() => {
        button.classList.add("copied");
        const icon = button.querySelector("i");
        icon.className = "fas fa-check";

        setTimeout(() => {
          button.classList.remove("copied");
          icon.className = "fas fa-copy";
        }, 2000);
      })
      .catch((err) => {
        console.error("Failed to copy text: ", err);
      });
  }
};
