export class Game {
  constructor(canvasId) {
    this.canvas = document.getElementById(canvasId);
    this.gl = this.canvas.getContext("webgl");

    if (!this.gl) {
      alert("WebGL not supported");
      return;
    }

    // Game Constants
    this.GRID_SIZE = 32;
    this.LIMIT = this.GRID_SIZE / 2;
    this.TICK_RATE = 130;

    // Game State
    this.snake = [
      { x: 0, y: 0 },
      { x: -1, y: 0 },
      { x: -2, y: 0 },
    ];
    this.viewSnake = JSON.parse(JSON.stringify(this.snake));
    this.viewHead = { x: 0, y: 0, z: 0 };
    this.dir = { x: 0, y: -1 }; // Initial direction Up (in this grid space -y is up?) Let's verify.
    // Actually provided code says: dir = {x:0, y:-1} and ArrowUp sets nextDir = {x:0, y:-1}.
    // So y:-1 is Up.
    this.nextDir = { x: 0, y: -1 };
    this.food = { x: 4, y: -4 };
    this.score = 0;
    this.gameOver = false;
    this.lastTime = 0;
    this.moveTimer = 0;
    this.isPaused = false;

    // Shaders
    this.vsSource = `
      attribute vec2 position;
      void main() { gl_Position = vec4(position, 0.0, 1.0); }
    `;

    // ... (omitting shader string for brevity in this replace block, but need to be careful with context match)
    // Actually I will just insert methods and update loop separately or use multi-replace if possible.
    // Let's do it in chunks.

    // Chunk 1: Add isPaused to constructor
    // Chunk 2: Add methods
    // Chunk 3: Update Loop

    // Wait, I can only do one replace if I don't use multi_replace.
    // Let's use multi_replace.

    this.fsSource = `
      precision highp float;

      uniform vec2 u_resolution;
      uniform float u_time;
      uniform vec2 u_snake[60];
      uniform int u_snakeLen;
      uniform vec2 u_food;
      uniform vec3 u_camTarget;
      uniform vec2 u_arenaSize;

      // --- HIGH QUALITY SETTINGS ---
      #define MAX_STEPS 128
      #define MAX_DIST 80.0
      #define SURF_DIST 0.001
      #define AA 1 

      // Improved Box SDF
      float sdBox(vec3 p, vec3 b) {
          vec3 q = abs(p) - b;
          return length(max(q,0.0)) + min(max(q.x,max(q.y,q.z)),0.0);
      }
      
      // SDF for the Border Frame
      float sdBoxFrame( vec3 p, vec3 b, float e ) {
          vec3 p2 = abs(p)-b;
          vec3 q = abs(p2+e)-e;
          return min(min(
              length(max(vec3(p2.x,q.y,q.z),0.0))+min(max(p2.x,max(q.y,q.z)),0.0),
              length(max(vec3(q.x,p2.y,q.z),0.0))+min(max(q.x,max(p2.y,q.z)),0.0)),
              length(max(vec3(q.x,q.y,p2.z),0.0))+min(max(q.x,max(q.y,p2.z)),0.0));
      }

      // Smooth Min for Organic Blending
      float smin(float a, float b, float k) {
          float h = clamp(0.5+0.5*(b-a)/k, 0.0, 1.0);
          return mix(b, a, h) - k*h*(1.0-h);
      }

      // --- SCENE DISTANCE FUNCTION ---
      vec2 GetDist(vec3 p) {
          float d = MAX_DIST;
          float mat = 0.0;

          // 1. FLOOR (High Precision Grid)
          float dFloor = p.y; 
          vec2 grid = abs(fract(p.xz) - 0.5);
          float gMax = max(grid.x, grid.y);
          // Smoother groove for high quality
          float groove = smoothstep(0.48, 0.495, gMax); 
          dFloor -= groove * 0.015;
          d = dFloor;
          mat = 1.0;

          // 2. FOOD (Floating & Rotating)
          vec3 foodPos = vec3(u_food.x, 0.5 + sin(u_time*2.5)*0.15, u_food.y);
          vec3 pFood = p - foodPos;
          // Complex rotation for visual flair
          float ang = u_time * 1.5;
          float s = sin(ang), c = cos(ang);
          mat2 rot = mat2(c, -s, s, c);
          pFood.xz = rot * pFood.xz;
          pFood.xy = rot * pFood.xy;
          // Rounded box for food
          float dFood = sdBox(pFood, vec3(0.2)) - 0.05; 
          if(dFood < d) { d = dFood; mat = 2.0; }

          // 3. SNAKE (Bounding Box Optimized)
          float dSnake = MAX_DIST;
          vec2 diff = abs(p.xz - u_camTarget.xz);
          // Optimized Bounding Logic
          if (diff.x < 18.0 && diff.y < 18.0) { 
              for(int i=0; i<60; i++) {
                  if(i >= u_snakeLen) break;
                  vec3 segPos = vec3(u_snake[i].x, 0.4, u_snake[i].y);
                  
                  // Head is slightly larger
                  float rad = (i==0) ? 0.36 : 0.34;
                  if(i==0) segPos.y += 0.05;
                  
                  float dSeg = sdBox(p - segPos, vec3(rad)) - 0.06;
                  dSnake = smin(dSnake, dSeg, 0.18); // Smoother blending
              }
          }
          if(dSnake < d) { d = dSnake; mat = 3.0; }

          // 4. BORDER (Metallic Frame)
          float limit = u_arenaSize.x;
          // Thicker, more substantial border
          float dBorder = sdBoxFrame(p, vec3(limit + 0.6, 0.8, limit + 0.6), 0.25) - 0.02;
          if(dBorder < d) { d = dBorder; mat = 4.0; }

          return vec2(d, mat);
      }

      // --- HIGH QUALITY RAYMARCHER ---
      vec2 RayMarch(vec3 ro, vec3 rd) {
          float dO = 0.0;
          float mat = 0.0;
          for(int i=0; i<MAX_STEPS; i++) {
              vec3 p = ro + rd * dO;
              vec2 dS = GetDist(p);
              dO += dS.x;
              mat = dS.y;
              // Higher precision break condition
              if(abs(dS.x) < SURF_DIST || dO > MAX_DIST) break;
          }
          return vec2(dO, mat);
      }

      // --- CALCULATE NORMAL ---
      vec3 GetNormal(vec3 p) {
          float d = GetDist(p).x;
          vec2 e = vec2(0.002, 0); // Smaller epsilon for sharper normals
          vec3 n = d - vec3(
              GetDist(p-e.xyy).x,
              GetDist(p-e.yxy).x,
              GetDist(p-e.yyx).x);
          return normalize(n);
      }

      // --- SOFT SHADOWS (IMPROVED) ---
      float GetShadow(vec3 p, vec3 lightDir, float k) {
          float res = 1.0;
          float ph = 1e20;
          float t = 0.02; // Start closer
          for(int i=0; i<24; i++) { // More steps for smoother shadows
              float h = GetDist(p + lightDir*t).x;
              if(h < 0.001) return 0.0;
              float y = h*h/(2.0*ph);
              float d = sqrt(h*h-y*y);
              res = min(res, k*d/max(0.0, t-y));
              ph = h;
              t += clamp(h, 0.02, 0.2); // Slower steps for quality
              if(res < 0.05 || t > 10.0) break;
          }
          return clamp(res, 0.0, 1.0);
      }

      // --- AMBIENT OCCLUSION ---
      float GetAO(vec3 p, vec3 n) {
          float occ = 0.0;
          float sca = 1.0;
          for(int i=0; i<5; i++) {
              float h = 0.01 + 0.12*float(i)/4.0;
              float d = GetDist(p + h*n).x;
              occ += (h-d)*sca;
              sca *= 0.95;
          }
          return clamp(1.0 - 3.0*occ, 0.0, 1.0);
      }

      // --- PBR-LITE RENDERING ---
      vec3 RenderScene(vec3 ro, vec3 rd) {
          vec2 d = RayMarch(ro, rd);
          vec3 col = vec3(0.98, 0.98, 1.0); // Clean White/Blueish Tint Background
          
          if(d.x < MAX_DIST) {
              vec3 p = ro + rd * d.x;
              vec3 n = GetNormal(p);
              vec3 ref = reflect(rd, n);
              vec3 lightPos = vec3(8.0, 15.0, 5.0); // Adjusted light pos
              vec3 l = normalize(lightPos - p);
              vec3 v = -rd;
              
              // Lighting Components
              float dif = clamp(dot(n, l), 0.0, 1.0);
              float shadow = GetShadow(p + n*0.01, l, 12.0); // Sharper soft shadows
              float ao = GetAO(p, n);
              
              vec3 matCol = vec3(1.0);
              float roughness = 0.5;
              float metallic = 0.0;
              float specPower = 32.0;

              // --- MATERIALS ---
              if(d.y == 1.0) { // Floor
                  vec2 grid = floor(p.xz);
                  float checker = mod(grid.x + grid.y, 2.0);
                  // Clean architectural look
                  matCol = mix(vec3(0.92), vec3(0.88), checker); 
                  
                  // Grid lines
                  vec2 gv = fract(p.xz)-0.5;
                  if(max(abs(gv.x), abs(gv.y)) > 0.485) {
                    matCol = vec3(0.7); // Darker grey lines
                    metallic = 0.8; // Metallic lines
                  }
                  
                  // Arena bounds fade
                  float limit = u_arenaSize.x;
                  if(abs(p.x) > limit+0.5 || abs(p.z) > limit+0.5) matCol = vec3(0.95);
              } 
              else if(d.y == 2.0) { // Food
                  matCol = vec3(1.0, 0.25, 0.0); // Vivid Orange
                  metallic = 0.1;
                  roughness = 0.2;
                  specPower = 64.0;
              } 
              else if(d.y == 3.0) { // Snake
                  matCol = vec3(0.05); // Deep Black
                  metallic = 0.9; // Highly reflective
                  roughness = 0.1;
                  specPower = 128.0;
              } 
              else if(d.y == 4.0) { // Border
                  // Deep Black Metal
                  matCol = vec3(0.02); 
                  metallic = 1.0;
                  roughness = 0.3;
                  specPower = 256.0;
              }

              // --- LIGHTING CALCULATION ---
              vec3 H = normalize(l + v);
              float NdotH = max(dot(n, H), 0.0);
              float spec = pow(NdotH, specPower);
              
              // Fresnel
              float fresnel = pow(1.0 - max(dot(n, v), 0.0), 5.0);
              fresnel = mix(0.04, 1.0, fresnel * metallic);

              vec3 ambient = vec3(0.95, 0.98, 1.0) * 0.5 * ao;
              vec3 diffuse = matCol * dif * shadow;
              vec3 specular = vec3(1.0) * spec * shadow * metallic;
              
              col = ambient * matCol + diffuse + specular;

              // --- REALISTIC REFLECTIONS ---
              if(metallic > 0.1 || fresnel > 0.1) {
                  float refStrength = mix(0.0, 0.8, metallic) + fresnel;
                  
                  // Reflection Raymarch
                  vec3 roRef = p + n * 0.02;
                  vec2 dRef = RayMarch(roRef, ref);
                  
                  vec3 refCol = vec3(0.98, 0.98, 1.0); // Sky reflection
                  
                  if(dRef.x < MAX_DIST) {
                       // Sample material of reflected object (Simplifed for performance)
                       if(dRef.y == 4.0) refCol = vec3(0.02); // Border
                       else if(dRef.y == 2.0) refCol = vec3(1.0, 0.25, 0.0); // Food
                       else if(dRef.y == 3.0) refCol = vec3(0.05); // Snake
                       else refCol = vec3(0.9); // Floor
                  }
                  
                  col = mix(col, refCol, refStrength * 0.6); // Blend reflection
              }

              // Distance Fog for depth
              float fogDist = length(ro-p);
              col = mix(col, vec3(0.98, 0.98, 1.0), 1.0 - exp(-0.001 * fogDist * fogDist));

          } else {
              col = vec3(0.98, 0.98, 1.0); // Clean background
          }
          return col;
      }

      void main() {
          vec3 col = vec3(0.0);
          vec3 target = u_camTarget;
          vec3 offset = vec3(0.0, 16.0, 12.0); 
          vec3 ro = target + offset;
          vec3 lookAt = target + vec3(0.0, 0.0, -2.5);
          
          vec3 f = normalize(lookAt - ro);
          vec3 r = normalize(cross(vec3(0,1,0), f));
          vec3 u = cross(f, r);
          
          vec2 uv = (gl_FragCoord.xy - 0.5 * u_resolution.xy) / u_resolution.y;
          vec3 rd = normalize(f + uv.x*r + uv.y*u);
          
          col = RenderScene(ro, rd);
          
          // Cinematic Post-Processing
          // Vignette
          vec2 q = gl_FragCoord.xy / u_resolution.xy;
          col *= 0.5 + 0.5*pow(16.0*q.x*q.y*(1.0-q.x)*(1.0-q.y), 0.1); 
          
          // Gamma Correction
          col = pow(col, vec3(0.4545)); 
          
          gl_FragColor = vec4(col, 1.0);
      }
    `;

    // Initialize WebGL
    this.program = this.createProgram(this.vsSource, this.fsSource);
    this.gl.useProgram(this.program);

    // Geometry
    const posBuf = this.gl.createBuffer();
    this.gl.bindBuffer(this.gl.ARRAY_BUFFER, posBuf);
    this.gl.bufferData(
      this.gl.ARRAY_BUFFER,
      new Float32Array([-1, -1, 1, -1, -1, 1, -1, 1, 1, -1, 1, 1]),
      this.gl.STATIC_DRAW
    );
    const aPos = this.gl.getAttribLocation(this.program, "position");
    this.gl.enableVertexAttribArray(aPos);
    this.gl.vertexAttribPointer(aPos, 2, this.gl.FLOAT, false, 0, 0);

    // Uniforms
    this.uniforms = {
      uRes: this.gl.getUniformLocation(this.program, "u_resolution"),
      uTime: this.gl.getUniformLocation(this.program, "u_time"),
      uSnake: this.gl.getUniformLocation(this.program, "u_snake"),
      uSnakeLen: this.gl.getUniformLocation(this.program, "u_snakeLen"),
      uFood: this.gl.getUniformLocation(this.program, "u_food"),
      uCamTarget: this.gl.getUniformLocation(this.program, "u_camTarget"),
      uArenaSize: this.gl.getUniformLocation(this.program, "u_arenaSize"),
    };

    // Initialize logic
    this.placeFood();
    this.loop = this.loop.bind(this);
    this.resize();
    window.addEventListener("resize", () => this.resize());

    // Keyboard Input
    window.addEventListener("keydown", (e) => {
      if (this.gameOver || this.isPaused) return;
      const k = e.key.toLowerCase();
      const code = e.code;

      // Up (W or ArrowUp) - Move in -Y
      if ((code === "ArrowUp" || k === "w") && this.dir.y === 0) {
        this.nextDir = { x: 0, y: -1 };
      }
      // Down (S or ArrowDown) - Move in +Y
      if ((code === "ArrowDown" || k === "s") && this.dir.y === 0) {
        this.nextDir = { x: 0, y: 1 };
      }
      // Left (A or ArrowLeft) - Move in +X (Corrected for Camera)
      if ((code === "ArrowLeft" || k === "a") && this.dir.x === 0) {
        this.nextDir = { x: 1, y: 0 };
      }
      // Right (D or ArrowRight) - Move in -X (Corrected for Camera)
      if ((code === "ArrowRight" || k === "d") && this.dir.x === 0) {
        this.nextDir = { x: -1, y: 0 };
      }
    });

    // Bind reset to UI buttons if they exist
    // We delegate this to the start/init logic or assume the HTML has onclick
    // but better to bind here if we can find them.
    // The provided HTML uses onclick="resetGame()". We need to expose a global or bind it.
    // Let's bind 'click' on the game-over-screen button if it exists.
    const resetBtn = document.querySelector("#game-over-screen button");
    if (resetBtn) {
      resetBtn.addEventListener("click", () => this.resetGame());
    }
  }

