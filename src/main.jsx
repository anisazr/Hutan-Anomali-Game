import React, { Suspense, useEffect, useMemo, useRef, useState } from "react";
import { createRoot } from "react-dom/client";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { Billboard, Environment, Html, OrbitControls, Stars, Text } from "@react-three/drei";
import { CuboidCollider, Physics, RigidBody } from "@react-three/rapier";
import * as THREE from "three";
import "./styles.css";

const ANOMALIES = [
  {
    id: 1,
    type: "tree",
    position: [-20, 0, 13],
    title: "Anomali Pohon Sawit",
    question: "Jika seluruh dunia berhenti menuntutmu menjadi apa pun selama satu hari saja, siapakah dirimu yang tersisa di balik semua tanggung jawab dan label itu?",
    clue: "usia sekarang membuat kaki sakit banget, karena sengan menginjak....kehidupan",
  },
  {
    id: 2,
    type: "rock",
    position: [18, 0.12, 8],
    title: "Anomali Batu",
    question: "Bagian mana dari dirimu yang saat ini paling butuh dimaafkan, dan apa yang akan berubah dalam hidupmu jika kamu berhenti menyalahkan dirimu atas hal itu?",
    clue: "cari hal yang beracun, tapi bukan mbg",
  },
  {
    id: 3,
    type: "mushroom",
    position: [26, 0, -18],
    title: "Anomali Jamur Beracun",
    question: "Hal apa yang paling sering kamu hindari untuk dibicarakan dengan dirimu sendiri karena takut merasa sakit, dan sampai kapan kamu akan membiarkan ketakutan itu mengatur keputusanmu?",
    clue: "cari tunggangan nya pak santa",
  },
  {
    id: 4,
    type: "deer",
    position: [-27, 0, -8],
    title: "Anomali Rusa Merah",
    question: "Apa yang sedang kamu coba buktikan kepada dunia, dan kepada siapa sebenarnya pembuktian itu kamu tujukan?",
    clue: "caritempat yang gen z mau tapi gak mampu beli",
  },
  {
    id: 5,
    type: "hut",
    position: [-15, 0, -24],
    title: "Anomali Gubuk",
    question: "Jika saat ini adalah saat terakhirmu, apakah kamu merasa sudah menjadi teman yang baik bagi dirimu sendiri, atau kamu justru menjadi orang asing yang paling keras menghakiminya?",
    clue: "Semua anomali sudah terbaca. Selesaikan ini untuk membuka kejutan.",
  },
];

const INITIAL_CLUE = "temukan pohon kesayangan pemerintah tapi membuat rakyat menangis.";
const ANSWER_STORAGE_KEY = "forest-anomaly-reflection-answers";
const WISH_STORAGE_KEY = "forest-anomaly-wishes";
const GRATITUDE_STORAGE_KEY = "forest-anomaly-gratitudes";
const SPECIAL_SOUND_TRACKS = [
  { id: "special-bidadari", label: "Sayangku Bidadari", src: "/audio/sayangku-bidadari.mp4" },
  { id: "special-spirit", label: "Smells Like Teen Spirit", src: "/audio/smells-like-teen-spirit.mp4" },
];
const SOUND_TRACKS = [
  { id: "forest-relax", label: "3 Min Timer music bird, relax music with nature sounds in the forest for work and study", src: "/audio/3-min-timer-music-bird-relax-music-with-nature-sounds-in-the-forest-for-work-and-study.mp4" },
  { id: "sampai-debu", label: "Bandaneira Sampai Jadi Debu (unofficial music video)", src: "/audio/bandaneira-sampai-jadi-debu-unofficial-music-video.mp3" },
  { id: "hero-awakens", label: "A Hero Awakens Epic Cinematic Background (No Copyright Music)", src: "/audio/a-hero-awakens-epic-cinematic-background-no-copyright-music.mp3" },
];
const AVATARS = {
  boy: [
    { id: "boy-blue", label: "Cowok 1", body: "#55c7ff", pants: "#253047", skin: "#ffd9b3", hair: "#121212" },
    { id: "boy-green", label: "Cowok 2", body: "#69d389", pants: "#29313f", skin: "#f1c7a4", hair: "#2a1711" },
    { id: "boy-red", label: "Cowok 3", body: "#ef6f6c", pants: "#1f2d38", skin: "#e9b88f", hair: "#111419" },
  ],
  girl: [
    { id: "girl-pink", label: "Cewek 1", body: "#ff8fc7", pants: "#38304a", skin: "#ffd9b3", hair: "#17100e" },
    { id: "girl-violet", label: "Cewek 2", body: "#a98cff", pants: "#26314d", skin: "#eec4a1", hair: "#3a2018" },
    { id: "girl-yellow", label: "Cewek 3", body: "#ffd166", pants: "#2f3d34", skin: "#f5c7a4", hair: "#151515" },
  ],
};

const tmpVector = new THREE.Vector3();
const tmpLookAt = new THREE.Vector3();
const CAMERA_MODES = ["third", "shiftLock", "first"];
const MOBILE_INPUT = { x: 0, z: 0, shift: false, space: false, tiltEnabled: false };

function canUseWebGL() {
  try {
    const canvas = document.createElement("canvas");
    return Boolean(canvas.getContext("webgl2") || canvas.getContext("webgl"));
  } catch {
    return false;
  }
}

class CanvasErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { crashed: false };
  }

  static getDerivedStateFromError() {
    return { crashed: true };
  }

  componentDidCatch(error) {
    console.error("3D renderer failed:", error);
  }

  render() {
    if (this.state.crashed) {
      return <RendererFallback />;
    }
    return this.props.children;
  }
}

