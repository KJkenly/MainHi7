import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';

// ================= 1. INITIALIZE SCENE & RENDERER =================
const scene = new THREE.Scene();
scene.background = new THREE.Color(0x87CEEB);
scene.fog = new THREE.FogExp2(0xB0E0E6, 0.00025);

const camera = new THREE.PerspectiveCamera(55, window.innerWidth / window.innerHeight, 1, 8000);
camera.position.set(0, -1350, 1050);
camera.up.set(0, 0, 1);

const renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
document.getElementById('canvas-container').appendChild(renderer.domElement);

const controls = new OrbitControls(camera, renderer.domElement);
controls.target.set(0, 30, 0);
controls.enableDamping = true;
controls.dampingFactor = 0.05;
controls.maxPolarAngle = Math.PI / 2 - 0.03;
controls.minDistance = 200;
controls.maxDistance = 3500;

// Groups
const zoneLabelsGroup = [];
const furnitureGroup = new THREE.Group();
const zonesWallGroup = new THREE.Group();
const vehiclesGroup = new THREE.Group();
const streetLightsGroup = new THREE.Group();
const interiorLightsGroup = new THREE.Group();

scene.add(furnitureGroup);
scene.add(zonesWallGroup);
scene.add(vehiclesGroup);
scene.add(streetLightsGroup);
scene.add(interiorLightsGroup);

// Wall bounding boxes for collision detection
const wallObstacles = [];

// ================= 2. LIGHTING & NIGHT LIGHT SYSTEM =================
const ambientLight = new THREE.AmbientLight(0xffffff, 0.85);
scene.add(ambientLight);

const sunLight = new THREE.DirectionalLight(0xfff8ee, 1.6);
sunLight.position.set(400, -800, 1200);
sunLight.castShadow = true;
sunLight.shadow.mapSize.width = 2048;
sunLight.shadow.mapSize.height = 2048;
sunLight.shadow.camera.near = 200;
sunLight.shadow.camera.far = 3000;
sunLight.shadow.camera.left = -1400;
sunLight.shadow.camera.right = 1400;
sunLight.shadow.camera.top = 1000;
sunLight.shadow.camera.bottom = -1000;
sunLight.shadow.bias = -0.0005;
scene.add(sunLight);

const fillLight = new THREE.DirectionalLight(0x90caf9, 0.4);
fillLight.position.set(-600, 600, 600);
scene.add(fillLight);

const dynamicLights = [];
const dynamicEmissiveMaterials = [];
let isNight = false;

window.setAutoAtmosphere = function (hour) {
    if (hour >= 6 && hour < 9) {
        setAtmospherePreset(0xFFE4B5, 1.3, 0xB0C4DE, 0.8, 0x87CEEB, 0x9ACD32, false);
    } else if (hour >= 9 && hour < 16) {
        setAtmospherePreset(0xFFFFFF, 1.6, 0xE0F2FE, 0.85, 0x87CEEB, 0xB0E0E6, false);
    } else if (hour >= 16 && hour < 18) {
        setAtmospherePreset(0xFFA07A, 1.4, 0xD8BFD8, 0.8, 0xE9967A, 0xF4A460, false);
    } else {
        setAtmospherePreset(0x60A5FA, 0.45, 0x2A3B5C, 0.65, 0x0A0F1D, 0x0A0F1D, true);
    }
};

window.setManualAtmosphere = function (mode) {
    if (mode === 'night') {
        setAtmospherePreset(0x60A5FA, 0.45, 0x2A3B5C, 0.65, 0x0A0F1D, 0x0A0F1D, true);
    } else {
        setAtmospherePreset(0xFFFFFF, 1.6, 0xE0F2FE, 0.85, 0x87CEEB, 0xB0E0E6, false);
    }
};

function setAtmospherePreset(sunCol, sunInt, ambCol, ambInt, skyCol, fogCol, nightState) {
    isNight = nightState;
    sunLight.color.setHex(sunCol);
    sunLight.intensity = sunInt;
    ambientLight.color.setHex(ambCol);
    ambientLight.intensity = ambInt;
    scene.background.setHex(skyCol);
    scene.fog.color.setHex(fogCol);

    dynamicLights.forEach(item => {
        item.light.intensity = isNight ? item.nightIntensity : item.dayIntensity;
    });

    dynamicEmissiveMaterials.forEach(m => {
        if (m.material) {
            m.material.emissive.setHex(isNight ? m.nightColor : m.dayColor);
        }
    });
}
window.setAutoAtmosphere(new Date().getHours());

// ================= 3. SHARED MATERIALS =================
const matFloorHospital = new THREE.MeshLambertMaterial({ color: 0xF1F5F9 });
const matWallMain = new THREE.MeshLambertMaterial({ color: 0xE5E7EB });
const matWallCap = new THREE.MeshLambertMaterial({ color: 0x94A3B8 });
const matDoorFrame = new THREE.MeshLambertMaterial({ color: 0x0284C7 });
const matRoad = new THREE.MeshLambertMaterial({ color: 0x334155 });
const matGrass = new THREE.MeshLambertMaterial({ color: 0x4ADE80 });
const matPavement = new THREE.MeshLambertMaterial({ color: 0xCBD5E1 });
const matWood = new THREE.MeshLambertMaterial({ color: 0xD97706 });
const matBedWhite = new THREE.MeshLambertMaterial({ color: 0xFFFFFF });
const matMetal = new THREE.MeshStandardMaterial({ color: 0x94A3B8, metalness: 0.6, roughness: 0.3 });
const matGlass = new THREE.MeshPhysicalMaterial({ color: 0xBAE6FD, transparent: true, opacity: 0.45, roughness: 0.1, transmission: 0.7 });

function makeBox(x, y, z, w, d, h, mat, targetGroup = scene, cast = true, receive = true) {
    const geo = new THREE.BoxGeometry(w, d, h);
    const mesh = new THREE.Mesh(geo, mat);
    mesh.position.set(x, y, z);
    mesh.castShadow = cast;
    mesh.receiveShadow = receive;
    targetGroup.add(mesh);
    return mesh;
}

// ================= 4. MAP & ENVIRONMENT BUILDER =================
makeBox(0, -780, -2, 2800, 200, 4, matRoad, scene, false, true);

for (let rx = -1300; rx <= 1300; rx += 140) {
    makeBox(rx, -780, 0.5, 70, 6, 1, matBedWhite, scene, false, true);
}
for (let zx = -60; zx <= 60; zx += 20) {
    makeBox(zx, -780, 0.8, 12, 160, 1, matBedWhite, scene, false, true);
}

makeBox(0, -665, 3, 2800, 50, 6, matPavement, scene, false, true);
makeBox(-850, -665, 4, 900, 26, 7, matGrass, scene);
makeBox(850, -665, 4, 900, 26, 7, matGrass, scene);

// Main Hospital Floor
makeBox(0, 40, -1, 2100, 1340, 4, matFloorHospital, scene, false, true);

// Front Outer Fence Walls
makeBox(-570, -610, 30, 960, 16, 60, matWallMain, zonesWallGroup);
makeBox(570, -610, 30, 960, 16, 60, matWallMain, zonesWallGroup);

// Entrance Arch (Doorway into hospital)
makeBox(-80, -610, 45, 18, 22, 90, matWallMain, zonesWallGroup);
makeBox(80, -610, 45, 18, 22, 90, matWallMain, zonesWallGroup);
makeBox(0, -610, 85, 180, 26, 30, new THREE.MeshLambertMaterial({ color: 0x0284C7 }), zonesWallGroup);

const entranceCanvas = document.createElement('canvas');
entranceCanvas.width = 512; entranceCanvas.height = 128;
const ectx = entranceCanvas.getContext('2d');
ectx.fillStyle = '#FFFFFF'; ectx.font = 'bold 54px Kanit, sans-serif'; ectx.textAlign = 'center'; ectx.textBaseline = 'middle';
ectx.fillText('ทางเข้า', 256, 45);
ectx.fillStyle = '#10B981'; ectx.font = 'bold 44px sans-serif'; ectx.fillText('▲', 256, 95);
const entranceTex = new THREE.CanvasTexture(entranceCanvas);
const entranceLabelMesh = new THREE.Mesh(new THREE.PlaneGeometry(160, 26), new THREE.MeshBasicMaterial({ map: entranceTex, transparent: true }));
entranceLabelMesh.position.set(0, -624, 85);
entranceLabelMesh.rotation.x = Math.PI / 2;
scene.add(entranceLabelMesh);

// Ambulance Parking
const bayStartX = 140;
const bayWidth = 105;
const parkedAmbulances = [];
for (let i = 0; i < 5; i++) {
    const px = bayStartX + i * bayWidth + bayWidth / 2;
    makeBox(px - bayWidth / 2, -665, 3.5, 4, 110, 1, new THREE.MeshBasicMaterial({ color: 0xFACC15 }));
    makeBox(px + bayWidth / 2, -665, 3.5, 4, 110, 1, new THREE.MeshBasicMaterial({ color: 0xFACC15 }));
    makeBox(px, -610, 3.5, bayWidth, 4, 1, new THREE.MeshBasicMaterial({ color: 0xFACC15 }));

    const amb = createAmbulance(px, -665, 4, Math.PI / 2, false);
    parkedAmbulances.push(amb);
}

const ambSignCanvas = document.createElement('canvas');
ambSignCanvas.width = 512; ambSignCanvas.height = 128;
const actx = ambSignCanvas.getContext('2d');
actx.fillStyle = '#0284C7'; actx.roundRect(10, 10, 492, 108, 16); actx.fill();
actx.lineWidth = 6; actx.strokeStyle = '#38BDF8'; actx.stroke();
actx.fillStyle = '#FFFFFF'; actx.font = 'bold 44px Kanit, sans-serif'; actx.textAlign = 'center'; actx.textBaseline = 'middle';
actx.fillText('จุดจอดรถพยาบาล 5 คัน', 256, 64);
const ambSignTex = new THREE.CanvasTexture(ambSignCanvas);
const ambSignMesh = new THREE.Mesh(new THREE.PlaneGeometry(180, 36), new THREE.MeshBasicMaterial({ map: ambSignTex, transparent: true }));
ambSignMesh.position.set(bayStartX + 2.5 * bayWidth, -605, 55);
ambSignMesh.rotation.x = Math.PI / 2;
scene.add(ambSignMesh);