  setPause(state) {
    this.isPaused = state;
  }

  createShader(type, src) {
    const s = this.gl.createShader(type);
    this.gl.shaderSource(s, src);
    this.gl.compileShader(s);
    if (!this.gl.getShaderParameter(s, this.gl.COMPILE_STATUS)) {
      console.error(this.gl.getShaderInfoLog(s));
      return null;
    }
    return s;
  }

  createProgram(vsSrc, fsSrc) {
    const p = this.gl.createProgram();
    this.gl.attachShader(p, this.createShader(this.gl.VERTEX_SHADER, vsSrc));
    this.gl.attachShader(p, this.createShader(this.gl.FRAGMENT_SHADER, fsSrc));
    this.gl.linkProgram(p);
    return p;
  }

  start() {
    if (!this.isRunning) {
      this.isRunning = true;
      this.loop(0);
    }
  }

  stop() {
    this.isRunning = false;
    this.isPaused = false;
    cancelAnimationFrame(this.gameLoopId);
  }

  resize() {
    const parent = this.canvas.parentElement;
    if (parent) {
      this.canvas.width = parent.clientWidth;
      this.canvas.height = parent.clientHeight;
      this.gl.viewport(0, 0, this.canvas.width, this.canvas.height);
    }
  }

  updateinput(data) {
    if (this.isPaused) return;

    // Joystick Input
    // joy.x, joy.y are -1 to 1 (normalized)
    // We map them to discrete Direction for Snake
    // Threshold to accidental inputs
    if (Math.abs(data.x) > 0.5) {
      const inputDir = data.x > 0 ? -1 : 1; // Inverted X for correct feeling
      // Right or Left
      if (this.dir.x === 0) {
        // Can change x if moving in y
        this.nextDir = { x: inputDir, y: 0 };
      }
    } else if (Math.abs(data.y) > 0.5) {
      const inputDir = data.y > 0 ? 1 : -1;
      // Down or Up
      if (this.dir.y === 0) {
        // Can change y if moving in x
        this.nextDir = { x: 0, y: inputDir };
      }
    }
  }