function App() {
  const [isNight, setIsNight] = useState(true);
  const [solvedAnomalies, setSolvedAnomalies] = useState([]);
  const [activeAnomaly, setActiveAnomaly] = useState(null);
  const [activeClue, setActiveClue] = useState(INITIAL_CLUE);
  const [lastDirection, setLastDirection] = useState("Baca clue di layar, lalu tutup card untuk mulai mencari.");
  const [finale, setFinale] = useState(false);
  const [pendingFinale, setPendingFinale] = useState(false);
  const [finaleStep, setFinaleStep] = useState("wishes");
  const [wishes, setWishes] = useState(Array.from({ length: 6 }, () => ""));
  const [gratitudes, setGratitudes] = useState(Array.from({ length: 11 }, () => ""));
  const [codeInput, setCodeInput] = useState("");
  const [codeError, setCodeError] = useState("");
  const [candlesOut, setCandlesOut] = useState(false);
  const [loading, setLoading] = useState(true);
  const [gameStarted, setGameStarted] = useState(false);
  const [playerName, setPlayerName] = useState("Irfan");
  const [draftName, setDraftName] = useState("");
  const [avatarGender, setAvatarGender] = useState("boy");
  const [avatarId, setAvatarId] = useState("boy-blue");
  const [playerPosition, setPlayerPosition] = useState({ x: 0, z: 9 });
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [helpOpen, setHelpOpen] = useState(false);
  const [volume, setVolume] = useState(0.55);
  const [brightness, setBrightness] = useState(1);
  const [mouseSensitivity, setMouseSensitivity] = useState(1);
  const [showCompass, setShowCompass] = useState(true);
  const [soundPreset, setSoundPreset] = useState("forest-relax");
  const [specialSoundUnlocked, setSpecialSoundUnlocked] = useState(false);
  const [specialSoundOpen, setSpecialSoundOpen] = useState(false);
  const [specialSoundCode, setSpecialSoundCode] = useState("");
  const [specialSoundError, setSpecialSoundError] = useState("");
  const [soundPlaying, setSoundPlaying] = useState(false);
  const [cameraMode, setCameraMode] = useState("third");
  const [cameraZoom, setCameraZoom] = useState(0.62);
  const [webglSupported, setWebglSupported] = useState(true);
  const playerApi = useRef(null);
  const audio = useAudioManager();

  const effectiveCameraMode = cameraMode === "third" && cameraZoom <= 0.04 ? "first" : cameraMode;
  const selectedAvatar = [...AVATARS.boy, ...AVATARS.girl].find((avatar) => avatar.id === avatarId) || AVATARS.boy[0];
  const nextAnomaly = ANOMALIES.find((anomaly) => !solvedAnomalies.includes(anomaly.id));
  const cameraLabel = effectiveCameraMode === "third" ? "Third" : effectiveCameraMode === "shiftLock" ? "Shift" : "First";

  useEffect(() => {
    const timer = window.setTimeout(() => setLoading(false), 1600);
    setWebglSupported(canUseWebGL());
    return () => window.clearTimeout(timer);
  }, []);

  useEffect(() => {
    audio.setVolume(volume);
  }, [audio, volume]);

  function solveAnomaly(answer) {
    if (!activeAnomaly || !answer.trim()) return false;

    const record = {
      anomalyId: activeAnomaly.id,
      title: activeAnomaly.title,
      question: activeAnomaly.question,
      answer: answer.trim(),
      answeredAt: new Date().toISOString(),
    };

    try {
      const storedAnswers = JSON.parse(localStorage.getItem(ANSWER_STORAGE_KEY) || "[]");
      localStorage.setItem(ANSWER_STORAGE_KEY, JSON.stringify([...storedAnswers, record]));
    } catch {
      /* localStorage can be unavailable in some browser modes. */
    }

    const nextSolved = [...solvedAnomalies, activeAnomaly.id];
    setSolvedAnomalies(nextSolved);
    setLastDirection("Clue baru terbuka. Baca card di layar sebelum lanjut.");
    setActiveClue(activeAnomaly.clue);
    setActiveAnomaly(null);
    audio.playAchievement();
    if (nextSolved.length === ANOMALIES.length) {
      setPendingFinale(true);
    }
    return true;
  }

  function closeClue() {
    setActiveClue(null);
    if (pendingFinale) {
      setPendingFinale(false);
      setFinale(true);
      setFinaleStep("wishes");
    }
  }

  function submitWishes(nextWishes) {
    setWishes(nextWishes);
    localStorage.setItem(WISH_STORAGE_KEY, JSON.stringify(nextWishes));
    setFinaleStep("gratitude");
  }

  function submitGratitudes(nextGratitudes) {
    setGratitudes(nextGratitudes);
    localStorage.setItem(GRATITUDE_STORAGE_KEY, JSON.stringify(nextGratitudes));
    setFinaleStep("code");
  }

  function submitCode(event) {
    event.preventDefault();
    if (codeInput.trim() !== "5611") {
      setCodeError("Kode salah, coba lagi.");
      return;
    }
    setCodeError("");
    setFinaleStep("birthday");
    audio.stopForest();
    audio.playBirthdayTheme();
  }

  function extinguishCandles() {
    setCandlesOut(true);
    audio.playCheer();
    setFinaleStep("report");
  }

  function restartGame() {
    setSolvedAnomalies([]);
    setActiveAnomaly(null);
    setActiveClue(INITIAL_CLUE);
    setLastDirection("Baca clue di layar, lalu tutup card untuk mulai mencari.");
    setFinale(false);
    setPendingFinale(false);
    setFinaleStep("wishes");
    setWishes(Array.from({ length: 6 }, () => ""));
    setGratitudes(Array.from({ length: 11 }, () => ""));
    setCodeInput("");
    setCodeError("");
    setCandlesOut(false);
    localStorage.removeItem(ANSWER_STORAGE_KEY);
    localStorage.removeItem(WISH_STORAGE_KEY);
    localStorage.removeItem(GRATITUDE_STORAGE_KEY);
    if (playerApi.current) {
      playerApi.current.setTranslation({ x: 0, y: 0.8, z: 9 }, true);
      playerApi.current.setLinvel({ x: 0, y: 0, z: 0 }, true);
      playerApi.current.setAngvel({ x: 0, y: 0, z: 0 }, true);
    }
  }

  function startGame(event) {
    event.preventDefault();
    setPlayerName(draftName.trim() || "Player");
    setGameStarted(true);
    setActiveClue(INITIAL_CLUE);
  }

  function cycleCameraMode() {
    setCameraMode((mode) => CAMERA_MODES[(CAMERA_MODES.indexOf(mode) + 1) % CAMERA_MODES.length]);
  }

  async function chooseSound(preset) {
    if (preset.startsWith("special") && !specialSoundUnlocked) {
      setSpecialSoundOpen(true);
      return;
    }
    setSoundPreset(preset);
    const played = await audio.startForest(preset);
    setSoundPlaying(played);
  }

  async function toggleSound() {
    if (soundPlaying) {
      audio.stopForest();
      setSoundPlaying(false);
      return;
    }
    const played = await audio.startForest(soundPreset);
    setSoundPlaying(played);
  }

  function unlockSpecialSound(event) {
    event.preventDefault();
    if (specialSoundCode.trim() !== "171121") {
      setSpecialSoundError("Kode salah, coba lagi.");
      return;
    }
    setSpecialSoundUnlocked(true);
    setSpecialSoundOpen(false);
    setSpecialSoundError("");
    setSoundPreset("special");
    if (soundPlaying) audio.startForest("special");
  }

  useEffect(() => {
    const toggleCamera = (event) => {
      if (event.key === "Escape") {
        event.preventDefault();
        setCameraMode((mode) => CAMERA_MODES[(CAMERA_MODES.indexOf(mode) + 1) % CAMERA_MODES.length]);
      }
    };
    const zoomCamera = (event) => {
      setCameraZoom((zoom) => THREE.MathUtils.clamp(zoom + event.deltaY * 0.0012, 0, 1));
    };

    window.addEventListener("keydown", toggleCamera);
    window.addEventListener("wheel", zoomCamera, { passive: true });
    return () => {
      window.removeEventListener("keydown", toggleCamera);
      window.removeEventListener("wheel", zoomCamera);
    };
  }, []);

  return (
    <main className="app">
      {webglSupported ? (
        <CanvasErrorBoundary>
          <Canvas dpr={[1, 1.25]} shadows camera={{ position: [0, 6, 10], fov: 48 }} gl={{ powerPreference: "default", antialias: false, failIfMajorPerformanceCaveat: false }}>
            <color attach="background" args={[isNight ? "#030615" : "#9bd5ff"]} />
            <fog attach="fog" args={[isNight ? "#050817" : "#b8dfb5", 15, 48]} />
            <Suspense fallback={null}>
              <SceneLights isNight={isNight} />
              <Environment preset={isNight ? "night" : "sunset"} resolution={32} />
              {isNight && <GalaxySky />}
              <Physics gravity={[0, -9.81, 0]}>
                <Forest />
                <Ground />
                <Player refApi={playerApi} isNight={isNight} cameraMode={effectiveCameraMode} avatar={selectedAvatar} mouseSensitivity={mouseSensitivity} />
                <PlayerPositionReporter playerApi={playerApi} onUpdate={setPlayerPosition} />
                <AnomalyField
                  solvedAnomalies={solvedAnomalies}
                  activeAnomalyId={nextAnomaly?.id}
                  onSelect={(anomaly) => {
                    if (finale) return;
                    setActiveClue(null);
                    setActiveAnomaly(anomaly);
                  }}
                />
              </Physics>
              <FollowCamera playerApi={playerApi} finale={finale} cameraMode={effectiveCameraMode} cameraZoom={cameraZoom} mouseSensitivity={mouseSensitivity} />
              <OrbitControls enabled={false} />
            </Suspense>
          </Canvas>
        </CanvasErrorBoundary>
      ) : (
        <RendererFallback />
      )}

      <Hud
        isNight={isNight}
        setIsNight={setIsNight}
        playerName={playerName}
        foundCount={solvedAnomalies.length}
        direction={lastDirection}
        cameraMode={effectiveCameraMode}
        cameraZoom={cameraZoom}
        startAudio={toggleSound}
        soundPlaying={soundPlaying}
        openSettings={() => setSettingsOpen(true)}
        openHelp={() => setHelpOpen(true)}
      />
      <div
        className="brightness-layer"
        style={{
          background: brightness >= 1 ? "#ffffff" : "#000000",
          opacity: brightness >= 1 ? (brightness - 1) * 0.18 : (1 - brightness) * 0.55,
        }}
      />
      {gameStarted && showCompass && <Compass playerPosition={playerPosition} target={nextAnomaly} />}
      {gameStarted && <MobileControls cameraLabel={cameraLabel} onCycleCamera={cycleCameraMode} />}

      {activeAnomaly && <AnomalyModal anomaly={activeAnomaly} onSolve={solveAnomaly} onCancel={() => setActiveAnomaly(null)} />}
      {activeClue && !activeAnomaly && !finale && <ClueCard clue={activeClue} onClose={closeClue} />}
      {finale && (
        <FinaleOverlay
          step={finaleStep}
          wishes={wishes}
          gratitudes={gratitudes}
          codeInput={codeInput}
          codeError={codeError}
          candlesOut={candlesOut}
          playerName={playerName}
          onSubmitWishes={submitWishes}
          onSubmitGratitudes={submitGratitudes}
          onCodeInput={setCodeInput}
          onSubmitCode={submitCode}
          onBlow={extinguishCandles}
          onMicBlow={() => listenForBlow(extinguishCandles)}
          onRestart={restartGame}
        />
      )}
      {!gameStarted && (
        <OpeningOverlay
          loading={loading}
          draftName={draftName}
          setDraftName={setDraftName}
          avatarGender={avatarGender}
          setAvatarGender={(gender) => {
            setAvatarGender(gender);
            setAvatarId(AVATARS[gender][0].id);
          }}
          avatarId={avatarId}
          setAvatarId={setAvatarId}
          onStart={startGame}
        />
      )}
      {settingsOpen && (
        <SettingsModal
          isNight={isNight}
          setIsNight={setIsNight}
          startAudio={toggleSound}
          soundPlaying={soundPlaying}
          soundPreset={soundPreset}
          chooseSound={chooseSound}
          soundTracks={SOUND_TRACKS}
          specialSoundUnlocked={specialSoundUnlocked}
          specialTracks={SPECIAL_SOUND_TRACKS}
          volume={volume}
          setVolume={setVolume}
          brightness={brightness}
          setBrightness={setBrightness}
          mouseSensitivity={mouseSensitivity}
          setMouseSensitivity={setMouseSensitivity}
          cameraZoom={cameraZoom}
          setCameraZoom={setCameraZoom}
          showCompass={showCompass}
          setShowCompass={setShowCompass}
          onClose={() => setSettingsOpen(false)}
        />
      )}
      {specialSoundOpen && (
        <SpecialSoundModal
          code={specialSoundCode}
          error={specialSoundError}
          setCode={setSpecialSoundCode}
          onSubmit={unlockSpecialSound}
          onClose={() => setSpecialSoundOpen(false)}
        />
      )}
      {helpOpen && <HelpModal onClose={() => setHelpOpen(false)} />}
    </main>
  );
}

function RendererFallback() {
  return (
    <div className="renderer-fallback">
      <div className="renderer-fallback-card">
        <span className="kicker">Renderer 3D tidak bisa dibuka</span>
        <h2>Game gagal memuat canvas di laptop ini.</h2>
        <p>
          Coba buka pakai Chrome atau Edge terbaru, lalu aktifkan hardware acceleration di browser. Setelah itu tutup browser dan buka link game lagi.
        </p>
        <p className="fallback-link">Link yang benar tidak memakai /dist/ di belakang alamat.</p>
      </div>
    </div>
  );
}

function SceneLights({ isNight }) {
  return (
    <>
      <ambientLight intensity={isNight ? 0.22 : 0.78} color={isNight ? "#8fb4ff" : "#fff3cf"} />
      <directionalLight
        castShadow
        position={isNight ? [-6, 8, -4] : [8, 12, 6]}
        intensity={isNight ? 0.45 : 1.85}
        color={isNight ? "#90a8ff" : "#fff4d2"}
        shadow-mapSize-width={1024}
        shadow-mapSize-height={1024}
      />
      <hemisphereLight intensity={isNight ? 0.16 : 0.42} color="#b8f3ff" groundColor="#29451f" />
    </>
  );
}

function Ground() {
  return (
    <RigidBody type="fixed" colliders={false}>
      <mesh receiveShadow rotation-x={-Math.PI / 2}>
        <circleGeometry args={[52, 56]} />
        <meshStandardMaterial color="#2d6a34" roughness={1} />
      </mesh>
      <CuboidCollider args={[52, 0.08, 52]} position={[0, -0.08, 0]} />
    </RigidBody>
  );
}

function Forest() {
  const trees = useMemo(
    () =>
      Array.from({ length: 96 }, (_, i) => {
        const angle = Math.random() * Math.PI * 2;
        const radius = 5 + Math.random() * 40;
        return {
          key: i,
          position: [Math.cos(angle) * radius, 0, Math.sin(angle) * radius],
          scale: 1.35 + Math.random() * 1.85,
          color: ["#1f6f3c", "#2b8c4c", "#3aa15a"][i % 3],
        };
      }),
    []
  );
  const rocks = useMemo(
    () =>
      Array.from({ length: 34 }, (_, i) => {
        const angle = Math.random() * Math.PI * 2;
        const radius = 8 + Math.random() * 38;
        return {
          key: i,
          position: [Math.cos(angle) * radius, 0.08, Math.sin(angle) * radius],
          scale: [0.45 + Math.random() * 0.7, 0.28 + Math.random() * 0.35, 0.45 + Math.random() * 0.7],
        };
      }),
    []
  );
  const mushrooms = useMemo(
    () =>
      Array.from({ length: 24 }, (_, i) => ({
        key: i,
        position: [-24 + Math.random() * 48, 0, -25 + Math.random() * 45],
        scale: 0.55 + Math.random() * 0.45,
        cap: i % 3 === 0 ? "#d95545" : "#c84d3f",
      })),
    []
  );
  const animals = useMemo(
    () => [
      { key: "deer-a", position: [9, 0, 21], rotation: 0.6, scale: 0.9 },
      { key: "deer-b", position: [-28, 0, 6], rotation: -1.2, scale: 0.8 },
      { key: "cricket-a", position: [18, 0, -4], rotation: 0.1, scale: 1 },
      { key: "cricket-b", position: [-7, 0, 25], rotation: 2.2, scale: 0.9 },
    ],
    []
  );

  return (
    <>
      <Creek />
      <Hut position={[-14, 0, -24]} rotation={0.45} />
      <Hut position={[29, 0, 4]} rotation={-0.9} small />
      {trees.map((tree) => (
        <group key={tree.key} position={tree.position} scale={tree.scale}>
          <mesh castShadow position={[0, 0.85, 0]}>
            <cylinderGeometry args={[0.24, 0.34, 1.7, 5]} />
            <meshStandardMaterial color="#6b4327" roughness={0.9} />
          </mesh>
          <mesh castShadow position={[0, 2.0, 0]}>
            <coneGeometry args={[1.1, 2.1, 6]} />
            <meshStandardMaterial color={tree.color} roughness={0.85} />
          </mesh>
          <mesh castShadow position={[0, 2.95, 0]}>
            <coneGeometry args={[0.82, 1.75, 6]} />
            <meshStandardMaterial color={tree.color} roughness={0.85} />
          </mesh>
        </group>
      ))}
      {rocks.map((rock) => (
        <mesh key={rock.key} castShadow receiveShadow position={rock.position} scale={rock.scale}>
          <dodecahedronGeometry args={[0.65, 0]} />
          <meshStandardMaterial color="#5f746c" roughness={0.95} />
        </mesh>
      ))}
      {mushrooms.map((mushroom) => (
        <Mushroom key={mushroom.key} position={mushroom.position} scale={mushroom.scale} cap={mushroom.cap} />
      ))}
      {animals.map((animal) =>
        animal.key.startsWith("deer") ? (
          <Deer key={animal.key} position={animal.position} rotation={animal.rotation} scale={animal.scale} />
        ) : (
          <Cricket key={animal.key} position={animal.position} rotation={animal.rotation} scale={animal.scale} />
        )
      )}
      <Hill position={[18, 0, -21]} />
    </>
  );
}