// Trees
const treeCoords = [
    [-1020, -665], [-900, -665], [-780, -665], [-660, -665],
    [760, -665], [880, -665], [1000, -665],
    [-1020, -450], [-1020, -100], [-1020, 250], [-1020, 550],
    [1020, -450], [1020, -100], [1020, 250], [1020, 550]
];
treeCoords.forEach(([tx, ty]) => createTree(tx, ty, 3));

// ================= 5. LIGHTS =================
const streetLightX = [-950, -600, -250, 100, 450, 800];
streetLightX.forEach(sx => createStreetLight(sx, -710));

function createStreetLight(x, y) {
    const group = new THREE.Group();
    group.position.set(x, y, 0);
    makeBox(0, 0, 45, 4, 4, 90, matMetal, group);
    makeBox(0, -12, 88, 4, 24, 4, matMetal, group);
    makeBox(0, -22, 86, 10, 16, 4, matWallCap, group);

    const bulbMat = new THREE.MeshBasicMaterial({ color: 0xFACC15 });
    makeBox(0, -22, 83, 8, 12, 2, bulbMat, group, false, false);
    dynamicEmissiveMaterials.push({ material: bulbMat, nightColor: 0xFFF099, dayColor: 0x888888 });

    const pLight = new THREE.PointLight(0xFFE899, isNight ? 2.4 : 0, 360, 1.3);
    pLight.position.set(0, -22, 78);
    group.add(pLight);
    dynamicLights.push({ light: pLight, nightIntensity: 2.4, dayIntensity: 0 });

    streetLightsGroup.add(group);
}

const roomLightsConfig = [
    { x: 0, y: -360, z: 90, color: 0xE0F2FE, nightInt: 2.2, dayInt: 0.6, dist: 450 },
    { x: -670, y: -360, z: 90, color: 0xBAE6FD, nightInt: 2.0, dayInt: 0.4, dist: 350 },
    { x: 760, y: -5, z: 90, color: 0xFFFFFF, nightInt: 2.6, dayInt: 0.8, dist: 380 },
    { x: 360, y: 40, z: 90, color: 0xFEF08A, nightInt: 2.0, dayInt: 0.5, dist: 320 },
    { x: 0, y: 40, z: 90, color: 0xE2E8F0, nightInt: 1.8, dayInt: 0.4, dist: 300 },
    { x: -350, y: -5, z: 90, color: 0x38BDF8, nightInt: 2.0, dayInt: 0.5, dist: 320 },
    { x: -770, y: -5, z: 90, color: 0x67E8F9, nightInt: 2.0, dayInt: 0.5, dist: 320 },
    { x: -810, y: 380, z: 90, color: 0xC084FC, nightInt: 1.8, dayInt: 0.4, dist: 320 },
    { x: -450, y: 380, z: 90, color: 0xFDE68A, nightInt: 1.8, dayInt: 0.4, dist: 320 },
    { x: -85, y: 380, z: 90, color: 0xFFFFFF, nightInt: 2.0, dayInt: 0.5, dist: 320 },
    { x: 370, y: 380, z: 90, color: 0x93C5FD, nightInt: 1.8, dayInt: 0.4, dist: 380 },
    { x: 830, y: 380, z: 90, color: 0x94A3B8, nightInt: 1.6, dayInt: 0.3, dist: 280 },
    { x: 0, y: -600, z: 95, color: 0x10B981, nightInt: 2.4, dayInt: 0.5, dist: 280 }
];

roomLightsConfig.forEach(cfg => {
    const rLight = new THREE.PointLight(cfg.color, isNight ? cfg.nightInt : cfg.dayInt, cfg.dist, 1.2);
    rLight.position.set(cfg.x, cfg.y, cfg.z);
    interiorLightsGroup.add(rLight);
    dynamicLights.push({ light: rLight, nightIntensity: cfg.nightInt, dayIntensity: cfg.dayInt });
});

// ================= 6. WALLS WITH DOORWAY OPENINGS & OBSTACLE REGISTRY =================
const wallH = 65;
const wallThick = 14;

function addWallWithDoorway(startX, endX, y, doorCenter, doorWidth, isHorizontal = true) {
    if (isHorizontal) {
        // Horizontal wall segment 1
        const leftLen = (doorCenter - doorWidth / 2) - startX;
        if (leftLen > 5) {
            const cx = startX + leftLen / 2;
            makeBox(cx, y, wallH / 2, leftLen, wallThick, wallH, matWallMain, zonesWallGroup);
            makeBox(cx, y, wallH + 1, leftLen + 1, wallThick + 1, 2, matWallCap, zonesWallGroup);
            wallObstacles.push({ minX: startX - 10, maxX: doorCenter - doorWidth / 2 + 10, minY: y - wallThick / 2 - 10, maxY: y + wallThick / 2 + 10 });
        }
        // Horizontal wall segment 2
        const rightLen = endX - (doorCenter + doorWidth / 2);
        if (rightLen > 5) {
            const cx = (doorCenter + doorWidth / 2) + rightLen / 2;
            makeBox(cx, y, wallH / 2, rightLen, wallThick, wallH, matWallMain, zonesWallGroup);
            makeBox(cx, y, wallH + 1, rightLen + 1, wallThick + 1, 2, matWallCap, zonesWallGroup);
            wallObstacles.push({ minX: doorCenter + doorWidth / 2 - 10, maxX: endX + 10, minY: y - wallThick / 2 - 10, maxY: y + wallThick / 2 + 10 });
        }
        // Doorway Floor Indicator
        makeBox(doorCenter, y, 0.5, doorWidth, wallThick + 4, 1, matPavement, zonesWallGroup, false, true);
    }
}

function addVerticalWallWithDoorway(x, startY, endY, doorCenter, doorWidth) {
    // Vertical wall segment 1
    const botLen = (doorCenter - doorWidth / 2) - startY;
    if (botLen > 5) {
        const cy = startY + botLen / 2;
        makeBox(x, cy, wallH / 2, wallThick, botLen, wallH, matWallMain, zonesWallGroup);
        makeBox(x, cy, wallH + 1, wallThick + 1, botLen + 1, 2, matWallCap, zonesWallGroup);
        wallObstacles.push({ minX: x - wallThick / 2 - 10, maxX: x + wallThick / 2 + 10, minY: startY - 10, maxY: doorCenter - doorWidth / 2 + 10 });
    }
    // Vertical wall segment 2
    const topLen = endY - (doorCenter + doorWidth / 2);
    if (topLen > 5) {
        const cy = (doorCenter + doorWidth / 2) + topLen / 2;
        makeBox(x, cy, wallH / 2, wallThick, topLen, wallH, matWallMain, zonesWallGroup);
        makeBox(x, cy, wallH + 1, wallThick + 1, topLen + 1, 2, matWallCap, zonesWallGroup);
        wallObstacles.push({ minX: x - wallThick / 2 - 10, maxX: x + wallThick / 2 + 10, minY: doorCenter + doorWidth / 2 - 10, maxY: endY + 10 });
    }
    makeBox(x, doorCenter, 0.5, wallThick + 4, doorWidth, 1, matPavement, zonesWallGroup, false, true);
}

// Outer Boundaries
makeBox(-1000, 30, wallH / 2, wallThick, 1340, wallH, matWallMain, zonesWallGroup);
makeBox(1000, 30, wallH / 2, wallThick, 1340, wallH, matWallMain, zonesWallGroup);
wallObstacles.push({ minX: -1015, maxX: -985, minY: -640, maxY: 700 });
wallObstacles.push({ minX: 985, maxX: 1015, minY: -640, maxY: 700 });

// Front Entrance Inner Wall (y = -520) with wide opening into lobby
addWallWithDoorway(-1000, 1000, -520, 0, 240);

// Divider 1: Between Front Corridor/Lobby and Middle Row (y = -200)
// Doors into X-ray (-770), Lab (-350), Center Lobby (0), Pharmacy (360), ER (760)
addWallWithDoorway(-1000, -550, -200, -770, 70); // Door to X-ray
addWallWithDoorway(-550, -150, -200, -350, 70);  // Door to Lab
addWallWithDoorway(-150, 160, -200, 0, 90);      // Door to Cashier
addWallWithDoorway(160, 560, -200, 360, 70);     // Door to Pharmacy
addWallWithDoorway(560, 1000, -200, 760, 80);    // Door to ER

// Divider 2: Between Middle Row and Back Row (y = 190)
// Doors into Physical Therapy (-810), Thai Massage (-450), Dental (-85), IPD (370), Mortuary (830)
addWallWithDoorway(-1000, -630, 190, -810, 70); // Door to Physical Therapy
addWallWithDoorway(-630, -270, 190, -450, 70);  // Door to Thai Massage
addWallWithDoorway(-270, 100, 190, -85, 70);    // Door to Dental
addWallWithDoorway(100, 670, 190, 370, 100);    // Double doors to IPD
addWallWithDoorway(670, 1000, 190, 830, 70);    // Door to Mortuary

// Vertical Dividing Walls with Connecting Doors
// Front: Divider between โซน 9 จุดคัดกรอง and โถงกลาง
addVerticalWallWithDoorway(-400, -520, -200, -360, 80);
// Divider between โถงกลาง and โซน 2 ฉุกเฉิน
addVerticalWallWithDoorway(400, -520, -200, -360, 80);

// Middle Row:
addVerticalWallWithDoorway(-550, -200, 190, -5, 65); // Between X-ray & Lab
addVerticalWallWithDoorway(-150, -200, 190, -5, 65); // Between Lab & Cashier
addVerticalWallWithDoorway(160, -200, 190, -5, 65);  // Between Cashier & Pharmacy
addVerticalWallWithDoorway(560, -200, 190, -5, 65);  // Between Pharmacy & ER

// Back Row:
addVerticalWallWithDoorway(-630, 190, 580, 380, 65); // Between Physio & Thai Massage
addVerticalWallWithDoorway(-270, 190, 580, 380, 65); // Between Thai Massage & Dental
addVerticalWallWithDoorway(100, 190, 580, 380, 75);  // Between Dental & IPD
addVerticalWallWithDoorway(670, 190, 580, 380, 65);  // Between IPD & Mortuary

// Rear Wall
const rearWallH = 220;
makeBox(0, 680, rearWallH / 2, 2020, 24, rearWallH, new THREE.MeshLambertMaterial({ color: 0x1E3A8A }));
makeBox(0, 680, rearWallH + 3, 2040, 30, 6, matWallCap);
wallObstacles.push({ minX: -1010, maxX: 1010, minY: 665, maxY: 695 });

