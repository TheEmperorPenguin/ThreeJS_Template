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

    for (let i = 0; i < 10; i++) {
        for (let j = 0; j < 10; j++) {
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
    });
    document.addEventListener('keyup', (event) => {
        keyState[event.code] = false;
    });

    document.addEventListener('mousemove', onMouseMove);

    // Lock the pointer for better FPS experience
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

function checkCollision() {
    const collisionMargin = 1.0; // Adjust this margin as needed

    // Get the center of the yawObject (camera's position)
    const cameraPosition = yawObject.position.clone();

    // Create a larger bounding box around the camera's position
    const objectBB = new THREE.Box3(
        cameraPosition.clone().add(new THREE.Vector3(-collisionMargin, -collisionMargin, -collisionMargin)),
        cameraPosition.clone().add(new THREE.Vector3(collisionMargin, collisionMargin, collisionMargin))
    );

    // Iterate over all objects in the scene
    for (let i = 0; i < scene.children.length; i++) {
        const object = scene.children[i];

        // Check for collision with each object that is not the camera itself
        if (object !== yawObject) {
            const otherObjectBB = new THREE.Box3().setFromObject(object);

            // Check if the camera's extended bounding box intersects with the object's bounding box
            if (objectBB.intersectsBox(otherObjectBB)) {
                // Handle collision here, for example, stop camera movement
                return true; // Collision detected
            }
        }
    }

    return false; // No collision detected
}

function updateCameraPosition() {
    const moveDistance = movementSpeed * clock.getDelta();
    let oldPosition = yawObject.position.clone();
    const gravity = .1;
    if (keyState['KeyE']) {
        movementSpeed *= 1.01;
    }
    if (keyState['KeyQ']) {
        movementSpeed /= 1.01;
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
    if (keyState['Space']) {
        yawObject.translateY(moveDistance);
    }
    if (keyState['ShiftLeft']) {
        yawObject.translateY(-moveDistance);
    }
    if (checkCollision()) {
        yawObject.position.copy(oldPosition); // Revert to the old position if there's a collision
    }
    oldPosition = yawObject.position.clone();
    yawObject.translateY(-gravity);
    if (checkCollision()) {
        yawObject.position.copy(oldPosition); // Revert to the old position if there's a collision
    }
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
    renderer.render(scene, camera);
    stats.end();
}