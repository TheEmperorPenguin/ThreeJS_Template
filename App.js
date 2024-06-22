import * as THREE from 'three';
import ThreeJSApp from './ThreeWrap.js';

let engine = new ThreeJSApp();

const planetInfos = [
    { name: 'Mercury', radius: 0.1, distance: 5, color: 0xd8d8d8 },
    { name: 'Venus', radius: 0.3, distance: 8, color: 0xffff00 },
    { name: 'Earth', radius: 0.4, distance: 11, color: 0x0000ff },
    { name: 'Mars', radius: 0.3, distance: 14, color: 0xff0000 },
    { name: 'Jupiter', radius: 0.9, distance: 18, color: 0xff9900 },
    { name: 'Saturn', radius: 1.7, distance: 25, color: 0xffcc99 },
    { name: 'Uranus', radius: 1.6, distance: 30, color: 0x66ccff },
    { name: 'Neptune', radius: 1.5, distance: 35, color: 0x3366ff }
];

let orbitLines = []; // Array to store orbit lines

function customInit() {
    // Create a sun
    const sunGeometry = new THREE.SphereGeometry(2, 32, 32);
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

        // Create a thin ring geometry
        const orbitLineGeometry = new THREE.RingGeometry(planetInfo.distance - 0.01, planetInfo.distance + 0.01, 64);
        const orbitLineMaterial = new THREE.MeshBasicMaterial({ color: 0xffffff, side: THREE.DoubleSide });
        const orbitLine = new THREE.Mesh(orbitLineGeometry, orbitLineMaterial);
        orbitLine.position.set(0, 0, 0);
        orbitLine.rotation.x = -Math.PI / 2; // Rotate to be in the x-z plane
        engine.scene.add(orbitLine);
        orbitLines.push(orbitLine);

        // Create planet mesh
        const planet = new THREE.Mesh(planetGeometry, planetMaterial);
        planet.position.set(x, 0, z);
        engine.scene.add(planet);

        // Optionally, store planets in an array for future manipulation
        engine[`planet${index}`] = planet;
    });

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
        const orbitSpeed = orbitSpeeds[index] * 40.;
        const angle = orbitSpeed * engine.clock.getElapsedTime();
        const planet = engine[`planet${index}`];

        // Update position using trigonometric functions
        const x = planetInfo.distance * Math.cos(angle);
        const z = planetInfo.distance * Math.sin(angle);
        planet.position.set(x, 0, z);
    });
}

// Set custom initialization and update functions
engine.setCustomInitFunction(customInit);
engine.setCustomUpdateFunction(customUpdate);

// Initialize scene and start animation
engine.initFunction();
engine.animate();
