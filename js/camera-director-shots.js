// "Đạo diễn" camera: nhiều góc máy, chuyển mượt (lerp) giữa các góc, bắt đầu chuyển đúng nhịp kick.
// Không bám theo vật thể nào — mỗi shot chỉ tính vị trí máy + điểm nhìn cố định trong không gian.
// Shot: setup(state) chạy 1 lần; update(t, state, out) ghi out.pos / out.target (t = giây từ lúc vào shot)

const randSign = () => (Math.random() < 0.5 ? -1 : 1);
const FLY_MAX_Z = -5; // điểm dừng của flyThrough: vẫn còn nửa cụm thiên thạch phía trước

const CAMERA_SHOTS = {
    // Toàn cảnh xoay vòng quanh cả hệ, nghiêng nhẹ lên xuống
    wideOrbit: {
        setup: (s) => { s.angle = Math.random() * Math.PI * 2; s.dir = randSign(); },
        update: (t, s, out) => {
            const a = s.angle + t * 0.2 * s.dir;
            out.pos.set(Math.sin(a) * 48, Math.sin(t * 0.3) * 12, Math.cos(a) * 48);
            out.target.set(0, 0, 0);
        }
    },

    // Lượn gần, nằm ngay trong đám thiên thạch, nhìn về tâm
    closeOrbit: {
        setup: (s) => { s.angle = Math.random() * Math.PI * 2; s.dir = randSign(); s.h = (Math.random() - 0.5) * 10; },
        update: (t, s, out) => {
            const a = s.angle + t * 0.3 * s.dir;
            out.pos.set(Math.sin(a) * 20, s.h + Math.sin(t * 0.5) * 3, Math.cos(a) * 20);
            out.target.set(0, 0, 0);
        }
    },

    // Nhìn từ trên xuống, xoay chậm như drone
    topDown: {
        setup: (s) => { s.angle = Math.random() * Math.PI * 2; },
        update: (t, s, out) => {
            const a = s.angle + t * 0.12;
            out.pos.set(Math.sin(a) * 8, 55 - t * 1.5, Math.cos(a) * 8);
            out.target.set(0, 0, 0);
        }
    },

    // Bay chậm tiến vào đám thiên thạch theo trục z, nhìn thẳng phía trước.
    // Dừng ở FLY_MAX_Z để không bay vượt qua cụm rồi nhìn vào khoảng tối
    flyThrough: {
        setup: (s) => {
            s.x = (Math.random() - 0.5) * 20;
            s.y = (Math.random() - 0.5) * 20;
            s.z = -50 + Math.random() * 10;
        },
        update: (t, s, out) => {
            const z = Math.min(FLY_MAX_Z, s.z + t * 3.5);
            out.pos.set(s.x + Math.sin(t * 0.5) * 3, s.y + Math.cos(t * 0.4) * 2, z);
            out.target.set(s.x * 0.5, s.y * 0.5, z + 30);
        }
    },

    // Góc thấp hất lên, dolly tiến dần vào tâm
    lowDolly: {
        setup: (s) => { s.angle = Math.random() * Math.PI * 2; },
        update: (t, s, out) => {
            const r = Math.max(30, 60 - t * 3);
            out.pos.set(Math.sin(s.angle) * r, -24, Math.cos(s.angle) * r);
            out.target.set(0, 6, 0);
        }
    }
};

const makePose = () => ({ pos: new THREE.Vector3(), target: new THREE.Vector3() });
const _curPose = makePose(), _prevPose = makePose(), _lookAt = new THREE.Vector3();
const CUT_FALLBACK_WAIT = 4;   // giây chờ thêm kick sau khi hết duration, quá thì chuyển luôn
const MIN_BLEND_DISTANCE = 18; // khoảng cách tối thiểu từ máy tới điểm nhìn trong lúc lướt

// cur = shot đang chiếu, prev = shot cũ (vẫn chạy tiếp trong lúc blend để chuyển động liền mạch)
const director = { cur: null, prev: null, blendStart: 0 };

// easeInOutCubic: khởi động chậm, lướt nhanh ở giữa, hạ cánh êm
const easeInOut = (x) => (x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2);

// Mỗi shot có thời lượng ngẫu nhiên trong [camMinShot, camMaxShot] → nhịp chuyển không đều, không spam
function startShot(now) {
    const names = Object.keys(CAMERA_SHOTS).filter(n => n !== director.cur?.name);
    const shot = {
        name: names[Math.floor(Math.random() * names.length)],
        start: now,
        duration: CONFIG.camMinShot + Math.random() * (CONFIG.camMaxShot - CONFIG.camMinShot),
        state: {}
    };
    CAMERA_SHOTS[shot.name].setup(shot.state);
    director.prev = director.cur; // null ở lần đầu → không blend
    director.cur = shot;
    director.blendStart = now;
}

const evalShot = (shot, now, out) => CAMERA_SHOTS[shot.name].update(now - shot.start, shot.state, out);

// Gọi mỗi khung hình. Trả về độ "đang di chuyển" 0–1 (đỉnh ở giữa quá trình chuyển) để renderer làm motion blur
function updateCameraDirector(intensity) {
    const now = performance.now() / 1000;
    const cur = director.cur;
    if (!cur) startShot(now);
    else {
        const elapsed = now - cur.start;
        const due = elapsed > cur.duration;
        if ((due && intensity > CONFIG.camCutOnKick) || elapsed > cur.duration + CUT_FALLBACK_WAIT) startShot(now);
    }

    evalShot(director.cur, now, _curPose);
    let moving = 0;

    const blendT = (now - director.blendStart) / CONFIG.camBlendTime;
    if (director.prev && blendT < 1) {
        evalShot(director.prev, now, _prevPose);
        const e = easeInOut(blendT);
        _curPose.pos.lerpVectors(_prevPose.pos, _curPose.pos, e);
        _curPose.target.lerpVectors(_prevPose.target, _curPose.target, e);
        // Hai góc ở 2 phía đối diện → đường lerp xuyên qua điểm nhìn làm camera lật; đẩy ra giữ khoảng cách tối thiểu
        _lookAt.subVectors(_curPose.pos, _curPose.target);
        if (_lookAt.length() < MIN_BLEND_DISTANCE) {
            if (_lookAt.lengthSq() < 1e-6) _lookAt.set(0, 1, 0);
            _curPose.pos.copy(_curPose.target).add(_lookAt.setLength(MIN_BLEND_DISTANCE));
        }
        moving = Math.sin(blendT * Math.PI); // 0 → 1 → 0
    } else {
        director.prev = null;
    }

    camera.position.copy(_curPose.pos);
    camera.lookAt(_lookAt.copy(_curPose.target));

    // Rung máy theo kick — cộng sau cùng nên không bị trôi dồn qua các khung
    if (intensity > 0.5) {
        camera.position.x += (Math.random() - 0.5) * intensity;
        camera.position.y += (Math.random() - 0.5) * intensity;
    }
    return moving;
}
