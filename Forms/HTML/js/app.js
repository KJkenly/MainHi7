import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { MeshoptDecoder } from 'three/addons/libs/meshopt_decoder.module.js';
import * as SkeletonUtils from 'three/addons/utils/SkeletonUtils.js';

/* =====================================================================
   Smart HI Simulator - โรงพยาบาลจำลอง 3D
   โมดูลหลัก: HospitalEnvironment / CharacterManager / NavigationManager /
              PatientFlowManager / HospitalDashboard
   หน่วย: 1 unit ~ 2.5 cm, แกน Z = ความสูง, กล้องมองจากทิศใต้ (-Y)
   ===================================================================== */

// ================= 1. CORE =================
const $ = id => document.getElementById(id);
const setText = (id, v) => { const e = $(id); if (e) e.innerText = String(v); };
const rand = (a, b) => a + Math.random() * (b - a);
const randRange = rand;
const pick = a => a[Math.floor(Math.random() * a.length)];
const HP = Math.PI / 2;
const FACE = { N: HP, S: -HP, E: 0, W: Math.PI };
const HOSPITAL = { name: 'โรงพยาบาลจำลอง Smart HI' };

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x87CEEB);
scene.fog = new THREE.FogExp2(0xB0E0E6, 0.00012);
const camera = new THREE.PerspectiveCamera(55, window.innerWidth / window.innerHeight, 1, 12000);
camera.up.set(0, 0, 1);
camera.position.set(0, -2700, 2300);
const renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.5));
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
$('canvas-container').appendChild(renderer.domElement);
const controls = new OrbitControls(camera, renderer.domElement);
controls.target.set(0, 100, 0);
controls.enableDamping = true;
controls.dampingFactor = 0.05;
controls.maxDistance = 7000;

const ambientLight = new THREE.AmbientLight(0xffffff, 0.95);
scene.add(ambientLight);
const hemiLight = new THREE.HemisphereLight(0xe0f2fe, 0x334155, 0.35);
hemiLight.position.set(0, 0, 2500);
scene.add(hemiLight);
const sun = new THREE.DirectionalLight(0xfff8ee, 1.5);
sun.position.set(600, -1200, 2000);
sun.castShadow = true;
// ปรับลดขนาดเงาเหลือ 1024x1024 ตามแนวทาง Shadow Optimization (ลดภาระ GPU ลง 75% โดยเงานุ่มสวยงามคงเดิม)
sun.shadow.mapSize.set(1024, 1024);
sun.shadow.bias = -0.0006;
sun.shadow.normalBias = 0.04;
Object.assign(sun.shadow.camera, { left: -2300, right: 2300, top: 2300, bottom: -2300, near: 100, far: 6000 });
scene.add(sun);

const gFurn = new THREE.Group(), gWall = new THREE.Group(), gDeco = new THREE.Group(), gZone = new THREE.Group();
scene.add(gFurn, gWall, gDeco, gZone);

// ================= 1.5 REAL-TIME DAY/NIGHT, SKY DOME, CLOUDS & HOSPITAL LIGHTING SYSTEM =================
const TimeAtmosphereManager = {
    mode: 'AUTO', // 'AUTO' (ตามเวลาจริง) หรือ 'MORNING', 'NOON', 'AFTERNOON', 'EVENING', 'NIGHT'
    modeOrder: ['AUTO', 'MORNING', 'NOON', 'AFTERNOON', 'EVENING', 'NIGHT'],
    streetLights: [],
    interiorLights: [],
    streetBulbs: [],
    interiorFixtureMaterials: [],
    skyDomeMat: null,
    starPoints: null,
    starMat: null,
    sunOrb: null,
    moonOrb: null,
    clouds: [],
    cloudMatMain: null,
    cloudMatShade: null,
    vehicleLightsOn: false,
    lastCheck: 0,
    currentPeriodKey: '',

    presets: {
        MORNING: {
            key: 'MORNING',
            label: '🌅 ช่วงเช้า',
            timeRange: '05:30 - 10:59 น.',
            skyZenith: 0x2563EB,
            skyHorizon: 0xBAE6FD,
            skyGround: 0x93C5FD,
            skyColor: 0x7DD3FC,
            fogColor: 0xBAE6FD,
            fogDensity: 0.000075,
            cloudColor: 0xFFFFFF,
            cloudShade: 0xDBEAFE,
            cloudOpacity: 0.92,
            starOpacity: 0,
            sunOrbVisible: true,
            moonOrbVisible: false,
            ambientColor: 0xFFFBEB,
            ambientIntensity: 0.88,
            hemiSky: 0xE0F2FE,
            hemiGround: 0x64748B,
            hemiIntensity: 0.38,
            sunColor: 0xFFE4B5,
            sunIntensity: 1.38,
            sunPos: [1450, -1150, 1450],
            interiorIntensity: 0.22,
            streetLightIntensity: 0,
            bulbColor: 0x94A3B8,
            fixtureColor: 0xE2E8F0,
            vehicleLights: false,
            badgeBg: 'rgba(56, 189, 248, 0.2)',
            badgeBorder: 'rgba(56, 189, 248, 0.5)',
            badgeColor: '#7dd3fc'
        },
        NOON: {
            key: 'NOON',
            label: '☀️ ช่วงเที่ยง',
            timeRange: '11:00 - 13:29 น.',
            skyZenith: 0x0284C7,
            skyHorizon: 0xE0F2FE,
            skyGround: 0xBAE6FD,
            skyColor: 0x38BDF8,
            fogColor: 0xE0F2FE,
            fogDensity: 0.000065,
            cloudColor: 0xFFFFFF,
            cloudShade: 0xE2E8F0,
            cloudOpacity: 0.95,
            starOpacity: 0,
            sunOrbVisible: true,
            moonOrbVisible: false,
            ambientColor: 0xFFFFFF,
            ambientIntensity: 0.98,
            hemiSky: 0xF0F9FF,
            hemiGround: 0x94A3B8,
            hemiIntensity: 0.42,
            sunColor: 0xFFFDF8,
            sunIntensity: 1.65,
            sunPos: [120, -680, 2350],
            interiorIntensity: 0.16,
            streetLightIntensity: 0,
            bulbColor: 0x94A3B8,
            fixtureColor: 0xE2E8F0,
            vehicleLights: false,
            badgeBg: 'rgba(250, 204, 21, 0.2)',
            badgeBorder: 'rgba(250, 204, 21, 0.55)',
            badgeColor: '#fef08a'
        },
        AFTERNOON: {
            key: 'AFTERNOON',
            label: '🌤️ ช่วงบ่าย',
            timeRange: '13:30 - 16:29 น.',
            skyZenith: 0x1D4ED8,
            skyHorizon: 0x93C5FD,
            skyGround: 0xBFDBFE,
            skyColor: 0x60A5FA,
            fogColor: 0xBFDBFE,
            fogDensity: 0.000075,
            cloudColor: 0xFFFBEB,
            cloudShade: 0xCBD5E1,
            cloudOpacity: 0.92,
            starOpacity: 0,
            sunOrbVisible: true,
            moonOrbVisible: false,
            ambientColor: 0xFFF7ED,
            ambientIntensity: 0.90,
            hemiSky: 0xDBEAFE,
            hemiGround: 0x64748B,
            hemiIntensity: 0.36,
            sunColor: 0xFFEDD5,
            sunIntensity: 1.48,
            sunPos: [-980, -1100, 1750],
            interiorIntensity: 0.25,
            streetLightIntensity: 0,
            bulbColor: 0xCBD5E1,
            fixtureColor: 0xF1F5F9,
            vehicleLights: false,
            badgeBg: 'rgba(245, 158, 11, 0.22)',
            badgeBorder: 'rgba(251, 191, 36, 0.55)',
            badgeColor: '#fde68a'
        },
        EVENING: {
            key: 'EVENING',
            label: '🌇 ช่วงเย็น',
            timeRange: '16:30 - 18:29 น.',
            skyZenith: 0x312E81,
            skyHorizon: 0xFB923C,
            skyGround: 0xFDBA74,
            skyColor: 0xF97316,
            fogColor: 0xFDBA74,
            fogDensity: 0.00009,
            cloudColor: 0xFED7AA,
            cloudShade: 0xEA580C,
            cloudOpacity: 0.88,
            starOpacity: 0.35,
            sunOrbVisible: true,
            moonOrbVisible: false,
            ambientColor: 0xFED7AA,
            ambientIntensity: 0.72,
            hemiSky: 0xFDBA74,
            hemiGround: 0x475569,
            hemiIntensity: 0.36,
            sunColor: 0xFB923C,
            sunIntensity: 1.12,
            sunPos: [-1750, -1050, 920],
            interiorIntensity: 0.95,
            streetLightIntensity: 1.25,
            bulbColor: 0xFDE047,
            fixtureColor: 0xFEF08A,
            vehicleLights: true,
            badgeBg: 'rgba(249, 115, 22, 0.25)',
            badgeBorder: 'rgba(251, 146, 60, 0.6)',
            badgeColor: '#fed7aa'
        },
        NIGHT: {
            key: 'NIGHT',
            label: '🌙 ช่วงค่ำ',
            timeRange: '18:30 - 05:29 น.',
            skyZenith: 0x020617,
            skyHorizon: 0x1E293B,
            skyGround: 0x0F172A,
            skyColor: 0x090D16,
            fogColor: 0x0F172A,
            fogDensity: 0.000085,
            cloudColor: 0x334155,
            cloudShade: 0x1E293B,
            cloudOpacity: 0.62,
            starOpacity: 0.95,
            sunOrbVisible: false,
            moonOrbVisible: true,
            ambientColor: 0x93C5FD,
            ambientIntensity: 0.56,
            hemiSky: 0x38BDF8,
            hemiGround: 0x1E293B,
            hemiIntensity: 0.38,
            sunColor: 0x93C5FD,
            sunIntensity: 0.45,
            sunPos: [-650, -1350, 1650],
            interiorIntensity: 1.55,
            streetLightIntensity: 1.95,
            bulbColor: 0xFEF08A,
            fixtureColor: 0xFFFFFF,
            vehicleLights: true,
            badgeBg: 'rgba(99, 102, 241, 0.28)',
            badgeBorder: 'rgba(129, 140, 248, 0.6)',
            badgeColor: '#c7d2fe'
        }
    },

    buildSkyAndClouds() {
        // 1. โดมท้องฟ้า 3 มิติ (Gradient Sky Dome) ไล่เฉดสีจากขอบฟ้าขึ้นสู่จุดเหนือศีรษะ (Z-up)
        const skyGeo = new THREE.SphereGeometry(6200, 36, 24);
        this.skyDomeMat = new THREE.ShaderMaterial({
            uniforms: {
                topColor: { value: new THREE.Color(0x1D4ED8) },
                horizonColor: { value: new THREE.Color(0x93C5FD) },
                bottomColor: { value: new THREE.Color(0xBFDBFE) }
            },
            vertexShader: `
                varying vec3 vWorldPos;
                void main() {
                    vec4 wp = modelMatrix * vec4(position, 1.0);
                    vWorldPos = wp.xyz;
                    gl_Position = projectionMatrix * viewMatrix * wp;
                }
            `,
            fragmentShader: `
                uniform vec3 topColor;
                uniform vec3 horizonColor;
                uniform vec3 bottomColor;
                varying vec3 vWorldPos;
                void main() {
                    float h = normalize(vWorldPos).z;
                    vec3 col = mix(horizonColor, topColor, pow(max(h, 0.0), 0.55));
                    col = mix(col, bottomColor, pow(max(-h, 0.0), 0.7));
                    gl_FragColor = vec4(col, 1.0);
                }
            `,
            side: THREE.BackSide,
            depthWrite: false,
            fog: false
        });
        const skyDome = new THREE.Mesh(skyGeo, this.skyDomeMat);
        scene.add(skyDome);

        // 2. ดวงดาวระยิบระยับบนท้องฟ้ายามค่ำคืน (Starfield)
        const starCount = 420;
        const starPositions = new Float32Array(starCount * 3);
        for (let i = 0; i < starCount; i++) {
            const theta = Math.random() * Math.PI * 2;
            const phi = Math.random() * (Math.PI * 0.42); // อยู่เหนือขอบฟ้า
            const r = 5600;
            starPositions[i * 3] = r * Math.sin(phi) * Math.cos(theta);
            starPositions[i * 3 + 1] = r * Math.sin(phi) * Math.sin(theta);
            starPositions[i * 3 + 2] = r * Math.cos(phi) + 250;
        }
        const starGeo = new THREE.BufferGeometry();
        starGeo.setAttribute('position', new THREE.BufferAttribute(starPositions, 3));
        this.starMat = new THREE.PointsMaterial({
            color: 0xFFFBEB,
            size: 26,
            transparent: true,
            opacity: 0,
            fog: false,
            depthWrite: false
        });
        this.starPoints = new THREE.Points(starGeo, this.starMat);
        scene.add(this.starPoints);

        // 3. ดวงอาทิตย์และดวงจันทร์บนท้องฟ้า
        const orbGeo = new THREE.SphereGeometry(145, 24, 24);
        this.sunOrb = new THREE.Mesh(orbGeo, new THREE.MeshBasicMaterial({ color: 0xFEF08A, fog: false }));
        this.moonOrb = new THREE.Mesh(new THREE.SphereGeometry(115, 24, 24), new THREE.MeshBasicMaterial({ color: 0xE0F2FE, fog: false }));
        this.moonOrb.position.set(-1400, 1850, 2250);
        scene.add(this.sunOrb, this.moonOrb);

        // 4. ก้อนเมฆ 3 มิติลอยเคลื่อนตัวบนท้องฟ้า (Volumetric Fluffy 3D Clouds)
        this.cloudMatMain = new THREE.MeshLambertMaterial({
            color: 0xFFFFFF,
            transparent: true,
            opacity: 0.92,
            fog: false
        });
        this.cloudMatShade = new THREE.MeshLambertMaterial({
            color: 0xCBD5E1,
            transparent: true,
            opacity: 0.85,
            fog: false
        });

        const puffGeo = new THREE.DodecahedronGeometry(1, 1);
        const cloudCount = 28;
        for (let i = 0; i < cloudCount; i++) {
            const cg = new THREE.Group();
            const puffs = 5 + (i % 4);
            for (let p = 0; p < puffs; p++) {
                const isBottom = p % 2 === 1;
                const pm = new THREE.Mesh(puffGeo, isBottom ? this.cloudMatShade : this.cloudMatMain);
                const rx = (p - (puffs - 1) * 0.5) * rand(58, 78);
                const ry = rand(-38, 38);
                const rz = isBottom ? rand(-16, 4) : rand(6, 28);
                const sx = rand(65, 115);
                const sy = rand(52, 88);
                const sz = rand(36, 58);
                pm.position.set(rx, ry, rz);
                pm.scale.set(sx, sy, sz);
                pm.rotation.z = rand(0, Math.PI);
                cg.add(pm);
            }
            const cx = -3400 + (i / cloudCount) * 6800 + rand(-180, 180);
            const cy = rand(-2200, 2400);
            const cz = rand(680, 1180);
            const sc = rand(0.85, 1.45);
            cg.position.set(cx, cy, cz);
            cg.scale.set(sc, sc, sc);
            scene.add(cg);
            this.clouds.push({
                group: cg,
                speed: rand(16, 34),
                baseZ: cz,
                bobPhase: rand(0, Math.PI * 2)
            });
        }
    },

    buildHospitalLights() {
        this.buildSkyAndClouds();

        // 1. เสาไฟส่องสว่างริมถนนหน้าโรงพยาบาล ลานรวมพล ลานจอดรถ และทางเดินรอบนอก
        const streetPoleCoords = [
            [-1650, -1215], [-1250, -1215], [-890, -1215], [-520, -1215],
            [-180, -1215],  [180, -1215],   [560, -1215],  [920, -1215],
            [1260, -1215],  [1650, -1215],
            // เสาไฟส่องสว่างบริเวณลานรวมพล ลานจอดรถ และหน้าทางเข้า ER
            [-1150, -880],  [-640, -880],   [0, -880],     [560, -880],   [1080, -880]
        ];
        const streetBulbMat = new THREE.MeshBasicMaterial({ color: 0x94A3B8, fog: false });
        this.streetBulbMat = streetBulbMat;

        streetPoleCoords.forEach(([lx, ly], idx) => {
            post(lx, ly, 118, 0x334155);
            blk(lx, ly - 10, 4, 24, 3, 0x475569, { z: 116, parent: gDeco });
            const bulb = blk(lx, ly - 18, 18, 11, 4.5, 0xFEF08A, { z: 112, parent: gDeco, mat: streetBulbMat });
            this.streetBulbs.push(bulb);
            // ติดตั้ง PointLight กระจายแสงส่องถนนและลานหน้าอาคาร
            if (idx % 2 === 0 || ly === -880) {
                const pt = new THREE.PointLight(0xFFE4B5, 0, 880, 1.25);
                pt.position.set(lx, ly - 18, 108);
                scene.add(pt);
                this.streetLights.push(pt);
            }
        });

        // 2. โคมไฟเพดาน LED ครบทุกโซนทุกห้องภายในโรงพยาบาล (สว่างทั่วทั้งโรงพยาบาลในเวลากลางคืน)
        const ceilingPanelMat = new THREE.MeshBasicMaterial({ color: 0xE2E8F0, fog: false });
        this.ceilingPanelMat = ceilingPanelMat;

        // ตำแหน่งโคมไฟเพดานครอบคลุมทั้ง 14 โซนและทุกห้องตรวจ
        const allZonesCeilingGrid = [
            // โซน 2: โถงทางเข้า & จุดคัดกรอง
            [-260, -620], [0, -620], [260, -620], [0, -490],
            // โซน 3 & 3.1: ห้องบัตร เวชระเบียน & ตู้ Kiosk
            [-1240, -620], [-1020, -620], [-520, -560],
            // โซน 10, 11, 13, 14 (แถวกลางล่าง): X-Ray, LAB, ทำแผล/นัดหมาย, การเงิน
            [-1180, -250], [-670, -250], [-250, -250], [180, -250], [520, -250],
            // โซน 5: แผนกฉุกเฉิน ER (Triage + เตียงกู้ชีพ + เตียงสังเกตอาการ 1-5)
            [880, -620], [1180, -620], [880, -380], [1180, -380], [920, -200], [1220, -200],
            // โซน 4.1: โถงพักคอยและโต๊ะซักประวัติ OPD 1-5
            [-560, 110], [-280, 110], [0, 110], [280, 110], [560, 110],
            // โซน 9: แผนกกายภาพบำบัด
            [-1240, 80], [-960, 80], [-1150, 230],
            // โซน 12: แผนกเภสัชกรรม (ห้องยา)
            [920, 80], [1180, 80], [1060, 210],
            // โซน 4.2: ห้องตรวจแพทย์ OPD ทั้ง 5 ห้อง + ทางเดินหน้าห้องตรวจ
            [-560, 490], [-280, 490], [0, 490], [280, 490], [560, 490],
            [-420, 298], [0, 298], [420, 298],
            // โซน 6: หอผู้ป่วยใน IPD (เคาน์เตอร์พยาบาล + เตียงแถว 1 และแถว 2)
            [-1060, 390], [-1240, 540], [-920, 540], [-1240, 735], [-920, 735],
            // โซน 7 & 8: แผนกทันตกรรม และ แผนกแพทย์แผนไทย
            [880, 480], [1230, 480],
            // โซน 14 (ด้านหลัง): ห้องพักเจ้าหน้าที่, คลังเวชภัณฑ์, ห้องน้ำรวม, ห้องพักพิเศษ/ดับจิต
            [-480, 770], [0, 770], [475, 770], [970, 770], [1260, 770]
        ];

        allZonesCeilingGrid.forEach(([fx, fy]) => {
            // โคมไฟเพดาน LED ทรงสี่เหลี่ยมเหนือแต่ละโซน/ห้อง (ระดับความสูง z = 94)
            blk(fx, fy, 42, 18, 2.2, 0x334155, { z: 95, parent: gDeco });
            blk(fx, fy, 38, 14, 1.5, 0xFFFFFF, { z: 93.8, parent: gDeco, mat: ceilingPanelMat });
        });

        // แหล่งกำเนิดแสงจริง (PointLights) กระจายครอบคลุมทั่วทุกโซนในโรงพยาบาลและภายนอกอาคาร
        const interiorLightNodes = [
            // โถงทางเข้า & คัดกรอง & Kiosk & ห้องบัตร
            [0, -610, 0xE0F2FE, 980],
            [-1120, -600, 0xFEF3C7, 920],
            [-500, -560, 0xE0F2FE, 820],
            // X-ray, LAB, โถงกลางล่าง, การเงิน
            [-1160, -250, 0xDBEAFE, 900],
            [-670, -250, 0xF3E8FF, 900],
            [-50, -250, 0xF8FAFC, 900],
            [520, -250, 0xCCFBF1, 900],
            // แผนกฉุกเฉิน ER (หน้า + ใน)
            [1060, -600, 0xFFE4E6, 950],
            [1060, -240, 0xFECDD3, 980],
            // โถงกลาง OPD (ซ้าย + กลาง + ขวา)
            [-420, 110, 0xF0F9FF, 980],
            [0, 110, 0xFFFFFF, 1050],
            [420, 110, 0xF0F9FF, 980],
            // กายภาพบำบัด & เภสัชกรรม
            [-1110, 130, 0xCCFBF1, 980],
            [1060, 130, 0xFFEDD5, 980],
            // ห้องตรวจแพทย์ OPD 1-5
            [-560, 490, 0xFEF9C3, 860],
            [-280, 490, 0xF0F9FF, 860],
            [0, 490, 0xFEF9C3, 860],
            [280, 490, 0xF0F9FF, 860],
            [560, 490, 0xFEF9C3, 860],
            // หอผู้ป่วยใน IPD (เคาน์เตอร์ + เตียงแถว 1 & 2)
            [-1060, 420, 0xE0F2FE, 980],
            [-1060, 680, 0xBAE6FD, 1050],
            // ทันตกรรม & แพทย์แผนไทย
            [880, 490, 0xECFEFF, 920],
            [1230, 490, 0xECFDF5, 920],
            // โซนสนับสนุนด้านหลัง (ห้องพักเจ้าหน้าที่ + คลัง + ห้องน้ำ + ห้องดับจิต)
            [-480, 770, 0xFEF3C7, 880],
            [220, 770, 0xF1F5F9, 880],
            [1020, 770, 0xE2E8F0, 920]
        ];
        interiorLightNodes.forEach(([ix, iy, col, dist]) => {
            const pl = new THREE.PointLight(col, 0.2, dist, 1.15);
            pl.position.set(ix, iy, 125);
            scene.add(pl);
            this.interiorLights.push(pl);
        });

        this.applyAtmosphere(true);
    },

    getRealTimePeriodKey(date = new Date()) {
        const mins = date.getHours() * 60 + date.getMinutes();
        if (mins >= 330 && mins < 660) return 'MORNING';     // 05:30 - 10:59 เช้า
        if (mins >= 660 && mins < 810) return 'NOON';        // 11:00 - 13:29 เที่ยง
        if (mins >= 810 && mins < 990) return 'AFTERNOON';   // 13:30 - 16:29 บ่าย
        if (mins >= 990 && mins < 1110) return 'EVENING';    // 16:30 - 18:29 เย็น
        return 'NIGHT';                                      // 18:30 - 05:29 ค่ำ/กลางคืน
    },

    getTargetPreset() {
        const key = this.mode === 'AUTO' ? this.getRealTimePeriodKey(new Date()) : this.mode;
        return this.presets[key] || this.presets.AFTERNOON;
    },

    applyAtmosphere(immediate = false, dt = 0.016) {
        const p = this.getTargetPreset();
        const lerpRate = immediate ? 1.0 : Math.min(1, dt * 2.2);

        scene.background.lerp(new THREE.Color(p.skyColor), lerpRate);
        scene.fog.color.lerp(new THREE.Color(p.fogColor), lerpRate);
        scene.fog.density += (p.fogDensity - scene.fog.density) * lerpRate;

        if (this.skyDomeMat) {
            this.skyDomeMat.uniforms.topColor.value.lerp(new THREE.Color(p.skyZenith), lerpRate);
            this.skyDomeMat.uniforms.horizonColor.value.lerp(new THREE.Color(p.skyHorizon), lerpRate);
            this.skyDomeMat.uniforms.bottomColor.value.lerp(new THREE.Color(p.skyGround), lerpRate);
        }
        if (this.cloudMatMain && this.cloudMatShade) {
            this.cloudMatMain.color.lerp(new THREE.Color(p.cloudColor), lerpRate);
            this.cloudMatShade.color.lerp(new THREE.Color(p.cloudShade), lerpRate);
            this.cloudMatMain.opacity += (p.cloudOpacity - this.cloudMatMain.opacity) * lerpRate;
            this.cloudMatShade.opacity += (p.cloudOpacity * 0.9 - this.cloudMatShade.opacity) * lerpRate;
        }
        if (this.starMat) {
            this.starMat.opacity += (p.starOpacity - this.starMat.opacity) * lerpRate;
        }

        ambientLight.color.lerp(new THREE.Color(p.ambientColor), lerpRate);
        ambientLight.intensity += (p.ambientIntensity - ambientLight.intensity) * lerpRate;

        hemiLight.color.lerp(new THREE.Color(p.hemiSky), lerpRate);
        hemiLight.groundColor.lerp(new THREE.Color(p.hemiGround), lerpRate);
        hemiLight.intensity += (p.hemiIntensity - hemiLight.intensity) * lerpRate;

        sun.color.lerp(new THREE.Color(p.sunColor), lerpRate);
        sun.intensity += (p.sunIntensity - sun.intensity) * lerpRate;
        sun.position.lerp(new THREE.Vector3(...p.sunPos), lerpRate);

        if (this.sunOrb) {
            this.sunOrb.visible = !!p.sunOrbVisible;
            this.sunOrb.position.set(p.sunPos[0] * 1.65, p.sunPos[1] * 1.65, Math.max(420, p.sunPos[2] * 1.35));
            this.sunOrb.material.color.lerp(new THREE.Color(p.sunColor), lerpRate);
        }
        if (this.moonOrb) {
            this.moonOrb.visible = !!p.moonOrbVisible;
        }

        this.interiorLights.forEach(pl => {
            pl.intensity += (p.interiorIntensity - pl.intensity) * lerpRate;
            pl.visible = pl.intensity > 0.02; // ไฟที่ดับแล้วไม่ต้องคำนวณใน shader
        });
        this.streetLights.forEach(sl => {
            sl.intensity += (p.streetLightIntensity - sl.intensity) * lerpRate;
            sl.visible = sl.intensity > 0.02;
        });

        this.vehicleLightsOn = !!p.vehicleLights;
        if (typeof TrafficManager !== 'undefined' && TrafficManager.setNightLights) {
            TrafficManager.setNightLights(this.vehicleLightsOn);
        }

        const stateTag = `${this.mode}:${p.key}`;
        if (this.currentPeriodKey !== stateTag) {
            this.currentPeriodKey = stateTag;
            if (this.streetBulbMat) this.streetBulbMat.color.setHex(p.bulbColor);
            if (this.ceilingPanelMat) this.ceilingPanelMat.color.setHex(p.fixtureColor);
            const badge = $('time-period-badge');
            if (badge) {
                const suffix = this.mode === 'AUTO' ? 'ตามเวลาจริง' : 'โหมดจำลอง';
                badge.innerText = `${p.label} (${suffix})`;
                badge.style.background = p.badgeBg;
                badge.style.borderColor = p.badgeBorder;
                badge.style.color = p.badgeColor;
            }
        }
    },

    cycleMode() {
        const idx = this.modeOrder.indexOf(this.mode);
        this.mode = this.modeOrder[(idx + 1) % this.modeOrder.length];
        this.applyAtmosphere(false, 0.35);
    },

    update(dt) {
        this.applyAtmosphere(false, dt);
        // เคลื่อนก้อนเมฆลอยช้าๆ บนท้องฟ้าอย่างเป็นธรรมชาติ
        for (let i = 0; i < this.clouds.length; i++) {
            const c = this.clouds[i];
            c.group.position.x += c.speed * dt;
            c.group.position.z = c.baseZ + Math.sin(simTime * 0.45 + c.bobPhase) * 8;
            if (c.group.position.x > 3600) {
                c.group.position.x = -3600;
            }
        }
    }
};

window.cycleTimePeriodMode = function () {
    TimeAtmosphereManager.cycleMode();
};

// เวลาจำลอง + ตัวจับเวลา (ใช้กับ async/await)
let simTime = 0;
const timers = [];
const sleep = sec => new Promise(res => timers.push({ t: simTime + sec, res }));
function updateTimers() {
    for (let i = timers.length - 1; i >= 0; i--) if (timers[i].t <= simTime) { const r = timers[i].res; timers.splice(i, 1); r(); }
}
const tweens = [];
function tweenTo(obj, to, sec) {
    return new Promise(res => tweens.push({ obj, from: { x: obj.position.x, y: obj.position.y }, to, t0: simTime, dur: sec, res }));
}

// ================= 2. BUILDERS =================
const obstacles = [];
const addObstacle = (minX, maxX, minY, maxY, kind = 'furn') => obstacles.push({ minX, maxX, minY, maxY, kind });
const geoCache = new Map(), matCache = new Map();
function geo(w, d, h) { const k = w + '|' + d + '|' + h; if (!geoCache.has(k)) geoCache.set(k, new THREE.BoxGeometry(w, d, h)); return geoCache.get(k); }
function mat(c) { if (!matCache.has(c)) matCache.set(c, new THREE.MeshLambertMaterial({ color: c })); return matCache.get(c); }
function matB(c) { const k = 'b' + c; if (!matCache.has(k)) matCache.set(k, new THREE.MeshBasicMaterial({ color: c })); return matCache.get(k); }
function matT(c, o = 0.4) { const k = 't' + c + o; if (!matCache.has(k)) matCache.set(k, new THREE.MeshLambertMaterial({ color: c, transparent: true, opacity: o, side: THREE.DoubleSide })); return matCache.get(k); }

function blk(x, y, w, d, h, color, o = {}) {
    const m = new THREE.Mesh(geo(w, d, h), o.mat || mat(color));
    m.position.set(x, y, (o.z || 0) + h / 2);
    m.castShadow = !!o.shadow; m.receiveShadow = true;
    (o.parent || gFurn).add(m);
    if (o.solid) addObstacle(x - w / 2, x + w / 2, y - d / 2, y + d / 2);
    return m;
}
function grp(x, y, rot = 0, parent = gFurn) { const g = new THREE.Group(); g.position.set(x, y, 0); g.rotation.z = rot; parent.add(g); return g; }
function cyl(x, y, z, r, h, color, parent = gFurn, rotX = 0) {
    const m = new THREE.Mesh(new THREE.CylinderGeometry(r, r, h, 12), mat(color));
    m.rotation.x = HP + rotX; m.position.set(x, y, z); m.castShadow = true; parent.add(m); return m;
}
const tint = (x1, x2, y1, y2, c) => blk((x1 + x2) / 2, (y1 + y2) / 2, x2 - x1, y2 - y1, 0.6, c, { z: 1, parent: gDeco });
const decal = (x, y, w, d, c, z = 1.7) => blk(x, y, w, d, 0.3, c, { z, parent: gDeco, mat: matB(c) });

function chair(x, y, face, color = 0x2563EB) {
    const g = grp(x, y, face - HP);
    blk(0, 0, 20, 20, 4, color, { parent: g, z: 12 });
    blk(0, -9, 20, 4, 20, color, { parent: g, z: 14 });
    blk(0, 0, 3, 3, 12, 0x94A3B8, { parent: g });
    addObstacle(x - 9, x + 9, y - 9, y + 9);
}
function desk(x, y, w = 90, d = 34, color = 0xD97706) {
    blk(x, y, w, d, 4, color, { z: 26 });
    blk(x, y, w - 4, d - 4, 26, 0x92400E);
    addObstacle(x - w / 2, x + w / 2, y - d / 2, y + d / 2);
}
function counter(x, y, w, d, color = 0x3B82F6, h = 34) {
    blk(x, y, w, d, h, color, { shadow: true });
    blk(x, y, w + 2, d + 2, 3, 0xF8FAFC, { z: h });
    addObstacle(x - w / 2, x + w / 2, y - d / 2, y + d / 2);
}
function box(x, y, w, d, h, color, z = 0, solid = true) { return blk(x, y, w, d, h, color, { z, solid, shadow: true }); }
function computer(x, y, z, face) {
    const g = grp(x, y, face + HP); g.position.z = z;
    blk(0, -3, 22, 2.5, 15, 0x111827, { parent: g, z: 5 });
    blk(0, -1.6, 19, 0.5, 12, 0x7DD3FC, { parent: g, z: 6.5, mat: matB(0x7DD3FC) });
    blk(0, -3, 5, 5, 5, 0x64748B, { parent: g });
    blk(0, 7, 16, 6, 1, 0x334155, { parent: g });
}
function vitals(x, y, z, face = FACE.S) {
    const g = grp(x, y, face - HP); g.position.z = z;
    blk(-12, 0, 10, 7, 7, 0x94A3B8, { parent: g });       // เครื่องวัดความดัน
    blk(-12, 6, 8, 2, 4, 0x2563EB, { parent: g });
    blk(0, 0, 2, 2, 9, 0xF8FAFC, { parent: g });          // ปรอทวัดไข้
    blk(0, 0, 2.2, 2.2, 2, 0xEF4444, { parent: g, z: 9 });
    blk(12, 0, 6, 4, 3, 0x111827, { parent: g });         // Pulse oximeter
}
function bed(x, y, rot = 0, blanket = 0x38BDF8, solid = true) {
    const g = grp(x, y, rot);
    blk(0, 0, 44, 82, 10, 0x94A3B8, { parent: g, z: 6 });
    blk(0, 0, 42, 80, 8, 0xFFFFFF, { parent: g, z: 14 });
    blk(0, -10, 42.5, 56, 8.5, blanket, { parent: g, z: 14.5 });
    blk(0, 28, 28, 16, 6, 0xFFFFFF, { parent: g, z: 22 });
    blk(0, 41, 46, 3, 22, 0xCBD5E1, { parent: g, z: 6 });
    blk(0, -41, 46, 3, 14, 0xCBD5E1, { parent: g, z: 6 });
    if (solid) addObstacle(x - 24, x + 24, y - 42, y + 42);
    return g;
}
const curtain = (x, y, w, d, c = 0x7DD3FC) => blk(x, y, w, d, 52, c, { mat: matT(c, 0.45) });
function monitorStand(x, y, face) {
    const g = grp(x, y, face - HP);
    blk(0, 0, 3, 3, 30, 0x64748B, { parent: g });
    blk(0, 0, 16, 3, 11, 0x111827, { parent: g, z: 30 });
    blk(0, 1.6, 13, 0.4, 8, 0x22C55E, { parent: g, z: 31.5, mat: matB(0x22C55E) });
}
function cabinet(x, y, w, d, h = 60, color = 0xE2E8F0) { box(x, y, w, d, h, color); blk(x, y, w - 6, d + 0.4, h - 8, 0x94A3B8, { z: 4 }); }
function sink(x, y) { box(x, y, 40, 24, 28, 0xF1F5F9); blk(x, y, 30, 16, 1, 0x7DD3FC, { z: 28, mat: matB(0x7DD3FC) }); blk(x, y + 8, 2, 2, 12, 0x94A3B8, { z: 28 }); }
function lamp(x, y) { blk(x, y, 3, 3, 90, 0x64748B); blk(x, y + 12, 3, 24, 3, 0x64748B, { z: 88 }); blk(x, y + 26, 18, 10, 4, 0xFEF3C7, { z: 84, mat: matB(0xFEF3C7) }); }
function post(x, y, h, c = 0x64748B) { blk(x, y, 3, 3, h, c); }

// ป้าย (canvas texture) - ฟอนต์ Kanit
const signs = [];
class Sign {
    constructor(text, o) {
        this.o = Object.assign({ w: 120, h: 36, bg: '#0284C7', fg: '#FFFFFF', sub: '', face: FACE.S, z: 72, x: 0, y: 0, flat: false, parent: gDeco }, o);
        this.text = text; this.sub = this.o.sub;
        this.canvas = document.createElement('canvas');
        this.canvas.width = 512; this.canvas.height = Math.max(64, Math.round(512 * this.o.h / this.o.w));
        this.tex = new THREE.CanvasTexture(this.canvas);
        const m = new THREE.Mesh(new THREE.PlaneGeometry(this.o.w, this.o.h), new THREE.MeshBasicMaterial({ map: this.tex, transparent: true, side: THREE.DoubleSide }));
        const g = new THREE.Group(); g.position.set(this.o.x, this.o.y, this.o.z);
        this.baseZ = this.o.z;
        if (this.o.flat) g.rotation.z = this.o.face - HP; else { m.rotation.x = HP; g.rotation.z = this.o.face + HP; }
        g.add(m); this.o.parent.add(g); this.group = g;
        this.draw(); signs.push(this);
    }
    draw() {
        const { canvas: c, o } = this, ctx = c.getContext('2d'), W = c.width, H = c.height;
        ctx.clearRect(0, 0, W, H);
        ctx.fillStyle = o.bg; ctx.beginPath();
        if (ctx.roundRect) ctx.roundRect(4, 4, W - 8, H - 8, 18); else ctx.rect(4, 4, W - 8, H - 8);
        ctx.fill(); ctx.lineWidth = 5; ctx.strokeStyle = '#FFFFFF'; ctx.stroke();
        ctx.fillStyle = o.fg; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
        let px = this.sub ? H * 0.42 : H * 0.5;
        do { ctx.font = `bold ${px}px Kanit, sans-serif`; px -= 2; } while (ctx.measureText(this.text).width > W - 30 && px > 12);
        ctx.fillText(this.text, W / 2, this.sub ? H * 0.34 : H / 2);
        if (this.sub) {
            let sp = H * 0.3;
            do { ctx.font = `bold ${sp}px Kanit, sans-serif`; sp -= 2; } while (ctx.measureText(this.sub).width > W - 30 && sp > 10);
            ctx.fillStyle = o.subColor || '#FDE68A'; ctx.fillText(this.sub, W / 2, H * 0.72);
        }
        this.tex.needsUpdate = true;
    }
    set(text, sub = this.sub, bg) { if (text === this.text && sub === this.sub && !bg) return; this.text = text; this.sub = sub; if (bg) this.o.bg = bg; this.draw(); }
}
const SIGN_Z_OFFSET = 28;
const sign = (text, x, y, z, w, h, bg, face = FACE.S, sub = '') => new Sign(text, { x, y, z: z + SIGN_Z_OFFSET, w, h, bg, face, sub });
const postSign = (text, x, y, z, w, h, bg, face = FACE.S, sub = '') => {
    const elevatedZ = z + SIGN_Z_OFFSET;
    post(x - w / 2 + 3, y, elevatedZ - h / 2);
    post(x + w / 2 - 3, y, elevatedZ - h / 2);
    return new Sign(text, { x, y, z: elevatedZ, w, h, bg, face, sub });
};
const flatSign = (text, x, y, w, h, bg, face = FACE.S) => new Sign(text, { x, y, z: 2, w, h, bg, face, flat: true });
const zoneLabel = (text, x, y, color) => new Sign(text, { x, y, z: 165, w: 240, h: 56, bg: color, parent: gZone });
if (document.fonts && document.fonts.ready) document.fonts.ready.then(() => signs.forEach(s => s.draw()));

// ผนัง + ประตูอัตโนมัติทุกจุดเชื่อมโซน (ปรับความสูงกำแพงและช่องประตูให้สูงพ้นศีรษะผู้มารับบริการ)
const WH = 96, WT = 12;
const DOOR_H = 78;
const LINTEL_H = WH - DOOR_H;
const autoDoors = [];

function autoDoor(x, y, w, axis = 'x') {
    if (axis === 'x') {
        const lintel = new THREE.Mesh(geo(w, WT, LINTEL_H), mat(0xE5E7EB));
        lintel.position.set(x, y, DOOR_H + LINTEL_H / 2); gWall.add(lintel);
        const cap = new THREE.Mesh(geo(w + 0.5, WT + 0.5, 3), mat(0x94A3B8));
        cap.position.set(x, y, WH + 1.5); gWall.add(cap);
        const bar = new THREE.Mesh(geo(w, WT + 1.6, 2.8), mat(0x0284C7));
        bar.position.set(x, y, DOOR_H + 1); gWall.add(bar);
        const mk = s => {
            const m = new THREE.Mesh(geo(w / 2 - 1, 3.2, DOOR_H), matT(0x38BDF8, 0.45));
            m.position.set(x + s * w / 4, y, DOOR_H / 2);
            gWall.add(m);
            return m;
        };
        autoDoors.push({ x, y, w, axis: 'x', l: mk(-1), r: mk(1), open: 0 });
    } else {
        const lintel = new THREE.Mesh(geo(WT, w, LINTEL_H), mat(0xE5E7EB));
        lintel.position.set(x, y, DOOR_H + LINTEL_H / 2); gWall.add(lintel);
        const cap = new THREE.Mesh(geo(WT + 0.5, w + 0.5, 3), mat(0x94A3B8));
        cap.position.set(x, y, WH + 1.5); gWall.add(cap);
        const bar = new THREE.Mesh(geo(WT + 1.6, w, 2.8), mat(0x0284C7));
        bar.position.set(x, y, DOOR_H + 1); gWall.add(bar);
        const mk = s => {
            const m = new THREE.Mesh(geo(3.2, w / 2 - 1, DOOR_H), matT(0x38BDF8, 0.45));
            m.position.set(x, y + s * w / 4, DOOR_H / 2);
            gWall.add(m);
            return m;
        };
        autoDoors.push({ x, y, w, axis: 'y', l: mk(-1), r: mk(1), open: 0 });
    }
}

function wallSeg(x1, x2, y1, y2) {
    const w = x2 - x1, d = y2 - y1;
    const m = new THREE.Mesh(geo(w, d, WH), mat(0xE5E7EB));
    m.position.set((x1 + x2) / 2, (y1 + y2) / 2, WH / 2); m.castShadow = true; m.receiveShadow = true; gWall.add(m);
    const c = new THREE.Mesh(geo(w + 0.5, d + 0.5, 3), mat(0x94A3B8)); c.position.set((x1 + x2) / 2, (y1 + y2) / 2, WH + 1.5); gWall.add(c);
    addObstacle(x1, x2, y1, y2, 'wall');
}
function wallX(y, x1, x2, doors = []) {
    let cur = x1;
    for (const [c, w] of [...doors].sort((a, b) => a[0] - b[0])) {
        if (c - w / 2 > cur) wallSeg(cur, c - w / 2, y - WT / 2, y + WT / 2);
        autoDoor(c, y, w, 'x');
        cur = c + w / 2;
    }
    if (x2 > cur) wallSeg(cur, x2, y - WT / 2, y + WT / 2);
}
function wallY(x, y1, y2, doors = []) {
    let cur = y1;
    for (const [c, w] of [...doors].sort((a, b) => a[0] - b[0])) {
        if (c - w / 2 > cur) wallSeg(x - WT / 2, x + WT / 2, cur, c - w / 2);
        autoDoor(x, c, w, 'y');
        cur = c + w / 2;
    }
    if (y2 > cur) wallSeg(x - WT / 2, x + WT / 2, cur, y2);
}

// ================= 3. NavigationManager =================
const NODES = {}, EDGES = {};
function node(n, x, y) { NODES[n] = [x, y]; if (!EDGES[n]) EDGES[n] = []; }
function link(...ns) {
    for (let i = 0; i < ns.length - 1; i++) {
        const a = ns[i], b = ns[i + 1];
        if (!NODES[a] || !NODES[b]) { console.warn('bad link', a, b); continue; }
        if (!EDGES[a].includes(b)) EDGES[a].push(b);
        if (!EDGES[b].includes(a)) EDGES[b].push(a);
    }
}
function segmentIntersectsBox(x1, y1, x2, y2, minX, maxX, minY, maxY) {
    let t0 = 0, t1 = 1;
    const dx = x2 - x1, dy = y2 - y1;
    const p = [-dx, dx, -dy, dy];
    const q = [x1 - minX, maxX - x1, y1 - minY, maxY - y1];
    for (let i = 0; i < 4; i++) {
        if (Math.abs(p[i]) < 1e-6) {
            if (q[i] < 0) return false;
        } else {
            const t = q[i] / p[i];
            if (p[i] < 0) { if (t > t1) return false; if (t > t0) t0 = t; }
            else { if (t < t0) return false; if (t < t1) t1 = t; }
        }
    }
    return t0 <= t1;
}
function segmentHitsWall(x1, y1, x2, y2, pad = 2) {
    for (const o of obstacles) {
        if (o.kind !== 'wall') continue;
        if (segmentIntersectsBox(x1, y1, x2, y2, o.minX - pad, o.maxX + pad, o.minY - pad, o.maxY + pad)) return true;
    }
    return false;
}
function findNearestVisibleNode(x, y, preferredNode = null) {
    if (preferredNode && NODES[preferredNode] && !segmentHitsWall(x, y, NODES[preferredNode][0], NODES[preferredNode][1])) {
        return preferredNode;
    }
    let best = null, bestDist = Infinity;
    for (const [k, pt] of Object.entries(NODES)) {
        const d = Math.hypot(x - pt[0], y - pt[1]);
        if (d < bestDist && !segmentHitsWall(x, y, pt[0], pt[1])) {
            bestDist = d;
            best = k;
        }
    }
    if (best) return best;
    for (const [k, pt] of Object.entries(NODES)) {
        const d = Math.hypot(x - pt[0], y - pt[1]);
        if (d < bestDist) { bestDist = d; best = k; }
    }
    return best;
}
function findPath(a, b) {
    if (!NODES[a] || !NODES[b]) return [b];
    if (a === b) return [a];
    const dist = { [a]: 0 }, prev = {}, done = new Set(), open = [a];
    while (open.length) {
        open.sort((p, q) => dist[p] - dist[q]);
        const u = open.shift(); if (done.has(u)) continue; done.add(u); if (u === b) break;
        for (const v of EDGES[u]) {
            const d = dist[u] + Math.hypot(NODES[u][0] - NODES[v][0], NODES[u][1] - NODES[v][1]);
            if (dist[v] === undefined || d < dist[v]) { dist[v] = d; prev[v] = u; open.push(v); }
        }
    }
    if (dist[b] === undefined) { console.warn('no path', a, b); return [b]; }
    const p = [b]; while (p[0] !== a) p.unshift(prev[p[0]]); return p;
}
// soft = เดินผ่านเฟอร์นิเจอร์ได้ (ช่วงเข้า-ออกจุดยืน/เก้าอี้) แต่ห้ามเดินทะลุกำแพงเด็ดขาด
function buildPath(from, to, finalPos, startPos = null) {
    const pts = [];
    let startNode = from;
    if (startPos && startPos.length === 2) {
        if (finalPos && !segmentHitsWall(startPos[0], startPos[1], finalPos[0], finalPos[1], 3) && (!from || from === to)) {
            pts.push({ x: finalPos[0], y: finalPos[1], soft: true });
            return pts;
        }
        startNode = findNearestVisibleNode(startPos[0], startPos[1], from);
    }
    let endNode = to;
    if (finalPos && to && NODES[to] && segmentHitsWall(NODES[to][0], NODES[to][1], finalPos[0], finalPos[1], 2)) {
        endNode = findNearestVisibleNode(finalPos[0], finalPos[1], to);
    }
    if (startNode && endNode) {
        const nodeList = findPath(startNode, endNode);
        nodeList.forEach((n, i) => pts.push({ x: NODES[n][0], y: NODES[n][1], soft: i === 0 || i === nodeList.length - 1 }));
    } else if (endNode && NODES[endNode]) {
        pts.push({ x: NODES[endNode][0], y: NODES[endNode][1], soft: true });
    }
    if (finalPos) pts.push({ x: finalPos[0], y: finalPos[1], soft: true });
    return pts;
}
function wallBlocked(x, y, pad = 4.5) {
    for (const o of obstacles) {
        if (o.kind !== 'wall') continue;
        if (x > o.minX - pad && x < o.maxX + pad && y > o.minY - pad && y < o.maxY + pad) return true;
    }
    return false;
}
function blocked(x, y, soft) {
    for (const o of obstacles) {
        if (soft && o.kind === 'furn') continue;
        const pad = o.kind === 'wall' ? 4.5 : 6;
        if (x > o.minX - pad && x < o.maxX + pad && y > o.minY - pad && y < o.maxY + pad) return true;
    }
    return false;
}
const NavigationManager = { NODES, EDGES, findPath, buildPath, blocked, wallBlocked, segmentHitsWall };


// ================= 4. SERVICE STATION & KIOSK & BED MANAGERS =================
class ServiceStation {
    constructor(cfg) {
        this.id = cfg.id;
        this.name = cfg.name;
        this.node = cfg.node;
        this.slots = (cfg.slots || []).map((s, i) => ({
            idx: i,
            patientPos: s.patientPos,
            patientFace: s.patientFace ?? FACE.N,
            staffPos: s.staffPos || null,
            staffFace: s.staffFace ?? FACE.S,
            staffRole: s.staffRole || cfg.staffRole || 'nurse',
            staffRef: null,
            busy: false,
            occupant: null,
            meta: s.meta || {}
        }));
        this.queue = []; // [{ char, resolve }]
        this.queueOrigin = cfg.queueOrigin || NODES[this.node] || [0, 0];
        this.queueDir = cfg.queueDir || [0, -1];
        this.queueSpacing = cfg.queueSpacing || 28;
        this.seats = (cfg.seats || []).map(p => ({ pos: p, face: cfg.seatFace ?? FACE.N, occ: null }));
        this.sign = cfg.sign || null;
        this.prefix = cfg.prefix || 'A';
        this.counter = 0;
    }
    queueSlotPos(idx, char = null) {
        if (idx < this.seats.length) {
            if (char) {
                const alreadyIdx = this.seats.findIndex(s => s.occ === char);
                if (alreadyIdx !== -1) {
                    return { pos: this.seats[alreadyIdx].pos, face: this.seats[alreadyIdx].face, sit: true };
                }
                const freeSeat = this.seats.find(s => !s.occ || !s.occ.active);
                if (freeSeat) {
                    freeSeat.occ = char;
                    return { pos: freeSeat.pos, face: freeSeat.face, sit: true };
                }
            }
            return { pos: this.seats[idx].pos, face: this.seats[idx].face, sit: true };
        }
        const k = idx - this.seats.length;
        return {
            pos: [
                this.queueOrigin[0] + this.queueDir[0] * k * this.queueSpacing,
                this.queueOrigin[1] + this.queueDir[1] * k * this.queueSpacing
            ],
            face: Math.atan2(-this.queueDir[1], -this.queueDir[0]),
            sit: false
        };
    }
    freePatientSeat(char) {
        if (!char) return;
        for (const s of this.seats) {
            if (s.occ === char) s.occ = null;
        }
    }
    freeSlot() { return this.slots.find(s => !s.busy); }
    busyCount() { return this.slots.filter(s => s.busy).length + this.queue.length; }
    async acquire(char) {
        const free = this.freeSlot();
        if (free && this.queue.length === 0) {
            free.busy = true; free.occupant = char;
            this.bumpSign(free.idx);
            return free;
        }
        return await new Promise(resolve => {
            const entry = { char, resolve };
            this.queue.push(entry);
            this.refreshQueuePositions();
        });
    }
    release(slot) {
        if (!slot) return;
        if (slot.occupant) this.freePatientSeat(slot.occupant);
        slot.busy = false; slot.occupant = null;
        while (this.queue.length > 0) {
            const next = this.queue.shift();
            if (!next.char || !next.char.active) continue;
            this.freePatientSeat(next.char);
            slot.busy = true; slot.occupant = next.char;
            this.bumpSign(slot.idx);
            this.refreshQueuePositions();
            next.resolve(slot);
            break;
        }
    }
    bumpSign(slotIdx) {
        this.counter = (this.counter % 99) + 1;
        const code = `${this.prefix}${String(this.counter).padStart(2, '0')}`;
        if (this.sign) this.sign.set(`คิว ${code} → ช่อง ${slotIdx + 1}`);
    }
    refreshQueuePositions() {
        const waitingChars = new Set(this.queue.map(e => e.char));
        for (const s of this.seats) {
            if (s.occ && (!s.occ.active || !waitingChars.has(s.occ))) {
                s.occ = null;
            }
        }
        this.queue.forEach((entry, idx) => {
            if (!entry.char || !entry.char.active) return;
            const q = this.queueSlotPos(idx, entry.char);
            entry.char.moveToQueueSpot(this.node, q.pos, q.face, q.sit);
        });
    }
}

const STATIONS = {};
function regStation(cfg) { const s = new ServiceStation(cfg); STATIONS[cfg.id] = s; return s; }

// ================= 5. HospitalEnvironment =================
const HospitalEnvironment = {
    kiosks: [],
    ipdBeds: [],
    erBeds: [],
    morgueBeds: [],
    doctorRooms: [],
    assemblySlots: [],
    staffPosts: [],
    vehicles: {},

    build() {
        this.buildGroundAndRoads();
        this.buildWallsAndDoors();
        this.buildZone1_Assembly();
        this.buildZone2_EntranceScreening();
        this.buildZone3_RegistrationKioskWaiting();
        this.buildZone4_OPD();
        this.buildZone5_ER();
        this.buildZone6_IPD();
        this.buildZone7_Dental();
        this.buildZone8_ThaiMed();
        this.buildZone9_Physio();
        this.buildZone10_Lab();
        this.buildZone11_Xray();
        this.buildZone12_Pharmacy();
        this.buildZone13_Finance();
        this.buildZone14_SupportAreas();
        this.buildNavigationGraph();
    },

    buildGroundAndRoads() {
        // พื้นหญ้ารอบนอก
        blk(0, -100, 4600, 3200, 4, 0xCBD5E1, { z: -6, parent: gDeco });
        // ถนนหลักด้านหน้า
        blk(0, -1420, 4400, 220, 4, 0x334155, { z: -3, parent: gDeco });
        for (let x = -2000; x <= 2000; x += 180) decal(x, -1420, 90, 8, 0xF8FAFC, -0.5);
        // ทางเท้าและลานหน้าอาคาร
        blk(0, -1240, 4200, 140, 4, 0x94A3B8, { z: -2, parent: gDeco });
        // ช่องจอดรถรับ-ส่งผู้ป่วยหน้าทางเข้าหลัก (Drop-off Bay) และหน้าแผนกฉุกเฉิน ER
        blk(20, -1298, 480, 46, 4.2, 0x475569, { z: -1.8, parent: gDeco });
        decal(20, -1276, 460, 5, 0xFACC15, 1.4);
        flatSign('🚗 จุดจอดรถรับ-ส่งผู้ป่วย (Drop-off)', 0, -1298, 220, 24, '#0284C7', FACE.S);
        // ทางม้าลายเชื่อมจากจุดจอดรถรับ-ส่งเข้าสู่ทางเข้าหลัก
        for (let i = -3; i <= 3; i++) decal(i * 22, -1255, 12, 32, 0xF8FAFC, 1.5);
        // ช่องจอดรถรับ-ส่งหน้า ER
        blk(1080, -1298, 280, 46, 4.2, 0x475569, { z: -1.8, parent: gDeco });
        decal(1080, -1276, 260, 5, 0xEF4444, 1.4);
        flatSign('🚑 จุดรถส่งผู้ป่วยฉุกเฉิน (ER Drop-off)', 1080, -1298, 210, 22, '#DC2626', FACE.S);
        // พื้นอาคารหลัก
        blk(0, 50, 2800, 1720, 4, 0xF1F5F9, { z: -2, parent: gDeco });
        // ป้ายชื่อโรงพยาบาลขนาดใหญ่หน้าอาคาร
        postSign(HOSPITAL.name, 0, -820, 95, 520, 68, '#0F172A', FACE.S, 'SMART HOSPITAL SIMULATOR 3D');
    },

    buildWallsAndDoors() {
        // ผนังรอบนอกอาคาร (-1400..1400, -800..900) พร้อมประตูบานเลื่อนอัตโนมัติทุกช่องทางเชื่อมโซน
        // ด้านหน้า Y = -800: ประตูผู้ป่วยหลัก X=0 (กว้าง 220), ประตูฉุกเฉิน ER X=1080 (กว้าง 180), ทางเชื่อมลานรวมพล X=-620 (กว้าง 120)
        wallX(-800, -1400, 1400, [[-620, 120], [0, 220], [1080, 180]]);
        // ด้านหลัง Y = 900
        wallX(900, -1400, 1400, []);
        // ด้านซ้าย-ขวา
        wallY(-1400, -800, 900, []);
        wallY(1400, -800, 900, []);

        // แนวผนังแบ่งโซนภายใน (ทุกจุดเชื่อมโซนมีประตูบานเลื่อนเปิด-ปิดอัตโนมัติ)
        // แถวหน้าสุด Y = -430 (เชื่อมโถงหน้า/คัดกรอง/Kiosk/ER เข้าสู่ทางเดินกลางล่าง)
        wallX(-430, -1400, 1400, [[-620, 120], [0, 220], [560, 120], [1080, 140]]);
        // แถวกลางล่าง Y = -70 (เชื่อมโถงทางเดินกลางล่างเข้าสู่โถงกลาง OPD)
        wallX(-70, -1400, 1400, [[0, 220]]);
        // แถวกลางบน Y = 330 (กั้นโถง OPD กับ IPD / ห้องตรวจแพทย์ 5 ห้อง / ทันตกรรม / แพทย์แผนไทย)
        wallX(330, -1400, 1400, [[-1050, 130], [-560, 90], [-280, 90], [0, 90], [280, 90], [560, 90], [920, 110], [1220, 110]]);

        // ผนังแนวตั้งโซนหน้า (-800..-430)
        wallY(-820, -800, -430, [[-615, 100]]); // ห้องลงทะเบียน/ห้องบัตร (-1400..-820)
        wallY(720, -800, -70, [[-615, 110], [-250, 110]]); // กั้น ER ฝั่งขวา (720..1400)

        // ผนังแนวตั้งโซนกลางล่าง (-430..-70)
        wallY(-920, -430, -70, [[-250, 100]]); // X-ray (-1400..-920) | LAB (-920..-420)
        wallY(-420, -430, -70, [[-250, 100]]);
        wallY(320, -430, -70, [[-250, 100]]);  // การเงิน (320..720)

        // ผนังแนวตั้งโซนกลาง (-70..330)
        // ฝั่งซ้าย: กายภาพบำบัด (-1400..-820, -70..330) + ประตูทางเดินบนเชื่อมไป IPD (Y=298)
        wallY(-820, -70, 330, [[120, 100], [298, 72]]);
        // ฝั่งขวา: เภสัชกรรม (720..1400, -70..330) + ประตูทางเดินบนเชื่อมไปทันตกรรม/แผนไทย (Y=298)
        wallY(720, -70, 330, [[120, 110], [298, 72]]);

        // ผนังแนวตั้งโซนบน (330..900)
        // IPD (-1400..-720, 330..900)
        wallY(-720, 330, 900, [[475, 110]]);
        // ห้องตรวจแพทย์ 5 ห้อง (-700..700, 330..640)
        wallX(640, -700, 700, [[-560, 80], [-280, 80], [0, 80], [280, 80], [560, 80]]);
        for (let i = 0; i <= 5; i++) {
            const x = -700 + i * 280;
            wallY(x, 330, 640, []);
        }
        // โซนหลังห้องตรวจ (640..900): ห้องพักเจ้าหน้าที่ / ห้องเก็บเวชภัณฑ์ / ห้องน้ำ / ห้องดับจิต
        wallY(-250, 640, 900, [[770, 90]]);
        wallY(250, 640, 900, [[770, 90]]);
        wallY(700, 330, 900, [[440, 95], [770, 90]]);
        // ฝั่งขวาบน (700..1400, 330..900): ทันตกรรม (700..1060, 330..660) + แพทย์แผนไทย (1060..1400, 330..660) + ห้องดับจิต/สนับสนุน (700..1400, 660..900)
        wallX(660, 700, 1400, [[735, 85], [1220, 90]]);
        wallY(1060, 330, 660, [[440, 90]]);
    },

    // ================= 1. ลานรวมพลเจ้าหน้าที่ =================
    buildZone1_Assembly() {
        // พื้นลานคอนกรีต/กระเบื้อง แยกฝั่งซ้ายหน้า รพ. (-1300..-480, -1220..-880)
        blk(-890, -1050, 820, 340, 3, 0xE2E8F0, { z: -0.5, parent: gDeco });
        decal(-890, -1050, 800, 320, 0xCBD5E1, 1.2);
        // เส้นกรอบลานและเส้นเข้าแถว 4 แถว x 8 คอลัมน์ = 32 ตำแหน่ง
        decal(-890, -1205, 780, 4, 0xF59E0B, 1.5);
        decal(-890, -895, 780, 4, 0xF59E0B, 1.5);
        // แท่นผู้นำแถว + เสาธง
        box(-890, -1190, 90, 36, 10, 0x475569, 0, false);
        cyl(-1240, -1190, 65, 2.5, 130, 0xE2E8F0, gDeco);
        blk(-1222, -1190, 34, 2, 22, 0xEF4444, { z: 115, parent: gDeco });
        // ป้ายลานรวมพล
        postSign('1. ลานรวมพลเจ้าหน้าที่ (Staff Assembly Point)', -890, -1215, 58, 300, 42, '#0284C7', FACE.S, 'เข้าแถวเคารพธงชาติ / ชี้แจงประจำวัน');
        zoneLabel('1. ลานรวมพลเจ้าหน้าที่', -890, -1050, '#0284C7');

        // ทางเดินเชื่อมจากลานรวมพลเข้าสู่อาคาร (เข้าประตู X=-620, Y=-800)
        blk(-620, -845, 110, 95, 2.5, 0x93C5FD, { z: 0, parent: gDeco });
        for (let y = -1000; y <= -810; y += 35) decal(-620, y, 60, 14, 0xFEF08A, 1.6);

        // สร้างจุดยืนเข้าแถวเรียงตามลำดับ (เว้นระยะห่างบุคคล 75x55, 5 แถว x 8 คอลัมน์ = 40 ตำแหน่ง)
        const cols = 8, rows = 5;
        for (let r = 0; r < rows; r++) {
            const ry = -1140 + r * 48;
            decal(-890, ry, 620, 3, 0x38BDF8, 1.6);
            for (let c = 0; c < cols; c++) {
                const cx = -1152 + c * 75;
                decal(cx, ry, 18, 18, 0x0284C7, 1.7);
                this.assemblySlots.push({ pos: [cx, ry], face: FACE.S });
            }
        }
    },

    // ================= 2. ทางเข้าโรงพยาบาลและจุดคัดกรอง =================
    buildZone2_EntranceScreening() {
        tint(-450, 450, -790, -440, 0xE0F2FE);
        zoneLabel('2. ทางเข้า & จุดคัดกรอง', 0, -640, '#0284C7');
        postSign('ทางเข้าโรงพยาบาล (Main Entrance)', 0, -795, 72, 240, 36, '#0284C7', FACE.S, 'โปรดคัดกรองก่อนเข้ารับบริการ');
        // ป้ายบอกเส้นทางไปห้องบัตร OPD และ ER
        sign('← ห้องบัตร / Kiosk | โถง OPD ↑ | ฉุกเฉิน ER →', 0, -445, 55, 310, 34, '#0F172A', FACE.S);

        // ทางลาดสำหรับรถเข็นและเปลผู้ป่วยหน้าประตูหลัก
        blk(0, -845, 180, 90, 3, 0x38BDF8, { z: 0, parent: gDeco });
        flatSign('♿ ทางลาดรถเข็น/เปล', 0, -845, 140, 26, '#0284C7', FACE.S);

        // โต๊ะคัดกรอง 2 โต๊ะ พร้อมเก้าอี้เจ้าหน้าที่ คอมพิวเตอร์ เครื่องวัดอุณหภูมิ ความดัน ออกซิเจนปลายนิ้ว
        const screenSlots = [];
        [-170, 170].forEach((sx, i) => {
            desk(sx, -610, 110, 38, 0x0EA5E9);
            chair(sx, -575, FACE.S, 0x1E3A8A); // เก้าอี้เจ้าหน้าที่คัดกรอง
            chair(sx, -650, FACE.N, 0x2563EB); // เก้าอี้ผู้ป่วยรับการประเมิน
            computer(sx - 22, -610, 30, FACE.S);
            vitals(sx + 20, -610, 30, FACE.S);
            // เครื่องวัดอุณหภูมิแบบตั้งเสา (Thermo Scan)
            post(sx + 68, -645, 42, 0xE2E8F0);
            blk(sx + 68, -645, 10, 6, 14, 0x0284C7, { z: 42 });
            sign(`โต๊ะคัดกรอง ${i + 1}`, sx, -610, 52, 86, 22, '#0369A1', FACE.S);

            screenSlots.push({
                patientPos: [sx, -650], patientFace: FACE.N,
                staffPos: [sx, -575], staffFace: FACE.S, staffRole: 'nurse'
            });
            this.staffPosts.push({ role: 'nurse', dept: 'พยาบาลคัดกรอง', pos: [sx, -575], face: FACE.S, anim: 'UseComputer' });
        });

        // เก้าอี้สำหรับผู้ป่วยที่ต้องรอประเมินอาการ (6 ที่นั่ง)
        const waitSeats = [];
        for (let i = 0; i < 6; i++) {
            const cx = -340 + (i % 3) * 38;
            const cy = -720 + Math.floor(i / 3) * 42;
            chair(cx, cy, FACE.E, 0x38BDF8);
            waitSeats.push([cx, cy]);
        }

        const scrSign = sign('คิวคัดกรอง S01 → ช่อง 1', 0, -545, 54, 150, 26, '#0F172A', FACE.S);
        regStation({
            id: 'SCREENING', name: 'จุดคัดกรอง', node: 'N_SCREEN',
            slots: screenSlots, seats: waitSeats, seatFace: FACE.E,
            queueOrigin: [0, -700], queueDir: [0, -1], prefix: 'S', sign: scrSign
        });
    },

    // ================= 3. ห้องลงทะเบียนรับบริการและห้องบัตร + 3.1 Kiosk 3 ตู้ + 3.2 พื้นที่นั่งรอ =================
    buildZone3_RegistrationKioskWaiting() {
        tint(-1390, -825, -790, -435, 0xFEF3C7);
        zoneLabel('3. ห้องบัตร & Kiosk', -1100, -620, '#D97706');

        // เคาน์เตอร์เจ้าหน้าที่เวชระเบียน 2 ช่องบริการ
        counter(-1120, -540, 280, 40, 0xD97706, 34);
        // ตู้เก็บเอกสารและอุปกรณ์สำนักงานด้านหลัง
        for (let i = 0; i < 4; i++) cabinet(-1280 + i * 95, -465, 78, 28, 62, 0xCBD5E1);

        const regSlots = [];
        [-1195, -1045].forEach((rx, i) => {
            chair(rx, -500, FACE.S, 0x78350F); // เก้าอี้เจ้าหน้าที่เวชระเบียน
            chair(rx, -585, FACE.N, 0x2563EB); // เก้าอี้ผู้ป่วย
            computer(rx - 18, -540, 37, FACE.S);
            // เครื่องอ่านบัตรประชาชน (Smart Card Reader)
            blk(rx + 12, -552, 8, 10, 4, 0x1E293B, { z: 37 });
            blk(rx + 12, -552, 6, 2, 5, 0x38BDF8, { z: 41 });
            // เครื่องสแกนเอกสารและเครื่องพิมพ์บัตร
            blk(rx + 32, -535, 18, 16, 10, 0x475569, { z: 37 });
            blk(rx + 32, -535, 12, 10, 4, 0xF8FAFC, { z: 47 });
            // ช่องรับ-ส่งเอกสาร
            decal(rx, -555, 28, 10, 0xFDE68A, 37.2);
            sign(`ช่องเวชระเบียน ${i + 1}`, rx, -540, 56, 95, 22, '#B45309', FACE.S);

            regSlots.push({
                patientPos: [rx, -585], patientFace: FACE.N,
                staffPos: [rx, -500], staffFace: FACE.S, staffRole: 'registrar'
            });
            this.staffPosts.push({ role: 'registrar', dept: 'เจ้าหน้าที่เวชระเบียน', pos: [rx, -500], face: FACE.S, anim: 'UseComputer' });
        });

        // 3.1 ตู้ Kiosk จำนวน 3 ตู้ ด้านข้างห้องลงทะเบียน (เว้นช่องทางเดินประตู X=-620 ให้โล่ง)
        const kioskSlots = [];
        for (let i = 0; i < 3; i++) {
            const kx = -520 + i * 62, ky = -510;
            const g = grp(kx, ky, 0);
            // ตัวตู้ Kiosk
            blk(0, 0, 32, 26, 48, 0x0F172A, { parent: g, solid: true });
            // หน้าจอสัมผัส
            blk(0, -13.5, 26, 2, 22, 0x38BDF8, { parent: g, z: 24, mat: matB(0x38BDF8) });
            // เครื่องอ่านบัตรประชาชน + เครื่องพิมพ์บัตรคิว
            blk(-7, -14, 7, 4, 3, 0x22C55E, { parent: g, z: 18 });
            blk(7, -14, 9, 4, 4, 0xF8FAFC, { parent: g, z: 18 });
            // ไฟสถานะด้านบนตู้
            const statusLight = blk(0, 0, 24, 10, 5, 0x10B981, { parent: g, z: 49, mat: matB(0x10B981) });
            const statusSign = sign(`Kiosk #${i + 1}: ว่าง`, kx, ky - 14, 62, 60, 18, '#059669', FACE.S);

            this.kiosks.push({
                id: i + 1, pos: [kx, ky - 34], face: FACE.N,
                state: 'ว่าง', light: statusLight, sign: statusSign,
                domId: `kiosk-status-${i + 1}`
            });
            kioskSlots.push({
                patientPos: [kx, ky - 34], patientFace: FACE.N,
                meta: { kioskIdx: i }
            });
            addObstacle(kx - 16, kx + 16, ky - 13, ky + 13);
        }

        // 3.2 พื้นที่นั่งรอหน้าห้องลงทะเบียน (เก้าอี้หลายแถว + จอคิว + พื้นที่รถเข็น/ผู้สูงอายุ)
        const regWaitSeats = [];
        for (let r = 0; r < 3; r++) {
            for (let c = 0; c < 5; c++) {
                const cx = -1280 + c * 42;
                const cy = -740 + r * 42;
                chair(cx, cy, FACE.N, r === 0 ? 0xF59E0B : 0x2563EB); // แถวหน้าสีเหลืองสำหรับผู้สูงอายุ
                regWaitSeats.push([cx, cy]);
            }
        }
        // พื้นที่จอดรถเข็นด้านข้างแถวเก้าอี้
        decal(-1030, -700, 65, 90, 0x38BDF8, 1.6);
        flatSign('♿ พื้นที่รถเข็น/ผู้สูงอายุ', -1030, -700, 64, 24, '#0284C7', FACE.N);

        const regQueueSign = sign('คิวห้องบัตร R01 → ช่อง 1', -1120, -475, 58, 175, 28, '#0F172A', FACE.S, 'เชิญที่เคาน์เตอร์เวชระเบียน');
        regStation({
            id: 'REGISTRATION', name: 'ห้องบัตร/เวชระเบียน', node: 'N_REG',
            slots: regSlots, seats: regWaitSeats, seatFace: FACE.N,
            queueOrigin: [-1120, -640], queueDir: [0, -1], prefix: 'R', sign: regQueueSign
        });
        regStation({
            id: 'KIOSK', name: 'ตู้ Kiosk อัตโนมัติ', node: 'N_KIOSK',
            slots: kioskSlots, seats: [],
            queueOrigin: [-458, -595], queueDir: [0, -1], prefix: 'K'
        });
    },

    setKioskState(idx, state) {
        const k = this.kiosks[idx];
        if (!k) return;
        k.state = state;
        const colors = { 'ว่าง': [0x10B981, '#059669'], 'กำลังใช้งาน': [0x38BDF8, '#0284C7'], 'กำลังประมวลผล': [0xF59E0B, '#D97706'], 'เสร็จสิ้น': [0x22C55E, '#16A34A'] };
        const [hex, css] = colors[state] || colors['ว่าง'];
        k.light.material = matB(hex);
        k.sign.set(`Kiosk #${k.id}: ${state}`, '', css);
        const el = $(k.domId);
        if (el) { el.innerText = state; el.style.color = css; }
    },

    // ================= 4. แผนกผู้ป่วยนอก (OPD) =================
    buildZone4_OPD() {
        tint(-700, 700, -65, 325, 0xEFF6FF);
        zoneLabel('4. แผนกผู้ป่วยนอก (OPD)', 0, 120, '#0284C7');

        // 4.1 โต๊ะพยาบาลซักประวัติ 5 โต๊ะ เรียงเป็นแนวหน้าห้องตรวจโรค
        const nurseSlots = [];
        for (let i = 0; i < 5; i++) {
            const nx = -560 + i * 280, ny = 155;
            desk(nx, ny, 92, 34, 0x0284C7);
            chair(nx, ny + 30, FACE.S, 0x1E3A8A); // เก้าอี้พยาบาล
            chair(nx, ny - 32, FACE.N, 0x38BDF8); // เก้าอี้ผู้ป่วย
            computer(nx - 22, ny, 30, FACE.S);
            vitals(nx + 16, ny, 30, FACE.S);      // เครื่องวัดความดัน อุณหภูมิ ออกซิเจนปลายนิ้ว
            blk(nx + 36, ny, 12, 16, 6, 0xF8FAFC, { z: 30 }); // แฟ้ม/อุปกรณ์บันทึกข้อมูล
            sign(`ซักประวัติ โต๊ะ ${i + 1}`, nx, ny, 50, 92, 20, '#0369A1', FACE.S);

            nurseSlots.push({
                patientPos: [nx, ny - 32], patientFace: FACE.N,
                staffPos: [nx, ny + 30], staffFace: FACE.S, staffRole: 'nurse'
            });
            this.staffPosts.push({ role: 'nurse', dept: `พยาบาลซักประวัติ ${i + 1}`, pos: [nx, ny + 30], face: FACE.S, anim: 'UseComputer' });
        }

        // โถงเก้าอี้นั่งรอซักประวัติ OPD
        const opdWaitSeats = [];
        for (let r = 0; r < 3; r++) {
            for (let c = 0; c < 10; c++) {
                const cx = -540 + c * 52 + (c >= 5 ? 160 : 0);
                const cy = -20 + r * 42;
                chair(cx, cy, FACE.N, 0x2563EB);
                opdWaitSeats.push([cx, cy]);
            }
        }
        const triageSign = sign('คิวซักประวัติ N01 → โต๊ะ 1', 0, 195, 58, 190, 26, '#0F172A', FACE.S);
        regStation({
            id: 'OPD_TRIAGE', name: 'โต๊ะพยาบาลซักประวัติ', node: 'N_OPD_HALL',
            slots: nurseSlots, seats: opdWaitSeats, seatFace: FACE.N,
            queueOrigin: [0, 80], queueDir: [0, -1], prefix: 'N', sign: triageSign
        });

        // 4.2 ห้องตรวจแพทย์ 5 ห้อง (330..640) + 4.3 จุดนั่งรอหน้าห้องตรวจ
        const docSlots = [];
        const docWaitSeats = [];
        for (let i = 0; i < 5; i++) {
            const rx = -560 + i * 280;
            tint(rx - 134, rx + 134, 336, 634, 0xF8FAFC);
            // โต๊ะแพทย์ + เก้าอี้แพทย์ + คอมพิวเตอร์ + เก้าอี้ผู้ป่วย
            desk(rx - 35, 540, 78, 34, 0xB45309);
            chair(rx - 35, 578, FACE.S, 0x1E3A8A); // แพทย์
            chair(rx - 35, 500, FACE.N, 0x2563EB); // ผู้ป่วย
            computer(rx - 50, 540, 30, FACE.S);
            // อุปกรณ์ตรวจร่างกายบนโต๊ะ
            blk(rx - 12, 540, 12, 10, 4, 0x10B981, { z: 30 });
            // เตียงตรวจร่างกาย + ม่านกั้นเพื่อความเป็นส่วนตัว
            bed(rx + 72, 535, 0, 0x38BDF8);
            curtain(rx + 28, 535, 3, 95, 0x7DD3FC);
            // ตู้เก็บอุปกรณ์ทางการแพทย์ + อ่างล้างมือ
            cabinet(rx - 105, 610, 46, 24, 58, 0xE2E8F0);
            sink(rx + 95, 405);

            // ป้ายหน้าห้องตรวจ + จอแสดงคิวหน้าห้อง
            sign(`ห้องตรวจแพทย์ ${i + 1}`, rx, 330, 58, 110, 24, '#1D4ED8', FACE.S, `นพ./พญ. ประจำห้อง ${i + 1}`);

            // 4.3 เก้าอี้รอหน้าห้องตรวจแต่ละห้อง (ฝั่งซ้าย-ขวาหน้าประตู)
            [-80, -45, 45, 80].forEach(dx => {
                chair(rx + dx, 275, FACE.N, 0x1D4ED8);
                docWaitSeats.push([rx + dx, 275]);
            });

            const roomObj = {
                id: i + 1, rx,
                patientPos: [rx - 35, 500], patientFace: FACE.N,
                examBedPos: [rx + 42, 535],
                staffPos: [rx - 35, 578], staffFace: FACE.S, staffRole: 'doctor'
            };
            this.doctorRooms.push(roomObj);
            docSlots.push(roomObj);
            this.staffPosts.push({ role: 'doctor', dept: `แพทย์ห้องตรวจ ${i + 1}`, pos: [rx - 35, 578], face: FACE.S, anim: 'UseComputer' });
        }

        const docQueueSign = sign('คิวพบแพทย์ D01 → ห้องตรวจ 1', 0, 315, 62, 220, 28, '#1E3A8A', FACE.S, 'โปรดรอเรียกชื่อหน้าห้องตรวจ');
        regStation({
            id: 'OPD_DOCTOR', name: 'ห้องตรวจแพทย์ OPD', node: 'N_DOC_CORR',
            slots: docSlots, seats: docWaitSeats, seatFace: FACE.N,
            queueOrigin: [0, 245], queueDir: [1, 0], prefix: 'D', sign: docQueueSign
        });
    },

    // ================= 5. แผนกฉุกเฉิน (ER) =================
    buildZone5_ER() {
        tint(726, 1394, -794, -75, 0xFEF2F2);
        zoneLabel('5. แผนกฉุกเฉิน (ER)', 1060, -420, '#EF4444');
        postSign('🚑 อุบัติเหตุ-ฉุกเฉิน (EMERGENCY - ER)', 1080, -795, 72, 280, 38, '#DC2626', FACE.S, 'เปิดบริการ 24 ชั่วโมง');

        // จุดรับผู้ป่วยจากรถพยาบาล + ทางลาดเปลฉุกเฉิน
        blk(1080, -855, 220, 100, 3, 0xFCA5A5, { z: 0, parent: gDeco });
        this.buildAmbulance(1000, -1040);

        // จุดคัดแยกความเร่งด่วน (Triage) + โต๊ะพยาบาลฉุกเฉินพร้อมคอมพิวเตอร์
        counter(880, -650, 160, 38, 0xDC2626, 34);
        chair(880, -612, FACE.S, 0x7F1D1D);
        computer(855, -650, 37, FACE.S);
        vitals(905, -650, 37, FACE.S);
        sign('จุดคัดแยกฉุกเฉิน (ER Triage)', 880, -650, 56, 140, 22, '#B91C1C', FACE.S);
        this.staffPosts.push({ role: 'nurse', dept: 'พยาบาลคัดแยก ER', pos: [880, -612], face: FACE.S, anim: 'UseComputer' });

        // เตียงกู้ชีพ (Resuscitation Bed) 1 เตียงใหญ่พร้อมเครื่องช่วยชีวิต
        bed(830, -490, 0, 0xDC2626);
        monitorStand(795, -490, FACE.E);
        box(865, -490, 22, 22, 38, 0xEF4444); // รถเข็นช่วยชีวิต (Crash Cart / Defibrillator)
        sign('เตียงกู้ชีพ (Resuscitation)', 830, -435, 50, 110, 20, '#991B1B', FACE.S);

        // เตียงสังเกตอาการจำนวน 5 เตียง พร้อมเครื่องติดตามสัญญาณชีพและม่านกั้น
        const erSlots = [];
        for (let i = 0; i < 5; i++) {
            const bx = 810 + i * 115, by = -210;
            bed(bx, by, 0, 0xEF4444);
            monitorStand(bx - 28, by + 20, FACE.S);
            if (i < 4) curtain(bx + 57, by, 3, 88, 0xFCA5A5);
            const slot = {
                id: `ER_${i + 1}`,
                patientPos: [bx, by - 48], patientFace: FACE.N,
                bedPos: [bx, by],
                staffPos: [bx + 28, by - 10], staffFace: FACE.W, staffRole: i === 0 ? 'doctor' : 'nurse'
            };
            this.erBeds.push(slot);
            erSlots.push(slot);
        }
        this.staffPosts.push({ role: 'doctor', dept: 'แพทย์เวรฉุกเฉิน ER', pos: [960, -340], face: FACE.S, anim: 'Examine' });
        this.staffPosts.push({ role: 'nurse', dept: 'พยาบาลฉุกเฉิน ER', pos: [1150, -340], face: FACE.S, anim: 'NurseCare' });
        this.staffPosts.push({ role: 'porter', dept: 'เจ้าหน้าที่เปลฉุกเฉิน (ER 1)', pos: [1220, -580], face: FACE.S, anim: 'Stand' });
        this.staffPosts.push({ role: 'porter', dept: 'เจ้าหน้าที่เปลฉุกเฉิน (ER 2)', pos: [1260, -620], face: FACE.S, anim: 'Stand' });

        // อุปกรณ์ทำแผล + จุดพักรถเข็นและเปลผู้ป่วย + จุดประสานงานส่งต่อ
        cabinet(1340, -520, 50, 90, 58, 0xF8FAFC);
        this.buildWheelchair(1290, -700);
        this.buildWheelchair(1335, -700);
        this.buildStretcher(1250, -620);
        desk(1260, -490, 95, 34, 0xB91C1C);
        computer(1260, -490, 30, FACE.S);
        sign('จุดประสานงานส่งต่อ (Refer Center)', 1260, -490, 52, 130, 20, '#7F1D1D', FACE.S);

        regStation({
            id: 'ER', name: 'แผนกฉุกเฉิน (ER)', node: 'N_ER',
            slots: erSlots, seats: [],
            queueOrigin: [1060, -580], queueDir: [0, -1], prefix: 'E'
        });
    },

    // ================= 6. แผนกผู้ป่วยใน (IPD) =================
    buildZone6_IPD() {
        tint(-1394, -726, 336, 894, 0xE0F2FE);
        zoneLabel('6. หอผู้ป่วยใน (IPD 10 เตียง)', -1060, 620, '#0284C7');

        // เคาน์เตอร์พยาบาลกลางหอผู้ป่วยใน 1 จุด + โต๊ะแพทย์และทีมพยาบาลราวด์วอร์ด
        counter(-1060, 410, 180, 38, 0x0284C7, 34);
        chair(-1090, 372, FACE.N, 0x1E3A8A);
        chair(-1030, 372, FACE.N, 0x1E3A8A);
        computer(-1090, 410, 37, FACE.N);
        computer(-1030, 410, 37, FACE.N);
        desk(-915, 410, 82, 32, 0x0369A1);
        computer(-915, 410, 30, FACE.S);
        sign('เคาน์เตอร์พยาบาลผู้ป่วยใน (IPD Nurse Station)', -1060, 410, 56, 180, 22, '#0369A1', FACE.S);
        // พยาบาลประจำเคาน์เตอร์รับผู้ป่วยใน 1 คน + แพทย์ประจำหอผู้ป่วยใน 1 คน + พยาบาลเดินตรวจเตียง 3 คน
        this.staffPosts.push({ role: 'nurse', dept: 'พยาบาลรับผู้ป่วยใน (เคาน์เตอร์ IPD)', pos: [-1060, 372], face: FACE.S, anim: 'UseComputer' });
        this.staffPosts.push({ role: 'doctor', dept: 'แพทย์ประจำหอผู้ป่วยใน (IPD)', pos: [-915, 372], face: FACE.S, anim: 'Examine' });
        this.staffPosts.push({ role: 'nurse', dept: 'พยาบาลผู้ป่วยใน (ดูแลเตียง 1)', pos: [-965, 372], face: FACE.S, anim: 'NurseCare' });
        this.staffPosts.push({ role: 'nurse', dept: 'พยาบาลผู้ป่วยใน (ดูแลเตียง 2)', pos: [-865, 372], face: FACE.S, anim: 'NurseCare' });
        this.staffPosts.push({ role: 'nurse', dept: 'พยาบาลผู้ป่วยใน (ดูแลเตียง 3)', pos: [-820, 372], face: FACE.S, anim: 'NurseCare' });

        // เตียงผู้ป่วยเริ่มต้น 10 เตียง (2 แถวๆ ละ 5 เตียง) พร้อมโต๊ะข้างเตียง ตู้เก็บของ เครื่องวัดสัญญาณชีพ และม่านกั้น
        for (let r = 0; r < 2; r++) {
            for (let c = 0; c < 5; c++) {
                const idx = r * 5 + c + 1;
                const bx = -1320 + c * 115;
                const by = 540 + r * 195;
                bed(bx, by, 0, 0x0284C7);
                box(bx - 30, by + 24, 16, 16, 22, 0xF8FAFC); // โต๊ะข้างเตียง
                monitorStand(bx + 28, by + 24, FACE.S);       // เครื่องติดตามสัญญาณชีพ
                if (c < 4) curtain(bx + 57, by, 3, 86, 0xBAE6FD);
                this.ipdBeds.push({
                    id: `IPD_${idx}`, number: idx,
                    pos: [bx, by - 46], bedPos: [bx, by],
                    occupied: false, occupant: null
                });
            }
        }
        // จุดเก็บเวชภัณฑ์และอุปกรณ์ทำแผล + ห้องน้ำผู้ป่วยใน
        cabinet(-770, 620, 44, 90, 60, 0xE2E8F0);
        box(-775, 845, 70, 70, 58, 0xCBD5E1);
        sign('🚻 ห้องน้ำ IPD', -775, 805, 48, 70, 18, '#475569', FACE.S);
        this.updateIPDBedHud();
    },

    allocateIPDBed(patient) {
        const free = this.ipdBeds.find(b => !b.occupied);
        if (free) { free.occupied = true; free.occupant = patient; this.updateIPDBedHud(); return free; }
        return null;
    },
    releaseIPDBed(bedObj) {
        if (!bedObj) return;
        bedObj.occupied = false; bedObj.occupant = null;
        this.updateIPDBedHud();
    },
    updateIPDBedHud() {
        const free = this.ipdBeds.filter(b => !b.occupied).length;
        setText('free-beds-count', `${free}/${this.ipdBeds.length}`);
    },

    // ================= 7. แผนกทันตกรรม =================
    buildZone7_Dental() {
        tint(706, 1054, 336, 654, 0xECFEFF);
        zoneLabel('7. แผนกทันตกรรม', 880, 500, '#0891B2');

        // เคาน์เตอร์ลงทะเบียนและตรวจสอบคิว + โต๊ะทันตแพทย์
        counter(790, 390, 110, 32, 0x0891B2, 32);
        computer(790, 390, 35, FACE.S);
        sign('เคาน์เตอร์ทันตกรรม', 790, 390, 52, 105, 20, '#0E7490', FACE.S);

        // เก้าอี้นั่งรอผู้ป่วยทันตกรรม
        const dentSeats = [];
        for (let i = 0; i < 4; i++) {
            const cx = 900 + i * 36, cy = 385;
            chair(cx, cy, FACE.N, 0x06B6D4);
            dentSeats.push([cx, cy]);
        }

        // ห้องตรวจและรักษาทันตกรรมจำนวน 3 ยูนิต (เก้าอี้ทำฟัน + โคมไฟตรวจ + ชุดเครื่องมือ)
        const dentSlots = [];
        for (let i = 0; i < 3; i++) {
            const ux = 775 + i * 105, uy = 545;
            // เก้าอี้ทำฟัน (Dental Unit)
            bed(ux, uy, 0, 0x06B6D4);
            lamp(ux - 24, uy - 10);
            box(ux + 28, uy, 18, 22, 28, 0xE2E8F0); // ชุดเครื่องมือทันตกรรม + อ่างบ้วนน้ำ
            chair(ux + 28, uy + 28, FACE.W, 0x155E75);
            if (i < 2) curtain(ux + 52, uy, 3, 86, 0xA5F3FC);
            sign(`ยูนิตทันตกรรม ${i + 1}`, ux, uy + 48, 48, 82, 18, '#0E7490', FACE.S);

            dentSlots.push({
                patientPos: [ux, uy - 45], patientFace: FACE.N,
                staffPos: [ux + 26, uy + 15], staffFace: FACE.W, staffRole: 'dentist'
            });
            this.staffPosts.push({ role: 'dentist', dept: `ทันตแพทย์ ยูนิต ${i + 1}`, pos: [ux + 26, uy + 15], face: FACE.W, anim: 'Treatment' });
        }
        // จุดจัดเตรียม/สเตอร์ไรด์เครื่องมือ + ตู้เวชภัณฑ์
        cabinet(1025, 590, 36, 80, 58, 0xE2E8F0);

        regStation({
            id: 'DENTAL', name: 'แผนกทันตกรรม', node: 'N_DENTAL',
            slots: dentSlots, seats: dentSeats, seatFace: FACE.N,
            queueOrigin: [880, 435], queueDir: [1, 0], prefix: 'DT'
        });
    },

    // ================= 8. แผนกแพทย์แผนไทย =================
    buildZone8_ThaiMed() {
        tint(1066, 1394, 336, 654, 0xECFDF5);
        zoneLabel('8. แพทย์แผนไทย', 1230, 500, '#059669');

        // จุดลงทะเบียน/ซักประวัติ + โต๊ะประเมินอาการ
        desk(1140, 395, 95, 32, 0x059669);
        chair(1140, 428, FACE.S, 0x065F46);
        chair(1140, 362, FACE.N, 0x10B981);
        computer(1140, 395, 29, FACE.S);
        sign('ประเมินอาการแพทย์แผนไทย', 1140, 395, 50, 115, 20, '#047857', FACE.S);

        // เตียงนวดแผนไทย 3 เตียง + เตียงประคบสมุนไพร 1 เตียง
        const thaiSlots = [];
        for (let i = 0; i < 3; i++) {
            const tx = 1120 + i * 82, ty = 555;
            bed(tx, ty, 0, 0x10B981);
            if (i < 2) curtain(tx + 41, ty, 3, 82, 0xA7F3D0);
            thaiSlots.push({
                patientPos: [tx, ty - 45], patientFace: FACE.N,
                staffPos: [tx + 24, ty], staffFace: FACE.W, staffRole: 'thaimed'
            });
            this.staffPosts.push({ role: 'thaimed', dept: `แพทย์แผนไทย เตียง ${i + 1}`, pos: [tx + 24, ty], face: FACE.W, anim: 'Treatment' });
        }
        // เตียงประคบสมุนไพร + ชั้นวางสมุนไพร + อ่างล้างมือ
        bed(1360, 555, 0, 0x84CC16);
        cabinet(1365, 430, 36, 68, 58, 0xD97706); // ชั้นวางลูกประคบและสมุนไพร
        sink(1290, 385);

        // พื้นที่พักคอยหลังรับบริการ
        const thaiSeats = [[1240, 385], [1275, 385]];
        thaiSeats.forEach(([x, y]) => chair(x, y, FACE.N, 0x10B981));

        regStation({
            id: 'THAIMED', name: 'แผนกแพทย์แผนไทย', node: 'N_THAIMED',
            slots: thaiSlots, seats: thaiSeats, seatFace: FACE.N,
            queueOrigin: [1220, 445], queueDir: [1, 0], prefix: 'TM'
        });
    },

    // ================= 9. แผนกกายภาพบำบัด =================
    buildZone9_Physio() {
        tint(-1394, -826, -64, 324, 0xF0FDFA);
        zoneLabel('9. แผนกกายภาพบำบัด', -1110, 130, '#0D9488');

        // เคาน์เตอร์ลงทะเบียนและนัดหมาย + โต๊ะประเมินการเคลื่อนไหว
        desk(-920, 20, 95, 32, 0x0D9488);
        chair(-920, 52, FACE.S, 0x115E59);
        chair(-920, -14, FACE.N, 0x14B8A6);
        computer(-920, 20, 29, FACE.S);
        sign('ประเมินและนัดหมายกายภาพบำบัด', -920, 20, 50, 135, 20, '#0F766E', FACE.S);

        // เตียงกายภาพบำบัดจำนวน 3 เตียง
        const physioSlots = [];
        for (let i = 0; i < 3; i++) {
            const px = -1310 + i * 110, py = 230;
            bed(px, py, 0, 0x14B8A6);
            physioSlots.push({
                patientPos: [px, py - 45], patientFace: FACE.N,
                staffPos: [px + 26, py], staffFace: FACE.W, staffRole: 'physio'
            });
            this.staffPosts.push({ role: 'physio', dept: `นักกายภาพบำบัด ${i + 1}`, pos: [px + 26, py], face: FACE.W, anim: 'Treatment' });
        }

        // ราวคู่ฝึกเดิน (Parallel Bars)
        blk(-1240, 65, 180, 46, 2, 0x99F6E4, { z: 1.5, parent: gDeco });
        [-1320, -1160].forEach(x => { post(x, 47, 26); post(x, 83, 26); });
        blk(-1240, 47, 165, 3, 3, 0x64748B, { z: 26 });
        blk(-1240, 83, 165, 3, 3, 0x64748B, { z: 26 });
        sign('ราวคู่ฝึกเดิน (Parallel Bars)', -1240, 65, 44, 120, 18, '#0F766E', FACE.S);

        // เสื่อออกกำลังกาย + อุปกรณ์ฝึกกำลังและการเคลื่อนไหว
        blk(-1020, 120, 95, 65, 2, 0x38BDF8, { z: 1.5, parent: gDeco });
        cyl(-920, 150, 14, 14, 28, 0xF59E0B); // ลูกบอลออกกำลังกาย

        // เก้าอี้พักผู้ป่วย + พื้นที่รถเข็น
        const phySeats = [[-1330, -20], [-1290, -20], [-1250, -20]];
        phySeats.forEach(([x, y]) => chair(x, y, FACE.N, 0x14B8A6));
        this.buildWheelchair(-1180, -20);

        regStation({
            id: 'PHYSIO', name: 'แผนกกายภาพบำบัด', node: 'N_PHYSIO',
            slots: physioSlots, seats: phySeats, seatFace: FACE.N,
            queueOrigin: [-1110, 120], queueDir: [1, 0], prefix: 'PT'
        });
    },

    // ================= 10. ห้องปฏิบัติการทางการแพทย์ (LAB) =================
    buildZone10_Lab() {
        tint(-914, -426, -424, -76, 0xF5F3FF);
        zoneLabel('10. ห้องปฏิบัติการ (LAB)', -670, -250, '#7C3AED');

        // จุดรับใบสั่งตรวจ + จุดเจาะเลือดและเก็บตัวอย่าง (2 ช่อง)
        counter(-670, -190, 220, 34, 0x7C3AED, 34);
        const labSlots = [];
        [-735, -605].forEach((lx, i) => {
            chair(lx, -152, FACE.S, 0x4C1D95); // นักเทคนิคการแพทย์
            chair(lx, -230, FACE.N, 0x8B5CF6); // เก้าอี้เจาะเลือดผู้ป่วย
            computer(lx - 18, -190, 37, FACE.S);
            // ชั้นวางหลอดตัวอย่างเลือด (Test Tube Rack)
            blk(lx + 18, -190, 16, 8, 6, 0xEF4444, { z: 37 });
            sign(`จุดเจาะเลือด/รับสิ่งส่งตรวจ ${i + 1}`, lx, -190, 54, 102, 20, '#6D28D9', FACE.S);

            labSlots.push({
                patientPos: [lx, -230], patientFace: FACE.N,
                staffPos: [lx, -152], staffFace: FACE.S, staffRole: 'lab'
            });
            this.staffPosts.push({ role: 'lab', dept: `เจ้าหน้าที่ห้องแล็บ ${i + 1}`, pos: [lx, -152], face: FACE.S, anim: 'UseComputer' });
        });

        // เครื่องวิเคราะห์ทางห้องปฏิบัติการอัตโนมัติ + ตู้เก็บตัวอย่างชีวภาพ
        box(-820, -115, 95, 40, 48, 0xE2E8F0);
        blk(-820, -94, 70, 2, 22, 0x38BDF8, { z: 22, mat: matB(0x38BDF8) });
        cabinet(-520, -115, 75, 36, 60, 0xDDD6FE);

        const labSeats = [[-820, -340], [-780, -340], [-740, -340]];
        labSeats.forEach(([x, y]) => chair(x, y, FACE.N, 0x8B5CF6));

        regStation({
            id: 'LAB', name: 'ห้องปฏิบัติการ (LAB)', node: 'N_LAB',
            slots: labSlots, seats: labSeats, seatFace: FACE.N,
            queueOrigin: [-670, -300], queueDir: [0, -1], prefix: 'L'
        });
    },

    // ================= 11. แผนกเอกซเรย์ (X-ray) =================
    buildZone11_Xray() {
        tint(-1394, -926, -424, -76, 0xEFF6FF);
        zoneLabel('11. แผนกเอกซเรย์ (X-ray)', -1160, -250, '#2563EB');

        // จุดรับคำสั่งตรวจและลงทะเบียน + ห้องควบคุมเครื่อง (กั้นกระจกตะกั่ว)
        desk(-1020, -310, 90, 32, 0x1D4ED8);
        chair(-1020, -275, FACE.S, 0x1E3A8A);
        computer(-1020, -310, 29, FACE.S);
        curtain(-1100, -220, 4, 170, 0x93C5FD); // ผนังกระจกห้องควบคุมเครื่อง
        sign('ห้องควบคุมเอกซเรย์ (X-Ray Control)', -1020, -310, 50, 125, 20, '#1E40AF', FACE.S);
        this.staffPosts.push({ role: 'radiology', dept: 'เจ้าหน้าที่รังสีเทคนิค', pos: [-1020, -275], face: FACE.S, anim: 'UseComputer' });

        // เตียง/แท่นตรวจเอกซเรย์ + โครงหัวอ่าน X-ray Gantry
        bed(-1250, -190, 0, 0x3B82F6);
        post(-1250, -235, 62, 0x475569);
        blk(-1250, -200, 36, 46, 12, 0xE2E8F0, { z: 54 });
        // แท่นยืนถ่ายเอกซเรย์ปอด (Chest Stand)
        box(-1345, -190, 14, 38, 60, 0x334155);
        blk(-1336, -190, 2, 32, 36, 0xF8FAFC, { z: 18 });

        const xraySeats = [[-1160, -370], [-1120, -370], [-1080, -370]];
        xraySeats.forEach(([x, y]) => chair(x, y, FACE.N, 0x2563EB));

        regStation({
            id: 'XRAY', name: 'แผนกเอกซเรย์ (X-ray)', node: 'N_XRAY',
            slots: [{
                patientPos: [-1250, -245], patientFace: FACE.N,
                staffPos: [-1020, -275], staffFace: FACE.S, staffRole: 'radiology'
            }],
            seats: xraySeats, seatFace: FACE.N,
            queueOrigin: [-1160, -310], queueDir: [0, -1], prefix: 'X'
        });
    },

    // ================= 12. แผนกเภสัชกรรม =================
    buildZone12_Pharmacy() {
        tint(726, 1394, -64, 324, 0xFFF7ED);
        zoneLabel('12. แผนกเภสัชกรรม (ห้องยา)', 1060, 130, '#EA580C');

        // เคาน์เตอร์รับใบสั่งยา ตรวจสอบยา และจ่ายยา 2 ช่อง (เว้นทางเดินด้านบน Y=298 ไปทันตกรรม/แพทย์แผนไทยให้โล่ง)
        counter(1060, 165, 320, 38, 0xEA580C, 34);
        // ชั้นวางยา ตู้เก็บเวชภัณฑ์ และโต๊ะจัดยาด้านหลังเคาน์เตอร์
        for (let i = 0; i < 4; i++) cabinet(860 + i * 130, 252, 88, 22, 60, 0xFED7AA);
        desk(1060, 214, 140, 28, 0x9A3412); // โต๊ะจัดเตรียมยาและตรวจสอบยาก่อนจ่าย

        const pharmSlots = [];
        [970, 1150].forEach((px, i) => {
            chair(px, 198, FACE.S, 0x7C2D12); // เภสัชกร
            computer(px - 20, 165, 37, FACE.S);
            // ตะกร้ายาบนเคาน์เตอร์
            blk(px + 18, 165, 20, 14, 7, 0x22C55E, { z: 37 });
            sign(i === 0 ? 'ช่อง 1: ยื่นใบสั่งยา/รับยา' : 'ช่อง 2: จ่ายยา/ให้คำปรึกษา', px, 165, 56, 130, 22, '#C2410C', FACE.S);

            pharmSlots.push({
                patientPos: [px, 120], patientFace: FACE.N,
                staffPos: [px, 198], staffFace: FACE.S, staffRole: 'pharmacist'
            });
            this.staffPosts.push({ role: 'pharmacist', dept: `เภสัชกร ช่อง ${i + 1}`, pos: [px, 198], face: FACE.S, anim: 'UseComputer' });
        });

        // เก้าอี้นั่งรอรับยา + จอเรียกคิวรับยา
        const pharmSeats = [];
        for (let r = 0; r < 2; r++) {
            for (let c = 0; c < 6; c++) {
                const cx = 860 + c * 46, cy = 0 + r * 38;
                chair(cx, cy, FACE.N, 0xF97316);
                pharmSeats.push([cx, cy]);
            }
        }
        const pharmSign = sign('คิวรับยา P01 → ช่อง 1', 1060, 105, 58, 185, 26, '#0F172A', FACE.S, 'โปรดเตรียมบัตรคิวและตรวจสอบชื่อบนซองยา');
        regStation({
            id: 'PHARMACY', name: 'แผนกเภสัชกรรม', node: 'N_PHARMACY',
            slots: pharmSlots, seats: pharmSeats, seatFace: FACE.N,
            queueOrigin: [1060, 82], queueDir: [0, -1], prefix: 'P', sign: pharmSign
        });
    },

    // ================= 13. จุดการเงิน =================
    buildZone13_Finance() {
        tint(326, 714, -424, -76, 0xF0FDF4);
        zoneLabel('13. จุดการเงิน (Cashier)', 520, -250, '#0D9488');

        // เคาน์เตอร์การเงิน 2 ช่อง พร้อมคอมพิวเตอร์ เครื่องพิมพ์ใบเสร็จ เครื่องรับชำระเงิน (EDC/QR)
        counter(520, -190, 210, 36, 0x0D9488, 34);
        const finSlots = [];
        [465, 575].forEach((fx, i) => {
            chair(fx, -152, FACE.S, 0x134E4A);
            computer(fx - 16, -190, 37, FACE.S);
            blk(fx + 14, -190, 12, 12, 9, 0xF8FAFC, { z: 37 }); // เครื่องพิมพ์ใบเสร็จ
            blk(fx + 28, -198, 7, 10, 6, 0x0284C7, { z: 37 });  // เครื่องรับชำระเงิน/QR
            sign(`ช่องการเงิน ${i + 1}`, fx, -190, 54, 92, 20, '#0F766E', FACE.S);

            finSlots.push({
                patientPos: [fx, -234], patientFace: FACE.N,
                staffPos: [fx, -152], staffFace: FACE.S, staffRole: 'finance'
            });
            this.staffPosts.push({ role: 'finance', dept: `เจ้าหน้าที่การเงิน ${i + 1}`, pos: [fx, -152], face: FACE.S, anim: 'UseComputer' });
        });

        const finSeats = [];
        for (let i = 0; i < 5; i++) {
            const cx = 420 + i * 44, cy = -345;
            chair(cx, cy, FACE.N, 0x14B8A6);
            finSeats.push([cx, cy]);
        }
        const finSign = sign('คิวการเงิน F01 → ช่อง 1', 520, -135, 56, 165, 24, '#0F172A', FACE.S);
        regStation({
            id: 'FINANCE', name: 'จุดการเงิน', node: 'N_FINANCE',
            slots: finSlots, seats: finSeats, seatFace: FACE.N,
            queueOrigin: [520, -295], queueDir: [0, -1], prefix: 'F', sign: finSign
        });
    },

    // ================= 14. พื้นที่สนับสนุนอื่น ๆ =================
    buildZone14_SupportAreas() {
        // จุดทำแผลและฉีดยา + จุดนัดหมายผู้ป่วย (อยู่บริเวณโถงกลางล่าง -410..310, -424..-76)
        tint(-414, 314, -424, -76, 0xF8FAFC);
        // จุดทำแผล-ฉีดยา
        bed(-290, -185, 0, 0x38BDF8);
        curtain(-235, -185, 3, 86, 0xBAE6FD);
        cabinet(-360, -185, 34, 65, 55, 0xE2E8F0);
        sign('จุดทำแผล / ฉีดยา', -290, -130, 50, 110, 20, '#0284C7', FACE.S);
        // จุดนัดหมายผู้ป่วย
        desk(210, -185, 90, 32, 0x0284C7);
        chair(210, -152, FACE.S, 0x1E3A8A);
        computer(210, -185, 29, FACE.S);
        sign('จุดนัดหมายผู้ป่วย', 210, -185, 50, 105, 20, '#0369A1', FACE.S);

        // โซนด้านหลังอาคาร (Y = 645..894)
        // ห้องพักเจ้าหน้าที่ (-700..-255)
        tint(-700, -255, 646, 894, 0xFEF9C3);
        desk(-480, 770, 130, 55, 0xD97706);
        [-530, -480, -430].forEach(x => { chair(x, 730, FACE.N, 0xF59E0B); chair(x, 810, FACE.S, 0xF59E0B); });
        sign('14. ห้องพักเจ้าหน้าที่ (Staff Lounge)', -480, 865, 52, 180, 22, '#B45309', FACE.S);
        this.staffPosts.push({ role: 'support', dept: 'เจ้าหน้าที่สนับสนุน', pos: [-480, 730], face: FACE.N, anim: 'Sit' });

        // ห้องเก็บเวชภัณฑ์กลาง (-245..245)
        tint(-245, 245, 646, 894, 0xF1F5F9);
        for (let i = 0; i < 4; i++) cabinet(-165 + i * 110, 825, 85, 32, 62, 0xCBD5E1);
        sign('คลังเวชภัณฑ์กลาง (Medical Supply)', 0, 865, 52, 175, 22, '#475569', FACE.S);

        // ห้องน้ำผู้ป่วยและเจ้าหน้าที่ (255..695)
        tint(255, 695, 646, 894, 0xE0F2FE);
        for (let i = 0; i < 4; i++) box(315 + i * 85, 835, 65, 65, 56, 0xE2E8F0);
        sink(360, 700); sink(460, 700);
        sign('🚻 ห้องน้ำรวมผู้ป่วยและเจ้าหน้าที่', 475, 865, 52, 175, 22, '#0284C7', FACE.S);

        // ห้องพักศพ / โซนสังเกตใกล้ชิด (706..1394, 666..894) เพื่อรองรับกรณีเสียชีวิตจาก DB
        tint(706, 1394, 666, 894, 0xE2E8F0);
        for (let i = 0; i < 3; i++) {
            const mx = 830 + i * 140, my = 790;
            bed(mx, my, 0, 0x64748B);
            this.morgueBeds.push({ id: `M_${i + 1}`, pos: [mx, my - 44], bedPos: [mx, my], occupied: false });
        }
        sign('จุดพักรักษาพิเศษ / ห้องดับจิต', 970, 865, 50, 170, 22, '#334155', FACE.S);

        // จุดรวบรวมขยะทางการแพทย์และบริการสนับสนุน (ด้านขวาหลัง)
        box(1310, 820, 42, 42, 42, 0xEF4444); // ขยะติดเชื้อ
        box(1355, 820, 42, 42, 42, 0x22C55E); // ขยะทั่วไป
        sign('จุดพักขยะทางการแพทย์', 1330, 865, 46, 115, 18, '#475569', FACE.S);

        // ลานจอดรถและจุดรับส่งผู้ป่วยด้านหน้าฝั่งขวา (X = 280..850, Y = -1180..-920)
        blk(560, -1050, 520, 240, 2.5, 0x475569, { z: -0.5, parent: gDeco });
        for (let i = 0; i < 5; i++) decal(350 + i * 100, -1050, 6, 190, 0xF8FAFC, 1.5);
        postSign('🅿️ ลานจอดรถ & จุดรับ-ส่งผู้ป่วย', 560, -1200, 52, 230, 32, '#1E293B', FACE.S);

        // ตกแต่งต้นไม้รอบอาคาร (~15% ของพื้นที่ภายนอก ห้ามอยู่บนถนนและตัวอาคารโรงพยาบาล)
        this.buildSurroundingTrees();
    },

    buildSurroundingTrees() {
        // ใช้โมเดลต้นไม้ Low-Poly ขนาดเบาในโฟลเดอร์ models/tree เพื่อให้แสดงผล ~110 ต้น (15% ของพื้นที่) ได้ลื่นไหล 60 FPS ไม่แลค
        const treeSpecs = [
            { file: 'coaster-kit-tree-large.glb', targetH: 185, weight: 3 },
            { file: 'coaster-kit-tree.glb', targetH: 155, weight: 3 },
            { file: 'graveyard-kit-pine-crooked.glb', targetH: 165, weight: 2 },
            { file: 'graveyard-kit-pine-fall-crooked.glb', targetH: 160, weight: 2 },
            { file: 'graveyard-kit-pine-fall.glb', targetH: 170, weight: 2 },
            { file: 'mini-forest-tree.glb', targetH: 165, weight: 3 },
            { file: 'nature-kit-tree_oak_dark.glb', targetH: 180, weight: 3 }
        ];

        // ตรวจสอบว่าจุด (x, y) ไม่อยู่บนถนน ทางเท้า ตัวอาคารโรงพยาบาล หรือลานหน้าอาคาร
        const isTreeSpotValid = (x, y, placed, minDist) => {
            if (x < -2220 || x > 2220 || y < -1665 || y > 1430) return false;
            // ห้ามอยู่ในเขตอาคารโรงพยาบาล + ระยะกันชนรอบผนัง (-1400..1400, -800..900)
            if (x > -1495 && x < 1495 && y > -885 && y < 985) return false;
            // ห้ามอยู่บนถนนหลัก 2 เลน (Y = -1530..-1310) และทางเท้า (Y = -1310..-1170) พร้อมระยะกันชน
            if (y > -1590 && y < -1130) return false;
            // ห้ามทับลานรวมพล ลานทางเข้าหลัก ลานจอดรถ และจุดจอดรถพยาบาลด้านหน้าอาคาร (Y = -1130..-800)
            if (y <= -800 && y >= -1130 && x > -1460 && x < 1460) {
                if (!(x >= -410 && x <= -310 && y >= -1080 && y <= -910)) return false;
            }
            for (let i = 0; i < placed.length; i++) {
                if (Math.hypot(x - placed[i][0], y - placed[i][1]) < minDist) return false;
            }
            return true;
        };

        // สร้างตำแหน่งต้นไม้รอบโรงพยาบาล ~110 ต้น (ครอบคลุมพื้นที่สีเขียวรอบนอก ~15%)
        const treeSpots = [];
        let seed = 13579;
        const seededRand = () => {
            seed = (seed * 16807) % 2147483647;
            return (seed - 1) / 2147483646;
        };

        const addRegionTrees = (xMin, xMax, yMin, yMax, count, minDist) => {
            let tries = 0, added = 0;
            while (added < count && tries < count * 35) {
                tries++;
                const tx = xMin + seededRand() * (xMax - xMin);
                const ty = yMin + seededRand() * (yMax - yMin);
                if (isTreeSpotValid(tx, ty, treeSpots, minDist)) {
                    treeSpots.push([tx, ty, 0.86 + seededRand() * 0.28, seededRand() * Math.PI * 2]);
                    added++;
                }
            }
        };

        // 1. โซนป่าและสวนฝั่งซ้ายอาคาร (West Belt: X = -2210..-1510, Y = -1110..1410)
        addRegionTrees(-2210, -1510, -1110, 1410, 35, 138);
        // 2. โซนป่าและสวนฝั่งขวาอาคาร (East Belt: X = 1510..2210, Y = -1110..1410)
        addRegionTrees(1510, 2210, -1110, 1410, 35, 138);
        // 3. โซนสวนด้านหลังอาคารโรงพยาบาล (North/Back Belt: X = -1480..1480, Y = 1000..1420)
        addRegionTrees(-1480, 1480, 1000, 1420, 26, 142);
        // 4. แนวต้นไม้ริมฝั่งตรงข้ามถนนด้านทิศใต้ (South Roadside Belt: X = -2180..2180, Y = -1660..-1600)
        addRegionTrees(-2180, 2180, -1660, -1600, 12, 250);
        // 5. เกาะสีเขียวด้านหน้าอาคารระหว่างลานรวมพลและทางเข้าหลัก
        addRegionTrees(-395, -325, -1060, -930, 2, 110);

        // หน่วงเวลาเล็กน้อยเพื่อให้ตัวละครเจ้าหน้าที่โหลดเสร็จก่อนเป็นอันดับแรก
        setTimeout(() => {
            const weightedPool = [];
            Promise.all(treeSpecs.map(async spec => {
                try {
                    const gltf = await loadGLTFOnce(`./models/tree/${spec.file}`);
                    const raw = gltf.scene.clone(true);
                    raw.rotation.x = HP;
                    raw.updateMatrixWorld(true);
                    const b1 = new THREE.Box3().setFromObject(raw);
                    const curH = Math.max(0.01, b1.max.z - b1.min.z);
                    const s = spec.targetH / curH;
                    raw.scale.set(s, s, s);
                    raw.updateMatrixWorld(true);
                    const b2 = new THREE.Box3().setFromObject(raw);
                    const cx = (b2.min.x + b2.max.x) * 0.5;
                    const cy = (b2.min.y + b2.max.y) * 0.5;
                    raw.position.set(-cx, -cy, -b2.min.z);
                    raw.traverse(ch => {
                        if (ch.isMesh) {
                            ch.castShadow = false;
                            ch.receiveShadow = false;
                        }
                    });
                    const template = new THREE.Group();
                    template.add(raw);
                    for (let w = 0; w < spec.weight; w++) weightedPool.push(template);
                } catch (e) { /* ignore missing */ }
            })).then(() => {
                if (!weightedPool.length) return;
                treeSpots.forEach(([tx, ty, sc, rotZ], idx) => {
                    const tpl = weightedPool[idx % weightedPool.length];
                    const inst = tpl.clone(true);
                    inst.position.set(tx, ty, 0);
                    inst.rotation.z = rotZ;
                    inst.scale.set(sc, sc, sc);
                    gDeco.add(inst);
                });
            });
        }, 400);
    },

    createAmbulanceMesh(x, y, initialRotZ = 0) {
        const g = grp(x, y, initialRotZ, gDeco);
        loadGLTFOnce('./models/car/box-body-ambulance.glb').then(gltf => {
            const m = gltf.scene.clone(true);
            m.rotation.x = HP;
            m.scale.set(34, 34, 34);
            const holder = new THREE.Group();
            holder.add(m);
            // หันหน้ารถพยาบาลไปทางทิศใต้ (ถนนด้านหน้า) และท้ายรถหันเข้าจุดรับผู้ป่วยฉุกเฉิน ER
            holder.rotation.z = -HP;
            holder.updateMatrixWorld(true);
            const box = new THREE.Box3().setFromObject(holder);
            const cx = (box.min.x + box.max.x) * 0.5;
            const cy = (box.min.y + box.max.y) * 0.5;
            holder.position.set(-cx, -cy, -box.min.z);
            m.traverse(ch => {
                if (ch.isMesh) {
                    ch.castShadow = false;
                    ch.receiveShadow = false;
                }
            });
            g.add(holder);
            if (typeof TrafficManager !== 'undefined' && TrafficManager.attachAmbulanceStandbyLights) {
                TrafficManager.attachAmbulanceStandbyLights(g);
            }
        }).catch(() => {
            blk(0, 0, 95, 185, 62, 0xFFFFFF, { parent: g, z: 12, shadow: false });
        });
        return g;
    },

    buildAmbulance(x, y) {
        const g = this.createAmbulanceMesh(x, y);
        this.vehicles.ambulance = g;
        // กั้นเขตสิ่งกีดขวางรอบรถพยาบาลไม่ให้ตัวละครเดินทะลุ
        addObstacle(x - 56, x + 56, y - 135, y + 135, 'furn');
        return g;
    },
    buildWheelchair(x, y) {
        const g = grp(x, y, 0);
        blk(0, 0, 22, 22, 3, 0x1E293B, { parent: g, z: 14 });
        blk(0, 9, 22, 3, 22, 0x1E293B, { parent: g, z: 16 });
        cyl(x - 12, y, 10, 10, 3, 0x475569); cyl(x + 12, y, 10, 10, 3, 0x475569);
    },
    buildStretcher(x, y) {
        const g = grp(x, y, 0);
        blk(0, 0, 34, 72, 6, 0xF8FAFC, { parent: g, z: 22 });
        blk(0, 0, 32, 70, 4, 0xEF4444, { parent: g, z: 26 });
        blk(0, 0, 30, 66, 20, 0x94A3B8, { parent: g, z: 2 });
    },

    // ================= โครงข่ายจุดนำทาง (Navigation Graph — ผ่านช่องประตูอัตโนมัติทุกจุด ห้ามเดินทะลุกำแพง) =================
    buildNavigationGraph() {
        // 1. ภายนอกอาคาร (ทางเท้า + จุดจอดรถรับ-ส่งผู้ป่วย + หน้าประตูทางเข้า)
        node('N_SPAWN_W', -1350, -1240);
        node('N_WALK_W', -620, -1240);
        node('N_WALK_MAIN', 0, -1240);
        node('N_EXIT', 420, -1240);
        node('N_WALK_E', 520, -1240);
        node('N_WALK_ER', 1080, -1240);
        node('N_SPAWN_E', 1350, -1240);

        node('N_DROPOFF_MAIN', 0, -1255);
        node('N_DROPOFF_PARK', 480, -1255);
        node('N_DROPOFF_ER', 1080, -1255);

        node('N_ASSEMBLY_ENTRY', -1210, -1050);
        node('N_ASSEMBLY_EXIT', -620, -860);
        node('N_ASM_DOOR', -620, -740);
        node('N_OUT_MAIN', 0, -860);
        node('N_DOOR_MAIN', 0, -740);
        node('N_OUT_ER', 1080, -860);
        node('N_DOOR_ER', 1080, -740);

        // 2. โซนทางเข้า / คัดกรอง / ห้องบัตร / Kiosk / ER Triage (Y = -800..-430)
        node('N_SCREEN', 0, -680);
        node('N_FOYER_N', 0, -520);
        node('N_FOYER_E', 560, -615);
        node('N_KIOSK_PASS', -620, -615);
        node('N_KIOSK', -458, -575);
        node('N_REG_DOOR', -820, -615);
        node('N_REG', -1050, -615);
        node('N_ER_DOOR_W', 720, -615);
        node('N_ER', 1080, -580);

        // 3. ประตูผ่านผนัง Y = -430 และโถงทางเดินกลางล่าง (Y = -250)
        node('N_DOOR_430_W', -620, -430);
        node('N_DOOR_430_C', 0, -430);
        node('N_DOOR_430_E', 560, -430);
        node('N_DOOR_430_ER', 1080, -430);

        node('N_XRAY', -1160, -250);
        node('N_CORR_S_W2', -920, -250);
        node('N_LAB', -670, -250);
        node('N_CORR_S_W1', -620, -250);
        node('N_DOOR_LAB_E', -420, -250);
        node('N_CORR_S_C', 0, -250);
        node('N_DOOR_FIN_W', 320, -250);
        node('N_FINANCE', 520, -250);
        node('N_CORR_S_E1', 560, -250);
        node('N_DOOR_ER_W', 720, -250);
        node('N_ER_BEDS_W', 790, -285);
        node('N_ER_BEDS', 1080, -285);

        // 4. โถงกลาง OPD (Y = 100) / กายภาพบำบัด / เภสัชกรรม
        node('N_DOOR_70_C', 0, -70);
        node('N_OPD_W', -620, 100);
        node('N_OPD_A1', -420, 100);
        node('N_OPD_A2', -140, 100);
        node('N_OPD_HALL', 0, 100);
        node('N_OPD_A3', 140, 100);
        node('N_OPD_A4', 420, 100);
        node('N_OPD_E', 620, 100);

        node('N_PHYSIO_DOOR', -820, 120);
        node('N_PHYSIO', -1050, 120);
        node('N_PHARM_DOOR', 720, 120);
        node('N_PHARMACY', 1060, 110);

        // 5. ทางเดินหน้าห้องตรวจแพทย์ (Y = 230 & Y = 298) และภายในห้องตรวจ 1..5
        node('N_DOC_CORR', 0, 230);
        node('N_CORR_N_A1', -420, 298);
        node('N_CORR_N_A2', -140, 298);
        node('N_CORR_N_A3', 140, 298);
        node('N_CORR_N_A4', 420, 298);

        node('N_DOC_1', -560, 298);
        node('N_DOC_2', -280, 298);
        node('N_DOC_3', 0, 298);
        node('N_DOC_4', 280, 298);
        node('N_DOC_5', 560, 298);

        node('N_DOC_IN_1', -560, 440);
        node('N_DOC_IN_2', -280, 440);
        node('N_DOC_IN_3', 0, 440);
        node('N_DOC_IN_4', 280, 440);
        node('N_DOC_IN_5', 560, 440);

        // 6. โซนบน (IPD / ทันตกรรม / แพทย์แผนไทย / ห้องพักเจ้าหน้าที่ / ห้องดับจิต)
        node('N_DOOR_N_W', -820, 298);
        node('N_IPD_DOOR', -1050, 298);
        node('N_IPD', -1050, 360);
        node('N_IPD_AISLE_E', -880, 410);
        node('N_IPD_ROW1', -1050, 475);
        node('N_IPD_AISLE_N', -840, 645);
        node('N_IPD_ROW2', -1050, 665);

        node('N_DOOR_N_E', 720, 298);
        node('N_SPEC_CORR', 920, 298);
        node('N_THAIMED_CORR', 1220, 298);
        node('N_DENTAL', 880, 440);
        node('N_DOOR_DT_TM', 1060, 440);
        node('N_THAIMED', 1220, 440);

        node('N_STAFF_PASS', -260, 440);
        node('N_STAFF_DOOR', -260, 640);
        node('N_STAFF_LOUNGE', -480, 710);

        node('N_MORGUE_PASS', 735, 440);
        node('N_MORGUE_DOOR', 735, 660);
        node('N_MORGUE', 830, 725);

        // เชื่อมเส้นทางภายนอกและประตูหน้าอาคาร
        link('N_SPAWN_W', 'N_ASSEMBLY_ENTRY', 'N_ASSEMBLY_EXIT', 'N_ASM_DOOR');
        link('N_SPAWN_W', 'N_WALK_W', 'N_WALK_MAIN', 'N_EXIT', 'N_WALK_E', 'N_WALK_ER', 'N_SPAWN_E');
        link('N_WALK_W', 'N_ASSEMBLY_ENTRY');
        link('N_WALK_W', 'N_ASSEMBLY_EXIT');
        link('N_ASSEMBLY_EXIT', 'N_OUT_MAIN', 'N_OUT_ER');
        link('N_DROPOFF_MAIN', 'N_WALK_MAIN', 'N_OUT_MAIN', 'N_DOOR_MAIN');
        link('N_DROPOFF_PARK', 'N_WALK_E');
        link('N_DROPOFF_ER', 'N_WALK_ER', 'N_OUT_ER', 'N_DOOR_ER');
        link('N_OUT_MAIN', 'N_EXIT');

        // เชื่อมโซนทางเข้า / คัดกรอง / Kiosk / ห้องบัตร / ER Triage
        link('N_DOOR_MAIN', 'N_SCREEN', 'N_FOYER_N');
        link('N_ASM_DOOR', 'N_KIOSK_PASS', 'N_REG_DOOR', 'N_REG');
        link('N_KIOSK_PASS', 'N_KIOSK', 'N_FOYER_N');
        link('N_SCREEN', 'N_KIOSK');
        link('N_FOYER_N', 'N_FOYER_E', 'N_ER_DOOR_W', 'N_ER', 'N_DOOR_ER');

        // เชื่อมผ่านผนัง Y = -430 เข้าสู่โถงทางเดินกลางล่าง (Y = -250)
        link('N_KIOSK_PASS', 'N_DOOR_430_W', 'N_CORR_S_W1');
        link('N_FOYER_N', 'N_DOOR_430_C', 'N_CORR_S_C');
        link('N_FOYER_E', 'N_DOOR_430_E', 'N_CORR_S_E1');
        link('N_ER', 'N_DOOR_430_ER', 'N_ER_BEDS');

        // เชื่อมโถงทางเดินกลางล่าง Y = -250 (X-ray / Lab / การเงิน / ER)
        link('N_XRAY', 'N_CORR_S_W2', 'N_LAB', 'N_CORR_S_W1', 'N_DOOR_LAB_E', 'N_CORR_S_C', 'N_DOOR_FIN_W', 'N_FINANCE', 'N_CORR_S_E1', 'N_DOOR_ER_W', 'N_ER_BEDS_W', 'N_ER_BEDS');

        // เชื่อมเข้าสู่โถงกลาง OPD (Y = 100) / กายภาพบำบัด / เภสัชกรรม
        link('N_CORR_S_C', 'N_DOOR_70_C', 'N_OPD_HALL');
        link('N_PHYSIO', 'N_PHYSIO_DOOR', 'N_OPD_W', 'N_OPD_A1', 'N_OPD_A2', 'N_OPD_HALL', 'N_OPD_A3', 'N_OPD_A4', 'N_OPD_E', 'N_PHARM_DOOR', 'N_PHARMACY');

        // เชื่อมโถง OPD ขึ้นไปยังทางเดินหน้าห้องตรวจแพทย์ (Y = 298) ผ่านช่องทางเดินปลอดสิ่งกีดขวาง
        link('N_OPD_A1', 'N_CORR_N_A1');
        link('N_OPD_A2', 'N_DOC_CORR', 'N_CORR_N_A2');
        link('N_OPD_A3', 'N_DOC_CORR', 'N_CORR_N_A3');
        link('N_OPD_A4', 'N_CORR_N_A4');
        link('N_DOC_CORR', 'N_DOC_3');

        // เชื่อมทางเดินบน Y = 298 ตลอดแนว (IPD <-> ห้องตรวจ 1..5 <-> ทันตกรรม <-> แพทย์แผนไทย)
        link('N_IPD_DOOR', 'N_DOOR_N_W', 'N_DOC_1', 'N_CORR_N_A1', 'N_DOC_2', 'N_CORR_N_A2', 'N_DOC_3', 'N_CORR_N_A3', 'N_DOC_4', 'N_CORR_N_A4', 'N_DOC_5', 'N_DOOR_N_E', 'N_SPEC_CORR', 'N_THAIMED_CORR');

        // เชื่อมเข้าภายในห้องตรวจแพทย์ 1..5
        link('N_DOC_1', 'N_DOC_IN_1');
        link('N_DOC_2', 'N_DOC_IN_2');
        link('N_DOC_3', 'N_DOC_IN_3');
        link('N_DOC_4', 'N_DOC_IN_4');
        link('N_DOC_5', 'N_DOC_IN_5');

        // เชื่อมภายในหอผู้ป่วยใน (IPD)
        link('N_IPD_DOOR', 'N_IPD', 'N_IPD_AISLE_E', 'N_IPD_ROW1', 'N_IPD_AISLE_N', 'N_IPD_ROW2');

        // เชื่อมทันตกรรม / แพทย์แผนไทย / ห้องพักเจ้าหน้าที่ / ห้องดับจิต
        link('N_SPEC_CORR', 'N_DENTAL', 'N_DOOR_DT_TM', 'N_THAIMED');
        link('N_THAIMED_CORR', 'N_THAIMED');
        link('N_DOC_IN_2', 'N_STAFF_PASS', 'N_STAFF_DOOR', 'N_STAFF_LOUNGE');
        link('N_DENTAL', 'N_MORGUE_PASS', 'N_MORGUE_DOOR', 'N_MORGUE');
    }
};


// ================= 6. CharacterManager & Animation System (1. ทำ Model Caching & Cloning) =================
const gltfLoader = new GLTFLoader();
gltfLoader.setMeshoptDecoder(MeshoptDecoder);

const modelCache = new Map();
const characterBaseCache = new Map(); // Cache สำหรับ Base Model Template (โหลดครั้งเดียวแล้ว SkeletonUtils.clone ทันที)
const animClipCache = new Map();
const activeMixers = [];
const allCharacters = [];
let labelsVisible = true;
let selectedCharacter = null;

// ตัวแปรและเวกเตอร์ส่วนกลางสำหรับคำนวณตำแหน่ง NameTag (Zero Garbage Collection)
const _tagProjVec = new THREE.Vector3();
let tagFrameCounter = 0;

function loadGLTFOnce(path) {
    if (!modelCache.has(path)) {
        modelCache.set(path, new Promise((resolve, reject) => {
            gltfLoader.load(path, g => resolve(g), undefined, err => reject(err));
        }));
    }
    return modelCache.get(path);
}

// 1. Model Caching: โหลดโมเดล GLB แต่ละไฟล์เพียงครั้งเดียว แล้วเก็บใส่ Cache
// เมื่อต้องการตัวละครใหม่จะเรียก SkeletonUtils.clone(cachedModel) แทนการสั่ง gltfLoader.load() ใหม่
async function getCachedCharacterScene(modelPath) {
    if (characterBaseCache.has(modelPath)) {
        return SkeletonUtils.clone(characterBaseCache.get(modelPath));
    }
    const gltf = await loadGLTFOnce(modelPath);
    const template = gltf.scene;
    template.scale.set(40, 40, 40);
    template.rotation.set(HP, 0, 0);
    template.traverse(c => {
        if (c.isMesh) {
            c.castShadow = true;
            c.receiveShadow = false; // ปิด receiveShadow บนตัวละครเพื่อลดการคำนวณเงาซ้อน (เพิ่มความลื่นไหลสูง)
            if (c.material) c.material.roughness = Math.max(c.material.roughness || 0.5, 0.4);
        }
    });
    characterBaseCache.set(modelPath, template);
    return SkeletonUtils.clone(template);
}

async function getAnimClip(path, bonePrefix = 'Bip01') {
    const cacheKey = `${path}|${bonePrefix}`;
    if (animClipCache.has(cacheKey)) return animClipCache.get(cacheKey);
    try {
        const g = await loadGLTFOnce(path);
        const baseClip = (g.animations && g.animations[0]) || null;
        if (!baseClip) {
            animClipCache.set(cacheKey, null);
            return null;
        }
        if (bonePrefix === 'Bip01') {
            animClipCache.set(cacheKey, baseClip);
            return baseClip;
        }
        // Retarget clip สำหรับโมเดลเด็กที่ใช้โครงกระดูก Bip02 (สัดส่วนความสูงสะโพก 0.79 เท่าของผู้ใหญ่)
        const retargeted = baseClip.clone();
        retargeted.tracks = retargeted.tracks.map(t => {
            const tr = t.clone();
            tr.name = tr.name.replace(/^Bip01/, bonePrefix);
            if (tr.name.endsWith('.position')) {
                for (let i = 0; i < tr.values.length; i++) tr.values[i] *= 0.79;
            }
            return tr;
        });
        animClipCache.set(cacheKey, retargeted);
        return retargeted;
    } catch {
        animClipCache.set(cacheKey, null);
        return null;
    }
}

// แมปบทบาทและเครื่องแบบตัวละครเจ้าหน้าที่ทุกแผนก + ผู้ป่วยทุกกลุ่มวัย
const ROLE_META = {
    doctor:     { label: 'แพทย์', color: '#0284c7', modelsM: ['Medical personnel/Medical_Male_01.glb', 'Medical personnel/Medical_Male_02.glb'], modelsF: ['Medical personnel/Medical_Female_01.glb'] },
    nurse:      { label: 'พยาบาล', color: '#0ea5e9', modelsM: ['Medical personnel/Medical_Male_03.glb'], modelsF: ['Medical personnel/Medical_Female_02.glb', 'Medical personnel/Medical_Female_03.glb'] },
    registrar:  { label: 'เวชระเบียน', color: '#d97706', modelsM: ['Personnel/Business_Male_01.glb', 'Personnel/Business_Male_02.glb'], modelsF: ['Personnel/Business_Female_02.glb', 'Personnel/Business_Female_03.glb'] },
    pharmacist: { label: 'เภสัชกร', color: '#ea580c', modelsM: ['Medical personnel/Medical_Male_04.glb'], modelsF: ['Medical personnel/Medical_Female_01.glb'] },
    dentist:    { label: 'ทันตแพทย์', color: '#0891b2', modelsM: ['Medical personnel/Medical_Male_02.glb'], modelsF: ['Medical personnel/Medical_Female_02.glb'] },
    physio:     { label: 'นักกายภาพบำบัด', color: '#0d9488', modelsM: ['Personnel/Sports_Male_02.glb', 'Medical personnel/Medical_Male_05.glb'], modelsF: ['Personnel/Sports_Female_02.glb'] },
    thaimed:    { label: 'แพทย์แผนไทย', color: '#059669', modelsM: ['Medical personnel/Medical_Male_05.glb', 'Personnel/Gardener_Male_01.glb'], modelsF: ['Medical personnel/Medical_Female_03.glb'] },
    lab:        { label: 'เทคนิคการแพทย์', color: '#7c3aed', modelsM: ['Medical personnel/Medical_Male_04.glb'], modelsF: ['Medical personnel/Medical_Female_01.glb'] },
    radiology:  { label: 'รังสีเทคนิค', color: '#2563eb', modelsM: ['Medical personnel/Medical_Male_03.glb'], modelsF: ['Medical personnel/Medical_Female_02.glb'] },
    finance:    { label: 'การเงิน', color: '#14b8a6', modelsM: ['Personnel/Business_Male_04.glb'], modelsF: ['Personnel/Business_Female_04.glb'] },
    support:    { label: 'จนท.สนับสนุน', color: '#64748b', modelsM: ['Security personnel/Security_Male_01.glb', 'Personnel/Delivery_Male_01.glb'], modelsF: ['Personnel/Chef_Female_01.glb'] },
    porter:     { label: 'จนท.เวรเปล', color: '#059669', modelsM: ['Security personnel/Security_Male_01.glb', 'Personnel/Delivery_Male_01.glb', 'Medical personnel/Medical_Male_05.glb'], modelsF: ['Personnel/Sports_Female_02.glb'] },
    security:   { label: 'รปภ.', color: '#1e293b', modelsM: ['Security personnel/Security_Male_01.glb'], modelsF: ['Security personnel/Security_Male_01.glb'] },
    police:     { label: 'ตำรวจสายตรวจ', color: '#1e3a8a', modelsM: ['Security personnel/Police_Male_04.glb', 'Security personnel/Police_Male_06.glb'], modelsF: ['Security personnel/Police_Male_04.glb'] },
    patient:    { label: 'ผู้ป่วย', color: '#38bdf8', modelsM: ['Personnel/Male_Adult_01.glb', 'Personnel/Male_Adult_02.glb', 'Personnel/Male_Adult_03.glb'], modelsF: ['Personnel/Female_Adult_03.glb', 'Personnel/Female_Adult_05.glb', 'Personnel/Female_Adult_08.glb'] }
};

const PATIENT_AGE_MODELS = {
    'เด็ก':   { 'ชาย': ['Personnel/Male_Child_01.glb', 'Personnel/Male_Child_02.glb'], 'หญิง': ['Personnel/Female_Child_01.glb'] },
    'วัยรุ่น': { 'ชาย': ['Personnel/Male_Adult_01.glb', 'Personnel/Sports_Male_02.glb'], 'หญิง': ['Personnel/Female_Adult_03.glb', 'Personnel/Sports_Female_02.glb'] },
    'วัยทำงาน': { 'ชาย': ['Personnel/Male_Adult_02.glb', 'Personnel/Male_Adult_03.glb', 'Personnel/Business_Male_01.glb'], 'หญิง': ['Personnel/Female_Adult_05.glb', 'Personnel/Business_Female_02.glb'] },
    'ชรา':   { 'ชาย': ['Personnel/Male_Adult_09.glb', 'Personnel/Male_Adult_10.glb'], 'หญิง': ['Personnel/Female_Adult_12.glb', 'Personnel/Female_Adult_13.glb'] }
};

function resolveModelPath(role, gender = 'ชาย', ageGroup = 'วัยทำงาน') {
    const isF = gender === 'หญิง' || gender === 'female';
    if (role === 'patient') {
        const g = PATIENT_AGE_MODELS[ageGroup] || PATIENT_AGE_MODELS['วัยทำงาน'];
        const list = isF ? g['หญิง'] : g['ชาย'];
        return `./models/humen/${pick(list)}`;
    }
    const meta = ROLE_META[role] || ROLE_META.support;
    const list = isF ? meta.modelsF : meta.modelsM;
    return `./models/humen/${pick(list)}`;
}

// 15. ระบบ Animation พื้นฐาน + ท่าเต้นและเชียร์ที่ลานรวมพล
const ANIM_MAP = {
    Idle:            g => `./animations/${g}_idle_neutral_01.glb`,
    LookAround:      g => `./animations/${g}_idle_look_around_01.glb`,
    Walk:            g => `./animations/${g}_walk_neutral_01.glb`,
    Run:             g => `./animations/${g}_run_neutral_01.glb`,
    Wave:            g => `./animations/${g}_wave_01.glb`,
    Dance:           g => `./animations/${g}_dancing_neutral.glb`,
    Cheer:           g => `./animations/${g}_cheer_01.glb`,
    Sit:             () => `./animations/sit.glb`,
    Stand:           g => `./animations/${g}_idle_neutral_01.glb`,
    Queue:           g => `./animations/${g}_idle_look_around_01.glb`,
    UseComputer:     g => `./animations/${g}_gestic_thoughtful_01.glb`,
    Talk:            g => `./animations/${g}_gestic_talk_neutral_01.glb`,
    Examine:         g => `./animations/${g}_gestic_thoughtful_01.glb`,
    NurseCare:       g => `./animations/${g}_gestic_talk_neutral_01.glb`,
    Wheelchair:      g => `./animations/${g}_idle_neutral_01.glb`,
    Stretcher:       g => `./animations/${g}_idle_neutral_01.glb`,
    Treatment:       g => `./animations/${g}_claphands_01.glb`,
    ReceiveMedicine: g => `./animations/${g}_gestic_talk_neutral_01.glb`,
    Payment:         g => `./animations/${g}_gestic_thoughtful_01.glb`
};

// ================= ระบบบทสนทนาและการทักทาย (Dialogue & Social System) =================
let chatBubblesEnabled = true;

const DIALOGUE_SCRIPTS = {
    // บทสนทนาที่ลานรวมพล (ทักทายยามเช้า + เต้นออกกำลังกาย)
    assemblyGreeting: [
        'อรุณสวัสดิ์ครับทุกคน วันนี้พร้อมดูแลคนไข้เต็มที่!',
        'สวัสดีตอนเช้าค่ะ วันนี้คิวผู้ป่วยนอกน่าจะเยอะ สู้ๆ นะคะ!',
        'อรุณสวัสดิ์ค่ะคุณหมอ เมื่อคืนเวร ER เรียบร้อยดีค่ะ',
        'สวัสดีครับทุกแผนก ขอให้วันนี้บริการผู้ป่วยราบรื่นครับ!'
    ],
    assemblyDance: [
        'เต้นแอโรบิกยามเช้า ขยับร่างกายก่อนเข้าเวร! 💃',
        '1-2-3 ยืดเส้นยืดสาย สดชื่นพร้อมทำงานครับ! 🕺',
        'ออกกำลังกายตอนเช้า เพิ่มพลังบวกให้ทุกแผนกค่ะ! ✨',
        'จังหวะนี้สนุกมาก สุขภาพดีเริ่มที่บุคลากรของเรา! 🙌'
    ],
    // เดินสวนกันระหว่างบุคลากรทางการแพทย์ (พูดเรื่องงานและอาการคนไข้)
    passStaffToStaff: [
        ['สวัสดีครับ กำลังเดินไปดูผลแล็บคนไข้ห้องตรวจ 2 ครับ', 'สวัสดีค่ะ ผลเลือดออกพอดีเลย ส่งเข้าระบบให้แล้วนะคะ'],
        ['อรุณสวัสดิ์ค่ะคุณหมอ วันนี้เคสความดันกับเบาหวานมาตามนัดครบเลยค่ะ', 'ขอบคุณครับพยาบาล เดี๋ยวผมเร่งตรวจให้ตามคิวเลยครับ'],
        ['วันนี้เตียงผู้ป่วยในว่างกี่เตียงครับ?', 'ตอนนี้หอผู้ป่วยในเตรียมเตียงว่างพร้อมรับ Admit ค่ะ'],
        ['คนไข้เคสปวดหลังส่งต่อไปกายภาพบำบัดแล้วนะครับ', 'รับทราบค่ะ เดี๋ยวทีมกายภาพดูแลต่อให้ทันทีเลยค่ะ']
    ],
    // เดินสวนกันระหว่างบุคลากรกับคนไข้
    passStaffToPatient: [
        ['สวัสดีค่ะ วันนี้มาตรวจแผนกไหนคะ?', 'สวัสดีครับ มาตรวจตามนัดและรับยาครับคุณพยาบาล'],
        ['สวัสดีครับ อาการวันนี้เป็นอย่างไรบ้างครับ?', 'ดีขึ้นกว่าสัปดาห์ก่อนมากเลยค่ะคุณหมอ ขอบคุณนะคะ'],
        ['เชิญเดินตามป้ายบอกทางไปจุดบริการได้เลยนะคะ', 'ขอบคุณมากครับเจ้าหน้าที่']
    ],
    // เดินสวนกันระหว่างคนไข้ด้วยกัน (พูดเรื่องอาการตนเองและการรักษา)
    passPatientToPatient: [
        ['สวัสดีครับ มาตรวจแต่เช้าเหมือนกันเลย วันนี้เป็นอะไรมาครับ?', 'สวัสดีค่ะ พอดีปวดหัวตัวร้อนมา 2 วัน เลยมาให้คุณหมอตรวจค่ะ'],
        ['คุณหมอที่นี่ดูแลดีมากเลยนะคะ คิวรันไวด้วย', 'จริงครับ ผมมาตรวจติดตามความดัน รับยาแป๊บเดียวก็เสร็จแล้วครับ'],
        ['วันนี้มาทำกายภาพบำบัดเหรอคะ?', 'ใช่ครับ มาฝึกเดินกับยืดกล้ามเนื้อ อาการปวดเข่าดีขึ้นเยอะเลยครับ']
    ],
    // บทพูดตามเรื่องราวของบุคลากรแต่ละแผนกขณะปฏิบัติงาน
    staffWorkMonologue: {
        doctor: [
            'ตรวจสอบประวัติการรักษาและผลแล็บในระบบ HIS สักครู่นะครับ',
            'เคสนี้ความดันเริ่มคุมได้ดี เดี๋ยวปรับขนาดยาต่อเนื่องให้ครับ',
            'บันทึกผลการวินิจฉัยและสั่งยาเข้าห้องยาเรียบร้อย'
        ],
        nurse: [
            'เชิญวัดความดันและออกซิเจนปลายนิ้วที่โต๊ะซักประวัติค่ะ',
            'ตรวจสอบสัญญาณชีพผู้ป่วยอยู่ในเกณฑ์ปกติค่ะ',
            'กำลังจัดลำดับคิวผู้ป่วยเข้าห้องตรวจแพทย์ค่ะ'
        ],
        registrar: [
            'กำลังตรวจสอบสิทธิการรักษาและลงทะเบียนผู้ป่วยใหม่ค่ะ',
            'เสียบบัตรประชาชนตรวจสอบข้อมูลเวชระเบียนเรียบร้อยครับ'
        ],
        pharmacist: [
            'ตรวจสอบความถูกต้องของขนาดยาและปฏิกิริยาระหว่างยาก่อนจ่ายครับ',
            'จัดเตรียมยาตามใบสั่งแพทย์ พร้อมพิมพ์ฉลากยาภาษาไทยค่ะ'
        ],
        dentist: [
            'ตรวจเช็กสุขภาพเหงือกและฟัน พร้อมเตรียมเครื่องมือขูดหินปูนครับ',
            'บันทึกภาพพิมพ์ฟันและนัดหมายตรวจฟันครั้งถัดไปค่ะ'
        ],
        thaimed: [
            'เตรียมลูกประคบสมุนไพรร้อนสำหรับคลายกล้ามเนื้อคอและบ่าครับ',
            'กดจุดนวดแผนไทยช่วยกระตุ้นการไหลเวียนโลหิตค่ะ'
        ],
        physio: [
            'ปรับระดับราวคู่ฝึกเดินและเตรียมแผ่นประคบอุ่นให้ผู้ป่วยครับ',
            'ประเมินองศาการเคลื่อนไหวของข้อเข่าและข้อไหล่ค่ะ'
        ],
        lab: [
            'กำลังปั่นแยกพลาสมาและรันเครื่องวิเคราะห์ผลเลือดอัตโนมัติครับ',
            'ผลตรวจ CBC และน้ำตาลในเลือดพร้อมส่งกลับห้องตรวจแพทย์ค่ะ'
        ],
        radiology: [
            'ปรับค่าเครื่องเอกซเรย์และส่งภาพฟิล์มดิจิทัลเข้าระบบ PACS ครับ'
        ],
        finance: [
            'ตรวจสอบสิทธิบัตรทอง ประกันสังคม และสรุปยอดค่าใช้จ่ายค่ะ'
        ],
        support: [
            'ดูแลความสะอาดและความพร้อมของรถเข็นเปลผู้ป่วยครับ'
        ],
        security: [
            'สวัสดีครับ เชิญเข้ารับการคัดกรองด้านในอาคารได้เลยครับ',
            'ดูแลความปลอดภัยหน้าประตูทางเข้าโรงพยาบาลเรียบร้อยดีครับ',
            'ผู้มารับบริการโปรดระวังทางลาดขณะเดินหรือเข็นรถเข็นนะครับ'
        ],
        police: [
            'สายตรวจ สภ.เมือง ตรวจสอบความเรียบร้อยภายในโรงพยาบาล เหตุการณ์ปกติครับ',
            'ดูแลความปลอดภัยให้บุคลากรทางการแพทย์และประชาชนครับ'
        ]
    }
};

const DialogueManager = {
    encounterCooldown: 0,

    logToFeed(speakerName, roleLabel, text, zoneName = '') {
        const box = $('chat-feed-box');
        if (!box) return;
        const item = document.createElement('div');
        item.className = 'chat-feed-item';
        item.innerHTML = `${zoneName ? `<span class="zone-tag">${zoneName}</span>` : ''}<span class="speaker">[${roleLabel}] ${speakerName}:</span>${text}`;
        box.prepend(item);
        while (box.children.length > 18) box.removeChild(box.lastChild);
    },

    // บทสนทนาหลายช่วง (ใช้ข้อมูลจริงจากระบบ) — พูดครบทุกประโยค ระยะเวลาแปรตามความยาวข้อความ
    // turns = [['staff' | 'pat', 'ข้อความ'], ...]
    async scriptedDialogue(patient, staffChar, turns, zoneLabel, patAnim = 'Talk', staffAnim = 'Talk') {
        if (staffChar && staffChar.active) {
            const dx = patient.group.position.x - staffChar.group.position.x;
            const dy = patient.group.position.y - staffChar.group.position.y;
            staffChar.faceDirection(Math.atan2(dy, dx));
            if (patAnim !== 'LieBed' && patient.animState !== 'LieBed') {
                patient.faceDirection(Math.atan2(-dy, -dx));
            }
        }
        for (const [who, text] of turns) {
            if (!text || !patient.active) continue;
            const dur = Math.min(6.5, 2.2 + text.length / 28);
            if (who === 'pat') {
                patient.playAnim(patAnim);
                patient.say(text, dur, zoneLabel);
            } else {
                if (!staffChar || !staffChar.active) continue;
                const isSeatedStaff = staffChar.workDefaultAnim === 'Sit' || staffChar.workDefaultAnim === 'UseComputer';
                staffChar.playAnim(isSeatedStaff ? 'Sit' : staffAnim);
                staffChar.say(text, dur, zoneLabel);
            }
            await sleep(Math.min(4.2, 1.5 + text.length / 40));
        }
    },

    // สนทนาโต้ตอบระหว่างเจ้าหน้าที่ประจำจุดกับผู้ป่วย (หันหน้าเข้าหากัน + สุ่มพูดคุยตามจังหวะไม่ให้ถี่เกินไป)
    async converseAtStation(patient, staffChar, patLine, staffLine, zoneLabel, patAnim = 'Talk', staffAnim = 'Talk') {
        if (staffChar && staffChar.active) {
            const dx = patient.group.position.x - staffChar.group.position.x;
            const dy = patient.group.position.y - staffChar.group.position.y;
            staffChar.faceDirection(Math.atan2(dy, dx));
            if (patAnim !== 'LieBed' && patient.animState !== 'LieBed') {
                patient.faceDirection(Math.atan2(-dy, -dx));
            }
        }
        const shouldSpeak = Math.random() < 0.55;
        if (patLine) {
            const isSeatedPat = (patAnim === 'Sit' || patAnim === 'UseComputer' || patAnim === 'LieBed');
            patient.playAnim(isSeatedPat ? patAnim : patAnim);
            if (shouldSpeak) patient.say(patLine, 2.5, zoneLabel);
            await sleep(1.3);
        }
        if (staffLine) {
            if (staffChar && staffChar.active) {
                const isSeatedStaff = staffChar.workDefaultAnim === 'Sit' || staffChar.workDefaultAnim === 'UseComputer';
                staffChar.playAnim(isSeatedStaff ? 'Sit' : staffAnim);
                if (shouldSpeak) staffChar.say(staffLine, 2.6, zoneLabel);
            }
            await sleep(1.4);
        }
    },

    // ตรวจจับตัวละครเดินมาเจอกันแบบสุ่ม (ลดความถี่ ไม่ต้องคุยกันทุกครั้ง โดยเฉพาะระหว่างผู้มารับบริการ)
    update(dt) {
        if (this.encounterCooldown > 0) this.encounterCooldown -= dt;
        if (this.encounterCooldown > 0) return;

        for (let i = 0; i < allCharacters.length; i++) {
            const a = allCharacters[i];
            if (!a.canSocialGreet()) continue;
            for (let j = i + 1; j < allCharacters.length; j++) {
                const b = allCharacters[j];
                if (!b.canSocialGreet()) continue;
                const dx = b.group.position.x - a.group.position.x;
                const dy = b.group.position.y - a.group.position.y;
                const dist = Math.hypot(dx, dy);
                if (dist > 22 && dist < 48) {
                    const bothPatients = !a.isStaff && !b.isStaff;
                    // ผู้มารับบริการเจอกันเอง สุ่มคุยเฉพาะบางครั้ง (~15%) ส่วนเจ้าหน้าที่สุ่ม (~35%)
                    const greetChance = bothPatients ? 0.15 : 0.35;
                    if (Math.random() > greetChance) {
                        a.socialCooldown = rand(18, 32);
                        b.socialCooldown = rand(18, 32);
                        this.encounterCooldown = rand(3.5, 6.0);
                        return;
                    }
                    this.triggerPassingEncounter(a, b);
                    this.encounterCooldown = rand(7.5, 12.0);
                    return;
                }
            }
        }
    },

    async triggerPassingEncounter(a, b) {
        a.socialCooldown = rand(28, 45);
        b.socialCooldown = rand(28, 45);
        a.pauseMoveTimer = 1.6;
        b.pauseMoveTimer = 1.6;

        const angAB = Math.atan2(b.group.position.y - a.group.position.y, b.group.position.x - a.group.position.x);
        a.faceDirection(angAB);
        b.faceDirection(angAB + Math.PI);

        a.playAnim('Wave');
        b.playAnim('Wave');

        let pair;
        if (a.isStaff && b.isStaff) {
            pair = pick(DIALOGUE_SCRIPTS.passStaffToStaff);
            a.say(pair[0], 2.6, 'ทางเดิน รพ.');
            setTimeout(() => { if (b.active) { b.playAnim('Talk'); b.say(pair[1], 2.6, 'ทางเดิน รพ.'); } }, 650);
        } else if (a.isStaff !== b.isStaff) {
            const staff = a.isStaff ? a : b;
            const pat = a.isStaff ? b : a;
            pair = pick(DIALOGUE_SCRIPTS.passStaffToPatient);
            staff.say(pair[0], 2.6, 'ทักทาย');
            setTimeout(() => {
                if (pat.active) {
                    pat.playAnim('Talk');
                    pat.say(pat.symptomStory ? `สวัสดีครับ/ค่ะ วันนี้มาตรวจเรื่อง${pat.symptomStory}ครับ/ค่ะ` : pair[1], 2.6, 'ทักทาย');
                }
            }, 650);
        } else {
            pair = pick(DIALOGUE_SCRIPTS.passPatientToPatient);
            a.say(pair[0], 2.6, 'ผู้ป่วยทักกัน');
            setTimeout(() => {
                if (b.active) {
                    b.playAnim('Talk');
                    b.say(b.symptomStory ? `สวัสดีค่ะ วันนี้มาตรวจอาการ${b.symptomStory}ค่ะ` : pair[1], 2.6, 'ผู้ป่วยทักกัน');
                }
            }, 650);
        }
    }
};

class SimCharacter {
    constructor(opts) {
        this.id = opts.id || `c_${Math.random().toString(36).slice(2, 8)}`;
        this.name = opts.name || 'ตัวละคร';
        this.role = opts.role || 'patient';
        this.dept = opts.dept || (ROLE_META[this.role]?.label || '');
        this.gender = opts.gender || 'ชาย';
        this.ageGroup = opts.ageGroup || 'วัยทำงาน';
        this.isStaff = opts.isStaff || false;
        this.isYou = !!opts.isYou;
        this.isDeceased = !!opts.isDeceased;
        this.symptomStory = opts.symptomStory || '';
        this.customModelPath = opts.modelPath || null;

        this.group = new THREE.Group();
        this.group.position.set(opts.x || 0, opts.y || 0, 0);
        this.group.userData.simChar = this;
        scene.add(this.group);

        this.poseGroup = new THREE.Group();
        this.group.add(this.poseGroup);

        this.propGroup = new THREE.Group();
        this.group.add(this.propGroup);

        this.headMarkerGroup = new THREE.Group();
        this.group.add(this.headMarkerGroup);
        this.diamondMesh = null;
        this.haloMesh = null;
        if (this.isYou) this.enableLoginDiamond();
        if (this.isDeceased) this.enableGoldHalo();

        this.currentNode = opts.startNode || null;
        this.path = [];
        this.moveResolve = null;
        this.speed = opts.speed || (this.isStaff ? 125 : 105);
        this.targetFace = opts.face ?? FACE.N;
        this.stateText = opts.stateText || 'เริ่มต้น';
        this.lastChatText = '-';
        this.animState = 'Idle';
        this.mixer = null;
        this.actions = {};
        this.currentAction = null;
        this.active = true;
        this.loaded = false;
        this.idleBehavior = null; // 'assembly' | 'work' | null
        this.idleCycleTimer = rand(1.5, 5.5);
        this.speechTimer = 0;
        this.socialCooldown = rand(3, 9);
        this.pauseMoveTimer = 0;
        this.charIndex = allCharacters.length;
        this.shadowCheckTimer = rand(0.05, 0.35);
        this.shadowsCast = true;

        this.createTag();
        allCharacters.push(this);
    }

    createTag() {
        const meta = ROLE_META[this.role] || ROLE_META.patient;
        const el = document.createElement('div');
        el.className = 'name-tag';
        el.style.display = labelsVisible ? 'block' : 'none';
        const bubbleClass = this.isStaff ? 'speech-bubble staff-bubble' : 'speech-bubble patient-bubble';
        const youBadge = this.isYou ? `<span class="role-pill" style="background:#10b981;color:#fff">💎 คุณ (Login)</span>` : '';
        el.innerHTML = `<div class="${bubbleClass}"></div>${youBadge}<span class="role-pill" style="background:${meta.color};color:#fff">${this.dept || meta.label}</span><span>${this.name}</span><span class="state-pill">${this.stateText}</span>`;
        $('ui-layer').appendChild(el);
        this.tagEl = el;
        this.bubbleEl = el.querySelector('.speech-bubble');
        this.statePillEl = el.querySelector('.state-pill');
    }

    // สร้างเพชร 3 มิติ (3D Diamond) หมุนลอยอยู่เหนือศีรษะตัวละครที่ Login
    enableLoginDiamond() {
        if (this.diamondMesh) return;
        const holder = new THREE.Group();
        holder.position.set(0, 0, 92);

        const gemGeo = new THREE.OctahedronGeometry(7.5, 0);
        gemGeo.scale(1, 1, 1.65);
        const gemMat = new THREE.MeshStandardMaterial({
            color: 0x10B981,
            emissive: 0x059669,
            emissiveIntensity: 0.75,
            metalness: 0.35,
            roughness: 0.15,
            flatShading: true
        });
        const gem = new THREE.Mesh(gemGeo, gemMat);

        const edgeGeo = new THREE.EdgesGeometry(gemGeo);
        const edgeMat = new THREE.LineBasicMaterial({ color: 0xA7F3D0 });
        gem.add(new THREE.LineSegments(edgeGeo, edgeMat));

        holder.add(gem);
        this.headMarkerGroup.add(holder);
        this.diamondMesh = holder;
    }

    // สร้างวงกลมแบบโดนัทสีทอง (Golden Donut Halo) เหนือศีรษะผู้ป่วยที่เสียชีวิต
    enableGoldHalo() {
        this.isDeceased = true;
        if (this.haloMesh) return;
        const haloGeo = new THREE.TorusGeometry(8.5, 2.0, 16, 36);
        const haloMat = new THREE.MeshStandardMaterial({
            color: 0xFFD700,
            emissive: 0xF59E0B,
            emissiveIntensity: 0.65,
            metalness: 0.85,
            roughness: 0.18
        });
        const torus = new THREE.Mesh(haloGeo, haloMat);
        torus.position.set(0, 0, 82);
        this.headMarkerGroup.add(torus);
        this.haloMesh = torus;
    }

    say(text, duration = 3.2, zoneName = '') {
        if (!text || !this.active) return;
        this.lastChatText = text;
        this.speechTimer = duration;
        if (this.bubbleEl && chatBubblesEnabled) {
            this.bubbleEl.innerText = `💬 "${text}"`;
            this.bubbleEl.style.display = 'block';
        }
        DialogueManager.logToFeed(this.name, this.dept || this.role, text, zoneName);
        if (selectedCharacter === this) updateInspectorUI();
    }

    canSocialGreet() {
        return this.active && this.loaded && this.path.length > 0 &&
               this.socialCooldown <= 0 && this.pauseMoveTimer <= 0 &&
               this.animState === 'Walk' && !this.useStretcher;
    }

    setState(text, anim = null) {
        this.stateText = text;
        if (this.statePillEl) this.statePillEl.innerText = text;
        if (anim) this.playAnim(anim);
        if (selectedCharacter === this) updateInspectorUI();
    }

    async loadModel() {
        const gPrefix = (this.gender === 'หญิง' || this.gender === 'female') ? 'f' : 'm';
        const modelPath = this.customModelPath || resolveModelPath(this.role, this.gender, this.ageGroup);
        try {
            // 1. Model Caching (Cloning): โหลดไฟล์ GLB ครั้งเดียว แล้ว Clone ด้วย SkeletonUtils.clone ทันที
            const cloned = await getCachedCharacterScene(modelPath);
            let bonePrefix = 'Bip01';
            cloned.traverse(c => {
                if (c.name && c.name.startsWith('Bip02')) bonePrefix = 'Bip02';
            });
            this.poseGroup.add(cloned);
            this.model = cloned;
            this.shadowsCast = true;

            this.mixer = new THREE.AnimationMixer(cloned);
            activeMixers.push(this.mixer);

            const animKeys = ['Idle', 'LookAround', 'Walk', 'Run', 'Wave', 'Dance', 'Cheer', 'Sit', 'Talk', 'UseComputer', 'Treatment'];
            await Promise.all(animKeys.map(async key => {
                const clip = await getAnimClip(ANIM_MAP[key](gPrefix), bonePrefix);
                if (clip) {
                    const act = this.mixer.clipAction(clip);
                    if (key === 'Sit') {
                        act.setLoop(THREE.LoopOnce, 1);
                        act.clampWhenFinished = true;
                    }
                    this.actions[key] = act;
                }
            }));
        } catch {
            const m = new THREE.Mesh(geo(18, 18, 48), mat(0x38BDF8));
            m.position.z = 24;
            this.poseGroup.add(m);
        }
        this.loaded = true;
        this.playAnim(this.animState);
        return this;
    }

    playAnim(stateName) {
        this.animState = stateName;
        this.poseGroup.position.set(0, 0, 0);
        this.poseGroup.rotation.set(0, 0, 0);
        this.clearProps();

        if (stateName === 'Stretcher') {
            const isChild = (this.ageGroup === 'เด็ก' || this.ageGroup === 'child');
            const yOff = isChild ? -26 : -34;
            const zPos = isChild ? 32.5 : 34.5;
            this.poseGroup.position.set(0, yOff, zPos);
            this.poseGroup.rotation.x = -HP;
            this.attachStretcherProp();
        } else if (stateName === 'LieBed') {
            // ปรับตัวละครนอนกึ่งกลางเตียง ลอยพ้นฟูกและหมอนพอดี (Z = 40.5) ไม่จมเตียง และศีรษะหนุนบนหมอน (Y = -40) ไม่ชนหรือมุดใต้หัวเตียง
            const isChild = (this.ageGroup === 'เด็ก' || this.ageGroup === 'child');
            const yOff = isChild ? -33 : -40;
            const zPos = isChild ? 37.0 : 40.5;
            this.poseGroup.position.set(0, yOff, zPos);
            this.poseGroup.rotation.set(-HP, 0, 0);
            this.targetFace = FACE.S;
            this.group.rotation.z = 0;
        }

        if (!this.mixer) return;
        const mapToClip = {
            Idle: 'Idle', Stand: 'Idle', Sit: 'Sit',
            Queue: 'LookAround', LookAround: 'LookAround',
            Walk: 'Walk', Wheelchair: 'Walk', Stretcher: 'Idle', LieBed: 'Idle',
            Run: 'Run', Wave: 'Wave', Dance: 'Dance', Cheer: 'Cheer',
            UseComputer: 'Sit', Examine: 'Talk', Payment: 'Talk',
            Talk: 'Talk', NurseCare: 'Talk', ReceiveMedicine: 'Talk',
            Treatment: 'Treatment'
        }[stateName] || 'Idle';

        const nextAct = this.actions[mapToClip] || this.actions.Idle;
        if (nextAct && this.currentAction !== nextAct) {
            for (const act of Object.values(this.actions)) {
                if (act && act !== nextAct) {
                    act.fadeOut(0.15);
                    act.stop();
                }
            }
            nextAct.reset();
            nextAct.enabled = true;
            nextAct.setEffectiveTimeScale(1);
            nextAct.setEffectiveWeight(1);
            nextAct.fadeIn(0.16).play();
            this.currentAction = nextAct;
        } else if (nextAct && !nextAct.isRunning() && mapToClip !== 'Sit') {
            nextAct.reset().play();
        }
        if (selectedCharacter === this) updateInspectorUI();
    }

    clearProps() {
        while (this.propGroup.children.length) this.propGroup.remove(this.propGroup.children[0]);
    }
    attachStretcherProp() {
        blk(0, 0, 32, 70, 5, 0xEF4444, { parent: this.propGroup, z: 18 });
        blk(0, 0, 28, 64, 16, 0x94A3B8, { parent: this.propGroup, z: 2 });
    }

    faceDirection(rad) {
        if (this.animState === 'LieBed') return; // ล็อกทิศทางไม่ให้ตัวละครนอนเอียงหรือหันผิดทิศขณะอยู่บนเตียง
        this.targetFace = rad;
        this.group.rotation.z = rad + HP;
    }

    async walkToNode(targetNode, finalPos = null, finalFace = null, moveAnim = 'Walk') {
        if (!this.active) return;
        const resolvedMoveAnim = (!moveAnim || moveAnim === 'Sit' || moveAnim === 'UseComputer' || moveAnim === 'Wheelchair') ? 'Walk' : moveAnim;
        this.queueAfterMove = null;
        const startPos = [this.group.position.x, this.group.position.y];
        const pts = buildPath(this.currentNode, targetNode, finalPos, startPos);
        this.currentNode = targetNode;
        if (pts.length === 0) {
            if (finalFace !== null) this.faceDirection(finalFace);
            return;
        }
        this.path = pts;
        this.moveAnimKey = resolvedMoveAnim;
        this.playAnim(resolvedMoveAnim);
        await new Promise(res => {
            this.moveResolve = res;
        });
        if (finalFace !== null) this.faceDirection(finalFace);
    }

    moveToQueueSpot(nodeName, pos, face, sit) {
        if (!this.active) return;
        const distToSpot = Math.hypot(pos[0] - this.group.position.x, pos[1] - this.group.position.y);
        if (distToSpot < 8 && this.path.length === 0) {
            this.currentNode = nodeName;
            this.faceDirection(face);
            const targetAnim = sit ? 'Sit' : 'Queue';
            if (this.animState !== targetAnim) this.playAnim(targetAnim);
            return;
        }
        const startPos = [this.group.position.x, this.group.position.y];
        this.path = buildPath(this.currentNode, nodeName, pos, startPos);
        this.currentNode = nodeName;
        this.queueAfterMove = { face, sit };
        this.moveAnimKey = 'Walk';
        this.playAnim('Walk');
    }

    update(dt) {
        if (!this.active) return;

        if (this.socialCooldown > 0) this.socialCooldown -= dt;
        if (this.speechTimer > 0) {
            this.speechTimer -= dt;
            if (this.speechTimer <= 0 && this.bubbleEl) {
                this.bubbleEl.style.display = 'none';
            }
        }

        // หยุดทักทายเมื่อเดินสวนกันแล้วค่อยเดินต่อ
        if (this.pauseMoveTimer > 0) {
            this.pauseMoveTimer -= dt;
            if (this.pauseMoveTimer <= 0 && this.path.length > 0) {
                this.playAnim(this.moveAnimKey || 'Walk');
            }
        } else if (this.path.length > 0) {
            // บังคับว่าหากตัวละครกำลังเคลื่อนที่ตามเส้นทาง ห้ามค้างท่านั่ง (Sit) เด็ดขาด ต้องเป็น Walk หรือ Run เท่านั้น
            if (this.animState === 'Sit' || this.animState === 'UseComputer' || this.animState === 'Idle' || this.animState === 'Queue') {
                const activeMove = (this.moveAnimKey === 'Run' || this.moveAnimKey === 'Stretcher') ? this.moveAnimKey : 'Walk';
                this.playAnim(activeMove);
            }
            const target = this.path[0];
            const dx = target.x - this.group.position.x;
            const dy = target.y - this.group.position.y;
            const dist = Math.hypot(dx, dy);

            if (dist < 10) {
                if (!wallBlocked(target.x, target.y, 2)) {
                    this.group.position.x = target.x;
                    this.group.position.y = target.y;
                }
                this.path.shift();
                if (this.path.length === 0) {
                    if (this.queueAfterMove) {
                        this.faceDirection(this.queueAfterMove.face);
                        this.playAnim(this.queueAfterMove.sit ? 'Sit' : 'Queue');
                        this.queueAfterMove = null;
                    }
                    if (this.moveResolve) {
                        const r = this.moveResolve; this.moveResolve = null; r();
                    }
                }
            } else {
                const ang = Math.atan2(dy, dx);
                let sepX = 0, sepY = 0;
                for (const other of allCharacters) {
                    if (other === this || !other.active) continue;
                    const ox = this.group.position.x - other.group.position.x;
                    const oy = this.group.position.y - other.group.position.y;
                    const od = Math.hypot(ox, oy);
                    if (od > 0.1 && od < 22) {
                        sepX += (ox / od) * (22 - od) * 0.35;
                        sepY += (oy / od) * (22 - od) * 0.35;
                    }
                }
                const step = Math.min(dist, this.speed * dt);
                const baseNx = this.group.position.x + Math.cos(ang) * step;
                const baseNy = this.group.position.y + Math.sin(ang) * step;
                const nx = baseNx + sepX * dt;
                const ny = baseNy + sepY * dt;

                if (!blocked(nx, ny, target.soft)) {
                    this.group.position.x = nx;
                    this.group.position.y = ny;
                } else if (!wallBlocked(baseNx, baseNy, 3.5)) {
                    this.group.position.x = baseNx;
                    this.group.position.y = baseNy;
                } else if (!wallBlocked(baseNx, this.group.position.y, 3.5)) {
                    this.group.position.x = baseNx;
                } else if (!wallBlocked(this.group.position.x, baseNy, 3.5)) {
                    this.group.position.y = baseNy;
                }
                this.faceDirection(ang);
            }
        } else if (this.idleBehavior === 'assembly') {
            // 1.4 ยืนรอลานรวมพล: สุ่มโบกมือ เต้นออกกำลังกาย เชียร์ และหันหน้าทักทายเพื่อนข้างเคียง
            this.idleCycleTimer -= dt;
            if (this.idleCycleTimer <= 0) {
                this.idleCycleTimer = rand(3.8, 8.0);
                const pickAnim = pick(['Wave', 'Dance', 'Cheer', 'Talk', 'LookAround', 'Idle']);
                this.playAnim(pickAnim);
                if (Math.random() < 0.12 && this.speechTimer <= 0) {
                    const line = (pickAnim === 'Dance' || pickAnim === 'Cheer')
                        ? pick(DIALOGUE_SCRIPTS.assemblyDance)
                        : pick(DIALOGUE_SCRIPTS.assemblyGreeting);
                    this.say(line, 2.5, 'ลานรวมพล');
                }
            }
        } else if (this.idleBehavior === 'work') {
            this.idleCycleTimer -= dt;
            if (this.idleCycleTimer <= 0) {
                this.idleCycleTimer = rand(10.0, 20.0);
                const base = this.workDefaultAnim || 'UseComputer';
                const isSeatedPost = (base === 'Sit' || base === 'UseComputer');
                this.playAnim(isSeatedPost ? 'Sit' : (Math.random() < 0.78 ? base : 'Talk'));
                // สุ่มพูดคุยเรื่องงานตามบทบาทของบุคลากรทางการแพทย์เป็นครั้งคราว
                if (Math.random() < 0.08 && this.speechTimer <= 0) {
                    const pool = DIALOGUE_SCRIPTS.staffWorkMonologue[this.role];
                    if (pool && pool.length) this.say(pick(pool), 2.6, this.dept);
                }
            }
        } else if (this.idleBehavior === 'security_guard') {
            this.idleCycleTimer -= dt;
            if (this.idleCycleTimer <= 0) {
                this.idleCycleTimer = rand(5.5, 11.0);
                const pickAnim = pick(['Idle', 'LookAround', 'Wave', 'Stand']);
                this.faceDirection(FACE.S);
                this.playAnim(pickAnim);
                if (Math.random() < 0.22 && this.speechTimer <= 0) {
                    const pool = DIALOGUE_SCRIPTS.staffWorkMonologue.security;
                    if (pool && pool.length) this.say(pick(pool), 2.8, 'ประตูทางเข้าหลัก');
                }
            }
        }

        // หมุนและขยับเพชร 3 มิติ (ตัวละครที่ Login) และวงแหวนโดนัทสีทอง (ผู้ป่วยที่เสียชีวิต)
        if (this.diamondMesh) {
            const isLying = (this.animState === 'LieBed' || this.animState === 'Stretcher');
            this.diamondMesh.rotation.z += dt * 2.2;
            this.diamondMesh.position.set(0, isLying ? 26 : 0, (isLying ? 50 : 92) + Math.sin(simTime * 3.5) * 3.5);
        }
        if (this.haloMesh) {
            const isLying = (this.animState === 'LieBed' || this.animState === 'Stretcher');
            this.haloMesh.position.y = isLying ? 26 : 0;
            this.haloMesh.position.z = (isLying ? 44 : 82) + Math.sin(simTime * 2.6) * 2.0;
            this.haloMesh.rotation.z += dt * 1.2;
        }

        // 2. ปิดเงาสำหรับตัวละครที่อยู่ไกลกล้อง (Shadow Optimization) ตรวจสอบทุก ~0.35 วินาที
        this.shadowCheckTimer -= dt;
        if (this.shadowCheckTimer <= 0) {
            this.shadowCheckTimer = 0.35;
            const dx = this.group.position.x - camera.position.x;
            const dy = this.group.position.y - camera.position.y;
            const dz = this.group.position.z - camera.position.z;
            const distSq = dx * dx + dy * dy + dz * dz;
            const shouldCast = distSq < 2100 * 2100;
            if (this.shadowsCast !== shouldCast) {
                this.shadowsCast = shouldCast;
                if (this.model) {
                    this.model.traverse(c => {
                        if (c.isMesh) c.castShadow = shouldCast;
                    });
                }
            }
        }

        // 3. ลดความถี่ในการอัปเดต NameTag และซ่อนเมื่ออยู่ไกลกล้อง (NameTag Update Throttling)
        if (this.tagEl && labelsVisible) {
            const dx = this.group.position.x - camera.position.x;
            const dy = this.group.position.y - camera.position.y;
            const dz = this.group.position.z - camera.position.z;
            const distSq = dx * dx + dy * dy + dz * dz;

            const isSpeaking = this.speechTimer > 0;
            const isImportant = this.isYou || isSpeaking;
            const MAX_TAG_DIST_SQ = 2100 * 2100; // ซ่อน NameTag สำหรับตัวละครที่อยู่ไกลเกินระยะ

            if (!isImportant && distSq > MAX_TAG_DIST_SQ) {
                if (this.tagEl.style.display !== 'none') {
                    this.tagEl.style.display = 'none';
                }
            } else {
                // Throttling: อัปเดตทุก 2-3 เฟรม สลับกันตาม charIndex เพื่อลดภาระ Layout Reflow ในเบราว์เซอร์
                const stride = isSpeaking ? 1 : (distSq > 1300 * 1300 ? 3 : 2);
                if ((tagFrameCounter + (this.charIndex || 0)) % stride === 0) {
                    const isLying = (this.animState === 'LieBed' || this.animState === 'Stretcher');
                    _tagProjVec.set(
                        this.group.position.x,
                        isLying ? (this.group.position.y + 24) : this.group.position.y,
                        isLying ? 50 : 92
                    );
                    _tagProjVec.project(camera);

                    if (_tagProjVec.z > 1 || _tagProjVec.x < -1.15 || _tagProjVec.x > 1.15 || _tagProjVec.y < -1.15 || _tagProjVec.y > 1.15) {
                        if (this.tagEl.style.display !== 'none') this.tagEl.style.display = 'none';
                    } else {
                        const sx = Math.round((_tagProjVec.x * 0.5 + 0.5) * window.innerWidth);
                        const sy = Math.round((-_tagProjVec.y * 0.5 + 0.5) * window.innerHeight);
                        if (this.tagEl.style.display !== 'block') this.tagEl.style.display = 'block';
                        // ใช้ transform: translate3d ทำงานบน GPU compositor ไม่ทำให้เกิด Layout Reflow
                        this.tagEl.style.transform = `translate3d(${sx}px, ${sy}px, 0) translate(-50%, -100%)`;
                        this.tagEl.style.left = '0px';
                        this.tagEl.style.top = '0px';
                    }
                }
            }
        }
    }

    destroy() {
        this.active = false;
        scene.remove(this.group);
        if (this.tagEl) this.tagEl.remove();
        if (this.mixer) {
            const idx = activeMixers.indexOf(this.mixer);
            if (idx !== -1) activeMixers.splice(idx, 1);
        }
        const ci = allCharacters.indexOf(this);
        if (ci !== -1) allCharacters.splice(ci, 1);
    }
}


// ================= 7. Staff & Morning Assembly Manager (1. ลานรวมพลเจ้าหน้าที่ + เต้นและทักทาย) =================
const CharacterManager = {
    staffList: [],
    securityGuard: null,
    assemblyPhase: 'IDLE',
    assemblyRunId: 0,

    // สร้างเจ้าหน้าที่ รปภ. (Security_Male_01) ยืนประจำการข้างประตูทางเข้าหลัก ด้านซ้าย 1 คน
    spawnEntranceSecurityGuard() {
        if (this.securityGuard) {
            this.securityGuard.destroy();
            this.securityGuard = null;
        }
        const guard = new SimCharacter({
            id: 'security_entrance_left_01',
            name: 'รปภ.สมศักดิ์ (รักษาความปลอดภัย)',
            role: 'security',
            dept: 'รปภ. ประตูทางเข้า',
            gender: 'ชาย',
            modelPath: './models/humen/Security personnel/Security_Male_01.glb',
            x: -135,
            y: -828,
            startNode: 'N_OUT_MAIN',
            isStaff: true,
            speed: 120,
            face: FACE.S,
            stateText: 'ยืนประจำการหน้าประตูทางเข้า (ด้านซ้าย)'
        });
        guard.workDefaultAnim = 'Stand';
        guard.idleBehavior = 'security_guard';
        guard.faceDirection(FACE.S);
        guard.loadModel().then(() => {
            if (guard.active) {
                guard.faceDirection(FACE.S);
                guard.playAnim('LookAround');
            }
        });
        this.securityGuard = guard;
        return guard;
    },

    NPC_NAMES: {
        doctor: ['นพ.กิตติพงศ์(NPC)', 'พญ.พิมพ์ชนก(NPC)', 'นพ.ธนภัทร(NPC)', 'พญ.ชลธิชา(NPC)', 'นพ.ศุภกร(NPC)', 'นพ.วรเมธ(NPC)'],
        nurse: ['พยบ.กมลวรรณ(NPC)', 'พยบ.สุภาพร(NPC)', 'พยบ.นภัสสร(NPC)', 'พยบ.อารยา(NPC)', 'พยบ.ปิยะดา(NPC)', 'พยบ.จิราภรณ์(NPC)', 'พยบ.ชนิดา(NPC)', 'พยบ.รัตนา(NPC)', 'พยบ.วริศรา(NPC)', 'พยบ.มณีรัตน์(NPC)'],
        registrar: ['จนท.สมชาย (NPC บัตร)', 'จนท.วิภาวี (NPC บัตร)'],
        pharmacist: ['ภก.ณัฐวุฒิ(NPC)', 'ภญ.แพรวพรรณ(NPC)'],
        dentist: ['ทพ.ปริญญา(NPC)', 'ทพญ.สิริมา(NPC)', 'ทพ.ธีรเดช(NPC)'],
        thaimed: ['พท.บุญเลิศ(NPC)', 'พท.กัญญา(NPC)', 'พท.สมศรี(NPC)'],
        physio: ['กภ.ภาคภูมิ(NPC)', 'กภ.นฤมล(NPC)', 'กภ.อานนท์(NPC)'],
        lab: ['ทนพ.วีระชัย(NPC)', 'ทนพญ.ศศิธร(NPC)'],
        radiology: ['รท.เกรียงไกร (NPC X-ray)'],
        finance: ['จนท.สุนิสา (NPC การเงิน)', 'จนท.ปวีณา (NPC การเงิน)'],
        support: ['จนท.ประเสริฐ (NPC สนับสนุน)'],
        porter: ['จนท.สมพร (NPC เปล ER 1)', 'จนท.สมคิด (NPC เปล ER 2)']
    },

    buildDefaultRoster(externalStaff = []) {
        const posts = HospitalEnvironment.staffPosts;
        const sortedExt = [...externalStaff].sort((a, b) => (b?.isYou ? 1 : 0) - (a?.isYou ? 1 : 0));
        const hasExplicitYou = sortedExt.some(e => e && e.isYou);
        return posts.map((post, idx) => {
            const ext = sortedExt[idx] || null;
            const role = post.role;
            const gender = ext?.gender || (idx % 2 === 0 ? 'หญิง' : 'ชาย');
            const pool = this.NPC_NAMES[role] || ['NPC เจ้าหน้าที่ รพ.'];
            const isNPC = !ext || (!ext.name && !ext.userId);
            const name = ext?.name || pool[idx % pool.length];
            const isYou = hasExplicitYou ? !!ext?.isYou : (idx === 0);
            return {
                id: ext?.userId || (isNPC ? `npc_${idx + 1}` : `staff_${idx + 1}`),
                userId: ext?.userId || null,
                name, role, gender, isYou, isNPC,
                dept: post.dept,
                postPos: post.pos,
                postFace: post.face,
                workAnim: post.anim || 'UseComputer',
                assemblySlot: HospitalEnvironment.assemblySlots[idx % HospitalEnvironment.assemblySlots.length]
            };
        });
    },

    // อัปเดตข้อมูลเวรเจ้าหน้าที่รอบ 1 ชั่วโมง (รันต่อเนื่อง ไม่เรียกรวมพลใหม่)
    // 1. เจ้าหน้าที่ที่ไม่มีในเวรใหม่: แจ้งหมดเวร เลิกงาน เดินกลับบ้าน
    // 2. เจ้าหน้าที่เพิ่มมาใหม่: เดินทางเข้ามาในโรงพยาบาล ไปทำหน้าที่แทน NPC ที่ประจำจุดอยู่เดิม
    async updateStaffRoster(newExternalStaff = []) {
        if (!Array.isArray(newExternalStaff)) newExternalStaff = [];
        const hasExplicitYou = newExternalStaff.some(e => e && e.isYou);
        const incomingExt = newExternalStaff.map((ext, idx) => ({
            userId: ext.userId || ext.id || `ext_${idx + 1}`,
            name: ext.name || `เจ้าหน้าที่เข้าเวร ${idx + 1}`,
            role: ext.role || 'nurse',
            dept: ext.dept || '',
            gender: ext.gender || (idx % 2 === 0 ? 'หญิง' : 'ชาย'),
            isYou: hasExplicitYou ? !!ext.isYou : false
        }));

        // 1. ตรวจสอบเจ้าหน้าที่จริงปัจจุบันที่ไม่มีในรายชื่อใหม่ -> เลิกงาน เดินกลับบ้าน
        const activeRealStaff = this.staffList.filter(s => s.active && s.rosterInfo && !s.rosterInfo.isNPC);
        for (const currentStaff of activeRealStaff) {
            const stillInShift = incomingExt.some(e =>
                (currentStaff.rosterInfo.userId && e.userId === currentStaff.rosterInfo.userId) ||
                (e.name && e.name === currentStaff.rosterInfo.name)
            );
            if (!stillInShift) {
                currentStaff.say(`หมดเวลาเข้าเวรแล้ว ขอตัวส่งมอบเวรและเดินทางกลับบ้านก่อนนะครับ/ค่ะ`, 3.0, currentStaff.rosterInfo.dept);
                const post = currentStaff.rosterInfo;
                // สร้าง NPC มารับช่วงประจำจุดแทนชั่วคราว เพื่อไม่ให้จุดบริการหยุดชะงัก
                this.spawnNPCReplacementForPost(post);
                // เดินออกจาก รพ.
                this.retireStaff(currentStaff);
            }
        }

        // 2. ตรวจสอบเจ้าหน้าที่ใหม่ที่เพิ่มเข้ามา -> เดินเข้ามาทำหน้าที่แทน NPC
        for (const ext of incomingExt) {
            const alreadyActive = this.staffList.some(s =>
                s.active && s.rosterInfo && (
                    (s.rosterInfo.userId && s.rosterInfo.userId === ext.userId) ||
                    (s.rosterInfo.name && s.rosterInfo.name === ext.name)
                )
            );
            if (alreadyActive) continue; // อยู่ในเวรทำงานต่อเนื่องอยู่แล้ว

            // หาตำแหน่งที่เหมาะสมสำหรับเจ้าหน้าที่ใหม่ (จับคู่ตาม dept หรือ role ที่มี NPC ทำหน้าที่อยู่)
            let targetNPC = this.staffList.find(s =>
                s.active && s.rosterInfo && s.rosterInfo.isNPC && s.rosterInfo.dept === ext.dept
            );
            if (!targetNPC && ext.role) {
                targetNPC = this.staffList.find(s =>
                    s.active && s.rosterInfo && s.rosterInfo.isNPC && s.rosterInfo.role === ext.role
                );
            }
            if (!targetNPC) {
                targetNPC = this.staffList.find(s => s.active && s.rosterInfo && s.rosterInfo.isNPC);
            }

            const post = targetNPC ? targetNPC.rosterInfo : (HospitalEnvironment.staffPosts.find(p => p.role === ext.role) || HospitalEnvironment.staffPosts[0]);

            const newRosterInfo = {
                id: ext.userId,
                userId: ext.userId,
                name: ext.name,
                role: post.role || ext.role || 'nurse',
                gender: ext.gender,
                isYou: ext.isYou,
                isNPC: false,
                dept: post.dept,
                postPos: post.pos || post.postPos,
                postFace: post.face || post.postFace || FACE.S,
                workAnim: post.anim || post.workAnim || 'UseComputer'
            };

            const spawnX = -1350 + Math.random() * 60;
            const newChar = new SimCharacter({
                id: ext.userId,
                name: ext.name,
                role: newRosterInfo.role,
                dept: newRosterInfo.dept,
                gender: newRosterInfo.gender,
                isStaff: true,
                isYou: ext.isYou,
                x: spawnX,
                y: -1250,
                startNode: 'N_SPAWN_W',
                speed: 135,
                stateText: `เดินทางมาเข้าเวรใหม่ (${newRosterInfo.dept})`
            });
            newChar.rosterInfo = newRosterInfo;
            newChar.workDefaultAnim = newRosterInfo.workAnim;
            this.staffList.push(newChar);

            (async () => {
                try { await newChar.loadModel(); } catch (e) { console.warn(e); }
                const targetNode = CharacterManager.resolveStaffTargetNode(newRosterInfo);
                await newChar.walkToNode('N_OUT_MAIN', null, null, 'Walk');
                await newChar.walkToNode('N_DOOR_MAIN', null, null, 'Walk');
                await newChar.walkToNode(targetNode, newRosterInfo.postPos, newRosterInfo.postFace, 'Walk');
                if (!newChar.active) return;

                // เมื่อเจ้าหน้าที่ใหม่เดินมาถึงโต๊ะ/จุดประจำการ ทำหน้าที่แทน NPC
                if (targetNPC && targetNPC.active) {
                    targetNPC.say(`คุณ ${newChar.name} มาเข้าเวรแล้ว เดี๋ยวผม/ดิฉันส่งมอบเวรให้นะครับ/ค่ะ`, 2.8, newRosterInfo.dept);
                    await sleep(1.2);
                    CharacterManager.retireStaff(targetNPC);
                }
                newChar.faceDirection(newRosterInfo.postFace);
                newChar.idleBehavior = 'work';
                newChar.say(`เข้าเวรประจำแผนก ${newRosterInfo.dept} เรียบร้อยครับ/ค่ะ พร้อมให้บริการ`, 2.8, newRosterInfo.dept);
                newChar.setState(`ปฏิบัติหน้าที่ (${newRosterInfo.dept})`, newRosterInfo.workAnim);
                CharacterManager.bindStaffToStationSlots();
                setText('board-staff-active', CharacterManager.staffList.filter(c => c.active).length + 1);
            })();
        }

        setText('board-staff-total', newExternalStaff.length > 0 ? (newExternalStaff.length + 1) : (this.staffList.filter(c => c.active).length + 1));
        DialogueManager.logToFeed(
            'บริหารเวร', 'รอบ 1 ชม.',
            `🔄 ผลัดเปลี่ยนเวรเจ้าหน้าที่รอบ 1 ชม. เรียบร้อย (รันต่อเนื่อง ไม่เรียกรวมพลใหม่)`,
            'ระบบอัตโนมัติ'
        );
    },

    spawnNPCReplacementForPost(post) {
        const role = post.role;
        const defaultPool = this.NPC_NAMES[role] || ['NPC เจ้าหน้าที่ รพ.'];
        const npcName = pick(defaultPool);
        const gender = post.gender || (Math.random() < 0.5 ? 'หญิง' : 'ชาย');
        const npcId = `npc_${post.role}_${Date.now()}_${Math.floor(Math.random() * 1000)}`;

        const rInfo = Object.assign({}, post, {
            id: npcId,
            userId: null,
            name: npcName,
            isNPC: true,
            isYou: false
        });

        const npc = new SimCharacter({
            id: npcId,
            name: npcName,
            role: post.role,
            dept: post.dept,
            gender: gender,
            isStaff: true,
            isYou: false,
            x: -1360 + Math.random() * 50,
            y: -1250,
            startNode: 'N_SPAWN_W',
            speed: 130,
            stateText: `เดินทางมารับเวรแทน (${post.dept})`
        });
        npc.rosterInfo = rInfo;
        npc.workDefaultAnim = post.workAnim || 'UseComputer';
        this.staffList.push(npc);

        (async () => {
            try { await npc.loadModel(); } catch {}
            const targetNode = CharacterManager.resolveStaffTargetNode(rInfo);
            await npc.walkToNode('N_OUT_MAIN', null, null, 'Walk');
            await npc.walkToNode('N_DOOR_MAIN', null, null, 'Walk');
            await npc.walkToNode(targetNode, post.postPos || post.pos, post.postFace || post.face, 'Walk');
            if (!npc.active) return;
            npc.faceDirection(post.postFace || post.face);
            npc.idleBehavior = 'work';
            npc.say(`มารับช่วงเวรประจำแผนก ${post.dept} แทนเรียบร้อยครับ/ค่ะ`, 2.5, post.dept);
            npc.setState(`ปฏิบัติหน้าที่ (${post.dept})`, post.workAnim);
            CharacterManager.bindStaffToStationSlots();
            setText('board-staff-active', CharacterManager.staffList.filter(c => c.active).length + 1);
        })();
    },

    retireStaff(staffChar) {
        staffChar.idleBehavior = null;
        staffChar.setState('หมดเวร/ส่งเวรเสร็จ เดินทางกลับบ้าน', 'Walk');
        for (const st of Object.values(STATIONS)) {
            for (const slot of st.slots) {
                if (slot.staffRef === staffChar) slot.staffRef = null;
            }
        }
        (async () => {
            await staffChar.walkToNode('N_DOOR_MAIN', null, null, 'Walk');
            await staffChar.walkToNode('N_EXIT', [rand(320, 520), -1260], FACE.S, 'Walk');
            const idx = CharacterManager.staffList.indexOf(staffChar);
            if (idx !== -1) CharacterManager.staffList.splice(idx, 1);
            staffChar.destroy();
            setText('board-staff-active', CharacterManager.staffList.filter(c => c.active).length + 1);
        })();
    },

    bindStaffToStationSlots() {
        for (const st of Object.values(STATIONS)) {
            for (const slot of st.slots) {
                if (!slot.staffPos) continue;
                const found = this.staffList.find(s =>
                    Math.hypot(s.rosterInfo.postPos[0] - slot.staffPos[0], s.rosterInfo.postPos[1] - slot.staffPos[1]) < 25
                );
                if (found) slot.staffRef = found;
            }
        }
    },

    // สถานะ: เจ้าหน้าที่ทุกโซนเข้าประจำจุดครบแล้วหรือยัง (ถ้ายังไม่ครบ จะยังไม่ปล่อยผู้มารับบริการเข้ามา)
    allStaffReady: false,

    // ลำดับโซนที่เจ้าหน้าที่มารวมพล -> เข้าแถว -> เดินเข้าประจำการ ทีละโซน (ลดภาระโหลดโมเดล/คำนวณเส้นทางพร้อมกัน)
    STAFF_ZONE_GROUPS: [
        { label: 'โซน 2-3 คัดกรอง & ห้องบัตร', match: r => r.dept.includes('คัดกรอง') || r.role === 'registrar' },
        { label: 'โซน 4.1 พยาบาลซักประวัติ OPD', match: r => r.dept.includes('ซักประวัติ') },
        { label: 'โซน 4.2 แพทย์ห้องตรวจ OPD', match: r => r.dept.includes('ห้องตรวจ') },
        { label: 'โซน 5 แผนกฉุกเฉิน ER', match: r => r.dept.includes('ER') || r.dept.includes('ฉุกเฉิน') },
        { label: 'โซน 6 หอผู้ป่วยใน IPD', match: r => r.dept.includes('ผู้ป่วยใน') },
        { label: 'โซน 7-9 ทันตกรรม / แผนไทย / กายภาพ', match: r => ['dentist', 'thaimed', 'physio'].includes(r.role) },
        { label: 'โซน 10-14 LAB / X-ray / ห้องยา / การเงิน / สนับสนุน', match: () => true }
    ],

    groupRosterByZone(roster) {
        const groups = this.STAFF_ZONE_GROUPS.map(g => ({ label: g.label, members: [] }));
        roster.forEach(r => {
            const gi = this.STAFF_ZONE_GROUPS.findIndex(g => g.match(r));
            groups[gi < 0 ? groups.length - 1 : gi].members.push(r);
        });
        return groups.filter(g => g.members.length > 0);
    },

    async spawnAllStaffAndStartAssembly(externalStaff = []) {
        const runId = ++this.assemblyRunId;
        this.allStaffReady = false;
        this.staffList.forEach(s => s.destroy());
        this.staffList = [];

        const roster = this.buildDefaultRoster(externalStaff);
        this.spawnEntranceSecurityGuard();
        setText('board-staff-active', 1);
        if (externalStaff.length > 0) setText('board-staff-total', externalStaff.length + 1);
        else setText('board-staff-total', roster.length + 1);

        const zoneGroups = this.groupRosterByZone(roster);
        await this.runMorningAssemblySequence(runId, zoneGroups);
    },

    // สร้างเจ้าหน้าที่เฉพาะโซนนั้น โหลดโมเดลทีละคน (เว้นจังหวะเล็กน้อย) เพื่อไม่ให้ clone/AnimationMixer พร้อมกันจนกระตุก
    async spawnZoneStaff(group, groupIdx, runId) {
        const spawned = [];
        // สลับใช้แถวหน้า/แถวหลังของลานรวมพล เพื่อให้โซนถัดไปเข้าแถวได้ขณะโซนก่อนหน้ากำลังเดินออก
        const slotBase = (groupIdx % 2) * 16;
        for (let i = 0; i < group.members.length; i++) {
            if (runId !== this.assemblyRunId) return spawned;
            const r = group.members[i];
            r.assemblySlot = HospitalEnvironment.assemblySlots[(slotBase + i) % HospitalEnvironment.assemblySlots.length];
            const ch = new SimCharacter({
                id: r.id, name: r.name, role: r.role, dept: r.dept, gender: r.gender,
                isYou: r.isYou,
                x: -1380 + (i % 4) * 50, y: -1260 - Math.floor(i / 4) * 30,
                startNode: 'N_SPAWN_W', isStaff: true, speed: 135,
                stateText: `เดินทางมาลานรวมพล (${group.label})`
            });
            ch.rosterInfo = r;
            ch.workDefaultAnim = r.workAnim;
            this.staffList.push(ch);
            spawned.push(ch);
            try { await ch.loadModel(); } catch (e) { console.warn('staff model load failed', e); }
            setText('board-staff-active', this.staffList.length + 1);
            await sleep(0.12);
        }
        this.bindStaffToStationSlots();
        return spawned;
    },

    // โซนเดินเข้าอาคารไปยังจุดประจำการของตนเอง
    async enterZoneToPosts(members, runId) {
        await Promise.all(members.map(async (ch, idx) => {
            await sleep(idx * 0.3);
            if (runId !== this.assemblyRunId || !ch.active) return;
            ch.idleBehavior = null;
            ch.currentNode = 'N_ASSEMBLY_EXIT';
            ch.setState(`เดินเข้าประจำแผนก (${ch.dept})`, 'Walk');
            const targetNode = this.resolveStaffTargetNode(ch.rosterInfo);
            await ch.walkToNode(targetNode, ch.rosterInfo.postPos, ch.rosterInfo.postFace, 'Walk');
            if (runId !== this.assemblyRunId || !ch.active) return;
            // เมื่อถึงตำแหน่ง เปลี่ยนเป็น Animation ประจำหน้าที่
            ch.faceDirection(ch.rosterInfo.postFace);
            ch.idleBehavior = 'work';
            ch.setState(`ปฏิบัติหน้าที่ (${ch.dept})`, ch.rosterInfo.workAnim);
        }));
    },

    async runMorningAssemblySequence(runId, zoneGroups) {
        const setPhase = txt => {
            this.assemblyPhase = txt;
            setText('assembly-phase-badge', txt);
        };
        const total = zoneGroups.length;
        const entryTasks = [];

        for (let gi = 0; gi < total; gi++) {
            if (runId !== this.assemblyRunId) return;
            const group = zoneGroups[gi];
            const tag = `[${gi + 1}/${total}] ${group.label}`;

            // ขั้นที่ 1: เจ้าหน้าที่ของโซนนี้เดินทางมาถึง (สร้างและโหลดโมเดลเฉพาะโซนนี้)
            setPhase(`1. เจ้าหน้าที่เดินทางมา ${tag}`);
            const members = await this.spawnZoneStaff(group, gi, runId);
            if (runId !== this.assemblyRunId) return;

            // ขั้นที่ 2: เดินเข้าแถว ณ ลานรวมพล
            setPhase(`2. เข้าแถวลานรวมพล ${tag}`);
            await Promise.all(members.map(async (ch, idx) => {
                await sleep(idx * 0.15);
                if (runId !== this.assemblyRunId || !ch.active) return;
                const slot = ch.rosterInfo.assemblySlot;
                ch.setState('เดินเข้าแถวลานรวมพล', 'Walk');
                await ch.walkToNode('N_ASSEMBLY_ENTRY', slot.pos, slot.face, 'Walk');
                if (runId !== this.assemblyRunId || !ch.active) return;
                ch.faceDirection(FACE.S);
                ch.idleBehavior = 'assembly';
                ch.idleCycleTimer = rand(0.5, 3.2);
                ch.setState('เข้าแถวรวมพล', 'Idle');
            }));
            if (runId !== this.assemblyRunId) return;

            // ขั้นที่ 3: ทักทายเพื่อนร่วมโซน + เชียร์ปลุกพลังสั้นๆ
            setPhase(`3. ทักทาย & เชียร์ยามเช้า ${tag} 💃`);
            members.forEach((ch, idx) => {
                if (!ch.active) return;
                ch.faceDirection(idx % 2 === 0 ? FACE.E : FACE.W);
                ch.setState('ทักทายเพื่อนร่วมงาน', idx % 3 === 0 ? 'Cheer' : (idx % 2 === 0 ? 'Wave' : 'Dance'));
                if (idx === 0) ch.say(pick(DIALOGUE_SCRIPTS.assemblyGreeting), 2.4, group.label);
            });
            await sleep(2.2);
            if (runId !== this.assemblyRunId) return;
            members.forEach(ch => ch.active && ch.faceDirection(FACE.S));

            // ขั้นที่ 4: โซนนี้เดินเข้าโรงพยาบาลไปประจำจุด (ไม่ต้องรอถึงจุด — โซนถัดไปเริ่มมาได้เลย เพื่อให้เดินพร้อมกันแค่ไม่กี่คน)
            setPhase(`4. เดินเข้าประจำจุด ${tag}`);
            entryTasks.push(this.enterZoneToPosts(members, runId));
            await sleep(1.6);
        }

        // รอให้ทุกโซนเดินถึงจุดประจำการครบก่อน
        setPhase('5. รอเจ้าหน้าที่ทุกโซนเข้าประจำจุด...');
        await Promise.all(entryTasks);
        if (runId !== this.assemblyRunId) return;

        this.allStaffReady = true;
        setPhase('✅ เจ้าหน้าที่ประจำครบทุกโซน - เปิดรับผู้มารับบริการ');
        if (typeof PatientFlowManager !== 'undefined') PatientFlowManager.startServiceOpening();
    },

    // กดปุ่มให้เจ้าหน้าที่ที่ลานรวมพล (หรือทุกคน) เต้นและทักทายกันทันที
    triggerDanceParty() {
        this.staffList.forEach((ch, idx) => {
            const anim = idx % 3 === 0 ? 'Cheer' : (idx % 2 === 0 ? 'Dance' : 'Wave');
            ch.playAnim(anim);
            if (idx % 4 === 0) {
                ch.say(pick(DIALOGUE_SCRIPTS.assemblyDance), 3.4, 'กิจกรรมรวมพล');
            }
        });
    },

    resolveStaffTargetNode(r) {
        if (r.dept.includes('คัดกรอง')) return 'N_SCREEN';
        if (r.role === 'registrar') return 'N_REG';
        if (r.dept.includes('ซักประวัติ')) return 'N_OPD_HALL';
        if (r.dept.includes('ห้องตรวจ')) {
            const m = r.dept.match(/(\d+)/);
            const num = m ? Number(m[1]) : 3;
            return `N_DOC_IN_${num}`;
        }
        if (r.dept.includes('คัดแยก ER')) return 'N_ER';
        if (r.dept.includes('ER') || r.dept.includes('ฉุกเฉิน')) return 'N_ER_BEDS';
        if (r.dept.includes('ผู้ป่วยใน')) return 'N_IPD';
        if (r.role === 'dentist') return 'N_DENTAL';
        if (r.role === 'thaimed') return 'N_THAIMED';
        if (r.role === 'physio') return 'N_PHYSIO';
        if (r.role === 'lab') return 'N_LAB';
        if (r.role === 'radiology') return 'N_XRAY';
        if (r.role === 'pharmacist') return 'N_PHARMACY';
        if (r.role === 'finance') return 'N_FINANCE';
        return 'N_STAFF_LOUNGE';
    }
};

// ================= 8. PatientFlowManager & HospitalDashboard (พร้อมบทสนทนาครบทุกจุดบริการ) =================
const PATIENT_SYMPTOM_STORIES = {
    OPD: [
        'ปวดศีรษะและมีไข้ต่ำๆ มา 2 วัน',
        'ตรวจติดตามความดันโลหิตและเบาหวานตามนัด',
        'ไอเจ็บคอและมีน้ำมูกใส',
        'จุกแน่นลิ้นปี่หลังรับประทานอาหาร',
        'เวียนศีรษะบ้านหมุนเวลาลุกนั่ง'
    ],
    DENTAL: [
        'ปวดฟันกรามซ้ายและเสียวฟันเวลาเคี้ยวอาหาร',
        'มาขูดหินปูนและตรวจสุขภาพช่องปากประจำปี',
        'วัสดุอุดฟันหลุดต้องการอุดฟันใหม่'
    ],
    THAIMED: [
        'ปวดตึงคอ บ่า ไหล่ จากการนั่งทำงานนานๆ',
        'ปวดเมื่อยกล้ามเนื้อหลังส่วนล่างเรื้อรัง',
        'ต้องการนวดกดจุดและประคบสมุนไพรคลายเส้น'
    ],
    PHYSIO: [
        'ปวดข้อเข่าขวาเดินลงน้ำหนักลำบาก',
        'ไหล่ติดยกแขนได้ไม่สุด มาทำกายภาพฟื้นฟู',
        'ฝึกเดินบนราวคู่และบริหารกล้ามเนื้อขา'
    ],
    ER: [
        'แน่นหน้าอกหายใจเหนื่อยเฉียบพลัน',
        'อุบัติเหตุมีแผลฉีกขาดและปวดแขนมาก',
        'ไข้สูงหนาวสั่นและอ่อนเพลียมาก'
    ]
};

// จัดรูปแบบข้อความทางคลินิกจากระบบ HIS (CC/PI/PH/PE/BODY/VS) ให้สั้นกระชับสำหรับบอลลูนสนทนา
function clinTxt(v, max = 110) {
    let t = String(v ?? '').replace(/\s+/g, ' ').trim();
    if (!t || t.toLowerCase() === 'null' || t === '-') return '';
    if (/^wnl\.?$/i.test(t)) t = 'ปกติ (WNL)';
    return t.length > max ? t.slice(0, max) + '…' : t;
}

const PatientFlowManager = {
    patients: [],
    externalQueue: [],
    dbSummary: null,
    stats: {
        waiting: 0,
        treating: 0,
        admit: 0,
        refer: 0,
        discharge: 0,
        death: 0
    },
    maxConcurrentPatients: 10, // ผู้มารับบริการในฉากพร้อมกันไม่เกิน 10 คน
    spawnTimer: 1.5,

    syncFromHost(payload) {
        if (!payload) return;
        if (payload.summary) {
            this.dbSummary = {
                waiting: Math.max(0, Number(payload.summary.waiting) || 0),
                discharge: Math.max(0, Number(payload.summary.discharge) || 0),
                death: Math.max(0, Number(payload.summary.death) || 0),
                refer: Math.max(0, Number(payload.summary.refer) || 0),
                admit: Math.max(0, Number(payload.summary.admit) || 0)
            };
        }
        if (Array.isArray(payload.patients) && payload.patients.length > 0) {
            // ใช้รายชื่อผู้ป่วยจริงจากระบบ (ไม่สุ่มสร้างเอง) — คนใหม่ที่เพิ่มมาในระบบจะถูกต่อคิวก่อน และรันต่อเนื่องทันทีโดยไม่ต้องเรียกรวมพลใหม่
            this.realPatients = payload.patients.map((p, i) => Object.assign({}, p, {
                _key: String(p.vn || `${p.fullname || 'pt'}_${i}`)
            }));
            const queued = new Set(this.externalQueue.map(p => p._key));
            let newAdded = 0;
            this.realPatients.forEach(p => {
                if (!this.seenKeys.has(p._key) && !queued.has(p._key)) {
                    this.externalQueue.push(p);
                    newAdded++;
                }
            });
            if (newAdded > 0) {
                DialogueManager.logToFeed(
                    'เวชระเบียน', 'ผู้ป่วยใหม่',
                    `📥 ได้รับข้อมูลผู้มารับบริการจริงชุดใหม่ ${newAdded} ราย (เริ่มรับเข้าสู่ขั้นตอนการตรวจรักษาต่อเนื่อง)`,
                    'ระบบอัตโนมัติ'
                );
                this.spawnTimer = 1.0;
            }
        }
        HospitalDashboard.refresh();
    },

    realPatients: [],
    seenKeys: new Set(),

    // ดึงผู้ป่วยจริงคนถัดไป (เฉพาะคนไข้จริงในคิวเท่านั้น หากหมดแล้วจะไม่สุ่มเองและไม่วนซ้ำ รอจนกว่าจะมีข้อมูลใหม่รอบ 1 ชม.)
    nextRealPatient() {
        while (this.externalQueue.length) {
            const p = this.externalQueue.shift();
            const inScene = this.patients.some(pt => pt.flowData && pt.flowData._key === p._key);
            if (!inScene) {
                this.seenKeys.add(p._key);
                return p;
            }
        }
        return null;
    },

    spawnPatient(forcedMode = null, customData = null) {
        if (this.patients.length >= this.maxConcurrentPatients && !forcedMode) return;

        let d = customData || this.nextRealPatient();
        if (!d) {
            // หากไม่มีคนไข้จริง: ไม่ต้องสุ่มคนไข้มาเอง รอจนกว่าจะครบ 1 ชั่วโมงเมื่อมีข้อมูลคนไข้ใหม่เข้ามา (ยกเว้นกดปุ่มทดสอบ demo)
            if (!forcedMode) return;
            d = this.generateSyntheticPatient(forcedMode);
        } else {
            // เติมค่าเริ่มต้นให้ข้อมูลจากระบบ HIS (CC/PI/PH/PE/BODY/VS)
            d = Object.assign({}, d);
            if (!d.symptomStory) d.symptomStory = clinTxt(d.cc, 90) || 'มาตรวจตามนัด';
            if (!d.clinic) d.clinic = 'OPD';
            if (!d.clinicLabel) d.clinicLabel = d.statusName ? `ผู้ป่วยนอก (${d.statusName})` : 'ผู้ป่วยนอก (OPD)';
            if (d.needLab === undefined) d.needLab = Math.random() < 0.3;
            if (d.needXray === undefined) d.needXray = Math.random() < 0.2;
            if (d.needPay === undefined) d.needPay = true;
            if (d.ageGroup === 'ไม่ทราบอายุ') d.ageGroup = 'วัยทำงาน';
        }
        const isER = forcedMode === 'er' || d.isER || d.status === 'refer' || d.status === 'death';
        const clinicKey = isER ? 'ER' : (d.clinic || 'OPD');
        const symptomStory = d.symptomStory || pick(PATIENT_SYMPTOM_STORIES[clinicKey] || PATIENT_SYMPTOM_STORIES.OPD);

        // สุ่มอัตโนมัติ (Random) ว่าผู้มารับบริการจะเดินเท้ามา รพ. ('walk') หรือมารถมาส่งที่ รพ. ('car')
        const arrivalMode = (d && (d.arrivalMode === 'walk' || d.arrivalMode === 'car'))
            ? d.arrivalMode
            : (Math.random() < 0.25 ? 'car' : 'walk');

        let startX = 0, startY = -1240, startNode = isER ? 'N_OUT_ER' : 'N_OUT_MAIN';
        let dropOffBay = null;

        if (arrivalMode === 'car') {
            dropOffBay = TrafficManager.acquireDropOffBay(isER);
            startX = dropOffBay.x + rand(520, 720);
            startY = -1365;
            startNode = dropOffBay.node;
        } else {
            // เดินเท้ามาตามทางเท้าด้านหน้าโรงพยาบาล (ซ้าย / กลาง / ขวา)
            if (isER) {
                startX = rand(1200, 1420);
                startY = -1240;
                startNode = 'N_SPAWN_E';
            } else {
                const sideRoll = Math.random();
                if (sideRoll < 0.38) {
                    startX = rand(-1360, -960);
                    startNode = 'N_SPAWN_W';
                } else if (sideRoll < 0.76) {
                    startX = rand(760, 1320);
                    startNode = 'N_WALK_E';
                } else {
                    startX = rand(-360, 360);
                    startNode = 'N_WALK_MAIN';
                }
                startY = -1240;
            }
        }

        const arrivalBadge = arrivalMode === 'car' ? '🚗 มารถมาส่ง' : '🚶 เดินเท้ามา รพ.';
        const ageGroup = d.ageGroup || pick(['เด็ก', 'วัยรุ่น', 'วัยทำงาน', 'ชรา']);
        // กำหนดความเร็วการเดินและตัวคูณระยะเวลารับบริการรายบุคคล (แต่ละคนเร็ว/ช้าไม่เท่ากัน ตามวัยและความซับซ้อนของอาการ)
        const baseWalkSpeed = isER
            ? rand(122, 138)
            : (ageGroup === 'ชรา' ? rand(82, 98) : (ageGroup === 'เด็ก' ? rand(95, 112) : rand(98, 124)));
        const paceFactor = (ageGroup === 'ชรา' ? rand(1.15, 1.65) : rand(0.68, 1.48));

        const pat = new SimCharacter({
            name: d.fullname || 'ผู้ป่วยจำลอง',
            role: 'patient',
            dept: isER ? 'ผู้ป่วยฉุกเฉิน' : (d.clinicLabel || 'ผู้ป่วยนอก'),
            gender: d.sex || (Math.random() > 0.5 ? 'ชาย' : 'หญิง'),
            ageGroup,
            symptomStory,
            isDeceased: d.status === 'death',
            x: startX, y: startY,
            startNode,
            isStaff: false,
            speed: baseWalkSpeed,
            stateText: `${arrivalBadge}: ${symptomStory}`
        });
        pat.flowData = Object.assign({ clinic: clinicKey, symptomStory, arrivalMode }, d);
        pat.arrivalMode = arrivalMode;
        pat.dropOffBay = dropOffBay;
        pat.isER = isER;
        pat.paceFactor = paceFactor;
        pat.baseWalkSpeed = baseWalkSpeed;
        pat.useWheelchair = (!isER && ageGroup === 'ชรา' && Math.random() < 0.22);
        pat.useStretcher = isER && Math.random() < 0.55;
        pat.zoneBucket = 'reg';
        if (arrivalMode === 'car') {
            pat.poseGroup.visible = false;
        }
        pat.loadModel();

        this.patients.push(pat);
        setText('board-patient-sim', this.patients.length);

        if (isER) this.runEmergencyJourney(pat);
        else this.runStandardJourney(pat);
    },

    // คำนวณเวลารอ/ทำกิจกรรมในแต่ละโซนให้แตกต่างกันตามตัวบุคคล (บางคนเร็ว บางคนช้า เหมือนสถานการณ์จริง)
    patWait(pat, minSec, maxSec) {
        const pf = (pat && pat.paceFactor) ? pat.paceFactor : 1.0;
        const individualJitter = rand(0.82, 1.28);
        return sleep(rand(minSec, maxSec) * pf * individualJitter);
    },

    generateSyntheticPatient(forcedMode) {
        const clinics = [
            { key: 'OPD', label: 'ผู้ป่วยนอก (OPD)', weight: 50 },
            { key: 'DENTAL', label: 'ทันตกรรม', weight: 15 },
            { key: 'THAIMED', label: 'แพทย์แผนไทย', weight: 15 },
            { key: 'PHYSIO', label: 'กายภาพบำบัด', weight: 12 },
            { key: 'ER', label: 'ฉุกเฉิน (ER)', weight: 8 }
        ];
        let chosen = clinics[0];
        if (forcedMode === 'er') chosen = clinics[4];
        else {
            let r = Math.random() * 100;
            for (const c of clinics) { if (r < c.weight) { chosen = c; break; } r -= c.weight; }
        }
        const outcomes = ['discharge', 'discharge', 'discharge', 'admit', 'refer'];
        const sex = Math.random() > 0.5 ? 'ชาย' : 'หญิง';
        const firstM = ['สมศักดิ์', 'วิชัย', 'กิตติ', 'ณรงค์', 'ประภาส', 'ธีรพล', 'อนุชา'];
        const firstF = ['สมหญิง', 'วันเพ็ญ', 'สุนิสา', 'นงลักษณ์', 'กัลยา', 'รัตนา', 'ศิริพร'];
        const symptomStory = pick(PATIENT_SYMPTOM_STORIES[chosen.key] || PATIENT_SYMPTOM_STORIES.OPD);
        return {
            fullname: `${sex === 'ชาย' ? 'นาย' : 'นาง'}${pick(sex === 'ชาย' ? firstM : firstF)} xxx`,
            sex,
            ageGroup: pick(['เด็ก', 'วัยรุ่น', 'วัยทำงาน', 'ชรา']),
            clinic: chosen.key,
            clinicLabel: chosen.label,
            symptomStory,
            isER: chosen.key === 'ER',
            status: chosen.key === 'ER' ? pick(['discharge', 'admit', 'refer', 'death']) : pick(outcomes),
            needLab: Math.random() < 0.45,
            needXray: Math.random() < 0.35,
            needPay: Math.random() < 0.75
        };
    },

    // เส้นทางมาตรฐานของผู้ป่วย 10 ขั้นตอน (แต่ละโซนมีกิจกรรมเฉพาะตัวและใช้เวลาต่อคนไม่เท่ากัน)
    async runStandardJourney(pat) {
        const moveMode = pat.useWheelchair ? 'Wheelchair' : 'Walk';
        const story = pat.symptomStory;
        try {
            this.stats.waiting++;
            HospitalDashboard.refresh();

            // 1. เดินทางมาโรงพยาบาล (เดินเท้ามา รพ. หรือ รถยนต์มาส่งที่จุด Drop-off หน้า รพ.)
            pat.zoneBucket = 'reg';
            if (pat.arrivalMode === 'car') {
                await TrafficManager.deliverPatientByCar(pat, pat.dropOffBay, false);
                if (!pat.active) return;
                pat.setState('1. ลงจากรถที่จุดรับ-ส่ง เดินเข้าโรงพยาบาล', moveMode);
            } else {
                pat.setState('1. เดินเท้ามาโรงพยาบาล (Walk-in)', moveMode);
                if (Math.random() < 0.35) {
                    pat.say(`เดินมาตรวจที่โรงพยาบาล วันนี้มีอาการ${story}ครับ/ค่ะ`, 2.5, 'ทางเดินหน้า รพ.');
                }
            }
            await pat.walkToNode('N_OUT_MAIN', null, null, moveMode);
            await pat.walkToNode('N_DOOR_MAIN', null, null, moveMode);

            // 2. โซนคัดกรอง (Zone 2): สแกนวัดอุณหภูมิ Thermo Scan -> นั่งเก้าอี้คัดกรองและประเมินอาการเบื้องต้น
            pat.setState('2. รอคิวคัดกรองเบื้องต้น', 'Queue');
            await pat.walkToNode('N_SCREEN', null, null, moveMode);
            const scrSlot = await STATIONS.SCREENING.acquire(pat);
            // แวะจุดสแกนวัดอุณหภูมิ (Thermo Scan) ด้านข้างโต๊ะคัดกรองก่อนนั่ง
            const thermoPos = [scrSlot.patientPos[0] + 54, scrSlot.patientPos[1] - 4];
            await pat.walkToNode('N_SCREEN', thermoPos, FACE.N, moveMode);
            pat.setState('2. สแกนวัดอุณหภูมิร่างกาย (Thermo Scan)', 'Idle');
            await this.patWait(pat, 0.7, 1.6);

            await pat.walkToNode('N_SCREEN', scrSlot.patientPos, scrSlot.patientFace, moveMode);
            // บทสนทนาจุดคัดกรองจากข้อมูลจริง: ถามน้ำหนัก/ส่วนสูง (BODY) -> ถามวันนี้เป็นอะไรมา (CC)
            const bodyTxt = clinTxt(pat.flowData.body, 80);
            const ccTxt = clinTxt(pat.flowData.cc, 130) || story;
            pat.setState('2. คัดกรอง: แจ้งน้ำหนัก/ส่วนสูง และอาการสำคัญ (CC)', 'Sit');
            await DialogueManager.scriptedDialogue(pat, scrSlot.staffRef, [
                ['staff', 'สวัสดีค่ะ ขอทราบน้ำหนักและส่วนสูงด้วยนะคะ'],
                ['pat', bodyTxt ? `${bodyTxt} ครับ/ค่ะ` : 'จำไม่ได้ครับ/ค่ะ ขอชั่งน้ำหนักและวัดส่วนสูงตรงนี้เลยนะครับ/คะ'],
                ['staff', 'ขอบคุณค่ะ แล้ววันนี้เป็นอะไรมาคะ'],
                ['pat', ccTxt],
                ['staff', 'รับทราบค่ะ บันทึกอาการสำคัญเรียบร้อย เชิญยื่นบัตรที่ห้องบัตรหรือตู้ Kiosk ได้เลยนะคะ']
            ], '2. จุดคัดกรอง', 'Sit', 'Talk');
            await this.patWait(pat, 0.5, 1.2);
            STATIONS.SCREENING.release(scrSlot);

            // 3. โซนลงทะเบียน (Zone 3): ตู้ Kiosk 3 ตู้ หรือ ห้องบัตรเวชระเบียน (ความเร็วขึ้นกับความคล่องตัว/สิทธิ)
            const useKiosk = Math.random() < 0.58;
            if (useKiosk) {
                pat.setState('3. เดินไปตู้ Kiosk อัตโนมัติ', moveMode);
                await pat.walkToNode('N_KIOSK', null, null, moveMode);
                const kSlot = await STATIONS.KIOSK.acquire(pat);
                const kIdx = kSlot.meta.kioskIdx;
                await pat.walkToNode('N_KIOSK', kSlot.patientPos, kSlot.patientFace, moveMode);
                HospitalEnvironment.setKioskState(kIdx, 'กำลังใช้งาน');
                const slowKioskUser = pat.ageGroup === 'ชรา' || Math.random() < 0.32;
                pat.setState(`3. เสียบบัตรประชาชนและเลือกแผนกที่ Kiosk #${kIdx + 1}`, 'Examine');
                pat.say(
                    slowKioskUser
                        ? `ขออ่านหน้าจอเลือกแผนกที่ตู้ Kiosk #${kIdx + 1} สักครู่นะครับ/คะ`
                        : `เสียบบัตรประชาชน ยืนยันสิทธิที่ตู้ Kiosk #${kIdx + 1}`,
                    2.4, '3.1 ตู้ Kiosk'
                );
                await this.patWait(pat, slowKioskUser ? 1.8 : 0.9, slowKioskUser ? 3.6 : 1.8);
                HospitalEnvironment.setKioskState(kIdx, 'กำลังประมวลผล');
                pat.setState(`3. Kiosk #${kIdx + 1} ตรวจสอบสิทธิและพิมพ์บัตรคิว`, 'Idle');
                await this.patWait(pat, 0.9, 2.2);
                HospitalEnvironment.setKioskState(kIdx, 'เสร็จสิ้น');
                pat.say(`ได้ใบนำทางและบัตรคิวเรียบร้อยแล้ว!`, 2.2, '3.1 ตู้ Kiosk');
                await this.patWait(pat, 0.5, 1.1);
                HospitalEnvironment.setKioskState(kIdx, 'ว่าง');
                STATIONS.KIOSK.release(kSlot);
            } else {
                pat.setState('3. รอคิวห้องบัตรเวชระเบียน', 'Queue');
                await pat.walkToNode('N_REG', null, null, moveMode);
                const regSlot = await STATIONS.REGISTRATION.acquire(pat);
                await pat.walkToNode('N_REG', regSlot.patientPos, regSlot.patientFace, moveMode);
                const isNewPatientReg = Math.random() < 0.35;
                pat.setState(isNewPatientReg ? '3. ทำประวัติผู้ป่วยใหม่/ตรวจสอบเอกสารสิทธิ' : '3. ยื่นบัตรประชาชนยืนยันสิทธิรักษา', 'Sit');
                await DialogueManager.scriptedDialogue(pat, regSlot.staffRef, [
                    ['staff', 'สวัสดีค่ะ ขอบัตรประชาชนด้วยนะคะ วันนี้มาด้วยอาการอะไรคะ'],
                    ['pat', `ยื่นบัตรครับ/ค่ะ ${clinTxt(pat.flowData.cc, 110) || story}`],
                    ['staff', isNewPatientReg
                        ? 'ขอสแกนเอกสารและทำประวัติผู้ป่วยใหม่ในระบบ HIS สักครู่นะคะ'
                        : 'ตรวจสอบสิทธิเรียบร้อยค่ะ นี่ใบนำทางและบัตรคิว เชิญที่แผนกได้เลยนะคะ']
                ], '3. ห้องบัตร', 'Sit', 'UseComputer');
                await this.patWait(pat, isNewPatientReg ? 2.2 : 0.8, isNewPatientReg ? 4.8 : 2.0);
                STATIONS.REGISTRATION.release(regSlot);
            }

            // 4 & 5. แยกตามคลินิกที่ต้องการรับบริการ (แต่ละคลินิกมีขั้นตอนและเวลาเฉพาะตัว)
            const clinic = pat.flowData.clinic || 'OPD';
            this.stats.waiting = Math.max(0, this.stats.waiting - 1);
            this.stats.treating++;
            HospitalDashboard.refresh();

            if (clinic === 'DENTAL') {
                await this.runDentalJourney(pat, moveMode, story);
            } else if (clinic === 'THAIMED') {
                await this.runThaiMedJourney(pat, moveMode, story);
            } else if (clinic === 'PHYSIO') {
                await this.runPhysioJourney(pat, moveMode, story);
            } else {
                // แผนกผู้ป่วยนอก (OPD): ซักประวัติ 5 โต๊ะ -> รอหน้าห้องตรวจ -> เข้าห้องตรวจแพทย์ 5 ห้อง
                pat.zoneBucket = 'opd';
                pat.setState('4. เดินไปจุดซักประวัติ OPD', moveMode);
                await pat.walkToNode('N_OPD_HALL', null, null, moveMode);
                pat.setState('4. นั่งรอเรียกคิวซักประวัติ OPD');
                const triSlot = await STATIONS.OPD_TRIAGE.acquire(pat);
                await pat.walkToNode('N_OPD_HALL', triSlot.patientPos, triSlot.patientFace, moveMode);

                // ขั้นตอน 4.1: พยาบาลขอวัดอุณหภูมิและความดัน -> แจ้งผลการวัด (VS) -> ซักประวัติปัจจุบัน (PI) -> ประวัติในอดีต (PH)
                const vsTxt = clinTxt(pat.flowData.vs, 150);
                const piTxt = clinTxt(pat.flowData.pi, 150);
                const phTxt = clinTxt(pat.flowData.ph, 150);
                pat.setState('4.1 พยาบาลขอวัดอุณหภูมิและความดันโลหิต', 'Sit');
                await DialogueManager.scriptedDialogue(pat, triSlot.staffRef, [
                    ['staff', 'สวัสดีค่ะ ขอวัดอุณหภูมิและความดันโลหิตก่อนนะคะ วางแขนบนเครื่องวัดได้เลยค่ะ'],
                    ['pat', 'ได้ครับ/ค่ะ']
                ], '4.1 ซักประวัติ OPD', 'Sit', 'NurseCare');
                pat.setState('4.1 กำลังวัดอุณหภูมิ ความดันโลหิต และชีพจร', 'Sit');
                await this.patWait(pat, 1.4, 3.0);
                pat.setState('4.1 แจ้งผลสัญญาณชีพ และซักประวัติ (PI / PH)', 'Sit');
                await DialogueManager.scriptedDialogue(pat, triSlot.staffRef, [
                    ['staff', vsTxt ? `วัดเสร็จแล้วค่ะ ผลจากการวัดของคุณคือ ${vsTxt}` : 'วัดเสร็จแล้วค่ะ สัญญาณชีพอยู่ในเกณฑ์ปกตินะคะ'],
                    ['staff', 'อาการที่เป็นอยู่ตอนนี้ เริ่มเป็นตั้งแต่เมื่อไหร่ และเป็นอย่างไรบ้างคะ'],
                    ['pat', piTxt || `${story} ครับ/ค่ะ`],
                    ['staff', 'เคยมีโรคประจำตัว แพ้ยา/อาหาร หรือเคยผ่าตัด เจ็บป่วยอะไรมาก่อนไหมคะ'],
                    ['pat', phTxt || 'ไม่มีโรคประจำตัว ไม่แพ้ยาครับ/ค่ะ'],
                    ['staff', 'บันทึกข้อมูลเรียบร้อยค่ะ เชิญนั่งรอหน้าห้องตรวจแพทย์นะคะ']
                ], '4.1 ซักประวัติ OPD', 'Sit', 'NurseCare');
                STATIONS.OPD_TRIAGE.release(triSlot);

                // ขั้นตอน 5: เข้าห้องตรวจแพทย์ (5 ห้อง) — นั่งซักอาการ -> ขึ้นเตียงตรวจร่างกาย -> กลับมานั่งฟังแผนการรักษา
                pat.setState('5. เดินไปหน้าห้องตรวจแพทย์ OPD', moveMode);
                await pat.walkToNode('N_DOC_CORR', null, null, moveMode);
                pat.setState('5. นั่งรอเรียกคิวหน้าห้องตรวจแพทย์');
                const docSlot = await STATIONS.OPD_DOCTOR.acquire(pat);
                const docNode = `N_DOC_IN_${docSlot.idx + 1}`;
                await pat.walkToNode(docNode, docSlot.patientPos, docSlot.patientFace, moveMode);
                pat.setState(`5. พบแพทย์ห้องตรวจ ${docSlot.idx + 1} ซักถามอาการ`, 'Sit');
                await DialogueManager.scriptedDialogue(pat, docSlot.staffRef, [
                    ['staff', 'สวัสดีครับ วันนี้มีอาการอย่างไรบ้างครับ'],
                    ['pat', `${clinTxt(pat.flowData.cc, 110) || story} ครับ/ค่ะคุณหมอ`],
                    ['staff', 'หมอขอตรวจร่างกายบนเตียงตรวจสักครู่นะครับ']
                ], `4.2 ห้องตรวจแพทย์ ${docSlot.idx + 1}`, 'Sit', 'Talk');
                await this.patWait(pat, 0.6, 1.4);

                // ตรวจร่างกายบนเตียงตรวจ (PE) — บางเคสนอนตรวจ บางเคสนั่งตรวจข้างเตียง
                const peTxt = clinTxt(pat.flowData.pe, 160);
                if (docSlot.examBedPos) {
                    const lieOnExamBed = Math.random() < 0.65;
                    const bedTarget = lieOnExamBed ? [docSlot.rx + 72, 535] : docSlot.examBedPos;
                    pat.setState(`5. ขึ้นเตียงตรวจร่างกาย ห้องตรวจ ${docSlot.idx + 1}`, moveMode);
                    await pat.walkToNode(docNode, bedTarget, FACE.N, moveMode);
                    pat.setState(`5. แพทย์ตรวจร่างกาย (PE) ห้อง ${docSlot.idx + 1}`, lieOnExamBed ? 'LieBed' : 'Examine');
                    if (docSlot.staffRef) {
                        docSlot.staffRef.say('หายใจเข้า-ออกลึกๆ นะครับ หมอขอฟังเสียงปอด หัวใจ และตรวจร่างกายครับ', 2.8, `ห้องตรวจ ${docSlot.idx + 1}`);
                    }
                    await this.patWait(pat, 2.2, 5.4);

                    // กลับมานั่งเก้าอี้หน้าโต๊ะแพทย์เพื่อฟังผลการตรวจร่างกาย
                    await pat.walkToNode(docNode, docSlot.patientPos, docSlot.patientFace, moveMode);
                }
                pat.setState(`5. ฟังผลการตรวจร่างกาย (PE) และแผนการรักษา ห้อง ${docSlot.idx + 1}`, 'Sit');
                await DialogueManager.scriptedDialogue(pat, docSlot.staffRef, [
                    ['staff', peTxt ? `ผลการตรวจร่างกายของคุณคือ ${peTxt}` : 'ผลการตรวจร่างกายโดยรวมปกติดีครับ'],
                    ['staff', 'หมอจะสั่งยาและให้คำแนะนำการดูแลตัวเองนะครับ ถ้าอาการไม่ดีขึ้นให้กลับมาพบหมอครับ'],
                    ['pat', 'ขอบคุณครับ/ค่ะคุณหมอ']
                ], `4.2 ห้องตรวจแพทย์ ${docSlot.idx + 1}`, 'Sit', 'Talk');
                await this.patWait(pat, 0.6, 1.4);
                await pat.walkToNode(`N_DOC_${docSlot.idx + 1}`, null, null, moveMode);
                STATIONS.OPD_DOCTOR.release(docSlot);

                // 6. ส่งตรวจ LAB หรือ X-ray หากแพทย์มีคำสั่ง (แต่ละจุดมีขั้นตอนและเวลาเฉพาะตัว)
                if (pat.flowData.needLab) {
                    pat.zoneBucket = 'diag';
                    pat.setState('6. เดินไปเจาะเลือด/ตรวจวิเคราะห์ที่ห้อง LAB', moveMode);
                    await pat.walkToNode('N_LAB', null, null, moveMode);
                    const labSlot = await STATIONS.LAB.acquire(pat);
                    await pat.walkToNode('N_LAB', labSlot.patientPos, labSlot.patientFace, moveMode);
                    pat.setState('6. ยืนยันตัวตนและเตรียมหลอดเจาะเลือด (LAB)', 'Sit');
                    await this.patWait(pat, 1.0, 2.2);
                    pat.setState('6. นักเทคนิคการแพทย์เจาะเลือดและเก็บสิ่งส่งตรวจ', 'Sit');
                    await DialogueManager.converseAtStation(
                        pat, labSlot.staffRef,
                        `ยื่นใบสั่งเจาะเลือดจากคุณหมอครับ/ค่ะ`,
                        `ขอทวนชื่อ-นามสกุลนะคะ กำมือหลวมๆ เจาะเลือดแป๊บเดียว เดี๋ยวรันเครื่องวิเคราะห์ส่งผลให้คุณหมอค่ะ`,
                        '10. ห้องแล็บ LAB', 'Sit', 'UseComputer'
                    );
                    // บางคนเส้นเลือดหายากหรือเจาะหลายหลอด ใช้เวลากดห้ามเลือดต่างกัน
                    await this.patWait(pat, 1.8, 4.5);
                    STATIONS.LAB.release(labSlot);
                }
                if (pat.flowData.needXray) {
                    pat.zoneBucket = 'diag';
                    pat.setState('6. เดินไปแผนกเอกซเรย์ (X-ray)', moveMode);
                    await pat.walkToNode('N_XRAY', null, null, moveMode);
                    const xrSlot = await STATIONS.XRAY.acquire(pat);
                    // ขั้นที่ 1: แจ้งชื่อหน้าห้องควบคุมเอกซเรย์และเปลี่ยนชุด/ถอดโลหะ
                    await pat.walkToNode('N_XRAY', [-1020, -342], FACE.N, moveMode);
                    pat.setState('6. ลงทะเบียนเอกซเรย์และเตรียมตัวถอดโลหะ', 'Idle');
                    await this.patWait(pat, 1.2, 2.6);

                    // ขั้นที่ 2: เข้าแท่นยืนถ่ายเอกซเรย์ปอด หรือขึ้นเตียงเอกซเรย์ตามท่าตรวจ
                    const useXrayBed = Math.random() < 0.45;
                    const xrayTarget = useXrayBed ? [-1250, -190] : [-1312, -190];
                    await pat.walkToNode('N_XRAY', xrayTarget, useXrayBed ? FACE.N : FACE.W, moveMode);
                    pat.setState(useXrayBed ? '6. นอนจัดท่าถ่ายเอกซเรย์บนเตียงตรวจ' : '6. ยืนแนบอกที่แท่นถ่ายเอกซเรย์ปอด (Chest X-ray)', useXrayBed ? 'LieBed' : 'Idle');
                    await DialogueManager.converseAtStation(
                        pat, xrSlot.staffRef,
                        `พร้อมถ่ายเอกซเรย์ตามใบสั่งแพทย์ครับ/ค่ะ`,
                        `จัดท่าตรงตำแหน่งนะครับ สูดหายใจเข้าลึกๆ แล้วกลั้นใจนิ่งๆ สักครู่... ส่งภาพเข้า PACS เรียบร้อยครับ!`,
                        '11. เอกซเรย์ X-ray', useXrayBed ? 'LieBed' : 'Idle', 'UseComputer'
                    );
                    await this.patWait(pat, 2.2, 4.8);
                    await pat.walkToNode('N_XRAY', null, null, moveMode);
                    STATIONS.XRAY.release(xrSlot);
                }

                // 7. กลับไปพบแพทย์เพื่อพิจารณาผลตรวจ
                if (pat.flowData.needLab || pat.flowData.needXray) {
                    pat.zoneBucket = 'opd';
                    pat.setState('7. กลับเข้าพบแพทย์เพื่อฟังผลตรวจ LAB/X-ray', moveMode);
                    await pat.walkToNode('N_DOC_CORR', null, null, moveMode);
                    const docSlot2 = await STATIONS.OPD_DOCTOR.acquire(pat);
                    const docNode2 = `N_DOC_IN_${docSlot2.idx + 1}`;
                    await pat.walkToNode(docNode2, docSlot2.patientPos, docSlot2.patientFace, moveMode);
                    pat.setState('7. แพทย์เปิดดูผลตรวจในระบบและสรุปการรักษา', 'Sit');
                    await DialogueManager.converseAtStation(
                        pat, docSlot2.staffRef,
                        `ผลตรวจแล็บและเอกซเรย์ของผม/ดิฉันเป็นอย่างไรบ้างครับ/คะคุณหมอ?`,
                        `ผลตรวจไม่มีภาวะแทรกซ้อนรุนแรง หมอปรับยารักษาอาการให้ ไปรับยาที่ห้องยาได้เลยครับ`,
                        `4.2 ห้องตรวจแพทย์ ${docSlot2.idx + 1}`, 'Sit', 'Sit'
                    );
                    await this.patWait(pat, 1.5, 3.6);
                    await pat.walkToNode(`N_DOC_${docSlot2.idx + 1}`, null, null, moveMode);
                    STATIONS.OPD_DOCTOR.release(docSlot2);
                }

                // 8. เข้ารับบริการคลินิกเฉพาะทางต่อเนื่อง หรือ Admit ผู้ป่วยใน
                if (pat.flowData.status === 'admit') {
                    await this.handleAdmitIPD(pat, moveMode);
                } else if (Math.random() < 0.22) {
                    if (Math.random() < 0.5) {
                        await this.runPhysioJourney(pat, moveMode, story);
                    } else {
                        await this.runThaiMedJourney(pat, moveMode, story);
                    }
                }
            }

            // 9. รับยาที่แผนกเภสัชกรรม (Zone 12) และชำระเงินที่จุดการเงิน (Zone 13)
            pat.zoneBucket = 'diag';
            pat.setState('9. รอคิวรับยาที่แผนกเภสัชกรรม', 'Queue');
            await pat.walkToNode('N_PHARMACY', null, null, moveMode);
            const phSlot = await STATIONS.PHARMACY.acquire(pat);
            await pat.walkToNode('N_PHARMACY', phSlot.patientPos, phSlot.patientFace, moveMode);
            const manyMeds = Math.random() < 0.42;
            pat.setState(manyMeds ? '9. รอเภสัชกรตรวจสอบยาหลายรายการและอธิบายวิธีใช้' : '9. เภสัชกรส่งมอบยาและแนะนำการใช้ยา', 'ReceiveMedicine');
            await DialogueManager.converseAtStation(
                pat, phSlot.staffRef,
                `มารับยาตามคิวครับ/ค่ะ ต้องรับประทานอย่างไรบ้างครับ/คะ?`,
                manyMeds
                    ? `มียาทั้งหมด 4 รายการนะครับ ซองสีขาวทานหลังอาหารเช้า-เย็น ส่วนซองสีฟ้าทานเฉพาะเวลาปวดครับ`
                    : `ซองนี้รับประทานครั้งละ 1 เม็ด หลังอาหารเช้า-เย็น และดื่มน้ำตามมากๆ นะครับ`,
                '12. เภสัชกรรม', 'ReceiveMedicine', 'Talk'
            );
            await this.patWait(pat, manyMeds ? 2.2 : 1.0, manyMeds ? 4.8 : 2.4);
            STATIONS.PHARMACY.release(phSlot);

            if (pat.flowData.needPay !== false) {
                pat.setState('9. รอคิวตรวจสอบค่าใช้จ่ายที่จุดการเงิน', 'Queue');
                await pat.walkToNode('N_FINANCE', null, null, moveMode);
                const fnSlot = await STATIONS.FINANCE.acquire(pat);
                await pat.walkToNode('N_FINANCE', fnSlot.patientPos, fnSlot.patientFace, moveMode);
                const payMethod = pick(['สแกน QR Code ชำระเงิน', 'ชำระเงินสดและรับเงินทอน', 'ตรวจสอบสิทธิเบิกจ่ายตรงและรับใบเสร็จ']);
                pat.setState(`9. ${payMethod}`, 'Payment');
                await DialogueManager.converseAtStation(
                    pat, fnSlot.staffRef,
                    `ยื่นเอกสารตรวจสอบค่าใช้จ่ายและชำระเงินครับ/ค่ะ`,
                    `ดำเนินการ${payMethod}เรียบร้อยค่ะ นี่ใบเสร็จรับเงิน เดินทางกลับปลอดภัยนะคะ`,
                    '13. การเงิน', 'Payment', 'UseComputer'
                );
                await this.patWait(pat, 1.2, 3.5);
                STATIONS.FINANCE.release(fnSlot);
            }

            // 10. เดินออกจากโรงพยาบาลและสิ้นสุดการรับบริการ
            this.stats.treating = Math.max(0, this.stats.treating - 1);
            this.stats.discharge++;
            HospitalDashboard.refresh();

            pat.setState('10. เสร็จสิ้นการรักษา เดินทางกลับบ้าน', moveMode);
            pat.say('ขอบคุณคุณหมอและพยาบาลทุกท่านมากครับ/ค่ะ อาการสบายขึ้นแล้ว!', 2.8, 'ทางออก รพ.');
            await pat.walkToNode('N_DOOR_MAIN', null, null, moveMode);
            await pat.walkToNode('N_EXIT', [rand(320, 520), -1260], FACE.S, moveMode);
            this.finishPatient(pat);
        } catch (e) {
            console.warn('Patient flow error:', e);
            this.finishPatient(pat);
        }
    },

    // กิจกรรมเฉพาะโซน 9: แผนกกายภาพบำบัด (ทดสอบร่างกาย -> ฝึกยืดเหยียดบนเสื่อ -> ฝึกเดินบนราวคู่ Parallel Bars -> บำบัดฟื้นฟูบนเตียง)
    async runPhysioJourney(pat, moveMode, story) {
        pat.zoneBucket = 'spec';
        pat.setState('4. รอคิวเข้าแผนกกายภาพบำบัด', 'Queue');
        await pat.walkToNode('N_PHYSIO', null, null, moveMode);
        const slot = await STATIONS.PHYSIO.acquire(pat);

        // ขั้นที่ 1: นั่งที่โต๊ะประเมินและทดสอบสมรรถภาพร่างกายก่อนเริ่มกายภาพ
        await pat.walkToNode('N_PHYSIO', [-920, -14], FACE.N, moveMode);
        pat.setState('9.1 นักกายภาพประเมินองศาข้อต่อและทดสอบร่างกาย', 'Sit');
        await DialogueManager.converseAtStation(
            pat, slot.staffRef,
            `มาทำกายภาพครับ/ค่ะ มีอาการ${story}`,
            `เดี๋ยวทดสอบกำลังกล้ามเนื้อและองศาการเคลื่อนไหวก่อน แล้วไปฝึกเดินที่ราวคู่กับประคบแผ่นร้อนนะครับ`,
            '9. กายภาพบำบัด', 'Sit', 'Talk'
        );
        await this.patWait(pat, 1.8, 3.8);

        // ขั้นที่ 2: ทดสอบการทรงตัวและบริหารยืดเหยียดร่างกายบนเสื่อออกกำลังกาย
        await pat.walkToNode('N_PHYSIO', [-1020, 120], FACE.E, moveMode);
        pat.setState('9.2 ทดสอบการทรงตัวและยืดเหยียดกล้ามเนื้อบนเสื่อกายภาพ', 'Dance');
        if (Math.random() < 0.65) {
            pat.say('ลองยืดเหยียดแขนและขาตามที่นักกายภาพแนะนำ รู้สึกตึงลดลงครับ/ค่ะ', 2.6, '9. กายภาพบำบัด');
        }
        await this.patWait(pat, 2.0, 4.5);

        // ขั้นที่ 3: ฝึกเดินก้าวเท้าไป-กลับบนราวคู่ฝึกเดิน (Parallel Bars) ด้วยความเร็วชะลอเหมือนฝึกเดินจริง
        const savedSpeed = pat.speed;
        pat.speed = Math.max(58, savedSpeed * 0.65);
        await pat.walkToNode('N_PHYSIO', [-1305, 65], FACE.E, 'Walk');
        pat.setState('9.3 ฝึกเดินลงน้ำหนักและก้าวเท้าบนราวคู่ (Parallel Bars)', 'Walk');
        await pat.walkToNode('N_PHYSIO', [-1175, 65], FACE.E, 'Walk');
        await this.patWait(pat, 0.8, 1.8);
        await pat.walkToNode('N_PHYSIO', [-1295, 65], FACE.W, 'Walk');
        // บางคนต้องฝึกเดินซ้ำอีกรอบตามอาการ
        if (Math.random() < 0.5) {
            pat.setState('9.3 ฝึกเดินราวคู่รอบที่ 2 เพื่อปรับสมดุลการก้าวเดิน', 'Walk');
            await pat.walkToNode('N_PHYSIO', [-1180, 65], FACE.E, 'Walk');
        }
        pat.speed = savedSpeed;

        // ขั้นที่ 4: ขึ้นเตียงกายภาพบำบัดเพื่อทำอัลตราซาวนด์/กระตุ้นไฟฟ้า/ประคบแผ่นร้อน
        const bedPos = [slot.patientPos[0], 230];
        await pat.walkToNode('N_PHYSIO', bedPos, FACE.N, moveMode);
        pat.setState('9.4 นอนเตียงกายภาพ ประคบแผ่นร้อนและทำอัลตราซาวนด์ลดปวด', 'LieBed');
        if (slot.staffRef && slot.staffRef.active) {
            slot.staffRef.playAnim('Treatment');
            slot.staffRef.say('วางแผ่นประคบร้อนและทำอัลตราซาวนด์คลายกล้ามเนื้อลึกให้นะครับ นอนพักสบายๆ ครับ', 2.8, '9. กายภาพบำบัด');
        }
        await this.patWait(pat, 3.2, 7.2);

        await pat.walkToNode('N_PHYSIO', null, null, moveMode);
        STATIONS.PHYSIO.release(slot);
    },

    // กิจกรรมเฉพาะโซน 7: แผนกทันตกรรม (ตรวจคัดกรองช่องปาก -> นอนยูนิตทำฟัน ขูดหินปูน/อุดฟัน/ถอนฟัน -> บ้วนปากและรับคำแนะนำ)
    async runDentalJourney(pat, moveMode, story) {
        pat.zoneBucket = 'spec';
        pat.setState('4. รอคิวคลินิกทันตกรรม', 'Queue');
        await pat.walkToNode('N_DENTAL', null, null, moveMode);
        const slot = await STATIONS.DENTAL.acquire(pat);

        // ขั้นที่ 1: ยืนยันคิวและซักประวัติสุขภาพช่องปากที่เคาน์เตอร์ทันตกรรม
        await pat.walkToNode('N_DENTAL', [790, 356], FACE.N, moveMode);
        pat.setState('7.1 ซักประวัติสุขภาพช่องปากและเตรียมชุดเครื่องมือปลอดเชื้อ', 'Talk');
        await this.patWait(pat, 1.2, 2.5);

        // ขั้นที่ 2: ขึ้นนอนบนเก้าอี้ทำฟัน (Dental Unit) ทำหัตถการแต่ละคนใช้เวลาไม่เท่ากัน
        const unitBedPos = [slot.patientPos[0], 545];
        await pat.walkToNode('N_DENTAL', unitBedPos, FACE.N, moveMode);
        const dentalProc = pick(['ตรวจฟันและขูดหินปูนทั้งปาก', 'กรอฟันและอุดฟันด้วยวัสดุสีเหมือนฟัน', 'ฉีดยาชาและทำหัตถการรักษาฟัน']);
        pat.setState(`7.2 นอนเก้าอี้ทำฟัน (${dentalProc})`, 'LieBed');
        await DialogueManager.converseAtStation(
            pat, slot.staffRef,
            `คุณหมอครับ/ค่ะ มีอาการ${story}`,
            `เดี๋ยวหมอปรับเอนเก้าอี้ทำฟันและ${dentalProc}ให้นะครับ อ้าปากกว้างๆ สักครู่นะครับ`,
            '7. ทันตกรรม', 'LieBed', 'Treatment'
        );
        await this.patWait(pat, 3.8, 8.5);

        // ขั้นที่ 3: ลุกมาบ้วนปากและฟังคำแนะนำการดูแลสุขภาพช่องปาก
        await pat.walkToNode('N_DENTAL', slot.patientPos, slot.patientFace, moveMode);
        pat.setState('7.3 บ้วนปากและรับคำแนะนำการดูแลฟันหลังรักษา', 'Talk');
        await this.patWait(pat, 1.2, 2.4);

        await pat.walkToNode('N_DENTAL', null, null, moveMode);
        STATIONS.DENTAL.release(slot);
    },

    // กิจกรรมเฉพาะโซน 8: แผนกแพทย์แผนไทย (ประเมินธาตุเจ้าเรือน -> นอนเตียงนวดกดจุดและประคบสมุนไพรร้อน -> นั่งพักจิบน้ำสมุนไพร)
    async runThaiMedJourney(pat, moveMode, story) {
        pat.zoneBucket = 'spec';
        pat.setState('4. รอคิวคลินิกแพทย์แผนไทย', 'Queue');
        await pat.walkToNode('N_THAIMED', null, null, moveMode);
        const slot = await STATIONS.THAIMED.acquire(pat);

        // ขั้นที่ 1: นั่งเก้าอี้โต๊ะประเมินธาตุเจ้าเรือนและตรวจจุดปวดตึง
        await pat.walkToNode('N_THAIMED', [1140, 362], FACE.N, moveMode);
        pat.setState('8.1 แพทย์แผนไทยซักประวัติธาตุเจ้าเรือนและประเมินแนวเส้น', 'Sit');
        await this.patWait(pat, 1.6, 3.2);

        // ขั้นที่ 2: ขึ้นนอนบนเตียงนวดแผนไทยและประคบลูกประคบสมุนไพรร้อน
        const massageBedPos = [slot.patientPos[0], 555];
        await pat.walkToNode('N_THAIMED', massageBedPos, FACE.N, moveMode);
        pat.setState('8.2 นอนเตียงนวดแผนไทย กดจุดคลายเส้นและประคบสมุนไพรร้อน', 'LieBed');
        await DialogueManager.converseAtStation(
            pat, slot.staffRef,
            `ช่วงนี้มีอาการ${story}ครับ/ค่ะ`,
            `เดี๋ยวแพทย์แผนไทยนวดกดจุดคลายพังผืดและประคบสมุนไพรอุ่นๆ บริเวณคอ บ่า และหลังให้นะคะ`,
            '8. แพทย์แผนไทย', 'LieBed', 'Treatment'
        );
        await this.patWait(pat, 4.2, 9.2);

        // ขั้นที่ 3: นั่งพักผ่อนคลายและจิบน้ำสมุนไพรอุ่นๆ ก่อนกลับ
        await pat.walkToNode('N_THAIMED', [1240, 385], FACE.N, moveMode);
        pat.setState('8.3 นั่งพักจิบน้ำสมุนไพรอุ่นๆ หลังนวดประคบ', 'Sit');
        await this.patWait(pat, 1.4, 2.8);

        await pat.walkToNode('N_THAIMED', null, null, moveMode);
        STATIONS.THAIMED.release(slot);
    },

    // เส้นทางผู้ป่วยฉุกเฉิน ER พร้อมบทสนทนาทีมแพทย์-พยาบาลฉุกเฉิน (แต่ละเคสใช้เวลาช่วยชีวิตและสังเกตอาการตามความรุนแรง)
    async runEmergencyJourney(pat) {
        const moveMode = pat.useStretcher ? 'Stretcher' : 'Run';
        try {
            pat.zoneBucket = 'er';
            this.stats.treating++;
            HospitalDashboard.refresh();

            if (pat.arrivalMode === 'car') {
                await TrafficManager.deliverPatientByCar(pat, pat.dropOffBay, true);
                if (!pat.active) return;
            }
            pat.setState('2. เข้าแผนกฉุกเฉิน (ER) เร่งด่วน', moveMode);
            pat.say(`ช่วยด้วยครับ/ค่ะ! มีอาการ${pat.symptomStory}`, 2.8, '5. ฉุกเฉิน ER');
            await pat.walkToNode('N_OUT_ER', null, null, moveMode);
            await pat.walkToNode('N_DOOR_ER', null, null, moveMode);

            // กรณีผู้ป่วยเดินมาเอง แวะจุดคัดแยกความเร่งด่วน (ER Triage) ก่อนเข้าเตียงฉุกเฉิน
            if (!pat.useStretcher) {
                await pat.walkToNode('N_ER', [880, -688], FACE.N, moveMode);
                pat.setState('5.1 คัดแยกระดับความฉุกเฉิน (ER Triage)', 'Talk');
                await this.patWait(pat, 1.0, 2.2);
            }

            const st = pat.flowData.status;
            let erSlot = null;

            if (st === 'refer') {
                // ผู้ป่วย Refer เป็นผู้ป่วยวิกฤต ส่งตรงเข้าเตียงกู้ชีพ (Resuscitation Bed)
                await pat.walkToNode('N_ER', [830, -490], FACE.N, moveMode);
                pat.setState('5.2 ผู้ป่วยวิกฤตบนเตียงกู้ชีพ (Resuscitation) ได้รับการรักษาฉุกเฉิน', 'LieBed');
                const erDoc = CharacterManager.staffList.find(s => s.role === 'doctor' && s.dept.includes('ER'));
                if (erDoc && erDoc.active) {
                    erDoc.say('ผู้ป่วยสัญญาณชีพวิกฤต ติดมอนิเตอร์และให้ยาช่วยชีวิตด่วน ต้องส่งต่อ (Refer) โรงพยาบาลศูนย์ครับ!', 3.2, '5. เตียงกู้ชีพ ER');
                }
                await this.patWait(pat, 3.2, 5.8);
            } else {
                await pat.walkToNode('N_ER_BEDS', null, null, moveMode);
                erSlot = await STATIONS.ER.acquire(pat);
                await pat.walkToNode('N_ER_BEDS', erSlot.bedPos || erSlot.patientPos, FACE.N, moveMode);
                pat.setState('5.2 แพทย์/พยาบาลฉุกเฉินกู้ชีพ ติดมอนิเตอร์และให้การรักษาด่วน', 'LieBed');
                await DialogueManager.converseAtStation(
                    pat, erSlot.staffRef,
                    `หายใจเหนื่อยและปวดมากครับ/ค่ะคุณหมอ`,
                    `ติดมอนิเตอร์วัดคลื่นหัวใจ ให้ออกซิเจนและเปิดเส้นน้ำเกลือด่วน ตอนนี้สัญญาณชีพเริ่มคงที่แล้วครับ!`,
                    '5. ฉุกเฉิน ER', 'LieBed', 'NurseCare'
                );
                await this.patWait(pat, 3.8, 8.8);
                await pat.walkToNode('N_ER_BEDS', null, null, moveMode);
                STATIONS.ER.release(erSlot);
            }

            if (st === 'admit') {
                await this.handleAdmitIPD(pat, 'Walk');
                this.stats.treating = Math.max(0, this.stats.treating - 1);
                this.stats.discharge++;
            } else if (st === 'refer') {
                this.stats.treating = Math.max(0, this.stats.treating - 1);
                this.stats.refer++;
                HospitalDashboard.refresh();

                pat.setState('5. ผู้ป่วยวิกฤตนอนบนเตียงเปล (Stretcher) เตรียมเคลื่อนย้ายส่งต่อ Refer', 'Stretcher');
                pat.say('อาการวิกฤต เจ้าหน้าที่ช่วยพาขึ้นรถพยาบาลส่งต่อ Refer ครับ/ค่ะ', 2.8, '5. ส่งต่อ Refer');

                // ค้นหาเจ้าหน้าที่เปล ER 2 คน (Porter 1 อยู่หัวเตียง, Porter 2 อยู่ท้ายเตียง)
                const erPorters = CharacterManager.staffList.filter(s => s.role === 'porter' || s.dept.includes('เปล'));
                const porterHead = erPorters[0]; // ประจำหัวเตียง/หัวเปล
                const porterFoot = erPorters[1] || erPorters[0]; // ประจำท้ายเตียง/ท้ายเปล

                // เจ้าหน้าที่เปลเดินมาประกบขอบด้านบนและขอบด้านล่างของเตียงกู้ชีพพอดี
                if (porterHead && porterHead.active) {
                    porterHead.setState('ประจำขอบด้านบนหัวเตียง (Refer)', 'Walk');
                }
                if (porterFoot && porterFoot.active) {
                    porterFoot.setState('ประจำขอบด้านล่างปลายเตียง (Refer)', 'Walk');
                }
                await Promise.all([
                    (porterHead && porterHead.active) ? porterHead.walkToNode('N_ER', [830, -448], FACE.S, 'Walk') : Promise.resolve(),
                    (porterFoot && porterFoot.active) ? porterFoot.walkToNode('N_ER', [830, -532], FACE.N, 'Walk') : Promise.resolve()
                ]);

                if (porterFoot && porterFoot.active) {
                    porterFoot.say('เจ้าหน้าที่เปลพร้อมครับ ประกบขอบบนและขอบล่างเตียง ช่วยกันเข็นเตียงเปลพาคนไข้ขึ้นรถพยาบาล Refer ด่วน!', 3.0, '5. ฉุกเฉิน ER');
                }
                await sleep(1.2);

                // เจ้าหน้าที่เปลประกบขอบบนและขอบล่างของเตียงเปล พาคนไข้เดินเคลื่อนย้ายไปที่รถพยาบาลฉุกเฉิน (Ambulance) ด้านหน้า ER
                if (porterHead && porterHead.active) {
                    porterHead.setState('เข็นนำขอบบนหัวเตียงเปล นำคนไข้ส่งขึ้นรถพยาบาล Refer', 'Walk');
                }
                if (porterFoot && porterFoot.active) {
                    porterFoot.setState('เข็นดันขอบล่างปลายเตียงเปล นำคนไข้ส่งขึ้นรถพยาบาล Refer', 'Walk');
                }

                // เดินพร้อมกันผ่านประตู ER ออกสู่ท้ายรถพยาบาลฉุกเฉิน ประกบขอบด้านบนและขอบด้านล่างของเตียงเปลพอดี
                await Promise.all([
                    pat.walkToNode('N_OUT_ER', [1000, -960], FACE.S, 'Stretcher'),
                    (porterHead && porterHead.active) ? porterHead.walkToNode('N_OUT_ER', [1000, -924], FACE.S, 'Walk') : Promise.resolve(),
                    (porterFoot && porterFoot.active) ? porterFoot.walkToNode('N_OUT_ER', [1000, -996], FACE.S, 'Walk') : Promise.resolve()
                ]);

                // พาคนไข้ขึ้นรถพยาบาล
                pat.poseGroup.visible = false;
                pat.setState('นำคนไข้ขึ้นรถพยาบาล Refer เรียบร้อย', 'Sit');
                if (porterFoot && porterFoot.active) {
                    porterFoot.say('พาคนไข้ขึ้นรถพยาบาล Refer เรียบร้อย ล็อกเตียงฉุกเฉินปลอดภัย ออกเดินทางได้ครับ!', 3.0, 'จุดรถพยาบาล ER');
                }
                await sleep(1.5);
                this.finishPatient(pat);

                // เจ้าหน้าที่เปลเดินกลับไปประจำจุดที่ห้อง ER
                if (porterHead && porterHead.active) {
                    porterHead.setState('เสร็จสิ้นภารกิจ Refer เดินกลับประจำจุดห้อง ER', 'Walk');
                    porterHead.walkToNode('N_ER', porterHead.rosterInfo.postPos, porterHead.rosterInfo.postFace, 'Walk').then(() => {
                        if (porterHead.active) {
                            porterHead.idleBehavior = 'work';
                            porterHead.setState('ประจำการเวรเปลฉุกเฉิน (ER)', 'Stand');
                        }
                    });
                }
                if (porterFoot && porterFoot.active) {
                    porterFoot.setState('เสร็จสิ้นภารกิจ Refer เดินกลับประจำจุดห้อง ER', 'Walk');
                    porterFoot.walkToNode('N_ER', porterFoot.rosterInfo.postPos, porterFoot.rosterInfo.postFace, 'Walk').then(() => {
                        if (porterFoot.active) {
                            porterFoot.idleBehavior = 'work';
                            porterFoot.setState('ประจำการเวรเปลฉุกเฉิน (ER)', 'Stand');
                        }
                    });
                }

                // รถ Ambulance พาคนไข้ส่งต่อ (เปิดไซเรนขับออกไป) และรถ Ambulance อีกคันขับเข้ามาจอดแทน
                TrafficManager.dispatchReferAmbulanceAndReplace();
                return;
            } else if (st === 'death') {
                pat.enableGoldHalo();
                this.stats.treating = Math.max(0, this.stats.treating - 1);
                this.stats.death++;
                HospitalDashboard.refresh();
                const mBed = HospitalEnvironment.morgueBeds.find(b => !b.occupied) || HospitalEnvironment.morgueBeds[0];
                if (mBed) mBed.occupied = true;
                pat.setState('เสียชีวิต (เคลื่อนย้ายไปยังห้องพักพิเศษ)', 'Stretcher');
                await pat.walkToNode('N_MORGUE', mBed ? mBed.bedPos : [830, 790], FACE.N, 'Stretcher');
                pat.playAnim('LieBed');
                await this.patWait(pat, 7.0, 12.0);
                if (mBed) mBed.occupied = false;
                this.finishPatient(pat);
                return;
            } else {
                this.stats.treating = Math.max(0, this.stats.treating - 1);
                this.stats.discharge++;
            }
            HospitalDashboard.refresh();
            pat.setState('10. อาการปลอดภัย เดินทางกลับบ้าน', 'Walk');
            pat.say('อาการฉุกเฉินปลอดภัยแล้ว ขอบคุณทีม ER มากครับ/ค่ะ', 2.6, '5. ฉุกเฉิน ER');
            await pat.walkToNode('N_OUT_ER', [1080, -1240], FACE.S, 'Walk');
            this.finishPatient(pat);
        } catch {
            this.finishPatient(pat);
        }
    },

    // 6. กระบวนการ Admit ผู้ป่วยใน พร้อมพยาบาลรับผู้ป่วยหน้าเคาน์เตอร์ และทีมแพทย์ + พยาบาลเดินตามไปตรวจอาการทุกเตียงที่ Admit
    ipdRoundActive: false,
    ipdRoundTimer: 6.5,

    async handleAdmitIPD(pat, moveMode) {
        pat.zoneBucket = 'ipd';
        const ipdBed = HospitalEnvironment.allocateIPDBed(pat);
        this.stats.admit++;
        HospitalDashboard.refresh();

        // พยาบาลประจำเคาน์เตอร์รับผู้ป่วยใน (1 คน)
        const counterNurse = CharacterManager.staffList.find(s => s.rosterInfo.dept.includes('เคาน์เตอร์ IPD'))
            || CharacterManager.staffList.find(s => s.rosterInfo.dept.includes('ผู้ป่วยใน'));

        if (ipdBed) {
            // ขั้นที่ 1: เมื่อคนไข้มาถึงหอผู้ป่วยใน ให้เดินมาคุยกับพยาบาลหน้าเคาน์เตอร์รับผู้ป่วยก่อน
            pat.setState(`6.1 เดินติดต่อเคาน์เตอร์รับผู้ป่วยใน (IPD)`, moveMode);
            await pat.walkToNode('N_IPD', [-1060, 344], FACE.N, moveMode);
            pat.setState(`6.1 คุยกับพยาบาลหน้าเคาน์เตอร์ ลงทะเบียนรับสายรัดข้อมือ (เตียง #${ipdBed.number})`, 'Talk');
            await DialogueManager.converseAtStation(
                pat, counterNurse,
                `สวัสดีครับ/ค่ะ คุณหมอสั่ง Admit นอนโรงพยาบาล อาการ${pat.symptomStory}ครับ/ค่ะ`,
                `รับทราบค่ะ ลงทะเบียนผู้ป่วยในและติดสายรัดข้อมือให้เรียบร้อย เชิญเข้าพักที่เตียง #${ipdBed.number} เดี๋ยวคุณหมอกับพยาบาลเดินตามไปตรวจอาการที่เตียงนะคะ`,
                '6. เคาน์เตอร์รับผู้ป่วยใน', 'Talk', 'Sit'
            );
            await this.patWait(pat, 1.0, 2.0);

            // ขั้นที่ 2: ผู้ป่วยเดินไปนอนที่เตียงผู้ป่วยใน
            const bedRowNode = ipdBed.number <= 5 ? 'N_IPD_ROW1' : 'N_IPD_ROW2';
            pat.setState(`6.2 เดินเข้าเตียงผู้ป่วยใน #${ipdBed.number}`, moveMode);
            await pat.walkToNode(bedRowNode, ipdBed.bedPos, FACE.N, moveMode);
            pat.setState(`6.3 นอนพักรักษาตัวบนเตียงผู้ป่วยใน (เตียง #${ipdBed.number})`, 'LieBed');

            // ขั้นที่ 3: แพทย์และพยาบาลประจำหอผู้ป่วยใน เดินตามไปที่เตียงนี้และเดินตรวจอาการทุกเตียงที่มีคนไข้ Admit อยู่
            this.triggerIPDWardRound(ipdBed);

            await this.patWait(pat, 9.0, 17.5);
            pat.setState(`6.4 แพทย์อนุญาตจำหน่ายออกจาก IPD (คืนเตียง #${ipdBed.number})`, 'Stand');
            pat.say(`อาการฟื้นตัวดีแล้ว ขอบคุณคุณหมอและพยาบาลหอผู้ป่วยในมากครับ/ค่ะ`, 2.6, '6. จำหน่าย IPD');
            await pat.walkToNode(bedRowNode, null, null, moveMode);
            await pat.walkToNode('N_IPD_DOOR', null, null, moveMode);
            HospitalEnvironment.releaseIPDBed(ipdBed);
        } else {
            pat.setState('6. เดินไปเคาน์เตอร์พยาบาล IPD', moveMode);
            await pat.walkToNode('N_IPD', [-1060, 344], FACE.N, moveMode);
            pat.setState('6. คุยกับพยาบาลหน้าเคาน์เตอร์ รอจัดสรรเตียงผู้ป่วยใน', 'Talk');
            await DialogueManager.converseAtStation(
                pat, counterNurse,
                `ติดต่อขอรับเตียงผู้ป่วยใน (Admit) ครับ/ค่ะ`,
                `รอสักครู่นะคะ พยาบาลกำลังประสานเตียงผู้ป่วยในให้ค่ะ`,
                '6. เคาน์เตอร์รับผู้ป่วยใน', 'Talk', 'Sit'
            );
            await this.patWait(pat, 4.0, 7.5);
        }
        this.stats.admit = Math.max(0, this.stats.admit - 1);
        HospitalDashboard.refresh();
    },

    // ระบบแพทย์หอผู้ป่วยใน (1 คน) และพยาบาลดูแลเตียง (3 คน) เดินตามไปตรวจอาการผู้ป่วยทุกเตียงที่มีคนไข้ Admit อยู่ (IPD Ward Round)
    async triggerIPDWardRound(priorityBed = null) {
        if (this.ipdRoundActive) return;
        const ipdDoctor = CharacterManager.staffList.find(s => s.rosterInfo.dept.includes('แพทย์ประจำหอผู้ป่วยใน'));
        const roundNurses = CharacterManager.staffList.filter(s => s.rosterInfo.dept.includes('พยาบาลผู้ป่วยใน (ดูแลเตียง'));

        if (!ipdDoctor && roundNurses.length === 0) return;
        // ตรวจสอบว่าเจ้าหน้าที่เดินจากลานรวมพลมาถึงหอผู้ป่วยในแล้ว
        if (ipdDoctor && ipdDoctor.idleBehavior !== 'work') return;

        const occupiedBeds = HospitalEnvironment.ipdBeds.filter(b => b.occupied && b.occupant && b.occupant.active);
        if (occupiedBeds.length === 0) return;

        // เรียงให้เตียงที่เพิ่งเข้านอน (priorityBed) ถูกเดินตามไปตรวจเป็นเตียงแรก แล้วเดินตรวจต่อครบทุกเตียงที่มีผู้ป่วย Admit อยู่
        if (priorityBed && occupiedBeds.includes(priorityBed)) {
            occupiedBeds.sort((a, b) => (a === priorityBed ? -1 : (b === priorityBed ? 1 : a.number - b.number)));
        }

        this.ipdRoundActive = true;
        const team = [ipdDoctor, ...roundNurses].filter(Boolean);

        try {
            team.forEach(st => { st.idleBehavior = null; });

            for (const bedObj of occupiedBeds) {
                if (!bedObj.occupied || !bedObj.occupant || !bedObj.occupant.active) continue;
                const pat = bedObj.occupant;
                const rowNode = bedObj.number <= 5 ? 'N_IPD_ROW1' : 'N_IPD_ROW2';
                const bx = bedObj.bedPos[0];
                const by = bedObj.bedPos[1];

                // กำหนดตำแหน่งยืนข้างเตียงของแพทย์และพยาบาลเพื่อไม่ให้ยืนซ้อนทับกัน
                const docPos = [bx - 26, by - 46];
                const nursePositions = [
                    [bx + 26, by - 46],
                    [bx - 38, by - 22],
                    [bx + 38, by - 22]
                ];

                if (ipdDoctor && ipdDoctor.active) {
                    ipdDoctor.setState(`เดินไปตรวจผู้ป่วยใน เตียง #${bedObj.number}`, 'Walk');
                }
                roundNurses.forEach(n => {
                    if (n && n.active) n.setState(`เดินตามแพทย์ตรวจเตียง #${bedObj.number}`, 'Walk');
                });

                await Promise.all([
                    (ipdDoctor && ipdDoctor.active)
                        ? ipdDoctor.walkToNode(rowNode, docPos, FACE.N, 'Walk')
                        : Promise.resolve(),
                    ...roundNurses.map((n, idx) => (n && n.active)
                        ? (async () => {
                            await sleep(0.14 * (idx + 1));
                            if (n.active) await n.walkToNode(rowNode, nursePositions[idx % nursePositions.length], FACE.N, 'Walk');
                        })()
                        : Promise.resolve())
                ]);

                if (!bedObj.occupied || !pat.active) continue;

                // แพทย์และพยาบาลตรวจอาการ วัดสัญญาณชีพ และพูดคุยกับผู้ป่วยบนเตียง
                if (ipdDoctor && ipdDoctor.active) {
                    ipdDoctor.faceDirection(FACE.N);
                    ipdDoctor.setState(`ตรวจอาการผู้ป่วยใน เตียง #${bedObj.number} (${pat.name})`, 'Examine');
                    ipdDoctor.say(`ตรวจเยี่ยมเตียง #${bedObj.number}: อาการ${pat.symptomStory}ดีขึ้นตามลำดับ สัญญาณชีพคงที่ครับ`, 2.8, `6. IPD เตียง #${bedObj.number}`);
                }
                roundNurses.forEach((n, idx) => {
                    if (!n || !n.active) return;
                    n.faceDirection(FACE.N);
                    n.setState(`บันทึกสัญญาณชีพ/ดูแลน้ำเกลือ เตียง #${bedObj.number}`, idx === 0 ? 'NurseCare' : 'Treatment');
                    if (idx === 0) {
                        setTimeout(() => {
                            if (n.active && bedObj.occupied) {
                                n.say(`วัดความดันและเช็กหยดน้ำเกลือเตียง #${bedObj.number} เรียบร้อยค่ะคุณหมอ`, 2.5, `6. IPD เตียง #${bedObj.number}`);
                            }
                        }, 850);
                    }
                });

                await sleep(2.8);
            }

            // เมื่อเดินตรวจครบทุกเตียงที่มีผู้ป่วย Admit แล้ว เดินกลับมาประจำจุดพักหน้าเคาน์เตอร์หอผู้ป่วยใน
            await Promise.all(team.map(async st => {
                if (!st || !st.active) return;
                st.setState(`เดินกลับจุดประจำการ (${st.dept})`, 'Walk');
                await st.walkToNode('N_IPD', st.rosterInfo.postPos, st.rosterInfo.postFace, 'Walk');
                if (st.active) {
                    st.faceDirection(st.rosterInfo.postFace);
                    st.idleBehavior = 'work';
                    st.setState(`ปฏิบัติหน้าที่ (${st.dept})`, st.rosterInfo.workAnim);
                }
            }));
        } catch (err) {
            console.warn('IPD ward round error:', err);
        } finally {
            team.forEach(st => {
                if (st && st.active && !st.idleBehavior) st.idleBehavior = 'work';
            });
            this.ipdRoundActive = false;
            this.ipdRoundTimer = rand(8.0, 14.0);
        }
    },

    finishPatient(pat) {
        const idx = this.patients.indexOf(pat);
        if (idx !== -1) this.patients.splice(idx, 1);
        pat.destroy();
        setText('board-patient-sim', this.patients.length);
        HospitalDashboard.refresh();
    },

    // เปิดให้บริการ: ปล่อยผู้มารับบริการชุดแรกเข้ามาเมื่อเจ้าหน้าที่ประจำครบทุกโซนแล้ว
    serviceOpened: false,
    startServiceOpening() {
        if (this.serviceOpened) return;
        this.serviceOpened = true;
        this.spawnTimer = rand(1.5, 3.0);
        // หากมีผู้ป่วยจริงในคิว ให้เริ่มปล่อยเข้ามารับบริการ (หากไม่มี จะรอข้อมูลคนไข้จริงรอบ 1 ชม. ไม่สุ่มเอง)
        if (this.externalQueue.length > 0) {
            const initialCount = Math.min(this.externalQueue.length, 6);
            for (let i = 0; i < initialCount; i++) {
                setTimeout(() => this.spawnPatient(), 600 + i * 900);
            }
        }
    },

    update(dt) {
        // ยังไม่ปล่อยผู้มารับบริการจนกว่าเจ้าหน้าที่ทุกโซนจะเข้าประจำจุดครบ
        const staffReady = typeof CharacterManager === 'undefined' || CharacterManager.allStaffReady;
        if (staffReady) this.spawnTimer -= dt;
        if (staffReady && this.spawnTimer <= 0) {
            this.spawnTimer = rand(3.5, 6.0);
            // ปล่อยคนไข้เฉพาะเมื่อมีข้อมูลคนไข้จริงรออยู่ในคิวเท่านั้น (หากไม่มี จะไม่สุ่มสร้างเอง รอจนกว่าจะมีข้อมูลใหม่รอบ 1 ชม.)
            if (this.externalQueue.length > 0) {
                this.spawnPatient();
            }
        }
        // ตรวจสอบรอบเดินตรวจหอผู้ป่วยใน (Ward Round) อัตโนมัติทุกครั้งที่มีคนไข้ Admit นอนอยู่บนเตียง
        if (!this.ipdRoundActive) {
            this.ipdRoundTimer -= dt;
            if (this.ipdRoundTimer <= 0) {
                this.ipdRoundTimer = rand(7.5, 13.0);
                const hasAdmitted = HospitalEnvironment.ipdBeds.some(b => b.occupied && b.occupant && b.occupant.active);
                if (hasAdmitted) {
                    this.triggerIPDWardRound();
                }
            }
        }
    }
};

// ================= 9. HospitalDashboard (17.5 แสดงสถิติเรียลไทม์และจำนวนเตียงว่าง) =================
const HospitalDashboard = {
    refresh() {
        const s = PatientFlowManager.stats;
        const db = PatientFlowManager.dbSummary;

        const waiting   = (db ? db.waiting : 0) + s.waiting;
        const treating  = s.treating;
        const admit     = (db ? db.admit : 0) + s.admit;
        const refer     = (db ? db.refer : 0) + s.refer;
        const discharge = (db ? db.discharge : 0) + s.discharge;
        const death     = (db ? db.death : 0) + s.death;
        const total     = waiting + treating + admit + refer + discharge + death;

        setText('waiting-queue-count', waiting);
        setText('treating-count', treating);
        setText('admit-count', admit);
        setText('refer-count', refer);
        setText('discharge-count', discharge);
        setText('death-count', death);
        setText('total-patients-count', total);

        const buckets = { reg: 0, opd: 0, er: 0, ipd: 0, spec: 0, diag: 0 };
        for (const p of PatientFlowManager.patients) {
            if (buckets[p.zoneBucket] !== undefined) buckets[p.zoneBucket]++;
        }
        setText('dept-count-reg', `${buckets.reg} ราย`);
        setText('dept-count-opd', `${buckets.opd} ราย`);
        setText('dept-count-er', `${buckets.er} ราย`);
        setText('dept-count-ipd', `${buckets.ipd} ราย`);
        setText('dept-count-spec', `${buckets.spec} ราย`);
        setText('dept-count-diag', `${buckets.diag} ราย`);

        HospitalEnvironment.updateIPDBedHud();
    }
};

// ================= 10. CAMERA PRESETS, RAYCASTER INSPECTOR & HOST BRIDGES =================
const CAMERA_PRESETS = {
    OVERVIEW:     { pos: [0, -2550, 2150],     target: [0, 80, 0] },
    TOP:          { pos: [0, -80, 3250],       target: [0, 50, 0] },
    ASSEMBLY:     { pos: [-890, -1720, 620],   target: [-890, -1040, 20] },
    ENTRANCE:     { pos: [0, -1250, 520],      target: [0, -610, 20] },
    REGISTRATION: { pos: [-1020, -1100, 520],  target: [-1020, -560, 20] },
    OPD:          { pos: [0, -480, 820],       target: [0, 260, 20] },
    ER:           { pos: [1060, -1180, 620],   target: [1060, -420, 20] },
    IPD:          { pos: [-1060, -40, 720],    target: [-1060, 600, 20] },
    DENTAL:       { pos: [880, 20, 560],       target: [880, 500, 20] },
    THAIMED:      { pos: [1230, 20, 560],      target: [1230, 500, 20] },
    PHYSIO:       { pos: [-1110, -420, 560],   target: [-1110, 120, 20] },
    LAB:          { pos: [-670, -760, 480],    target: [-670, -220, 20] },
    XRAY:         { pos: [-1160, -760, 480],   target: [-1160, -220, 20] },
    PHARMACY:     { pos: [1060, -420, 540],    target: [1060, 140, 20] },
    FINANCE:      { pos: [520, -760, 480],     target: [520, -220, 20] }
};

let camAnim = null;
window.focusZone = function (zoneKey) {
    const preset = CAMERA_PRESETS[zoneKey] || CAMERA_PRESETS.OVERVIEW;
    camAnim = {
        fromPos: camera.position.clone(),
        toPos: new THREE.Vector3(...preset.pos),
        fromTarget: controls.target.clone(),
        toTarget: new THREE.Vector3(...preset.target),
        t: 0, dur: 0.85
    };
    document.querySelectorAll('.left-menu .nav-btn').forEach(btn => {
        btn.classList.toggle('active', btn.getAttribute('onclick')?.includes(`'${zoneKey}'`));
    });
};

window.toggleChatBubbles = function () {
    chatBubblesEnabled = !chatBubblesEnabled;
    allCharacters.forEach(c => {
        if (c.bubbleEl) c.bubbleEl.style.display = (chatBubblesEnabled && c.speechTimer > 0) ? 'block' : 'none';
    });
};

window.toggleLabels = function () {
    labelsVisible = !labelsVisible;
    allCharacters.forEach(c => { if (c.tagEl) c.tagEl.style.display = labelsVisible ? 'block' : 'none'; });
    gZone.visible = labelsVisible;
};

let wallsLow = false;
window.toggleWalls = function () {
    wallsLow = !wallsLow;
    gWall.scale.z = wallsLow ? 0.25 : 1.0;
    signs.forEach(s => {
        if (!s.o.flat && s.o.parent !== gZone) {
            s.group.position.z = wallsLow ? Math.max(46, s.baseZ - 26) : s.baseZ;
        }
    });
};

window.triggerMorningAssembly = function () {
    window.focusZone('ASSEMBLY');
    CharacterManager.spawnAllStaffAndStartAssembly();
};

window.triggerAssemblyDance = function () {
    CharacterManager.triggerDanceParty();
};

window.spawnDemoPatient = function (mode) {
    if (mode === 'er' || mode === 'walk' || mode === 'car') {
        PatientFlowManager.spawnPatient(mode);
    } else {
        PatientFlowManager.spawnPatient('normal');
    }
};

// คลิกที่ตัวละครในฉากเพื่อดูรายละเอียดสถานะ, บทสนทนาล่าสุด และ Animation ปัจจุบัน
const raycaster = new THREE.Raycaster();
const mouse = new THREE.Vector2();
renderer.domElement.addEventListener('pointerdown', e => {
    const rect = renderer.domElement.getBoundingClientRect();
    mouse.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
    mouse.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;
    raycaster.setFromCamera(mouse, camera);
    const hits = raycaster.intersectObjects(scene.children, true);
    for (const h of hits) {
        let obj = h.object;
        while (obj) {
            if (obj.userData && obj.userData.simChar) {
                selectedCharacter = obj.userData.simChar;
                updateInspectorUI();
                const modal = $('inspector-modal');
                if (modal) modal.style.display = 'block';
                return;
            }
            obj = obj.parent;
        }
    }
});

function updateInspectorUI() {
    if (!selectedCharacter) return;
    setText('insp-name', selectedCharacter.name);
    setText('insp-role', selectedCharacter.dept || selectedCharacter.role);
    setText('insp-state', selectedCharacter.stateText);
    setText('insp-anim', selectedCharacter.animState);
    setText('insp-chat', selectedCharacter.lastChatText || '-');
    setText('insp-target', selectedCharacter.currentNode || '-');
}

// เชื่อมต่อฟังก์ชันสำหรับ C# WPF WebView2 (คงชื่อฟังก์ชันเดิมครบถ้วน 100%)
window.syncStaffData = function (staffList) {
    const list = Array.isArray(staffList) ? staffList : [];
    if (!SimulatorPreloader.isComplete) {
        SimulatorPreloader.pendingStaffList = list;
        return;
    }
    if (CharacterManager.allStaffReady) {
        // เมื่อระบบเปิดและรวมพลตอนเช้าไปแล้ว ให้ทำการผลัดเปลี่ยนเวรแบบต่อเนื่อง (แทน NPC / คนเลิกงานเดินกลับ) ไม่ต้องเรียกรวมพลใหม่
        CharacterManager.updateStaffRoster(list);
    } else {
        CharacterManager.spawnAllStaffAndStartAssembly(list);
    }
};
window.syncPatientFlow = function (payload) {
    if (!SimulatorPreloader.isComplete) {
        SimulatorPreloader.pendingPatientPayload = payload;
        return;
    }
    PatientFlowManager.syncFromHost(payload);
};
window.syncHourlyData = function (data) {
    if (!data) return;
    if (typeof HourlyUpdateManager !== 'undefined') {
        HourlyUpdateManager.executeHourlyCycle(data);
    }
};
window.triggerHourlyUpdate = function () {
    if (typeof HourlyUpdateManager !== 'undefined') {
        HourlyUpdateManager.timer = 0; // บังคับให้ครบรอบ 1 ชม. ทันทีเพื่อทดสอบ/อัปเดต
    }
};
window.updateStaffChart = function (dtData) {
    if (!Array.isArray(dtData)) return;
    const count = dtData.reduce((acc, r) => acc + (Number(r.staff_count) || 0), 0);
    if (count > 0) setText('board-staff-total', count);
};

// ================= 10.5 TRAFFIC & PATIENT DROP-OFF MANAGER (ระบบรถวิ่งบนถนน 2 เลน + รถรับ-ส่งผู้ป่วยหน้า รพ.) =================
const TrafficManager = {
    catalog: [
        { file: 'generic-city-taxi-with-taxi-roof-sign.glb', frontSign: -1, baseSpeed: 245, label: 'รถแท็กซี่' },
        { file: 'graphite-four-door-sedan.glb', frontSign: -1, baseSpeed: 260, label: 'รถยนต์ส่วนบุคคล' },
        { file: 'generic-compact-suv.glb', frontSign: -1, baseSpeed: 255, label: 'รถ SUV ครอบครัว' },
        { file: 'generic-electric-hatchback.glb', frontSign: -1, baseSpeed: 260, label: 'รถยนต์ไฟฟ้า (EV)' },
        { file: 'crew-cab-pickup-with-tonneau-cover.glb', frontSign: -1, baseSpeed: 250, label: 'รถกระบะญาติมาส่ง' },
        { file: 'box-body-ambulance.glb', frontSign: 1, baseSpeed: 285, label: 'รถพยาบาลฉุกเฉิน', isAmbulance: true },
        { file: 'generic-two-door-coupe.glb', frontSign: -1, baseSpeed: 275, label: 'รถยนต์ส่วนบุคคล' },
        { file: 'generic-1990s-japanese-style-sports-coupe.glb', frontSign: -1, baseSpeed: 285, label: 'รถยนต์ส่วนบุคคล' },
        { file: 'generic-station-wagon-estate-car.glb', frontSign: -1, baseSpeed: 245, label: 'รถยนต์ครอบครัว' },
        { file: 'crew-cab-pickup-with-open-bed.glb', frontSign: -1, baseSpeed: 245, label: 'รถกระบะ' },
        { file: 'generic-high-roof-campervan.glb', frontSign: -1, baseSpeed: 220, label: 'รถตู้รับ-ส่ง' },
        { file: '7-5-t-class-box-truck-with-roll-up-door.glb', frontSign: -1, baseSpeed: 210, label: 'รถบรรทุก' },
        { file: 'police-sedan-with-generic-livery.glb', frontSign: 1, baseSpeed: 280, label: 'รถตำรวจสายตรวจ', isPolice: true },
        { file: 'police-suv-with-generic-livery.glb', frontSign: 1, baseSpeed: 270, label: 'รถสายตรวจ SUV' }
    ],
    templates: [],
    policeTemplate: null,
    ready: false,
    safeGap: 110, // ระยะห่างปลอดภัยขั้นต่ำระหว่างกันชนหน้า-หลัง (ห้ามชนหรือวิ่งทะลุผ่านกันเด็ดขาด)
    lanes: [
        // เลน 1 (ด้านใน Y = -1365): วิ่งจากขวาไปซ้าย (Westbound, dir = -1) ลดปริมาณรถลง 50%
        { id: 'WB', y: -1365, dir: -1, spawnX: 2260, despawnX: -2260, timer: 1.5, maxCars: 1, cars: [] },
        // เลน 2 (ด้านนอก Y = -1475): วิ่งจากซ้ายไปขวา (Eastbound, dir = +1) ลดปริมาณรถลง 50%
        { id: 'EB', y: -1475, dir: 1, spawnX: -2260, despawnX: 2260, timer: 2.5, maxCars: 2, cars: [] }
    ],
    // จุดจอดรถรับ-ส่งผู้ป่วยหน้าโรงพยาบาล (Drop-off Bays)
    dropOffBays: [
        { id: 'MAIN_1', x: -85,  y: -1296, exitWalkPos: [-85, -1242],  node: 'N_DROPOFF_MAIN', isER: false, busy: false },
        { id: 'MAIN_2', x: 95,   y: -1296, exitWalkPos: [95, -1242],   node: 'N_DROPOFF_MAIN', isER: false, busy: false },
        { id: 'PARK_1', x: 380,  y: -1296, exitWalkPos: [380, -1242],  node: 'N_DROPOFF_PARK', isER: false, busy: false },
        { id: 'PARK_2', x: 540,  y: -1296, exitWalkPos: [540, -1242],  node: 'N_DROPOFF_PARK', isER: false, busy: false },
        { id: 'ER_1',   x: 1020, y: -1296, exitWalkPos: [1020, -1242], node: 'N_DROPOFF_ER',   isER: true,  busy: false },
        { id: 'ER_2',   x: 1150, y: -1296, exitWalkPos: [1150, -1242], node: 'N_DROPOFF_ER',   isER: true,  busy: false }
    ],
    dropOffCars: [],
    nightLightsEnabled: false,
    standbyLightGroups: [],

    // สร้างชุดไฟหน้ารถ ลำแสงส่องพื้นถนน ไฟท้ายรถ และไฟไซเรนฉุกเฉินสำหรับเวลากลางคืน
    attachCarHeadlights(carMesh, halfLen = 65, isEmergency = false) {
        if (carMesh.userData && carMesh.userData.nightLightGroup) return carMesh.userData.nightLightGroup;
        const lg = new THREE.Group();
        const frontX = halfLen * 0.92;
        const rearX = -halfLen * 0.92;

        const headMat = new THREE.MeshBasicMaterial({ color: 0xFEF08A, fog: false });
        const tailMat = new THREE.MeshBasicMaterial({ color: 0xEF4444, fog: false });
        const beamMat = new THREE.MeshBasicMaterial({
            color: 0xFEF9C3,
            transparent: true,
            opacity: 0.28,
            side: THREE.DoubleSide,
            depthWrite: false,
            fog: false
        });
        const groundGlowMat = new THREE.MeshBasicMaterial({
            color: 0xFEF08A,
            transparent: true,
            opacity: 0.22,
            side: THREE.DoubleSide,
            depthWrite: false,
            fog: false
        });

        [-15, 15].forEach(ly => {
            // ดวงไฟหน้ารถคู่ซ้าย-ขวา
            const headLamp = new THREE.Mesh(geo(4.5, 8.5, 5.0), headMat);
            headLamp.position.set(frontX, ly, 16);
            lg.add(headLamp);

            // ดวงไฟท้ายรถสีแดงคู่ซ้าย-ขวา
            const tailLamp = new THREE.Mesh(geo(3.8, 9.0, 4.5), tailMat);
            tailLamp.position.set(rearX, ly, 17);
            lg.add(tailLamp);

            // ลำแสงไฟหน้ารถพุ่งไปข้างหน้า (Volumetric Headlight Beam Cone)
            const coneGeo = new THREE.ConeGeometry(28, 155, 14, 1, true);
            const cone = new THREE.Mesh(coneGeo, beamMat);
            cone.rotation.z = HP;
            cone.position.set(frontX + 76, ly * 1.15, 11);
            lg.add(cone);
        });

        // แสงไฟหน้ารถส่องกระทบพื้นถนนด้านหน้ารถ (ใช้ glow patch แทน PointLight ต่อคัน เพื่อลดภาระ GPU/ไม่ต้อง recompile shader)
        const patch = new THREE.Mesh(new THREE.PlaneGeometry(175, 82), groundGlowMat);
        patch.position.set(frontX + 88, 0, 1.8);
        lg.add(patch);

        if (isEmergency) {
            const sirenR = new THREE.Mesh(geo(10, 14, 5), new THREE.MeshBasicMaterial({ color: 0xEF4444, fog: false }));
            sirenR.position.set(8, -10, 56);
            const sirenB = new THREE.Mesh(geo(10, 14, 5), new THREE.MeshBasicMaterial({ color: 0x3B82F6, fog: false }));
            sirenB.position.set(8, 10, 56);
            lg.add(sirenR, sirenB);
        }

        lg.visible = !!TimeAtmosphereManager.vehicleLightsOn;
        carMesh.add(lg);
        carMesh.userData.nightLightGroup = lg;
        return lg;
    },

    attachAmbulanceStandbyLights(ambGroup) {
        const lg = new THREE.Group();
        const headMat = new THREE.MeshBasicMaterial({ color: 0xFEF08A, fog: false });
        const beamMat = new THREE.MeshBasicMaterial({
            color: 0xFEF9C3,
            transparent: true,
            opacity: 0.26,
            side: THREE.DoubleSide,
            depthWrite: false,
            fog: false
        });
        [-20, 20].forEach(lx => {
            const lamp = new THREE.Mesh(geo(9, 4.5, 5.5), headMat);
            lamp.position.set(lx, -78, 20);
            lg.add(lamp);
            const cone = new THREE.Mesh(new THREE.ConeGeometry(28, 145, 14, 1, true), beamMat);
            cone.position.set(lx, -150, 12);
            lg.add(cone);
        });
        const pt = new THREE.PointLight(0xFFE4E6, 1.2, 340, 1.3);
        pt.position.set(0, -105, 36);
        lg.add(pt);
        lg.visible = !!TimeAtmosphereManager.vehicleLightsOn;
        ambGroup.add(lg);
        this.standbyLightGroups.push(lg);
    },

    setNightLights(on) {
        if (this.nightLightsEnabled === on) return;
        this.nightLightsEnabled = on;
        for (const lane of this.lanes) {
            for (const c of lane.cars) {
                if (c.mesh && c.mesh.userData.nightLightGroup) {
                    c.mesh.userData.nightLightGroup.visible = on;
                }
            }
        }
        for (const dc of this.dropOffCars) {
            if (dc.mesh && dc.mesh.userData.nightLightGroup) {
                dc.mesh.userData.nightLightGroup.visible = on;
            }
        }
        this.standbyLightGroups.forEach(g => { g.visible = on; });
    },

    init() {
        // โหลดโมเดลรถยนต์หลักสำหรับส่งผู้ป่วย รถตำรวจสายตรวจ และรถสัญจรบนถนน
        setTimeout(async () => {
            await this.ensurePoliceTemplate();
            const priority = this.catalog.slice(0, 6);
            const rest = this.catalog.slice(6).filter(s => s.file !== 'police-sedan-with-generic-livery.glb').sort(() => Math.random() - 0.5).slice(0, 3);
            const selected = [...priority, ...rest];
            for (const spec of selected) {
                try {
                    const gltf = await loadGLTFOnce(`./models/car/${spec.file}`);
                    const raw = gltf.scene.clone(true);
                    raw.rotation.x = HP;
                    raw.scale.set(31, 31, 31);

                    const normGroup = new THREE.Group();
                    normGroup.add(raw);
                    if (spec.frontSign === -1) normGroup.rotation.z = Math.PI;

                    const tplGroup = new THREE.Group();
                    tplGroup.add(normGroup);
                    tplGroup.updateMatrixWorld(true);

                    const box = new THREE.Box3().setFromObject(tplGroup);
                    const cx = (box.min.x + box.max.x) * 0.5;
                    const cy = (box.min.y + box.max.y) * 0.5;
                    normGroup.position.set(-cx, -cy, -box.min.z);

                    raw.traverse(ch => {
                        if (ch.isMesh) {
                            ch.castShadow = false;
                            ch.receiveShadow = false;
                        }
                    });

                    const length = Math.max(120, box.max.x - box.min.x);
                    this.templates.push({
                        file: spec.file,
                        label: spec.label || 'รถยนต์',
                        isAmbulance: !!spec.isAmbulance,
                        isPolice: !!spec.isPolice,
                        meshTemplate: tplGroup,
                        length,
                        halfLen: length * 0.5,
                        baseSpeed: spec.baseSpeed
                    });

                    if (!this.ready && this.templates.length >= 2) {
                        this.ready = true;
                        this.lanes.forEach(lane => {
                            this.trySpawnCarAt(lane, -600);
                            this.trySpawnCarAt(lane, 800);
                        });
                    }
                    await new Promise(r => setTimeout(r, 180));
                } catch (e) { /* skip error */ }
            }
        }, 450);
    },

    async ensurePoliceTemplate() {
        if (this.policeTemplate) return this.policeTemplate;
        const existing = this.templates.find(t => t.file === 'police-sedan-with-generic-livery.glb');
        if (existing) {
            this.policeTemplate = existing;
            return existing;
        }
        try {
            const gltf = await loadGLTFOnce('./models/car/police-sedan-with-generic-livery.glb');
            const raw = gltf.scene.clone(true);
            raw.rotation.x = HP;
            raw.scale.set(31, 31, 31);

            const normGroup = new THREE.Group();
            normGroup.add(raw);

            const tplGroup = new THREE.Group();
            tplGroup.add(normGroup);
            tplGroup.updateMatrixWorld(true);

            const box = new THREE.Box3().setFromObject(tplGroup);
            const cx = (box.min.x + box.max.x) * 0.5;
            const cy = (box.min.y + box.max.y) * 0.5;
            normGroup.position.set(-cx, -cy, -box.min.z);

            raw.traverse(ch => {
                if (ch.isMesh) {
                    ch.castShadow = false;
                    ch.receiveShadow = false;
                }
            });

            const length = Math.max(120, box.max.x - box.min.x);
            const tpl = {
                file: 'police-sedan-with-generic-livery.glb',
                label: 'รถตำรวจสายตรวจ',
                isPolice: true,
                meshTemplate: tplGroup,
                length,
                halfLen: length * 0.5,
                baseSpeed: 280
            };
            this.policeTemplate = tpl;
            if (!this.templates.some(t => t.file === tpl.file)) {
                this.templates.push(tpl);
            }
            return tpl;
        } catch (e) {
            return null;
        }
    },

    async createPoliceVehicleInstance() {
        const tpl = await this.ensurePoliceTemplate();
        if (tpl && tpl.meshTemplate) {
            const mesh = tpl.meshTemplate.clone(true);
            this.attachCarHeadlights(mesh, tpl.halfLen || 65, true);
            return {
                mesh,
                label: 'รถตำรวจสายตรวจ (Police Sedan)'
            };
        }
        const fallback = this.buildFallbackCarMesh(false);
        this.attachCarHeadlights(fallback, 64, true);
        return {
            mesh: fallback,
            label: 'รถตำรวจสายตรวจ'
        };
    },

    acquireDropOffBay(isER = false) {
        const pool = this.dropOffBays.filter(b => b.isER === !!isER);
        const free = pool.find(b => !b.busy);
        if (free) {
            free.busy = true;
            return free;
        }
        const chosen = pick(pool);
        return {
            id: chosen.id,
            x: chosen.x + rand(-35, 35),
            y: chosen.y,
            exitWalkPos: [chosen.exitWalkPos[0] + rand(-25, 25), chosen.exitWalkPos[1]],
            node: chosen.node,
            isER: chosen.isER,
            busy: false
        };
    },

    buildFallbackCarMesh(isER = false) {
        const g = new THREE.Group();
        const bodyColor = isER ? 0xFFFFFF : pick([0xF59E0B, 0x3B82F6, 0x10B981, 0xE2E8F0, 0xEF4444]);
        blk(0, 0, 128, 56, 24, bodyColor, { parent: g, z: 10 });
        blk(-6, 0, 72, 50, 20, isER ? 0xFCA5A5 : 0x1E293B, { parent: g, z: 32 });
        if (isER) blk(15, 0, 14, 28, 7, 0xEF4444, { parent: g, z: 52, mat: matB(0xEF4444) });
        return g;
    },

    createDropOffVehicleInstance(isER = false) {
        if (this.templates.length > 0) {
            const amb = this.templates.find(t => t.isAmbulance);
            const passengerCars = this.templates.filter(t => !t.isAmbulance);
            const tpl = (isER && amb && Math.random() < 0.7)
                ? amb
                : (passengerCars.length ? pick(passengerCars) : pick(this.templates));
            const mesh = tpl.meshTemplate.clone(true);
            this.attachCarHeadlights(mesh, tpl.halfLen || 65, !!tpl.isAmbulance || !!tpl.isPolice);
            return {
                mesh,
                label: tpl.label || (isER ? 'รถพยาบาลฉุกเฉิน' : 'รถยนต์มาส่ง')
            };
        }
        const fallback = this.buildFallbackCarMesh(isER);
        this.attachCarHeadlights(fallback, 64, isER);
        return {
            mesh: fallback,
            label: isER ? 'รถฉุกเฉินนำส่ง' : 'รถยนต์มาส่ง'
        };
    },

    // นำรถยนต์วิ่งเข้ามาจอดส่งผู้มารับบริการที่จุด Drop-off หน้าโรงพยาบาล แล้วเคลื่อนตัวออกไป
    deliverPatientByCar(pat, bay, isER = false) {
        if (!bay) bay = this.acquireDropOffBay(isER);
        const { mesh, label } = this.createDropOffVehicleInstance(isER);
        const startX = bay.x + rand(480, 660);
        const startY = -1365;
        mesh.position.set(startX, startY, 0);
        mesh.rotation.z = Math.PI;
        gDeco.add(mesh);

        pat.group.position.set(startX, startY, 0);
        pat.poseGroup.visible = false;
        pat.setState(`1. นั่ง${label}มาส่งหน้าโรงพยาบาล`, 'Sit');

        return new Promise(resolve => {
            this.dropOffCars.push({
                mode: 'PATIENT_DELIVER',
                mesh,
                label,
                pat,
                bay,
                isER,
                phase: 'APPROACH',
                startX,
                startY,
                x: startX,
                y: startY,
                t: 0,
                approachDur: rand(2.1, 2.7),
                waitTimer: 1.25,
                speed: 180,
                maxSpeed: 265,
                resolve
            });
        });
    },

    // นำรถตำรวจ (police-sedan-with-generic-livery) มาส่งเจ้าหน้าที่ตำรวจสายตรวจ 2 นายที่จุด Drop-off หน้าโรงพยาบาล
    async deliverPolicePatrol(officers, bay) {
        if (!bay) bay = this.acquireDropOffBay(false);
        const { mesh, label } = await this.createPoliceVehicleInstance();
        const startX = bay.x + 560;
        const startY = -1365;
        mesh.position.set(startX, startY, 0);
        mesh.rotation.z = Math.PI;
        gDeco.add(mesh);

        officers.forEach(off => {
            off.group.position.set(startX, startY, 0);
            off.poseGroup.visible = false;
            off.setState('นั่งรถตำรวจสายตรวจมาโรงพยาบาล', 'Sit');
        });

        return new Promise(resolve => {
            this.dropOffCars.push({
                mode: 'POLICE_DELIVER',
                mesh,
                label,
                passengers: officers,
                bay,
                phase: 'APPROACH',
                startX,
                startY,
                x: startX,
                y: startY,
                t: 0,
                approachDur: 2.35,
                waitTimer: 1.35,
                speed: 195,
                maxSpeed: 280,
                resolve
            });
        });
    },

    // นำรถตำรวจ (police-sedan-with-generic-livery) วิ่งเข้ามารับเจ้าหน้าที่ตำรวจสายตรวจ 2 นายที่รออยู่ ณ จุดส่งรถหน้าโรงพยาบาล
    async pickupPolicePatrol(officers, bay) {
        if (!bay) bay = this.acquireDropOffBay(false);
        const { mesh, label } = await this.createPoliceVehicleInstance();
        const startX = bay.x + 580;
        const startY = -1365;
        mesh.position.set(startX, startY, 0);
        mesh.rotation.z = Math.PI;
        gDeco.add(mesh);

        return new Promise(resolve => {
            this.dropOffCars.push({
                mode: 'POLICE_PICKUP',
                mesh,
                label,
                passengers: officers,
                bay,
                phase: 'APPROACH',
                startX,
                startY,
                x: startX,
                y: startY,
                t: 0,
                approachDur: 2.35,
                waitTimer: 1.4,
                speed: 195,
                maxSpeed: 280,
                resolve
            });
        });
    },

    // รถ Ambulance นำผู้ป่วย Refer ออกเดินทางส่งต่อไปยังโรงพยาบาลศูนย์ และมีรถ Ambulance คันใหม่ขับเข้ามาจอดทดแทน
    dispatchReferAmbulanceAndReplace() {
        const oldAmb = HospitalEnvironment.vehicles.ambulance;
        if (!oldAmb) return;
        HospitalEnvironment.vehicles.ambulance = null;

        // ติดตั้งไฟไซเรนฉุกเฉินกะพริบ
        const sirenGroup = new THREE.Group();
        const sirenR = new THREE.Mesh(geo(12, 14, 6), new THREE.MeshBasicMaterial({ color: 0xEF4444, fog: false }));
        sirenR.position.set(-16, -15, 62);
        const sirenB = new THREE.Mesh(geo(12, 14, 6), new THREE.MeshBasicMaterial({ color: 0x3B82F6, fog: false }));
        sirenB.position.set(16, -15, 62);
        sirenGroup.add(sirenR, sirenB);
        oldAmb.add(sirenGroup);

        this.dropOffCars.push({
            mode: 'REFER_AMBULANCE_DISPATCH',
            mesh: oldAmb,
            sirenGroup,
            x: 1000,
            y: -1040,
            speed: 160,
            phase: 'DEPART_BAY'
        });

        // หลังจากรถพยาบาล Refer ขับออกไป 1.8 วินาที ปล่อยรถพยาบาลคันใหม่ขับเข้ามาจอดแทน
        setTimeout(() => {
            const newAmb = HospitalEnvironment.createAmbulanceMesh(1650, -1365, -HP);
            const repSiren = new THREE.Group();
            const rR = new THREE.Mesh(geo(12, 14, 6), new THREE.MeshBasicMaterial({ color: 0xEF4444, fog: false }));
            rR.position.set(-16, -15, 62);
            const rB = new THREE.Mesh(geo(12, 14, 6), new THREE.MeshBasicMaterial({ color: 0x3B82F6, fog: false }));
            rB.position.set(16, -15, 62);
            repSiren.add(rR, rB);
            newAmb.add(repSiren);

            this.dropOffCars.push({
                mode: 'REPLACE_AMBULANCE_ARRIVE',
                mesh: newAmb,
                sirenGroup: repSiren,
                x: 1650,
                y: -1365,
                speed: 235,
                phase: 'APPROACH_ROAD'
            });
        }, 1800);
    },

    trySpawnCarAt(lane, xPos) {
        if (!this.templates.length || lane.cars.length >= lane.maxCars) return false;
        const tpl = pick(this.templates);

        // ตรวจสอบว่าจุดที่จะเกิดไม่มีรถคันอื่นขวางในระยะปลอดภัย (ห้ามเกิดทับหรือใกล้เกินไป)
        for (const c of lane.cars) {
            const centerDist = Math.abs(c.x - xPos);
            const minRequired = c.halfLen + tpl.halfLen + this.safeGap + 55;
            if (centerDist < minRequired) return false;
        }

        const mesh = tpl.meshTemplate.clone(true);
        this.attachCarHeadlights(mesh, tpl.halfLen || 65, !!tpl.isAmbulance || !!tpl.isPolice);
        mesh.position.set(xPos, lane.y, 0);
        // เลน dir = +1 หันไปทาง +X (rotZ = 0), เลน dir = -1 หันไปทาง -X (rotZ = Math.PI)
        mesh.rotation.z = lane.dir === 1 ? 0 : Math.PI;
        gDeco.add(mesh);

        const maxSpeed = tpl.baseSpeed * rand(0.9, 1.12);
        lane.cars.push({
            mesh,
            x: xPos,
            halfLen: tpl.halfLen,
            speed: maxSpeed * 0.9,
            maxSpeed
        });
        return true;
    },

    update(dt) {
        try {
            // 1. อัปเดตรถยนต์ที่กำลังเข้ามาจอดส่งผู้ป่วยหน้าโรงพยาบาล (Drop-off Vehicles)
            for (let i = this.dropOffCars.length - 1; i >= 0; i--) {
                const dc = this.dropOffCars[i];

                if (dc.mode === 'REFER_AMBULANCE_DISPATCH') {
                    if (dc.sirenGroup) dc.sirenGroup.visible = (Math.floor(simTime * 8) % 2 === 0);
                    if (dc.phase === 'DEPART_BAY') {
                        dc.speed = Math.min(240, dc.speed + 140 * dt);
                        dc.y -= dc.speed * dt;
                        dc.mesh.position.set(1000, dc.y, 0);
                        dc.mesh.rotation.z = 0; // หน้ารถหันตรงไปทิศใต้ตามทางลาด ER
                        if (dc.y <= -1230) {
                            dc.phase = 'UTURN_ROAD';
                            dc.turnT = 0;
                        }
                    } else if (dc.phase === 'UTURN_ROAD') {
                        // โค้งกลับรถ/เลี้ยวขึ้นสู่ถนนสายหลัก Westbound (Y = -1365) อย่างนุ่มนวล
                        // ใช้ Cubic Bézier Curve: P0=(1000, -1230), P1=(1000, -1430), P2=(860, -1365), P3=(740, -1365)
                        dc.turnT = Math.min(1, dc.turnT + dt * 0.95);
                        const t = dc.turnT;
                        const inv = 1 - t;
                        const p0x = 1000, p0y = -1230;
                        const p1x = 1000, p1y = -1430;
                        const p2x = 860,  p2y = -1365;
                        const p3x = 740,  p3y = -1365;

                        const x = inv*inv*inv * p0x + 3*inv*inv*t * p1x + 3*inv*t*t * p2x + t*t*t * p3x;
                        const y = inv*inv*inv * p0y + 3*inv*inv*t * p1y + 3*inv*t*t * p2y + t*t*t * p3y;

                        // คำนวณความชัน/ทิศทางหัวรถให้เลี้ยวตามแนวเส้นโค้งอย่างสมจริง
                        const dx = 3*inv*inv*(p1x - p0x) + 6*inv*t*(p2x - p1x) + 3*t*t*(p3x - p2x);
                        const dy = 3*inv*inv*(p1y - p0y) + 6*inv*t*(p2y - p1y) + 3*t*t*(p3y - p2y);
                        const heading = Math.atan2(dy, dx);

                        dc.x = x;
                        dc.y = y;
                        dc.mesh.position.set(x, y, 0);
                        dc.mesh.rotation.z = heading + HP;

                        if (dc.turnT >= 1) {
                            dc.phase = 'CRUISE_ROAD';
                            dc.x = 740;
                            dc.y = -1365;
                            dc.speed = 280;
                            dc.mesh.rotation.z = -HP;
                        }
                    } else if (dc.phase === 'CRUISE_ROAD') {
                        dc.speed = Math.min(340, dc.speed + 180 * dt);
                        dc.x -= dc.speed * dt;
                        dc.mesh.position.set(dc.x, -1365, 0);
                        dc.mesh.rotation.z = -HP;
                        if (dc.x < -2400) {
                            gDeco.remove(dc.mesh);
                            this.dropOffCars.splice(i, 1);
                        }
                    }
                    continue;
                }
                if (dc.mode === 'REPLACE_AMBULANCE_ARRIVE') {
                    if (dc.sirenGroup) dc.sirenGroup.visible = (Math.floor(simTime * 8) % 2 === 0);
                    if (dc.phase === 'APPROACH_ROAD') {
                        dc.x -= dc.speed * dt;
                        dc.mesh.position.set(dc.x, -1365, 0);
                        dc.mesh.rotation.z = -HP;
                        if (dc.x <= 1120) {
                            dc.phase = 'CURVE_INTO_BAY';
                            dc.turnT = 0;
                        }
                    } else if (dc.phase === 'CURVE_INTO_BAY') {
                        // เลี้ยวโค้งจากถนน Y = -1365 ขึ้นสู่ทางลาด ER Bay (X = 1000, Y = -1220)
                        dc.turnT = Math.min(1, dc.turnT + dt * 1.1);
                        const t = dc.turnT;
                        const inv = 1 - t;
                        const p0x = 1120, p0y = -1365;
                        const p1x = 1030, p1y = -1365;
                        const p2x = 1000, p2y = -1310;
                        const p3x = 1000, p3y = -1220;

                        const x = inv*inv*inv * p0x + 3*inv*inv*t * p1x + 3*inv*t*t * p2x + t*t*t * p3x;
                        const y = inv*inv*inv * p0y + 3*inv*inv*t * p1y + 3*inv*t*t * p2y + t*t*t * p3y;

                        const dx = 3*inv*inv*(p1x - p0x) + 6*inv*t*(p2x - p1x) + 3*t*t*(p3x - p2x);
                        const dy = 3*inv*inv*(p1y - p0y) + 6*inv*t*(p2y - p1y) + 3*t*t*(p3y - p2y);
                        const heading = Math.atan2(dy, dx);

                        dc.x = x;
                        dc.y = y;
                        dc.mesh.position.set(x, y, 0);
                        dc.mesh.rotation.z = heading + HP;

                        if (dc.turnT >= 1) {
                            dc.phase = 'PARK_INTO_BAY';
                            dc.x = 1000;
                            dc.y = -1220;
                            dc.speed = 135;
                        }
                    } else if (dc.phase === 'PARK_INTO_BAY') {
                        // เคลื่อนตัวเข้าจุดจอด ER Bay (1000, -1040) พร้อมหมุนลำหันหน้ารถออกถนน
                        dc.y += dc.speed * dt;
                        const parkProgress = Math.min(1, (dc.y - (-1220)) / 180);
                        dc.mesh.rotation.z = Math.PI - parkProgress * Math.PI;
                        dc.mesh.position.set(1000, dc.y, 0);
                        if (dc.y >= -1040) {
                            dc.y = -1040;
                            dc.mesh.position.set(1000, -1040, 0);
                            dc.mesh.rotation.z = 0;
                            if (dc.sirenGroup) dc.mesh.remove(dc.sirenGroup);
                            HospitalEnvironment.vehicles.ambulance = dc.mesh;
                            this.dropOffCars.splice(i, 1);
                        }
                    }
                    continue;
                }
                if (dc.phase === 'APPROACH') {
                    dc.t = Math.min(1, dc.t + dt / dc.approachDur);
                    const easeOut = 1 - Math.pow(1 - dc.t, 2.6);
                    dc.x = dc.startX + (dc.bay.x - dc.startX) * easeOut;
                    // เลี้ยวเบี่ยงเข้าช่องจอดรับ-ส่งผู้ป่วยช่วงครึ่งหลังของการชะลอรถ
                    const laneShift = dc.t < 0.35 ? 0 : Math.min(1, (dc.t - 0.35) / 0.65);
                    const smoothShift = laneShift * laneShift * (3 - 2 * laneShift);
                    dc.y = dc.startY + (dc.bay.y - dc.startY) * smoothShift;
                    const steerAngle = (dc.t > 0.35 && dc.t < 0.95) ? -0.18 * Math.sin(((dc.t - 0.35) / 0.6) * Math.PI) : 0;

                    dc.mesh.position.set(dc.x, dc.y, 0);
                    dc.mesh.rotation.z = Math.PI + steerAngle;

                    if (dc.pat && dc.pat.active) {
                        dc.pat.group.position.set(dc.x, dc.y, 0);
                    }
                    if (dc.mode === 'POLICE_DELIVER' && Array.isArray(dc.passengers)) {
                        dc.passengers.forEach(off => {
                            if (off && off.active) off.group.position.set(dc.x, dc.y, 0);
                        });
                    }

                    if (dc.t >= 1) {
                        dc.phase = 'STOPPED';
                        dc.mesh.rotation.z = Math.PI;
                        if (dc.mode === 'POLICE_DELIVER' && Array.isArray(dc.passengers)) {
                            dc.passengers.forEach((off, idx) => {
                                if (!off || !off.active) return;
                                const ox = dc.bay.exitWalkPos[0] + (idx === 0 ? -18 : 18);
                                const oy = dc.bay.exitWalkPos[1];
                                off.group.position.set(ox, oy, 0);
                                off.currentNode = dc.bay.node;
                                off.poseGroup.visible = true;
                                off.faceDirection(FACE.N);
                                off.playAnim('Wave');
                                off.setState('ลงจากรถสายตรวจ เริ่มออกตรวจตรา', 'Wave');
                            });
                            if (dc.passengers[0] && dc.passengers[0].active) {
                                dc.passengers[0].say('สายตรวจ สภ.เมือง เดินทางมาตรวจตราความเรียบร้อยหน้า รพ. และทุกโซนภายในอาคารครับ', 3.2, 'จุดส่งรถหน้า รพ.');
                            }
                            if (dc.resolve) {
                                const r = dc.resolve;
                                dc.resolve = null;
                                r();
                            }
                        } else if (dc.mode === 'POLICE_PICKUP' && Array.isArray(dc.passengers)) {
                            dc.passengers.forEach((off, idx) => {
                                if (!off || !off.active) return;
                                off.faceDirection(FACE.S);
                                off.playAnim('Wave');
                                off.setState('ขึ้นรถตำรวจสายตรวจเดินทางกลับ', 'Wave');
                                if (idx === 0) {
                                    off.say('รถตำรวจสายตรวจมารับแล้ว ตรวจตราครบทุกโซนเรียบร้อย เดินทางกลับครับ', 2.8, 'จุดรับ-ส่งหน้า รพ.');
                                }
                            });
                        } else {
                            // ผู้มารับบริการก้าวลงจากรถที่จุดรับ-ส่งหน้าโรงพยาบาล
                            if (dc.pat && dc.pat.active) {
                                dc.pat.group.position.set(dc.bay.exitWalkPos[0], dc.bay.exitWalkPos[1], 0);
                                dc.pat.currentNode = dc.bay.node;
                                dc.pat.poseGroup.visible = true;
                                dc.pat.faceDirection(FACE.N);
                                dc.pat.playAnim('Wave');
                                const dropMsg = dc.isER
                                    ? `รถนำส่งถึงหน้าห้องฉุกเฉินแล้ว อาการ${dc.pat.symptomStory}ครับ/ค่ะ!`
                                    : `${dc.label}มาส่งถึงหน้าโรงพยาบาลแล้ว ขอบคุณที่มาส่งครับ/ค่ะ`;
                                dc.pat.say(dropMsg, 2.6, 'จุดรถรับ-ส่ง รพ.');
                            }
                            if (dc.resolve) {
                                const r = dc.resolve;
                                dc.resolve = null;
                                r();
                            }
                        }
                    }
                } else if (dc.phase === 'STOPPED') {
                    dc.waitTimer -= dt;
                    if (dc.waitTimer <= 0) {
                        if (dc.mode === 'POLICE_PICKUP' && Array.isArray(dc.passengers)) {
                            dc.passengers.forEach(off => {
                                if (off && off.active) {
                                    off.poseGroup.visible = false;
                                    off.destroy();
                                }
                            });
                            if (dc.resolve) {
                                const r = dc.resolve;
                                dc.resolve = null;
                                r();
                            }
                        }
                        dc.bay.busy = false;
                        dc.phase = 'DEPART';
                    }
                } else if (dc.phase === 'DEPART') {
                    dc.speed = Math.min(dc.maxSpeed, dc.speed + 210 * dt);
                    dc.x -= dc.speed * dt;
                    const dy = -1365 - dc.y;
                    dc.y += dy * Math.min(1, dt * 3.5);
                    const steerBack = Math.abs(dy) > 3 ? 0.14 : 0;
                    dc.mesh.position.set(dc.x, dc.y, 0);
                    dc.mesh.rotation.z = Math.PI + steerBack;

                    if (dc.x < -2260) {
                        gDeco.remove(dc.mesh);
                        this.dropOffCars.splice(i, 1);
                    }
                }
            }

            // 2. อัปเดตรถยนต์สัญจรบนถนน 2 เลนหลัก
            if (!this.ready) return;
            for (const lane of this.lanes) {
                // สุ่มปล่อยรถคันใหม่เข้าสู่ต้นเลนเมื่อมีพื้นที่ว่างเพียงพอ (ลดความถี่ลง 50%)
                lane.timer -= dt;
                if (lane.timer <= 0) {
                    const spawned = this.trySpawnCarAt(lane, lane.spawnX);
                    lane.timer = spawned ? rand(5.8, 9.8) : 1.8;
                }

                // เรียงลำดับรถในเลนจากคันหน้าสุด (ใกล้ปลายทางที่สุด) ไปหาคันหลังสุด
                lane.cars.sort((a, b) => (b.x - a.x) * lane.dir);

                for (let i = 0; i < lane.cars.length; i++) {
                    const car = lane.cars[i];
                    if (i === 0) {
                        car.speed += (car.maxSpeed - car.speed) * Math.min(1, dt * 3.0);
                        car.x += lane.dir * car.speed * dt;
                    } else {
                        const lead = lane.cars[i - 1];
                        const gapBefore = (lead.x - car.x) * lane.dir - (lead.halfLen + car.halfLen);
                        const cautionGap = this.safeGap * 2.3;

                        if (gapBefore < cautionGap) {
                            const targetSpeed = gapBefore <= this.safeGap * 1.15
                                ? Math.min(car.maxSpeed, lead.speed * 0.88)
                                : Math.min(car.maxSpeed, lead.speed * 0.97);
                            car.speed += (targetSpeed - car.speed) * Math.min(1, dt * 9.0);
                        } else {
                            car.speed += (car.maxSpeed - car.speed) * Math.min(1, dt * 2.8);
                        }

                        car.x += lane.dir * car.speed * dt;

                        // ล็อกตำแหน่งขั้นเด็ดขาด (Hard Clamp) ไม่ให้ล้ำระยะปลอดภัยท้ายรถคันหน้า
                        const limitX = lead.x - lane.dir * (lead.halfLen + car.halfLen + this.safeGap);
                        if ((car.x - limitX) * lane.dir > 0) {
                            car.x = limitX;
                            car.speed = Math.min(car.speed, lead.speed);
                        }
                    }
                    car.mesh.position.x = car.x;
                }

                // ลบรถที่วิ่งพ้นสุดขอบถนนออก
                for (let i = lane.cars.length - 1; i >= 0; i--) {
                    const car = lane.cars[i];
                    if ((car.x - lane.despawnX) * lane.dir > 0) {
                        gDeco.remove(car.mesh);
                        lane.cars.splice(i, 1);
                    }
                }
            }
        } catch (err) {
            console.warn('Traffic update error:', err);
        }
    }
};

// ================= 10.6 POLICE PATROL MANAGER (ตำรวจสายตรวจ 2 นาย มากับรถตำรวจ เดินตรวจหน้า รพ. และครบทุกโซน แล้วกลับมารอรถมารับแบบสุ่มเวลา) =================
const PolicePatrolManager = {
    activePatrol: false,
    officers: [],
    patrolRunId: 0,
    // สุ่มเวลาสายตรวจรอบแรก (6-11 วินาทีหลังเปิดระบบ) และสุ่มเวลารอบถัดไปอัตโนมัติ
    nextPatrolTimer: rand(6.0, 11.0),

    patrolNames: [
        ['ร.ต.อ.เกรียงไกร (สายตรวจ 1)', 'ส.ต.ท.ณัฐพล (สายตรวจ 2)'],
        ['ร.ต.ท.ธนากร (สายตรวจ 1)', 'ส.ต.อ.วีรยุทธ (สายตรวจ 2)'],
        ['ร.ต.อ.พงศธร (สายตรวจ 1)', 'ส.ต.ท.ชานนท์ (สายตรวจ 2)']
    ],

    // เส้นทางเดินตรวจตราหน้าโรงพยาบาล และสำรวจครบทุกโซนภายในโรงพยาบาล (ผ่านประตูอัตโนมัติ ไม่ทะลุกำแพง)
    patrolRoute: [
        { node: 'N_WALK_W',         pos: [-560, -1240], face: FACE.N, label: 'หน้าโรงพยาบาล (ทางเท้า)',       speech: 'เดินตรวจตราพื้นที่หน้าโรงพยาบาลและการจราจร เหตุการณ์ปกติครับ' },
        { node: 'N_ASSEMBLY_ENTRY', pos: [-890, -1180], face: FACE.N, label: '1. ลานรวมพลเจ้าหน้าที่',         speech: 'ตรวจสอบบริเวณลานรวมพลเจ้าหน้าที่ด้านหน้าอาคาร เรียบร้อยดีครับ' },
        { node: 'N_OUT_MAIN',       pos: [-65, -855],   face: FACE.N, label: 'หน้าประตูทางเข้าหลัก',           speech: 'สวัสดีครับคุณ รปภ. สายตรวจขอเดินสำรวจความเรียบร้อยทุกโซนในโรงพยาบาลนะครับ', greetSecurity: true },
        { node: 'N_OUT_ER',         pos: [1050, -860],  face: FACE.N, label: 'หน้าห้องฉุกเฉิน & จุดรถพยาบาล',  speech: 'ตรวจจุดรับ-ส่งผู้ป่วยฉุกเฉินและลานหน้าอาคารฝั่งขวา ไม่พบสิ่งผิดปกติครับ' },
        { node: 'N_ER',             pos: [1050, -595],  face: FACE.N, label: '5. ห้องฉุกเฉิน (ER Triage)',     speech: 'สำรวจความเรียบร้อยจุดคัดแยกผู้ป่วยฉุกเฉิน ER เหตุการณ์ปกติครับ' },
        { node: 'N_ER_BEDS',        pos: [1020, -285],  face: FACE.N, label: '5. โซนเตียงผู้ป่วยฉุกเฉิน ER',   speech: 'ดูแลความปลอดภัยบริเวณเตียงสังเกตอาการฉุกเฉินเรียบร้อยครับ' },
        { node: 'N_FINANCE',        pos: [520, -250],   face: FACE.N, label: '13. แผนกการเงิน',               speech: 'แวะตรวจจุดชำระเงินและห้องการเงิน ความปลอดภัยเรียบร้อยดีครับ' },
        { node: 'N_SCREEN',         pos: [0, -680],     face: FACE.N, label: '2. โถงทางเข้า & จุดคัดกรอง',     speech: 'ตรวจโถงทางเข้าหลักและจุดคัดกรองผู้มารับบริการครับ' },
        { node: 'N_KIOSK',          pos: [-458, -575],  face: FACE.N, label: '3.1 จุดตู้ Kiosk อัตโนมัติ',     speech: 'ตรวจสอบจุดบริการตู้ Kiosk ลงทะเบียนอัตโนมัติ เรียบร้อยครับ' },
        { node: 'N_REG',            pos: [-960, -615],  face: FACE.W, label: '3. ห้องบัตร & เวชระเบียน',       speech: 'สำรวจความเรียบร้อยห้องลงทะเบียนและเวชระเบียนครับ' },
        { node: 'N_XRAY',           pos: [-1150, -250], face: FACE.W, label: '11. แผนกเอกซเรย์ (X-ray)',       speech: 'ตรวจความเรียบร้อยหน้าห้องเอกซเรย์ เหตุการณ์ปกติครับ' },
        { node: 'N_LAB',            pos: [-670, -260],  face: FACE.N, label: '10. ห้องปฏิบัติการ (LAB)',       speech: 'ตรวจพื้นที่ห้องปฏิบัติการตรวจวิเคราะห์เลือด เรียบร้อยครับ' },
        { node: 'N_OPD_HALL',       pos: [0, 100],      face: FACE.N, label: '4. โถงพักคอยผู้ป่วยนอก (OPD)',   speech: 'เดินตรวจโถงกลางผู้ป่วยนอก OPD ประชาชนเข้ารับบริการอย่างเป็นระเบียบครับ' },
        { node: 'N_PHYSIO',         pos: [-1020, 120],  face: FACE.W, label: '9. แผนกกายภาพบำบัด',             speech: 'สำรวจความเรียบร้อยแผนกกายภาพบำบัดครับ' },
        { node: 'N_IPD',            pos: [-1050, 360],  face: FACE.N, label: '6. หอผู้ป่วยใน (IPD)',           speech: 'ตรวจความเรียบร้อยหอผู้ป่วยใน IPD เหตุการณ์สงบเรียบร้อยครับ' },
        { node: 'N_DOC_2',          pos: [-280, 298],   face: FACE.N, label: '4.2 โซนห้องตรวจแพทย์ 1-5',      speech: 'เดินตรวจหน้าห้องตรวจแพทย์ผู้ป่วยนอก เรียบร้อยดีครับ' },
        { node: 'N_STAFF_LOUNGE',   pos: [-480, 710],   face: FACE.N, label: '14. ห้องพักเจ้าหน้าที่',         speech: 'ตรวจความปลอดภัยโซนห้องพักเจ้าหน้าที่ด้านหลังอาคารครับ' },
        { node: 'N_DENTAL',         pos: [880, 440],    face: FACE.N, label: '7. แผนกทันตกรรม',               speech: 'สำรวจความเรียบร้อยคลินิกทันตกรรม เหตุการณ์ปกติครับ' },
        { node: 'N_MORGUE',         pos: [830, 725],    face: FACE.N, label: '14. โซนสนับสนุน & ห้องดับจิต',   speech: 'ตรวจสอบโซนสนับสนุนด้านหลังและห้องดับจิต เรียบร้อยครับ' },
        { node: 'N_THAIMED',        pos: [1220, 440],   face: FACE.N, label: '8. แผนกแพทย์แผนไทย',             speech: 'สำรวจความเรียบร้อยคลินิกแพทย์แผนไทยครับ' },
        { node: 'N_PHARMACY',       pos: [1020, 110],   face: FACE.N, label: '12. แผนกเภสัชกรรม (ห้องยา)',     speech: 'ตรวจจุดรับยาและห้องเภสัชกรรมครบทุกโซนแล้ว เตรียมเดินกลับไปรอรถสายตรวจมารับครับ' }
    ],

    update(dt) {
        if (this.activePatrol) return;
        this.nextPatrolTimer -= dt;
        if (this.nextPatrolTimer <= 0) {
            this.startPatrol();
        }
    },

    async startPatrol(forceRestart = false) {
        if (this.activePatrol && !forceRestart) return;
        const runId = ++this.patrolRunId;
        this.officers.forEach(o => { if (o && o.active) o.destroy(); });
        this.officers = [];
        this.activePatrol = true;

        try {
            const pairNames = pick(this.patrolNames);
            const dropBay = TrafficManager.acquireDropOffBay(false);
            const startX = dropBay.x + 560;
            const startY = -1365;

            const off1 = new SimCharacter({
                id: `police_${runId}_1`,
                name: pairNames[0],
                role: 'police',
                dept: 'ตำรวจสายตรวจ',
                gender: 'ชาย',
                modelPath: './models/humen/Security personnel/Security_Male_01.glb',
                x: startX,
                y: startY,
                startNode: dropBay.node,
                isStaff: true,
                speed: 132,
                stateText: 'นั่งรถตำรวจสายตรวจมา รพ.'
            });
            const off2 = new SimCharacter({
                id: `police_${runId}_2`,
                name: pairNames[1],
                role: 'police',
                dept: 'ตำรวจสายตรวจ',
                gender: 'ชาย',
                modelPath: './models/humen/Security personnel/Security_Male_01.glb',
                x: startX,
                y: startY,
                startNode: dropBay.node,
                isStaff: true,
                speed: 132,
                stateText: 'นั่งรถตำรวจสายตรวจมา รพ.'
            });

            this.officers = [off1, off2];
            await Promise.all([off1.loadModel(), off2.loadModel()]);
            if (runId !== this.patrolRunId) return;

            // 1. รถตำรวจ (police-sedan-with-generic-livery) ขับมาจอดส่งตำรวจทั้ง 2 นายที่จุด Drop-off หน้าโรงพยาบาล
            await TrafficManager.deliverPolicePatrol(this.officers, dropBay);
            if (runId !== this.patrolRunId || !off1.active || !off2.active) return;

            await sleep(1.1);
            if (runId !== this.patrolRunId) return;

            // 2. เดินตรวจตราหน้าโรงพยาบาล และเดินสำรวจครบทุกโซนภายในอาคาร
            for (let i = 0; i < this.patrolRoute.length; i++) {
                if (runId !== this.patrolRunId || !off1.active || !off2.active) return;
                const wp = this.patrolRoute[i];
                const pos1 = [wp.pos[0] - 16, wp.pos[1]];
                const pos2 = [wp.pos[0] + 16, wp.pos[1]];

                off1.setState(`เดินตรวจตรา (${wp.label})`, 'Walk');
                off2.setState(`เดินตรวจตรา (${wp.label})`, 'Walk');

                await Promise.all([
                    off1.walkToNode(wp.node, pos1, wp.face, 'Walk'),
                    (async () => {
                        await sleep(0.18);
                        if (runId === this.patrolRunId && off2.active) {
                            await off2.walkToNode(wp.node, pos2, wp.face, 'Walk');
                        }
                    })()
                ]);
                if (runId !== this.patrolRunId || !off1.active || !off2.active) return;

                // หยุดสำรวจความเรียบร้อยในแต่ละโซน
                off1.setState(`สำรวจความเรียบร้อย (${wp.label})`, 'LookAround');
                off2.setState(`สำรวจความเรียบร้อย (${wp.label})`, i % 2 === 0 ? 'LookAround' : 'Wave');

                if (wp.greetSecurity && CharacterManager.securityGuard && CharacterManager.securityGuard.active) {
                    const guard = CharacterManager.securityGuard;
                    off1.say(wp.speech, 2.8, wp.label);
                    guard.faceDirection(FACE.S);
                    guard.playAnim('Wave');
                    setTimeout(() => {
                        if (guard.active) guard.say('สวัสดีครับคุณตำรวจ เชิญตรวจตราด้านในได้เลยครับ เหตุการณ์หน้าประตูเรียบร้อยดีครับ!', 2.8, 'ประตูทางเข้าหลัก');
                    }, 600);
                } else if (i % 2 === 0 || i === this.patrolRoute.length - 1) {
                    const speaker = (i % 4 === 0) ? off1 : off2;
                    speaker.say(wp.speech, 2.6, wp.label);
                }

                await sleep(1.45);
            }

            if (runId !== this.patrolRunId || !off1.active || !off2.active) return;

            // 3. เมื่อตรวจครบทุกโซนแล้ว เดินกลับมารอที่จุดส่งรถหน้าโรงพยาบาล
            const pickupBay = TrafficManager.acquireDropOffBay(false);
            const waitPos1 = [pickupBay.exitWalkPos[0] - 18, pickupBay.exitWalkPos[1]];
            const waitPos2 = [pickupBay.exitWalkPos[0] + 18, pickupBay.exitWalkPos[1]];

            off1.setState('เดินกลับจุดส่งรถเพื่อรอรถตำรวจมารับ', 'Walk');
            off2.setState('เดินกลับจุดส่งรถเพื่อรอรถตำรวจมารับ', 'Walk');

            await Promise.all([
                off1.walkToNode(pickupBay.node, waitPos1, FACE.S, 'Walk'),
                (async () => {
                    await sleep(0.18);
                    if (runId === this.patrolRunId && off2.active) {
                        await off2.walkToNode(pickupBay.node, waitPos2, FACE.S, 'Walk');
                    }
                })()
            ]);
            if (runId !== this.patrolRunId || !off1.active || !off2.active) return;

            // ยืนรอรถตำรวจมารับที่จุดรับ-ส่ง
            off1.faceDirection(FACE.S);
            off2.faceDirection(FACE.S);
            off1.setState('ยืนรอรถสายตรวจมารับที่จุดส่งรถ', 'LookAround');
            off2.setState('ยืนรอรถสายตรวจมารับที่จุดส่งรถ', 'Idle');
            off1.say('ตรวจตราครบทุกโซนเรียบร้อย ยืนรอรถตำรวจสายตรวจมารับที่จุดส่งรถครับ', 3.0, 'จุดรับ-ส่งหน้า รพ.');

            await sleep(1.4);
            if (runId !== this.patrolRunId || !off1.active || !off2.active) return;

            // 4. รถตำรวจ (police-sedan-with-generic-livery) ขับเข้ามารับตำรวจทั้ง 2 นายที่จุดส่งรถแล้วเคลื่อนตัวออกไป
            await TrafficManager.pickupPolicePatrol(this.officers, pickupBay);
        } catch (err) {
            console.warn('PolicePatrol error:', err);
        } finally {
            if (runId === this.patrolRunId) {
                this.officers = [];
                this.activePatrol = false;
                // สุ่มเวลามาตรวจตรารอบถัดไป (ระหว่าง 25 ถึง 55 วินาที)
                this.nextPatrolTimer = rand(25.0, 55.0);
            }
        }
    }
};

window.triggerPolicePatrol = function () {
    PolicePatrolManager.startPatrol(true);
};

// ================= 10.7 HOURLY DATA UPDATE MANAGER (ระบบอัปเดตข้อมูลเจ้าหน้าที่และผู้มารับบริการทุกๆ 1 ชั่วโมง) =================
const HourlyUpdateManager = {
    intervalSeconds: 3600, // รอบเวลา 1 ชั่วโมง (3600 วินาที)
    timer: 3600,
    lastUpdateHour: -1,
    updateCount: 0,
    lastUpdateTimestamp: null,

    init() {
        this.lastUpdateHour = new Date().getHours();
        this.lastUpdateTimestamp = new Date();
        this.updateBadge();
    },

    update(dt) {
        this.timer -= dt;

        // ตรวจสอบทั้งกรณีตัวจับเวลาครบ 3600 วินาที หรือขึ้นชั่วโมงใหม่ตามนาฬิกาจริง (เช่น 21:00 -> 22:00)
        const currentHour = new Date().getHours();
        const hourChanged = (this.lastUpdateHour !== -1 && currentHour !== this.lastUpdateHour);

        if (this.timer <= 0 || hourChanged) {
            this.timer = this.intervalSeconds;
            this.lastUpdateHour = currentHour;
            this.executeHourlyCycle();
        }

        // อัปเดตตัวเลขนับถอยหลังบน UI
        if (Math.floor(simTime * 2) % 2 === 0) {
            this.updateBadge();
        }
    },

    updateBadge() {
        const mm = String(Math.floor(Math.max(0, this.timer) / 60)).padStart(2, '0');
        const ss = String(Math.floor(Math.max(0, this.timer) % 60)).padStart(2, '0');
        setText('hourly-sync-text', `รอบ 1 ชม. (ถัดไป: ${mm}:${ss})`);
        const statusEl = $('hourly-update-status');
        if (statusEl) {
            const timeStr = this.lastUpdateTimestamp ? this.lastUpdateTimestamp.toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' }) : '-';
            statusEl.innerText = `รอบที่ ${this.updateCount} (${timeStr} น.)`;
        }
    },

    // ดำเนินการอัปเดตรอบ 1 ชั่วโมง
    async executeHourlyCycle(customPayload = null) {
        this.updateCount++;
        this.lastUpdateTimestamp = new Date();
        const timeTag = this.lastUpdateTimestamp.toLocaleTimeString('th-TH');

        DialogueManager.logToFeed(
            'ระบบอัตโนมัติ', 'รอบ 1 ชม.',
            `⏰ ถึงรอบอัปเดตข้อมูล 1 ชั่วโมง (${timeTag} น.) กำลังตรวจสอบข้อมูลเวรเจ้าหน้าที่และผู้ป่วย...`,
            'ระบบอัตโนมัติ'
        );

        // 1. ส่งสัญญาณไปยัง C# WPF ผ่าน WebView2 เพื่อดึงข้อมูลชั่วโมงใหม่จากฐานข้อมูล
        if (window.chrome && window.chrome.webview) {
            try {
                window.chrome.webview.postMessage(JSON.stringify({
                    type: 'REQUEST_HOURLY_DATA',
                    cycle: this.updateCount,
                    timestamp: this.lastUpdateTimestamp.toISOString()
                }));
            } catch (e) {
                console.warn('WebView postMessage error:', e);
            }
            try {
                window.chrome.webview.postMessage("requestHourlyData");
            } catch {}
        }

        // 2. หากมีข้อมูลแนบมาด้วย (เช่น จาก C# หรือการกดทดสอบ) ให้ทำการอัปเดตทันที
        if (customPayload) {
            if (customPayload.staff && Array.isArray(customPayload.staff)) {
                CharacterManager.updateStaffRoster(customPayload.staff);
            }
            if (customPayload.patients || customPayload.summary) {
                PatientFlowManager.syncFromHost(customPayload);
            }
        }

        // 3. ปล่อย Custom Event สำหรับภายนอก
        window.dispatchEvent(new CustomEvent('hospital-hourly-update', {
            detail: {
                cycle: this.updateCount,
                timestamp: this.lastUpdateTimestamp
            }
        }));
    }
};

// ================= 10.8 SIMULATOR PRELOADER & WARMUP (เตรียมโมเดลและท่าทางให้พร้อมก่อนเริ่ม เพื่อความลื่นไหลสูงสุด) =================
const SimulatorPreloader = {
    started: false,
    progress: 0,
    isComplete: false,
    pendingStaffList: null,
    pendingPatientPayload: null,

    start() {
        if (this.started) return;
        this.started = true;
        const initBox = $('preloader-init-box');
        const loadBox = $('preloader-loading-box');
        const title = $('preloader-main-title');
        const subtitle = $('preloader-main-subtitle');
        if (initBox) initBox.style.display = 'none';
        if (loadBox) loadBox.style.display = 'block';
        if (title) title.innerText = 'กำลังเตรียมความพร้อม Simulator';
        if (subtitle) subtitle.innerText = 'กำลังโหลดโมเดล 3D และระบบจำลองสถานการณ์โรงพยาบาล...';
        this.run();
    },

    setProgress(pct, statusText, stepId = null) {
        this.progress = Math.min(100, Math.max(0, pct));
        const bar = $('preloader-progress-bar');
        const statusEl = $('preloader-status-text');
        const percentEl = $('preloader-percent-text');
        if (bar) bar.style.width = `${this.progress}%`;
        if (statusEl && statusText) statusEl.innerText = statusText;
        if (percentEl) percentEl.innerText = `${Math.round(this.progress)}%`;

        if (stepId) {
            const stepOrder = ['step-env', 'step-models', 'step-anims', 'step-vehicles', 'step-gpu'];
            const curIdx = stepOrder.indexOf(stepId);
            stepOrder.forEach((sid, idx) => {
                const el = $(sid);
                if (el) {
                    if (idx < curIdx) {
                        el.className = 'preloader-step-item done';
                    } else if (idx === curIdx) {
                        el.className = 'preloader-step-item active';
                    } else {
                        el.className = 'preloader-step-item';
                    }
                }
            });
        }
    },

    async run() {
        try {
            // 1. โครงสร้างโรงพยาบาลและระบบไฟ
            this.setProgress(10, 'กำลังสร้างโครงสร้างโรงพยาบาลและระบบแสงจำลอง...', 'step-env');
            HospitalEnvironment.build();
            TimeAtmosphereManager.buildHospitalLights();
            await new Promise(r => setTimeout(r, 120));

            // 2. โหลดโมเดลตัวละครหลักเข้า Base Model Cache (ทยอยทีละโมเดล ไม่โหลดพร้อมกันจนค้าง)
            this.setProgress(20, 'กำลังเตรียมโมเดลตัวละครบุคลากรทางการแพทย์เข้าแคช...', 'step-models');
            const primaryModels = [
                'Medical personnel/Medical_Male_01.glb',
                'Medical personnel/Medical_Male_02.glb',
                'Medical personnel/Medical_Male_03.glb',
                'Medical personnel/Medical_Male_04.glb',
                'Medical personnel/Medical_Male_05.glb',
                'Medical personnel/Medical_Female_01.glb',
                'Medical personnel/Medical_Female_02.glb',
                'Medical personnel/Medical_Female_03.glb',
                'Personnel/Business_Male_01.glb',
                'Personnel/Business_Male_02.glb',
                'Personnel/Business_Female_02.glb',
                'Personnel/Business_Female_03.glb',
                'Security personnel/Security_Male_01.glb',
                'Personnel/Male_Adult_01.glb',
                'Personnel/Male_Adult_02.glb',
                'Personnel/Female_Adult_03.glb',
                'Personnel/Female_Adult_05.glb'
            ];

            for (let i = 0; i < primaryModels.length; i++) {
                try {
                    await getCachedCharacterScene(`./models/humen/${primaryModels[i]}`);
                } catch (e) {
                    console.warn('Preload model skipped:', primaryModels[i], e);
                }
                const pct = 20 + Math.round(((i + 1) / primaryModels.length) * 25);
                this.setProgress(pct, `กำลังเตรียมโมเดลตัวละคร [${i + 1}/${primaryModels.length}]...`, 'step-models');
                await new Promise(r => setTimeout(r, 15));
            }

            // 3. โหลดคลิปอนิเมชันเข้า Animation Clip Cache
            this.setProgress(46, 'กำลังเตรียมระบบท่าทางและการเคลื่อนไหว (Animations)...', 'step-anims');
            const animFiles = [
                'animations/m_idle_neutral_01.glb', 'animations/f_idle_neutral_01.glb',
                'animations/m_walk_neutral_01.glb', 'animations/f_walk_neutral_01.glb',
                'animations/m_run_neutral_01.glb', 'animations/f_run_neutral_01.glb',
                'animations/sit.glb',
                'animations/m_idle_look_around_01.glb', 'animations/f_idle_look_around_01.glb',
                'animations/m_gestic_talk_neutral_01.glb', 'animations/f_gestic_talk_neutral_01.glb',
                'animations/m_gestic_thoughtful_01.glb', 'animations/f_gestic_thoughtful_01.glb',
                'animations/m_wave_01.glb', 'animations/f_wave_01.glb',
                'animations/m_dancing_neutral.glb', 'animations/f_dancing_neutral.glb',
                'animations/m_cheer_01.glb', 'animations/f_cheer_01.glb',
                'animations/m_claphands_01.glb', 'animations/f_claphands_01.glb'
            ];

            for (let i = 0; i < animFiles.length; i++) {
                try {
                    await getAnimClip(`./${animFiles[i]}`, 'Bip01');
                } catch (e) {
                    console.warn('Preload anim skipped:', animFiles[i], e);
                }
                const pct = 46 + Math.round(((i + 1) / animFiles.length) * 28);
                this.setProgress(pct, `กำลังเตรียมระบบท่าทางอนิเมชัน [${i + 1}/${animFiles.length}]...`, 'step-anims');
                await new Promise(r => setTimeout(r, 10));
            }

            // 4. รถพยาบาลฉุกเฉินและระบบจราจร
            this.setProgress(76, 'กำลังเตรียมรถพยาบาลฉุกเฉินและระบบจราจร...', 'step-vehicles');
            try {
                await loadGLTFOnce('./models/car/box-body-ambulance.glb');
                await TrafficManager.ensurePoliceTemplate();
                TrafficManager.init();
            } catch (e) {
                console.warn('Traffic preload warning:', e);
            }
            await new Promise(r => setTimeout(r, 120));

            // 5. คอมไพล์ WebGL Shader และ Warmup GPU
            this.setProgress(90, 'กำลังคอมไพล์ WebGL Shader และปรับแต่งหน่วยความจำ GPU...', 'step-gpu');
            renderer.compile(scene, camera);
            await new Promise(r => setTimeout(r, 200));

            this.setProgress(100, 'เตรียมความพร้อมระบบเสร็จสมบูรณ์ พร้อมเริ่มการจำลอง', 'step-gpu');
            await new Promise(r => setTimeout(r, 350));

            // ซ่อนหน้าจอเตรียมความพร้อม
            this.hide();

            // เริ่มต้นระบบหลักอย่างลื่นไหล
            HourlyUpdateManager.init();
            if (this.pendingStaffList) {
                CharacterManager.spawnAllStaffAndStartAssembly(this.pendingStaffList);
                this.pendingStaffList = null;
            } else {
                CharacterManager.spawnAllStaffAndStartAssembly();
            }
            if (this.pendingPatientPayload) {
                PatientFlowManager.syncFromHost(this.pendingPatientPayload);
                this.pendingPatientPayload = null;
            }
        } catch (err) {
            console.error('SimulatorPreloader error:', err);
            this.hide();
            HourlyUpdateManager.init();
            if (this.pendingStaffList) {
                CharacterManager.spawnAllStaffAndStartAssembly(this.pendingStaffList);
                this.pendingStaffList = null;
            } else {
                CharacterManager.spawnAllStaffAndStartAssembly();
            }
            if (this.pendingPatientPayload) {
                PatientFlowManager.syncFromHost(this.pendingPatientPayload);
                this.pendingPatientPayload = null;
            }
        }
    },

    hide() {
        this.isComplete = true;
        const el = $('simulator-preloader');
        if (el) {
            el.style.opacity = '0';
            el.style.pointerEvents = 'none';
            setTimeout(() => el.remove(), 650);
        }
    }
};

window.startSimulatorPreloader = function () {
    SimulatorPreloader.start();
};

// ================= 11. INITIALIZE & MAIN LOOP =================
const clock = new THREE.Clock();
function animate() {
    requestAnimationFrame(animate);
    const dt = Math.min(clock.getDelta(), 0.1);
    simTime += dt;
    tagFrameCounter++;

    updateTimers();

    if (!SimulatorPreloader.isComplete) {
        controls.update();
        renderer.render(scene, camera);
        return;
    }

    if (camAnim) {
        camAnim.t += dt / camAnim.dur;
        const k = Math.min(1, camAnim.t);
        const ease = 1 - Math.pow(1 - k, 3);
        camera.position.lerpVectors(camAnim.fromPos, camAnim.toPos, ease);
        controls.target.lerpVectors(camAnim.fromTarget, camAnim.toTarget, ease);
        if (k >= 1) camAnim = null;
    }

    for (const d of autoDoors) {
        let near = false;
        const isY = d.axis === 'y';
        for (const c of allCharacters) {
            if (!c.active) continue;
            const along = isY ? Math.abs(c.group.position.y - d.y) : Math.abs(c.group.position.x - d.x);
            const across = isY ? Math.abs(c.group.position.x - d.x) : Math.abs(c.group.position.y - d.y);
            if (along < d.w * 0.65 && across < 95) {
                near = true; break;
            }
        }
        d.open += ((near ? 1 : 0) - d.open) * Math.min(1, dt * 8);
        const slide = d.open * (d.w * 0.42);
        if (isY) {
            d.l.position.y = d.y - d.w / 4 - slide;
            d.r.position.y = d.y + d.w / 4 + slide;
        } else {
            d.l.position.x = d.x - d.w / 4 - slide;
            d.r.position.x = d.x + d.w / 4 + slide;
        }
    }

    activeMixers.forEach(m => m.update(dt));
    for (let i = allCharacters.length - 1; i >= 0; i--) {
        allCharacters[i].update(dt);
    }
    DialogueManager.update(dt);
    PatientFlowManager.update(dt);
    PolicePatrolManager.update(dt);
    TrafficManager.update(dt);
    TimeAtmosphereManager.update(dt);
    HourlyUpdateManager.update(dt);

    controls.update();
    renderer.render(scene, camera);
}
animate();

window.addEventListener('resize', () => {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
});