// Screens
const canvasS1 = document.createElement('canvas');
canvasS1.width = 640; canvasS1.height = 360;
function drawScreen1() {
    const ctx = canvasS1.getContext('2d');
    ctx.fillStyle = '#0F172A'; ctx.fillRect(0, 0, 640, 360);
    ctx.fillStyle = '#FFFFFF'; ctx.font = 'bold 28px Kanit, sans-serif';
    ctx.fillText('คนไข้ทั้งหมดวันนี้', 30, 50);

    const items = [
        { label: 'ผู้มารับบริการ', val: '328 ราย', col: '#38BDF8', icon: '👤' },
        { label: 'กำลังรักษา', val: '142 ราย', col: '#10B981', icon: '🏥' },
        { label: 'ส่งต่อ', val: '28 ราย', col: '#F59E0B', icon: '🚑' },
        { label: 'กลับบ้าน', val: '146 ราย', col: '#3B82F6', icon: '🏠' },
        { label: 'เสียชีวิต', val: '12 ราย', col: '#EF4444', icon: '✝️' }
    ];
    items.forEach((it, idx) => {
        const y = 110 + idx * 46;
        ctx.fillStyle = '#94A3B8'; ctx.font = '20px Kanit, sans-serif'; ctx.fillText(`${it.icon}  ${it.label}`, 40, y);
        ctx.fillStyle = it.col; ctx.font = 'bold 24px Kanit, sans-serif'; ctx.textAlign = 'right';
        ctx.fillText(it.val, 600, y); ctx.textAlign = 'left';
    });
}
drawScreen1();
const texS1 = new THREE.CanvasTexture(canvasS1);
const screen1Mesh = new THREE.Mesh(new THREE.PlaneGeometry(420, 170), new THREE.MeshBasicMaterial({ map: texS1 }));
screen1Mesh.position.set(-580, 666, 120);
scene.add(screen1Mesh);

const canvasS2 = document.createElement('canvas');
canvasS2.width = 640; canvasS2.height = 360;
function drawScreen2() {
    const ctx = canvasS2.getContext('2d');
    ctx.fillStyle = '#0F172A'; ctx.fillRect(0, 0, 640, 360);
    ctx.fillStyle = '#FFFFFF'; ctx.font = 'bold 28px Kanit, sans-serif';
    ctx.fillText('สถิติผู้ป่วยตามแผนก', 30, 50);

    const depts = [
        { name: 'อายุรกรรม', pct: 23, col: '#38BDF8' },
        { name: 'ศัลยกรรม', pct: 18, col: '#0284C7' },
        { name: 'กุมารเวช', pct: 15, col: '#10B981' },
        { name: 'สูตินรีเวช', pct: 12, col: '#F59E0B' },
        { name: 'อื่นๆ', pct: 32, col: '#64748B' }
    ];
    depts.forEach((d, idx) => {
        const y = 100 + idx * 48;
        ctx.fillStyle = '#E2E8F0'; ctx.font = '20px Kanit, sans-serif'; ctx.fillText(d.name, 40, y);
        ctx.fillStyle = '#334155'; ctx.roundRect(160, y - 18, 380, 20, 10); ctx.fill();
        ctx.fillStyle = d.col; ctx.roundRect(160, y - 18, (380 * d.pct) / 100, 20, 10); ctx.fill();
        ctx.fillStyle = '#FFFFFF'; ctx.font = 'bold 20px Kanit, sans-serif'; ctx.fillText(`${d.pct}%`, 560, y);
    });
}
drawScreen2();
const texS2 = new THREE.CanvasTexture(canvasS2);
const screen2Mesh = new THREE.Mesh(new THREE.PlaneGeometry(420, 170), new THREE.MeshBasicMaterial({ map: texS2 }));
screen2Mesh.position.set(0, 666, 120);
scene.add(screen2Mesh);