function Creek() {
  return (
    <group position={[13, 0.03, -5]} rotation-y={-0.58}>
      <mesh receiveShadow rotation-x={-Math.PI / 2} scale={[3.2, 21, 1]}>
        <planeGeometry args={[1, 1, 1, 1]} />
        <meshStandardMaterial color="#1d6f86" roughness={0.45} metalness={0.05} transparent opacity={0.72} />
      </mesh>
      {[-8, -3, 2, 7].map((z) => (
        <mesh key={z} castShadow position={[1.7, 0.14, z]} scale={[0.6, 0.22, 0.42]}>
          <dodecahedronGeometry args={[0.8, 0]} />
          <meshStandardMaterial color="#60766d" roughness={0.9} />
        </mesh>
      ))}
    </group>
  );
}

function Hut({ position, rotation = 0, small = false, anomaly = false, onClick = null }) {
  const scale = small ? 0.74 : 1;
  return (
    <group position={position} rotation-y={rotation} scale={scale} onClick={onClick}>
      <mesh castShadow position={[0, 0.75, 0]}>
        <boxGeometry args={[2.7, 1.5, 2.2]} />
        <meshStandardMaterial color="#6b442b" roughness={0.82} />
      </mesh>
      <mesh castShadow position={[0, 1.72, 0]} rotation-z={Math.PI / 4} scale={[2.1, 0.5, 1.7]}>
        <boxGeometry args={[1, 1, 1]} />
        <meshStandardMaterial color="#3d251b" roughness={0.88} />
      </mesh>
      <mesh position={[0.72, 0.78, -1.12]}>
        <boxGeometry args={[0.42, 0.42, 0.04]} />
        <meshStandardMaterial color={anomaly ? "#ffe8a3" : "#152017"} emissive={anomaly ? "#594000" : "#000000"} emissiveIntensity={anomaly ? 0.8 : 0} />
      </mesh>
      <mesh position={[-0.54, 0.55, -1.13]}>
        <boxGeometry args={[0.48, 0.78, 0.05]} />
        <meshStandardMaterial color="#24140f" roughness={0.92} />
      </mesh>
    </group>
  );
}

function Mushroom({ position, scale = 1, cap = "#c84d3f", anomaly = false, onClick = null }) {
  return (
    <group position={position} scale={scale} onClick={onClick}>
      <mesh castShadow position={[0, 0.2, 0]}>
        <cylinderGeometry args={[0.08, 0.12, 0.38, 8]} />
        <meshStandardMaterial color="#e8d6b8" roughness={0.7} />
      </mesh>
      <mesh castShadow position={[0, 0.46, 0]}>
        <sphereGeometry args={[0.28, 12, 8, 0, Math.PI * 2, 0, Math.PI / 2]} />
        <meshStandardMaterial color={cap} roughness={0.72} />
      </mesh>
      {[[-0.08, 0.51, -0.07], [0.09, 0.53, 0.02], [0.01, 0.57, 0.09]].map((dot, index) => (
        <mesh key={index} position={dot} scale={anomaly ? 2.4 : 1}>
          <sphereGeometry args={[0.035, 8, 6]} />
          <meshStandardMaterial color={anomaly ? "#111111" : "#fff0cf"} />
        </mesh>
      ))}
      {anomaly &&
        [[-0.14, 0.5, 0.04], [0.15, 0.5, -0.08], [-0.01, 0.58, -0.12]].map((dot, index) => (
          <mesh key={`black-${index}`} position={dot} scale={2.1}>
            <sphereGeometry args={[0.035, 8, 6]} />
            <meshStandardMaterial color="#050505" />
          </mesh>
        ))}
    </group>
  );
}

function Cricket({ position, rotation = 0, scale = 1, anomaly = false, onClick = null }) {
  return (
    <group position={position} rotation-y={rotation} scale={scale} onClick={onClick}>
      <mesh castShadow position={[0, 0.18, 0]} scale={[1.2, 0.65, 0.8]}>
        <sphereGeometry args={[0.22, 10, 8]} />
        <meshStandardMaterial color="#2b3323" roughness={0.8} />
      </mesh>
      <mesh castShadow position={[0.28, 0.2, 0]} scale={[0.8, 0.6, 0.65]}>
        <sphereGeometry args={[0.16, 10, 8]} />
        <meshStandardMaterial color="#303b27" roughness={0.8} />
      </mesh>
      {[[-0.04, 0.05, -0.23], [-0.04, 0.05, 0.23], [0.22, 0.05, -0.2], [0.22, 0.05, 0.2]].map((leg, index) => (
        <mesh key={index} position={leg} rotation-z={index % 2 ? -0.55 : 0.55}>
          <boxGeometry args={[0.36, 0.035, 0.035]} />
          <meshStandardMaterial color="#171c13" />
        </mesh>
      ))}
      <mesh position={[0.42, 0.35, -0.08]} rotation-z={0.55}>
        <boxGeometry args={[0.035, anomaly ? 0.58 : 0.42, 0.025]} />
        <meshStandardMaterial color={anomaly ? "#95f0a5" : "#1c2418"} emissive={anomaly ? "#163d1c" : "#000000"} />
      </mesh>
      <mesh position={[0.42, 0.35, 0.08]} rotation-z={-0.55}>
        <boxGeometry args={[0.035, 0.42, 0.025]} />
        <meshStandardMaterial color="#1c2418" />
      </mesh>
    </group>
  );
}

function Deer({ position, rotation = 0, scale = 1, anomaly = false, jacket = false, onClick = null }) {
  return (
    <group position={position} rotation-y={rotation} scale={scale} onClick={onClick}>
      <mesh castShadow position={[0, 0.75, 0]} scale={[1.4, 0.65, 0.58]}>
        <sphereGeometry args={[0.44, 12, 8]} />
        <meshStandardMaterial color="#8b5a35" roughness={0.75} />
      </mesh>
      {jacket && (
        <mesh castShadow position={[0.06, 0.78, 0]} scale={[1.22, 0.68, 0.64]}>
          <sphereGeometry args={[0.41, 12, 8]} />
          <meshStandardMaterial color="#c91f28" roughness={0.62} />
        </mesh>
      )}
      <mesh castShadow position={[0.75, 1.05, 0]} scale={[0.7, 0.65, 0.58]}>
        <sphereGeometry args={[0.28, 10, 8]} />
        <meshStandardMaterial color="#936039" roughness={0.75} />
      </mesh>
      {[[-0.46, 0.32, -0.22], [-0.46, 0.32, 0.22], [0.42, 0.32, -0.2], [0.42, 0.32, 0.2]].map((leg, index) => (
        <mesh key={index} castShadow position={leg}>
          <cylinderGeometry args={[0.045, 0.055, 0.65, 6]} />
          <meshStandardMaterial color="#4c2d1e" roughness={0.8} />
        </mesh>
      ))}
      <mesh position={[0.92, 1.28, -0.08]} rotation-z={0.45}>
        <boxGeometry args={[0.035, anomaly ? 0.26 : 0.42, 0.035]} />
        <meshStandardMaterial color="#d9c29d" />
      </mesh>
      <mesh position={[0.92, 1.28, 0.08]} rotation-z={-0.45}>
        <boxGeometry args={[0.035, 0.42, 0.035]} />
        <meshStandardMaterial color="#d9c29d" />
      </mesh>
    </group>
  );
}

function Hill({ position }) {
  return (
    <mesh receiveShadow position={position} scale={[6, 1.2, 6]}>
      <sphereGeometry args={[1, 12, 8, 0, Math.PI * 2, 0, Math.PI / 2]} />
      <meshStandardMaterial color="#416b37" roughness={1} />
    </mesh>
  );
}

function GalaxySky() {
  const galaxy = useMemo(() => {
    const count = 950;
    const positions = new Float32Array(count * 3);
    const colors = new Float32Array(count * 3);
    const color = new THREE.Color();

    for (let i = 0; i < count; i += 1) {
      const branch = i % 4;
      const radius = 12 + Math.random() * 54;
      const spin = radius * 0.08;
      const angle = branch * (Math.PI / 2) + spin + (Math.random() - 0.5) * 0.72;
      const height = 18 + Math.random() * 34 + Math.max(0, 28 - radius) * 0.25;
      const spread = 0.45 + radius * 0.035;

      positions[i * 3] = Math.cos(angle) * radius + (Math.random() - 0.5) * spread;
      positions[i * 3 + 1] = height + (Math.random() - 0.5) * 5;
      positions[i * 3 + 2] = Math.sin(angle) * radius + (Math.random() - 0.5) * spread;

      color.set(i % 5 === 0 ? "#ffd6a5" : i % 3 === 0 ? "#bde0fe" : "#fff8ea");
      color.multiplyScalar(0.65 + Math.random() * 0.55);
      colors[i * 3] = color.r;
      colors[i * 3 + 1] = color.g;
      colors[i * 3 + 2] = color.b;
    }

    return { positions, colors };
  }, []);

  return (
    <points rotation={[0.18, -0.45, 0]}>
      <bufferGeometry>
        <bufferAttribute attach="attributes-position" args={[galaxy.positions, 3]} />
        <bufferAttribute attach="attributes-color" args={[galaxy.colors, 3]} />
      </bufferGeometry>
      <pointsMaterial size={0.18} vertexColors transparent opacity={0.9} depthWrite={false} sizeAttenuation />
    </points>
  );
}

