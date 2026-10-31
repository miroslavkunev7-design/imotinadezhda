import { Canvas, useLoader } from "@react-three/fiber";
import { Suspense, useEffect, useState } from "react";
import { SRGBColorSpace, TextureLoader } from "three";
import type { ThemeMode } from "./UtilityDock";

function PhotoPlane({ url }: { url: string }) {
  const texture = useLoader(TextureLoader, url);
  texture.colorSpace = SRGBColorSpace;
  return (
    <mesh scale={[19.2, 10.8, 1]} position={[0, 0, -1]}>
      <planeGeometry args={[1, 1]} />
      <meshBasicMaterial map={texture} toneMapped={false} />
    </mesh>
  );
}

const BG: Record<ThemeMode, string> = {
  dark: "/crm-home-locked/bg-dark.jpg",
  light: "/crm-home-locked/bg-light.jpg",
};

export function SceneBackdrop({ theme }: { theme: ThemeMode }) {
  const url = BG[theme];
  const [webglOk, setWebglOk] = useState(true);

  useEffect(() => {
    try {
      const canvas = document.createElement("canvas");
      const ok = !!(canvas.getContext("webgl") || canvas.getContext("experimental-webgl"));
      setWebglOk(ok);
    } catch {
      setWebglOk(false);
    }
  }, []);

  return (
    <>
      {/* DOM cover — primary visible backdrop; remounts on theme change */}
      <img
        key={`bg-${theme}`}
        src={url}
        alt=""
        className="crm-locked-fallback-bg"
        data-theme-bg={theme}
      />
      {webglOk ? (
        <Canvas
          key={`r3f-${theme}`}
          className="crm-locked-r3f"
          orthographic
          camera={{ position: [0, 0, 5], zoom: 70 }}
          dpr={[1, 1.5]}
          gl={{ antialias: true, alpha: true }}
          style={{ opacity: 0 }}
          aria-hidden
        >
          <Suspense fallback={null}>
            <PhotoPlane url={url} />
          </Suspense>
        </Canvas>
      ) : null}
    </>
  );
}