const canvasS3 = document.createElement('canvas');
canvasS3.width = 640; canvasS3.height = 360;
function drawScreen3() {
    const ctx = canvasS3.getContext('2d');
    ctx.fillStyle = '#0F172A'; ctx.fillRect(0, 0, 640, 360);
    ctx.fillStyle = '#FFFFFF'; ctx.font = 'bold 28px Kanit, sans-serif';
    ctx.fillText('สรุปสถานะห้อง/เตียง', 30, 50);

    const cx = 170, cy = 200, r = 90;
    ctx.beginPath(); ctx.arc(cx, cy, r, 0, Math.PI * 2); ctx.lineWidth = 26; ctx.strokeStyle = '#10B981'; ctx.stroke();
    ctx.beginPath(); ctx.arc(cx, cy, r, -Math.PI / 2, Math.PI * 0.75); ctx.strokeStyle = '#F59E0B'; ctx.stroke();
    ctx.fillStyle = '#FFFFFF'; ctx.font = 'bold 36px Kanit, sans-serif'; ctx.textAlign = 'center'; ctx.fillText('60', cx, cy + 5);
    ctx.font = '16px Kanit, sans-serif'; ctx.fillStyle = '#94A3B8'; ctx.fillText('เตียงทั้งหมด', cx, cy + 32);

    ctx.textAlign = 'left';
    const legends = [
        { label: 'ว่าง', val: '20', col: '#10B981' },
        { label: 'ใช้ไป', val: '37', col: '#F59E0B' },
        { label: 'รอซักเตียง', val: '3', col: '#EF4444' }
    ];
    legends.forEach((lg, idx) => {
        const ly = 140 + idx * 50;
        ctx.fillStyle = lg.col; ctx.beginPath(); ctx.arc(360, ly, 10, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = '#E2E8F0'; ctx.font = '22px Kanit, sans-serif'; ctx.fillText(lg.label, 385, ly + 8);
        ctx.font = 'bold 26px Kanit, sans-serif'; ctx.fillStyle = '#FFFFFF'; ctx.fillText(lg.val, 520, ly + 8);
    });
}
drawScreen3();
const texS3 = new THREE.CanvasTexture(canvasS3);
const screen3Mesh = new THREE.Mesh(new THREE.PlaneGeometry(420, 170), new THREE.MeshBasicMaterial({ map: texS3 }));
screen3Mesh.position.set(580, 666, 120);
scene.add(screen3Mesh);

// ================= 7. FURNITURE & EQUIPMENT =================
makeBox(0, -450, 18, 300, 45, 36, new THREE.MeshLambertMaterial({ color: 0x0284C7 }), furnitureGroup);
makeBox(0, -450, 37, 304, 49, 3, matWallCap, furnitureGroup);
for (let cx = -90; cx <= 90; cx += 90) {
    makeBox(cx, -445, 46, 24, 6, 16, matRoad, furnitureGroup);
    makeBox(cx, -445, 42, 6, 6, 6, matMetal, furnitureGroup);
}
for (let row = 0; row < 4; row++) {
    const cy = -380 + row * 40;
    for (let col = -180; col <= 180; col += 36) {
        if (Math.abs(col) < 30) continue;
        createChair(col, cy, 0, Math.PI, 0x2563EB);
    }
}
createPlant(-360, -480, 0); createPlant(360, -480, 0);
createPlant(-360, -240, 0); createPlant(360, -240, 0);

makeBox(-700, -360, 18, 260, 45, 36, matWood, furnitureGroup);
for (let bx = -780; bx <= -620; bx += 80) {
    makeBox(bx, -355, 46, 24, 6, 16, matRoad, furnitureGroup);
    createChair(bx, -310, 0, 0, 0x334155);
    createChair(bx, -410, 0, Math.PI, 0x2563EB);
}

makeBox(720, -320, 18, 140, 40, 36, matWallMain, furnitureGroup);
makeBox(670, -240, 20, 24, 24, 40, new THREE.MeshLambertMaterial({ color: 0xEF4444 }), furnitureGroup);
makeBox(670, -210, 20, 24, 24, 40, new THREE.MeshLambertMaterial({ color: 0xF59E0B }), furnitureGroup);
makeBox(670, -180, 20, 24, 24, 40, new THREE.MeshLambertMaterial({ color: 0x10B981 }), furnitureGroup);
makeBox(670, -150, 20, 24, 24, 40, new THREE.MeshLambertMaterial({ color: 0xFFFFFF }), furnitureGroup);
createHospitalBed(700, -80, 0, 0, 0xEF4444);
createHospitalBed(820, -80, 0, 0, 0xEF4444);
createHospitalBed(700, 60, 0, 0, 0xEF4444);
createHospitalBed(820, 60, 0, 0, 0xEF4444);

makeBox(-840, -10, 16, 70, 120, 32, matMetal, furnitureGroup);
makeBox(-840, -10, 75, 40, 40, 10, matWallCap, furnitureGroup);
makeBox(-840, -10, 100, 12, 12, 45, matMetal, furnitureGroup);
makeBox(-700, 90, 40, 120, 16, 80, matGlass, furnitureGroup);
makeBox(-700, 120, 18, 80, 36, 36, matWood, furnitureGroup);

makeBox(-440, 90, 18, 160, 40, 36, matWallMain, furnitureGroup);
makeBox(-440, -90, 18, 160, 40, 36, matWallMain, furnitureGroup);
makeBox(-280, 0, 18, 40, 180, 36, matWallMain, furnitureGroup);
makeBox(-420, 90, 44, 40, 30, 18, matMetal, furnitureGroup);
makeBox(-460, -90, 44, 30, 30, 22, matBedWhite, furnitureGroup);

makeBox(0, 80, 18, 240, 40, 36, matWood, furnitureGroup);
makeBox(0, 80, 48, 240, 6, 26, matGlass, furnitureGroup);
for (let k = -70; k <= 70; k += 70) createChair(k, 10, 0, Math.PI, 0x2563EB);

makeBox(360, 80, 18, 280, 40, 36, matBedWhite, furnitureGroup);
for (let my = -50; my <= 20; my += 35) createMedicineShelf(460, my, 0, 140, 18, 65);

makeBox(-800, 380, 15, 30, 160, 4, matWood, furnitureGroup);
makeBox(-812, 380, 32, 4, 160, 4, matMetal, furnitureGroup);
makeBox(-788, 380, 32, 4, 160, 4, matMetal, furnitureGroup);
createHospitalBed(-900, 300, 0, 0, 0x38BDF8);
createHospitalBed(-900, 460, 0, 0, 0x38BDF8);

createThaiMassageBed(-530, 300); createThaiMassageBed(-370, 300);
createThaiMassageBed(-530, 460); createThaiMassageBed(-370, 460);

createDentalUnit(-190, 360); createDentalUnit(-80, 360); createDentalUnit(30, 360);

const ipdRows = [290, 470];
const ipdCols = [170, 270, 370, 470, 570];
ipdRows.forEach(ry => {
    ipdCols.forEach(cx => {
        createHospitalBed(cx, ry, 0, (ry === 290) ? 0 : Math.PI, 0x0284C7);
        makeBox(cx + 34, ry + 15, 12, 16, 16, 24, matBedWhite, furnitureGroup);
    });
});

makeBox(840, 400, 35, 180, 40, 70, matMetal, furnitureGroup);
createHospitalBed(750, 320, 0, 0, 0x64748B);

function createHospitalBed(x, y, z, angle, blanketColor = 0x38BDF8) {
    const group = new THREE.Group();
    group.position.set(x, y, z);
    group.rotation.z = angle;
    makeBox(0, 0, 8, 44, 82, 10, matMetal, group);
    makeBox(0, 0, 16, 42, 80, 8, matBedWhite, group);
    makeBox(0, -10, 18, 42.5, 58, 8.5, new THREE.MeshLambertMaterial({ color: blanketColor }), group);
    makeBox(0, 28, 21, 28, 16, 6, matBedWhite, group);
    makeBox(0, 41, 20, 46, 3, 24, matWallCap, group);
    makeBox(0, -41, 16, 46, 3, 16, matWallCap, group);
    makeBox(24, 30, 38, 2, 2, 60, matMetal, group);
    makeBox(24, 30, 68, 12, 2, 2, matMetal, group);
    furnitureGroup.add(group);
    return group;
}

function createChair(x, y, z, angle, colorHex = 0x2563EB) {
    const group = new THREE.Group();
    group.position.set(x, y, z);
    group.rotation.z = angle;
    const seatMat = new THREE.MeshLambertMaterial({ color: colorHex });
    makeBox(0, 0, 14, 20, 20, 4, seatMat, group);
    makeBox(0, -9, 26, 20, 4, 20, seatMat, group);
    makeBox(0, 0, 7, 2, 2, 14, matMetal, group);
    makeBox(0, 0, 1, 18, 18, 2, matMetal, group);
    furnitureGroup.add(group);
    return group;
}

function createThaiMassageBed(x, y) {
    const group = new THREE.Group();
    group.position.set(x, y, 0);
    makeBox(0, 0, 10, 60, 95, 20, matWood, group);
    makeBox(0, 0, 23, 56, 90, 8, new THREE.MeshLambertMaterial({ color: 0xFDE68A }), group);
    makeBox(0, 32, 28, 30, 18, 6, matWood, group);
    furnitureGroup.add(group);
}

function createDentalUnit(x, y) {
    const group = new THREE.Group();
    group.position.set(x, y, 0);
    makeBox(0, 0, 16, 32, 65, 12, new THREE.MeshLambertMaterial({ color: 0x06B6D4 }), group);
    makeBox(0, 26, 28, 28, 20, 8, new THREE.MeshLambertMaterial({ color: 0x06B6D4 }), group);
    makeBox(-24, 10, 40, 4, 4, 80, matMetal, group);
    makeBox(-10, 10, 78, 28, 4, 4, matMetal, group);
    makeBox(4, 10, 72, 16, 12, 8, new THREE.MeshBasicMaterial({ color: 0xFFFBEB }), group);
    furnitureGroup.add(group);
}

function createMedicineShelf(x, y, z, w, d, h) {
    const group = new THREE.Group();
    group.position.set(x, y, z);
    makeBox(0, 0, h / 2, w, d, h, matBedWhite, group);
    const colors = [0xEF4444, 0x3B82F6, 0x10B981, 0xF59E0B];
    for (let l = 15; l < h - 10; l += 15) {
        for (let bx = -w / 2 + 15; bx < w / 2 - 15; bx += 18) {
            const col = colors[Math.floor(Math.random() * colors.length)];
            makeBox(bx, 0, l, 12, d + 2, 8, new THREE.MeshLambertMaterial({ color: col }), group);
        }
    }
    furnitureGroup.add(group);
}

function createTree(x, y, z) {
    const group = new THREE.Group();
    group.position.set(x, y, z);
    makeBox(0, 0, 15, 8, 8, 30, matWood, group);
    const foliageMat = new THREE.MeshLambertMaterial({ color: 0x22C55E });
    makeBox(0, 0, 40, 36, 36, 30, foliageMat, group);
    makeBox(0, 0, 56, 26, 26, 22, foliageMat, group);
    scene.add(group);
}

function createPlant(x, y, z) {
    const group = new THREE.Group();
    group.position.set(x, y, z);
    makeBox(0, 0, 10, 20, 20, 20, matBedWhite, group);
    makeBox(0, 0, 26, 28, 28, 22, new THREE.MeshLambertMaterial({ color: 0x10B981 }), group);
    furnitureGroup.add(group);
}

function createAmbulance(x, y, z, angle, isMoving = false) {
    const group = new THREE.Group();
    group.position.set(x, y, z);
    group.rotation.z = angle;

    makeBox(0, 0, 24, 42, 90, 40, matBedWhite, group);
    makeBox(0, 0, 22, 42.5, 90.5, 10, new THREE.MeshBasicMaterial({ color: 0xEF4444 }), group);
    makeBox(0, 30, 32, 42.6, 22, 16, matRoad, group);
    makeBox(0, 42, 28, 40, 8, 14, matRoad, group);

    const redLightMat = new THREE.MeshBasicMaterial({ color: 0xEF4444 });
    const blueLightMat = new THREE.MeshBasicMaterial({ color: 0x3B82F6 });
    const sirenRed = makeBox(-7, 15, 46, 12, 8, 6, redLightMat, group);
    const sirenBlue = makeBox(7, 15, 46, 12, 8, 6, blueLightMat, group);

    makeBox(0, -15, 44.5, 16, 6, 1, new THREE.MeshBasicMaterial({ color: 0xEF4444 }), group);
    makeBox(0, -15, 44.5, 6, 16, 1, new THREE.MeshBasicMaterial({ color: 0xEF4444 }), group);

    const hMat = new THREE.MeshBasicMaterial({ color: 0xFFFFF0 });
    makeBox(-14, 45, 18, 6, 2, 6, hMat, group);
    makeBox(14, 45, 18, 6, 2, 6, hMat, group);

    const wheels = [];
    [[-20, 26], [20, 26], [-20, -26], [20, -26]].forEach(([wx, wy]) => {
        const w = makeBox(wx, wy, 8, 6, 18, 16, matRoad, group);
        wheels.push(w);
    });

    vehiclesGroup.add(group);
    return { mesh: group, sirenRed, sirenBlue, wheels, redLightMat, blueLightMat };
}

function createSedan(x, y, z, angle, colorHex) {
    const group = new THREE.Group();
    group.position.set(x, y, z);
    group.rotation.z = angle;

    const bodyMat = new THREE.MeshLambertMaterial({ color: colorHex });
    makeBox(0, 0, 12, 38, 80, 18, bodyMat, group);
    makeBox(0, -5, 23, 34, 44, 15, matRoad, group);

    const hlMat = new THREE.MeshBasicMaterial({ color: 0xFFFBEB });
    makeBox(-12, 40, 12, 6, 2, 5, hlMat, group);
    makeBox(12, 40, 12, 6, 2, 5, hlMat, group);

    const tlMat = new THREE.MeshBasicMaterial({ color: 0xEF4444 });
    makeBox(-12, -40, 12, 6, 2, 5, tlMat, group);
    makeBox(12, -40, 12, 6, 2, 5, tlMat, group);

    const wheels = [];
    [[-18, 22], [18, 22], [-18, -22], [18, -22]].forEach(([wx, wy]) => {
        const w = makeBox(wx, wy, 7, 5, 15, 14, matRoad, group);
        wheels.push(w);
    });

    vehiclesGroup.add(group);
    return { mesh: group, wheels };
}

// ================= 8. MOVING TRAFFIC =================
const activeTraffic = [];
const carColors = [0xFFFFFF, 0x1E293B, 0xEF4444, 0x3B82F6, 0x94A3B8, 0xFACC15];

function spawnTrafficCar() {
    const goRight = Math.random() > 0.5;
    const laneY = goRight ? -815 : -745;
    const startX = goRight ? -1450 : 1450;
    const speed = (goRight ? 1 : -1) * (Math.random() * 80 + 140);
    const angle = goRight ? -Math.PI / 2 : Math.PI / 2;

    const isAmbulance = Math.random() < 0.25;
    let carObj;

    if (isAmbulance) {
        carObj = createAmbulance(startX, laneY, 2, angle, true);
        carObj.isAmbulance = true;
    } else {
        const col = carColors[Math.floor(Math.random() * carColors.length)];
        carObj = createSedan(startX, laneY, 2, angle, col);
        carObj.isAmbulance = false;
    }

    carObj.speed = speed;
    carObj.goRight = goRight;
    activeTraffic.push(carObj);
}

spawnTrafficCar();
setTimeout(spawnTrafficCar, 1500);

setInterval(() => {
    if (activeTraffic.length < 5) {
        spawnTrafficCar();
    }
}, 3000);

// ================= 9. ADVANCED CHARACTER SYSTEM & EXPRESSIVE FACES =================
const characters = [];
const mixers = [];
const clock = new THREE.Clock();

const skinTones = [0xFFE0BD, 0xF3D2B5, 0xD2A679, 0xA87A51];
const hairColors = [0x1C1917, 0x451A03, 0x9A3412, 0xD97706, 0xE2E8F0];
const casualShirtColors = [0x3B82F6, 0xEF4444, 0x10B981, 0xF59E0B, 0x8B5CF6, 0xEC4899, 0xFFFFFF, 0x1E293B, 0x06B6D4];
const casualPantsColors = [0x1E3A8A, 0x1F2937, 0x374151, 0x4B5563, 0xD4D4D8, 0x78716C];

// Speech & Mood Library
const adminPhrases = [
    "ระบบ HI7 ทำงานปกติ เซิร์ฟเวอร์โหลด 22% 💻",
    "ตรวจสอบการเชื่อมต่อ API ทุกแผนกเสถียรดี 👍",
    "อย่าลืมล็อกหน้าจอตอนลุกออกจากโต๊ะนะครับ 🔐",
    "กำลังมอนิเตอร์ระบบฐานข้อมูลโรงพยาบาล...",
    "Backup ข้อมูลประจำวันเสร็จสมบูรณ์เรียบร้อย",
    "เน็ตเวิร์กไม่มีปัญหา ใครมีติดขัดแจ้งไอทีได้ครับ"
];

const moodPhrases = {
    fighting: [
        "คิวเยอะแค่ไหนพวกเราก็ไม่หวั่น สู้โว้ยยย! 🔥",
        "บริการด้วยหัวใจ คนไข้ต้องปลอดภัยทุกคน ❤️",
        "ทีมเวิร์กเราเยี่ยมที่สุด ลุยกันต่อ!",
        "เหนื่อยแต่มีรอยยิ้ม คนไข้หายดีเราก็ชื่นใจ 😊"
    ],
    hungry: [
        "เที่ยงนี้กินอะไรดี ชานมไข่มุกต้องเข้าแล้ว 🧋",
        "ร่างนี้ขับเคลื่อนด้วยอเมริกาโน่เย็น แก้วที่สองแล้ว ☕",
        "หิวจนตาลาย ขอเคลียร์คิวตรงนี้ก่อนนะ 🤤",
        "บ่ายนี้มีใครสั่งกาแฟไหม ฝากแก้วหนึ่งนะ"
    ],
    tired: [
        "โอยยย ปวดหลังจัง เก้าอี้ดูดวิญญาณมาก 😂",
        "เดินทะลุหมื่นก้าวแล้ว ขอยืดเส้นยืดสายหน่อย",
        "อยากวาร์ปกลับไปนอนที่บ้านจังเลย 🛌",
        "นับถอยหลังอีก 2 ชั่วโมงจะได้ส่งเวรแล้ว 🙏"
    ],
    encouraging: [
        "สู้ๆ นะทุกคน ใกล้หมดเวรแล้ว เก่งมาก!",
        "พักดื่มน้ำบ้างนะ อย่ามัวแต่ทำงานจนลืมดูแลตัวเอง",
        "มีอะไรให้ช่วยบอกได้เสมอนะครับ",
        "วันนี้ทำได้ยอดเยี่ยมมากทุกคน ❤️"
    ],
    patient: [
        "รอคิวตรวจสักครู่ครับ หวังว่าหมอจะให้กลับบ้านวันนี้",
        "โรงพยาบาลบริการดีมาก เจ้าหน้าที่ใจดีทุกคนเลย",
        "รู้สึกดีขึ้นมากแล้วครับหลังจากได้ทานยา",
        "วันนี้คนไข้เยอะจัง แต่คิวรันค่อนข้างไว"
    ]
};

const dialoguePairs = [
    { q: "คิววันนี้แน่นมากเลย ไหวไหมครับ!", a: "สู้ตายครับพี่ เพื่อคนไข้ทุกคน ลุยต่อ!" },
    { q: "เที่ยงนี้กินอะไรดี หิวจนตาลายแล้วเนี่ย 🤤", a: "สั่งส้มตำหรือข้าวมันไก่ร้านหน้า รพ. ไหม เดี๋ยวโทรสั่งให้!" },
    { q: "ขอกาแฟสักแก้ว ตาจะปิดแล้ว ☕", a: "ไปชงด้วยกันไหม กำลังจะเดินไปห้องพักพอดีเลย" },
    { q: "เดินเยอะจนปวดหลังเลย เก้าอี้ก็ดูดวิญญาณ 😂", a: "ยืดเส้นยืดสายหน่อยนะ อย่าลืมพักดื่มน้ำบ้างล่ะ" },
    { q: "ระบบ HI7 มีปัญหาตรงไหนแจ้งได้เลยนะครับ 💻", a: "ขอบคุณครับแอดมิน วันนี้ระบบลื่นไหลดีมากเลยครับ!" },
    { q: "สวัสดีครับ ติดต่อแผนกไหนสอบถามได้นะครับ", a: "ขอบคุณมากครับคุณพยาบาล บริการประทับใจมากครับ ❤️" }
];

function createAdminDiamond() {
    const group = new THREE.Group();
    const geo = new THREE.OctahedronGeometry(6, 0);
    const mat = new THREE.MeshPhysicalMaterial({
        color: 0x38BDF8,
        emissive: 0x0284C7,
        emissiveIntensity: 0.7,
        roughness: 0.1,
        metalness: 0.1,
        transmission: 0.8,
        ior: 2.4
    });
    const diamond = new THREE.Mesh(geo, mat);
    diamond.scale.set(1.2, 1.2, 1.8);
    diamond.rotation.x = Math.PI / 4;
    group.add(diamond);

    const aura = new THREE.PointLight(0x38BDF8, 1.8, 80);
    group.add(aura);
    return group;
}

// Procedural Human Builder with Detailed Faces (ตา คิ้ว จมูก ปาก แก้ม)
function buildProceduralHuman(data) {
    const group = new THREE.Group();

    const isChild = (data.ageGroup === 'child');
    const isElderly = (data.ageGroup === 'elderly');
    const isFemale = (data.gender === '2' || data.gender === 'Female');

    let scale = 1.0;
    if (isChild) scale = 0.65;
    else if (isElderly) scale = 0.90;
    group.scale.set(scale, scale, scale);

    const skinColor = data.skinTone || skinTones[Math.floor(Math.random() * skinTones.length)];
    const hairColor = isElderly ? 0xE2E8F0 : (data.hairColor || hairColors[Math.floor(Math.random() * hairColors.length)]);
    const matSkin = new THREE.MeshLambertMaterial({ color: skinColor });
    const matHair = new THREE.MeshLambertMaterial({ color: hairColor });
    const matEyeWhite = new THREE.MeshBasicMaterial({ color: 0xFFFFFF });
    const matEyePupil = new THREE.MeshBasicMaterial({ color: 0x1E293B });
    const matMouth = new THREE.MeshBasicMaterial({ color: 0xB91C1C });
    const matCheek = new THREE.MeshBasicMaterial({ color: 0xFCA5A5, transparent: true, opacity: 0.65 });
    const matNose = new THREE.MeshLambertMaterial({ color: new THREE.Color(skinColor).offsetHSL(0, 0.05, -0.06) });

    let shirtColor = data.shirtColor;
    let pantsColor = data.pantsColor;

    if (data.role === 'ผู้ดูแลระบบ') {
        shirtColor = 0x0F172A; pantsColor = 0x1E293B;
    } else if (data.role === 'ตรวจ') {
        shirtColor = 0xFFFFFF; pantsColor = 0x1E293B;
    } else if (data.role === 'ซักประวัติ' || data.role === 'ซักประวัติตรวจแทนแพทย์') {
        shirtColor = 0x38BDF8; pantsColor = 0xFFFFFF;
    } else if (data.role === 'เจ้าหน้าที่เอกซเรย์') {
        shirtColor = 0x67E8F9; pantsColor = 0x1E293B;
    } else if (data.role === 'เจ้าหน้าที่ชันสูตร') {
        shirtColor = 0x06B6D4; pantsColor = 0xFFFFFF;
    } else if (data.role === 'เจ้าหน้าที่โภชนาการ') {
        shirtColor = 0x10B981; pantsColor = 0x334155;
    } else if (data.role === 'เจ้าหน้าที่ลงทะเบียน') {
        shirtColor = 0x0284C7; pantsColor = 0x1E293B;
    } else if (data.role === 'เจ้าหน้าที่ตรวจสอบข้อมูล') {
        shirtColor = 0x6366F1; pantsColor = 0x1E293B;
    } else if (data.role === 'เจ้าหน้าที่การเงิน') {
        shirtColor = 0x059669; pantsColor = 0x1E293B;
    } else if (data.role === 'เจ้าหน้าที่') {
        shirtColor = 0x0284C7; pantsColor = 0x334155;
    } else {
        if (!shirtColor) {
            const isGown = Math.random() < 0.25;
            shirtColor = isGown ? 0xBAE6FD : casualShirtColors[Math.floor(Math.random() * casualShirtColors.length)];
        }
        if (!pantsColor) pantsColor = casualPantsColors[Math.floor(Math.random() * casualPantsColors.length)];
    }

    const matShirt = new THREE.MeshLambertMaterial({ color: shirtColor });
    const matPants = new THREE.MeshLambertMaterial({ color: pantsColor });
    const matShoe = new THREE.MeshLambertMaterial({ color: 0x1E293B });

    // Torso
    const torso = makeBox(0, 0, 26, 14, 8, 16, matShirt, group);

    // Head
    const head = makeBox(0, 0, 39, 10, 10, 10, matSkin, group);

    // ================= DETAILED EXPRESSIVE FACE =================
    // Left & Right Eyes (ตาขาว + ม่านตาดำ)
    makeBox(-2.4, 5.1, 40, 2.2, 0.4, 2.2, matEyeWhite, group, false, false);
    makeBox(2.4, 5.1, 40, 2.2, 0.4, 2.2, matEyeWhite, group, false, false);
    makeBox(-2.4, 5.2, 40, 1.2, 0.4, 1.4, matEyePupil, group, false, false);
    makeBox(2.4, 5.2, 40, 1.2, 0.4, 1.4, matEyePupil, group, false, false);

    // Eyebrows (คิ้ว)
    makeBox(-2.4, 5.15, 42.1, 2.6, 0.4, 0.7, matHair, group, false, false);
    makeBox(2.4, 5.15, 42.1, 2.6, 0.4, 0.7, matHair, group, false, false);

    // Nose (จมูก)
    makeBox(0, 5.3, 38.5, 1.4, 1.0, 1.8, matNose, group, false, false);

    // Mouth / Smile (รอยยิ้ม)
    const hasMask = data.hasMask || Math.random() < 0.35 || data.role.includes('เจ้าหน้าที่') || data.role.includes('แพทย์');
    if (!hasMask) {
        makeBox(0, 5.1, 36.3, 3.2, 0.4, 0.9, matMouth, group, false, false);
        // Cheeks blush (แก้มอมชมพู)
        makeBox(-3.6, 5.08, 38, 1.8, 0.3, 1.0, matCheek, group, false, false);
        makeBox(3.6, 5.08, 38, 1.8, 0.3, 1.0, matCheek, group, false, false);
    } else {
        // Surgical Mask
        makeBox(0, 5.2, 36.5, 8.6, 1.8, 4.6, new THREE.MeshLambertMaterial({ color: 0x38BDF8 }), group);
    }

    // Glasses (แว่นตา)
    if (data.hasGlasses || Math.random() < 0.35) {
        makeBox(-2.4, 5.4, 40, 3.2, 0.8, 2.8, matMetal, group, false, false);
        makeBox(2.4, 5.4, 40, 3.2, 0.8, 2.8, matMetal, group, false, false);
        makeBox(0, 5.4, 40.5, 1.8, 0.8, 0.6, matMetal, group, false, false);
    }

    // Hair
    if (data.hairStyle === 'long' || (isFemale && Math.random() > 0.4)) {
        makeBox(0, 0, 44, 11, 11, 4, matHair, group);
        makeBox(0, -5, 36, 11, 3, 14, matHair, group);
    } else if (data.hairStyle === 'ponytail' || (isFemale && Math.random() > 0.5)) {
        makeBox(0, 0, 44, 11, 11, 4, matHair, group);
        makeBox(0, -7, 40, 5, 5, 8, matHair, group);
    } else if (data.hairStyle === 'bald') {
        makeBox(0, 0, 43, 10.4, 10.4, 2, matHair, group);
    } else {
        makeBox(0, 0, 44, 10.8, 10.8, 3.5, matHair, group);
        makeBox(0, -4, 41, 10.8, 3, 5, matHair, group);
    }

    // Limbs
    const legL = makeBox(-4, 0, 10, 5, 6, 18, matPants, group);
    const legR = makeBox(4, 0, 10, 5, 6, 18, matPants, group);
    makeBox(-4, 1, 1, 5.2, 8, 3, matShoe, group);
    makeBox(4, 1, 1, 5.2, 8, 3, matShoe, group);

    const armL = makeBox(-8.5, 0, 24, 3.5, 4, 14, matShirt, group);
    const armR = makeBox(8.5, 0, 24, 3.5, 4, 14, matShirt, group);

    if (isElderly) {
        makeBox(9.5, 3, 12, 1.5, 1.5, 24, matWood, group);
        torso.rotation.x = 0.12;
        head.position.y += 1.5;
    }

    let diamondMesh = null;
    if (data.role === 'ผู้ดูแลระบบ') {
        diamondMesh = createAdminDiamond();
        diamondMesh.position.set(0, 0, 56);
        group.add(diamondMesh);
    }

    return { model: group, torso, head, legL, legR, armL, armR, diamondMesh };
}

// ================= 10. WAYPOINT NAVIGATION & NO-WALL-CLIPPING =================
// Key Waypoints that connect corridors and doors
const navWaypoints = {
    // Hallway Spine nodes
    MAIN_ENTRANCE: new THREE.Vector2(0, -560),
    LOBBY_CENTER: new THREE.Vector2(0, -360),
    CORRIDOR_1_MID: new THREE.Vector2(0, -200),
    CORRIDOR_1_LEFT: new THREE.Vector2(-480, -200),
    CORRIDOR_1_RIGHT: new THREE.Vector2(480, -200),
    CORRIDOR_2_MID: new THREE.Vector2(0, 190),
    CORRIDOR_2_LEFT: new THREE.Vector2(-480, 190),
    CORRIDOR_2_RIGHT: new THREE.Vector2(480, 190),

    // Room Doorways
    DOOR_ZONE9: new THREE.Vector2(-400, -360),
    DOOR_XRAY: new THREE.Vector2(-770, -200),
    DOOR_LAB: new THREE.Vector2(-350, -200),
    DOOR_CASHIER: new THREE.Vector2(0, -200),
    DOOR_PHARMACY: new THREE.Vector2(360, -200),
    DOOR_ER: new THREE.Vector2(680, -200),
    DOOR_PHYSIO: new THREE.Vector2(-810, 190),
    DOOR_THAI: new THREE.Vector2(-450, 190),
    DOOR_DENTAL: new THREE.Vector2(-85, 190),
    DOOR_IPD: new THREE.Vector2(370, 190),
    DOOR_MORTUARY: new THREE.Vector2(830, 190)
};

// Room locations and their nearest connecting doorway
const roomZones = [
    { name: 'โซน 9 จุดคัดกรอง', target: new THREE.Vector2(-700, -360), door: navWaypoints.DOOR_ZONE9, corridor: navWaypoints.CORRIDOR_1_LEFT },
    { name: 'โถงกลาง / จุดพักรอ', target: new THREE.Vector2(0, -360), door: navWaypoints.LOBBY_CENTER, corridor: navWaypoints.CORRIDOR_1_MID },
    { name: 'โซน 5 ห้อง X-RAY', target: new THREE.Vector2(-770, -10), door: navWaypoints.DOOR_XRAY, corridor: navWaypoints.CORRIDOR_1_LEFT },
    { name: 'โซน 6 ห้อง Lab', target: new THREE.Vector2(-350, -10), door: navWaypoints.DOOR_LAB, corridor: navWaypoints.CORRIDOR_1_LEFT },
    { name: 'โซน 8 ห้องเก็บเงิน', target: new THREE.Vector2(0, 40), door: navWaypoints.DOOR_CASHIER, corridor: navWaypoints.CORRIDOR_1_MID },
    { name: 'โซน 7 ห้องยา', target: new THREE.Vector2(360, 40), door: navWaypoints.DOOR_PHARMACY, corridor: navWaypoints.CORRIDOR_1_RIGHT },
    { name: 'โซน 2 ฉุกเฉิน', target: new THREE.Vector2(760, -10), door: navWaypoints.DOOR_ER, corridor: navWaypoints.CORRIDOR_1_RIGHT },
    { name: 'โซน 10 กายภาพบำบัด', target: new THREE.Vector2(-810, 380), door: navWaypoints.DOOR_PHYSIO, corridor: navWaypoints.CORRIDOR_2_LEFT },
    { name: 'โซน 11 แผนไทย', target: new THREE.Vector2(-450, 380), door: navWaypoints.DOOR_THAI, corridor: navWaypoints.CORRIDOR_2_LEFT },
    { name: 'โซน 12 ทันตกรรม', target: new THREE.Vector2(-85, 380), door: navWaypoints.DOOR_DENTAL, corridor: navWaypoints.CORRIDOR_2_MID },
    { name: 'โซน 3 ผู้ป่วยใน', target: new THREE.Vector2(370, 380), door: navWaypoints.DOOR_IPD, corridor: navWaypoints.CORRIDOR_2_RIGHT },
    { name: 'โซน 4 ห้องดับจิต', target: new THREE.Vector2(830, 380), door: navWaypoints.DOOR_MORTUARY, corridor: navWaypoints.CORRIDOR_2_RIGHT }
];

// Helper to check if a line segment crosses any wall
function isLineBlockedByWall(p1, p2) {
    const minX = Math.min(p1.x, p2.x);
    const maxX = Math.max(p1.x, p2.x);
    const minY = Math.min(p1.y, p2.y);
    const maxY = Math.max(p1.y, p2.y);

    for (const wall of wallObstacles) {
        if (maxX < wall.minX || minX > wall.maxX || maxY < wall.minY || minY > wall.maxY) continue;
        return true;
    }
    return false;
}

// Plan route through doorways & corridors (ห้ามเดินทะลุกำแพง)
function planCorridorRoute(fromPos, toPos, destZone) {
    // If direct line is not blocked, walk directly!
    if (!isLineBlockedByWall(fromPos, toPos)) {
        return [toPos];
    }

    const route = [];
    const fromY = fromPos.y;
    const toY = toPos.y;

    // Route through corridors based on Y position
    if (fromY < -220) {
        // In Front / Lobby
        if (toY >= -200 && toY <= 190) {
            // Moving into Middle row
            route.push(new THREE.Vector2(fromPos.x, -210));
            if (destZone && destZone.door) route.push(destZone.door);
        } else if (toY > 190) {
            // Moving to Back row
            route.push(new THREE.Vector2(0, -210));
            route.push(new THREE.Vector2(0, 190));
            if (destZone && destZone.door) route.push(destZone.door);
        }
    } else if (fromY >= -200 && fromY <= 190) {
        // In Middle row
        if (toY < -220) {
            route.push(new THREE.Vector2(fromPos.x, -210));
            route.push(new THREE.Vector2(0, -210));
        } else if (toY > 190) {
            route.push(new THREE.Vector2(fromPos.x, 190));
            if (destZone && destZone.door) route.push(destZone.door);
        }
    } else {
        // In Back row
        route.push(new THREE.Vector2(fromPos.x, 190));
        if (toY < 190) {
            route.push(new THREE.Vector2(0, 190));
            route.push(new THREE.Vector2(0, -210));
            if (destZone && destZone.door) route.push(destZone.door);
        }
    }

    route.push(toPos);
    return route;
}

async function createCharacter3D(data) {
    const procedural = buildProceduralHuman(data);
    const model = procedural.model;
    model.position.set(data.posX, data.posY, 0);
    scene.add(model);

    const nt = document.createElement('div');
    nt.className = 'name-tag';
    nt.innerText = data.role === 'ผู้ดูแลระบบ' ? `💎 ${data.name}` : data.name;
    if (data.role === 'ผู้ดูแลระบบ') {
        nt.style.borderColor = '#38BDF8';
        nt.style.boxShadow = '0 0 10px rgba(56, 189, 248, 0.7)';
    }
    document.getElementById('ui-layer').appendChild(nt);

    const sb = document.createElement('div');
    sb.className = 'speech-bubble';
    document.getElementById('ui-layer').appendChild(sb);

    const charObj = {
        id: data.userId || data.name + Math.random(),
        model: model,
        procedural: procedural,
        name: data.name,
        role: data.role,
        type: data.type || data.role,
        nameTag: nt,
        speechBubble: sb,
        target: new THREE.Vector2(data.posX, data.posY),
        waypoints: [],
        isWalking: false,
        isInteracting: false,
        lastInteractTime: 0,
        status: "ปฏิบัติหน้าที่",
        zone: "โถงกลาง",
        isPatient: data.isPatient || false,
        ageGroup: data.ageGroup || 'adult',
        walkCycle: Math.random() * Math.PI,

        say: function (text) {
            this.speechBubble.innerText = text;
            this.speechBubble.style.display = 'block';
            setTimeout(() => { this.speechBubble.style.display = 'none'; }, 3800);
        },

        speakRandomMood: function () {
            if (this.isInteracting) return;
            let list = moodPhrases.fighting;
            if (this.role === 'ผู้ดูแลระบบ') list = adminPhrases;
            else if (this.isPatient) list = moodPhrases.patient;
            else {
                const moods = [moodPhrases.fighting, moodPhrases.hungry, moodPhrases.tired, moodPhrases.encouraging];
                list = moods[Math.floor(Math.random() * moods.length)];
            }
            const phrase = list[Math.floor(Math.random() * list.length)];
            this.say(phrase);
        }
    };

    characters.push(charObj);
    assignRolePosition(charObj);
    return charObj;
}

function assignRolePosition(char) {
    let destPos = new THREE.Vector2(0, 0);
    let chosenZone = null;
    const r = char.role;

    if (r === 'ผู้ดูแลระบบ') {
        // Patrol all hospital zones through doorways
        chosenZone = roomZones[Math.floor(Math.random() * roomZones.length)];
        destPos = chosenZone.target.clone().add(new THREE.Vector2((Math.random() - 0.5) * 40, (Math.random() - 0.5) * 40));
        char.zone = chosenZone.name;
    } else if (r === 'เจ้าหน้าที่') {
        chosenZone = roomZones[Math.floor(Math.random() * 4)];
        destPos = chosenZone.target.clone().add(new THREE.Vector2((Math.random() - 0.5) * 60, (Math.random() - 0.5) * 60));
        char.zone = "ประสานงานทั่วไป";
    } else if (r === 'ซักประวัติ') {
        destPos.set(-700 + (Math.random() - 0.5) * 30, -360);
        char.zone = "โซน 9 จุดคัดกรอง";
    } else if (r === 'ตรวจ') {
        destPos.set(-840, 30 + (Math.random() - 0.5) * 30);
        char.zone = "ห้องตรวจแพทย์";
    } else if (r === 'ซักประวัติตรวจแทนแพทย์') {
        destPos.set(-700, 30 + (Math.random() - 0.5) * 30);
        char.zone = "หน้าห้องตรวจแพทย์";
    } else if (r === 'เจ้าหน้าที่เอกซเรย์') {
        destPos.set(-770 + (Math.random() - 0.5) * 30, -10);
        char.zone = "โซน 5 ห้อง X-RAY";
    } else if (r === 'เจ้าหน้าที่ชันสูตร') {
        destPos.set(-350 + (Math.random() - 0.5) * 30, -10);
        char.zone = "โซน 6 ห้อง Lab";
    } else if (r === 'เจ้าหน้าที่โภชนาการ') {
        destPos.set(250 + (Math.random() - 0.5) * 50, 380);
        char.zone = "โภชนาการและวอร์ด";
    } else if (r === 'เจ้าหน้าที่ลงทะเบียน') {
        destPos.set(-120, -450);
        char.zone = "เคาน์เตอร์ลงทะเบียน";
    } else if (r === 'เจ้าหน้าที่ตรวจสอบข้อมูล') {
        destPos.set(120, -450);
        char.zone = "เคาน์เตอร์ตรวจสอบสิทธิ์";
    } else if (r === 'เจ้าหน้าที่การเงิน') {
        destPos.set(0 + (Math.random() - 0.5) * 30, 40);
        char.zone = "โซน 8 ห้องเก็บเงิน";
    } else if (char.isPatient) {
        const step = Math.random();
        if (step < 0.45) {
            destPos.set((Math.random() - 0.5) * 200, -380 + Math.random() * 100);
            char.zone = "โถงพักรอ";
        } else if (step < 0.75) {
            destPos.set(-700 + (Math.random() - 0.5) * 50, -380);
            char.zone = "รอคัดกรอง";
        } else {
            destPos.set(360 + (Math.random() - 0.5) * 50, 40);
            char.zone = "รอรับยา";
        }
    } else {
        destPos.set((Math.random() - 0.5) * 200, -300 + Math.random() * 100);
    }

    startWalkingPath(char, destPos, chosenZone);
}

function startWalkingPath(char, finalTarget, destZone) {
    if (!char.model) return;
    const currentPos = new THREE.Vector2(char.model.position.x, char.model.position.y);
    char.waypoints = planCorridorRoute(currentPos, finalTarget, destZone);

    if (char.waypoints.length > 0) {
        char.target = char.waypoints.shift();
        char.isWalking = true;
        char.model.rotation.z = Math.atan2(char.target.y - char.model.position.y, char.target.x - char.model.position.x) - Math.PI / 2;
    }
}

// Social Interaction on Collision
function triggerSocialInteraction(c1, c2) {
    c1.isWalking = false;
    c2.isWalking = false;
    c1.isInteracting = true;
    c2.isInteracting = true;

    c1.model.rotation.z = Math.atan2(c2.model.position.y - c1.model.position.y, c2.model.position.x - c1.model.position.x) - Math.PI / 2;
    c2.model.rotation.z = Math.atan2(c1.model.position.y - c2.model.position.y, c1.model.position.x - c2.model.position.x) - Math.PI / 2;

    const pair = dialoguePairs[Math.floor(Math.random() * dialoguePairs.length)];
    c1.say(pair.q);
    setTimeout(() => {
        if (c2.speechBubble) c2.say(pair.a);
    }, 1200);

    setTimeout(() => {
        c1.isInteracting = false;
        c2.isInteracting = false;
        c1.lastInteractTime = Date.now();
        c2.lastInteractTime = Date.now();

        assignRolePosition(c1);
        assignRolePosition(c2);
    }, 3800);
}

// ================= 11. C# INTEGRATION BRIDGES =================
window.syncStaffData = function (staffArray) {
    staffArray.forEach(s => {
        const exists = characters.find(c => c.id === s.userId);
        if (!exists) {
            s.posX = 0; s.posY = -560;
            createCharacter3D(s);
        }
    });
};

window.syncPatientFlow = function (data) {
    const currentWait = characters.filter(c => c.isPatient).length;
    if (currentWait < data.wait && currentWait < 24) {
        const ages = ['child', 'adult', 'adult', 'adult', 'elderly'];
        const chosenAge = ages[Math.floor(Math.random() * ages.length)];
        const isF = Math.random() > 0.5;

        createCharacter3D({
            name: `${isF ? 'นาง' : 'นาย'}${chosenAge === 'child' ? 'น้อย' : ''}-${Math.floor(Math.random() * 899 + 100)}`,
            role: "ผู้ป่วย",
            type: "OPD",
            isPatient: true,
            ageGroup: chosenAge,
            gender: isF ? "2" : "1",
            posX: (Math.random() - 0.5) * 80,
            posY: -560
        });
    }
    if (document.getElementById('total-patients-count')) {
        document.getElementById('total-patients-count').innerText = data.wait + 142 + 28 + 146;
    }
};

window.updateTVChart = function (dt) { drawScreen1(); texS1.needsUpdate = true; };
window.updateStaffChart = function (dt) { drawScreen2(); texS2.needsUpdate = true; };

// ================= 12. CAMERA PRESETS & HUD TOGGLES =================
let currentViewMode = '3D';
window.setCameraView = function (mode) {
    currentViewMode = mode;
    document.querySelectorAll('.cam-btn').forEach(b => b.classList.remove('active'));
    if (document.getElementById(`btn-cam-${mode.toLowerCase()}`)) {
        document.getElementById(`btn-cam-${mode.toLowerCase()}`).classList.add('active');
    }

    if (mode === '3D') {
        controls.target.set(0, 30, 0);
        camera.position.set(0, -1350, 1050);
    } else if (mode === 'TOP') {
        controls.target.set(0, 40, 0);
        camera.position.set(0, 40, 1800);
    } else if (mode === 'WALK') {
        controls.target.set(0, -200, 30);
        camera.position.set(0, -640, 35);
    }
};

window.toggleZoneVisibility = function (visible) {
    zoneContainerEl.style.display = visible ? 'block' : 'none';
};

window.toggleFurnitureVisibility = function (visible) {
    furnitureGroup.visible = visible;
};

window.togglePatientInfo = function (visible) {
    document.getElementById('ui-layer').style.display = visible ? 'block' : 'none';
};

window.toggle3DMode = function (enabled) {
    setCameraView(enabled ? '3D' : 'TOP');
};

// ================= 13. INTERACTION & RAYCASTING =================
let followedChar = null;
const raycaster = new THREE.Raycaster();
const mouse = new THREE.Vector2();

window.addEventListener('pointerdown', (e) => {
    if (e.target.closest('#hud-container') || e.target.closest('#CharInspectorCard')) return;

    mouse.x = (e.clientX / window.innerWidth) * 2 - 1;
    mouse.y = -(e.clientY / window.innerHeight) * 2 + 1;
    raycaster.setFromCamera(mouse, camera);

    const intersects = raycaster.intersectObjects(scene.children, true);
    if (intersects.length > 0) {
        let object = intersects[0].object;
        while (object.parent && object.parent !== scene) object = object.parent;

        const clickedChar = characters.find(c => c.model === object);
        if (clickedChar) {
            window.inspectedChar = clickedChar;
            document.getElementById('CharInspectorCard').style.display = 'block';
            document.getElementById('inspectorName').innerText = clickedChar.name;
            document.getElementById('inspectorRole').innerText = clickedChar.role;
            document.getElementById('inspectorStatus').innerText = clickedChar.status;
            document.getElementById('inspectorZone').innerText = clickedChar.zone;
            clickedChar.speakRandomMood();
        }
    }
});

window.closeInspector = function () {
    document.getElementById('CharInspectorCard').style.display = 'none';
};

window.startFollowCamera = function () {
    followedChar = window.inspectedChar;
    window.closeInspector();
};

window.addEventListener('resize', () => {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
});

// ================= 14. MAIN ANIMATION LOOP =================
let sirenTimer = 0;
let sirenToggle = false;
let moodSpeakTimer = 0;

function animate() {
    requestAnimationFrame(animate);
    const delta = clock.getDelta();

    // Ambulance Sirens
    sirenTimer += delta;
    if (sirenTimer > 0.25) {
        sirenTimer = 0;
        sirenToggle = !sirenToggle;
        parkedAmbulances.forEach(a => {
            if (isNight) {
                a.redLightMat.color.setHex(sirenToggle ? 0xFF0000 : 0x440000);
                a.blueLightMat.color.setHex(!sirenToggle ? 0x0088FF : 0x001144);
            }
        });
        activeTraffic.forEach(c => {
            if (c.isAmbulance && isNight) {
                c.redLightMat.color.setHex(sirenToggle ? 0xFF0000 : 0x440000);
                c.blueLightMat.color.setHex(!sirenToggle ? 0x0088FF : 0x001144);
            }
        });
    }

    // Moving Traffic
    for (let i = activeTraffic.length - 1; i >= 0; i--) {
        const car = activeTraffic[i];
        car.mesh.position.x += car.speed * delta;
        if (car.wheels) {
            car.wheels.forEach(w => {
                w.rotation.x += (car.speed > 0 ? 1 : -1) * delta * 12;
            });
        }
        if ((car.goRight && car.mesh.position.x > 1450) || (!car.goRight && car.mesh.position.x < -1450)) {
            scene.remove(car.mesh);
            activeTraffic.splice(i, 1);
        }
    }

    // Periodic Random Chatter
    moodSpeakTimer += delta;
    if (moodSpeakTimer > 12) {
        moodSpeakTimer = 0;
        if (characters.length > 0) {
            const randomChar = characters[Math.floor(Math.random() * characters.length)];
            randomChar.speakRandomMood();
        }
    }

    // Character Movement & Obstacle Check
    const now = Date.now();
    for (let i = 0; i < characters.length; i++) {
        const char = characters[i];
        if (!char.model) continue;

        // Admin Diamond
        if (char.procedural && char.procedural.diamondMesh) {
            char.procedural.diamondMesh.rotation.z += delta * 2.5;
            char.procedural.diamondMesh.position.z = 56 + Math.sin(now * 0.004) * 3;
        }

        // Proximity Collision check
        if (char.isWalking && !char.isInteracting && (now - char.lastInteractTime > 15000)) {
            for (let j = i + 1; j < characters.length; j++) {
                const other = characters[j];
                if (other.isWalking && !other.isInteracting && (now - other.lastInteractTime > 15000)) {
                    const dist = char.model.position.distanceTo(other.model.position);
                    if (dist < 36) {
                        if (Math.random() < 0.30) {
                            triggerSocialInteraction(char, other);
                            break;
                        }
                    }
                }
            }
        }

        // Walking along waypoints (Through doorways, never crossing walls)
        if (char.isWalking && !char.isInteracting) {
            const curPos = new THREE.Vector2(char.model.position.x, char.model.position.y);
            const distToTarget = curPos.distanceTo(char.target);

            if (distToTarget < 8) {
                // Next waypoint in path
                if (char.waypoints && char.waypoints.length > 0) {
                    char.target = char.waypoints.shift();
                    char.model.rotation.z = Math.atan2(char.target.y - char.model.position.y, char.target.x - char.model.position.x) - Math.PI / 2;
                } else {
                    // Reached final destination
                    char.isWalking = false;
                    if (char.procedural) {
                        char.procedural.legL.rotation.x = 0;
                        char.procedural.legR.rotation.x = 0;
                        char.procedural.armL.rotation.x = 0;
                        char.procedural.armR.rotation.x = 0;
                    }
                    setTimeout(() => { if (!char.isInteracting) assignRolePosition(char); }, 5000 + Math.random() * 8000);
                }
            } else {
                const speed = (char.ageGroup === 'child' ? 95 : (char.ageGroup === 'elderly' ? 45 : 75)) * delta;
                const dir = new THREE.Vector2().subVectors(char.target, curPos).normalize();
                
                const nextX = char.model.position.x + dir.x * speed;
                const nextY = char.model.position.y + dir.y * speed;

                // Wall Collision Guard: Verify next step does not penetrate solid walls
                let blocked = false;
                for (const w of wallObstacles) {
                    if (nextX >= w.minX && nextX <= w.maxX && nextY >= w.minY && nextY <= w.maxY) {
                        blocked = true;
                        break;
                    }
                }

                if (!blocked) {
                    char.model.position.x = nextX;
                    char.model.position.y = nextY;
                } else {
                    // Re-route around doorway if blocked
                    assignRolePosition(char);
                }

                // Limb swing animation
                char.walkCycle += delta * (char.ageGroup === 'child' ? 14 : 9);
                const swing = Math.sin(char.walkCycle) * 0.55;
                if (char.procedural) {
                    char.procedural.legL.rotation.x = swing;
                    char.procedural.legR.rotation.x = -swing;
                    char.procedural.armL.rotation.x = -swing * 0.8;
                    char.procedural.armR.rotation.x = swing * 0.8;
                }
            }
        }

        // Project HTML tags
        const tempV = new THREE.Vector3(char.model.position.x, char.model.position.y, char.model.position.z + 52);
        tempV.project(camera);
        const sx = (tempV.x * 0.5 + 0.5) * window.innerWidth;
        const sy = (tempV.y * -0.5 + 0.5) * window.innerHeight;

        char.nameTag.style.left = `${sx}px`;
        char.nameTag.style.top = `${sy}px`;
        char.speechBubble.style.left = `${sx}px`;
        char.speechBubble.style.top = `${sy - 30}px`;
    }

    // 3D Badges
    const wp = new THREE.Vector3();
    zoneLabelsGroup.forEach(item => {
        wp.copy(item.pos).project(camera);
        if (wp.z < 1) {
            item.el.style.display = 'block';
            item.el.style.left = `${(wp.x * 0.5 + 0.5) * window.innerWidth}px`;
            item.el.style.top = `${(wp.y * -0.5 + 0.5) * window.innerHeight}px`;
        } else {
            item.el.style.display = 'none';
        }
    });

    // Camera follow
    if (followedChar && followedChar.model) {
        const cx = followedChar.model.position.x;
        const cy = followedChar.model.position.y;
        const rad = followedChar.model.rotation.z;
        const camX = cx - Math.sin(rad) * 300;
        const camY = cy + Math.cos(rad) * 300;
        camera.position.set(camX, camY, 200);
        camera.lookAt(cx, cy, 30);
    } else {
        controls.update();
    }

    renderer.render(scene, camera);
}
animate();

// ================= 15. INITIAL HOSPITAL SPAWN =================
setTimeout(() => {
    // 1. ผู้ดูแลระบบ
    createCharacter3D({
        name: 'แอดมินนนท์ (IT Admin)',
        role: 'ผู้ดูแลระบบ',
        posX: 0,
        posY: -300
    });

    // 2. เจ้าหน้าที่
    createCharacter3D({
        name: 'จนท.สมศักดิ์ (สนับสนุน)',
        role: 'เจ้าหน้าที่',
        posX: -200,
        posY: -360
    });

    // 3. ซักประวัติ
    createCharacter3D({
        name: 'พว.กานดา (ซักประวัติ)',
        role: 'ซักประวัติ',
        gender: '2',
        posX: -700,
        posY: -360
    });

    // 4. ตรวจ (แพทย์)
    createCharacter3D({
        name: 'นพ.ประวิทย์ (แพทย์ OPD)',
        role: 'ตรวจ',
        hasGlasses: true,
        posX: -840,
        posY: 30
    });

    // 5. ซักประวัติตรวจแทนแพทย์
    createCharacter3D({
        name: 'พว.พิมพ์ใจ (ผู้ช่วยตรวจ)',
        role: 'ซักประวัติตรวจแทนแพทย์',
        gender: '2',
        posX: -700,
        posY: 30
    });

    // 6. เจ้าหน้าที่เอกซเรย์
    createCharacter3D({
        name: 'จนท.วิโรจน์ (รังสีเทคนิค)',
        role: 'เจ้าหน้าที่เอกซเรย์',
        posX: -770,
        posY: -10
    });

    // 7. เจ้าหน้าที่ชันสูตร
    createCharacter3D({
        name: 'ทนพ.ณัฐวุฒิ (Lab)',
        role: 'เจ้าหน้าที่ชันสูตร',
        hasMask: true,
        posX: -350,
        posY: -10
    });

    // 8. เจ้าหน้าที่โภชนาการ
    createCharacter3D({
        name: 'จนท.อรทัย (โภชนาการ)',
        role: 'เจ้าหน้าที่โภชนาการ',
        gender: '2',
        posX: 250,
        posY: 380
    });

    // 9. เจ้าหน้าที่ลงทะเบียน
    createCharacter3D({
        name: 'จนท.สุพรรษา (เวชระเบียน)',
        role: 'เจ้าหน้าที่ลงทะเบียน',
        gender: '2',
        posX: -120,
        posY: -450
    });

    // 10. เจ้าหน้าที่ตรวจสอบข้อมูล
    createCharacter3D({
        name: 'จนท.ธีรพล (ตรวจสอบสิทธิ์)',
        role: 'เจ้าหน้าที่ตรวจสอบข้อมูล',
        hasGlasses: true,
        posX: 120,
        posY: -450
    });

    // 11. เจ้าหน้าที่การเงิน
    createCharacter3D({
        name: 'จนท.มณีรัตน์ (การเงิน)',
        role: 'เจ้าหน้าที่การเงิน',
        gender: '2',
        posX: 0,
        posY: 40
    });

    // Diverse Patients with expressive faces and clothes
    createCharacter3D({
        name: 'ด.ช.โตโต้ (คนไข้เด็ก)',
        role: 'ผู้ป่วย',
        ageGroup: 'child',
        shirtColor: 0xEC4899,
        pantsColor: 0xFACC15,
        posX: 40,
        posY: -350
    });

    createCharacter3D({
        name: 'คุณยายสมศรี (คนไข้ชรา)',
        role: 'ผู้ป่วย',
        ageGroup: 'elderly',
        gender: '2',
        shirtColor: 0xD97706,
        pantsColor: 0x334155,
        hasGlasses: true,
        posX: -650,
        posY: -390
    });

    createCharacter3D({
        name: 'คุณวิชัย (คนไข้ผู้ใหญ่)',
        role: 'ผู้ป่วย',
        ageGroup: 'adult',
        gender: '1',
        shirtColor: 0x3B82F6,
        pantsColor: 0x1E3A8A,
        hasMask: true,
        posX: 140,
        posY: -360
    });

    createCharacter3D({
        name: 'น.ส.แพรวา (คนไข้ชุดผู้ป่วย)',
        role: 'ผู้ป่วย',
        ageGroup: 'adult',
        gender: '2',
        shirtColor: 0xBAE6FD,
        pantsColor: 0xBAE6FD,
        posX: 360,
        posY: 40
    });
}, 1200);
