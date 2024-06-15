import * as THREE from 'three';
// import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { TransformControls } from 'three/examples/jsm/controls/TransformControls.js';
import { OBJLoader } from 'three/examples/jsm/loaders/OBJLoader.js';
import { MTLLoader } from 'three/examples/jsm/loaders/MTLLoader.js';
// import { ViewHelper } from 'https://unpkg.com/three@0.147/examples/jsm/helpers/ViewHelper.js';

import Stats from 'https://cdnjs.cloudflare.com/ajax/libs/stats.js/17/Stats.js';

class OBJ {
    constructor(objPath, mtlPath) {
        this.objPath = objPath;
        this.mtlPath = mtlPath;
        this.object = null;

        this.loadingPromise = new Promise((resolve, reject) => {
            const mtlLoader = new MTLLoader();
            mtlLoader.load(
                mtlPath,
                (materials) => {
                    materials.preload();
                    const objLoader = new OBJLoader();
                    objLoader.setMaterials(materials);
                    objLoader.load(
                        objPath,
                        (object) => {
                            this.object = object;
                            resolve();
                        },
                        (xhr) => {
                            console.log((xhr.loaded / xhr.total * 100) + '% loaded');
                        },
                        (error) => {
                            reject(error);
                            console.error('Failed to load OBJ file:', error);
                        }
                    );
                },
                (xhr) => {
                    console.log((xhr.loaded / xhr.total * 100) + '% loaded');
                },
                (error) => {
                    reject(error);
                    console.error('Failed to load MTL file:', error);
                }
            );
        });
    }

    async add(scene) {
        await this.loadingPromise;
        if (this.object) {
            console.log('All good');
            scene.add(this.object);
        } else {
            console.warn('Object not yet loaded. Make sure to wait for it to load before adding to the scene.');
        }
    }

    async getObject() {
        try {
            return this.object;
        } catch (error) {
            console.error('Failed to get object:', error);
            return null;
        }
    }
}

let clock, scene, camera, renderer, stats;
let directionalLight, ambientLight;
let movementSpeed = 10.;
const keyState = {};
let pitchObject, yawObject;
let lastShootTime = 0;

let isJumping = 0;
let jumpVelocity = 0;
const gravity = 0.005;
const initialJumpVelocity = 0.20;
let isGrounded = true;
const dashDistance = 7.; 
let dashUses = 2; // Allow for two dashes
const mapWidth = 30, mapHeight = 30;
let projectiles = [];
const raycaster = new THREE.Raycaster();

init();
animate();

function init() {
    scene = new THREE.Scene();
    clock = new THREE.Clock();

    // Camera
    camera = new THREE.PerspectiveCamera(90, window.innerWidth / window.innerHeight, 0.1, 1000);

    // Yaw and pitch objects for FPS camera
    pitchObject = new THREE.Object3D();
    yawObject = new THREE.Object3D();
    yawObject.position.set(2, 40, 7); // Starting position
    yawObject.add(pitchObject);
    pitchObject.add(camera);

    scene.add(yawObject);

    // Renderer
    renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.autoClear = false;
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;

    // Stats
    stats = new Stats();
    stats.showPanel(0); // 0: fps, 1: ms, 2: mb, 3+: custom
    document.body.appendChild(stats.dom);

    // Directional Light
    directionalLight = new THREE.PointLight(0xffffff, 1);
    directionalLight.castShadow = true;
    directionalLight.position.set(1, 105, 2);
    directionalLight.shadow.mapSize.set(4096, 4096);

    // Ambient Light
    ambientLight = new THREE.AmbientLight(0x404040); // Soft white light

    // SkyBox
    document.body.appendChild(renderer.domElement);
    const loader = new THREE.CubeTextureLoader();
    const texture = loader.load([
        './src/skybox/right.jpg',
        './src/skybox/left.jpg',
        './src/skybox/top.jpg',
        './src/skybox/bottom.jpg',
        './src/skybox/front.jpg',
        './src/skybox/back.jpg'
    ]);
    scene.background = texture;

    scene.add(ambientLight);
    scene.add(directionalLight);

    for (let i = 0; i < mapWidth; i++) {
        for (let j = 0; j < mapHeight; j++) {
            createRandomCube(i - 5, j - 5, 10);
        }
    }

    initControls();
}

