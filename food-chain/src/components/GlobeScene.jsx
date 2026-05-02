import { useEffect, useRef } from 'react';
import * as THREE from 'three';

// Free public-domain Earth texture (NASA Blue Marble via unpkg-hosted copy)
const EARTH_TEXTURE = 'https://unpkg.com/three-globe/example/img/earth-blue-marble.jpg';
const EARTH_BUMP = 'https://unpkg.com/three-globe/example/img/earth-topology.png';

export default function GlobeScene({ zooming }) {
  const mountRef = useRef(null);
  const stateRef = useRef({});

  useEffect(() => {
    const el = mountRef.current;
    const w = el.clientWidth, h = el.clientHeight;

    // Renderer
    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false });
    renderer.setPixelRatio(window.devicePixelRatio);
    renderer.setSize(w, h);
    renderer.setClearColor(0x0d1a12, 1);
    el.appendChild(renderer.domElement);

    // Scene + camera
    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(45, w / h, 0.1, 1000);
    camera.position.z = 2.8;

    // Starfield
    const starGeo = new THREE.BufferGeometry();
    const starCount = 1800;
    const starPos = new Float32Array(starCount * 3);
    for (let i = 0; i < starCount * 3; i++) starPos[i] = (Math.random() - 0.5) * 400;
    starGeo.setAttribute('position', new THREE.BufferAttribute(starPos, 3));
    scene.add(new THREE.Points(starGeo, new THREE.PointsMaterial({ color: 0xffffff, size: 0.18, sizeAttenuation: true })));

    // Ambient + directional light
    scene.add(new THREE.AmbientLight(0x334455, 1.2));
    const sun = new THREE.DirectionalLight(0xfff8e8, 2.2);
    sun.position.set(5, 3, 5);
    scene.add(sun);
    // Tidal blue rim light
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

    // Atmosphere glow
    const atmo = new THREE.Mesh(
      new THREE.SphereGeometry(1.04, 64, 64),
      new THREE.MeshPhongMaterial({
        color: 0x3a7ca8,
        transparent: true,
        opacity: 0.08,
        side: THREE.FrontSide,
      })
    );
    scene.add(atmo);

    // Outer glow ring
    const outerGlow = new THREE.Mesh(
      new THREE.SphereGeometry(1.12, 64, 64),
      new THREE.MeshPhongMaterial({
        color: 0x6b7c5a,
        transparent: true,
        opacity: 0.04,
        side: THREE.BackSide,
      })
    );
    scene.add(outerGlow);

    stateRef.current = { renderer, scene, camera, globe, atmo };

    // Resize
    const onResize = () => {
      const w2 = el.clientWidth, h2 = el.clientHeight;
      camera.aspect = w2 / h2;
      camera.updateProjectionMatrix();
      renderer.setSize(w2, h2);
    };
    window.addEventListener('resize', onResize);

    // Animate
    let frame;
    let startTime = performance.now();
    const animate = () => {
      frame = requestAnimationFrame(animate);
      const t = (performance.now() - startTime) / 1000;
      globe.rotation.y = t * 0.12;
      atmo.rotation.y = t * 0.12;
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

  // Zoom animation: spin faster + push camera in
  useEffect(() => {
    if (!zooming) return;
    const { camera, globe, atmo } = stateRef.current;
    if (!camera) return;
    let start = null;
    const duration = 1200;
    const initZ = camera.position.z;
    const initSpin = globe.rotation.y;

    const tick = (now) => {
      if (!start) start = now;
      const p = Math.min((now - start) / duration, 1);
      const ease = p < 0.5 ? 2 * p * p : -1 + (4 - 2 * p) * p;
      camera.position.z = initZ - ease * 2.4;
      globe.rotation.y = initSpin + ease * Math.PI * 3;
      if (atmo) atmo.rotation.y = globe.rotation.y;
      if (p < 1) requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  }, [zooming]);

  return <canvas ref={mountRef} className="globe-canvas" style={{ display: 'block' }} />;
}