  resetGame() {
    this.snake = [
      { x: 0, y: 0 },
      { x: 0, y: 1 },
      { x: 0, y: 2 },
    ];
    this.viewSnake = JSON.parse(JSON.stringify(this.snake));
    this.viewHead = { x: 0, y: 0, z: 0 };
    this.dir = { x: 0, y: -1 };
    this.nextDir = { x: 0, y: -1 };
    this.score = 0;
    this.gameOver = false;

    const scoreDisplay = document.getElementById("score-display");
    if (scoreDisplay) scoreDisplay.innerText = "00";

    const gameOverScreen = document.getElementById("game-over-screen");
    if (gameOverScreen) gameOverScreen.style.display = "none";

    this.placeFood();
  }

  placeFood() {
    let valid = false;
    while (!valid) {
      this.food.x = Math.floor(Math.random() * this.GRID_SIZE) - this.LIMIT;
      this.food.y = Math.floor(Math.random() * this.GRID_SIZE) - this.LIMIT;
      valid = true;
      for (let s of this.snake) {
        if (s.x === this.food.x && s.y === this.food.y) valid = false;
      }
    }
  }

  loop(now) {
    if (!this.isRunning) return;

    const dt = now - this.lastTime;
    this.lastTime = now;

    if (!this.gameOver && !this.isPaused) {
      this.moveTimer += dt;
      if (this.moveTimer > this.TICK_RATE) {
        this.moveTimer = 0;
        this.dir = this.nextDir;
        const head = {
          x: this.snake[0].x + this.dir.x,
          y: this.snake[0].y + this.dir.y,
        };

        if (
          Math.abs(head.x) > this.LIMIT ||
          Math.abs(head.y) > this.LIMIT ||
          this.snake.some((s) => s.x === head.x && s.y === head.y)
        ) {
          this.gameOver = true;
          const gameOverScreen = document.getElementById("game-over-screen");
          if (gameOverScreen) {
            gameOverScreen.style.display = "block";
            const finalScore = document.getElementById("final-score");
            if (finalScore) finalScore.innerText = "SCORE: " + this.score;
          }
        } else {
          this.snake.unshift(head);
          if (head.x === this.food.x && head.y === this.food.y) {
            this.score++;
            const scoreDisplay = document.getElementById("score-display");
            if (scoreDisplay)
              scoreDisplay.innerText =
                this.score < 10 ? "0" + this.score : this.score;
            this.placeFood();
          } else {
            this.snake.pop();
          }
        }
      }
    }

    // Camera Smoothing
    const LERP_SPEED = 0.15;
    const CAM_SPEED = 0.08;

    if (this.viewSnake.length !== this.snake.length) {
      if (this.snake.length > this.viewSnake.length)
        this.viewSnake.push({ ...this.viewSnake[this.viewSnake.length - 1] });
      else this.viewSnake.pop();
    }

    const flatSnake = [];
    for (let i = 0; i < 60; i++) {
      if (i < this.snake.length) {
        this.viewSnake[i].x +=
          (this.snake[i].x - this.viewSnake[i].x) * LERP_SPEED;
        this.viewSnake[i].y +=
          (this.snake[i].y - this.viewSnake[i].y) * LERP_SPEED;
        flatSnake.push(this.viewSnake[i].x, this.viewSnake[i].y);
      } else {
        flatSnake.push(100.0, 100.0);
      }
    }

    this.viewHead.x += (this.viewSnake[0].x - this.viewHead.x) * CAM_SPEED;
    this.viewHead.y += (this.viewSnake[0].y - this.viewHead.y) * CAM_SPEED;

    this.gl.uniform2f(
      this.uniforms.uRes,
      this.canvas.width,
      this.canvas.height
    );
    this.gl.uniform1f(this.uniforms.uTime, now * 0.001);
    this.gl.uniform2fv(this.uniforms.uSnake, new Float32Array(flatSnake));
    this.gl.uniform1i(this.uniforms.uSnakeLen, this.snake.length);
    this.gl.uniform2f(this.uniforms.uFood, this.food.x, this.food.y);
    this.gl.uniform3f(
      this.uniforms.uCamTarget,
      this.viewHead.x,
      0.0,
      this.viewHead.y
    );
    this.gl.uniform2f(this.uniforms.uArenaSize, this.LIMIT, this.LIMIT);

    this.gl.drawArrays(this.gl.TRIANGLES, 0, 6);
    this.gameLoopId = requestAnimationFrame(this.loop);
  }
}
