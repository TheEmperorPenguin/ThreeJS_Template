import * as THREE from 'three';
import Stats from 'https://cdnjs.cloudflare.com/ajax/libs/stats.js/17/Stats.js';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js';

class ThreeJSApp {
    constructor(defaultScene = false) {
        this.initScene();
        this.initCamera();
        this.initRenderer();
        this.initStats();
        this.initLights();
        this.initControls();

        window.addEventListener('resize', this.onWindowResize.bind(this));

        this.clock = new THREE.Clock();
        this.keyState = {};
        this.isAnimating = false;
        this.animationId = null;

        if (defaultScene) {
            this.initFunction = this.defaultInit.bind(this);
            this.updateFunction = this.defaultUpdate.bind(this);
        }

        this.initPostProcessing();
    }

    initScene() {
        this.scene = new THREE.Scene();
    }

    initCamera() {
        this.camera = new THREE.PerspectiveCamera(90, window.innerWidth / window.innerHeight, 0.1, 2000);
        this.yawObject = new THREE.Object3D();
        this.pitchObject = new THREE.Object3D();
        this.yawObject.add(this.pitchObject);
        this.pitchObject.add(this.camera);
        this.scene.add(this.yawObject);
        this.yawObject.position.set(0, 0, 0);
    }

    initRenderer() {
        this.renderer = new THREE.WebGLRenderer({ antialias: true });
        this.renderer.setSize(window.innerWidth, window.innerHeight);
        document.body.appendChild(this.renderer.domElement);
    }

    initStats() {
        this.stats = new Stats();
        document.body.appendChild(this.stats.dom);
    }

    initLights() {
        const directionalLight = new THREE.DirectionalLight(0xffffff, 1);
        directionalLight.position.set(5, 10, 7.5);
        this.scene.add(directionalLight);

        const ambientLight = new THREE.AmbientLight(0x404040);
        this.scene.add(ambientLight);
    }

    initControls() {
        this.boundOnKeyDown = this.onKeyDown.bind(this);
        this.boundOnKeyUp = this.onKeyUp.bind(this);
        this.boundOnMouseMove = this.onMouseMove.bind(this);
        this.boundOnClick = this.onClick.bind(this);

        document.addEventListener('keydown', this.boundOnKeyDown);
        document.addEventListener('keyup', this.boundOnKeyUp);
        document.addEventListener('mousemove', this.boundOnMouseMove);
        document.body.addEventListener('click', this.boundOnClick);
    }

    onKeyDown(event) {
        this.keyState[event.code] = true;
    }

    onKeyUp(event) {
        this.keyState[event.code] = false;
    }

    onMouseMove(event) {
        if (document.pointerLockElement === document.body) {
            const movementX = event.movementX || 0;
            const movementY = event.movementY || 0;
            this.yawObject.rotation.y -= movementX * 0.002;
            this.pitchObject.rotation.x -= movementY * 0.002;
            this.pitchObject.rotation.x = Math.max(-Math.PI / 2, Math.min(Math.PI / 2, this.pitchObject.rotation.x));
        }
    }

    onClick() {
        const element = document.body;
        if (document.pointerLockElement !== element) {
            element.requestPointerLock().catch((error) => {
                console.error('Failed to lock pointer:', error);
            });
        }
    }

    defaultUpdate() {
        // Default rotation of the cube
        this.cube.rotation.x += 0.01;
        this.cube.rotation.y += 0.01;
    }

    setCustomUpdateFunction(updateFunction) {
        this.updateFunction = updateFunction.bind(this);
    }

    defaultInit() {
        const geometry = new THREE.BoxGeometry();
        const material = new THREE.MeshStandardMaterial({ color: 0x0077ff });
        this.cube = new THREE.Mesh(geometry, material);
        this.cube.position.set(0, 1, 0);
        this.scene.add(this.cube);
    }

    setCustomInitFunction(initFunction) {
        this.initFunction = initFunction.bind(this);
    }

