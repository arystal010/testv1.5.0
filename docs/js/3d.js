// docs/js/3d.js
//
// Arys AI v1.5.1 — Lightweight 3D particle background with Three.js
// Falls back to CSS animation if Three.js fails to load

import { isMobile } from "./utils.js";

// ============================================================
// State
// ============================================================
let scene, camera, renderer;
let particles, floaters;
let animationId = null;
let isRunning = false;

// ============================================================
// Initialize Three.js 3D background
// ============================================================
export function init3D() {
    // Don't initialize twice
    if (isRunning) return;

    // Lower settings on mobile
    const particleCount = isMobile() ? 60 : 120;

    try {
        const container = document.getElementById("threeContainer");
        if (!container || container.querySelector("canvas")) return;

        // Scene
        scene = new THREE.Scene();
        scene.background = null;

        // Camera
        camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
        camera.position.z = 30;

        // Renderer
        renderer = new THREE.WebGLRenderer({
            alpha: true,
            antialias: !isMobile(),
            powerPreference: "low-power",
        });
        renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
        renderer.setSize(window.innerWidth, window.innerHeight);
        container.appendChild(renderer.domElement);

        // Particles
        const geometry = new THREE.BufferGeometry();
        const positions = new Float32Array(particleCount * 3);
        const sizes = new Float32Array(particleCount);

        for (let i = 0; i < particleCount; i++) {
            positions[i * 3] = (Math.random() - 0.5) * 60;
            positions[i * 3 + 1] = (Math.random() - 0.5) * 40;
            positions[i * 3 + 2] = (Math.random() - 0.5) * 30 - 10;
            sizes[i] = Math.random() * 0.5 + 0.1;
        }

        geometry.setAttribute("position", new THREE.BufferAttribute(positions, 3));
        geometry.setAttribute("size", new THREE.BufferAttribute(sizes, 1));

        // Material
        const material = new THREE.PointsMaterial({
            color: 0xffffff,
            size: 0.15,
            transparent: true,
            opacity: 0.6,
            blending: THREE.AdditiveBlending,
        });

        particles = new THREE.Points(geometry, material);
        scene.add(particles);

        // Floating geometry
        floaters = [];
        const shapes = [
            { type: "box", size: 1.2, color: 0xffffff, opacity: 0.15 },
            { type: "sphere", size: 0.8, color: 0xffffff, opacity: 0.1 },
            { type: "icosahedron", size: 1.0, color: 0xffffff, opacity: 0.12 },
        ];

        shapes.forEach((shape) => {
            let geom;
            switch (shape.type) {
                case "box":
                    geom = new THREE.BoxGeometry(shape.size, shape.size, shape.size);
                    break;
                case "sphere":
                    geom = new THREE.SphereGeometry(shape.size, 12, 12);
                    break;
                case "icosahedron":
                    geom = new THREE.IcosahedronGeometry(shape.size, 0);
                    break;
                default:
                    geom = new THREE.BoxGeometry(shape.size, shape.size, shape.size);
            }

            const mat = new THREE.MeshBasicMaterial({
                color: shape.color,
                wireframe: true,
                transparent: true,
                opacity: shape.opacity,
            });

            const mesh = new THREE.Mesh(geom, mat);
            mesh.position.set(
                (Math.random() - 0.5) * 30,
                (Math.random() - 0.5) * 20,
                (Math.random() - 0.5) * 20 - 15
            );
            mesh.rotation.set(Math.random() * Math.PI, Math.random() * Math.PI, 0);

            mesh.userData = {
                rotSpeedX: (Math.random() - 0.5) * 0.005,
                rotSpeedY: (Math.random() - 0.5) * 0.005,
                floatSpeed: 0.5 + Math.random() * 0.5,
                floatAmp: 0.5 + Math.random() * 0.5,
                phase: Math.random() * Math.PI * 2,
            };

            scene.add(mesh);
            floaters.push(mesh);
        });

        // Window resize
        window.addEventListener("resize", onResize);

        // Start
        isRunning = true;
        animate();
    } catch (e) {
        console.warn("3D background failed to load:", e.message);
        // Use CSS animation fallback
        setupCSSFallback();
    }
}

// ============================================================
// Animate loop
// ============================================================
function animate() {
    if (!isRunning) return;
    animationId = requestAnimationFrame(animate);

    if (particles) {
        const positions = particles.geometry.attributes.position.array;
        for (let i = 0; i < positions.length; i += 3) {
            positions[i + 1] += Math.sin(Date.now() * 0.0001 + i * 0.1) * 0.002;
            positions[i] += Math.cos(Date.now() * 0.0001 + i * 0.1) * 0.002;
        }
        particles.geometry.attributes.position.needsUpdate = true;
    }

    if (floaters) {
        const time = Date.now() * 0.001;
        floaters.forEach((mesh, idx) => {
            const data = mesh.userData;
            mesh.rotation.x += data.rotSpeedX;
            mesh.rotation.y += data.rotSpeedY;
            mesh.position.y += Math.sin(time * data.floatSpeed + data.phase) * 0.005;
        });
    }

    if (renderer && scene && camera) {
        renderer.render(scene, camera);
    }
}

// ============================================================
// Stop 3D
// ============================================================
export function stop3D() {
    isRunning = false;
    if (animationId) {
        cancelAnimationFrame(animationId);
        animationId = null;
    }
}

// ============================================================
// Clean up
// ============================================================
export function dispose3D() {
    stop3D();

    window.removeEventListener("resize", onResize);

    if (renderer) {
        renderer.dispose();
        const canvas = renderer.domElement;
        if (canvas && canvas.parentNode) {
            canvas.parentNode.removeChild(canvas);
        }
    }

    scene = null;
    camera = null;
    renderer = null;
    particles = null;
    floaters = null;
}

// ============================================================
// Resize handler
// ============================================================
function onResize() {
    if (!camera || !renderer) return;
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
}

// ============================================================
// CSS fallback animation
// ============================================================
function setupCSSFallback() {
    const container = document.getElementById("threeContainer");
    if (!container) return;

    // Create floating particles with CSS
    for (let i = 0; i < 30; i++) {
        const dot = document.createElement("div");
        dot.className = "particle-dot";
        dot.style.cssText = `
            position: absolute;
            width: ${2 + Math.random() * 4}px;
            height: ${2 + Math.random() * 4}px;
            background: rgba(255,255,255,${0.1 + Math.random() * 0.3});
            border-radius: 50%;
            left: ${Math.random() * 100}%;
            top: ${Math.random() * 100}%;
            pointer-events: none;
            animation: floatParticle ${5 + Math.random() * 10}s infinite ease-in-out;
            animation-delay: ${Math.random() * 5}s;
        `;
        container.appendChild(dot);
    }
}