function createRandomCube(i, j, size) {
    const geometry = new THREE.BoxGeometry(size, size * (Math.random() * 2 + 1), size); // Random height
    const material = new THREE.MeshStandardMaterial({ color: Math.random() * 0xffffff });
    const cube = new THREE.Mesh(geometry, material);

    cube.castShadow = true;
    cube.receiveShadow = true;

    // Position the cube within a grid centered at (0, 0)
    cube.position.set(size * i, cube.geometry.parameters.height / 2, size * j);

    scene.add(cube);
}

function initControls() {
    document.addEventListener('keydown', (event) => {
        keyState[event.code] = true;
        onKeyDown(event);
    });
    document.addEventListener('keyup', (event) => {
        onKeyUp(event);
        keyState[event.code] = false;
    });

    document.addEventListener('mousemove', onMouseMove);
    document.addEventListener('mousedown', onMouseDown);
    document.body.addEventListener('click', () => {
        document.body.requestPointerLock();
    });
}

function onMouseMove(event) {
    if (document.pointerLockElement === document.body) {
        const movementX = event.movementX || 0;
        const movementY = event.movementY || 0;

        yawObject.rotation.y -= movementX * 0.002;
        pitchObject.rotation.x -= movementY * 0.002;
        pitchObject.rotation.x = Math.max(-Math.PI / 2, Math.min(Math.PI / 2, pitchObject.rotation.x));
    }
}

function checkObjectsCollision(object1, object2) {
    const box1 = new THREE.Box3().setFromObject(object1);
    const box2 = new THREE.Box3().setFromObject(object2);

    return box1.intersectsBox(box2);
}

function checkCollision() {
    const collisionMargin = 1.0;

    // Get the center of the yawObject (camera's position)
    const cameraPosition = yawObject.position.clone();

    // Create a bounding box around the camera's position
    const objectBB = new THREE.Box3(
        cameraPosition.clone().add(new THREE.Vector3(-collisionMargin, -collisionMargin, -collisionMargin)),
        cameraPosition.clone().add(new THREE.Vector3(collisionMargin, collisionMargin, collisionMargin))
    );

    // Check for collisions with other objects in the scene
    for (let i = 0; i < scene.children.length; i++) {
        const object = scene.children[i];

        if (object !== yawObject && object.name != 'proj') {
            const otherObjectBB = new THREE.Box3().setFromObject(object);

            // Detect collisions
            if (objectBB.intersectsBox(otherObjectBB)) {
                return true;
            }
        }
    }

    return false;
}

function updateCameraPosition() {
    const moveDistance = movementSpeed * clock.getDelta();
    let oldPosition = yawObject.position.clone();

    if (keyState['KeyE']) {
        shootProjectile();
    }
    if (keyState['KeyW']) {
        yawObject.translateZ(-moveDistance);
    }
    if (keyState['KeyS']) {
        yawObject.translateZ(moveDistance);
    }
    if (keyState['KeyA']) {
        yawObject.translateX(-moveDistance);
    }
    if (keyState['KeyD']) {
        yawObject.translateX(moveDistance);
    }

    if (keyState['Space'] && (isGrounded || isJumping === 1)) {
        isJumping += 1;
        jumpVelocity = initialJumpVelocity;
        isGrounded = false;
    }

    // Handle jumping and falling
    if (isJumping > 0 && isJumping < 3) {
        yawObject.position.y += jumpVelocity;
        jumpVelocity -= gravity; // Gravity reduces the upward velocity

        // Check if peak of jump is reached
        if (jumpVelocity <= 0) {
            if (isJumping === 2) {
                isJumping = 0; // End second jump
            } else {
                isJumping = 1; // End first jump, allow for potential second jump
            }
        }
    } else {
        if (!isGrounded) {
            yawObject.position.y -= jumpVelocity; // Apply downward velocity
            jumpVelocity += gravity; // Gravity increases the downward velocity
        }
    }

    // Check for collisions and ground
    if (checkCollision()) {
        yawObject.position.copy(oldPosition); // Revert to the old position if there's a collision
        isGrounded = true; // Assume we hit the ground
        jumpVelocity = 0; // Reset jump velocity
        isJumping = 0; // Reset jump state
        dashUses = 2; // Reset dash uses when grounded
    } else {
        isGrounded = false; // We are in the air
    }
}

