import * as THREE from 'three';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js';
import ThreeJSApp from './ThreeWrap.js';

let engine = new ThreeJSApp();
const nbrOfPoints = 10000;
const minRadius = 80;
const maxRadius = 120;

const planetInfos = [
    { name: 'Mercury', radius: 0.4, distance: 5, color: 0xd8d8d8 },
    { name: 'Venus', radius: 0.6, distance: 8, color: 0xffff00 },
    { name: 'Earth', radius: 0.7, distance: 11, color: 0x0000ff },
    { name: 'Mars', radius: 0.6, distance: 14, color: 0xff0000 },
    { name: 'Jupiter', radius: 0.9, distance: 18, color: 0xff9900 },
    { name: 'Saturn', radius: 1.7, distance: 25, color: 0xffcc99 },
    { name: 'Uranus', radius: 1.6, distance: 30, color: 0x66ccff },
    { name: 'Neptune', radius: 1.5, distance: 35, color: 0x3366ff }
];

let orbitLines = []; // Array to store orbit lines
let composer, bloomPass, points, pointsMaterial;

function createOrbit(distance, segments, thickness) {
    const geometry = new THREE.BufferGeometry();
    const vertices = [];

    for (let i = 0; i <= segments; i++) {
        const theta = (i / segments) * Math.PI * 2;
        vertices.push(distance * Math.cos(theta), 0, distance * Math.sin(theta));
    }

    geometry.setAttribute('position', new THREE.Float32BufferAttribute(vertices, 3));

    const material = new THREE.LineBasicMaterial({ color: 0xffffff, linewidth: thickness });
    const line = new THREE.Line(geometry, material);

    return line;
}

function createRandomPoints(nbrOfPoints, minRadius, maxRadius) {
    const pointsGeometry = new THREE.BufferGeometry();
    const positions = new Float32Array(nbrOfPoints * 3);
    const sizes = new Float32Array(nbrOfPoints);

    for (let i = 0; i < nbrOfPoints; i++) {
        const r = Math.random() * (maxRadius - minRadius) + minRadius;
        const theta = Math.random() * Math.PI * 2;
        const phi = Math.acos(2 * Math.random() - 1);

        positions[i * 3] = r * Math.sin(phi) * Math.cos(theta);
        positions[i * 3 + 1] = r * Math.sin(phi) * Math.sin(theta);
        positions[i * 3 + 2] = r * Math.cos(phi);
        sizes[i] = Math.random() * 5 + 1;
    }

    pointsGeometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    pointsGeometry.setAttribute('size', new THREE.BufferAttribute(sizes, 1));

    const vertexShader = `
        attribute float size;
        varying float vSize;
        uniform float time;
        void main() {
            vSize = size + sin(time);
            vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
            gl_PointSize = vSize * (300.0 / -mvPosition.z);
            gl_Position = projectionMatrix * mvPosition;
        }
    `;

    const fragmentShader = `
        varying float vSize;
        void main() {
            vec2 uv = gl_PointCoord.xy - 0.5;
            float alpha = 1.0 - length(uv) * 9.0;
            gl_FragColor = vec4(1.0, 1.0, 1.0, alpha);
        }
    `;

    pointsMaterial = new THREE.ShaderMaterial({
        uniforms: {
            time: { value: 0.0 }
        },
        vertexShader: vertexShader,
        fragmentShader: fragmentShader,
        blending: THREE.AdditiveBlending,
        transparent: true
    });

    points = new THREE.Points(pointsGeometry, pointsMaterial);

    return points;
}

function customInit() {
    // Create a sun
    const sunGeometry = new THREE.SphereGeometry(3, 32, 32);
    const sunMaterial = new THREE.MeshBasicMaterial({ color: 0xffff00 });
    const sun = new THREE.Mesh(sunGeometry, sunMaterial);
    sun.position.set(0, 0, 0);
    engine.scene.add(sun);

    // Create planets based on global planetInfos
    planetInfos.forEach((planetInfo, index) => {
        const planetGeometry = new THREE.SphereGeometry(planetInfo.radius, 32, 32);
        const planetMaterial = new THREE.MeshBasicMaterial({ color: planetInfo.color });
        
        // Calculate position relative to the sun
        const angle = index * Math.PI * 2 / planetInfos.length;
        const x = planetInfo.distance * Math.cos(angle);
        const z = planetInfo.distance * Math.sin(angle);

        // Create orbit line with thickness
        const orbitLine = createOrbit(planetInfo.distance, 64, 2); // Adjust thickness here
        engine.scene.add(orbitLine);
        orbitLines.push(orbitLine);

        // Create planet mesh
        const planet = new THREE.Mesh(planetGeometry, planetMaterial);
        planet.position.set(x, 0, z);
        engine.scene.add(planet);

        // Optionally, store planets in an array for future manipulation
        engine[`planet${index}`] = planet;
    });

    // Create random points around the solar system
    points = createRandomPoints(nbrOfPoints, minRadius, maxRadius);
    engine.scene.add(points);

    // Initialize bloom effect
    const renderScene = new RenderPass(engine.scene, engine.camera);
    bloomPass = new UnrealBloomPass(new THREE.Vector2(window.innerWidth, window.innerHeight), 1.5, 0.4, 0.85);
    bloomPass.threshold = 0;
    bloomPass.strength = 1.5; // Bloom strength
    bloomPass.radius = 0;

    composer = new EffectComposer(engine.renderer);
    composer.addPass(renderScene);
    composer.addPass(bloomPass);

    // Ensure the camera is positioned to view the scene
    engine.camera.position.set(0, 15, 40);
    engine.camera.lookAt(0, 0, 0);
}

// Custom update function to animate planets
function customUpdate() {
    // Define orbit speeds (radians per frame)
    const orbitSpeeds = [
        0.03,   // Mercury
        0.02,   // Venus
        0.015,  // Earth
        0.01,   // Mars
        0.006,  // Jupiter
        0.004,  // Saturn
        0.003,  // Uranus
        0.002   // Neptune
    ];

    // Update planet positions based on their orbits around the sun
    planetInfos.forEach((planetInfo, index) => {
        const orbitSpeed = orbitSpeeds[index] * 40;
        const angle = orbitSpeed * engine.clock.getElapsedTime();
        const planet = engine[`planet${index}`];

        // Update position using trigonometric functions
        const x = planetInfo.distance * Math.cos(angle);
        const z = planetInfo.distance * Math.sin(angle);
        planet.position.set(x, 0, z);
    });

    // Animate the points to shimmer
    const time = engine.clock.getElapsedTime();
    pointsMaterial.uniforms.time.value = time;

    // Render the scene with bloom effect
    composer.render();
}

// Set custom initialization and update functions
engine.setCustomInitFunction(customInit);
engine.setCustomUpdateFunction(customUpdate);

// Initialize scene and start animation
engine.initFunction();
engine.animate();