function Player({ refApi, isNight, cameraMode, avatar, mouseSensitivity }) {
  const body = useRef(null);
  const model = useRef(null);
  const leftArm = useRef(null);
  const rightArm = useRef(null);
  const leftLeg = useRef(null);
  const rightLeg = useRef(null);
  const keys = useKeyboard();
  const mouse = useMouseLook();
  const direction = useRef(new THREE.Vector3());
  const velocity = useRef(new THREE.Vector3());
  const canJump = useRef(true);
  const rotationQuat = useMemo(() => new THREE.Quaternion(), []);
  const currentQuat = useMemo(() => new THREE.Quaternion(), []);
  const yawAxis = useMemo(() => new THREE.Vector3(0, 1, 0), []);
  const targetYaw = useRef(0);
  const firstPerson = cameraMode === "first";

  useEffect(() => {
    refApi.current = body.current;
  }, [refApi]);

  useFrame(({ clock }, delta) => {
    if (!body.current) return;
    const input = direction.current.set(0, 0, 0);
    if (keys.current.w || keys.current.ArrowUp) input.z -= 1;
    if (keys.current.s || keys.current.ArrowDown) input.z += 1;
    if (keys.current.a || keys.current.ArrowLeft) input.x -= 1;
    if (keys.current.d || keys.current.ArrowRight) input.x += 1;
    input.x += MOBILE_INPUT.x;
    input.z += MOBILE_INPUT.z;

    const current = body.current.linvel();
    const sprinting = (keys.current.Shift || keys.current.shift || MOBILE_INPUT.shift) && (keys.current.w || keys.current.ArrowUp || MOBILE_INPUT.z < -0.25);
    const targetSpeed = sprinting ? 11.2 : 7.2;
    const blend = 1 - Math.exp(-14 * delta);

    if (mouse.current.left) {
      targetYaw.current -= mouse.current.dx * 0.006 * mouseSensitivity;
      mouse.current.dx = 0;
    }

    if (input.lengthSq() > 0) {
      input.normalize();
      rotationQuat.setFromAxisAngle(yawAxis, targetYaw.current);
      input.applyQuaternion(rotationQuat).multiplyScalar(targetSpeed);
      velocity.current.set(current.x, 0, current.z).lerp(input, blend);
    } else {
      velocity.current.set(current.x, 0, current.z).multiplyScalar(Math.exp(-16 * delta));
    }
    const horizontalSpeed = Math.hypot(velocity.current.x, velocity.current.z);

    const t = body.current.translation();
    const grounded = t.y < 1.35 && Math.abs(current.y) < 1.2;
    if (grounded) canJump.current = true;

    let yVelocity = current.y;
    if ((keys.current[" "] || MOBILE_INPUT.space) && canJump.current && grounded) {
      yVelocity = 8.8;
      canJump.current = false;
    }

    body.current.setLinvel({ x: velocity.current.x, y: yVelocity, z: velocity.current.z }, true);

    rotationQuat.setFromAxisAngle(yawAxis, targetYaw.current);
    const rotation = body.current.rotation();
    currentQuat.set(rotation.x, rotation.y, rotation.z, rotation.w).slerp(rotationQuat, 1 - Math.exp(-14 * delta));
    body.current.setRotation(currentQuat, true);
    body.current.setAngvel({ x: 0, y: 0, z: 0 }, true);
    const walkAmount = Math.min(horizontalSpeed / targetSpeed, 1);
    const stride = Math.sin(clock.elapsedTime * (sprinting ? 13 : 9)) * walkAmount;

    if (model.current) {
      model.current.position.y = Math.abs(Math.sin(clock.elapsedTime * 9)) * 0.045 * walkAmount;
    }
    if (leftLeg.current && rightLeg.current && leftArm.current && rightArm.current) {
      leftLeg.current.rotation.x = stride * 0.72;
      rightLeg.current.rotation.x = -stride * 0.72;
      leftArm.current.rotation.x = -stride * 0.48;
      rightArm.current.rotation.x = stride * 0.34 - 0.42;
    }
  });

  return (
    <RigidBody ref={body} colliders="ball" position={[0, 0.8, 9]} linearDamping={0.8} angularDamping={4} enabledRotations={[false, true, false]}>
      <group ref={model}>
        <mesh castShadow position={[0, 0.2, 0]} visible={!firstPerson}>
          <capsuleGeometry args={[0.33, 0.74, 6, 12]} />
          <meshStandardMaterial color={avatar.body} roughness={0.45} />
        </mesh>

        <group position={[0, 0.95, 0]} visible={!firstPerson}>
          <mesh castShadow>
            <sphereGeometry args={[0.28, 18, 14]} />
            <meshStandardMaterial color={avatar.skin} roughness={0.58} />
          </mesh>
          <mesh castShadow position={[0, 0.19, -0.03]} scale={[1.05, 0.35, 0.72]}>
            <sphereGeometry args={[0.28, 18, 8]} />
            <meshStandardMaterial color={avatar.hair} roughness={0.72} />
          </mesh>
          <mesh castShadow position={[0, 0.14, -0.18]} rotation-x={-0.45} scale={[1.0, 0.32, 0.45]}>
            <sphereGeometry args={[0.24, 16, 8]} />
            <meshStandardMaterial color={avatar.hair} roughness={0.7} />
          </mesh>
          <mesh position={[-0.09, 0.02, -0.255]}>
            <sphereGeometry args={[0.027, 8, 8]} />
            <meshStandardMaterial color="#171717" />
          </mesh>
          <mesh position={[0.09, 0.02, -0.255]}>
            <sphereGeometry args={[0.027, 8, 8]} />
            <meshStandardMaterial color="#171717" />
          </mesh>
          <mesh position={[0, -0.08, -0.272]} scale={[1, 0.28, 0.18]}>
            <sphereGeometry args={[0.075, 12, 8]} />
            <meshStandardMaterial color="#ff7b91" roughness={0.5} />
          </mesh>
        </group>

        <group ref={leftArm} position={[-0.39, 0.42, 0]} visible={!firstPerson}>
          <mesh castShadow position={[0, -0.21, 0]}>
            <capsuleGeometry args={[0.075, 0.48, 5, 8]} />
            <meshStandardMaterial color={avatar.skin} roughness={0.5} />
          </mesh>
        </group>

        <group ref={rightArm} position={[0.39, 0.42, 0]} visible={!firstPerson}>
          <mesh castShadow position={[0, -0.21, 0]}>
            <capsuleGeometry args={[0.075, 0.48, 5, 8]} />
            <meshStandardMaterial color={avatar.skin} roughness={0.5} />
          </mesh>
          {isNight && (
            <group position={[0, -0.49, -0.2]}>
              <mesh castShadow rotation-x={Math.PI / 2}>
                <cylinderGeometry args={[0.08, 0.1, 0.36, 12]} />
                <meshStandardMaterial color="#2c3340" metalness={0.25} roughness={0.35} />
              </mesh>
              <mesh position={[0, 0, -0.2]}>
                <circleGeometry args={[0.09, 14]} />
                <meshStandardMaterial color="#fff2bd" emissive="#ffc857" emissiveIntensity={1.4} />
              </mesh>
              <mesh position={[0, 0, -1.3]} rotation-x={Math.PI / 2}>
                <coneGeometry args={[0.85, 2.4, 20, 1, true]} />
                <meshBasicMaterial color="#ffe9a6" transparent opacity={0.16} depthWrite={false} side={THREE.DoubleSide} />
              </mesh>
              <pointLight color="#ffe9a6" intensity={0.7} distance={3.5} position={[0, 0, -0.2]} />
            </group>
          )}
        </group>

        <group ref={leftLeg} position={[-0.16, -0.16, 0]} visible={!firstPerson}>
          <mesh castShadow position={[0, -0.34, 0]}>
            <capsuleGeometry args={[0.085, 0.58, 5, 8]} />
            <meshStandardMaterial color={avatar.pants} roughness={0.58} />
          </mesh>
          <mesh castShadow position={[0, -0.66, -0.05]} scale={[1, 0.55, 1.55]}>
            <boxGeometry args={[0.18, 0.12, 0.24]} />
            <meshStandardMaterial color="#141923" roughness={0.72} />
          </mesh>
        </group>
        <group ref={rightLeg} position={[0.16, -0.16, 0]} visible={!firstPerson}>
          <mesh castShadow position={[0, -0.34, 0]}>
            <capsuleGeometry args={[0.085, 0.58, 5, 8]} />
            <meshStandardMaterial color={avatar.pants} roughness={0.58} />
          </mesh>
          <mesh castShadow position={[0, -0.66, -0.05]} scale={[1, 0.55, 1.55]}>
            <boxGeometry args={[0.18, 0.12, 0.24]} />
            <meshStandardMaterial color="#141923" roughness={0.72} />
          </mesh>
        </group>
      </group>
    </RigidBody>
  );
}

function useKeyboard() {
  const keys = useRef({});
  useEffect(() => {
    const down = (event) => {
      const tagName = event.target?.tagName;
      if (tagName === "INPUT" || tagName === "TEXTAREA" || event.target?.isContentEditable) return;
      keys.current[event.key] = true;
      if (["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight", " "].includes(event.key)) event.preventDefault();
    };
    const up = (event) => {
      const tagName = event.target?.tagName;
      if (tagName === "INPUT" || tagName === "TEXTAREA" || event.target?.isContentEditable) return;
      keys.current[event.key] = false;
    };
    window.addEventListener("keydown", down);
    window.addEventListener("keyup", up);
    return () => {
      window.removeEventListener("keydown", down);
      window.removeEventListener("keyup", up);
    };
  }, []);
  return keys;
}

function useMouseLook() {
  const mouse = useRef({ left: false, dx: 0, dy: 0 });

  useEffect(() => {
    let lastTouch = null;
    const down = (event) => {
      if (event.button === 0 || event.button === 2) mouse.current.left = true;
    };
    const up = (event) => {
      if (event.button === 0 || event.button === 2) mouse.current.left = false;
    };
    const blur = () => {
      mouse.current.left = false;
      mouse.current.dx = 0;
      mouse.current.dy = 0;
    };
    const move = (event) => {
      if (!mouse.current.left) return;
      mouse.current.dx += event.movementX;
      mouse.current.dy += event.movementY;
    };
    const touchStart = (event) => {
      if (event.target?.closest?.(".mobile-controls, .hud, .modal, .clue-card, .opening, .finale")) return;
      const touch = event.touches[0];
      if (!touch) return;
      mouse.current.left = true;
      lastTouch = { x: touch.clientX, y: touch.clientY };
    };
    const touchMove = (event) => {
      if (!mouse.current.left || !lastTouch) return;
      if (event.target?.closest?.(".mobile-controls, .hud, .modal, .clue-card, .opening, .finale")) return;
      const touch = event.touches[0];
      if (!touch) return;
      mouse.current.dx += touch.clientX - lastTouch.x;
      mouse.current.dy += touch.clientY - lastTouch.y;
      lastTouch = { x: touch.clientX, y: touch.clientY };
      event.preventDefault();
    };
    const touchEnd = () => {
      mouse.current.left = false;
      lastTouch = null;
    };
    const menu = (event) => event.preventDefault();
    window.addEventListener("mousedown", down);
    window.addEventListener("mouseup", up);
    window.addEventListener("mousemove", move);
    window.addEventListener("touchstart", touchStart, { passive: false });
    window.addEventListener("touchmove", touchMove, { passive: false });
    window.addEventListener("touchend", touchEnd);
    window.addEventListener("touchcancel", touchEnd);
    window.addEventListener("contextmenu", menu);
    window.addEventListener("blur", blur);
    return () => {
      window.removeEventListener("mousedown", down);
      window.removeEventListener("mouseup", up);
      window.removeEventListener("mousemove", move);
      window.removeEventListener("touchstart", touchStart);
      window.removeEventListener("touchmove", touchMove);
      window.removeEventListener("touchend", touchEnd);
      window.removeEventListener("touchcancel", touchEnd);
      window.removeEventListener("contextmenu", menu);
      window.removeEventListener("blur", blur);
    };
  }, []);

  return mouse;
}

function FollowCamera({ playerApi, finale, cameraMode, cameraZoom, mouseSensitivity }) {
  const { camera } = useThree();
  const mouse = useMouseLook();
  const pitch = useRef(0);
  const bobTime = useRef(0);
  const bobAmount = useRef(0);
  const forward = useMemo(() => new THREE.Vector3(), []);
  const side = useMemo(() => new THREE.Vector3(), []);
  const bodyQuat = useMemo(() => new THREE.Quaternion(), []);

  useFrame(({ clock }, delta) => {
    if (finale || !playerApi.current) return;
    const t = playerApi.current.translation();
    const r = playerApi.current.rotation();
    const v = playerApi.current.linvel();
    bodyQuat.set(r.x, r.y, r.z, r.w);

    if (mouse.current.left) {
      pitch.current = THREE.MathUtils.clamp(pitch.current - mouse.current.dy * 0.004 * mouseSensitivity, -1.65, 1.15);
      mouse.current.dy = 0;
    }

    forward.set(0, 0, -1).applyQuaternion(bodyQuat).normalize();
    side.set(1, 0, 0).applyQuaternion(bodyQuat).normalize();

    const pitchMix = THREE.MathUtils.clamp((pitch.current + 1.65) / 2.8, 0, 1);

    if (cameraMode === "third") {
      const distance = THREE.MathUtils.lerp(3.4, 13.5, cameraZoom);
      const cameraHeight = THREE.MathUtils.lerp(2.7, 7.8, cameraZoom) + THREE.MathUtils.lerp(-0.7, 1.2, pitchMix);
      tmpVector
        .set(t.x, t.y + cameraHeight, t.z)
        .addScaledVector(forward, -distance);
      tmpLookAt
        .set(t.x, t.y + THREE.MathUtils.lerp(-2.6, 4.6, pitchMix), t.z)
        .addScaledVector(forward, 8);
    } else if (cameraMode === "shiftLock") {
      tmpVector
        .set(t.x, t.y + THREE.MathUtils.lerp(2.0, 3.2, pitchMix), t.z)
        .addScaledVector(forward, -5.8)
        .addScaledVector(side, 1.15);
      tmpLookAt
        .set(t.x, t.y + THREE.MathUtils.lerp(-2.8, 4.8, pitchMix), t.z)
        .addScaledVector(forward, 10);
    } else {
      const horizontalSpeed = Math.hypot(v.x, v.z);
      const runMix = THREE.MathUtils.clamp((horizontalSpeed - 7.5) / 4, 0, 1);
      const moving = horizontalSpeed > 0.35 && Math.abs(v.y) < 1.2;
      const targetBob = moving ? THREE.MathUtils.lerp(0.035, 0.075, runMix) : 0;
      const bobSpeed = THREE.MathUtils.lerp(9.5, 14.5, runMix);
      bobTime.current += delta * bobSpeed * (moving ? 1 : 0.45);
      bobAmount.current = THREE.MathUtils.lerp(bobAmount.current, targetBob, 1 - Math.exp(-12 * delta));

      const verticalBob = Math.sin(bobTime.current) * bobAmount.current;
      const sideBob = Math.sin(bobTime.current * 0.5) * bobAmount.current * 0.55;
      const breathingBob = !moving ? Math.sin(clock.elapsedTime * 1.8) * 0.008 : 0;

      tmpVector
        .set(t.x, t.y + THREE.MathUtils.lerp(1.62, 1.9, pitchMix) + verticalBob + breathingBob, t.z)
        .addScaledVector(forward, 0.2)
        .addScaledVector(side, sideBob);
      tmpLookAt
        .set(t.x, t.y + THREE.MathUtils.lerp(-6.5, 5.2, pitchMix) + verticalBob * 0.45, t.z)
        .addScaledVector(forward, 11)
        .addScaledVector(side, sideBob * 0.6);
    }

    camera.position.lerp(tmpVector, 1 - Math.exp(-7 * delta));
    camera.lookAt(tmpLookAt);
  });
  return null;
}