function onKeyDown(event) {
    keyState[event.code] = true;

    // Double movement speed when Shift key is pressed
    if (event.code === 'ShiftLeft' || event.code === 'ShiftRight') {
        movementSpeed = 20.;
    }
}

function onKeyUp(event) {
    keyState[event.code] = false;

    // Restore normal movement speed when Shift key is released
    if (event.code === 'ShiftLeft' || event.code === 'ShiftRight') {
        movementSpeed = 10.;
    }
}

function onMouseDown(event) {
    if (event.button === 0) { // Left mouse button
        moveCameraForward();
    }
}

// Move the camera forward in the direction it is facing
function moveCameraForward() {
    if (dashUses > 0) {
        jumpVelocity = 0;
        const direction = new THREE.Vector3();
        camera.getWorldDirection(direction);
        yawObject.position.addScaledVector(direction, dashDistance);
        dashUses -= 1;
    }
}

const projectileSpeed = 1000;

function shootProjectile() {
    const currentTime = Date.now();
    if (currentTime - lastShootTime < 100) {
        return;
    }

    lastShootTime = currentTime;

    const projectileGeometry = new THREE.BoxGeometry(0.2, 0.2, 0.2);
    const projectileMaterial = new THREE.MeshBasicMaterial({ color: 0xff0000 });
    const projectile = new THREE.Mesh(projectileGeometry, projectileMaterial);
    projectile.name = 'proj';

    const direction = new THREE.Vector3();
    camera.getWorldDirection(direction);

    projectile.position.copy(yawObject.position);
    scene.add(projectile);

    projectiles.push({
        mesh: projectile,
        direction: direction.clone()
    });
}

function animatePlane(x, y, z, targetWidth, targetHeight, duration) {
    const planeGeometry = new THREE.PlaneGeometry(1, 1); // Start with zero width and height
    const planeMaterial = new THREE.MeshBasicMaterial({ color: 0xff4400, side: THREE.DoubleSide });

    const plane = new THREE.Mesh(planeGeometry, planeMaterial);

    // Set the initial position of the plane
    plane.position.set(x, y, z);
    plane.scale.set(0,0);
    scene.add(plane);
    plane.quaternion.copy(yawObject.quaternion);
    // Animate the plane to the target size and back to nothing
    gsap.timeline()
        .to(plane.scale, { x: targetWidth, y: targetHeight, duration: duration / 2 })
        .to(plane.scale, { x: 0, y: 0, duration: duration / 2, onComplete: () => scene.remove(plane) });
}

function updateProjectiles() {
    const delta = clock.getDelta();
    projectiles.forEach((projectile, index) => {
        const moveDistance = projectileSpeed * delta;
        projectile.mesh.position.addScaledVector(projectile.direction, moveDistance);

        // Update the raycaster to check for intersections
        raycaster.set(projectile.mesh.position, projectile.direction);

        // Find intersections
        const intersects = raycaster.intersectObjects(scene.children, true);
        if (intersects.length > 0 && intersects[0].distance < moveDistance) {
            // Handle collision
            const collisionPoint = intersects[0].point;
            const forward = new THREE.Vector3(0, 0, -1).applyQuaternion(yawObject.quaternion); 
            animatePlane(collisionPoint.x - forward.x * 0.1, collisionPoint.y  - forward.y * 0.1, collisionPoint.z  - forward.z * 0.1, 1, 1, 1);
            scene.remove(projectile.mesh);
            projectiles.splice(index, 1);
        }

        // Remove projectile if out of bounds
        if (projectile.mesh.position.y < -10) {
            scene.remove(projectile.mesh);
            projectiles.splice(index, 1);
        }
    });
}

// Handle window resize
window.addEventListener('resize', () => {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
});

// Animation loop
function animate() {
    stats.begin();
    requestAnimationFrame(animate);
    updateCameraPosition();
    updateProjectiles();
    renderer.render(scene, camera);
    stats.end();
}