    updateCameraPosition() {
        const moveDistance = 10 * this.clock.getDelta();
        if (this.keyState['KeyW']) { this.yawObject.translateZ(-moveDistance); }
        if (this.keyState['KeyS']) { this.yawObject.translateZ(moveDistance); }
        if (this.keyState['KeyA']) { this.yawObject.translateX(-moveDistance); }
        if (this.keyState['KeyD']) { this.yawObject.translateX(moveDistance); }
    }

    onWindowResize() {
        this.camera.aspect = window.innerWidth / window.innerHeight;
        this.camera.updateProjectionMatrix();
        this.renderer.setSize(window.innerWidth, window.innerHeight);
        this.composer.setSize(window.innerWidth, window.innerHeight); // Update the composer size
    }

    initPostProcessing() {
        const renderScene = new RenderPass(this.scene, this.camera);

        this.bloomPass = new UnrealBloomPass(new THREE.Vector2(window.innerWidth, window.innerHeight), 1.5, 0.4, 0.85);
        this.bloomPass.threshold = 0;
        this.bloomPass.strength = 1.5;
        this.bloomPass.radius = 1.0;

        this.composer = new EffectComposer(this.renderer);
        this.composer.addPass(renderScene);
        this.composer.addPass(this.bloomPass);
    }

    pause() {
        this.isAnimating = false;
    }

    resume() {
        this.animate();
    }

    animate() {
        if (!this.isAnimating) {
            this.isAnimating = true;
            this.animateLoop();
        }
    }

    animateLoop() {
        if (!this.isAnimating) return;
        this.stats.begin();
        this.updateCameraPosition();
        this.updateFunction(); // Call the custom update function
        this.composer.render(); // Use the composer for rendering with bloom effect
        this.stats.end();
        this.animationId = requestAnimationFrame(this.animateLoop.bind(this));
    }

    stopAnimation() {
        if (this.animationId) {
            cancelAnimationFrame(this.animationId);
            this.isAnimating = false;
        }
    }

    removeEventListeners() {
        document.removeEventListener('keydown', this.boundOnKeyDown);
        document.removeEventListener('keyup', this.boundOnKeyUp);
        document.removeEventListener('mousemove', this.boundOnMouseMove);
        document.body.removeEventListener('click', this.boundOnClick);
        window.removeEventListener('resize', this.boundOnWindowResize);
    }

    removeObjectsWithChildren(obj) {
        if (obj.children.length > 0) {
            for (let i = obj.children.length - 1; i >= 0; i--) {
                this.removeObjectsWithChildren(obj.children[i]);
            }
        }

        if (obj.geometry) {
            obj.geometry.dispose();
        }

        if (obj.material) {
            if (Array.isArray(obj.material)) {
                for (let i = 0; i < obj.material.length; i++) {
                    this.disposeMaterial(obj.material[i]);
                }
            } else {
                this.disposeMaterial(obj.material);
            }
        }

        obj.removeFromParent();
        obj = null;
    }

    disposeMaterial(material) {
        if (material.map) material.map.dispose();
        if (material.lightMap) material.lightMap.dispose();
        if (material.bumpMap) material.bumpMap.dispose();
        if (material.normalMap) material.normalMap.dispose();
        if (material.specularMap) material.specularMap.dispose();
        if (material.envMap) material.envMap.dispose();
        material.dispose();
    }

    cleanup() {
        this.stopAnimation();
        this.removeEventListeners();

        if (this.renderer) {
            document.body.removeChild(this.renderer.domElement);
            this.renderer.dispose();
        }

        if (this.stats) {
            document.body.removeChild(this.stats.dom);
        }

        this.removeObjectsWithChildren(this.scene);
        this.scene.clear();

        this.camera = null;
        this.scene = null;
        this.renderer = null;
        this.stats = null;
        this.yawObject = null;
        this.pitchObject = null;
        this.clock = null;
        this.keyState = null;
    }
}

export default ThreeJSApp;