function PlayerPositionReporter({ playerApi, onUpdate }) {
  const lastUpdate = useRef(0);

  useFrame(({ clock }) => {
    if (!playerApi.current || clock.elapsedTime - lastUpdate.current < 0.16) return;
    const t = playerApi.current.translation();
    lastUpdate.current = clock.elapsedTime;
    onUpdate({ x: t.x, z: t.z });
  });

  return null;
}

function AnomalyField({ solvedAnomalies, activeAnomalyId, onSelect }) {
  const solved = useMemo(() => new Set(solvedAnomalies), [solvedAnomalies]);
  const clickAnomaly = (event, anomaly) => {
    event.stopPropagation();
    onSelect(anomaly);
  };

  return (
    <>
      {ANOMALIES.map((anomaly) => {
        if (solved.has(anomaly.id) || anomaly.id !== activeAnomalyId) return null;
        if (anomaly.type === "tree") {
          return <AnomalyTree key={anomaly.id} anomaly={anomaly} onClick={(event) => clickAnomaly(event, anomaly)} />;
        }
        if (anomaly.type === "rock") {
          return <AnomalyRock key={anomaly.id} anomaly={anomaly} onClick={(event) => clickAnomaly(event, anomaly)} />;
        }
        if (anomaly.type === "hut") {
          return <Hut key={anomaly.id} position={anomaly.position} rotation={0.45} anomaly onClick={(event) => clickAnomaly(event, anomaly)} />;
        }
        if (anomaly.type === "mushroom") {
          return <Mushroom key={anomaly.id} position={anomaly.position} scale={1.2} cap="#7b4bd6" anomaly onClick={(event) => clickAnomaly(event, anomaly)} />;
        }
        return <Deer key={anomaly.id} position={anomaly.position} rotation={1.2} scale={0.95} anomaly jacket onClick={(event) => clickAnomaly(event, anomaly)} />;
      })}
    </>
  );
}

function AnomalyTree({ anomaly, onClick }) {
  const handleClick = (event) => {
    event.stopPropagation();
    onClick(event);
  };

  return (
    <group position={anomaly.position} scale={1.55} onClick={handleClick}>
      <mesh position={[0, 2.25, 0]} onClick={handleClick}>
        <cylinderGeometry args={[0.9, 1.05, 4.7, 10]} />
        <meshBasicMaterial transparent opacity={0} depthWrite={false} />
      </mesh>
      <mesh position={[0, 4.1, 0]} onClick={handleClick}>
        <sphereGeometry args={[1.65, 12, 8]} />
        <meshBasicMaterial transparent opacity={0} depthWrite={false} />
      </mesh>
      <mesh castShadow position={[0, 2.05, 0]}>
        <cylinderGeometry args={[0.24, 0.34, 4.1, 8]} />
        <meshStandardMaterial color="#755334" roughness={0.88} />
      </mesh>
      {Array.from({ length: 8 }, (_, index) => {
        const angle = (index / 8) * Math.PI * 2;
        return (
          <mesh key={index} castShadow position={[0, 4.18, 0]} rotation={[0.2, angle, index % 2 ? 0.22 : -0.22]}>
            <boxGeometry args={[0.18, 0.07, 2.45]} />
            <meshStandardMaterial color={index === 2 ? "#9ff0a2" : "#257c3e"} emissive={index === 2 ? "#264d26" : "#000000"} emissiveIntensity={index === 2 ? 0.55 : 0} roughness={0.82} />
          </mesh>
        );
      })}
      <mesh castShadow position={[0, 4.05, 0]}>
        <sphereGeometry args={[0.34, 12, 8]} />
        <meshStandardMaterial color="#2a8a44" roughness={0.85} />
      </mesh>
    </group>
  );
}

function AnomalyRock({ anomaly, onClick }) {
  const handleClick = (event) => {
    event.stopPropagation();
    onClick(event);
  };

  return (
    <group position={anomaly.position} scale={1.35} onClick={handleClick}>
      <mesh position={[0, 0.35, 0]} onClick={handleClick}>
        <sphereGeometry args={[1.15, 12, 8]} />
        <meshBasicMaterial transparent opacity={0} depthWrite={false} />
      </mesh>
      <mesh castShadow receiveShadow position={[0, 0.28, 0]} scale={[1.35, 0.48, 1.0]}>
        <dodecahedronGeometry args={[0.9, 0]} />
        <meshStandardMaterial color="#6d7c76" roughness={0.94} />
      </mesh>
      <Billboard position={[0, 0.85, 0]}>
        <Text fontSize={0.26} color="#1b211f" anchorX="center" anchorY="middle">
          batu
        </Text>
      </Billboard>
    </group>
  );
}

function ClueWatcher({ playerApi, nextClue, setActiveClue, openChest, canOpenChest }) {
  const { camera } = useThree();
  const openedRef = useRef(false);

  useFrame(() => {
    if (!playerApi.current) return;
    const t = playerApi.current.translation();
    if (nextClue) {
      const distance = Math.hypot(t.x - nextClue.position[0], t.z - nextClue.position[2]);
      if (distance < 1.35 && !openedRef.current) {
        openedRef.current = true;
        setActiveClue(nextClue);
      }
      if (distance > 2.1) openedRef.current = false;
      return;
    }
    const chestDistance = Math.hypot(t.x - CHEST_POSITION[0], t.z - CHEST_POSITION[2]);
    if (canOpenChest && chestDistance < 2.1) openChest(camera);
  });
  return null;
}

function ClueMarker({ clue, visible, active }) {
  if (!visible) return null;
  return (
    <group position={clue.position}>
      <mesh castShadow>
        <dodecahedronGeometry args={[0.45, 0]} />
        <meshStandardMaterial color={active ? "#ffd166" : "#87f5a7"} emissive={active ? "#6d4100" : "#103b20"} />
      </mesh>
      <Billboard position={[0, 1.15, 0]}>
        <Text fontSize={0.35} color="#ffffff" anchorX="center" anchorY="middle">
          ?
        </Text>
      </Billboard>
    </group>
  );
}

function TreasureChest({ finale, candlesOut }) {
  return (
    <group position={CHEST_POSITION}>
      <mesh castShadow position={[0, 0.25, 0]}>
        <boxGeometry args={[1.8, 0.8, 1.05]} />
        <meshStandardMaterial color="#6a3f1f" roughness={0.65} />
      </mesh>
      <mesh castShadow position={[0, 0.78, -0.05]} rotation-x={finale ? -0.95 : 0}>
        <boxGeometry args={[1.9, 0.32, 1.12]} />
        <meshStandardMaterial color="#7b4b26" roughness={0.58} />
      </mesh>
      <mesh position={[0, 0.42, 0.55]}>
        <boxGeometry args={[0.28, 0.24, 0.08]} />
        <meshStandardMaterial color="#ffd166" metalness={0.5} roughness={0.35} />
      </mesh>
      {finale && <BirthdayCake candlesOut={candlesOut} />}
    </group>
  );
}

function BirthdayCake({ candlesOut }) {
  return (
    <group position={[0, 1.55, 0]}>
      <mesh castShadow>
        <cylinderGeometry args={[0.9, 1, 0.58, 32]} />
        <meshStandardMaterial color="#77c8ff" roughness={0.55} />
      </mesh>
      <mesh castShadow position={[0, 0.34, 0]}>
        <cylinderGeometry args={[0.72, 0.82, 0.42, 32]} />
        <meshStandardMaterial color="#fff6ea" roughness={0.5} />
      </mesh>
      {[-0.32, 0, 0.32].map((x) => (
        <group key={x} position={[x, 0.82, 0]}>
          <mesh castShadow>
            <cylinderGeometry args={[0.035, 0.035, 0.45, 10]} />
            <meshStandardMaterial color="#263326" />
          </mesh>
          {!candlesOut && <Flame />}
        </group>
      ))}
      <Html center position={[0, -0.02, 0.92]} transform distanceFactor={4}>
        <span className="cake-label">IRFAN</span>
      </Html>
    </group>
  );
}

function Flame() {
  const ref = useRef(null);
  useFrame(({ clock }) => {
    const t = clock.elapsedTime;
    ref.current.scale.setScalar(0.85 + Math.sin(t * 14) * 0.16);
    ref.current.rotation.z = Math.sin(t * 9) * 0.12;
  });
  return (
    <mesh ref={ref} position={[0, 0.34, 0]}>
      <sphereGeometry args={[0.1, 14, 14]} />
      <shaderMaterial
        transparent
        depthWrite={false}
        uniforms={{ inner: { value: new THREE.Color("#fff8da") }, outer: { value: new THREE.Color("#ff9f1c") } }}
        vertexShader="varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }"
        fragmentShader="uniform vec3 inner; uniform vec3 outer; varying vec2 vUv; void main(){ float d = distance(vUv, vec2(.5)); float a = smoothstep(.5, .08, d); gl_FragColor = vec4(mix(inner, outer, d * 1.8), a); }"
      />
      <pointLight color="#ffb84d" intensity={0.8} distance={2.2} />
    </mesh>
  );
}

function Hud({ isNight, setIsNight, playerName, foundCount, direction, cameraMode, cameraZoom, startAudio, soundPlaying, openSettings, openHelp }) {
  const cameraLabel = cameraMode === "third" ? "Third-Person" : cameraMode === "shiftLock" ? "Shift Lock" : "First-Person";

  return (
    <section className="hud">
      <div>
        <span className="kicker">Forest Anomaly Hunt</span>
        <h1>{playerName}</h1>
      </div>
      <div className="status">
        <strong>{foundCount}/5 anomalies</strong>
        <span>{direction}</span>
        <span>Camera: {cameraLabel} - Esc switch - Zoom {Math.round((1 - cameraZoom) * 100)}%</span>
      </div>
      <div className="actions">
        <button onClick={startAudio}>{soundPlaying ? "Pause Sound" : "Start Sound"}</button>
        <button onClick={() => setIsNight((value) => !value)}>{isNight ? "Day" : "Night"}</button>
        <button onClick={openSettings}>Settings</button>
        <button onClick={openHelp}>Help</button>
      </div>
    </section>
  );
}

function Compass({ playerPosition, target }) {
  if (!target) return null;
  const dx = target.position[0] - playerPosition.x;
  const dz = target.position[2] - playerPosition.z;
  const angle = Math.atan2(dx, dz) * (180 / Math.PI);
  const distance = Math.round(Math.hypot(dx, dz));

  return (
    <div className="compass">
      <div className="compass-ring">
        <span>N</span>
        <i style={{ transform: `translate(-50%, -80%) rotate(${angle}deg)` }} />
      </div>
      <strong>{distance}m</strong>
      <small>anomali</small>
    </div>
  );
}

