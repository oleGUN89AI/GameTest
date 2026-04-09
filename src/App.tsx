import React, { useEffect, useRef, useState } from 'react';
import { Upload, Play, RotateCcw, Pause } from 'lucide-react';

type Star = { x: number; y: number; speed: number; size: number; alpha: number };
type Enemy = { x: number; y: number; width: number; height: number; speed: number; active: boolean; hp: number };
type Particle = { x: number; y: number; vx: number; vy: number; life: number; maxLife: number; color: string; size: number };
type FloatingText = { x: number; y: number; text: string; life: number; maxLife: number };

type GameState = {
  player: { x: number; y: number; width: number; height: number };
  enemies: Enemy[];
  particles: Particle[];
  stars: Star[];
  floatingTexts: FloatingText[];
  score: number;
  gameOver: boolean;
  frameCount: number;
  screenShake: number;
  isPaused: boolean;
};

export default function App() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [showIntro, setShowIntro] = useState(true);
  const [userInteracted, setUserInteracted] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [score, setScore] = useState(0);
  const [gameOver, setGameOver] = useState(false);
  const playerImgRef = useRef<HTMLImageElement | null>(null);
  const thujaImgRef = useRef<HTMLImageElement | null>(null);
  const introAudioRef = useRef<HTMLAudioElement | null>(null);
  const bgAudioRef = useRef<HTMLAudioElement | null>(null);

  const gameState = useRef<GameState>({
    player: { x: 0, y: 0, width: 128, height: 128 },
    enemies: [],
    particles: [],
    stars: [],
    floatingTexts: [],
    score: 0,
    gameOver: false,
    frameCount: 0,
    screenShake: 0,
    isPaused: false,
  });

  useEffect(() => {
    const pImg = new Image();
    pImg.src = '/player.png';
    pImg.onload = () => {
      playerImgRef.current = pImg;
    };

    const tImg = new Image();
    tImg.src = '/thuja.png';
    tImg.onload = () => {
      thujaImgRef.current = tImg;
    };

    introAudioRef.current = new Audio('/V_Tyju.mp3');
    bgAudioRef.current = new Audio('/Alex_BG.mp3');
    bgAudioRef.current.loop = true;
  }, []);

  useEffect(() => {
    if (showIntro && userInteracted && introAudioRef.current) {
      introAudioRef.current.currentTime = 0;
      introAudioRef.current.play().catch(e => console.log("Intro audio play failed:", e));
      
      const handleEnded = () => {
        setShowIntro(false);
        startGame();
      };
      introAudioRef.current.addEventListener('ended', handleEnded);
      return () => {
        introAudioRef.current?.removeEventListener('ended', handleEnded);
      };
    }
  }, [showIntro, userInteracted]);

  useEffect(() => {
    if (isPlaying && !isPaused && !gameOver && !showIntro) {
      bgAudioRef.current?.play().catch(e => console.log("BG Audio play failed:", e));
    } else {
      bgAudioRef.current?.pause();
    }
  }, [isPlaying, isPaused, gameOver, showIntro]);

  const playIntro = () => {
    setIsPlaying(false);
    setGameOver(false);
    setShowIntro(true);
  };

  const skipIntro = () => {
    if (introAudioRef.current) {
      introAudioRef.current.pause();
    }
    setShowIntro(false);
    startGame();
  };

  const startGame = () => {
    if (bgAudioRef.current) {
      bgAudioRef.current.currentTime = 0;
    }
    const canvas = canvasRef.current;
    const startX = canvas ? canvas.width / 2 : window.innerWidth / 2;
    const startY = canvas ? canvas.height - 100 : window.innerHeight - 100;

    gameState.current = {
      player: { x: startX, y: startY, width: 128, height: 128 },
      enemies: [],
      particles: [],
      stars: gameState.current.stars, // Keep existing stars
      floatingTexts: [],
      score: 0,
      gameOver: false,
      frameCount: 0,
      screenShake: 0,
      isPaused: false,
    };
    setScore(0);
    setIsPaused(false);
    setGameOver(false);
    setIsPlaying(true);
  };

  // Main Game Loop
  useEffect(() => {
    if (!isPlaying) return;

    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const resizeCanvas = () => {
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
      
      // Initialize stars if empty
      if (gameState.current.stars.length === 0) {
        for (let i = 0; i < 150; i++) {
          gameState.current.stars.push({
            x: Math.random() * canvas.width,
            y: Math.random() * canvas.height,
            speed: 0.2 + Math.random() * 1.5,
            size: Math.random() * 2.5,
            alpha: 0.1 + Math.random() * 0.8,
          });
        }
      }
    };
    window.addEventListener('resize', resizeCanvas);
    resizeCanvas();

    let animationFrameId: number;

    const createExplosion = (x: number, y: number, color: string, count: number) => {
      for (let i = 0; i < count; i++) {
        gameState.current.particles.push({
          x,
          y,
          vx: (Math.random() - 0.5) * 10,
          vy: (Math.random() - 0.5) * 10,
          life: 20 + Math.random() * 30,
          maxLife: 50,
          color,
          size: 2 + Math.random() * 4,
        });
      }
    };

    const update = () => {
      const state = gameState.current;
      if (state.gameOver || state.isPaused) return;

      state.frameCount++;

      // Spawn enemies (Thujas) - reduced amount
      const spawnRate = Math.max(0.005, 0.02 - state.frameCount / 100000); 
      if (Math.random() < spawnRate) {
        const size = 40 + Math.random() * 40;
        state.enemies.push({
          x: Math.random() * (canvas.width - size) + size / 2,
          y: -size,
          width: size,
          height: size,
          speed: 2 + Math.random() * 3 + Math.min(state.frameCount / 3000, 4),
          active: true,
          hp: size > 60 ? 2 : 1, // Bigger ones take 2 hits
        });
      }

      // Update enemies
      state.enemies.forEach(e => {
        e.y += e.speed;
        if (e.y > canvas.height + e.height) {
          e.active = false;
          // Game over if a thuja is missed
          state.gameOver = true;
          state.screenShake = 10;
          setGameOver(true);
        }
      });

      // Collisions
      state.enemies.forEach(e => {
        if (!e.active) return;

        // Player vs Enemy (Player catches/destroys the thuja)
        const hitBoxShrink = 25; // Adjusted for larger player
        if (
          state.player.x - state.player.width / 2 + hitBoxShrink < e.x + e.width / 2 &&
          state.player.x + state.player.width / 2 - hitBoxShrink > e.x - e.width / 2 &&
          state.player.y - state.player.height / 2 + hitBoxShrink < e.y + e.height / 2 &&
          state.player.y + state.player.height / 2 - hitBoxShrink > e.y - e.height / 2
        ) {
          e.active = false;
          state.score += 10;
          setScore(state.score);
          state.screenShake = 2;
          createExplosion(e.x, e.y, '#22c55e', 20); // Green explosion
          
          state.floatingTexts.push({
            x: e.x,
            y: e.y,
            text: '+10',
            life: 40,
            maxLife: 40
          });
        }
      });

      state.enemies = state.enemies.filter(e => e.active);

      // Update particles
      state.particles.forEach(p => {
        p.x += p.vx;
        p.y += p.vy;
        p.life--;
      });
      state.particles = state.particles.filter(p => p.life > 0);

      // Update floating texts
      state.floatingTexts.forEach(ft => {
        ft.y -= 1.5;
        ft.life--;
      });
      state.floatingTexts = state.floatingTexts.filter(ft => ft.life > 0);

      // Update stars
      state.stars.forEach(s => {
        s.y += s.speed;
        if (s.y > canvas.height) {
          s.y = 0;
          s.x = Math.random() * canvas.width;
        }
      });

      // Screen shake decay
      if (state.screenShake > 0) {
        state.screenShake *= 0.85;
        if (state.screenShake < 0.5) state.screenShake = 0;
      }
    };

    const draw = () => {
      const state = gameState.current;
      
      // Clear background
      ctx.fillStyle = '#f0f9ff'; // sky-50 (light background)
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      ctx.save();
      
      // Apply screen shake
      if (state.screenShake > 0) {
        const dx = (Math.random() - 0.5) * state.screenShake;
        const dy = (Math.random() - 0.5) * state.screenShake;
        ctx.translate(dx, dy);
      }

      // Draw background particles (clouds/wind)
      ctx.fillStyle = '#bae6fd'; // sky-200
      state.stars.forEach(s => {
        ctx.globalAlpha = s.alpha * 0.5;
        ctx.fillRect(s.x, s.y, s.size * 2, s.size * 2);
      });
      ctx.globalAlpha = 1.0;

      // Draw enemies (Thujas)
      state.enemies.forEach(e => {
        if (thujaImgRef.current) {
          ctx.drawImage(
            thujaImgRef.current,
            e.x - e.width / 2,
            e.y - e.height / 2,
            e.width,
            e.height
          );
        } else {
          // Trunk
          ctx.fillStyle = '#78350f'; // amber-900
          ctx.fillRect(e.x - e.width * 0.1, e.y + e.height * 0.1, e.width * 0.2, e.height * 0.4);

          // Leaves (3 layers)
          ctx.fillStyle = '#16a34a'; // green-600
          
          // Bottom layer
          ctx.beginPath();
          ctx.moveTo(e.x, e.y - e.height * 0.1);
          ctx.lineTo(e.x + e.width * 0.5, e.y + e.height * 0.3);
          ctx.lineTo(e.x - e.width * 0.5, e.y + e.height * 0.3);
          ctx.fill();
          
          // Middle layer
          ctx.beginPath();
          ctx.moveTo(e.x, e.y - e.height * 0.3);
          ctx.lineTo(e.x + e.width * 0.4, e.y + e.height * 0.1);
          ctx.lineTo(e.x - e.width * 0.4, e.y + e.height * 0.1);
          ctx.fill();
          
          // Top layer
          ctx.beginPath();
          ctx.moveTo(e.x, e.y - e.height * 0.5);
          ctx.lineTo(e.x + e.width * 0.3, e.y - e.height * 0.1);
          ctx.lineTo(e.x - e.width * 0.3, e.y - e.height * 0.1);
          ctx.fill();
        }
      });

      // Draw player
      if (!state.gameOver) {
        if (playerImgRef.current) {
          ctx.drawImage(
            playerImgRef.current,
            state.player.x - state.player.width / 2,
            state.player.y - state.player.height / 2,
            state.player.width,
            state.player.height
          );
        } else {
          // Default player ship shape
          ctx.fillStyle = '#3b82f6'; // blue-500
          ctx.beginPath();
          ctx.moveTo(state.player.x, state.player.y - state.player.height / 2);
          ctx.lineTo(state.player.x + state.player.width / 2, state.player.y + state.player.height / 2);
          ctx.lineTo(state.player.x, state.player.y + state.player.height * 0.2); // indent at bottom
          ctx.lineTo(state.player.x - state.player.width / 2, state.player.y + state.player.height / 2);
          ctx.closePath();
          ctx.fill();
          
          // Cockpit
          ctx.fillStyle = '#60a5fa'; // blue-400
          ctx.beginPath();
          ctx.ellipse(state.player.x, state.player.y, state.player.width * 0.15, state.player.height * 0.25, 0, 0, Math.PI * 2);
          ctx.fill();
        }
      }

      // Draw particles
      state.particles.forEach(p => {
        ctx.globalAlpha = p.life / p.maxLife;
        ctx.fillStyle = p.color;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
        ctx.fill();
      });
      ctx.globalAlpha = 1.0;

      // Draw floating texts
      state.floatingTexts.forEach(ft => {
        ctx.globalAlpha = ft.life / ft.maxLife;
        ctx.fillStyle = '#4ade80'; // green-400
        ctx.font = 'bold 24px system-ui, sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText(ft.text, ft.x, ft.y);
      });
      ctx.globalAlpha = 1.0;

      ctx.restore();
    };

    const loop = () => {
      update();
      draw();
      // Continue loop to render game over state and particles
      animationFrameId = requestAnimationFrame(loop);
    };

    animationFrameId = requestAnimationFrame(loop);

    return () => {
      window.removeEventListener('resize', resizeCanvas);
      cancelAnimationFrame(animationFrameId);
    };
  }, [isPlaying]);

  // Input Handling
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const handlePointerMove = (e: PointerEvent) => {
      if (!isPlaying || gameState.current.gameOver || gameState.current.isPaused) return;
      const rect = canvas.getBoundingClientRect();
      let x = e.clientX - rect.left;
      let y = e.clientY - rect.top;

      x = Math.max(gameState.current.player.width / 2, Math.min(canvas.width - gameState.current.player.width / 2, x));
      y = Math.max(gameState.current.player.height / 2, Math.min(canvas.height - gameState.current.player.height / 2, y));

      gameState.current.player.x = x;
      gameState.current.player.y = y;
    };

    const handlePointerDown = (e: PointerEvent) => {
      if (!isPlaying || gameState.current.gameOver || gameState.current.isPaused) return;
      handlePointerMove(e);
      canvas.setPointerCapture(e.pointerId);
    };

    const handlePointerUp = (e: PointerEvent) => {
      canvas.releasePointerCapture(e.pointerId);
    };

    canvas.addEventListener('pointermove', handlePointerMove);
    canvas.addEventListener('pointerdown', handlePointerDown);
    canvas.addEventListener('pointerup', handlePointerUp);
    canvas.addEventListener('pointercancel', handlePointerUp);

    return () => {
      canvas.removeEventListener('pointermove', handlePointerMove);
      canvas.removeEventListener('pointerdown', handlePointerDown);
      canvas.removeEventListener('pointerup', handlePointerUp);
      canvas.removeEventListener('pointercancel', handlePointerUp);
    };
  }, [isPlaying]);

  const togglePause = () => {
    setIsPaused(p => {
      const newPaused = !p;
      gameState.current.isPaused = newPaused;
      return newPaused;
    });
  };

  return (
    <div className="relative w-full h-screen bg-sky-50 overflow-hidden font-sans text-slate-800 select-none">
      {/* Intro Video / GIF */}
      {showIntro && (
        <div className="absolute inset-0 z-50 bg-black flex flex-col items-center justify-center">
          {!userInteracted ? (
            <button
              onClick={() => setUserInteracted(true)}
              className="px-12 py-6 bg-blue-500 hover:bg-blue-600 text-white rounded-full font-black text-3xl tracking-widest shadow-[0_0_40px_rgba(59,130,246,0.5)] transition-all transform hover:scale-105"
            >
              СТАРТ
            </button>
          ) : (
            <>
              <img
                src="/Alex.gif"
                alt="Intro"
                className="w-full h-full object-contain"
              />
              <button
                onClick={skipIntro}
                className="absolute bottom-10 px-8 py-3 bg-white/20 hover:bg-white/40 text-white rounded-full backdrop-blur-md transition-colors font-bold tracking-wider"
              >
                ПРОПУСТИТЬ
              </button>
            </>
          )}
        </div>
      )}

      <canvas
        ref={canvasRef}
        className="block w-full h-full touch-none"
        style={{ touchAction: 'none' }}
      />

      {/* HUD */}
      {isPlaying && !showIntro && (
        <>
          <div className="absolute top-6 left-6 z-10 pointer-events-none">
            <div className="text-3xl font-black text-slate-800 drop-shadow-sm tracking-wider">
              СЧЕТ: <span className="text-green-600">{score}</span>
            </div>
          </div>
          
          <div className="absolute top-6 right-6 z-10">
            <button 
              onClick={togglePause} 
              className="p-3 bg-white/50 hover:bg-white/80 rounded-full backdrop-blur-sm shadow-sm transition-all"
            >
              {isPaused ? <Play className="w-6 h-6 text-slate-800" /> : <Pause className="w-6 h-6 text-slate-800" />}
            </button>
          </div>
        </>
      )}

      {/* Pause Overlay */}
      {isPaused && !gameOver && (
        <div className="absolute inset-0 flex flex-col items-center justify-center bg-white/50 backdrop-blur-sm z-20">
          <h2 className="text-6xl font-black mb-6 text-slate-800 tracking-tighter text-center drop-shadow-sm">
            ПАУЗА
          </h2>
          <button
            onClick={togglePause}
            className="px-10 py-5 bg-blue-500 text-white hover:bg-blue-600 rounded-2xl font-bold text-xl shadow-lg shadow-blue-500/30 transition-all transform hover:scale-[1.05] active:scale-[0.95] flex items-center gap-3"
          >
            <Play className="w-6 h-6" />
            ПРОДОЛЖИТЬ
          </button>
        </div>
      )}

      {/* Game Over Overlay */}
      {gameOver && (
        <div className="absolute inset-0 flex flex-col items-center justify-center bg-white/80 backdrop-blur-md z-20">
          <h2 className="text-6xl md:text-8xl font-black mb-6 text-red-500 drop-shadow-sm tracking-tighter text-center">
            ТУЯ УПУЩЕНА!
          </h2>
          <div className="bg-slate-100 px-12 py-6 rounded-3xl border border-slate-200 mb-10 shadow-xl">
            <p className="text-2xl text-slate-500 text-center uppercase tracking-widest text-sm mb-2">Итоговый счет</p>
            <p className="text-6xl font-black text-slate-800 text-center">{score}</p>
          </div>
          
          <button
            onClick={playIntro}
            className="px-10 py-5 bg-blue-500 text-white hover:bg-blue-600 rounded-2xl font-bold text-xl shadow-lg shadow-blue-500/30 transition-all transform hover:scale-[1.05] active:scale-[0.95] flex items-center gap-3"
          >
            <RotateCcw className="w-6 h-6" />
            ИГРАТЬ СНОВА
          </button>
        </div>
      )}
    </div>
  );
}
