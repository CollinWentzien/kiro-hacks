import { useEffect, useRef } from 'react';
import * as THREE from 'three';

const EARTH_TEXTURE = 'https://unpkg.com/three-globe/example/img/earth-blue-marble.jpg';
const EARTH_BUMP = 'https://unpkg.com/three-globe/example/img/earth-topology.png';

export default function GlobeScene({ zooming }) {
  const mountRef = useRef(null);
  const stateRef = useRef({});

  useEffect(() => {
    const el = mountRef.current;
    const w = window.innerWidth;
    const h = window.innerHeight;

    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.setSize(w, h);
    renderer.setClearColor(0x0d1a12, 1);
    el.appendChild(renderer.domElement);

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(45, w / h, 0.1, 1000);
    camera.position.z = 2.8;

    // Starfield — spread on a shell between r=8 and r=20 so they're always visible
    const starCount = 2200;
    const starPos = new Float32Array(starCount * 3);
    for (let i = 0; i < starCount; i++) {
      const theta = Math.random() * Math.PI * 2;
      const phi = Math.acos(2 * Math.random() - 1);
      const r = 8 + Math.random() * 12;
      starPos[i * 3]     = r * Math.sin(phi) * Math.cos(theta);
      starPos[i * 3 + 1] = r * Math.sin(phi) * Math.sin(theta);
      starPos[i * 3 + 2] = r * Math.cos(phi);
    }
    const starGeo = new THREE.BufferGeometry();
    starGeo.setAttribute('position', new THREE.BufferAttribute(starPos, 3));
    scene.add(new THREE.Points(starGeo, new THREE.PointsMaterial({
      color: 0xffffff, size: 0.045, sizeAttenuation: true, transparent: true, opacity: 0.9,
    })));

    // Lights
    scene.add(new THREE.AmbientLight(0x334455, 1.2));
    const sun = new THREE.DirectionalLight(0xfff8e8, 2.2);
    sun.position.set(5, 3, 5);
    scene.add(sun);
    const rim = new THREE.DirectionalLight(0x3a7ca8, 0.8);
    rim.position.set(-4, -2, -3);
    scene.add(rim);

    // Globe
    const loader = new THREE.TextureLoader();
    const globe = new THREE.Mesh(
      new THREE.SphereGeometry(1, 64, 64),
      new THREE.MeshPhongMaterial({
        map: loader.load(EARTH_TEXTURE),
        bumpMap: loader.load(EARTH_BUMP),
        bumpScale: 0.04,
        specular: new THREE.Color(0x3a7ca8),
        shininess: 18,
      })
    );
    scene.add(globe);

    // Atmosphere
    const atmo = new THREE.Mesh(
      new THREE.SphereGeometry(1.04, 64, 64),
      new THREE.MeshPhongMaterial({ color: 0x3a7ca8, transparent: true, opacity: 0.08 })
    );
    scene.add(atmo);

    scene.add(new THREE.Mesh(
      new THREE.SphereGeometry(1.12, 64, 64),
      new THREE.MeshPhongMaterial({ color: 0x6b7c5a, transparent: true, opacity: 0.04, side: THREE.BackSide })
    ));

    stateRef.current = { renderer, scene, camera, globe, atmo, spinSpeed: 0.12 };

    const onResize = () => {
      const w2 = window.innerWidth, h2 = window.innerHeight;
      camera.aspect = w2 / h2;
      camera.updateProjectionMatrix();
      renderer.setSize(w2, h2);
    };
    window.addEventListener('resize', onResize);

    let frame;
    const startTime = performance.now();
    const animate = () => {
      frame = requestAnimationFrame(animate);
      const t = (performance.now() - startTime) / 1000;
      const speed = stateRef.current.spinSpeed ?? 0.12;
      globe.rotation.y += speed * (1 / 60);
      atmo.rotation.y = globe.rotation.y;
      renderer.render(scene, camera);
    };
    animate();

    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener('resize', onResize);
      renderer.dispose();
      if (el.contains(renderer.domElement)) el.removeChild(renderer.domElement);
    };
  }, []);

  useEffect(() => {
    if (!zooming) return;
    const { camera } = stateRef.current;
    if (!camera) return;
    let start = null;
    const initZ = camera.position.z;
    const tick = (now) => {
      if (!start) start = now;
      const p = Math.min((now - start) / 1200, 1);
      const easeZoom = p < 0.5 ? 2 * p * p : -1 + (4 - 2 * p) * p;
      // ramp spin speed from 0.12 up to 8 as p increases
      stateRef.current.spinSpeed = 0.12 + p * p * 32;
      camera.position.z = initZ - easeZoom * 2.4;
      if (p < 1) requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  }, [zooming]);

  return (
    <div
      ref={mountRef}
      style={{ position: 'absolute', inset: 0, width: '100%', height: '100%' }}
    />
  );
}