function MobileControls({ cameraLabel, onCycleCamera }) {
  const [tiltActive, setTiltActive] = useState(MOBILE_INPUT.tiltEnabled);
  const [tiltText, setTiltText] = useState("Tilt Off");

  useEffect(() => {
    const handleOrientation = (event) => {
      if (!MOBILE_INPUT.tiltEnabled) return;
      const beta = THREE.MathUtils.clamp(event.beta || 0, -35, 35);
      const gamma = THREE.MathUtils.clamp(event.gamma || 0, -28, 28);
      MOBILE_INPUT.z = THREE.MathUtils.clamp((beta - 8) / 22, -1, 1);
      MOBILE_INPUT.x = THREE.MathUtils.clamp(gamma / 22, -1, 1);
      setTiltText(`${Math.round(MOBILE_INPUT.x * 100)}, ${Math.round(MOBILE_INPUT.z * 100)}`);
    };
    window.addEventListener("deviceorientation", handleOrientation);
    return () => window.removeEventListener("deviceorientation", handleOrientation);
  }, []);

  const enableTilt = async (event) => {
    event.preventDefault();
    try {
      if (typeof DeviceOrientationEvent !== "undefined" && typeof DeviceOrientationEvent.requestPermission === "function") {
        const permission = await DeviceOrientationEvent.requestPermission();
        if (permission !== "granted") return;
      }
      MOBILE_INPUT.tiltEnabled = !MOBILE_INPUT.tiltEnabled;
      if (!MOBILE_INPUT.tiltEnabled) {
        MOBILE_INPUT.x = 0;
        MOBILE_INPUT.z = 0;
      }
      setTiltActive(MOBILE_INPUT.tiltEnabled);
      setTiltText(MOBILE_INPUT.tiltEnabled ? "Tilt On" : "Tilt Off");
    } catch {
      setTiltText("Sensor blocked");
    }
  };
  const press = (key, value) => (event) => {
    event.preventDefault();
    MOBILE_INPUT[key] = value;
  };
  const tapJump = (event) => {
    event.preventDefault();
    MOBILE_INPUT.space = true;
    window.setTimeout(() => {
      MOBILE_INPUT.space = false;
    }, 180);
  };

  return (
    <div className="mobile-controls" aria-label="Mobile controls">
      <div className="mobile-tilt">
        <button className={tiltActive ? "active" : ""} onPointerDown={enableTilt}>{tiltActive ? "Tilt On" : "Enable Tilt"}</button>
        <small>{tiltText}</small>
      </div>
      <div className="mobile-camera-console">
        <button onPointerDown={(event) => { event.preventDefault(); onCycleCamera(); }}>
          POV
          <span>{cameraLabel}</span>
        </button>
      </div>
      <div className="mobile-actions">
        <button onPointerDown={press("shift", true)} onPointerUp={press("shift", false)} onPointerLeave={press("shift", false)}>RUN</button>
        <button onPointerDown={tapJump}>JUMP</button>
      </div>
    </div>
  );
}

function OpeningOverlay({ loading, draftName, setDraftName, avatarGender, setAvatarGender, avatarId, setAvatarId, onStart }) {
  return (
    <div className="opening">
      {loading ? (
        <div className="loading-card">
          <span className="kicker">Forest Anomaly Hunt</span>
          <h2>Loading forest...</h2>
          <div className="loading-bar"><i /></div>
          <p>dev oleh anisazr_dev</p>
        </div>
      ) : (
        <form className="start-card" onSubmit={onStart}>
          <span className="kicker">Opening</span>
          <h2>Masuk ke Hutan Anomali</h2>
          <label>
            Nama pemain
            <input value={draftName} onChange={(event) => setDraftName(event.target.value)} placeholder="Nama" />
          </label>
          <div className="segmented">
            <button type="button" className={avatarGender === "boy" ? "active" : ""} onClick={() => setAvatarGender("boy")}>Cowok</button>
            <button type="button" className={avatarGender === "girl" ? "active" : ""} onClick={() => setAvatarGender("girl")}>Cewek</button>
          </div>
          <div className="avatar-grid">
            {AVATARS[avatarGender].map((avatar) => (
              <button key={avatar.id} type="button" className={avatarId === avatar.id ? "avatar-option active" : "avatar-option"} onClick={() => setAvatarId(avatar.id)}>
                <span style={{ "--body": avatar.body, "--pants": avatar.pants, "--skin": avatar.skin, "--hair": avatar.hair }} />
                {avatar.label}
              </button>
            ))}
          </div>
          <button className="primary-button">Start Game</button>
        </form>
      )}
    </div>
  );
}

function SettingsModal({
  isNight,
  setIsNight,
  startAudio,
  soundPlaying,
  soundPreset,
  chooseSound,
  soundTracks,
  specialSoundUnlocked,
  specialTracks,
  volume,
  setVolume,
  brightness,
  setBrightness,
  mouseSensitivity,
  setMouseSensitivity,
  cameraZoom,
  setCameraZoom,
  showCompass,
  setShowCompass,
  onClose,
}) {
  return (
    <div className="modal">
      <div className="modal-card small-card">
        <button className="close-button" type="button" onClick={onClose}>x</button>
        <span className="kicker">Settings</span>
        <h2>Pengaturan</h2>
        <div className="settings-row">
          <span>Mode waktu</span>
          <button onClick={() => setIsNight((value) => !value)}>{isNight ? "Night" : "Day"}</button>
        </div>
        <div className="settings-row">
          <span>Ambience</span>
          <button onClick={startAudio}>{soundPlaying ? "Pause Sound" : "Play Sound"}</button>
        </div>
        <div className="sound-picker">
          <span>Pilihan sound</span>
          {soundTracks.map((track) => (
            <button key={track.id} className={soundPreset === track.id ? "active" : ""} onClick={() => chooseSound(track.id)}>
              {track.label}
            </button>
          ))}
          <small>spesial sound</small>
          {!specialSoundUnlocked && (
            <button className="special" onClick={() => chooseSound("special-bidadari")}>Unlock Special Sound</button>
          )}
          {specialSoundUnlocked &&
            specialTracks.map((track) => (
              <button key={track.id} className={soundPreset === track.id ? "active special" : "special"} onClick={() => chooseSound(track.id)}>
                {track.label}
              </button>
            ))}
        </div>
        <label className="slider-row">
          <span>Volume</span>
          <input type="range" min="0" max="1" step="0.01" value={volume} onChange={(event) => setVolume(Number(event.target.value))} />
          <strong>{Math.round(volume * 100)}%</strong>
        </label>
        <label className="slider-row">
          <span>Kecerahan</span>
          <input type="range" min="0.45" max="1.25" step="0.01" value={brightness} onChange={(event) => setBrightness(Number(event.target.value))} />
          <strong>{Math.round(brightness * 100)}%</strong>
        </label>
        <label className="slider-row">
          <span>Sensitivitas mouse</span>
          <input type="range" min="0.45" max="1.8" step="0.01" value={mouseSensitivity} onChange={(event) => setMouseSensitivity(Number(event.target.value))} />
          <strong>{mouseSensitivity.toFixed(2)}x</strong>
        </label>
        <label className="slider-row">
          <span>Jarak kamera</span>
          <input type="range" min="0" max="1" step="0.01" value={cameraZoom} onChange={(event) => setCameraZoom(Number(event.target.value))} />
          <strong>{Math.round((1 - cameraZoom) * 100)}%</strong>
        </label>
        <div className="settings-row">
          <span>Kompas anomali</span>
          <button onClick={() => setShowCompass((value) => !value)}>{showCompass ? "On" : "Off"}</button>
        </div>
      </div>
    </div>
  );
}

function SpecialSoundModal({ code, error, setCode, onSubmit, onClose }) {
  return (
    <div className="modal">
      <form className="modal-card small-card" onSubmit={onSubmit}>
        <button className="close-button" type="button" onClick={onClose}>x</button>
        <span className="kicker">Special Sound</span>
        <h2>Kirimkan 6 kode berharga</h2>
        <input value={code} onChange={(event) => setCode(event.target.value)} placeholder="Kode spesial" inputMode="numeric" maxLength={6} autoFocus />
        <button>Unlock</button>
        {error && <small>{error}</small>}
      </form>
    </div>
  );
}

function HelpModal({ onClose }) {
  return (
    <div className="modal">
      <div className="modal-card small-card">
        <button className="close-button" type="button" onClick={onClose}>x</button>
        <span className="kicker">Help</span>
        <h2>Shortcut</h2>
        <ul className="help-list">
          <li><strong>WASD</strong><span>Bergerak</span></li>
          <li><strong>Shift + W</strong><span>Berlari</span></li>
          <li><strong>Space</strong><span>Melompat</span></li>
          <li><strong>Mouse drag</strong><span>Lihat kiri, kanan, atas, bawah</span></li>
          <li><strong>Scroll</strong><span>Zoom kamera</span></li>
          <li><strong>Esc</strong><span>Ganti mode kamera</span></li>
          <li><strong>Klik anomali</strong><span>Buka pertanyaan</span></li>
        </ul>
      </div>
    </div>
  );
}

function AnomalyModal({ anomaly, onSolve, onCancel }) {
  const [answer, setAnswer] = useState("");
  const [error, setError] = useState("");

  return (
    <div className="modal">
      <div className="modal-card">
        <span className="kicker">{anomaly.title}</span>
        <h2>{anomaly.question}</h2>
        <div className="self-note">pertanyaan ini dari dirimu untuk dirimu</div>
        <p>Tidak ada jawaban benar atau salah. Tulis jawaban jujurmu, lalu submit untuk menyimpan jawaban dan membuka clue berikutnya.</p>
        <form
          onSubmit={(event) => {
            event.preventDefault();
            const solved = onSolve(answer);
            if (!solved) setError("Jawaban perlu diisi dulu supaya clue berikutnya terbuka.");
          }}
        >
          <textarea value={answer} onChange={(event) => setAnswer(event.target.value)} placeholder="Tulis jawabanmu..." autoFocus />
          <button>Submit</button>
          <button type="button" onClick={onCancel}>Cancel</button>
        </form>
        {error && <small>{error}</small>}
      </div>
    </div>
  );
}

function ClueCard({ clue, onClose }) {
  return (
    <aside className="clue-card">
      <button className="close-button" type="button" onClick={onClose} aria-label="Close clue">x</button>
      <span className="kicker">Clue</span>
      <p>{clue}</p>
    </aside>
  );
}

function FinaleOverlay({
  step,
  wishes,
  gratitudes,
  codeInput,
  codeError,
  candlesOut,
  playerName,
  onSubmitWishes,
  onSubmitGratitudes,
  onCodeInput,
  onSubmitCode,
  onBlow,
  onMicBlow,
  onRestart,
}) {
  if (step === "wishes") return <ListPrompt key="wishes" title="Sebutkan 6 harapan kamu di tahun ini" count={6} values={wishes} onSubmit={onSubmitWishes} />;
  if (step === "gratitude") return <ListPrompt key="gratitude" title="11 hal yang kamu syukuri selama hidup sampai saat ini" count={11} values={gratitudes} onSubmit={onSubmitGratitudes} />;
  if (step === "code") {
    return (
      <div className="modal">
        <form className="modal-card small-card code-card" onSubmit={onSubmitCode}>
          <span className="kicker">Kode terakhir</span>
          <h2>Masukkan kode 4 angka</h2>
          <p>kamu pasti tau kodenya berada, runutkan kejadian</p>
          <input value={codeInput} onChange={(event) => onCodeInput(event.target.value)} placeholder="Kode" inputMode="numeric" maxLength={4} autoFocus />
          <button>Submit Kode</button>
          {codeError && <small>{codeError}</small>}
        </form>
      </div>
    );
  }
  if (step === "report") {
    return <ReportOverlay playerName={playerName} wishes={wishes} gratitudes={gratitudes} onRestart={onRestart} />;
  }
  return (
    <div className="finale finale-large birthday-full">
      <div className="confetti" aria-hidden="true">
        {Array.from({ length: 34 }, (_, index) => (
          <i key={index} style={{ "--x": `${(index % 17) * 6}%`, "--delay": `${(index % 8) * 0.16}s`, "--color": ["#ffd166", "#66e3ff", "#ff6b9a", "#9cff8f"][index % 4] }} />
        ))}
      </div>
      <span className="kicker">Happy Life for Love</span>
      <h2>Selamat Ulang Tahun!</h2>
      <div className="cake-anim cake-big" aria-hidden="true">
        {!candlesOut && <span className="candle" />}
        <span className="cake-top" />
        <span className="cake-bottom" />
      </div>
      <p>
        makin ke sini aku makin sadar kalau kehadiran kamu bukan cuma bikin aku merasa dicintai, tapi juga bikin hidupku terasa lebih utuh. Dari banyaknya orang di dunia ini, aku bersyukur karena yang berjalan bareng aku adalah kamu. Aku suka cara kamu peduli, cara kamu memahami hal-hal kecil tentang aku, dan cara kamu tetap jadi diri sendiri tanpa harus jadi sempurna. Aku harap kamu tahu kalau kamu berharga banget buat aku, lebih dari yang mungkin sering bisa aku ungkapin. Aku nggak cuma sayang sama kamu karena kita bahagia bareng, tapi karena aku benar-benar melihat kamu sebagai seseorang yang ingin terus aku pilih, aku jaga, dan aku perjuangkan. Di umur baruku nanti, salah satu hal yang paling aku syukuri adalah masih bisa punya kamu di hidupku
      </p>
      {!candlesOut && (
        <div className="actions">
          <button onClick={onMicBlow}>Tiup Lilin</button>
          <button onClick={onBlow}>Matikan Lilin</button>
        </div>
      )}
    </div>
  );
}

function ListPrompt({ title, count, values, onSubmit }) {
  const [items, setItems] = useState(() => Array.from({ length: count }, (_, index) => values[index] || ""));
  const [error, setError] = useState("");

  useEffect(() => {
    setItems(Array.from({ length: count }, (_, index) => values[index] || ""));
    setError("");
  }, [count, values]);

  function submit(event) {
    event.preventDefault();
    if (items.some((item) => !item.trim())) {
      setError("Semua kolom perlu diisi dulu.");
      return;
    }
    onSubmit(items.map((item) => item.trim()));
  }

  return (
    <div className="modal">
      <form className="modal-card list-card" onSubmit={submit}>
        <span className="kicker">Refleksi lanjutan</span>
        <h2>{title}</h2>
        <div className="list-inputs">
          {Array.from({ length: count }, (_, index) => (
            <label key={index}>
              <span>{index + 1}</span>
              <input
                value={items[index] || ""}
                onChange={(event) =>
                  setItems((current) => {
                    const next = Array.from({ length: count }, (_, itemIndex) => current[itemIndex] || "");
                    next[index] = event.target.value;
                    return next;
                  })
                }
                placeholder={count === 6 ? "Harapan..." : "Hal yang disyukuri..."}
              />
            </label>
          ))}
        </div>
        <button>Submit</button>
        {error && <small>{error}</small>}
      </form>
    </div>
  );
}

function ReportOverlay({ playerName, wishes, gratitudes, onRestart }) {
  const answers = useMemo(() => {
    try {
      return JSON.parse(localStorage.getItem(ANSWER_STORAGE_KEY) || "[]");
    } catch {
      return [];
    }
  }, []);

  function savePdf() {
    const html = buildReportHtml({ playerName, answers, wishes, gratitudes });
    const reportWindow = window.open("", "_blank");
    if (!reportWindow) return;
    reportWindow.document.write(html);
    reportWindow.document.close();
    reportWindow.focus();
    reportWindow.print();
  }

  return (
    <div className="finale finale-large">
      <span className="kicker">Reflection Report</span>
      <h2>Jawabanmu sudah menjadi peta kecil tentang dirimu.</h2>
      <p>PDF berisi jawaban, harapan, rasa syukur, kesimpulan, insight, dan hal-hal yang mungkin membuatmu bahagia dari hasil refleksimu sendiri.</p>
      <div className="actions">
        <button onClick={savePdf}>Simpan PDF</button>
        <button onClick={onRestart}>Restart Game</button>
      </div>
    </div>
  );
}

function buildReportHtml({ playerName, answers, wishes, gratitudes }) {
  const analysis = analyzeResult({ answers, wishes, gratitudes });
  const insight = [
    analysis.result,
    analysis.encouragement,
    analysis.action,
  ];
  const escape = (value) => String(value).replace(/[&<>"']/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#039;" }[char]));
  const list = (items) => items.map((item) => `<li>${escape(item)}</li>`).join("");
  const answerBlocks = answers.map((item) => `<section><h3>${escape(item.title)}</h3><p><strong>Pertanyaan:</strong> ${escape(item.question)}</p><p>${escape(item.answer)}</p></section>`).join("");

  return `<!doctype html>
<html>
<head>
  <title>Reflection Report</title>
  <style>
    @page { margin: 18mm; }
    body { margin: 0; font-family: Inter, Arial, sans-serif; color: #f8fff9; background: #050817; }
    .page { min-height: 100vh; padding: 34px; background: radial-gradient(circle at 20% 10%, rgba(102,227,255,.24), transparent 28%), radial-gradient(circle at 80% 20%, rgba(255,107,154,.22), transparent 24%), linear-gradient(135deg, #071020, #0b1d14 70%); }
    h1 { font-size: 42px; margin: 0 0 8px; }
    h2 { color: #ffd166; margin-top: 30px; }
    h3 { margin-bottom: 6px; color: #9cff8f; }
    p, li { line-height: 1.55; font-size: 14px; }
    section, .panel { border: 1px solid rgba(255,255,255,.16); border-radius: 10px; padding: 16px; margin: 12px 0; background: rgba(255,255,255,.06); }
    ul { padding-left: 22px; }
    .stars { letter-spacing: 8px; color: #fff7c7; margin: 12px 0 24px; }
    @media print { body { -webkit-print-color-adjust: exact; print-color-adjust: exact; } }
  </style>
</head>
<body>
  <main class="page">
    <div class="stars">✦ ✧ ✦ ✧ ✦</div>
    <h1>Reflection Report untuk ${escape(playerName)}</h1>
    <p>Dokumen ini merangkum jawaban refleksi, harapan, rasa syukur, dan insight dari perjalanan menemukan anomali.</p>
    <h2>Jawaban Refleksi</h2>
    ${answerBlocks}
    <h2>6 Harapan Tahun Ini</h2>
    <div class="panel"><ol>${list(wishes)}</ol></div>
    <h2>11 Hal yang Disyukuri</h2>
    <div class="panel"><ol>${list(gratitudes)}</ol></div>
    <h2>Kesimpulan dan Insight</h2>
    <div class="panel">
      <p><strong>Self-Healing State:</strong> ${escape(analysis.deep.state)} - ${escape(analysis.deep.name)}</p>
      <p><strong>Arah Kompas:</strong> ${escape(analysis.compass.label)}</p>
      <p><strong>Jangkar Hidup:</strong> ${escape(analysis.anchor.label)}</p>
    </div>
    <div class="panel"><ul>${list(insight)}</ul></div>
  </main>
</body>
</html>`;
}

function analyzeResult({ answers, wishes, gratitudes }) {
  const deep = pickBestCategory(
    answers.map((item) => item.answer).join(" "),
    [
      {
        state: "The Lost Soul",
        name: "Kehilangan Arah",
        keywords: ["bingung", "tidak tahu", "mengikuti orang", "takut salah", "topeng"],
        message: "Saat ini kamu merasa seperti tamu di hidupmu sendiri. Tidak apa-apa, mari pelan-pelan temukan kembali suaramu.",
        greeting: "Halo, Jiwa yang Sedang Mencari Jalan.",
      },
      {
        state: "The Inner Critic",
        name: "Penghakiman Diri",
        keywords: ["salahku", "menyesal", "malu", "benci diri", "bodoh"],
        message: "Suara di kepalamu mungkin sedang sangat keras menghujat, tapi ingatlah bahwa kamu yang sekarang sudah berbeda dengan kamu yang dulu.",
        greeting: "Halo, Hati yang Sedang Belajar Memaafkan.",
      },
      {
        state: "The Weary Warrior",
        name: "Pejuang yang Lelah",
        keywords: ["lelah", "capek", "pura-pura", "tuntutan", "beban"],
        message: "Kamu sudah terlalu lama kuat untuk orang lain. Saatnya meletakkan senjata dan beristirahat sejenak.",
        greeting: "Halo, Pejuang yang Sedang Beristirahat.",
      },
      {
        state: "The Rising Sun",
        name: "Mulai Pulih",
        keywords: ["ingin berubah", "mulai sadar", "maafkan", "mencoba"],
        message: "Ada cahaya kecil yang mulai muncul. Kamu sudah siap untuk berdamai dengan masa lalu.",
        greeting: "Halo, Cahaya yang Mulai Pulang.",
      },
    ]
  );

  const compass = pickBestCategory(
    wishes.join(" "),
    [
      { label: "Kemandirian", keywords: ["belajar", "mandiri", "sukses sendiri", "skill"], message: "kompas hidupmu sedang mengarah pada kemampuan berdiri di atas kakimu sendiri." },
      { label: "Kasih Sayang", keywords: ["pasangan", "menikah", "diterima", "dipeluk"], message: "kompas hidupmu sedang mencari hubungan yang menerima dan menghangatkan." },
      { label: "Ketenangan", keywords: ["tidur nyenyak", "tidak cemas", "tenang", "hening"], message: "kompas hidupmu mengarah pada damai yang sederhana dan ruang batin yang lebih lapang." },
      { label: "Kebebasan", keywords: ["bebas", "keluar", "resign", "melepaskan"], message: "kompas hidupmu sedang meminta ruang untuk lepas dari hal yang terasa mengikat." },
      { label: "Keamanan", keywords: ["uang", "tabungan", "rumah", "aman"], message: "kompas hidupmu sedang mengarah pada rasa aman, stabilitas, dan pegangan yang nyata." },
      { label: "Kebermaknaan", keywords: ["orang tua", "bermanfaat", "berbakti"], message: "kompas hidupmu mencari hidup yang terasa berguna dan terhubung dengan orang yang kamu sayangi." },
    ]
  );

  const anchor = pickBestCategory(
    gratitudes.join(" "),
    [
      { label: "Syukur Fisik", keywords: ["nafas", "jalan", "makan", "tidur"], message: "Jangkarmu adalah kesadaran akan hidup." },
      { label: "Syukur Pendukung", keywords: ["sahabat", "teman", "support system", "keluarga"], message: "Jangkarmu adalah cinta dari sesama." },
      { label: "Syukur Spiritual", keywords: ["tuhan", "doa", "ibadah", "iman"], message: "Jangkarmu adalah iman." },
      { label: "Syukur Alam", keywords: ["hujan", "senja", "udara", "alam"], message: "Jangkarmu adalah harmoni alam." },
      { label: "Syukur Penderitaan", keywords: ["masalah", "gagal", "luka", "jatuh"], message: "Jangkarmu adalah ketangguhan jiwa." },
      { label: "Syukur Diri", keywords: ["diri", "bertahan", "kuat", "hidup"], message: "Jangkarmu adalah keberanianmu untuk tetap bertahan." },
      { label: "Syukur Kesempatan", keywords: ["kerja", "kuliah", "belajar", "kesempatan"], message: "Jangkarmu adalah peluang untuk terus bertumbuh." },
      { label: "Syukur Cinta", keywords: ["cinta", "sayang", "pasangan", "dipilih"], message: "Jangkarmu adalah rasa dicintai dan kemampuan untuk mencintai." },
      { label: "Syukur Rumah", keywords: ["rumah", "tempat pulang", "kamar"], message: "Jangkarmu adalah tempat yang membuatmu merasa pulang." },
      { label: "Syukur Harapan", keywords: ["mimpi", "harapan", "masa depan"], message: "Jangkarmu adalah keyakinan bahwa hari esok masih bisa lebih baik." },
      { label: "Syukur Kecil", keywords: ["kopi", "musik", "makanan", "tertawa", "senyum"], message: "Jangkarmu adalah hal-hal kecil yang diam-diam menyelamatkan hari." },
    ]
  );

  return {
    deep,
    compass,
    anchor,
    result: `${deep.greeting} Dari jawabanmu, aku melihat ${deep.message.toLowerCase()} Di saat yang sama, ${compass.message} Dan yang membuatmu tetap bertahan adalah ini: ${anchor.message} Kamu tidak harus menyelesaikan semuanya hari ini. Cukup izinkan dirimu berjalan dengan lebih jujur.`,
    encouragement: "Sembuh bukan berarti kamu harus sempurna. Sembuh berarti kamu mengizinkan dirimu untuk menjadi manusia biasa lagi.",
    action: "Action plan kecil: pilih satu hal yang paling terasa dekat dari report ini, lalu lakukan satu langkah kecil dalam 24 jam ke depan.",
  };
}

function pickBestCategory(text, categories) {
  const normalized = text.toLowerCase();
  const scored = categories.map((category) => ({
    ...category,
    score: category.keywords.reduce((total, keyword) => total + (normalized.includes(keyword.toLowerCase()) ? 1 : 0), 0),
  }));
  return scored.sort((a, b) => b.score - a.score)[0] || categories[0];
}

function analyzeReflection(answers) {
  const text = answers.map((item) => item.answer).join(" ").toLowerCase();
  const categories = [
    {
      label: "The Burnout / Overwhelmed",
      keywords: ["lelah", "harus", "tuntutan", "orang lain", "capek", "terserah", "beban", "dituntut", "ekspektasi"],
      summary: "Dari jawabanmu, terlihat ada bagian dirimu yang sering mencoba kuat terlalu lama. Kamu seperti pelindung bagi banyak hal, tapi juga sedang belajar memberi ruang bernapas untuk dirimu sendiri.",
      encouragement: "Dunia tidak akan runtuh hanya karena kamu memilih dirimu sendiri sekali saja. Kamu berharga bukan hanya karena yang kamu lakukan, tapi juga karena kamu ada.",
      action: "Action plan kecil: pilih satu hal hari ini yang kamu lakukan bukan karena harus, tapi karena tubuh dan hatimu memang butuh jeda.",
    },
    {
      label: "The Inner Critic",
      keywords: ["maaf", "salahku", "gagal", "benci", "malu", "seharusnya", "menyalahkan", "takut", "luka"],
      summary: "Jawabanmu membawa kesan bahwa ada suara batin yang cukup keras menilai dirimu. Mungkin ada bagian lama yang belum sepenuhnya merasa aman untuk dimaafkan.",
      encouragement: "Maafkan versi dirimu yang dulu belum tahu apa yang kamu tahu sekarang. Ia mungkin tidak sempurna, tapi ia sudah berusaha bertahan.",
      action: "Action plan kecil: tulis satu kalimat maaf untuk dirimu sendiri, lalu baca pelan-pelan tanpa mencoba membantahnya.",
    },
    {
      label: "The Seeker (Ready to Heal)",
      keywords: ["ingin", "mulai", "belajar", "sadar", "mencoba", "mungkin", "berubah", "tumbuh", "berani"],
      summary: "Dari jawabanmu, ada tanda bahwa dirimu sedang mencari arah yang lebih jujur. Kamu mungkin belum punya semua jawaban, tapi sudah mulai mendengar suara kecil di dalam diri.",
      encouragement: "Tidak apa-apa berjalan pelan. Kesadaran kecil yang kamu punya hari ini bisa menjadi pintu menuju cara hidup yang lebih lembut dan lebih utuh.",
      action: "Action plan kecil: lakukan satu percakapan jujur dengan dirimu sendiri, tanpa target menjadi benar, hanya hadir dan mendengar.",
    },
  ];

  const scored = categories.map((category) => ({
    ...category,
    score: category.keywords.reduce((total, keyword) => total + (text.includes(keyword) ? 1 : 0), 0),
  }));
  return scored.sort((a, b) => b.score - a.score)[0] || categories[2];
}

function useAudioManager() {
  const ctx = useRef(null);
  const forestGain = useRef(null);
  const forestNodes = useRef([]);
  const mediaAudio = useRef(null);
  const masterVolume = useRef(0.55);

  function ensureContext() {
    if (ctx.current) return ctx.current;
    const AudioContext = window.AudioContext || window.webkitAudioContext;
    ctx.current = new AudioContext();
    forestGain.current = ctx.current.createGain();
    forestGain.current.gain.value = 0.16 * masterVolume.current;
    forestGain.current.connect(ctx.current.destination);
    return ctx.current;
  }

  function setVolume(value) {
    masterVolume.current = value;
    if (forestGain.current) forestGain.current.gain.value = 0.16 * value;
    if (mediaAudio.current) mediaAudio.current.volume = value;
  }

  function tone(freq, duration, type = "sine", volume = 0.05, destination = null, delay = 0) {
    const audioContext = ensureContext();
    const start = audioContext.currentTime + delay;
    const osc = audioContext.createOscillator();
    const gain = audioContext.createGain();
    osc.type = type;
    osc.frequency.value = freq;
    gain.gain.setValueAtTime(0.0001, start);
    gain.gain.exponentialRampToValueAtTime(volume, start + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.0001, start + duration);
    osc.connect(gain);
    gain.connect(destination || audioContext.destination);
    osc.start(start);
    osc.stop(start + duration + 0.05);
  }

  async function startForest(preset = "memories") {
    stopForest();

    const mediaTrack = [...SOUND_TRACKS, ...SPECIAL_SOUND_TRACKS].find((track) => track.id === preset);
    if (mediaTrack) {
      try {
        let audio = mediaAudio.current;
        if (!audio) {
          audio = document.createElement("audio");
          audio.preload = "auto";
          audio.playsInline = true;
          audio.setAttribute("playsinline", "");
          document.body.appendChild(audio);
          mediaAudio.current = audio;
        }
        audio.pause();
        audio.src = mediaTrack.src;
        audio.loop = true;
        audio.muted = false;
        audio.volume = masterVolume.current;
        audio.load();
        await audio.play();
        return true;
      } catch {
        stopForest();
        return startGeneratedForest(preset);
      }
    }

    return startGeneratedForest(preset);
  }

  async function startGeneratedForest(preset = "memories") {
    stopForest();

    const audioContext = ensureContext();
    if (audioContext.state === "suspended") await audioContext.resume();

    const presets = {
      memories: { wind: 1.2, windVol: 0.026, leaves: 780, leavesVol: 0.006, notes: [130.81, 196, 261.63], wave: "sine", pulse: 3600 },
      animal: { wind: 1.7, windVol: 0.018, leaves: 980, leavesVol: 0.004, notes: [261.63, 329.63, 392], wave: "triangle", pulse: 2600 },
      temple: { wind: 0.9, windVol: 0.022, leaves: 520, leavesVol: 0.004, notes: [98, 146.83, 220], wave: "sine", pulse: 5200 },
    };
    const selected = presets[preset] || presets.memories;

    const windNoise = createFilteredNoise(audioContext, selected.wind, selected.windVol, "lowpass");
    const leavesNoise = createFilteredNoise(audioContext, selected.leaves, selected.leavesVol, "bandpass");
    windNoise.connect(forestGain.current);
    leavesNoise.connect(forestGain.current);
    forestNodes.current.push(windNoise, leavesNoise);

    selected.notes.forEach((freq, index) => {
      const osc = audioContext.createOscillator();
      const gain = audioContext.createGain();
      const lfo = audioContext.createOscillator();
      const lfoGain = audioContext.createGain();
      osc.type = selected.wave;
      osc.frequency.value = freq;
      gain.gain.value = 0.002 + index * 0.0009;
      lfo.frequency.value = 0.018 + index * 0.01;
      lfoGain.gain.value = 0.001;
      lfo.connect(lfoGain);
      lfoGain.connect(gain.gain);
      osc.connect(gain);
      gain.connect(forestGain.current);
      osc.start();
      lfo.start();
      forestNodes.current.push(osc, lfo);
    });

    const birdTimer = window.setInterval(() => {
      if (Math.random() > 0.82) {
        const base = preset === "animal" ? 620 + Math.random() * 220 : 480 + Math.random() * 140;
        tone(base, 0.18, selected.wave, 0.004, forestGain.current);
        tone(base * 1.12, 0.16, selected.wave, 0.003, forestGain.current, 0.16);
      }
    }, selected.pulse);
    forestNodes.current.push({ stop: () => window.clearInterval(birdTimer) });
    return true;
  }

  function createFilteredNoise(audioContext, frequency, volume, type) {
    const bufferSize = audioContext.sampleRate * 2;
    const buffer = audioContext.createBuffer(1, bufferSize, audioContext.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i += 1) {
      data[i] = Math.random() * 2 - 1;
    }

    const source = audioContext.createBufferSource();
    const filter = audioContext.createBiquadFilter();
    const gain = audioContext.createGain();
    source.buffer = buffer;
    source.loop = true;
    filter.type = type;
    filter.frequency.value = frequency;
    filter.Q.value = type === "bandpass" ? 0.65 : 0.35;
    gain.gain.value = volume;
    source.connect(filter);
    filter.connect(gain);
    source.start();
    gain.stop = () => source.stop();
    return gain;
  }

  function stopForest() {
    if (mediaAudio.current) {
      mediaAudio.current.pause();
      mediaAudio.current.currentTime = 0;
      mediaAudio.current.removeAttribute("src");
      mediaAudio.current.load();
    }
    forestNodes.current.forEach((node) => {
      try {
        node.stop();
      } catch {
        /* noop */
      }
    });
    forestNodes.current = [];
  }

  function playAchievement() {
    [523, 659, 784].forEach((freq, index) => tone(freq, 0.16, "triangle", 0.04, null, index * 0.08));
  }

  function playCheer() {
    [523, 659, 784, 1046, 1318].forEach((freq, index) => tone(freq, 0.24, "triangle", 0.052, null, index * 0.06));
  }

  function playBirthdayTheme() {
    const notes = [
      [392, 0], [392, 0.38], [440, 0.76], [392, 1.32], [523, 1.9], [494, 2.55],
      [392, 3.55], [392, 3.93], [440, 4.31], [392, 4.87], [587, 5.45], [523, 6.1],
      [392, 7.1], [392, 7.48], [784, 7.86], [659, 8.42], [523, 9.0], [494, 9.52], [440, 10.04],
      [698, 11.0], [698, 11.38], [659, 11.76], [523, 12.32], [587, 12.9], [523, 13.55],
    ];
    notes.forEach(([freq, delay]) => tone(freq, 0.34, "triangle", 0.07, null, delay));
  }

  return { startForest, stopForest, playAchievement, playBirthdayTheme, playCheer, setVolume };
}

async function listenForBlow(onBlow) {
  const AudioContext = window.AudioContext || window.webkitAudioContext;
  const audioContext = new AudioContext();
  const stream = await navigator.mediaDevices.getUserMedia({ audio: true, video: true });
  const audioTracks = stream.getAudioTracks();
  const audioStream = new MediaStream(audioTracks);
  const source = audioContext.createMediaStreamSource(audioStream);
  const analyser = audioContext.createAnalyser();
  analyser.fftSize = 1024;
  source.connect(analyser);

  const data = new Uint8Array(analyser.fftSize);
  let hotFrames = 0;
  let motionFrames = 0;
  const video = document.createElement("video");
  video.muted = true;
  video.playsInline = true;
  video.srcObject = stream;
  await video.play();
  const canvas = document.createElement("canvas");
  const context = canvas.getContext("2d", { willReadFrequently: true });
  canvas.width = 80;
  canvas.height = 60;
  let previousFrame = null;

  function tick() {
    analyser.getByteTimeDomainData(data);
    const rms = Math.sqrt(data.reduce((sum, value) => sum + (value - 128) ** 2, 0) / data.length);
    const db = 20 * Math.log10(rms / 128);
    if (db > -18) hotFrames += 1;
    else hotFrames = Math.max(0, hotFrames - 1);

    if (video.readyState >= 2) {
      context.drawImage(video, 0, 0, canvas.width, canvas.height);
      const frame = context.getImageData(0, 0, canvas.width, canvas.height).data;
      if (previousFrame) {
        let diff = 0;
        for (let i = 0; i < frame.length; i += 16) diff += Math.abs(frame[i] - previousFrame[i]);
        const motion = diff / (frame.length / 16);
        if (motion > 12) motionFrames += 1;
        else motionFrames = Math.max(0, motionFrames - 1);
      }
      previousFrame = new Uint8ClampedArray(frame);
    }

    if (hotFrames > 4 || motionFrames > 8) {
      stream.getTracks().forEach((track) => track.stop());
      audioContext.close();
      onBlow();
      return;
    }
    requestAnimationFrame(tick);
  }
  tick();
}

createRoot(document.getElementById("root")).render(<App />);
